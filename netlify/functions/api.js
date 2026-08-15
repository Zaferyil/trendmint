import { handleApiRequest } from '../../server/lib/router.js';

/**
 * Single Netlify Function behind the /api/* redirect in netlify.toml.
 * Keeps every third-party call (Etsy, Claude) on the server side.
 */
export default async (request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/, '') || '/';

  let body = null;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const result = await handleApiRequest({
    method: request.method,
    path,
    query: url.searchParams,
    body,
    env: process.env,
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { 'cache-control': 'no-store' },
  });
};
