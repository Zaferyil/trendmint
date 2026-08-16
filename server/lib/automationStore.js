/**
 * Automation settings, the run lock, and the run history.
 *
 * The Netlify cron is fixed at deploy time and cannot be rewritten from the
 * running app, so the schedule lives here instead: the cron is a plain hourly
 * heartbeat and these settings decide whether a given heartbeat does any work.
 */

import { randomUUID } from 'node:crypto';
import { readAllEntries, readJSON, removeKey, writeJSON } from './blobStore.js';

const STORE = 'automation';
const SETTINGS_KEY = 'settings';
const STATE_KEY = 'state';
const RUNS_STORE = 'automation-runs';

export const MAX_RUNS_PER_DAY = 24;
export const MAX_DESIGNS_PER_RUN = 5;
export const RUN_HISTORY_LIMIT = 50;

// A heartbeat that fires a few seconds early should not push the run into the
// next hour, which at 24 runs/day would halve the rate the user asked for.
const DUE_TOLERANCE_MS = 5 * 60 * 1000;

// Nothing runs for longer than the background function is allowed to live, so
// a lock older than this belongs to an invocation that died.
const LOCK_STALE_MS = 15 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  // Off until switched on deliberately: every run spends real money on the
  // Claude and OpenAI accounts, and a default-on schedule would start doing
  // that the moment this deploys.
  enabled: false,
  runsPerDay: 2,
  designsPerRun: 3,
  // Image generation is the expensive half, so it is opt-in on its own.
  generateImages: false,
  category: 'apparel',
  maxAgeDays: 7,
  retentionDays: 30,
};

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/** Bounds every field, so a hand-written API call cannot ask for 500 designs. */
export function normalizeSettings(input = {}) {
  return {
    enabled: Boolean(input.enabled),
    runsPerDay: clampInt(input.runsPerDay, 1, MAX_RUNS_PER_DAY, DEFAULT_SETTINGS.runsPerDay),
    designsPerRun: clampInt(input.designsPerRun, 1, MAX_DESIGNS_PER_RUN, DEFAULT_SETTINGS.designsPerRun),
    generateImages: Boolean(input.generateImages),
    category: typeof input.category === 'string' && input.category.trim() ? input.category.trim() : 'apparel',
    maxAgeDays: clampInt(input.maxAgeDays, 1, 365, DEFAULT_SETTINGS.maxAgeDays),
    retentionDays: clampInt(input.retentionDays, 1, 365, DEFAULT_SETTINGS.retentionDays),
  };
}

export async function getSettings() {
  const stored = await readJSON(STORE, SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...normalizeSettings(stored || DEFAULT_SETTINGS) };
}

export async function saveSettings(input, updatedBy) {
  const settings = normalizeSettings(input);
  return writeJSON(STORE, SETTINGS_KEY, {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || null,
  });
}

export async function getState() {
  return (await readJSON(STORE, STATE_KEY)) || { lastRunAt: null, running: false, startedAt: null };
}

export async function saveState(state) {
  return writeJSON(STORE, STATE_KEY, state);
}

export function intervalMs(runsPerDay) {
  return Math.floor((24 * 60 * 60 * 1000) / Math.max(1, runsPerDay));
}

/**
 * Interval since the last run rather than fixed clock times: the cron runs in
 * UTC, and "three times a day" carries no timezone to get wrong this way.
 */
export function isDue(settings, state, now = Date.now()) {
  if (!settings.enabled) return { due: false, reason: 'automation is off' };

  if (state.running && state.startedAt && now - new Date(state.startedAt).getTime() < LOCK_STALE_MS) {
    return { due: false, reason: 'a run is already in progress' };
  }

  if (!state.lastRunAt) return { due: true, reason: 'first run' };

  const elapsed = now - new Date(state.lastRunAt).getTime();
  const target = intervalMs(settings.runsPerDay);
  if (elapsed + DUE_TOLERANCE_MS < target) {
    const minutes = Math.ceil((target - elapsed) / 60000);
    return { due: false, reason: `next run in ~${minutes} minute(s)` };
  }

  return { due: true, reason: 'interval elapsed' };
}

export function nextRunAt(settings, state) {
  if (!settings.enabled) return null;
  if (!state.lastRunAt) return new Date().toISOString();
  return new Date(new Date(state.lastRunAt).getTime() + intervalMs(settings.runsPerDay)).toISOString();
}

export async function startRun() {
  const startedAt = new Date().toISOString();
  await saveState({
    // Stamped at the start, not the finish: a run that crashes half way must
    // not become a run that retries every single heartbeat.
    lastRunAt: startedAt,
    running: true,
    startedAt,
  });
  return startedAt;
}

export async function finishRun() {
  const state = await getState();
  await saveState({ ...state, running: false, startedAt: null });
}

export async function recordRun(run) {
  const record = { id: randomUUID(), ...run };
  await writeJSON(RUNS_STORE, `run_${Date.now()}_${record.id}`, record);

  // Keeps the log readable and the store small; the archive itself is the
  // durable record, this is just the operating history.
  const entries = await sortedRunEntries();
  for (const stale of entries.slice(RUN_HISTORY_LIMIT)) {
    await removeKey(RUNS_STORE, stale.key);
  }
  return record;
}

async function sortedRunEntries() {
  const entries = await readAllEntries(RUNS_STORE);
  return entries.sort((a, b) => String(b.value.startedAt).localeCompare(String(a.value.startedAt)));
}

export async function listRuns() {
  return (await sortedRunEntries()).map((entry) => entry.value);
}
