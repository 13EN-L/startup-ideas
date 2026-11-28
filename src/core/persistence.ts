// Issue #20: state persistence, launch restoration and recent task clouds.
import { z } from 'zod';
import {
  ANIMALS,
  LEGACY_CATEGORIES,
  MAX_ACTIVE_TASKS,
  PLANTS,
  RECENT_TASK_COUNT,
} from '../shared/constants';
import type {
  ActiveTask,
  AppState,
  BreakdownPercentages,
  Category,
  CompletedTask,
  PlantId,
  PlantState,
  Route,
  TaskMetrics,
} from '../shared/types';
import { ACTIVITY_SOURCES } from '../shared/types';
import { defaultCategories, sanitizeCategories } from './categories';

/** Where the serialized AppState lives (a JSON file in Electron's userData). */
export interface StateStore {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
}

const plantIds = PLANTS.map((p) => p.id) as [PlantId, ...PlantId[]];
const legacyCategoryIds = LEGACY_CATEGORIES.map((c) => c.id) as [
  (typeof LEGACY_CATEGORIES)[number]['id'],
  ...(typeof LEGACY_CATEGORIES)[number]['id'][],
];
const seconds = z.number().finite().nonnegative();
const plantId = z.enum(plantIds);

const taskBase = {
  id: z.string(),
  name: z.string(),
  startedAt: z.number().finite(),
};

const activeTaskBase = {
  ...taskBase,
  animal: z.enum(ANIMALS),
  slot: z.union([z.literal(0), z.literal(1), z.literal(2)]),
};

const completedTaskBase = {
  ...taskBase,
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
};

const categorySnapshot = {
  category: z.string().min(1),
  categoryLabel: z.string(),
  plant: plantId.nullable(),
};

const AppStateSchema = z.object({
  version: z.literal(2),
  route: z.enum(['main', 'task', 'garden', 'categories']),
  // Repaired separately, so one bad category doesn't discard the whole garden.
  categories: z.unknown(),
  activeTasks: z.array(z.object({ ...activeTaskBase, ...categorySnapshot })),
  completedTasks: z.array(z.object({ ...completedTaskBase, ...categorySnapshot })),
  plants: z.partialRecord(
    plantId,
    z.object({ plant: plantId, totalMinutes: seconds, viewedMinutes: seconds.optional() }),
  ),
});

/** Saves from before categories were editable: ten fixed categories, plants keyed by category. */
const LegacyAppStateSchema = z.object({
  version: z.literal(1),
  route: z.enum(['main', 'task', 'garden']),
  activeTasks: z.array(z.object({ ...activeTaskBase, category: z.enum(legacyCategoryIds) })),
  completedTasks: z.array(z.object({ ...completedTaskBase, category: z.enum(legacyCategoryIds) })),
  plants: z.partialRecord(
    z.enum(legacyCategoryIds),
    z.object({ totalMinutes: seconds, viewedMinutes: seconds.optional() }),
  ),
});

/** A fresh garden. Pass `categories` to keep the user's categories (resetting only progress). */
export function createInitialState(categories: Category[] = defaultCategories()): AppState {
  return { version: 2, route: 'main', categories, activeTasks: [], completedTasks: [], plants: {} };
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

function legacyCategory(id: (typeof LEGACY_CATEGORIES)[number]['id']) {
  return LEGACY_CATEGORIES.find((c) => c.id === id)!;
}

/**
 * Version 1 -> 2: every grown plant and every task is kept. Tasks keep their
 * old category's name and the plant it grew; the category list becomes the
 * new defaults. Tasks still running finish into their old plant.
 */
function migrateLegacyState(legacy: z.infer<typeof LegacyAppStateSchema>): AppState {
  const snapshot = (id: (typeof LEGACY_CATEGORIES)[number]['id']) => {
    const old = legacyCategory(id);
    return { category: old.id, categoryLabel: old.label, plant: old.plant as PlantId };
  };
  const plants: Partial<Record<PlantId, PlantState>> = {};
  for (const [id, plant] of Object.entries(legacy.plants)) {
    if (!plant) continue;
    const plantKey = legacyCategory(id as (typeof LEGACY_CATEGORIES)[number]['id']).plant;
    plants[plantKey] = { ...plant, plant: plantKey };
  }
  return {
    version: 2,
    route: legacy.route,
    categories: defaultCategories(),
    activeTasks: legacy.activeTasks.map((t): ActiveTask => ({ ...t, ...snapshot(t.category) })),
    completedTasks: legacy.completedTasks.map((t): CompletedTask => ({ ...t, ...snapshot(t.category) })),
    plants,
  };
}

function parseState(json: unknown): AppState | null {
  const current = AppStateSchema.safeParse(json);
  if (current.success) {
    return { ...current.data, categories: sanitizeCategories(current.data.categories) };
  }
  const legacy = LegacyAppStateSchema.safeParse(json);
  return legacy.success ? migrateLegacyState(legacy.data) : null;
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

  const parsed = parseState(json);
  if (!parsed) return createInitialState();

  // Tampered saves could hold more tasks than the pen allows, or share a slot.
  const usedSlots = new Set<number>();
  const activeTasks = parsed.activeTasks.filter((task) => {
    if (usedSlots.has(task.slot) || usedSlots.size >= MAX_ACTIVE_TASKS) return false;
    usedSlots.add(task.slot);
    return true;
  });

  return { ...parsed, activeTasks };
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

/**
 * Every completed task that grew this plant, newest first (the plant's task
 * history). Based on the plant each task grew, not on today's mappings.
 */
export function tasksForPlant(completed: CompletedTask[], plant: PlantId): CompletedTask[] {
  return completed.filter((t) => t.plant === plant).sort((a, b) => b.endedAt - a.endedAt);
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
