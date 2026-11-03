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
  type StateStore,
} from '../../src/core/persistence';
import { makeActiveTask, makeCompletedTask, makeState, MINUTE, T0 } from '../fixtures';

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
      version: 1,
      route: 'main',
      activeTasks: [],
      completedTasks: [],
      plants: {},
    });
  });
});

describe('#20 serialize / deserialize', () => {
  it('round-trips the full state exactly', () => {
    const state = makeState({
      route: 'task',
      activeTasks: [makeActiveTask({ slot: 2, animal: 'goat' })],
      completedTasks: [makeCompletedTask()],
      plants: { school: { category: 'school', totalMinutes: 47.5 } },
    });
    expect(deserializeState(serializeState(state))).toEqual(state);
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

  it.each(['main', 'task', 'garden'] as const)('reopens the saved %s page when nothing is active', (route) => {
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
