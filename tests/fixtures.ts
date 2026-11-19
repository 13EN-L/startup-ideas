import type {
  ActiveTask,
  AppState,
  ClassifiedActivity,
  CompletedTask,
} from '../src/shared/types';

export const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);
export const MINUTE = 60_000;

let seq = 0;
const nextId = () => `task-${++seq}`;

export function makeActiveTask(overrides: Partial<ActiveTask> = {}): ActiveTask {
  return {
    id: nextId(),
    name: 'Write essay',
    category: 'school',
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
    category: 'school',
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
    version: 1,
    route: 'main',
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
