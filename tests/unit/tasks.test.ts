// Issue #19: Develop Task Page, Animal Pen, and Active Task Limits
import { describe, expect, it } from 'vitest';
import {
  canStartTask,
  completeTask,
  elapsedSeconds,
  formatDuration,
  formatFocusTime,
  homeButtonState,
  pickAnimal,
  startTask,
  stopTask,
  TaskError,
  type TaskDeps,
} from '../../src/core/tasks';
import { ANIMALS, COLORS } from '../../src/shared/constants';
import { makeActiveTask, makeCompletedTask, makeState, MINUTE, sequenceRandom, T0 } from '../fixtures';

function deps(overrides: Partial<TaskDeps> = {}): TaskDeps {
  let n = 0;
  return { now: T0, random: () => 0, createId: () => `id-${++n}`, ...overrides };
}

describe('#19 canStartTask: 3-animal limit', () => {
  it.each([0, 1, 2])('allows starting with %d active tasks', (count) => {
    expect(canStartTask(Array.from({ length: count }, () => makeActiveTask()))).toBe(true);
  });

  it('blocks starting with 3 active tasks', () => {
    expect(canStartTask([makeActiveTask(), makeActiveTask(), makeActiveTask()])).toBe(false);
  });
});

describe('#19 pickAnimal', () => {
  it('maps the random value across the full 10-animal pool', () => {
    expect(pickAnimal(() => 0)).toBe('cow');
    expect(pickAnimal(() => 0.999)).toBe('cat');
    const seen = new Set(ANIMALS.map((_, i) => pickAnimal(() => (i + 0.5) / ANIMALS.length)));
    expect(seen.size).toBe(10);
  });
});

describe('#19 startTask', () => {
  it('adds an active task with the custom name, category, animal and start time', () => {
    const state = startTask(
      makeState(),
      { name: 'Study chemistry', category: 'school' },
      deps({ random: () => 0.25, createId: () => 'abc' }),
    );
    expect(state.activeTasks).toEqual([
      { id: 'abc', name: 'Study chemistry', category: 'school', animal: 'pig', slot: 0, startedAt: T0 },
    ]);
  });

  it('trims whitespace from the task name', () => {
    const state = startTask(makeState(), { name: '  Taxes  ', category: 'finance' }, deps());
    expect(state.activeTasks[0].name).toBe('Taxes');
  });

  it('assigns each new task the lowest free pen slot', () => {
    let state = makeState();
    state = startTask(state, { name: 'A', category: 'work' }, deps({ createId: () => 'a' }));
    state = startTask(state, { name: 'B', category: 'work' }, deps({ createId: () => 'b' }));
    state = startTask(state, { name: 'C', category: 'work' }, deps({ createId: () => 'c' }));
    expect(state.activeTasks.map((t) => t.slot)).toEqual([0, 1, 2]);

    state = stopTask(state, 'b').state;
    state = startTask(state, { name: 'D', category: 'work' }, deps({ createId: () => 'd' }));
    expect(state.activeTasks.find((t) => t.id === 'd')?.slot).toBe(1);
  });

  it('spawns a random animal from the pool for each task', () => {
    const random = sequenceRandom(0.05, 0.95);
    let state = startTask(makeState(), { name: 'A', category: 'work' }, deps({ random }));
    state = startTask(state, { name: 'B', category: 'work' }, deps({ random, createId: () => 'b' }));
    expect(state.activeTasks.map((t) => t.animal)).toEqual(['cow', 'cat']);
  });

  it('refuses a 4th task with a limit-reached error', () => {
    const full = makeState({
      activeTasks: [makeActiveTask({ slot: 0 }), makeActiveTask({ slot: 1 }), makeActiveTask({ slot: 2 })],
    });
    expect(() => startTask(full, { name: 'One more', category: 'home' }, deps())).toThrow(
      expect.objectContaining({ name: 'TaskError', code: 'limit-reached' }),
    );
  });

  it.each(['', '   '])('refuses an empty name (%j)', (name) => {
    expect(() => startTask(makeState(), { name, category: 'home' }, deps())).toThrow(TaskError);
  });

  it('refuses an unknown category', () => {
    // @ts-expect-error deliberately invalid category
    expect(() => startTask(makeState(), { name: 'X', category: 'gaming' }, deps())).toThrow(
      expect.objectContaining({ code: 'unknown-category' }),
    );
  });

  it('does not mutate the previous state', () => {
    const before = makeState();
    startTask(before, { name: 'A', category: 'work' }, deps());
    expect(before.activeTasks).toEqual([]);
  });
});

describe('#19 stopTask', () => {
  it('removes the task from the pen and returns it', () => {
    const task = makeActiveTask({ id: 'x' });
    const other = makeActiveTask({ id: 'y', slot: 1 });
    const { state, stopped } = stopTask(makeState({ activeTasks: [task, other] }), 'x');
    expect(stopped).toEqual(task);
    expect(state.activeTasks).toEqual([other]);
  });

  it('frees the slot so a new task can start after stopping at the limit', () => {
    const full = makeState({
      activeTasks: [
        makeActiveTask({ id: 'a', slot: 0 }),
        makeActiveTask({ id: 'b', slot: 1 }),
        makeActiveTask({ id: 'c', slot: 2 }),
      ],
    });
    expect(canStartTask(stopTask(full, 'a').state.activeTasks)).toBe(true);
  });

  it('throws not-found for an unknown task id', () => {
    expect(() => stopTask(makeState(), 'missing')).toThrow(expect.objectContaining({ code: 'not-found' }));
  });
});

describe('#19 completeTask', () => {
  it('records the completed task and grows its category plant', () => {
    const done = makeCompletedTask({
      category: 'health',
      metrics: { productiveSeconds: 18 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    const state = completeTask(makeState(), done);
    expect(state.completedTasks).toEqual([done]);
    expect(state.plants.health).toEqual({ category: 'health', totalMinutes: 18, viewedMinutes: 0 });
  });
});

describe('#19 elapsed time', () => {
  it('counts whole seconds since the task started', () => {
    const task = makeActiveTask({ startedAt: T0 });
    expect(elapsedSeconds(task, T0 + 90_500)).toBe(90);
  });

  it('never goes negative if the clock moves backwards', () => {
    expect(elapsedSeconds(makeActiveTask({ startedAt: T0 }), T0 - MINUTE)).toBe(0);
  });

  it.each([
    [0, '00:00'],
    [59, '00:59'],
    [61, '01:01'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3 * 3600 + 25 * 60 + 7, '3:25:07'],
  ])('formats %d seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('#19 homeButtonState', () => {
  it('is enabled and dark brown with no active tasks', () => {
    expect(homeButtonState([])).toEqual({
      disabled: false,
      signColor: COLORS.darkBrown,
      postColor: COLORS.lightBrown,
    });
  });

  it.each([1, 2, 3])('is greyed out with %d active tasks', (count) => {
    expect(homeButtonState(Array.from({ length: count }, () => makeActiveTask()))).toEqual({
      disabled: true,
      signColor: COLORS.darkGrey,
      postColor: COLORS.lightGrey,
    });
  });
});

describe('formatFocusTime', () => {
  it.each([
    [0, '0 min'],
    [0.9, '0 min'],
    [45, '45 min'],
    [60, '1 h 0 min'],
    [125.7, '2 h 5 min'],
    [-3, '0 min'],
    [Number.NaN, '0 min'],
  ])('%s minutes -> %s', (minutes, text) => {
    expect(formatFocusTime(minutes)).toBe(text);
  });
});
