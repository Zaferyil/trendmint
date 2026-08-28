import { getTrendingListings, getShopListings, debugTrendingListings, getBestsellerListings, getPopularListings } from './etsy.js';
import { generateDesign, generateVariations } from './claude.js';
import { createPendingJob, getJob, putJob } from './imageJobs.js';
import { handleAuthRoute, resolveSession } from './authRoutes.js';
import { handleAutomationRoute } from './automationRoutes.js';

/**
 * Reachable without a session. Everything else needs one — the login screen is
 * only a real gate if the API behind it is closed too, otherwise anyone who
 * knows the endpoint can still spend the Claude and OpenAI budget.
 */
const PUBLIC_ROUTES = new Set([
  'GET /health',
  'GET /auth/me',
  'POST /auth/login',
  'POST /auth/logout',
]);

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
 * @param {{ method: string, path: string, query: URLSearchParams, body: any, headers: Record<string, string|undefined>, isSecure: boolean, env: Record<string, string|undefined> }} request
 * @returns {Promise<{ status: number, body: any, headers?: Record<string, string> }>}
 */
export async function handleApiRequest({
  method,
  path,
  query,
  body,
  env,
  headers = {},
  isSecure = true,
  startImageJob,
  startAutomationRun,
}) {
  const route = `${method.toUpperCase()} ${path.replace(/\/+$/, '') || '/'}`;
  const etsyKey = secret(env, 'ETSY_API_KEY', 'VITE_ETSY_API_KEY');
  const etsySecret = secret(env, 'ETSY_SHARED_SECRET', 'VITE_ETSY_SHARED_SECRET');
  const claudeKey = secret(env, 'ANTHROPIC_API_KEY', 'VITE_CLAUDE_API_KEY');
  const openaiKey = secret(env, 'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY');

  const currentUser = await resolveSession({ headers, env });

  if (!currentUser && !PUBLIC_ROUTES.has(route)) {
    return { status: 401, body: { error: 'Not signed in' } };
  }

  const authResponse = await handleAuthRoute({ route, body, env, isSecure, currentUser });
  if (authResponse) return authResponse;

  // Below this point the session guard above has already run, so these
  // handlers can assume a signed-in user.
  const automationResponse = await handleAutomationRoute({
    route,
    query,
    body,
    currentUser,
    startAutomationRun,
  });
  if (automationResponse) return automationResponse;

  switch (route) {
    case 'GET /health': {
      // Unauthenticated callers get liveness only. Which keys a deploy carries
      // is deployment detail, and it is the signed-in operator who needs it.
      if (!currentUser) return { status: 200, body: { ok: true } };

      return {
        status: 200,
        body: {
          ok: true,
          etsyConfigured: Boolean(etsyKey),
          etsySharedSecretConfigured: Boolean(etsySecret),
          claudeConfigured: Boolean(claudeKey),
          openaiConfigured: Boolean(openaiKey),
          authConfigured: Boolean(env.SESSION_SECRET || env.AUTH_SECRET),
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
    }

    case 'GET /etsy-trends':
      return getTrendingListings({
        // All wearable textiles in one pass by default.
        category: query.get('category') || 'apparel',
        limit: query.get('limit') || 12,
        // Absent means the module default; 0 means the caller asked for no
        // ceiling, so it must survive the ?? rather than being replaced.
        maxAgeDays: query.get('maxAgeDays') ?? undefined,
        apiKey: etsyKey,
        sharedSecret: etsySecret,
      });

    // Reports the fields Etsy actually returns, so the trend thresholds can be
    // calibrated against real responses.
    case 'GET /etsy-debug':
      return debugTrendingListings({
        category: query.get('category') || 'apparel',
        apiKey: etsyKey,
        sharedSecret: etsySecret,
      });

    case 'GET /etsy-shop-listings':
      if (!query.get('shopId')) {
        return { status: 400, body: { error: 'shopId is required' } };
      }
      return getShopListings({ shopId: query.get('shopId'), apiKey: etsyKey, sharedSecret: etsySecret });

    case 'GET /etsy-bestsellers':
      return getBestsellerListings({
        category: query.get('category') || 'apparel',
        limit: query.get('limit') || 12,
        maxAgeDays: query.get('maxAgeDays') ?? undefined,
        keyword: query.get('keyword') || undefined,
        apiKey: etsyKey,
        sharedSecret: etsySecret,
      });

    case 'GET /etsy-popular':
      return getPopularListings({
        category: query.get('category') || 'apparel',
        limit: query.get('limit') || 12,
        maxAgeDays: query.get('maxAgeDays') ?? undefined,
        keyword: query.get('keyword') || undefined,
        apiKey: etsyKey,
        sharedSecret: etsySecret,
      });

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

    // Starts the work and returns immediately. Drawing an image takes longer
    // than Netlify allows a synchronous function to run, so the request that
    // starts it cannot also wait for it — that was the 504.
    case 'POST /generate-image': {
      if (!body?.prompt) {
        return { status: 400, body: { success: false, error: 'prompt is required' } };
      }
      if (!openaiKey) {
        return { status: 501, body: { success: false, error: 'OPENAI_API_KEY not configured on the server' } };
      }

      const { id, job } = createPendingJob(body.prompt);
      await putJob(id, job);

      const options = {
        prompt: body.prompt,
        apiKey: openaiKey,
        model: env.OPENAI_IMAGE_MODEL,
        size: body?.size,
        quality: body?.quality || env.OPENAI_IMAGE_QUALITY,
      };

      // In Netlify, startImageJob hands off to a background function. Locally
      // there is no timeout, so the dev server passes a runner that generates
      // inline before answering.
      if (typeof startImageJob === 'function') {
        await startImageJob({ id, options });
      }

      return { status: 202, body: { success: true, jobId: id, status: 'pending' } };
    }

    case 'GET /image-job': {
      const id = query.get('id');
      if (!id) return { status: 400, body: { success: false, error: 'id is required' } };

      const job = await getJob(id);
      if (!job) {
        // Also covers a job whose blob expired, which the client should treat
        // as a failure rather than polling forever.
        return { status: 404, body: { success: false, status: 'unknown', error: 'Job not found or expired' } };
      }

      if (job.status === 'done') {
        return { status: 200, body: { success: true, status: 'done', imageUrl: job.imageUrl } };
      }
      if (job.status === 'error') {
        return { status: 200, body: { success: false, status: 'error', error: job.error } };
      }
      return { status: 200, body: { success: true, status: 'pending' } };
    }

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
