import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/authContext';
import { automationService } from '../services/automationService';

// "no trends" is a finding, not a failure: the lookup worked and the market
// was quiet, so it reads neutral rather than red.
const RUN_STATUS_STYLE = {
  ok: 'text-green-600',
  partial: 'text-amber-600',
  'no-trends': 'text-gray-500',
  failed: 'text-red-600',
};

const RUN_STATUS_LABEL = {
  ok: 'ok',
  partial: 'partial',
  'no-trends': 'no trends',
  failed: 'failed',
};

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "4 a day" is the setting; this is what it actually means in hours. */
function describeCadence(runsPerDay) {
  const hours = 24 / runsPerDay;
  if (runsPerDay === 1) return 'once a day';
  if (hours >= 1) return `every ~${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;
  return 'every hour';
}

export default function AutomationSettings({ onRunFinished }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState(null);
  const [state, setState] = useState(null);
  const [nextRun, setNextRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  // { baseline, deadline } while a started run is being waited on.
  const [watch, setWatch] = useState(null);

  const load = useCallback(async () => {
    try {
      const [config, history] = await Promise.all([
        automationService.getSettings(),
        automationService.getRuns(),
      ]);
      setSettings(config.settings);
      setState(config.state);
      setNextRun(config.nextRunAt);
      setRuns(history.runs);
      setError(null);
      return history.runs;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * A run happens on a background worker with nothing reporting back, so the
   * panel watches for the finished entry itself. Without this the only way to
   * see the outcome is to keep pressing Refresh — and pressing it too early
   * shows a run that has not started, which reads like a failure.
   */
  useEffect(() => {
    if (!watch) return;

    const timer = setInterval(async () => {
      if (Date.now() > watch.deadline) {
        setWatch(null);
        setNotice('The run is taking longer than usual — press Refresh to check on it.');
        return;
      }

      const latest = await load();
      if (latest && latest.length > watch.baseline) {
        setWatch(null);
        setNotice(null);
        if (onRunFinished) onRunFinished();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [watch, load, onRunFinished]);

  const save = async (patch) => {
    const merged = { ...settings, ...patch };
    setSettings(merged);
    setIsSaving(true);
    setNotice(null);

    try {
      const result = await automationService.saveSettings(merged);
      setSettings(result.settings);
      setNextRun(result.nextRunAt);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Put the server's version back: leaving the toggle showing a change
      // that was rejected would misreport what the schedule actually is.
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const baseline = runs.length;
      await automationService.runNow();
      setNotice('Run started — this panel updates itself when it finishes.');
      setWatch({ baseline, deadline: Date.now() + 5 * 60 * 1000 });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">{error || '⏳ Loading automation settings...'}</p>
      </div>
    );
  }

  const disabled = !isAdmin || isSaving;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">🤖 Automation</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={disabled}
            onChange={(event) => save({ enabled: event.target.checked })}
            className="w-5 h-5 accent-green-500 disabled:opacity-50"
          />
          <span className={`text-sm font-semibold ${settings.enabled ? 'text-green-600' : 'text-gray-500'}`}>
            {settings.enabled ? 'On' : 'Off'}
          </span>
        </label>
      </div>

      <p className="text-sm text-gray-600">
        Analyses trends and generates design concepts on a schedule, with the app closed. Results are
        saved to the archive below.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">{notice}</div>
      )}
      {!isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
          Only an administrator can change these settings.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="runs-per-day" className="text-sm font-semibold text-gray-700 block mb-1">
            Runs per day: <span className="text-green-600">{settings.runsPerDay}</span>
          </label>
          <input
            id="runs-per-day"
            type="range"
            min={1}
            max={24}
            value={settings.runsPerDay}
            disabled={disabled}
            onChange={(event) => setSettings({ ...settings, runsPerDay: Number(event.target.value) })}
            onMouseUp={(event) => save({ runsPerDay: Number(event.target.value) })}
            onTouchEnd={(event) => save({ runsPerDay: Number(event.target.value) })}
            className="w-full accent-green-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">Runs {describeCadence(settings.runsPerDay)}.</p>
        </div>

        <div>
          <label htmlFor="designs-per-run" className="text-sm font-semibold text-gray-700 block mb-1">
            Designs per run: <span className="text-green-600">{settings.designsPerRun}</span>
          </label>
          <input
            id="designs-per-run"
            type="range"
            min={1}
            max={5}
            value={settings.designsPerRun}
            disabled={disabled}
            onChange={(event) => setSettings({ ...settings, designsPerRun: Number(event.target.value) })}
            onMouseUp={(event) => save({ designsPerRun: Number(event.target.value) })}
            onTouchEnd={(event) => save({ designsPerRun: Number(event.target.value) })}
            className="w-full accent-green-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            About {settings.runsPerDay * settings.designsPerRun} design(s) a day.
          </p>
        </div>

        <div>
          <label htmlFor="max-age" className="text-sm font-semibold text-gray-700 block mb-1">
            Trend window
          </label>
          <select
            id="max-age"
            value={settings.maxAgeDays}
            disabled={disabled}
            onChange={(event) => save({ maxAgeDays: Number(event.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
          </select>
        </div>

        <div>
          <label htmlFor="retention" className="text-sm font-semibold text-gray-700 block mb-1">
            Keep designs for
          </label>
          <select
            id="retention"
            value={settings.retentionDays}
            disabled={disabled}
            onChange={(event) => save({ retentionDays: Number(event.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
      </div>

      {/* Called out rather than sitting in the grid: this is the switch that
          decides whether an unattended run costs cents or dollars. */}
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.generateImages}
            disabled={disabled}
            onChange={(event) => save({ generateImages: event.target.checked })}
            className="w-5 h-5 mt-0.5 accent-amber-500 disabled:opacity-50"
          />
          <span>
            <span className="text-sm font-semibold text-amber-900">Also generate artwork automatically</span>
            <span className="block text-xs text-amber-800 mt-1">
              Off by default. Image generation is the expensive part — with this on, a run costs roughly ten
              times as much. Leaving it off still saves the concept and its image prompt, so you can generate
              artwork for the ones you like from the archive.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
        {isAdmin && (
          <button
            onClick={handleRunNow}
            disabled={isSaving || state?.running}
            className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {state?.running ? '⏳ Running...' : '▶️ Run now'}
          </button>
        )}
        <button
          onClick={load}
          className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          🔄 Refresh
        </button>
        <span className="text-xs text-gray-500">
          Last run: {formatWhen(state?.lastRunAt)}
          {settings.enabled && nextRun && ` • Next: ${formatWhen(nextRun)}`}
        </span>
      </div>

      {runs.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-gray-700">Run history ({runs.length})</summary>
          <div className="mt-3 space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-2 text-xs border-b border-gray-100 pb-2">
                <span className={`font-semibold ${RUN_STATUS_STYLE[run.status] || 'text-red-600'}`}>
                  {RUN_STATUS_LABEL[run.status] || run.status}
                </span>
                <span className="text-gray-500">{formatWhen(run.startedAt)}</span>
                <span className="text-gray-700">
                  {run.designsCreated} design(s), {run.imagesCreated} image(s), {run.trendsFound} trend(s)
                </span>
                <span className="text-gray-400">{run.trigger}</span>
                {/* Why the run came back empty — usually "widen the window". */}
                {run.note && <span className="text-gray-500 w-full">{run.note}</span>}
                {run.errors?.length > 0 && (
                  <span className="text-red-600 w-full">{run.errors.join(' · ')}</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
