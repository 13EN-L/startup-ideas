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
  taskCategoryLabel,
  type TaskDeps,
} from '../../src/core/tasks';
import { ANIMALS, COLORS } from '../../src/shared/constants';
import { inCategory, makeActiveTask, makeCompletedTask, makeState, MINUTE, sequenceRandom, T0 } from '../fixtures';

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
      { name: 'Study chemistry', category: 'media' },
      deps({ random: () => 0.25, createId: () => 'abc' }),
    );
    expect(state.activeTasks).toEqual([
      {
        id: 'abc',
        name: 'Study chemistry',
        category: 'media',
        categoryLabel: 'Media',
        plant: 'tomato',
        animal: 'pig',
        slot: 0,
        startedAt: T0,
      },
    ]);
  });

  it("starts tasks in the user's own categories, remembering the name and plant at the start", () => {
    const state = startTask(
      makeState({ categories: [{ id: 'c1', label: 'Gardening', plant: null }] }),
      { name: 'Weed', category: 'c1' },
      deps(),
    );
    expect(state.activeTasks[0]).toMatchObject({ category: 'c1', categoryLabel: 'Gardening', plant: null });
  });

  it('refuses a default category the user has removed', () => {
    const state = makeState({ categories: [{ id: 'c1', label: 'Gardening', plant: null }] });
    expect(() => startTask(state, { name: 'X', category: 'programming' }, deps())).toThrow(
      expect.objectContaining({ code: 'unknown-category' }),
    );
  });

  it('trims whitespace from the task name', () => {
    const state = startTask(makeState(), { name: '  Taxes  ', category: 'professional-writing' }, deps());
    expect(state.activeTasks[0].name).toBe('Taxes');
  });

  it('assigns each new task the lowest free pen slot', () => {
    let state = makeState();
    state = startTask(state, { name: 'A', category: 'programming' }, deps({ createId: () => 'a' }));
    state = startTask(state, { name: 'B', category: 'programming' }, deps({ createId: () => 'b' }));
    state = startTask(state, { name: 'C', category: 'programming' }, deps({ createId: () => 'c' }));
    expect(state.activeTasks.map((t) => t.slot)).toEqual([0, 1, 2]);

    state = stopTask(state, 'b').state;
    state = startTask(state, { name: 'D', category: 'programming' }, deps({ createId: () => 'd' }));
    expect(state.activeTasks.find((t) => t.id === 'd')?.slot).toBe(1);
  });

  it('spawns a random animal from the pool for each task', () => {
    const random = sequenceRandom(0.05, 0.95);
    let state = startTask(makeState(), { name: 'A', category: 'programming' }, deps({ random }));
    state = startTask(state, { name: 'B', category: 'programming' }, deps({ random, createId: () => 'b' }));
    expect(state.activeTasks.map((t) => t.animal)).toEqual(['cow', 'cat']);
  });

  it('refuses a 4th task with a limit-reached error', () => {
    const full = makeState({
      activeTasks: [makeActiveTask({ slot: 0 }), makeActiveTask({ slot: 1 }), makeActiveTask({ slot: 2 })],
    });
    expect(() => startTask(full, { name: 'One more', category: 'communication' }, deps())).toThrow(
      expect.objectContaining({ name: 'TaskError', code: 'limit-reached' }),
    );
  });

  it.each(['', '   '])('refuses an empty name (%j)', (name) => {
    expect(() => startTask(makeState(), { name, category: 'communication' }, deps())).toThrow(TaskError);
  });

  it('refuses an unknown category', () => {
    expect(() => startTask(makeState(), { name: 'X', category: 'gaming' }, deps())).toThrow(
      expect.objectContaining({ code: 'unknown-category' }),
    );
  });

  it('does not mutate the previous state', () => {
    const before = makeState();
    startTask(before, { name: 'A', category: 'programming' }, deps());
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
  const eighteenMinutes = { productiveSeconds: 18 * 60, unproductiveSeconds: 0, idleSeconds: 0 };

  it('records the completed task and grows its category plant', () => {
    const done = makeCompletedTask({ ...inCategory('geography'), metrics: eighteenMinutes });
    const state = completeTask(makeState(), done);
    expect(state.completedTasks).toEqual([done]);
    expect(state.plants.apple).toEqual({ plant: 'apple', totalMinutes: 18, viewedMinutes: 0 });
  });

  it("grows the plant the category maps to when the task completes, not when it started", () => {
    // Started while Geography grew the apple; remapped to the carrot before it finished.
    const done = makeCompletedTask({ ...inCategory('geography'), metrics: eighteenMinutes });
    const categories = makeState().categories.map((c) => (c.id === 'geography' ? { ...c, plant: 'carrot' as const } : c));
    const state = completeTask(makeState({ categories }), done);
    expect(state.plants).toEqual({ carrot: { plant: 'carrot', totalMinutes: 18, viewedMinutes: 0 } });
    expect(state.completedTasks[0].plant).toBe('carrot');
  });

  it('never moves growth from earlier tasks when a category is remapped', () => {
    let state = completeTask(makeState(), makeCompletedTask({ ...inCategory('geography'), metrics: eighteenMinutes }));
    state = {
      ...state,
      categories: state.categories.map((c) => (c.id === 'geography' ? { ...c, plant: 'carrot' as const } : c)),
    };
    state = completeTask(state, makeCompletedTask({ ...inCategory('geography'), metrics: eighteenMinutes }));
    expect(state.plants.apple).toMatchObject({ totalMinutes: 18 });
    expect(state.plants.carrot).toMatchObject({ totalMinutes: 18 });
    expect(state.completedTasks.map((t) => t.plant)).toEqual(['apple', 'carrot']);
  });

  it('records the task but grows nothing when its category has no plant', () => {
    const categories = [{ id: 'reading', label: 'Reading', plant: null }];
    const done = makeCompletedTask({ category: 'reading', categoryLabel: 'Reading', plant: 'pine', metrics: eighteenMinutes });
    const state = completeTask(makeState({ categories }), done);
    expect(state.plants).toEqual({});
    expect(state.completedTasks).toEqual([{ ...done, plant: null }]);
  });

  it("uses the category's current name", () => {
    const categories = [{ id: 'media', label: 'Videos', plant: 'tomato' as const }];
    const state = completeTask(makeState({ categories }), makeCompletedTask(inCategory('media')));
    expect(state.completedTasks[0].categoryLabel).toBe('Videos');
  });

  it('keeps the name and plant from the start when the category was removed meanwhile', () => {
    const categories = [{ id: 'other', label: 'Other', plant: 'pine' as const }];
    const done = makeCompletedTask({ ...inCategory('geography'), metrics: eighteenMinutes });
    const state = completeTask(makeState({ categories }), done);
    expect(state.completedTasks[0]).toMatchObject({ categoryLabel: 'Geography', plant: 'apple' });
    expect(state.plants.apple?.totalMinutes).toBe(18);
  });
});

describe('taskCategoryLabel', () => {
  it("shows a category's current name, or the saved one once it is gone", () => {
    const task = makeCompletedTask({ category: 'c1', categoryLabel: 'Old name' });
    expect(taskCategoryLabel(task, [{ id: 'c1', label: 'New name', plant: null }])).toBe('New name');
    expect(taskCategoryLabel(task, [])).toBe('Old name');
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
