const AMAZON_BACKEND_BASE = import.meta.env.VITE_AMAZON_API_BASE || 'http://localhost:3001/api';

export const amazonService = {
  async getBestSellersByCategory(category = 'apparel', limit = 12) {
    try {
      const response = await fetch(
        `${AMAZON_BACKEND_BASE}/best-sellers?category=${encodeURIComponent(category)}&limit=${limit}`
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Amazon API error: ${response.statusText}`);
      }

      if (response.ok) {
        const data = await response.json();
        return {
          products: data.products || [],
          success: true,
        };
      }

      return {
        products: [],
        success: false,
        message: 'Backend proxy not configured',
      };
    } catch (error) {
      console.error('Error fetching Amazon best sellers:', error);
      return {
        products: [],
        success: false,
        error: error.message,
      };
    }
  },

  async searchProducts(keyword, limit = 12) {
    try {
      const response = await fetch(
        `${AMAZON_BACKEND_BASE}/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Amazon API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        products: data.products || [],
        success: true,
      };
    } catch (error) {
      console.error('Error searching products:', error);
      return {
        products: [],
        success: false,
        error: error.message,
      };
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
