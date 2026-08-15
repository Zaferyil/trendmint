import { apiClient } from './api';

export const etsyService = {
  async getTrendingListings(category = 'tshirts', limit = 12) {
    try {
      const params = new URLSearchParams({ category, limit: String(limit) });
      const data = await apiClient.get(`/etsy-trends?${params}`);
      return { listings: data.listings || [], success: true };
    } catch (error) {
      console.error('Error fetching Etsy trends:', error);
      return { listings: [], success: false, error: error.message };
    }
  },

  async getShopListings(shopId) {
    try {
      const params = new URLSearchParams({ shopId });
      const data = await apiClient.get(`/etsy-shop-listings?${params}`);
      return { listings: data.listings || [], success: true };
    } catch (error) {
      console.error('Error fetching shop listings:', error);
      return { listings: [], success: false, error: error.message };
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
