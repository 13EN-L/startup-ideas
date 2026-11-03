// Issue #18: plant growth, prestige wrapping, trophies and plot layout.
import { notImplemented } from '../shared/notImplemented';
import type {
  CategoryId,
  CompletedTask,
  PlantGrowth,
  PlantState,
  Trophy,
} from '../shared/types';

export type Plants = Partial<Record<CategoryId, PlantState>>;

/**
 * Derive stage, progress and prestige from accumulated productive minutes.
 * Exactly 36 minutes is a full-grown plant at prestige 0; only minutes beyond
 * 100% wrap back to stage 1 and add a prestige.
 */
export function getPlantGrowth(totalMinutes: number): PlantGrowth {
  return notImplemented(`getPlantGrowth(${totalMinutes})`);
}

/** Throws RangeError for negative or non-finite minutes. */
export function addProductiveMinutes(plant: PlantState, minutes: number): PlantState {
  return notImplemented(`addProductiveMinutes(${plant.category}, ${minutes})`);
}

/** Grows the plant for the task's category, creating its plot if it is the first task. */
export function applyCompletedTask(plants: Plants, task: CompletedTask): Plants {
  return notImplemented(`applyCompletedTask(${task.id})`);
}

/** 1.0 at the start of a stage, up to MID_STAGE_MAX_SCALE at the end of it. */
export function plantScale(growth: PlantGrowth): number {
  return notImplemented(`plantScale(${growth.stage})`);
}

export function globalPrestige(plants: Plants): number {
  return notImplemented(`globalPrestige(${Object.keys(plants).length})`);
}

/** Every trophy earned so far, lowest first. */
export function earnedTrophies(totalPrestige: number): Trophy[] {
  return notImplemented(`earnedTrophies(${totalPrestige})`);
}

/** Categories with a plot, in design-token category order. */
export function visiblePlots(plants: Plants): CategoryId[] {
  return notImplemented(`visiblePlots(${Object.keys(plants).length})`);
}

/** Up to 5 plots in one row; plots 6-10 go in a second row. */
export function plotRows(categories: CategoryId[]): CategoryId[][] {
  return notImplemented(`plotRows(${categories.length})`);
}
