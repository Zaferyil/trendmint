import { runImageJob } from '../../server/lib/imageJobs.js';

/**
 * The -background suffix is what gives this function a 15-minute budget instead
 * of the 10 seconds a synchronous function gets. Netlify answers the caller
 * with 202 straight away and keeps running this; nothing it returns reaches the
 * client, so the result is written to the job store and polled for.
 */
export default async (request) => {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { id, options } = payload || {};
  if (!id || !options) {
    return new Response('id and options are required', { status: 400 });
  }

  // The API key is read here rather than trusted from the request body, so an
  // outside caller hitting this endpoint cannot supply their own.
  await runImageJob({
    id,
    options: {
      ...options,
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
    },
  });

  return new Response('ok');
};
