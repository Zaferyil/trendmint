const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';

// Wearable textiles are searched together: a trend is a design idea, and the
// same idea sells across tee, sweatshirt and hoodie. Etsy ANDs the words in
// `keywords`, so one combined query would match almost nothing — the searches
// are fired separately and merged instead.
const APPAREL_KEYWORDS = ['graphic tee shirt', 'graphic sweatshirt', 'graphic hoodie'];

// Kept for callers that still ask for one garment, and for non-apparel work.
const TRENDING_CATEGORIES = {
  apparel: APPAREL_KEYWORDS,
  tshirts: ['graphic tee shirt'],
  sweatshirts: ['graphic sweatshirt'],
  hoodies: ['graphic hoodie'],
  'home-decor': ['home living decor'],
  prints: ['art prints'],
};

// Etsy mixes print-ready files in with garments; these markers only ever show
// up on the digital ones.
const DIGITAL_MARKERS = [
  'svg',
  'png',
  'dxf',
  'eps',
  'clipart',
  'clip art',
  'digital download',
  'instant download',
  'digital file',
  'cricut',
  'silhouette',
  'printable',
  'sublimation design',
  'design bundle',
];

/**
 * TREND != POPULAR.
 *
 * Thresholds are per-day rates, not lifetime totals. A listing accumulates
 * views for as long as it exists, so totals rank an eight-year-old listing
 * above a fast-moving new one: 2,447 views over 3,019 days is 0.8 views/day,
 * which is a dead listing, while 800 views over 30 days is 27/day.
 *
 * Only view count and favourite count are trusted here. Rating and review
 * count are shop-level fields that search results omit entirely, so gating on
 * them rejects everything; they are used for scoring only when present.
 */
// minViews/minFavorites guard the rate: a listing two days old with 6 views and
// 2 favourites reads as 3 views/day at a 33% save rate, which would outrank
// everything real. Small numbers make loud rates, so a floor of absolute
// evidence is required before a rate is believed.
const TREND_TIERS = {
  STEADY: { name: '🟢 Steady', viewsPerDay: 0.5, favoritesPerDay: 0.03, favoriteRate: 0.01, minViews: 25, minFavorites: 1 },
  STRONG: { name: '🟡 Strong Trend', viewsPerDay: 3, favoritesPerDay: 0.15, favoriteRate: 0.02, minViews: 60, minFavorites: 3 },
  HOT: { name: '🔴 Hot Trend', viewsPerDay: 10, favoritesPerDay: 0.5, favoriteRate: 0.03, minViews: 120, minFavorites: 6 },
};

// Used when the strict pass finds nothing — better a weak list, labelled as
// weak, than a silent fall back to demo data.
const FALLBACK_TIER = {
  name: '⚪ Early Signal',
  viewsPerDay: 0,
  favoritesPerDay: 0,
  favoriteRate: 0,
  minViews: 0,
  minFavorites: 1, // one save is the least evidence worth showing
};

// How far back a listing may have been created and still count as a trend.
// Velocity alone does not bound this: a listing from 2018 with steady traffic
// scores respectably, but nobody should design for it — that market is settled.
const DEFAULT_MAX_AGE_DAYS = 7;

// Beyond this, "new" stops meaning anything. Inside a short window the label is
// scaled to the window instead, so it still separates the front half from the
// back half rather than marking every row RISING.
const MAX_RISING_THRESHOLD_DAYS = 30;

function isDigitalListing(listing) {
  const haystack = [listing.title, ...(listing.tags || [])].join(' ').toLowerCase();
  return DIGITAL_MARKERS.some((marker) => haystack.includes(marker));
}

/**
 * Which garment the listing is for, so the design prompt matches the product.
 * Read from the listing itself now that the three searches are merged.
 */
function detectGarment(listing) {
  const haystack = [listing.title, ...(listing.tags || [])].join(' ').toLowerCase();
  if (haystack.includes('hoodie') || haystack.includes('hooded')) return 'hoodie';
  if (haystack.includes('sweatshirt') || haystack.includes('crewneck')) return 'sweatshirt';
  return 't-shirt';
}

/** Etsy has used three names for the creation date across API versions. */
function getCreatedTimestamp(listing) {
  return (
    listing.original_creation_timestamp ??
    listing.created_timestamp ??
    listing.creation_timestamp ??
    null
  );
}

function getAgeInDays(listing) {
  const timestamp = getCreatedTimestamp(listing);
  if (!timestamp) return null; // unknown age — never treated as old
  return (Date.now() - timestamp * 1000) / (1000 * 60 * 60 * 24);
}

/**
 * Reads engagement fields, tolerating the names Etsy varies between, and
 * converts lifetime totals into per-day rates.
 */
function readMetrics(listing) {
  const views = Number(listing.views ?? listing.num_views ?? 0) || 0;
  const favorites = Number(listing.num_favorers ?? listing.favorite_count ?? 0) || 0;
  const reviews = Number(listing.num_reviews ?? listing.review_count ?? 0) || 0;
  const rating = Number(listing.rating ?? listing.review_average ?? 0) || 0;
  const ageInDays = getAgeInDays(listing);

  // Unknown age is rated over a 30-day window: optimistic enough not to bury
  // the listing, conservative enough not to crown it.
  const days = Math.max(ageInDays ?? 30, 1);

  return {
    views,
    favorites,
    reviews,
    rating,
    ageInDays,
    viewsPerDay: views / days,
    favoritesPerDay: favorites / days,
    // Share of viewers who saved it. The one metric independent of both size
    // and age, so it survives when the others are distorted.
    favoriteRate: views > 0 ? favorites / views : 0,
  };
}

function matchesTier(metrics, tier) {
  return (
    metrics.views >= tier.minViews &&
    metrics.favorites >= tier.minFavorites &&
    metrics.viewsPerDay >= tier.viewsPerDay &&
    metrics.favoritesPerDay >= tier.favoritesPerDay &&
    metrics.favoriteRate >= tier.favoriteRate
  );
}

/**
 * Scores a listing so current activity outranks accumulated history.
 *
 * Velocity 40%, favourite rate 30%, conversion proxy 20% (review count stands
 * in for sales, which the public API does not expose), quality 10%. Missing
 * fields score zero rather than disqualifying the listing.
 */
function scoreListing(metrics, risingThresholdDays) {
  const { ageInDays, favoriteRate, favoritesPerDay, reviews, rating, viewsPerDay } = metrics;

  const velocity = Math.min(viewsPerDay * 2, 100) * 0.6 + Math.min(favoritesPerDay * 40, 100) * 0.4;
  const engagement = Math.min(favoriteRate * 1000, 100); // 10% rate maxes out
  const conversion = reviews > 0 ? Math.min(reviews * 15, 100) : Math.min(viewsPerDay * 2, 100);
  const quality = (rating / 5) * 100;

  const base = velocity * 0.4 + engagement * 0.3 + conversion * 0.2 + quality * 0.1;

  // A new listing has had less time to accumulate anything, so equal velocity
  // from a standing start counts for more. Scaled to the window, or every row
  // in a 7-day search would take the same multiplier and it would rank nothing.
  const age = ageInDays;
  const recencyBoost =
    age === null ? 1.0 : age < risingThresholdDays ? 1.5 : age < risingThresholdDays * 3 ? 1.2 : 1.0;
  return base * recencyBoost;
}

/**
 * Returns tier info for a listing, or null when it clears no tier.
 * `tiers` lets the caller retry with the looser fallback tier.
 */
function classifyTrend(listing, tiers = TREND_TIERS, risingThresholdDays = MAX_RISING_THRESHOLD_DAYS) {
  const metrics = readMetrics(listing);

  let tier = null;
  for (const key of ['HOT', 'STRONG', 'STEADY']) {
    if (tiers[key] && matchesTier(metrics, tiers[key])) {
      tier = tiers[key];
      break;
    }
  }
  if (!tier) return null;

  const isRising = metrics.ageInDays !== null && metrics.ageInDays < risingThresholdDays;

  return {
    metrics,
    tierName: tier.name,
    score: scoreListing(metrics, risingThresholdDays),
    isRising,
    // No label when the age is unknown — better a missing badge than a
    // confident wrong one.
    classification:
      metrics.ageInDays === null ? null : isRising ? '🔥 RISING' : '⭐ ESTABLISHED',
    ageInDays: metrics.ageInDays === null ? null : Math.floor(metrics.ageInDays),
    favoriteRate: `${(metrics.favoriteRate * 100).toFixed(2)}%`,
    viewsPerDay: Number(metrics.viewsPerDay.toFixed(1)),
    favoritesPerDay: Number(metrics.favoritesPerDay.toFixed(2)),
  };
}

/**
 * Etsy v3 wants the keystring and the shared secret in one header, separated by
 * a colon. Passing the keystring alone answers "Shared secret is required in
 * x-api-key header"; passing the secret alone answers "API key not found".
 */
function buildApiKeyHeader(apiKey, sharedSecret) {
  if (!apiKey) return null;
  if (apiKey.includes(':')) return apiKey; // already a combined credential
  return sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey;
}

async function fetchOneKeyword({ keyword, sortOn, limit, credential }) {
  const params = new URLSearchParams({
    keywords: keyword,
    sort_on: sortOn,
    sort_order: 'desc',
    limit: String(Math.min(limit, 100)),
  });

  const response = await fetch(`${ETSY_API_BASE}/listings/active?${params}`, {
    headers: { 'x-api-key': credential },
  });

  if (!response.ok) {
    const detail = await response.text();
    return { keyword, sortOn, error: { status: response.status, detail: detail.slice(0, 300) } };
  }

  const data = await response.json();
  return { keyword, sortOn, results: data.results || [] };
}

/**
 * Runs every keyword against two orderings and merges the results,
 * de-duplicated by listing id.
 *
 * `score` alone cannot answer a short window: Etsy ranks established sellers
 * highly, so that pool is dominated by listings years old and a 7-day filter
 * finds nothing to keep. `created` supplies the freshly listed candidates the
 * window is actually about. Neither ordering alone is enough — score finds
 * what sells, created finds what is new.
 */
async function fetchListings({ category, limit, credential, customKeyword }) {
  // If a custom keyword is provided, combine it with all apparel category keywords.
  // This ensures custom searches return graphic t-shirts, sweatshirts, AND hoodies.
  // Example: "halloween" + ["graphic tee shirt", "graphic sweatshirt", "graphic hoodie"]
  let keywords;
  if (customKeyword) {
    const categoryKeywords = TRENDING_CATEGORIES[category] || APPAREL_KEYWORDS;
    keywords = categoryKeywords.map((k) => `${customKeyword} ${k}`);
  } else {
    keywords = TRENDING_CATEGORIES[category] || [category];
  }
  // Over-fetch: the digital filter and the trend filter both discard rows.
  const perKeyword = Math.min(Math.ceil(limit * 3), 100);

  const requests = [];
  for (const keyword of keywords) {
    for (const sortOn of ['score', 'created']) {
      requests.push(fetchOneKeyword({ keyword, sortOn, limit: perKeyword, credential }));
    }
  }

  const responses = await Promise.all(requests);

  const failures = responses.filter((r) => r.error);
  // Only a total failure is fatal; a partial one still yields a usable list.
  if (failures.length === responses.length) {
    return { error: failures[0].error };
  }

  const byId = new Map();
  for (const response of responses) {
    for (const listing of response.results || []) {
      if (!byId.has(listing.listing_id)) byId.set(listing.listing_id, listing);
    }
  }

  return {
    results: [...byId.values()],
    keywordsUsed: keywords,
    // Named by ordering too: losing `created` quietly would empty a short
    // window while `score` kept the request looking healthy.
    failedQueries: failures.map((f) => `${f.keyword} (${f.sortOn})`),
  };
}

function toCard(listing, trend) {
  return {
    id: `etsy-${listing.listing_id}`,
    name: listing.title,
    description: listing.description?.substring(0, 100),
    url: listing.url,
    garment: detectGarment(listing),
    price: listing.price
      ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
      : null,
    metrics: {
      views: trend.metrics.views,
      favorites: trend.metrics.favorites,
      reviews: trend.metrics.reviews,
      rating: trend.metrics.rating,
      favoriteRate: trend.favoriteRate,
      viewsPerDay: trend.viewsPerDay,
      favoritesPerDay: trend.favoritesPerDay,
      trendTier: trend.tierName,
      trendAge: trend.ageInDays,
      classification: trend.classification,
    },
    tags: listing.tags || [],
  };
}

/**
 * Fetches trending Etsy listings server-side, where the API key stays secret
 * and there is no CORS preflight to fail.
 */
export async function getTrendingListings({
  category = 'apparel',
  limit = 12,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  apiKey,
  sharedSecret,
}) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const wanted = Math.min(Number(limit) || 12, 100);
  // 0 or a non-number means "no ceiling", which the UI offers explicitly.
  const ageLimit = Number(maxAgeDays) > 0 ? Number(maxAgeDays) : Infinity;
  const { results, error, keywordsUsed, failedQueries } = await fetchListings({
    category,
    limit: wanted,
    credential,
  });

  if (error) {
    return {
      status: error.status,
      body: { listings: [], error: `Etsy API error (${error.status})`, detail: error.detail },
    };
  }

  const garments = results.filter((listing) => !isDigitalListing(listing));

  // Age ceiling, applied before any tier check. A listing with no timestamp is
  // kept — its age cannot be disproved, and dropping it would silently discard
  // real data whenever Etsy omits the field.
  const withinWindow = garments.filter((listing) => {
    const age = getAgeInDays(listing);
    return age === null || age <= ageLimit;
  });
  const droppedTooOld = garments.length - withinWindow.length;

  // Strict pass first; if the window is thin today, retry with the fallback
  // tier so the UI shows the best available rather than nothing at all. The
  // age ceiling is NOT relaxed here — loosening it would hand back exactly the
  // stale listings the ceiling exists to exclude.
  // "New" is relative to the window: half of it, capped, so a 7-day search
  // still separates its first days from its last instead of marking all RISING.
  const risingDays = Math.min(MAX_RISING_THRESHOLD_DAYS, Math.max(ageLimit / 2, 1));

  let mode = 'trending';
  let classified = withinWindow
    .map((listing) => ({ listing, trend: classifyTrend(listing, TREND_TIERS, risingDays) }))
    .filter((row) => row.trend !== null);

  if (classified.length === 0) {
    mode = 'early-signal';
    classified = withinWindow
      .map((listing) => ({
        listing,
        trend: classifyTrend(listing, { STEADY: FALLBACK_TIER }, risingDays),
      }))
      .filter((row) => row.trend !== null);
  }

  // Rising listings first, then by score inside each group.
  classified.sort((a, b) => {
    if (a.trend.isRising !== b.trend.isRising) return a.trend.isRising ? -1 : 1;
    return b.trend.score - a.trend.score;
  });

  const listings = classified.slice(0, wanted).map(({ listing, trend }) => toCard(listing, trend));

  return {
    status: 200,
    body: {
      listings,
      success: true,
      // An empty list because the window was tight is a real answer, not a
      // failure — say so, so the UI does not report it as a broken API.
      note:
        listings.length === 0 && droppedTooOld > 0
          ? `No listing cleared the threshold in the last ${ageLimit} days — ` +
            `${droppedTooOld} listing${droppedTooOld === 1 ? ' was' : 's were'} older than the window. ` +
            `Try a wider time window.`
          : undefined,
      // Lets the UI (and a human reading /api/etsy-trends) see where rows went.
      meta: {
        mode,
        keywords: keywordsUsed,
        failedQueries,
        maxAgeDays: ageLimit === Infinity ? null : ageLimit,
        fetched: results.length,
        afterDigitalFilter: garments.length,
        droppedTooOld,
        afterTrendFilter: classified.length,
        analyzedAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Diagnostic endpoint: reports which fields Etsy actually returns for this
 * account, so the thresholds above can be calibrated against real data instead
 * of assumptions about the schema.
 */
export async function debugTrendingListings({ category = 'apparel', apiKey, sharedSecret }) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { error: 'ETSY_API_KEY not configured on the server' } };
  }

  const { results, error } = await fetchListings({ category, limit: 2, credential });

  if (error) {
    return { status: error.status, body: { error: `Etsy API error (${error.status})`, detail: error.detail } };
  }

  const sample = results[0] || null;

  return {
    status: 200,
    body: {
      totalReturned: results.length,
      availableFields: sample ? Object.keys(sample).sort() : [],
      engagementFieldsPresent: sample
        ? {
            views: 'views' in sample ? sample.views : '(field missing)',
            num_favorers: 'num_favorers' in sample ? sample.num_favorers : '(field missing)',
            num_reviews: 'num_reviews' in sample ? sample.num_reviews : '(field missing)',
            rating: 'rating' in sample ? sample.rating : '(field missing)',
            original_creation_timestamp:
              'original_creation_timestamp' in sample ? sample.original_creation_timestamp : '(field missing)',
            created_timestamp: 'created_timestamp' in sample ? sample.created_timestamp : '(field missing)',
          }
        : null,
      // What the classifier makes of the first few listings.
      classified: results.slice(0, 4).map((listing) => ({
        title: listing.title?.slice(0, 60),
        garment: detectGarment(listing),
        metrics: readMetrics(listing),
        passesStrict: classifyTrend(listing) !== null,
      })),
    },
  };
}

export async function getShopListings({ shopId, apiKey, sharedSecret }) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const response = await fetch(`${ETSY_API_BASE}/shops/${encodeURIComponent(shopId)}/listings/active`, {
    headers: { 'x-api-key': credential },
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      status: response.status,
      body: { listings: [], error: `Etsy API error (${response.status})`, detail: detail.slice(0, 500) },
    };
  }

  const data = await response.json();
  return { status: 200, body: { listings: data.results || [], success: true } };
}

/**
 * Bestsellers: proven popular products ranked by sales indicators.
 * Algorithm: review count (sales proxy) → rating (quality) → views (interest).
 * These are products that have been consistently selling well over time.
 */
export async function getBestsellerListings({
  category = 'apparel',
  limit = 12,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  apiKey,
  sharedSecret,
  keyword,
}) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const wanted = Math.min(Number(limit) || 12, 100);
  const ageLimit = Number(maxAgeDays) > 0 ? Number(maxAgeDays) : Infinity;
  const { results, error, keywordsUsed, failedQueries } = await fetchListings({
    category,
    limit: wanted,
    credential,
    customKeyword: keyword,
  });

  if (error) {
    return {
      status: error.status,
      body: { listings: [], error: `Etsy API error (${error.status})`, detail: error.detail },
    };
  }

  const garments = results.filter((listing) => !isDigitalListing(listing));
  const withinWindow = garments.filter((listing) => {
    const age = getAgeInDays(listing);
    return age === null || age <= ageLimit;
  });

  // Sort by review count (primary), rating (secondary), and views (tertiary).
  // High review count = many sales. High rating = quality. High views = interest.
  const sortedByQuality = withinWindow
    .map((listing) => ({
      listing,
      metrics: readMetrics(listing),
    }))
    .sort((a, b) => {
      const reviewDiff = Number(b.metrics.reviews) - Number(a.metrics.reviews);
      if (reviewDiff !== 0) return reviewDiff;

      const ratingDiff = Number(b.metrics.rating) - Number(a.metrics.rating);
      if (ratingDiff !== 0) return ratingDiff;

      // If reviews and rating are similar, use views as tiebreaker
      return Number(b.metrics.views) - Number(a.metrics.views);
    });

  const listings = sortedByQuality
    .slice(0, wanted)
    .map(({ listing, metrics }) => ({
      id: `etsy-${listing.listing_id}`,
      name: listing.title,
      description: listing.description?.substring(0, 100),
      url: listing.url,
      garment: detectGarment(listing),
      price: listing.price
        ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
        : null,
      metrics: {
        views: metrics.views,
        favorites: metrics.favorites,
        reviews: metrics.reviews,
        rating: metrics.rating,
        trendTier: '🏆 Bestseller',
        trendAge: getAgeInDays(listing),
      },
      tags: listing.tags || [],
    }));

  return {
    status: 200,
    body: {
      listings,
      success: true,
      note: listings.length === 0 ? 'No bestsellers found in this time window.' : undefined,
      meta: {
        mode: 'bestsellers',
        keywords: keywordsUsed,
        failedQueries,
        maxAgeDays: ageLimit === Infinity ? null : ageLimit,
        fetched: results.length,
        analyzedAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Popular: trending products ranked by views and recency.
 * These are products gaining momentum recently.
 */
export async function getPopularListings({
  category = 'apparel',
  limit = 12,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  apiKey,
  sharedSecret,
  keyword,
}) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const wanted = Math.min(Number(limit) || 12, 100);
  const ageLimit = Number(maxAgeDays) > 0 ? Number(maxAgeDays) : Infinity;
  const { results, error, keywordsUsed, failedQueries } = await fetchListings({
    category,
    limit: wanted,
    credential,
    customKeyword: keyword,
  });

  if (error) {
    return {
      status: error.status,
      body: { listings: [], error: `Etsy API error (${error.status})`, detail: error.detail },
    };
  }

  const garments = results.filter((listing) => !isDigitalListing(listing));
  const withinWindow = garments.filter((listing) => {
    const age = getAgeInDays(listing);
    return age === null || age <= ageLimit;
  });

  // Sort by views/day (primary) and recency (secondary)
  const sortedByPopularity = withinWindow
    .map((listing) => ({
      listing,
      metrics: readMetrics(listing),
    }))
    .sort((a, b) => {
      const viewsDiff = Number(b.metrics.viewsPerDay) - Number(a.metrics.viewsPerDay);
      if (viewsDiff > 0.1 || viewsDiff < -0.1) return viewsDiff;
      // If views/day are similar, prefer newer listings
      const ageA = getAgeInDays(a.listing) ?? 999;
      const ageB = getAgeInDays(b.listing) ?? 999;
      return ageA - ageB;
    });

  const listings = sortedByPopularity
    .slice(0, wanted)
    .map(({ listing, metrics }) => ({
      id: `etsy-${listing.listing_id}`,
      name: listing.title,
      description: listing.description?.substring(0, 100),
      url: listing.url,
      garment: detectGarment(listing),
      price: listing.price
        ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
        : null,
      metrics: {
        views: metrics.views,
        favorites: metrics.favorites,
        reviews: metrics.reviews,
        rating: metrics.rating,
        viewsPerDay: metrics.viewsPerDay,
        trendTier: '⭐ Popular',
        trendAge: getAgeInDays(listing),
      },
      tags: listing.tags || [],
    }));

  return {
    status: 200,
    body: {
      listings,
      success: true,
      note: listings.length === 0 ? 'No popular items found in this time window.' : undefined,
      meta: {
        mode: 'popular',
        keywords: keywordsUsed,
        failedQueries,
        maxAgeDays: ageLimit === Infinity ? null : ageLimit,
        fetched: results.length,
        analyzedAt: new Date().toISOString(),
      },
    },
  };
}
