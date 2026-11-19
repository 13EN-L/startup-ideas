// Issue #18: invariants of growth, prestige wrapping, trophies and plot layout
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addProductiveMinutes,
  animatedMinutes,
  applyCompletedTask,
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  growthAnimationDuration,
  plantScale,
  plotRows,
  visiblePlots,
} from '../../src/core/growth';
import {
  GROWTH_ANIMATION_MAX_MS,
  GROWTH_STAGES,
  MID_STAGE_MAX_SCALE,
  MINUTES_PER_CYCLE,
  MINUTES_PER_STAGE,
  PLOTS_PER_ROW,
} from '../../src/shared/constants';
import { categoryArb, categoryIds, completedTaskArb, minutesArb, plantsArb } from './arbitraries';

const EPS = 1e-9;

describe('#18 getPlantGrowth properties', () => {
  it('always yields a whole stage 1-6, progress in [0, 1] and a whole prestige >= 0', () => {
    fc.assert(
      fc.property(minutesArb, (minutes) => {
        const g = getPlantGrowth(minutes);
        expect(Number.isInteger(g.stage)).toBe(true);
        expect(g.stage).toBeGreaterThanOrEqual(1);
        expect(g.stage).toBeLessThanOrEqual(GROWTH_STAGES);
        expect(g.stageProgress).toBeGreaterThanOrEqual(0);
        expect(g.stageProgress).toBeLessThanOrEqual(1);
        expect(g.cycleProgress).toBeGreaterThanOrEqual(0);
        expect(g.cycleProgress).toBeLessThanOrEqual(1);
        expect(Number.isInteger(g.prestige)).toBe(true);
        expect(g.prestige).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('loses no minutes: prestige cycles + stage + stage progress add back up to the total', () => {
    fc.assert(
      fc.property(minutesArb, (minutes) => {
        const g = getPlantGrowth(minutes);
        const inCycle = (g.stage - 1) * MINUTES_PER_STAGE + g.stageProgress * MINUTES_PER_STAGE;
        expect(inCycle).toBeCloseTo(g.cycleProgress * MINUTES_PER_CYCLE, 6);
        expect(g.prestige * MINUTES_PER_CYCLE + inCycle).toBeCloseTo(minutes, 6);
      }),
    );
  });

  it('never moves backwards as minutes increase', () => {
    fc.assert(
      fc.property(minutesArb, minutesArb, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const gLo = getPlantGrowth(lo);
        const gHi = getPlantGrowth(hi);
        const position = (g: typeof gLo) => g.prestige + g.cycleProgress;
        expect(position(gHi)).toBeGreaterThanOrEqual(position(gLo) - EPS);
      }),
    );
  });

  it('adds exactly one prestige for each full cycle of extra minutes', () => {
    fc.assert(
      fc.property(minutesArb, fc.integer({ min: 1, max: 20 }), (minutes, cycles) => {
        // 0 is the one exception: 0 + 36 is a full-grown plant at prestige 0, not a wrap.
        fc.pre(minutes > 0);
        const before = getPlantGrowth(minutes);
        const after = getPlantGrowth(minutes + cycles * MINUTES_PER_CYCLE);
        expect(after.prestige - before.prestige).toBe(cycles);
        expect(after.stage).toBe(before.stage);
        expect(after.stageProgress).toBeCloseTo(before.stageProgress, 9);
      }),
    );
  });
});

describe('#18 addProductiveMinutes properties', () => {
  it('is additive: growing by a then b equals growing by a + b', () => {
    fc.assert(
      fc.property(categoryArb, minutesArb, minutesArb, minutesArb, (category, start, a, b) => {
        const plant = { category, totalMinutes: start };
        const stepwise = addProductiveMinutes(addProductiveMinutes(plant, a), b);
        const atOnce = addProductiveMinutes(plant, a + b);
        expect(stepwise).toEqual(atOnce);
        expect(stepwise.totalMinutes).toBe(start + a + b);
      }),
    );
  });

  it('rejects every negative amount', () => {
    fc.assert(
      fc.property(categoryArb, fc.double({ max: -Number.MIN_VALUE, noNaN: true }), (category, minutes) => {
        expect(() => addProductiveMinutes({ category, totalMinutes: 0 }, minutes)).toThrow(RangeError);
      }),
    );
  });
});

describe('#18 applyCompletedTask properties', () => {
  it('grows only the task category, by its productive minutes, and always shows its plot', () => {
    fc.assert(
      fc.property(plantsArb, completedTaskArb, (plants, task) => {
        const after = applyCompletedTask(plants, task);
        const before = plants[task.category]?.totalMinutes ?? 0;
        expect(after[task.category]?.totalMinutes).toBeCloseTo(before + task.metrics.productiveSeconds / 60, 9);
        expect(visiblePlots(after)).toContain(task.category);
        for (const id of categoryIds) {
          if (id !== task.category) expect(after[id]).toEqual(plants[id]);
        }
      }),
    );
  });

  it('never lowers global prestige', () => {
    fc.assert(
      fc.property(plantsArb, completedTaskArb, (plants, task) => {
        expect(globalPrestige(applyCompletedTask(plants, task))).toBeGreaterThanOrEqual(globalPrestige(plants));
      }),
    );
  });
});

describe('#18 plantScale properties', () => {
  it('stays between 1 and the maximum scale', () => {
    fc.assert(
      fc.property(minutesArb, (minutes) => {
        const scale = plantScale(getPlantGrowth(minutes));
        expect(scale).toBeGreaterThanOrEqual(1);
        expect(scale).toBeLessThanOrEqual(MID_STAGE_MAX_SCALE + EPS);
      }),
    );
  });

  it('grows with progress inside a stage', () => {
    fc.assert(
      fc.property(fc.nat(GROWTH_STAGES - 1), fc.nat(23), fc.nat(23), (stageIndex, q1, q2) => {
        const base = stageIndex * MINUTES_PER_STAGE;
        const [lo, hi] = q1 <= q2 ? [q1, q2] : [q2, q1];
        const sLo = plantScale(getPlantGrowth(base + lo / 4));
        const sHi = plantScale(getPlantGrowth(base + hi / 4));
        expect(sHi).toBeGreaterThanOrEqual(sLo);
      }),
    );
  });
});

describe('#18 prestige and trophy properties', () => {
  it('global prestige is the sum of each plant prestige', () => {
    fc.assert(
      fc.property(plantsArb, (plants) => {
        const sum = Object.values(plants).reduce((acc, p) => acc + getPlantGrowth(p!.totalMinutes).prestige, 0);
        expect(globalPrestige(plants)).toBe(sum);
      }),
    );
  });

  it('trophies are always bronze, then silver, then gold, earned in order', () => {
    fc.assert(
      fc.property(fc.nat(10_000), (prestige) => {
        const trophies = earnedTrophies(prestige);
        expect(trophies).toEqual(['bronze', 'silver', 'gold'].slice(0, trophies.length));
      }),
    );
  });

  it('more prestige never takes a trophy away', () => {
    fc.assert(
      fc.property(fc.nat(10_000), fc.nat(10_000), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(earnedTrophies(hi).length).toBeGreaterThanOrEqual(earnedTrophies(lo).length);
      }),
    );
  });
});

describe('#18 plot layout properties', () => {
  it('visible plots are exactly the planted categories, in category order', () => {
    fc.assert(
      fc.property(plantsArb, (plants) => {
        const visible = visiblePlots(plants);
        expect(new Set(visible)).toEqual(new Set(Object.keys(plants)));
        expect(visible).toEqual(categoryIds.filter((id) => visible.includes(id)));
      }),
    );
  });

  it('rows keep every plot in order, with at most 5 on top and the rest below', () => {
    fc.assert(
      fc.property(fc.subarray(categoryIds), (plots) => {
        const rows = plotRows(plots);
        expect(rows.flat()).toEqual(plots);
        expect(rows.length).toBe(Math.ceil(plots.length / PLOTS_PER_ROW));
        for (const row of rows) {
          expect(row.length).toBeGreaterThan(0);
          expect(row.length).toBeLessThanOrEqual(PLOTS_PER_ROW);
        }
      }),
    );
  });
});

describe('Garden growth replay (property)', () => {
  it('stays between the viewed and current totals, never shrinks, and ends on the current total', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (viewed, gained, f1, f2) => {
          const to = viewed + gained;
          const duration = growthAnimationDuration(viewed, to);
          const [a, b] = [f1, f2].sort((x, y) => x - y).map((f) => animatedMinutes(viewed, to, f * duration));
          expect(a).toBeGreaterThanOrEqual(viewed);
          expect(b).toBeLessThanOrEqual(to);
          expect(b).toBeGreaterThanOrEqual(a);
          expect(animatedMinutes(viewed, to, duration)).toBe(to);
          expect(duration).toBeLessThanOrEqual(GROWTH_ANIMATION_MAX_MS);
        },
      ),
    );
  });
});
