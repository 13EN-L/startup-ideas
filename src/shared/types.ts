import type { ANIMALS, PLANTS } from './constants';

/** Stable id of a user-editable category; renaming keeps the id. */
export type CategoryId = string;
export type PlantId = (typeof PLANTS)[number]['id'];
export type AnimalId = (typeof ANIMALS)[number];

export interface Category {
  id: CategoryId;
  /** 1-20 characters, unique ignoring case. */
  label: string;
  /** The plant this category's tasks grow from now on; null grows nothing. */
  plant: PlantId | null;
}

export type Route = 'main' | 'task' | 'garden' | 'categories';

export type PenSlot = 0 | 1 | 2;

export interface ActiveTask {
  id: string;
  name: string;
  category: CategoryId;
  /** The category's name when the task started (also what Claude is told). */
  categoryLabel: string;
  /**
   * The category's plant when the task started. Only used if the category is
   * removed before the task finishes; otherwise the category's plant at
   * completion is grown.
   */
  plant: PlantId | null;
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
  /** The category's name when the task finished, shown if it is later removed. */
  categoryLabel: string;
  /**
   * The plant this task grew, fixed when it completed. Remapping its category
   * later never moves this growth.
   */
  plant: PlantId | null;
  startedAt: number;
  endedAt: number;
  metrics: TaskMetrics;
  activities: ClassifiedActivity[];
}

/** Persisted plant data; everything visual is derived from totalMinutes. */
export interface PlantState {
  plant: PlantId;
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
  /** 2 added editable categories; version 1 saves are migrated on load. */
  version: 2;
  route: Route;
  /** In the order the category dropdown lists them; 1-20 entries. */
  categories: Category[];
  activeTasks: ActiveTask[];
  completedTasks: CompletedTask[];
  plants: Partial<Record<PlantId, PlantState>>;
}
