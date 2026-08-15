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
 * TREND ≠ POPULAR
 *
 * This system prioritizes RISING trends (momentum) over established popularity.
 * A new product with 800 views growing fast > established product with 10k stable views
 *
 * Tier System:
 * 🟢 Minimum Trend - Early stage, captures emerging trends
 * 🟡 Strong Trend - Significant engagement, reliable signal
 * 🔴 Hot Trend - Major momentum, highest priority for POD
 */

const TREND_TIERS = {
  MINIMUM: {
    name: '🟢 Minimum Trend',
    views: 50,
    favorites: 2,
    favoriteRate: 0.01,      // 1% - very permissive for early trends
    rating: 3.5,
  },
  STRONG: {
    name: '🟡 Strong Trend',
    views: 200,
    favorites: 5,
    favoriteRate: 0.02,       // 2% - solid engagement
    rating: 4.0,
  },
  HOT: {
    name: '🔴 Hot Trend',
    views: 500,
    favorites: 10,
    favoriteRate: 0.03,       // 3% - high engagement
    rating: 4.5,
  },
};

function isDigitalListing(listing) {
  const haystack = [listing.title, ...(listing.tags || [])].join(' ').toLowerCase();
  return DIGITAL_MARKERS.some((marker) => haystack.includes(marker));
}

/**
 * Calculate favorite rate (social proof metric)
 * Higher ratio = more people love it = stronger trend signal
 */
function calculateFavoriteRate(views, favorites) {
  return views > 0 ? (favorites / views) : 0;
}

/**
 * Calculate recency boost for new listings
 * Listings created in last 30 days get exponential boost
 * This helps surface rising trends before they become obvious
 */
function getRecencyBoost(createdTimestamp) {
  if (!createdTimestamp) return 1.0;

  const createdDate = new Date(createdTimestamp * 1000);
  const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

  // Listings < 30 days old get 1.5x boost (they're emerging)
  // Listings 30-60 days old get 1.2x boost
  // Listings > 60 days old get 1.0x (no boost)
  if (ageInDays < 30) return 1.5;
  if (ageInDays < 60) return 1.2;
  return 1.0;
}

/**
 * Classify listing into tier + calculate priority score
 * Returns: { tier, tierName, priorityScore, favoriteRate, ageInDays, classification }
 * or null if doesn't meet minimum threshold
 */
function classifyTrend(listing) {
  const views = listing.views || 0;
  const favorites = listing.num_favorers ?? listing.favorite_count ?? 0;
  const reviews = listing.num_reviews ?? 0;
  const rating = listing.rating || 0;
  const favoriteRate = calculateFavoriteRate(views, favorites);
  const recencyBoost = getRecencyBoost(listing.created_timestamp);

  // Determine listing age for classification
  const createdDate = listing.created_timestamp
    ? new Date(listing.created_timestamp * 1000)
    : null;
  const ageInDays = createdDate
    ? (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  // Check tier match (ordered from strictest to loosest)
  let tier = null;

  if (views >= TREND_TIERS.HOT.views &&
      favorites >= TREND_TIERS.HOT.favorites &&
      favoriteRate >= TREND_TIERS.HOT.favoriteRate &&
      rating >= TREND_TIERS.HOT.rating) {
    tier = 'HOT';
  } else if (views >= TREND_TIERS.STRONG.views &&
             favorites >= TREND_TIERS.STRONG.favorites &&
             favoriteRate >= TREND_TIERS.STRONG.favoriteRate &&
             rating >= TREND_TIERS.STRONG.rating) {
    tier = 'STRONG';
  } else if (views >= TREND_TIERS.MINIMUM.views &&
             favorites >= TREND_TIERS.MINIMUM.favorites &&
             favoriteRate >= TREND_TIERS.MINIMUM.favoriteRate &&
             rating >= TREND_TIERS.MINIMUM.rating) {
    tier = 'MINIMUM';
  }

  if (!tier) return null; // Doesn't meet minimum threshold

  // Calculate priority score (higher = more trending)
  // Emphasis: Favorite rate (20%) + Recency (30%) + Views (20%) + Rating (15%) + Reviews (15%)
  const baseScore =
    (favoriteRate * 100) * 0.20 +  // Engagement quality
    (ageInDays < 30 ? 100 : ageInDays < 60 ? 80 : 60) * 0.30 +  // Recency bonus
    Math.min(views / 10, 100) * 0.20 +  // Visibility (normalized)
    (rating / 5) * 100 * 0.15 +  // Quality
    Math.min(reviews * 10, 100) * 0.15;  // Social proof

  const priorityScore = baseScore * recencyBoost;

  return {
    tier,
    tierName: TREND_TIERS[tier].name,
    priorityScore,
    favoriteRate: (favoriteRate * 100).toFixed(2) + '%',
    ageInDays: Math.floor(ageInDays),
    classification: ageInDays < 30 ? '🔥 RISING' : '⭐ ESTABLISHED',
  };
}

/**
 * Checks if a listing qualifies as a trend (any tier)
 */
function isTrendingListing(listing) {
  return classifyTrend(listing) !== null;
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

/**
 * Fetches trending Etsy listings server-side, where the API key stays secret
 * and there is no CORS preflight to fail.
 *
 * Returns listings classified as TRENDING (not just popular).
 * Prioritizes rising trends (new products with momentum) over established products.
 */
export async function getTrendingListings({ category = 'tshirts', limit = 12, apiKey, sharedSecret }) {
  const credential = buildApiKeyHeader(apiKey, sharedSecret);

  if (!credential) {
    return { status: 501, body: { listings: [], error: 'ETSY_API_KEY not configured on the server' } };
  }

  const wanted = Math.min(Number(limit) || 12, 100);

  const params = new URLSearchParams({
    keywords: TRENDING_CATEGORIES[category] || category,
    sort_on: 'score',
    sort_order: 'desc',
    // Over-fetch significantly because we filter for trending metrics
    // Digital listings + below-threshold listings will be removed
    limit: String(Math.min(wanted * 5, 100)),
  });

  const response = await fetch(`${ETSY_API_BASE}/listings/active?${params}`, {
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

  // Step 1: Remove digital products
  const garments = (data.results || []).filter((listing) => !isDigitalListing(listing));

  // Step 2: Classify trends and filter for qualified trends
  const classifiedListings = garments
    .map((listing) => {
      const trendInfo = classifyTrend(listing);
      return trendInfo ? { listing, trendInfo } : null;
    })
    .filter((item) => item !== null);

  // Step 3: Sort by priority score (rising trends first, then by engagement)
  const sortedListings = classifiedListings.sort((a, b) => {
    // Rising trends (< 30 days) come first
    const aIsRising = a.trendInfo.ageInDays < 30 ? 1 : 0;
    const bIsRising = b.trendInfo.ageInDays < 30 ? 1 : 0;
    if (aIsRising !== bIsRising) return bIsRising - aIsRising;

    // Then sort by priority score
    return b.trendInfo.priorityScore - a.trendInfo.priorityScore;
  });

  // Step 4: Format response
  const listings = sortedListings.slice(0, wanted).map(({ listing, trendInfo }) => ({
    id: `etsy-${listing.listing_id}`,
    name: listing.title,
    description: listing.description?.substring(0, 100),
    url: listing.url,
    price: listing.price ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}` : null,
    metrics: {
      views: listing.views || 0,
      favorites: listing.num_favorers ?? listing.favorite_count ?? 0,
      reviews: listing.num_reviews ?? 0,
      rating: listing.rating ?? 0,
      favoriteRate: trendInfo.favoriteRate,
      trendTier: trendInfo.tierName,
      trendAge: trendInfo.ageInDays,
      classification: trendInfo.classification,
    },
    tags: listing.tags || [],
  }));

  return { status: 200, body: { listings, success: true } };
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
