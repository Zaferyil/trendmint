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

// Minimum thresholds for a listing to be considered "trending"
const TREND_THRESHOLDS = {
  views: 50,         // Must have at least 50 views
  favorites: 2,      // Must have at least 2 favorites
  reviews: 1,        // Must have at least 1 review
  rating: 3.5,       // Must have 3.5+ star rating
};

/**
 * Calculates a trend score for a listing based on engagement metrics.
 * Higher scores indicate stronger trend signals.
 *
 * Formula: (views × 0.3) + (favorites × 0.4) + (reviews × 0.2) + (rating × 0.1)
 * Weighted heavily on favorites and engagement, moderately on reviews.
 */
function calculateTrendScore(listing) {
  const views = Math.min(listing.views || 0, 10000) / 100; // Normalize views (max 100)
  const favorites = (listing.num_favorers ?? listing.favorite_count ?? 0) * 5; // Weight favorites higher
  const reviews = (listing.num_reviews ?? 0) * 10; // Weight reviews significantly
  const rating = (listing.rating ?? 0) * 10; // Weight rating

  return (views * 0.3) + (favorites * 0.4) + (reviews * 0.2) + (rating * 0.1);
}

/**
 * Checks if a listing meets the minimum threshold to be considered "trending"
 */
function isTrendingListing(listing) {
  const views = listing.views || 0;
  const favorites = listing.num_favorers ?? listing.favorite_count ?? 0;
  const reviews = listing.num_reviews ?? 0;
  const rating = listing.rating ?? 0;

  return (
    views >= TREND_THRESHOLDS.views &&
    favorites >= TREND_THRESHOLDS.favorites &&
    reviews >= TREND_THRESHOLDS.reviews &&
    rating >= TREND_THRESHOLDS.rating
  );
}

function isDigitalListing(listing) {
  const haystack = [listing.title, ...(listing.tags || [])].join(' ').toLowerCase();
  return DIGITAL_MARKERS.some((marker) => haystack.includes(marker));
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

  // Step 2: Filter for trending metrics only
  const trendingGarments = garments.filter((listing) => isTrendingListing(listing));

  // Step 3: Calculate trend scores and sort
  const scoredListings = trendingGarments.map((listing) => ({
    listing,
    trendScore: calculateTrendScore(listing),
  }));

  const sortedListings = scoredListings.sort((a, b) => b.trendScore - a.trendScore);

  // Step 4: Format response
  const listings = sortedListings.slice(0, wanted).map(({ listing }) => ({
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
