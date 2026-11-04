// Issue #20: state persistence, launch restoration and recent task clouds.
import { z } from 'zod';
import { ANIMALS, CATEGORIES, MAX_ACTIVE_TASKS, RECENT_TASK_COUNT } from '../shared/constants';
import type {
  AppState,
  BreakdownPercentages,
  CategoryId,
  CompletedTask,
  Route,
  TaskMetrics,
} from '../shared/types';
import { ACTIVITY_SOURCES } from '../shared/types';

/** Where the serialized AppState lives (a JSON file in Electron's userData). */
export interface StateStore {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

const categoryIds = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
const seconds = z.number().finite().nonnegative();

const ActiveTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(categoryIds),
  animal: z.enum(ANIMALS),
  slot: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  startedAt: z.number().finite(),
});

const CompletedTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(categoryIds),
  startedAt: z.number().finite(),
  endedAt: z.number().finite(),
  metrics: z.object({
    productiveSeconds: seconds,
    unproductiveSeconds: seconds,
    idleSeconds: seconds,
  }),
  activities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.enum(ACTIVITY_SOURCES),
      seconds,
      status: z.enum(['on-task', 'off-task']),
    }),
  ),
});

const AppStateSchema = z.object({
  version: z.literal(1),
  route: z.enum(['main', 'task', 'garden']),
  activeTasks: z.array(ActiveTaskSchema),
  completedTasks: z.array(CompletedTaskSchema),
  plants: z.partialRecord(
    z.enum(categoryIds),
    z.object({ category: z.enum(categoryIds), totalMinutes: seconds, viewedMinutes: seconds.optional() }),
  ),
});

export function createInitialState(): AppState {
  return { version: 1, route: 'main', activeTasks: [], completedTasks: [], plants: {} };
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

/** Returns the initial state for missing, corrupt or unknown-version data. */
export function deserializeState(raw: string | null): AppState {
  if (!raw) return createInitialState();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return createInitialState();
  }

  const parsed = AppStateSchema.safeParse(json);
  if (!parsed.success) return createInitialState();

  // Tampered saves could hold more tasks than the pen allows, or share a slot.
  const usedSlots = new Set<number>();
  const activeTasks = parsed.data.activeTasks.filter((task) => {
    if (usedSlots.has(task.slot) || usedSlots.size >= MAX_ACTIVE_TASKS) return false;
    usedSlots.add(task.slot);
    return true;
  });

  return { ...parsed.data, activeTasks };
}

/** Active tasks always force the Task page; otherwise reopen the saved page. */
export function resolveLaunchRoute(state: AppState): Route {
  return state.activeTasks.length > 0 ? 'task' : state.route;
}

export async function loadState(store: StateStore): Promise<AppState> {
  try {
    return deserializeState(await store.load());
  } catch {
    return createInitialState();
  }
}

export async function saveState(store: StateStore, state: AppState): Promise<void> {
  await store.save(serializeState(state));
}

/** The newest completed tasks first, at most RECENT_TASK_COUNT. */
export function recentTasks(completed: CompletedTask[]): CompletedTask[] {
  return [...completed].sort((a, b) => b.endedAt - a.endedAt).slice(0, RECENT_TASK_COUNT);
}

/** Every completed task in one category, newest first (the plant's task history). */
export function tasksInCategory(completed: CompletedTask[], category: CategoryId): CompletedTask[] {
  return completed.filter((t) => t.category === category).sort((a, b) => b.endedAt - a.endedAt);
}

/** Whole-number percentages that sum to 100, or all zero for an empty task. */
export function breakdown(metrics: TaskMetrics): BreakdownPercentages {
  const parts = [metrics.productiveSeconds, metrics.unproductiveSeconds, metrics.idleSeconds];
  const total = parts.reduce((a, b) => a + b, 0);
  if (total <= 0) return { onTask: 0, offTask: 0, idle: 0 };

  // Largest-remainder rounding: floor every share, then hand the missing
  // points to the shares with the biggest fractional parts.
  const exact = parts.map((p) => (p * 100) / total);
  const rounded = exact.map(Math.floor);
  let missing = 100 - rounded.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    rounded[index]++;
    missing--;
  }

  return { onTask: rounded[0], offTask: rounded[1], idle: rounded[2] };
}
