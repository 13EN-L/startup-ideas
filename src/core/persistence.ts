// Issue #20: state persistence, launch restoration and recent task clouds.
import { notImplemented } from '../shared/notImplemented';
import type {
  AppState,
  BreakdownPercentages,
  CompletedTask,
  Route,
  TaskMetrics,
} from '../shared/types';

/** Where the serialized AppState lives (a JSON file in Electron's userData). */
export interface StateStore {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

export function createInitialState(): AppState {
  return notImplemented('createInitialState');
}

export function serializeState(state: AppState): string {
  return notImplemented(`serializeState(${state.version})`);
}

/** Returns the initial state for missing, corrupt or unknown-version data. */
export function deserializeState(raw: string | null): AppState {
  return notImplemented(`deserializeState(${raw?.length ?? 'null'})`);
}

/** Active tasks always force the Task page; otherwise reopen the saved page. */
export function resolveLaunchRoute(state: AppState): Route {
  return notImplemented(`resolveLaunchRoute(${state.route})`);
}

export async function loadState(store: StateStore): Promise<AppState> {
  return notImplemented(`loadState(${typeof store})`);
}

export async function saveState(store: StateStore, state: AppState): Promise<void> {
  return notImplemented(`saveState(${typeof store}, ${state.version})`);
}

/** The newest completed tasks first, at most RECENT_TASK_COUNT. */
export function recentTasks(completed: CompletedTask[]): CompletedTask[] {
  return notImplemented(`recentTasks(${completed.length})`);
}

/** Whole-number percentages that sum to 100, or all zero for an empty task. */
export function breakdown(metrics: TaskMetrics): BreakdownPercentages {
  return notImplemented(`breakdown(${metrics.productiveSeconds})`);
}
