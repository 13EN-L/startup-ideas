// Issue #18: Build Plant Growth Mechanics and Global Prestige/Trophy System
import { describe, expect, it } from 'vitest';
import {
  addProductiveMinutes,
  applyCompletedTask,
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  plantScale,
  plotRows,
  visiblePlots,
  type Plants,
} from '../../src/core/growth';
import { CATEGORIES, MID_STAGE_MAX_SCALE } from '../../src/shared/constants';
import type { CategoryId } from '../../src/shared/types';
import { makeCompletedTask } from '../fixtures';

describe('#18 category to plant mapping', () => {
  it.each([
    ['work', 'pine'],
    ['school', 'tomato'],
    ['health', 'apple'],
    ['finance', 'lilac'],
    ['home', 'corn'],
    ['relationships', 'sunflower'],
    ['personal-growth', 'carrot'],
    ['creative', 'basil'],
    ['career', 'succulent'],
    ['self-care', 'monkeygrass'],
  ])('%s grows a %s', (category, plant) => {
    expect(CATEGORIES.find((c) => c.id === category)?.plant).toBe(plant);
  });

  it('has exactly 10 categories with unique plants', () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(new Set(CATEGORIES.map((c) => c.plant)).size).toBe(10);
  });
});

describe('#18 getPlantGrowth: 6 stages x 6 minutes', () => {
  it('starts a new plant at stage 1 with no progress', () => {
    expect(getPlantGrowth(0)).toEqual({ stage: 1, stageProgress: 0, cycleProgress: 0, prestige: 0 });
  });

  it.each([
    [5.99, 1],
    [6, 2],
    [12, 3],
    [18, 4],
    [24, 5],
    [30, 6],
    [35.9, 6],
  ])('%d minutes is stage %d', (minutes, stage) => {
    expect(getPlantGrowth(minutes).stage).toBe(stage);
  });

  it('reports fractional progress through a stage', () => {
    const growth = getPlantGrowth(9); // halfway through stage 2
    expect(growth.stage).toBe(2);
    expect(growth.stageProgress).toBeCloseTo(0.5);
    expect(growth.cycleProgress).toBeCloseTo(0.25);
  });

  it('treats exactly 36 minutes as fully grown, without prestige yet', () => {
    expect(getPlantGrowth(36)).toEqual({ stage: 6, stageProgress: 1, cycleProgress: 1, prestige: 0 });
  });
});

describe('#18 prestige wrapping', () => {
  it('wraps excess minutes back to stage 1 and increments prestige', () => {
    const growth = getPlantGrowth(37);
    expect(growth.prestige).toBe(1);
    expect(growth.stage).toBe(1);
    expect(growth.stageProgress).toBeCloseTo(1 / 6);
  });

  it('carries the remainder into the new cycle', () => {
    // 36 + 20 = stage 4, 2 minutes in
    const growth = getPlantGrowth(56);
    expect(growth).toMatchObject({ prestige: 1, stage: 4 });
    expect(growth.stageProgress).toBeCloseTo(2 / 6);
  });

  it('wraps multiple times for very large sessions', () => {
    expect(getPlantGrowth(36 * 3 + 1)).toMatchObject({ prestige: 3, stage: 1 });
    expect(getPlantGrowth(36 * 3)).toMatchObject({ prestige: 2, stage: 6, cycleProgress: 1 });
  });
});

describe('#18 addProductiveMinutes', () => {
  it('accumulates minutes without mutating the input', () => {
    const plant = { category: 'work' as const, totalMinutes: 30 };
    const grown = addProductiveMinutes(plant, 10);
    expect(grown).toEqual({ category: 'work', totalMinutes: 40 });
    expect(plant.totalMinutes).toBe(30);
    expect(getPlantGrowth(grown.totalMinutes)).toMatchObject({ prestige: 1, stage: 1 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s minutes', (minutes) => {
    expect(() => addProductiveMinutes({ category: 'work', totalMinutes: 0 }, minutes)).toThrow(RangeError);
  });
});

describe('#18 applyCompletedTask: growth happens on task completion', () => {
  it('creates the plot for a first-time category and grows it by productive minutes', () => {
    const task = makeCompletedTask({
      category: 'creative',
      metrics: { productiveSeconds: 15 * 60, unproductiveSeconds: 600, idleSeconds: 300 },
    });
    const plants = applyCompletedTask({}, task);
    expect(plants.creative).toEqual({ category: 'creative', totalMinutes: 15 });
  });

  it('ignores unproductive and idle time', () => {
    const task = makeCompletedTask({
      category: 'work',
      metrics: { productiveSeconds: 0, unproductiveSeconds: 3600, idleSeconds: 3600 },
    });
    expect(applyCompletedTask({}, task).work).toEqual({ category: 'work', totalMinutes: 0 });
  });

  it('adds to an existing plant and leaves other plants untouched', () => {
    const before: Plants = {
      work: { category: 'work', totalMinutes: 30 },
      home: { category: 'home', totalMinutes: 5 },
    };
    const task = makeCompletedTask({
      category: 'work',
      metrics: { productiveSeconds: 12 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    const after = applyCompletedTask(before, task);
    expect(after.work?.totalMinutes).toBe(42);
    expect(after.home).toEqual(before.home);
    expect(before.work?.totalMinutes).toBe(30);
  });
});

describe('#18 plantScale: mid-stage growth', () => {
  it('is 1 at the start of a stage', () => {
    expect(plantScale(getPlantGrowth(12))).toBe(1);
  });

  it('scales up slightly as the stage progresses', () => {
    const mid = plantScale(getPlantGrowth(15));
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(MID_STAGE_MAX_SCALE);
  });

  it('never exceeds the maximum scale', () => {
    expect(plantScale(getPlantGrowth(36))).toBeCloseTo(MID_STAGE_MAX_SCALE);
    expect(plantScale(getPlantGrowth(35.99))).toBeLessThanOrEqual(MID_STAGE_MAX_SCALE);
  });
});

describe('#18 global prestige and trophies', () => {
  it('sums prestige across every plant', () => {
    const plants: Plants = {
      work: { category: 'work', totalMinutes: 36 * 2 + 1 }, // prestige 2
      home: { category: 'home', totalMinutes: 37 }, // prestige 1
      finance: { category: 'finance', totalMinutes: 36 }, // prestige 0
    };
    expect(globalPrestige(plants)).toBe(3);
  });

  it('is 0 for an empty garden', () => {
    expect(globalPrestige({})).toBe(0);
  });

  it.each([
    [0, []],
    [1, ['bronze']],
    [9, ['bronze']],
    [10, ['bronze', 'silver']],
    [11, ['bronze', 'silver']],
    [99, ['bronze', 'silver']],
    [100, ['bronze', 'silver', 'gold']],
    [250, ['bronze', 'silver', 'gold']],
  ])('prestige %d earns %j', (prestige, trophies) => {
    expect(earnedTrophies(prestige)).toEqual(trophies);
  });
});

describe('#18 plot visibility and layout', () => {
  it('only shows plots for categories that have a completed task, in category order', () => {
    const plants: Plants = {
      'self-care': { category: 'self-care', totalMinutes: 0 },
      work: { category: 'work', totalMinutes: 12 },
    };
    expect(visiblePlots(plants)).toEqual(['work', 'self-care']);
  });

  const ids = CATEGORIES.map((c) => c.id) as CategoryId[];

  it.each([1, 3, 5])('keeps %d plots in a single row', (count) => {
    expect(plotRows(ids.slice(0, count))).toEqual([ids.slice(0, count)]);
  });

  it('puts plots 1-5 in the upper row and 6+ in the lower row', () => {
    expect(plotRows(ids.slice(0, 7))).toEqual([ids.slice(0, 5), ids.slice(5, 7)]);
    expect(plotRows(ids)).toEqual([ids.slice(0, 5), ids.slice(5, 10)]);
  });

  it('returns no rows for an empty garden', () => {
    expect(plotRows([])).toEqual([]);
  });
});
