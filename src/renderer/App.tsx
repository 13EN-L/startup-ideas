// Issue #20: loads persisted state, restores the launch route, routes between
// pages and saves after every change.
import { useCallback, useEffect, useRef, useState } from 'react';
import { markPlantsViewed } from '../core/growth';
import { createInitialState, recentTasks, resolveLaunchRoute } from '../core/persistence';
import { completeTask, startTask, stopTask, type StartTaskInput } from '../core/tasks';
import type { FocusGardenBridge, SetupStatus } from '../shared/bridge';
import type { AppState, Route } from '../shared/types';
import { isSetupComplete, SetupDialog } from './components/SetupDialog';
import { GardenPage } from './pages/GardenPage';
import { MainPage } from './pages/MainPage';
import { TaskPage } from './pages/TaskPage';

export interface AppProps {
  bridge: FocusGardenBridge;
  /** Injectable for tests; default Date.now / Math.random / crypto.randomUUID. */
  clock?: () => number;
  random?: () => number;
  createId?: () => string;
}

const defaultCreateId = () => crypto.randomUUID();

/** Current time, refreshed every second for elapsed-time displays. */
function useNow(clock: () => number): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const id = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(id);
  }, [clock]);
  return now;
}

export function App({ bridge, clock = Date.now, random = Math.random, createId = defaultCreateId }: AppProps) {
  const [state, setState] = useState<AppState | null>(null);
  const [resultTaskId, setResultTaskId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const now = useNow(clock);

  const refreshSetup = useCallback(async () => {
    const status = await bridge.getSetupStatus();
    setSetupStatus(status);
    return status;
  }, [bridge]);

  // Open setup on launch only if something is missing.
  useEffect(() => {
    let cancelled = false;
    void refreshSetup().then((status) => {
      if (!cancelled && !isSetupComplete(status)) setSetupOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSetup]);

  // Latest state for async handlers, and whether the next change came from loading.
  const stateRef = useRef(state);
  stateRef.current = state;
  const skipNextSave = useRef(true);
  // Bumped by "Reset all data" so analyses still running can't re-add their task.
  const resetCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void bridge.loadState().then((loaded) => {
      if (cancelled) return;
      skipNextSave.current = true;
      setState({ ...loaded, route: resolveLaunchRoute(loaded) });
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => {
    if (!state) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    bridge.saveState(state).catch((e: Error) => setError(`Could not save your progress: ${e.message}`));
  }, [bridge, state]);

  const navigate = useCallback((route: Route, taskId?: string) => {
    const current = stateRef.current;
    if (!current) return;
    const next = { ...current, route };
    stateRef.current = next;
    setResultTaskId(taskId);
    setState(next);
  }, []);

  const handleStart = useCallback(
    (input: StartTaskInput) => {
      const current = stateRef.current;
      if (!current) return;
      try {
        const next = startTask(current, input, { now: clock(), random, createId });
        stateRef.current = next;
        setState(next);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [clock, random, createId],
  );

  const handleStop = useCallback(
    async (taskId: string, endedAt: number) => {
      const current = stateRef.current;
      if (!current || !current.activeTasks.some((t) => t.id === taskId)) return;

      const { state: next, stopped } = stopTask(current, taskId);
      stateRef.current = next;
      setState(next);
      const resetsBefore = resetCount.current;

      try {
        const completed = await bridge.finishTask(stopped, endedAt);
        const latest = stateRef.current;
        if (!latest || resetCount.current !== resetsBefore) return;
        const withResult = completeTask(latest, completed);
        stateRef.current = withResult;
        setState(withResult);
      } catch (e) {
        setError(`Could not analyze "${stopped.name}": ${(e as Error).message}`);
      }
    },
    [bridge],
  );

  // The garden replays unseen growth once; afterwards it opens as it was left.
  const handlePlantsViewed = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const plants = markPlantsViewed(current.plants);
    if (plants === current.plants) return;
    const next = { ...current, plants };
    stateRef.current = next;
    setState(next);
  }, []);

  // Settings is only reachable from the Main page, where no task is active.
  const handleReset = useCallback(async () => {
    const next = createInitialState();
    resetCount.current++;
    skipNextSave.current = true;
    stateRef.current = next;
    setResultTaskId(undefined);
    setState(next);
    await bridge.saveState(next);
  }, [bridge]);

  if (!state) {
    return <div className="loading">Loading your garden…</div>;
  }

  const recent = recentTasks(state.completedTasks);

  return (
    <>
      {state.route === 'main' && (
        <MainPage
          recentTasks={recent}
          plants={state.plants}
          onOpenTasks={() => navigate('task')}
          onOpenTaskResult={(id) => navigate('task', id)}
          onOpenGarden={() => navigate('garden')}
          onOpenSettings={() => {
            setSetupOpen(true);
            void refreshSetup();
          }}
        />
      )}
      {state.route === 'task' && (
        <TaskPage
          activeTasks={state.activeTasks}
          recentTasks={recent}
          now={now}
          initialResultTaskId={resultTaskId}
          onStartTask={handleStart}
          onStopTask={handleStop}
          onNavigateHome={() => navigate('main')}
        />
      )}
      {state.route === 'garden' && (
        <GardenPage
          plants={state.plants}
          completedTasks={state.completedTasks}
          loadPlantAbout={bridge.getPlantAbout}
          onNavigateHome={() => navigate('main')}
          onPlantsViewed={handlePlantsViewed}
        />
      )}

      {setupOpen && (
        <SetupDialog
          status={setupStatus}
          onRecheck={async () => {
            await refreshSetup();
          }}
          onSaveApiKey={async (key) => {
            const result = await bridge.saveApiKey(key);
            if (result.ok) await refreshSetup();
            return result;
          }}
          onClearApiKey={async () => {
            await bridge.clearApiKey();
            await refreshSetup();
          }}
          onOpenLink={(link) => void bridge.openExternal(link)}
          onSetActivityWatchAutostart={async (enabled) => {
            await bridge.setActivityWatchAutostart(enabled);
            await refreshSetup();
          }}
          onResetData={handleReset}
          onClose={() => setSetupOpen(false)}
        />
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
