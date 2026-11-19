// Issue #20: persistence never loses or invents state; recent clouds and breakdown invariants
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  breakdown,
  deserializeState,
  recentTasks,
  resolveLaunchRoute,
  serializeState,
} from '../../src/core/persistence';
import { MAX_ACTIVE_TASKS, RECENT_TASK_COUNT } from '../../src/shared/constants';
import { appStateArb, completedTaskArb, metricsArb } from './arbitraries';

describe('#20 serialize / deserialize properties', () => {
  it('round-trips every valid state exactly', () => {
    fc.assert(
      fc.property(appStateArb, (state) => {
        expect(deserializeState(serializeState(state))).toEqual(state);
      }),
    );
  });

  it('never throws and always returns a usable state for arbitrary text', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), fc.constant(null)), (raw) => {
        const state = deserializeState(raw);
        expect(state.version).toBe(1);
        expect(['main', 'task', 'garden']).toContain(state.route);
        expect(Array.isArray(state.activeTasks)).toBe(true);
        expect(state.activeTasks.length).toBeLessThanOrEqual(MAX_ACTIVE_TASKS);
        expect(Array.isArray(state.completedTasks)).toBe(true);
      }),
    );
  });

  it('survives a corrupted copy of a real save without throwing', () => {
    fc.assert(
      fc.property(appStateArb, fc.nat(), fc.nat(), (state, cutA, cutB) => {
        const text = serializeState(state);
        const truncated = text.slice(0, cutA % (text.length + 1));
        const spliced = text.slice(0, cutB % (text.length + 1)) + '"' + text.slice(cutB % (text.length + 1));
        expect(() => deserializeState(truncated)).not.toThrow();
        expect(() => deserializeState(spliced)).not.toThrow();
      }),
    );
  });
});

describe('#20 resolveLaunchRoute properties', () => {
  it('lands on the Task page whenever a task is active, else on the saved page', () => {
    fc.assert(
      fc.property(appStateArb, (state) => {
        expect(resolveLaunchRoute(state)).toBe(state.activeTasks.length > 0 ? 'task' : state.route);
      }),
    );
  });
});

describe('#20 recentTasks properties', () => {
  it('returns the newest min(5, n) tasks, newest first, all from the input', () => {
    fc.assert(
      fc.property(fc.array(completedTaskArb, { maxLength: 15 }), (tasks) => {
        const recent = recentTasks(tasks);
        expect(recent).toHaveLength(Math.min(RECENT_TASK_COUNT, tasks.length));
        for (const t of recent) expect(tasks).toContain(t);
        for (let i = 1; i < recent.length; i++) {
          expect(recent[i - 1].endedAt).toBeGreaterThanOrEqual(recent[i].endedAt);
        }
        const oldestShown = recent.at(-1)?.endedAt ?? -Infinity;
        for (const t of tasks) {
          if (!recent.includes(t)) expect(t.endedAt).toBeLessThanOrEqual(oldestShown);
        }
      }),
    );
  });

  it('does not reorder or modify the stored history', () => {
    fc.assert(
      fc.property(fc.array(completedTaskArb, { maxLength: 15 }), (tasks) => {
        const copy = structuredClone(tasks);
        recentTasks(tasks);
        expect(tasks).toEqual(copy);
      }),
    );
  });
});

describe('#20 breakdown properties', () => {
  it('gives whole percentages summing to 100, each within 1 of the exact share', () => {
    fc.assert(
      fc.property(metricsArb, (m) => {
        const total = m.productiveSeconds + m.unproductiveSeconds + m.idleSeconds;
        const b = breakdown(m);
        if (total === 0) {
          expect(b).toEqual({ onTask: 0, offTask: 0, idle: 0 });
          return;
        }
        expect(b.onTask + b.offTask + b.idle).toBe(100);
        const pairs: [number, number][] = [
          [b.onTask, m.productiveSeconds],
          [b.offTask, m.unproductiveSeconds],
          [b.idle, m.idleSeconds],
        ];
        for (const [pct, seconds] of pairs) {
          expect(Number.isInteger(pct)).toBe(true);
          expect(Math.abs(pct - (seconds / total) * 100)).toBeLessThan(1);
        }
      }),
    );
  });

  it('is unchanged when every duration is scaled by the same factor', () => {
    fc.assert(
      fc.property(metricsArb, fc.integer({ min: 2, max: 50 }), (m, k) => {
        const scaled = {
          productiveSeconds: m.productiveSeconds * k,
          unproductiveSeconds: m.unproductiveSeconds * k,
          idleSeconds: m.idleSeconds * k,
        };
        expect(breakdown(scaled)).toEqual(breakdown(m));
      }),
    );
  });
});
