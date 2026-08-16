/**
 * The scheduled pipeline: Etsy trends → Claude design concepts → archive.
 *
 * Runs with no user session and no browser waiting on it, so nothing here can
 * report a problem by returning an error to a caller — every outcome, including
 * the failures, is written to the run log instead.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getTrendingListings } from './etsy.js';
import { generateDesign } from './claude.js';
import { generateImage } from './openai.js';
import { buildDesignRecord, pruneDesigns, saveDesign, saveDesignImage } from './designStore.js';
import { finishRun, getSettings, getState, isDue, recordRun, startRun } from './automationStore.js';

function secret(env, name, legacyName) {
  const value = env[name] || env[legacyName];
  return value ? value.trim() : undefined;
}

/**
 * A background function is reachable at its own public URL, so the hop from
 * the scheduled function has to prove where it came from. Derived from
 * SESSION_SECRET rather than adding another variable to configure, and
 * separated by purpose so it is not interchangeable with a session signature.
 */
export function deriveAutomationKey(env) {
  const base = env.SESSION_SECRET || env.AUTH_SECRET;
  if (!base) return null;
  return createHmac('sha256', base).update('trendmint:automation').digest('hex');
}

export function isValidAutomationKey(env, provided) {
  const expected = deriveAutomationKey(env);
  if (!expected || !provided) return false;

  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Checked by the scheduled function before it wakes anything else up, so a
 * heartbeat that is not due costs one storage read and no API calls at all.
 */
export async function checkDue() {
  const [settings, state] = await Promise.all([getSettings(), getState()]);
  return { settings, state, ...isDue(settings, state) };
}

export async function runAutomation({ env, trigger = 'schedule', triggeredBy = null }) {
  const settings = await getSettings();
  const startedAt = await startRun();

  const errors = [];
  let designsCreated = 0;
  let imagesCreated = 0;
  let trendsFound = 0;

  try {
    const trendResult = await getTrendingListings({
      category: settings.category,
      // Asked for a few more than needed: some listings fail design generation,
      // and a short list would leave the run under quota for no good reason.
      limit: Math.min(24, settings.designsPerRun * 3),
      maxAgeDays: settings.maxAgeDays,
      apiKey: secret(env, 'ETSY_API_KEY', 'VITE_ETSY_API_KEY'),
      sharedSecret: secret(env, 'ETSY_SHARED_SECRET', 'VITE_ETSY_SHARED_SECRET'),
    });

    const listings = trendResult.body?.listings || [];
    trendsFound = listings.length;

    if (!trendResult.body?.success) {
      errors.push(`Etsy: ${trendResult.body?.error || 'trend lookup failed'}`);
    }

    const claudeKey = secret(env, 'ANTHROPIC_API_KEY', 'VITE_CLAUDE_API_KEY');
    const openaiKey = secret(env, 'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY');

    for (const trend of listings.slice(0, settings.designsPerRun)) {
      try {
        const result = await generateDesign({
          trendName: trend.name,
          category: trend.garment || 't-shirt',
          style: 'modern',
          apiKey: claudeKey,
          model: env.CLAUDE_MODEL,
        });

        if (!result.body?.success) {
          errors.push(`${trend.name}: ${result.body?.error || 'design generation failed'}`);
          continue;
        }

        const record = buildDesignRecord({
          design: result.body.design,
          trend,
          source: trigger === 'manual' ? 'manual-run' : 'automation',
          runId: startedAt,
          createdBy: triggeredBy,
        });
        await saveDesign(record);
        designsCreated += 1;

        // Off by default: this is the expensive call, and a concept saved
        // without artwork can still be drawn later from the archive.
        if (settings.generateImages && result.body.design?.imagePrompt) {
          const image = await generateImage({
            prompt: result.body.design.imagePrompt,
            apiKey: openaiKey,
            model: env.OPENAI_IMAGE_MODEL,
            quality: env.OPENAI_IMAGE_QUALITY,
          });

          if (image.body?.success && image.body.imageUrl) {
            await saveDesignImage(record.id, image.body.imageUrl);
            imagesCreated += 1;
          } else {
            errors.push(`${trend.name}: image — ${image.body?.error || 'failed'}`);
          }
        }
      } catch (error) {
        // One bad trend must not cost the run the designs it already made.
        errors.push(`${trend.name}: ${error.message}`);
      }
    }

    await pruneDesigns({ retentionDays: settings.retentionDays });
  } catch (error) {
    errors.push(error.message);
  } finally {
    await finishRun();
  }

  const run = {
    startedAt,
    finishedAt: new Date().toISOString(),
    trigger,
    triggeredBy,
    status: designsCreated > 0 ? (errors.length ? 'partial' : 'ok') : 'failed',
    trendsFound,
    designsCreated,
    imagesCreated,
    // Capped: a run that fails on every trend should not write an unbounded
    // error list into the log.
    errors: errors.slice(0, 10),
  };

  await recordRun(run);
  return run;
}
