// Issue #19: task lifecycle, animal pen slots and the 3-task limit.
import { ANIMALS, COLORS, MAX_ACTIVE_TASKS } from '../shared/constants';
import type {
  ActiveTask,
  AnimalId,
  AppState,
  Category,
  CategoryId,
  CompletedTask,
  PenSlot,
} from '../shared/types';
import { applyCompletedTask } from './growth';

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

const PEN_SLOTS: PenSlot[] = [0, 1, 2];

export function canStartTask(activeTasks: ActiveTask[]): boolean {
  return activeTasks.length < MAX_ACTIVE_TASKS;
}

export function pickAnimal(random: () => number): AnimalId {
  const index = Math.min(Math.floor(random() * ANIMALS.length), ANIMALS.length - 1);
  return ANIMALS[index];
}

/** Trims the name, assigns a random animal and the lowest free pen slot. */
export function startTask(state: AppState, input: StartTaskInput, deps: TaskDeps): AppState {
  const name = input.name.trim();
  if (!name) {
    throw new TaskError('empty-name', 'Enter a task name.');
  }
  const category = state.categories.find((c) => c.id === input.category);
  if (!category) {
    throw new TaskError('unknown-category', `Unknown category: ${input.category}`);
  }
  const slot = PEN_SLOTS.find((s) => !state.activeTasks.some((t) => t.slot === s));
  if (!canStartTask(state.activeTasks) || slot === undefined) {
    throw new TaskError('limit-reached', `At most ${MAX_ACTIVE_TASKS} tasks can be active.`);
  }

  const task: ActiveTask = {
    id: deps.createId(),
    name,
    category: category.id,
    categoryLabel: category.label,
    plant: category.plant,
    animal: pickAnimal(deps.random),
    slot,
    startedAt: deps.now,
  };
  return { ...state, activeTasks: [...state.activeTasks, task] };
}

/** Removes the task from the pen and returns it so the pipeline can process it. */
export function stopTask(
  state: AppState,
  taskId: string,
): { state: AppState; stopped: ActiveTask } {
  const stopped = state.activeTasks.find((t) => t.id === taskId);
  if (!stopped) {
    throw new TaskError('not-found', `No active task with id ${taskId}`);
  }
  return {
    state: { ...state, activeTasks: state.activeTasks.filter((t) => t.id !== taskId) },
    stopped,
  };
}

/**
 * Fixes which plant a finished task grows: whatever its category maps to right
 * now. If the category was removed while the task ran, it keeps the plant and
 * name it had when the task started (already on the task).
 */
export function resolveTaskCategory(categories: Category[], task: CompletedTask): CompletedTask {
  const category = categories.find((c) => c.id === task.category);
  return category ? { ...task, categoryLabel: category.label, plant: category.plant } : task;
}

/**
 * Records the processed task and grows the plant its category maps to now.
 * Plants only ever grow from tasks as they complete, never retroactively.
 */
export function completeTask(state: AppState, task: CompletedTask): AppState {
  const resolved = resolveTaskCategory(state.categories, task);
  return {
    ...state,
    completedTasks: [...state.completedTasks, resolved],
    plants: applyCompletedTask(state.plants, resolved),
  };
}

/** The category's current name if it still exists, else the name the task was saved with. */
export function taskCategoryLabel(task: CompletedTask, categories: Category[]): string {
  return categories.find((c) => c.id === task.category)?.label ?? task.categoryLabel;
}

export function elapsedSeconds(task: ActiveTask, now: number): number {
  return Math.max(0, Math.floor((now - task.startedAt) / 1000));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "H:MM:SS" for an hour or more, otherwise "MM:SS". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(secs)}` : `${pad2(minutes)}:${pad2(secs)}`;
}

/** Whole minutes as "45 min" or "2 h 5 min"; "0 min" for under a minute. */
export function formatFocusTime(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

export function homeButtonState(activeTasks: ActiveTask[]): HomeButtonState {
  const disabled = activeTasks.length > 0;
  return disabled
    ? { disabled, signColor: COLORS.darkGrey, postColor: COLORS.lightGrey }
    : { disabled, signColor: COLORS.darkBrown, postColor: COLORS.lightBrown };
}
