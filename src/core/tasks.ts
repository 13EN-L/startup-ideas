// Issue #19: task lifecycle, animal pen slots and the 3-task limit.
import { notImplemented } from '../shared/notImplemented';
import type {
  ActiveTask,
  AnimalId,
  AppState,
  CategoryId,
  CompletedTask,
} from '../shared/types';

export class TaskError extends Error {
  constructor(
    readonly code: 'empty-name' | 'unknown-category' | 'limit-reached' | 'not-found',
    message: string,
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

export interface StartTaskInput {
  name: string;
  category: CategoryId;
}

export interface TaskDeps {
  now: number;
  /** Returns a value in [0, 1), like Math.random. */
  random: () => number;
  createId: () => string;
}

export interface HomeButtonState {
  disabled: boolean;
  signColor: string;
  postColor: string;
}

export function canStartTask(activeTasks: ActiveTask[]): boolean {
  return notImplemented(`canStartTask(${activeTasks.length})`);
}

export function pickAnimal(random: () => number): AnimalId {
  return notImplemented(`pickAnimal(${typeof random})`);
}

/** Trims the name, assigns a random animal and the lowest free pen slot. */
export function startTask(state: AppState, input: StartTaskInput, deps: TaskDeps): AppState {
  return notImplemented(`startTask(${input.name}, ${deps.now}, ${state.activeTasks.length})`);
}

/** Removes the task from the pen and returns it so the pipeline can process it. */
export function stopTask(
  state: AppState,
  taskId: string,
): { state: AppState; stopped: ActiveTask } {
  return notImplemented(`stopTask(${taskId}, ${state.activeTasks.length})`);
}

/** Records the processed task and grows the matching plant. */
export function completeTask(state: AppState, task: CompletedTask): AppState {
  return notImplemented(`completeTask(${task.id}, ${state.completedTasks.length})`);
}

export function elapsedSeconds(task: ActiveTask, now: number): number {
  return notImplemented(`elapsedSeconds(${task.id}, ${now})`);
}

/** "H:MM:SS" for an hour or more, otherwise "MM:SS". */
export function formatDuration(seconds: number): string {
  return notImplemented(`formatDuration(${seconds})`);
}

export function homeButtonState(activeTasks: ActiveTask[]): HomeButtonState {
  return notImplemented(`homeButtonState(${activeTasks.length})`);
}
