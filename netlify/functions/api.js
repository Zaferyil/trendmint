import { handleApiRequest } from '../../server/lib/router.js';
import { deriveAutomationKey } from '../../server/lib/automationRunner.js';

/**
 * Single Netlify Function behind the /api/* redirect in netlify.toml.
 * Keeps every third-party call (Etsy, Claude) on the server side.
 */
export default async (request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/, '') || '/';

  let body = null;
  if (request.method === 'POST') {
    // Read as text first: a POST with no body at all is legitimate here —
    // /auth/logout and /automation/run-now carry no arguments — and calling
    // request.json() on an empty body throws, which used to answer those two
    // endpoints with 400. The dev server already tolerated this, so the two
    // runtimes disagreed and only production was broken.
    const raw = await request.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }
  }

  const result = await handleApiRequest({
    method: request.method,
    path,
    query: url.searchParams,
    body,
    // The session cookie rides in here; without the headers the router cannot
    // tell an authenticated request from an anonymous one.
    headers: Object.fromEntries(request.headers),
    isSecure: url.protocol === 'https:',
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
    // Same hand-off as the scheduled heartbeat uses: an admin pressing "Run
    // now" gets the same 15-minute budget a scheduled run gets.
    startAutomationRun: async ({ trigger, triggeredBy }) => {
      await fetch(`${url.origin}/.netlify/functions/auto-run-background`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-automation-key': deriveAutomationKey(process.env) || '',
        },
        body: JSON.stringify({ trigger, triggeredBy }),
      }).catch((error) => {
        console.error('Failed to start automation run:', error);
      });
    },
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { 'cache-control': 'no-store', ...(result.headers || {}) },
  });
};
