import { apiClient } from './api';

export const amazonService = {
  async getBestSellersByCategory(category = 'apparel', limit = 12) {
    try {
      const params = new URLSearchParams({ category, limit: String(limit) });
      const data = await apiClient.get(`/best-sellers?${params}`);
      return {
        products: data.products || [],
        success: Boolean(data.success) && (data.products || []).length > 0,
        message: data.message,
      };
    } catch (error) {
      console.error('Error fetching Amazon best sellers:', error);
      return { products: [], success: false, error: error.message };
    }
  },

  async searchProducts(keyword, limit = 12) {
    try {
      const params = new URLSearchParams({ keyword, limit: String(limit) });
      const data = await apiClient.get(`/search?${params}`);
      return {
        products: data.products || [],
        success: Boolean(data.success) && (data.products || []).length > 0,
        message: data.message,
      };
    } catch (error) {
      console.error('Error searching products:', error);
      return { products: [], success: false, error: error.message };
    }
  },

  async getTrendingCategories() {
    return {
      categories: [
        { id: 'apparel', name: 'T-Shirts', trend: 'rising' },
        { id: 'home-decor', name: 'Home Decor', trend: 'rising' },
        { id: 'prints', name: 'Prints', trend: 'stable' },
      ],
    };
  },
};
