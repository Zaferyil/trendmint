import { checkDue, deriveAutomationKey } from '../../server/lib/automationRunner.js';

/**
 * The heartbeat.
 *
 * A Netlify cron expression is fixed at deploy time, so it cannot carry a
 * setting the user changes from inside the app. This runs every hour instead
 * and asks the stored settings whether anything is due — "four times a day"
 * means four of these twenty-four wake-ups do work and the other twenty return
 * immediately, having spent one storage read and no API calls.
 *
 * The work itself is handed to a background function: this one is capped at 30
 * seconds, and generating designs takes longer than that.
 */
export default async (request) => {
  const { due, reason, settings } = await checkDue();

  if (!due) {
    console.log(`Automation heartbeat: skipping — ${reason}`);
    return;
  }

  const key = deriveAutomationKey(process.env);
  if (!key) {
    console.error('Automation heartbeat: SESSION_SECRET is not set, cannot authenticate the background call');
    return;
  }

  const origin = process.env.URL || new URL(request.url).origin;
  console.log(`Automation heartbeat: starting a run (${settings.designsPerRun} design(s), images ${settings.generateImages ? 'on' : 'off'})`);

  // Awaited only as far as Netlify accepting the invocation — the run itself
  // outlives this function.
  await fetch(`${origin}/.netlify/functions/auto-run-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-automation-key': key },
    body: JSON.stringify({ trigger: 'schedule' }),
  }).catch((error) => {
    console.error('Automation heartbeat: failed to start the run:', error);
  });
};

export const config = {
  // Hourly is the resolution of the whole feature: it is the finest schedule
  // the settings can express, and 24 runs/day is the ceiling they allow.
  schedule: '@hourly',
};
