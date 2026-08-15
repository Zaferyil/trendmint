const ETSY_API_BASE = 'https://openapi.etsy.com/v3';
const ETSY_API_KEY = import.meta.env.VITE_ETSY_API_KEY;

const TRENDING_CATEGORIES = {
  'tshirts': 'tshirt-designs',
  'home-decor': 'home-living-decor',
  'prints': 'art-prints',
};

export const etsyService = {
  async getTrendingListings(category = 'tshirts', limit = 12) {
    if (!ETSY_API_KEY) {
      console.warn('Etsy API key not configured');
      return { listings: [], error: 'API key not configured' };
    }

    try {
      const params = new URLSearchParams({
        keywords: TRENDING_CATEGORIES[category] || category,
        sort_on: 'trending',
        limit: Math.min(limit, 100),
      });

      const response = await fetch(
        `${ETSY_API_BASE}/listings/active?${params}`,
        {
          headers: {
            'x-api-key': ETSY_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Etsy API error: ${response.statusText}`);
      }

      const data = await response.json();

      const trends = data.results?.map((listing) => ({
        id: `etsy-${listing.listing_id}`,
        name: listing.title,
        description: listing.description?.substring(0, 100),
        metrics: {
          views: listing.views || 0,
          favorites: listing.favorite_count || 0,
        },
        tags: listing.tags || [],
      })) || [];

      return { listings: trends, success: true };
    } catch (error) {
      console.error('Error fetching Etsy trends:', error);
      return { listings: [], error: error.message };
    }
  },

  async getShopListings(shopId) {
    if (!ETSY_API_KEY) {
      return { listings: [], error: 'API key not configured' };
    }

    try {
      const response = await fetch(
        `${ETSY_API_BASE}/shops/${shopId}/listings/active`,
        {
          headers: {
            'x-api-key': ETSY_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Etsy API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { listings: data.results || [], success: true };
    } catch (error) {
      console.error('Error fetching shop listings:', error);
      return { listings: [], error: error.message };
    }
  },

  async getPopularTerms() {
    return {
      terms: [
        { term: 'minimalist cat designs', trend: 'rising' },
        { term: 'retro 90s graphics', trend: 'rising' },
        { term: 'botanical plants', trend: 'stable' },
      ],
    };
  },
};
