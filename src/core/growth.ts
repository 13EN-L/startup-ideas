// Issue #18: plant growth, prestige wrapping, trophies and plot layout.
import {
  CATEGORIES,
  GROWTH_ANIMATION_MAX_MS,
  GROWTH_ANIMATION_MS_PER_MINUTE,
  GROWTH_STAGES,
  MID_STAGE_MAX_SCALE,
  MINUTES_PER_CYCLE,
  MINUTES_PER_STAGE,
  PLOTS_PER_ROW,
  TROPHY_THRESHOLDS,
} from '../shared/constants';
import type {
  CategoryId,
  CompletedTask,
  PlantGrowth,
  PlantState,
  Trophy,
} from '../shared/types';
import { productiveMinutes } from './metrics';

export type Plants = Partial<Record<CategoryId, PlantState>>;

/**
 * Derive stage, progress and prestige from accumulated productive minutes.
 * Exactly 36 minutes is a full-grown plant at prestige 0; only minutes beyond
 * 100% wrap back to stage 1 and add a prestige.
 */
export function getPlantGrowth(totalMinutes: number): PlantGrowth {
  if (!(totalMinutes > 0)) {
    return { stage: 1, stageProgress: 0, cycleProgress: 0, prestige: 0 };
  }

  const prestige = Math.ceil(totalMinutes / MINUTES_PER_CYCLE) - 1;
  const inCycle = totalMinutes - prestige * MINUTES_PER_CYCLE; // (0, 36]
  if (inCycle >= MINUTES_PER_CYCLE) {
    return { stage: GROWTH_STAGES, stageProgress: 1, cycleProgress: 1, prestige };
  }

  const stageIndex = Math.floor(inCycle / MINUTES_PER_STAGE);
  return {
    stage: stageIndex + 1,
    stageProgress: (inCycle - stageIndex * MINUTES_PER_STAGE) / MINUTES_PER_STAGE,
    cycleProgress: inCycle / MINUTES_PER_CYCLE,
    prestige,
  };
}

/** Throws RangeError for negative or non-finite minutes. */
export function addProductiveMinutes(plant: PlantState, minutes: number): PlantState {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Productive minutes must be a finite number >= 0, got ${minutes}`);
  }
  return { ...plant, totalMinutes: plant.totalMinutes + minutes };
}

/**
 * Grows the plant for the task's category, creating its plot if it is the
 * first task. The growth stays unviewed until the Garden page shows it.
 */
export function applyCompletedTask(plants: Plants, task: CompletedTask): Plants {
  const plant = plants[task.category] ?? { category: task.category, totalMinutes: 0 };
  const viewed = { ...plant, viewedMinutes: viewedMinutes(plant) };
  return {
    ...plants,
    [task.category]: addProductiveMinutes(viewed, productiveMinutes(task.metrics)),
  };
}

/** The growth the Garden last showed for this plant. */
export function viewedMinutes(plant: PlantState): number {
  return plant.viewedMinutes ?? plant.totalMinutes;
}

/** Marks every plant as seen at its current growth (the same object if nothing changed). */
export function markPlantsViewed(plants: Plants): Plants {
  const entries = Object.entries(plants) as [CategoryId, PlantState][];
  if (entries.every(([, plant]) => viewedMinutes(plant) === plant.totalMinutes)) return plants;
  return Object.fromEntries(
    entries.map(([category, plant]) => [category, { ...plant, viewedMinutes: plant.totalMinutes }]),
  );
}

/** How long the Garden takes to replay growth from one total to another. */
export function growthAnimationDuration(fromMinutes: number, toMinutes: number): number {
  return Math.min(Math.abs(toMinutes - fromMinutes) * GROWTH_ANIMATION_MS_PER_MINUTE, GROWTH_ANIMATION_MAX_MS);
}

/**
 * The total minutes to draw `elapsedMs` into a growth replay. Minutes advance
 * evenly, so each stage scales up, swaps to the next stage image, and after
 * stage 6 wraps to stage 1 with one more prestige, as getPlantGrowth does.
 */
export function animatedMinutes(fromMinutes: number, toMinutes: number, elapsedMs: number): number {
  const duration = growthAnimationDuration(fromMinutes, toMinutes);
  if (duration <= 0 || elapsedMs >= duration) return toMinutes;
  if (elapsedMs <= 0) return fromMinutes;
  return fromMinutes + (toMinutes - fromMinutes) * (elapsedMs / duration);
}

/** 1.0 at the start of a stage, up to MID_STAGE_MAX_SCALE at the end of it. */
export function plantScale(growth: PlantGrowth): number {
  return 1 + (MID_STAGE_MAX_SCALE - 1) * growth.stageProgress;
}

export function globalPrestige(plants: Plants): number {
  return Object.values(plants).reduce(
    (sum, plant) => sum + (plant ? getPlantGrowth(plant.totalMinutes).prestige : 0),
    0,
  );
}

const TROPHY_ORDER: Trophy[] = ['bronze', 'silver', 'gold'];

/** Every trophy earned so far, lowest first. */
export function earnedTrophies(totalPrestige: number): Trophy[] {
  return TROPHY_ORDER.filter((trophy) => totalPrestige >= TROPHY_THRESHOLDS[trophy]);
}

/** Categories with a plot, in design-token category order. */
export function visiblePlots(plants: Plants): CategoryId[] {
  return CATEGORIES.map((c) => c.id).filter((id) => plants[id] !== undefined);
}

/** Up to 5 plots in one row; plots 6-10 go in a second row. */
export function plotRows(categories: CategoryId[]): CategoryId[][] {
  const rows: CategoryId[][] = [];
  for (let i = 0; i < categories.length; i += PLOTS_PER_ROW) {
    rows.push(categories.slice(i, i + PLOTS_PER_ROW));
  }
  return rows;
}
