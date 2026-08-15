/**
 * Image generation outlives the request that starts it.
 *
 * OpenAI takes 10-30s to draw an image; Netlify kills a synchronous function
 * at 10s, which is the 504 the UI was showing. So the request only *starts*
 * the work and returns a job id, a background function does the drawing, and
 * the client polls for the result.
 *
 * Storage is Netlify Blobs in production. Locally there are no Blobs and no
 * timeout either, so the dev server runs the generation inline and writes the
 * finished job into an in-process map — same job API, no extra infrastructure.
 */

import { generateImage } from './openai.js';

const MEMORY_STORE = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function newJobId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Netlify Blobs is only importable inside the Netlify runtime. */
async function getBlobStore() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore({ name: 'image-jobs', consistency: 'strong' });
  } catch {
    return null;
  }
}

export async function putJob(id, job) {
  const store = await getBlobStore();
  if (store) {
    await store.setJSON(id, job);
    return;
  }
  MEMORY_STORE.set(id, job);
  // Data URLs are large; without this a long-running dev server grows forever.
  for (const [key, value] of MEMORY_STORE) {
    if (Date.now() - value.createdAt > JOB_TTL_MS) MEMORY_STORE.delete(key);
  }
}

export async function getJob(id) {
  const store = await getBlobStore();
  if (store) {
    return (await store.get(id, { type: 'json' })) || null;
  }
  return MEMORY_STORE.get(id) || null;
}

export function createPendingJob(prompt) {
  return {
    id: newJobId(),
    job: { status: 'pending', prompt, createdAt: Date.now() },
  };
}

export { newJobId };

/**
 * Generates the image and records the outcome against the job. Never throws:
 * a crash here would leave the job pending forever and the client polling
 * until it gave up, with no reason shown.
 */
export async function runImageJob({ id, options }) {
  try {
    const result = await generateImage(options);

    if (result.body?.success && result.body.imageUrl) {
      await putJob(id, {
        status: 'done',
        imageUrl: result.body.imageUrl,
        createdAt: Date.now(),
      });
    } else {
      await putJob(id, {
        status: 'error',
        error: result.body?.error || 'Image generation failed',
        createdAt: Date.now(),
      });
    }
  } catch (error) {
    await putJob(id, { status: 'error', error: error.message, createdAt: Date.now() });
  }
}
