import { DEFAULT_CATEGORIES } from '../src/shared/constants';
import { defaultCategories } from '../src/core/categories';
import type {
  ActiveTask,
  AppState,
  CategoryId,
  ClassifiedActivity,
  CompletedTask,
  PlantId,
} from '../src/shared/types';

export const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);
export const MINUTE = 60_000;

let seq = 0;
const nextId = () => `task-${++seq}`;

type DefaultCategoryId = (typeof DEFAULT_CATEGORIES)[number]['id'];

/**
 * The category fields of a task in one of the default categories, e.g.
 * inCategory('programming') -> { category: 'programming', categoryLabel: 'Programming', plant: 'pine' }.
 */
export function inCategory(id: DefaultCategoryId): { category: CategoryId; categoryLabel: string; plant: PlantId | null } {
  const category = DEFAULT_CATEGORIES.find((c) => c.id === id)!;
  return { category: category.id, categoryLabel: category.label, plant: category.plant };
}

export function makeActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return {
    id: nextId(),
    name: 'Write essay',
    ...inCategory('media'),
    animal: 'cow',
    slot: 0,
    startedAt: T0,
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<ClassifiedActivity> = {}): ClassifiedActivity {
  const name = overrides.name ?? 'docs.google.com';
  const source = overrides.source ?? 'web';
  return {
    id: `${source}:${name}`,
    name,
    source,
    seconds: 600,
    status: 'on-task',
    ...overrides,
  };
}

export function makeCompletedTask(overrides: Partial<CompletedTask> = {}): CompletedTask {
  return {
    id: nextId(),
    name: 'Write essay',
    ...inCategory('media'),
    startedAt: T0,
    endedAt: T0 + 30 * MINUTE,
    metrics: { productiveSeconds: 1200, unproductiveSeconds: 420, idleSeconds: 180 },
    activities: [
      makeActivity({ name: 'docs.google.com', seconds: 1200, status: 'on-task' }),
      makeActivity({ name: 'youtube.com', seconds: 420, status: 'off-task' }),
    ],
    ...overrides,
  };
}

export function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: 2,
    route: 'main',
    categories: defaultCategories(),
    activeTasks: [],
    completedTasks: [],
    plants: {},
    ...overrides,
  };
}

/** Deterministic Math.random replacement cycling through the given values. */
export function sequenceRandom(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
