const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';

// Keywords aimed at finished garments. Searching "tshirt designs" instead
// returns digital SVG/PNG bundles, which are useless as apparel trends.
const TRENDING_CATEGORIES = {
  tshirts: 'graphic tee shirt',
  sweatshirts: 'graphic sweatshirt',
  hoodies: 'graphic hoodie',
  'home-decor': 'home living decor',
  prints: 'art prints',
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
 * A listing climbing fast from a small base is worth more here than one that
 * peaked months ago, because the point is to design something while the window
 * is still open.
 *
 * Only two signals are trusted for the thresholds: view count and favourite
 * count. Rating and review count are shop-level fields on Etsy — they are
 * absent from search results, so gating on them rejected every single listing.
 * They are still used for scoring when present.
 */
const TREND_TIERS = {
  MINIMUM: { name: '🟢 Minimum Trend', views: 50, favorites: 2, favoriteRate: 0.01 },
  STRONG: { name: '🟡 Strong Trend', views: 200, favorites: 5, favoriteRate: 0.02 },
  HOT: { name: '🔴 Hot Trend', views: 500, favorites: 10, favoriteRate: 0.03 },
};

// Used when the strict pass finds nothing — better a weaker trend list than an
// empty screen.
const FALLBACK_TIER = { name: '⚪ Early Signal', views: 0, favorites: 1, favoriteRate: 0 };

function isDigitalListing(listing) {
  const haystack = [listing.title, ...(listing.tags || [])].join(' ').toLowerCase();
  return DIGITAL_MARKERS.some((marker) => haystack.includes(marker));
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
  if (!timestamp) return null; // unknown age — never treated as "old"
  return (Date.now() - timestamp * 1000) / (1000 * 60 * 60 * 24);
}

/** Reads the engagement fields, tolerating the names Etsy varies between. */
function readMetrics(listing) {
  const views = Number(listing.views ?? listing.num_views ?? 0) || 0;
  const favorites = Number(listing.num_favorers ?? listing.favorite_count ?? 0) || 0;
  const reviews = Number(listing.num_reviews ?? listing.review_count ?? 0) || 0;
  const rating = Number(listing.rating ?? listing.review_average ?? 0) || 0;
  const ageInDays = getAgeInDays(listing);

  return {
    views,
    favorites,
    reviews,
    rating,
    ageInDays,
    // Share of viewers who cared enough to save it. This is the one metric that
    // is independent of raw popularity, so a small listing with real pull is
    // not buried under a large one with weak pull.
    favoriteRate: views > 0 ? favorites / views : 0,
  };
}

function matchesTier(metrics, tier) {
  return (
    metrics.views >= tier.views &&
    metrics.favorites >= tier.favorites &&
    metrics.favoriteRate >= tier.favoriteRate
  );
}

/**
 * Scores a listing so rising ones outrank merely popular ones.
 *
 * Weights follow the engagement model: momentum 30%, favourite rate 30%,
 * conversion proxy 30% (review count stands in for sales, which the public API
 * does not expose), quality 10%. Missing fields simply score zero rather than
 * disqualifying the listing.
 */
function scoreListing(metrics) {
  const { ageInDays, favoriteRate, reviews, rating, views } = metrics;

  // Unknown age scores neutral: claiming it is fresh would promote it over
  // listings that are genuinely new, claiming it is old would bury it.
  const age = ageInDays;
  const momentum = age === null ? 80 : age < 30 ? 100 : age < 60 ? 80 : 60;
  const engagement = Math.min(favoriteRate * 1000, 100); // 10% fav rate maxes out
  const conversion = Math.min(reviews * 15, 100);
  const quality = (rating / 5) * 100;
  const reach = Math.min(views / 10, 100);

  const base =
    momentum * 0.3 +
    engagement * 0.3 +
    (reviews > 0 ? conversion : reach) * 0.3 + // no reviews? fall back to reach
    quality * 0.1;

  const recencyBoost = age === null ? 1.0 : age < 30 ? 1.5 : age < 60 ? 1.2 : 1.0;
  return base * recencyBoost;
}

/**
 * Returns tier info for a listing, or null when it clears no tier.
 * `tiers` lets the caller retry with the looser fallback tier.
 */
function classifyTrend(listing, tiers = TREND_TIERS) {
  const metrics = readMetrics(listing);

  let tier = null;
  for (const key of ['HOT', 'STRONG', 'MINIMUM']) {
    if (tiers[key] && matchesTier(metrics, tiers[key])) {
      tier = tiers[key];
      break;
    }
  }
  if (!tier) return null;

  const isRising = metrics.ageInDays !== null && metrics.ageInDays < 30;

  return {
    metrics,
    tierName: tier.name,
    score: scoreListing(metrics),
    isRising,
    // No label at all when the age is unknown — better a missing badge than a
    // confident wrong one.
    classification:
      metrics.ageInDays === null ? null : isRising ? '🔥 RISING' : '⭐ ESTABLISHED',
    ageInDays: metrics.ageInDays === null ? null : Math.floor(metrics.ageInDays),
    favoriteRate: `${(metrics.favoriteRate * 100).toFixed(2)}%`,
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

async function fetchActiveListings({ category, limit, credential }) {
  const params = new URLSearchParams({
    keywords: TRENDING_CATEGORIES[category] || category,
    sort_on: 'score',
    sort_order: 'desc',
    // Over-fetch: the digital filter and the trend filter both discard rows.
    limit: String(Math.min(limit * 5, 100)),
  });

  const response = await fetch(`${ETSY_API_BASE}/listings/active?${params}`, {
    headers: { 'x-api-key': credential },
  });

  if (!response.ok) {
    const detail = await response.text();
    return { error: { status: response.status, detail: detail.slice(0, 500) } };
  }

  const data = await response.json();
  return { results: data.results || [] };
}

function toCard(listing, trend) {
  return {
    id: `etsy-${listing.listing_id}`,
    name: listing.title,
    description: listing.description?.substring(0, 100),
    url: listing.url,
    price: listing.price
      ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
      : null,
    metrics: {
      views: trend.metrics.views,
      favorites: trend.metrics.favorites,
      reviews: trend.metrics.reviews,
      rating: trend.metrics.rating,
      favoriteRate: trend.favoriteRate,
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
export async function getTrendingListings({ category = 'tshirts', limit = 12, apiKey, sharedSecret }) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const wanted = Math.min(Number(limit) || 12, 100);
  const { results, error } = await fetchActiveListings({ category, limit: wanted, credential });

  if (error) {
    return {
      status: error.status,
      body: { listings: [], error: `Etsy API error (${error.status})`, detail: error.detail },
    };
  }

  const garments = results.filter((listing) => !isDigitalListing(listing));

  // Strict pass first; if the category is thin today, retry with the fallback
  // tier so the UI shows the best available rather than nothing at all.
  let mode = 'trending';
  let classified = garments
    .map((listing) => ({ listing, trend: classifyTrend(listing) }))
    .filter((row) => row.trend !== null);

  if (classified.length === 0) {
    mode = 'early-signal';
    classified = garments
      .map((listing) => ({ listing, trend: classifyTrend(listing, { MINIMUM: FALLBACK_TIER }) }))
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
      // Lets the UI (and a human reading /api/etsy-trends) see where rows went.
      meta: {
        mode,
        fetched: results.length,
        afterDigitalFilter: garments.length,
        afterTrendFilter: classified.length,
      },
    },
  };
}

/**
 * Diagnostic endpoint: reports which fields Etsy actually returns for this
 * account, so the thresholds above can be calibrated against real data instead
 * of assumptions about the schema.
 */
export async function debugTrendingListings({ category = 'tshirts', apiKey, sharedSecret }) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { error: 'ETSY_API_KEY not configured on the server' } };
  }

  const { results, error } = await fetchActiveListings({ category, limit: 4, credential });

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
