import { getTrendingListings, getShopListings } from './etsy.js';
import { generateDesign, generateVariations } from './claude.js';

/**
 * Shared API router used by both the Netlify Function (production) and the
 * local dev server. Everything here runs server-side: API keys never reach
 * the browser and there is no cross-origin request from the frontend.
 *
 * @param {{ method: string, path: string, query: URLSearchParams, body: any, env: Record<string, string|undefined> }} request
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function handleApiRequest({ method, path, query, body, env }) {
  const route = `${method.toUpperCase()} ${path.replace(/\/+$/, '') || '/'}`;

  switch (route) {
    case 'GET /health':
      return {
        status: 200,
        body: {
          ok: true,
          etsyConfigured: Boolean(env.ETSY_API_KEY),
          claudeConfigured: Boolean(env.ANTHROPIC_API_KEY),
        },
      };

    case 'GET /etsy-trends':
      return getTrendingListings({
        category: query.get('category') || 'tshirts',
        limit: query.get('limit') || 12,
        apiKey: env.ETSY_API_KEY,
      });

    case 'GET /etsy-shop-listings':
      if (!query.get('shopId')) {
        return { status: 400, body: { error: 'shopId is required' } };
      }
      return getShopListings({ shopId: query.get('shopId'), apiKey: env.ETSY_API_KEY });

    case 'POST /generate-design':
      return generateDesign({
        trendName: body?.trendName,
        category: body?.category,
        style: body?.style,
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.CLAUDE_MODEL,
      });

    case 'POST /generate-variations':
      return generateVariations({
        trendName: body?.trendName,
        count: body?.count,
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.CLAUDE_MODEL,
      });

    // Amazon has no public product API. Until a data provider is wired up the
    // endpoint answers successfully with no products so the UI falls back to
    // its demo trends instead of surfacing an error.
    case 'GET /best-sellers':
    case 'GET /search':
      return {
        status: 200,
        body: { products: [], success: false, message: 'Amazon data source not configured' },
      };

    default:
      return { status: 404, body: { error: `Unknown endpoint: ${route}` } };
  }
}
