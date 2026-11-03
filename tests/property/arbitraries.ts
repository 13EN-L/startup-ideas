// fast-check generators for valid FocusGarden domain values.
import fc from 'fast-check';
import { ANIMALS, CATEGORIES, MINUTES_PER_CYCLE } from '../../src/shared/constants';
import type {
  ActiveTask,
  ActivityItem,
  AppState,
  CategoryId,
  ClassifiedActivity,
  CompletedTask,
  PenSlot,
  PlantState,
  TaskMetrics,
} from '../../src/shared/types';

export const categoryIds = CATEGORIES.map((c) => c.id) as CategoryId[];

export const categoryArb = fc.constantFrom(...categoryIds);
export const animalArb = fc.constantFrom(...ANIMALS);

/** Like Math.random(): [0, 1). */
export const unitIntervalArb = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

/**
 * Quarter-minute steps up to 200 cycles. Quarters are exact in binary floating
 * point, so sums and JSON round trips compare exactly.
 */
export const minutesArb = fc.integer({ min: 0, max: MINUTES_PER_CYCLE * 4 * 200 }).map((q) => q / 4);

export const taskNameArb = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0);

export const epochArb = fc.integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2030, 0, 1) });

export const metricsArb: fc.Arbitrary<TaskMetrics> = fc.record({
  productiveSeconds: fc.nat(36_000),
  unproductiveSeconds: fc.nat(36_000),
  idleSeconds: fc.nat(36_000),
});

export const activityItemArb: fc.Arbitrary<ActivityItem> = fc
  .record({
    name: fc.string({ minLength: 1, maxLength: 60 }),
    source: fc.constantFrom('app' as const, 'web' as const),
    seconds: fc.nat(36_000),
  })
  .map(({ name, source, seconds }) => ({ id: `${source}:${name}`, name, source, seconds }));

/** Activities as collectTaskActivity produces them: ids are unique. */
export const activityListArb = (maxLength = 20) =>
  fc.uniqueArray(activityItemArb, { selector: (a) => a.id, maxLength });

export const classifiedActivityArb: fc.Arbitrary<ClassifiedActivity> = fc
  .tuple(activityItemArb, fc.constantFrom('on-task' as const, 'off-task' as const))
  .map(([item, status]) => ({ ...item, status }));

export const activeTaskArb = (slot: PenSlot): fc.Arbitrary<ActiveTask> =>
  fc.record({
    id: fc.uuid(),
    name: taskNameArb.map((s) => s.trim()),
    category: categoryArb,
    animal: animalArb,
    slot: fc.constant(slot),
    startedAt: epochArb,
  });

export const completedTaskArb: fc.Arbitrary<CompletedTask> = fc
  .record({
    id: fc.uuid(),
    name: taskNameArb,
    category: categoryArb,
    startedAt: epochArb,
    durationMs: fc.integer({ min: 0, max: 8 * 3_600_000 }),
    metrics: metricsArb,
    activities: fc.uniqueArray(classifiedActivityArb, { selector: (a) => a.id, maxLength: 8 }),
  })
  .map(({ durationMs, ...task }) => ({ ...task, endedAt: task.startedAt + durationMs }));

export const plantsArb: fc.Arbitrary<Partial<Record<CategoryId, PlantState>>> = fc
  .subarray(categoryIds)
  .chain((ids) => fc.tuple(...ids.map(() => minutesArb)).map((minutes) => ({ ids, minutes })))
  .map(({ ids, minutes }) =>
    Object.fromEntries(ids.map((id, i) => [id, { category: id, totalMinutes: minutes[i] }])),
  );

/** Any state the app could legitimately have saved: at most 3 tasks, unique slots. */
export const appStateArb: fc.Arbitrary<AppState> = fc
  .shuffledSubarray([0, 1, 2] as PenSlot[], { maxLength: 3 })
  .chain((slots) =>
    fc.record({
      version: fc.constant(1 as const),
      route: fc.constantFrom('main' as const, 'task' as const, 'garden' as const),
      activeTasks: fc.tuple(...slots.map(activeTaskArb)),
      completedTasks: fc.array(completedTaskArb, { maxLength: 12 }),
      plants: plantsArb,
    }),
  );
