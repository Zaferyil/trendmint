const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';

const TRENDING_CATEGORIES = {
  tshirts: 'tshirt designs',
  'home-decor': 'home living decor',
  prints: 'art prints',
};

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

  const params = new URLSearchParams({
    keywords: TRENDING_CATEGORIES[category] || category,
    sort_on: 'score',
    sort_order: 'desc',
    limit: String(Math.min(Number(limit) || 12, 100)),
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

  const listings = (data.results || []).map((listing) => ({
    id: `etsy-${listing.listing_id}`,
    name: listing.title,
    description: listing.description?.substring(0, 100),
    url: listing.url,
    metrics: {
      views: listing.views || 0,
      favorites: listing.num_favorers ?? listing.favorite_count ?? 0,
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
