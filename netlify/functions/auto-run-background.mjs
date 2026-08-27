import { isValidAutomationKey, runAutomation } from '../../server/lib/automationRunner.js';

/**
 * Where a scheduled run actually happens. The -background suffix buys the
 * 15-minute budget that trend lookup plus several Claude calls (and optionally
 * several images) needs, well past the 30 seconds a scheduled function gets.
 *
 * Netlify exposes this at a public URL, so the shared key is what stops an
 * outside caller from triggering runs and spending the API budget.
 */
export default async (request) => {
  if (!isValidAutomationKey(process.env, request.headers.get('x-automation-key'))) {
    return new Response('Forbidden', { status: 403 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const run = await runAutomation({
    env: process.env,
    trigger: payload.trigger === 'manual' ? 'manual' : 'schedule',
    triggeredBy: payload.triggeredBy || null,
  });

  console.log(
    `Automation run ${run.status}: ${run.designsCreated} design(s), ${run.imagesCreated} image(s)` +
      (run.errors.length ? ` — ${run.errors.length} error(s)` : '')
  );

  return new Response('ok');
};
