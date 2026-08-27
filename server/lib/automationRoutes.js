/**
 * Automation settings, the run log, and the saved-design archive.
 *
 * Split out of router.js the same way authRoutes.js is; router.js calls this
 * after the session guard, so every handler here already has a signed-in user.
 */

import {
  MAX_DESIGNS_PER_RUN,
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
  getSettings,
  getState,
  listRuns,
  nextRunAt,
  saveSettings,
} from './automationStore.js';
import { deleteDesign, getDesign, getDesignImage, listDesigns } from './designStore.js';
import { checkDue } from './automationRunner.js';

function forbidden() {
  return { status: 403, body: { error: 'Admin access required' } };
}

/**
 * @returns {Promise<{status:number, body:any}|null>} null when the route is not
 *   ours, so router.js can carry on to the trend and design endpoints.
 */
export async function handleAutomationRoute({ route, query, body, currentUser, startAutomationRun }) {
  switch (route) {
    case 'GET /automation/settings': {
      const [settings, state] = await Promise.all([getSettings(), getState()]);
      return {
        status: 200,
        body: {
          settings,
          state,
          nextRunAt: nextRunAt(settings, state),
          limits: {
            minIntervalHours: MIN_INTERVAL_HOURS,
            maxIntervalHours: MAX_INTERVAL_HOURS,
            maxDesignsPerRun: MAX_DESIGNS_PER_RUN,
          },
        },
      };
    }

    case 'POST /automation/settings': {
      // Read by everyone, changed by an admin: these settings decide how much
      // the site spends on Claude and OpenAI without anyone watching.
      if (currentUser.role !== 'admin') return forbidden();

      const settings = await saveSettings(body || {}, currentUser.email);
      const state = await getState();
      return { status: 200, body: { settings, state, nextRunAt: nextRunAt(settings, state) } };
    }

    case 'POST /automation/run-now': {
      if (currentUser.role !== 'admin') return forbidden();

      const { state } = await checkDue();
      if (state.running) {
        return { status: 409, body: { error: 'A run is already in progress' } };
      }
      if (typeof startAutomationRun !== 'function') {
        return { status: 501, body: { error: 'Manual runs are not available in this runtime' } };
      }

      await startAutomationRun({ trigger: 'manual', triggeredBy: currentUser.email });
      // Accepted rather than done: the run outlives this request, and the UI
      // picks the result up from the run log.
      return { status: 202, body: { ok: true, status: 'started' } };
    }

    case 'GET /automation/runs':
      return { status: 200, body: { runs: (await listRuns()).slice(0, 20) } };

    case 'GET /designs':
      return { status: 200, body: { designs: await listDesigns() } };

    case 'GET /design': {
      const record = await getDesign(query.get('id'));
      if (!record) return { status: 404, body: { error: 'Design not found' } };
      return { status: 200, body: { design: record } };
    }

    // Served separately from the record so listing the archive does not drag
    // every stored image along with it.
    case 'GET /design-image': {
      const imageUrl = await getDesignImage(query.get('id'));
      if (!imageUrl) return { status: 404, body: { error: 'No image for this design' } };
      return { status: 200, body: { success: true, imageUrl } };
    }

    case 'POST /designs/delete': {
      if (currentUser.role !== 'admin') return forbidden();

      const record = await getDesign(body?.id);
      if (!record) return { status: 404, body: { error: 'Design not found' } };

      await deleteDesign(record.id);
      return { status: 200, body: { ok: true } };
    }

    default:
      return null;
  }
}
