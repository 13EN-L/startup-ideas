// Issue #18: Build Plant Growth Mechanics and Global Prestige/Trophy System
import { describe, expect, it } from 'vitest';
import {
  addProductiveMinutes,
  animatedMinutes,
  applyCompletedTask,
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  growthAnimationDuration,
  markPlantsViewed,
  plantScale,
  plotRows,
  visiblePlots,
  viewedMinutes,
  type Plants,
} from '../../src/core/growth';
import {
  DEFAULT_CATEGORIES,
  GROWTH_ANIMATION_MAX_MS,
  GROWTH_ANIMATION_MS_PER_MINUTE,
  MID_STAGE_MAX_SCALE,
  PLANTS,
} from '../../src/shared/constants';
import type { PlantId } from '../../src/shared/types';
import { inCategory, makeCompletedTask } from '../fixtures';

describe('default categories and their plants', () => {
  it.each([
    ['Creative writing', 'basil'],
    ['Professional writing', 'lilac'],
    ['Leisure', 'sunflower'],
    ['Programming', 'pine'],
    ['Career development', 'succulent'],
    ['Communication', 'corn'],
    ['Media', 'tomato'],
    ['Geography', 'apple'],
  ])('%s grows a %s', (label, plant) => {
    expect(DEFAULT_CATEGORIES.find((c) => c.label === label)?.plant).toBe(plant);
  });

  it('has exactly the 8 requested categories, in order', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.label)).toEqual([
      'Creative writing',
      'Professional writing',
      'Leisure',
      'Programming',
      'Career development',
      'Communication',
      'Media',
      'Geography',
    ]);
  });

  it('has 10 distinct plants to choose from', () => {
    expect(new Set(PLANTS.map((p) => p.id)).size).toBe(10);
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
    const plant = { plant: 'pine' as const, totalMinutes: 30 };
    const grown = addProductiveMinutes(plant, 10);
    expect(grown).toEqual({ plant: 'pine', totalMinutes: 40 });
    expect(plant.totalMinutes).toBe(30);
    expect(getPlantGrowth(grown.totalMinutes)).toMatchObject({ prestige: 1, stage: 1 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s minutes', (minutes) => {
    expect(() => addProductiveMinutes({ plant: 'pine', totalMinutes: 0 }, minutes)).toThrow(RangeError);
  });
});

describe('#18 applyCompletedTask: growth happens on task completion', () => {
  it('creates the plot for a first-time plant and grows it by productive minutes', () => {
    const task = makeCompletedTask({
      ...inCategory('creative-writing'),
      metrics: { productiveSeconds: 15 * 60, unproductiveSeconds: 600, idleSeconds: 300 },
    });
    const plants = applyCompletedTask({}, task);
    expect(plants.basil).toEqual({ plant: 'basil', totalMinutes: 15, viewedMinutes: 0 });
  });

  it('ignores unproductive and idle time', () => {
    const task = makeCompletedTask({
      ...inCategory('programming'),
      metrics: { productiveSeconds: 0, unproductiveSeconds: 3600, idleSeconds: 3600 },
    });
    expect(applyCompletedTask({}, task).pine).toEqual({ plant: 'pine', totalMinutes: 0, viewedMinutes: 0 });
  });

  it('adds to an existing plant and leaves other plants untouched', () => {
    const before: Plants = {
      pine: { plant: 'pine', totalMinutes: 30 },
      corn: { plant: 'corn', totalMinutes: 5 },
    };
    const task = makeCompletedTask({
      ...inCategory('programming'),
      metrics: { productiveSeconds: 12 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    const after = applyCompletedTask(before, task);
    expect(after.pine?.totalMinutes).toBe(42);
    expect(after.corn).toEqual(before.corn);
    expect(before.pine?.totalMinutes).toBe(30);
  });

  it('grows the plant stored on the task, whatever its category is called', () => {
    const task = makeCompletedTask({
      category: 'my-own',
      categoryLabel: 'My own',
      plant: 'carrot',
      metrics: { productiveSeconds: 6 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    expect(applyCompletedTask({}, task)).toEqual({ carrot: { plant: 'carrot', totalMinutes: 6, viewedMinutes: 0 } });
  });

  it('grows nothing (and creates no plot) for a task whose category has no plant', () => {
    const before: Plants = { pine: { plant: 'pine', totalMinutes: 3 } };
    const task = makeCompletedTask({ plant: null, metrics: { productiveSeconds: 600, unproductiveSeconds: 0, idleSeconds: 0 } });
    expect(applyCompletedTask(before, task)).toBe(before);
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
      pine: { plant: 'pine', totalMinutes: 36 * 2 + 1 }, // prestige 2
      corn: { plant: 'corn', totalMinutes: 37 }, // prestige 1
      lilac: { plant: 'lilac', totalMinutes: 36 }, // prestige 0
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
  it('only shows plots for plants that have grown from a task, in plant order', () => {
    const plants: Plants = {
      monkeygrass: { plant: 'monkeygrass', totalMinutes: 0 },
      pine: { plant: 'pine', totalMinutes: 12 },
    };
    expect(visiblePlots(plants)).toEqual(['pine', 'monkeygrass']);
  });

  const ids = PLANTS.map((p) => p.id) as PlantId[];

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

describe('Garden growth replay: viewed growth', () => {
  it('treats a plant without viewedMinutes (older saves) as already seen', () => {
    expect(viewedMinutes({ plant: 'pine', totalMinutes: 40 })).toBe(40);
    expect(viewedMinutes({ plant: 'pine', totalMinutes: 40, viewedMinutes: 4 })).toBe(4);
  });

  it('leaves the growth from a completed task unviewed', () => {
    const before: Plants = { pine: { plant: 'pine', totalMinutes: 10, viewedMinutes: 10 } };
    const task = makeCompletedTask({
      ...inCategory('programming'),
      metrics: { productiveSeconds: 40 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    expect(applyCompletedTask(before, task).pine).toEqual({ plant: 'pine', totalMinutes: 50, viewedMinutes: 10 });
  });

  it('keeps unviewed growth from earlier tasks when another finishes', () => {
    const before: Plants = { pine: { plant: 'pine', totalMinutes: 30, viewedMinutes: 10 } };
    const task = makeCompletedTask({
      ...inCategory('programming'),
      metrics: { productiveSeconds: 5 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    expect(applyCompletedTask(before, task).pine?.viewedMinutes).toBe(10);
  });

  it('starts unviewed growth from what an older save already showed', () => {
    const task = makeCompletedTask({
      ...inCategory('programming'),
      metrics: { productiveSeconds: 5 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    expect(applyCompletedTask({ pine: { plant: 'pine', totalMinutes: 30 } }, task).pine).toEqual({
      plant: 'pine',
      totalMinutes: 35,
      viewedMinutes: 30,
    });
  });

  it('marks every plant viewed at its current growth', () => {
    const plants: Plants = {
      pine: { plant: 'pine', totalMinutes: 50, viewedMinutes: 10 },
      corn: { plant: 'corn', totalMinutes: 5 },
    };
    expect(markPlantsViewed(plants)).toEqual({
      pine: { plant: 'pine', totalMinutes: 50, viewedMinutes: 50 },
      corn: { plant: 'corn', totalMinutes: 5, viewedMinutes: 5 },
    });
  });

  it('returns the same object when nothing is unviewed', () => {
    const plants: Plants = { pine: { plant: 'pine', totalMinutes: 5, viewedMinutes: 5 }, corn: { plant: 'corn', totalMinutes: 1 } };
    expect(markPlantsViewed(plants)).toBe(plants);
  });
});

describe('Garden growth replay: timing', () => {
  it('plays each minute at a fixed rate', () => {
    expect(growthAnimationDuration(0, 6)).toBe(6 * GROWTH_ANIMATION_MS_PER_MINUTE);
    expect(growthAnimationDuration(10, 10)).toBe(0);
  });

  it('caps long replays', () => {
    expect(growthAnimationDuration(0, 36 * 50)).toBe(GROWTH_ANIMATION_MAX_MS);
  });

  it('moves evenly from the viewed total to the new total', () => {
    const duration = growthAnimationDuration(0, 40);
    expect(animatedMinutes(0, 40, -100)).toBe(0);
    expect(animatedMinutes(0, 40, 0)).toBe(0);
    expect(animatedMinutes(0, 40, duration / 4)).toBeCloseTo(10);
    expect(animatedMinutes(0, 40, duration)).toBe(40);
    expect(animatedMinutes(0, 40, duration * 2)).toBe(40);
  });

  it('passes through every stage and wraps to stage 1 with one more prestige (the 40-minute carrot)', () => {
    const duration = growthAnimationDuration(0, 40);
    const seen: string[] = [];
    for (let t = 0; t <= duration; t += 5) {
      const g = getPlantGrowth(animatedMinutes(0, 40, t));
      const key = `${g.prestige}:${g.stage}`;
      if (seen.at(-1) !== key) seen.push(key);
    }
    expect(seen).toEqual(['0:1', '0:2', '0:3', '0:4', '0:5', '0:6', '1:1']);
    const end = getPlantGrowth(animatedMinutes(0, 40, duration));
    expect(end).toMatchObject({ prestige: 1, stage: 1 });
    expect(end.stageProgress).toBeCloseTo(4 / 6);
  });
});
