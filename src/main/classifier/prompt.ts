// Issue #17: bundle a task's activity log into a classification prompt.
import { notImplemented } from '../../shared/notImplemented';
import type { ActivityItem, CategoryId } from '../../shared/types';

export interface ClassificationTask {
  name: string;
  category: CategoryId;
}

export interface ClassificationPrompt {
  system: string;
  /** First user turn: the task plus every activity with its id. */
  user: string;
}

export function buildClassificationPrompt(
  task: ClassificationTask,
  activities: ActivityItem[],
): ClassificationPrompt {
  return notImplemented(`buildClassificationPrompt(${task.name}, ${activities.length})`);
}

/** Follow-up user turn that feeds validation errors back to Claude. */
export function buildCorrectionMessage(errors: string[]): string {
  return notImplemented(`buildCorrectionMessage(${errors.length})`);
}
