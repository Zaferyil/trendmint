import { getTrendingListings, getShopListings } from './etsy.js';
import { generateDesign, generateVariations } from './claude.js';
import { generateImage } from './openai.js';

/**
 * Reads a server-side secret, falling back to the legacy VITE_-prefixed name so
 * existing deployments keep working. The VITE_ names are only safe now because
 * no frontend code reads them anymore — never reference them from `src/`, or
 * Vite will inline the secret into the public bundle again.
 */
function secret(env, name, legacyName) {
  // Trimmed: a stray newline pasted into a dashboard field makes the upstream
  // API reject an otherwise valid key.
  const value = env[name] || env[legacyName];
  return value ? value.trim() : undefined;
}

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
  const etsyKey = secret(env, 'ETSY_API_KEY', 'VITE_ETSY_API_KEY');
  const claudeKey = secret(env, 'ANTHROPIC_API_KEY', 'VITE_CLAUDE_API_KEY');
  const openaiKey = secret(env, 'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY');

  switch (route) {
    case 'GET /health':
      return {
        status: 200,
        body: {
          ok: true,
          etsyConfigured: Boolean(etsyKey),
          claudeConfigured: Boolean(claudeKey),
          openaiConfigured: Boolean(openaiKey),
          // Which variable name each key came from — handy when a deploy still
          // carries the legacy VITE_ names.
          etsySource: env.ETSY_API_KEY ? 'ETSY_API_KEY' : env.VITE_ETSY_API_KEY ? 'VITE_ETSY_API_KEY' : null,
          claudeSource: env.ANTHROPIC_API_KEY
            ? 'ANTHROPIC_API_KEY'
            : env.VITE_CLAUDE_API_KEY
              ? 'VITE_CLAUDE_API_KEY'
              : null,
        },
      };

    case 'GET /etsy-trends':
      return getTrendingListings({
        category: query.get('category') || 'tshirts',
        limit: query.get('limit') || 12,
        apiKey: etsyKey,
      });

    case 'GET /etsy-shop-listings':
      if (!query.get('shopId')) {
        return { status: 400, body: { error: 'shopId is required' } };
      }
      return getShopListings({ shopId: query.get('shopId'), apiKey: etsyKey });

    case 'POST /generate-design':
      return generateDesign({
        trendName: body?.trendName,
        category: body?.category,
        style: body?.style,
        apiKey: claudeKey,
        model: env.CLAUDE_MODEL,
      });

    case 'POST /generate-variations':
      return generateVariations({
        trendName: body?.trendName,
        count: body?.count,
        apiKey: claudeKey,
        model: env.CLAUDE_MODEL,
      });

    case 'POST /generate-image':
      return generateImage({
        prompt: body?.prompt,
        apiKey: openaiKey,
        model: env.OPENAI_IMAGE_MODEL,
        size: body?.size,
        quality: body?.quality || env.OPENAI_IMAGE_QUALITY,
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
