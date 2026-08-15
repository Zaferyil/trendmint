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
    // Kick off the long-running work and return. Awaiting the fetch only waits
    // for Netlify to accept the invocation (202), not for the image itself.
    startImageJob: async ({ id, options }) => {
      await fetch(`${url.origin}/.netlify/functions/generate-image-background`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The key is stripped: the background function reads it from the
        // environment, so it never travels over this hop.
        body: JSON.stringify({ id, options: { ...options, apiKey: undefined } }),
      }).catch((error) => {
        console.error('Failed to start image job:', error);
      });
    },
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { 'cache-control': 'no-store' },
  });
};
