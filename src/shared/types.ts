import type { ANIMALS, CATEGORIES } from './constants';

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type PlantId = (typeof CATEGORIES)[number]['plant'];
export type AnimalId = (typeof ANIMALS)[number];

export type Route = 'main' | 'task' | 'garden';

export type PenSlot = 0 | 1 | 2;

export interface ActiveTask {
  id: string;
  name: string;
  category: CategoryId;
  animal: AnimalId;
  /** Which third of the pen the animal occupies. */
  slot: PenSlot;
  /** Epoch milliseconds. */
  startedAt: number;
}

export const ACTIVITY_SOURCES = ['app', 'web', 'search'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];
export type ActivityStatus = 'on-task' | 'off-task';

/** One app or website, aggregated over a task session. */
export interface ActivityItem {
  /** Stable key, `${source}:${name}`. */
  id: string;
  name: string;
  source: ActivitySource;
  seconds: number;
}

export interface ClassifiedActivity extends ActivityItem {
  status: ActivityStatus;
}

export interface TaskMetrics {
  productiveSeconds: number;
  unproductiveSeconds: number;
  idleSeconds: number;
}

export interface CompletedTask {
  id: string;
  name: string;
  category: CategoryId;
  startedAt: number;
  endedAt: number;
  metrics: TaskMetrics;
  activities: ClassifiedActivity[];
}

/** Persisted plant data; everything visual is derived from totalMinutes. */
export interface PlantState {
  category: CategoryId;
  totalMinutes: number;
  /**
   * totalMinutes as of the last time the Garden page showed this plant; the
   * Garden animates the growth between the two. Missing (saves from before
   * this existed) means the plant has been seen at its current growth.
   */
  viewedMinutes?: number;
}

export interface PlantGrowth {
  /** 1..6 */
  stage: number;
  /** Progress through the current stage, 0..1. */
  stageProgress: number;
  /** Progress through the current 36-minute cycle, 0..1. */
  cycleProgress: number;
  prestige: number;
}

export type Trophy = 'bronze' | 'silver' | 'gold';

export interface BreakdownPercentages {
  onTask: number;
  offTask: number;
  idle: number;
}

export interface AppState {
  version: 1;
  route: Route;
  activeTasks: ActiveTask[];
  completedTasks: CompletedTask[];
  plants: Partial<Record<CategoryId, PlantState>>;
}
