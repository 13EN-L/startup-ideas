// Issue #20: Implement State Persistence and Recent Task Cloud Popups
import { describe, expect, it, vi } from 'vitest';
import {
  breakdown,
  createInitialState,
  deserializeState,
  loadState,
  recentTasks,
  resolveLaunchRoute,
  saveState,
  serializeState,
  tasksForPlant,
  type StateStore,
} from '../../src/core/persistence';
import { defaultCategories } from '../../src/core/categories';
import { inCategory, makeActiveTask, makeCompletedTask, makeState, MINUTE, T0 } from '../fixtures';

function memoryStore(initial: string | null = null) {
  const store = {
    data: initial,
    load: vi.fn(async (): Promise<string | null> => store.data),
    save: vi.fn(async (s: string) => {
      store.data = s;
    }),
  };
  return store satisfies StateStore;
}

describe('#20 createInitialState', () => {
  it('starts on the main page with nothing active, completed or planted', () => {
    expect(createInitialState()).toEqual({
      version: 2,
      route: 'main',
      categories: defaultCategories(),
      activeTasks: [],
      completedTasks: [],
      plants: {},
    });
  });

  it('can keep existing categories (resetting only tasks and plants)', () => {
    const categories = [{ id: 'c1', label: 'Mine', plant: null }];
    expect(createInitialState(categories)).toMatchObject({ categories, plants: {}, completedTasks: [] });
  });
});

describe('#20 serialize / deserialize', () => {
  it('round-trips the full state exactly', () => {
    const state = makeState({
      route: 'task',
      activeTasks: [makeActiveTask({ slot: 2, animal: 'goat' })],
      completedTasks: [makeCompletedTask()],
      plants: {
        tomato: { plant: 'tomato', totalMinutes: 47.5 },
        pine: { plant: 'pine', totalMinutes: 50, viewedMinutes: 12 },
      },
    });
    expect(deserializeState(serializeState(state))).toEqual(state);
  });

  it('round-trips edited categories, the categories page and tasks with no plant', () => {
    const state = makeState({
      route: 'categories',
      categories: [
        { id: 'a', label: 'Deep work', plant: 'pine' },
        { id: 'b', label: 'Reading', plant: null },
      ],
      completedTasks: [makeCompletedTask({ category: 'b', categoryLabel: 'Reading', plant: null })],
    });
    expect(deserializeState(serializeState(state))).toEqual(state);
  });

  it('repairs a bad category list instead of discarding the garden', () => {
    const plants = { pine: { plant: 'pine' as const, totalMinutes: 12 } };
    const raw = (categories: unknown) => JSON.stringify({ ...makeState({ plants }), categories });
    expect(deserializeState(raw([])).categories).toEqual(defaultCategories());
    expect(deserializeState(raw('nope'))).toMatchObject({ categories: defaultCategories(), plants });
    expect(
      deserializeState(
        raw([
          { id: 'a', label: 'Fine', plant: 'pine' },
          { id: 'b', label: 'x'.repeat(21), plant: 'pine' },
          { id: 'c', label: 'FINE', plant: null },
          { id: 'a', label: 'Same id', plant: null },
          { id: 'd', label: 'Odd plant', plant: 'banana' },
          { id: 'e', label: '  Spaced  ', plant: null },
        ]),
      ).categories,
    ).toEqual([
      { id: 'a', label: 'Fine', plant: 'pine' },
      { id: 'e', label: 'Spaced', plant: null },
    ]);
    const many = Array.from({ length: 25 }, (_, i) => ({ id: 'c' + i, label: 'Cat ' + i, plant: null }));
    expect(deserializeState(raw(many)).categories).toHaveLength(20);
  });

  it.each([
    ['missing data', null],
    ['empty string', ''],
    ['invalid JSON', '{not json'],
    ['wrong shape', JSON.stringify({ hello: 'world' })],
    ['unknown version', JSON.stringify({ ...makeState(), version: 99 })],
    ['activeTasks not an array', JSON.stringify({ ...makeState(), activeTasks: 'nope' })],
  ])('falls back to the initial state for %s', (_label, raw) => {
    expect(deserializeState(raw)).toEqual(createInitialState());
  });

  it('drops active tasks beyond the 3-task limit from tampered data', () => {
    const raw = JSON.stringify(
      makeState({
        activeTasks: [0, 1, 2, 0].map((slot) => makeActiveTask({ slot: slot as 0 | 1 | 2 })),
      }),
    );
    expect(deserializeState(raw).activeTasks).toHaveLength(3);
  });
});

describe('#20 resolveLaunchRoute', () => {
  it('returns to the Task page when tasks were active, whatever page was saved', () => {
    expect(resolveLaunchRoute(makeState({ route: 'main', activeTasks: [makeActiveTask()] }))).toBe('task');
    expect(resolveLaunchRoute(makeState({ route: 'garden', activeTasks: [makeActiveTask()] }))).toBe('task');
  });

  it.each(['main', 'task', 'garden', 'categories'] as const)('reopens the saved %s page when nothing is active', (route) => {
    expect(resolveLaunchRoute(makeState({ route }))).toBe(route);
  });
});

describe('#20 loadState / saveState', () => {
  it('saves to the store and loads the same state back', async () => {
    const store = memoryStore();
    const state = makeState({ route: 'task', activeTasks: [makeActiveTask()] });
    await saveState(store, state);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(await loadState(store)).toEqual(state);
  });

  it('loads the initial state on first launch', async () => {
    expect(await loadState(memoryStore(null))).toEqual(createInitialState());
  });

  it('loads the initial state when the store fails to read', async () => {
    const store = memoryStore();
    store.load.mockRejectedValueOnce(new Error('EACCES'));
    expect(await loadState(store)).toEqual(createInitialState());
  });
});

describe('#20 recentTasks', () => {
  it('returns the 5 most recently completed tasks, newest first', () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeCompletedTask({ name: `Task ${i}`, endedAt: T0 + i * MINUTE }),
    );
    // Stored order should not matter.
    const shuffled = [tasks[3], tasks[6], tasks[0], tasks[5], tasks[1], tasks[4], tasks[2]];
    expect(recentTasks(shuffled).map((t) => t.name)).toEqual(['Task 6', 'Task 5', 'Task 4', 'Task 3', 'Task 2']);
  });

  it('returns fewer than 5 when fewer exist', () => {
    expect(recentTasks([makeCompletedTask()])).toHaveLength(1);
    expect(recentTasks([])).toEqual([]);
  });
});

describe('tasksForPlant', () => {
  it('returns every task that grew the plant, not just the 5 recent ones, newest first', () => {
    const work = Array.from({ length: 7 }, (_, i) =>
      makeCompletedTask({ name: 'Work ' + i, ...inCategory('programming'), endedAt: T0 + i * MINUTE }),
    );
    const other = makeCompletedTask({ name: 'Gym', ...inCategory('leisure'), endedAt: T0 + 99 * MINUTE });
    const stored = [work[2], other, work[6], work[0], work[4], work[1], work[5], work[3]];
    expect(tasksForPlant(stored, 'pine').map((t) => t.name)).toEqual([
      'Work 6',
      'Work 5',
      'Work 4',
      'Work 3',
      'Work 2',
      'Work 1',
      'Work 0',
    ]);
  });

  it('goes by the plant each task grew, so remapping keeps old tasks with their plant', () => {
    const before = makeCompletedTask({ name: 'Before', category: 'media', plant: 'tomato' });
    const after = makeCompletedTask({ name: 'After', category: 'media', plant: 'carrot' });
    const none = makeCompletedTask({ name: 'None', category: 'media', plant: null });
    expect(tasksForPlant([before, after, none], 'tomato').map((t) => t.name)).toEqual(['Before']);
    expect(tasksForPlant([before, after, none], 'carrot').map((t) => t.name)).toEqual(['After']);
  });

  it('is empty for a plant with no tasks', () => {
    expect(tasksForPlant([makeCompletedTask(inCategory('programming'))], 'lilac')).toEqual([]);
  });
});

describe('version 1 saves (fixed categories) migrate to editable categories', () => {
  const v1Task = {
    id: 't1',
    name: 'Budget',
    category: 'finance',
    startedAt: T0,
    endedAt: T0 + 30 * MINUTE,
    metrics: { productiveSeconds: 600, unproductiveSeconds: 0, idleSeconds: 0 },
    activities: [],
  };
  const v1 = {
    version: 1,
    route: 'garden',
    activeTasks: [{ id: 'a1', name: 'Run', category: 'health', animal: 'cow', slot: 1, startedAt: T0 }],
    completedTasks: [v1Task],
    plants: {
      finance: { category: 'finance', totalMinutes: 40, viewedMinutes: 30 },
      work: { category: 'work', totalMinutes: 7 },
    },
  };

  it('keeps every plant with its growth, now keyed by plant', () => {
    expect(deserializeState(JSON.stringify(v1)).plants).toEqual({
      lilac: { plant: 'lilac', totalMinutes: 40, viewedMinutes: 30 },
      pine: { plant: 'pine', totalMinutes: 7 },
    });
  });

  it('keeps past tasks with their old category name and the plant they grew', () => {
    expect(deserializeState(JSON.stringify(v1)).completedTasks).toEqual([
      { ...v1Task, categoryLabel: 'Finance', plant: 'lilac' },
    ]);
  });

  it('lets running tasks finish into their old plant', () => {
    expect(deserializeState(JSON.stringify(v1)).activeTasks).toEqual([
      {
        id: 'a1',
        name: 'Run',
        category: 'health',
        categoryLabel: 'Health & Fitness',
        plant: 'apple',
        animal: 'cow',
        slot: 1,
        startedAt: T0,
      },
    ]);
  });

  it('switches to the new default categories and keeps the page', () => {
    expect(deserializeState(JSON.stringify(v1))).toMatchObject({
      version: 2,
      route: 'garden',
      categories: defaultCategories(),
    });
  });

  it('migrates an empty version 1 save to a fresh version 2 garden', () => {
    const empty = { version: 1, route: 'main', activeTasks: [], completedTasks: [], plants: {} };
    expect(deserializeState(JSON.stringify(empty))).toEqual(createInitialState());
  });
});

describe('#20 breakdown', () => {
  it('splits on-task / off-task / idle by percentage', () => {
    expect(breakdown({ productiveSeconds: 600, unproductiveSeconds: 300, idleSeconds: 100 })).toEqual({
      onTask: 60,
      offTask: 30,
      idle: 10,
    });
  });

  it('rounds to whole percentages that always sum to 100', () => {
    const result = breakdown({ productiveSeconds: 1, unproductiveSeconds: 1, idleSeconds: 1 });
    expect(result.onTask + result.offTask + result.idle).toBe(100);
    for (const value of Object.values(result)) expect([33, 34]).toContain(value);
  });

  it('is all zero for a task with no recorded time', () => {
    expect(breakdown({ productiveSeconds: 0, unproductiveSeconds: 0, idleSeconds: 0 })).toEqual({
      onTask: 0,
      offTask: 0,
      idle: 0,
    });
  });
});
