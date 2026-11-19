// Issue #19: model-based checks of the pen across random start/stop sequences
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canStartTask,
  elapsedSeconds,
  formatDuration,
  homeButtonState,
  pickAnimal,
  startTask,
  stopTask,
  TaskError,
} from '../../src/core/tasks';
import { ANIMALS, MAX_ACTIVE_TASKS } from '../../src/shared/constants';
import type { AppState, CategoryId } from '../../src/shared/types';
import { makeState } from '../fixtures';
import { activeTaskArb, categoryArb, epochArb, taskNameArb, unitIntervalArb } from './arbitraries';

type Op =
  | { type: 'start'; name: string; category: CategoryId; random: number }
  | { type: 'stop'; pick: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ type: fc.constant('start' as const), name: taskNameArb, category: categoryArb, random: unitIntervalArb }),
  fc.record({ type: fc.constant('stop' as const), pick: fc.nat() }),
);

describe('#19 pen invariants under any sequence of starts and stops', () => {
  it('never exceeds 3 animals, keeps slots unique and fills the lowest free slot', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        let state: AppState = makeState();
        let ids = 0;

        for (const op of ops) {
          if (op.type === 'start') {
            const before = state.activeTasks;
            const freeSlots = [0, 1, 2].filter((s) => !before.some((t) => t.slot === s));
            if (before.length >= MAX_ACTIVE_TASKS) {
              expect(() =>
                startTask(state, op, { now: 0, random: () => op.random, createId: () => `t${++ids}` }),
              ).toThrow(TaskError);
              continue;
            }
            const id = `t${++ids}`;
            state = startTask(state, op, { now: 0, random: () => op.random, createId: () => id });
            const started = state.activeTasks.find((t) => t.id === id)!;
            expect(started.slot).toBe(Math.min(...freeSlots));
            expect(started.name).toBe(op.name.trim());
          } else if (state.activeTasks.length > 0) {
            const target = state.activeTasks[op.pick % state.activeTasks.length];
            const result = stopTask(state, target.id);
            expect(result.stopped).toEqual(target);
            state = result.state;
            expect(state.activeTasks.some((t) => t.id === target.id)).toBe(false);
          }

          const slots = state.activeTasks.map((t) => t.slot);
          expect(state.activeTasks.length).toBeLessThanOrEqual(MAX_ACTIVE_TASKS);
          expect(new Set(slots).size).toBe(slots.length);
          expect(canStartTask(state.activeTasks)).toBe(state.activeTasks.length < MAX_ACTIVE_TASKS);
          expect(homeButtonState(state.activeTasks).disabled).toBe(state.activeTasks.length > 0);
        }
      }),
    );
  });
});

describe('#19 pickAnimal properties', () => {
  it('always returns an animal from the pool', () => {
    fc.assert(
      fc.property(unitIntervalArb, (r) => {
        expect(ANIMALS).toContain(pickAnimal(() => r));
      }),
    );
  });
});

describe('#19 elapsed time properties', () => {
  it('is a whole number of seconds, never negative', () => {
    fc.assert(
      fc.property(activeTaskArb(0), epochArb, (task, now) => {
        const s = elapsedSeconds(task, now);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        if (now >= task.startedAt) expect(s).toBe(Math.floor((now - task.startedAt) / 1000));
      }),
    );
  });

  it('formatDuration round-trips back to the same number of seconds', () => {
    fc.assert(
      fc.property(fc.nat(100 * 3600), (seconds) => {
        const text = formatDuration(seconds);
        expect(text).toMatch(seconds >= 3600 ? /^\d+:[0-5]\d:[0-5]\d$/ : /^[0-5]\d:[0-5]\d$/);
        const parsed = text.split(':').map(Number).reduce((acc, part) => acc * 60 + part, 0);
        expect(parsed).toBe(seconds);
      }),
    );
  });
});
