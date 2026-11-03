// Issue #17: stopped task -> ActivityWatch -> Claude -> metrics -> CompletedTask.
import { notImplemented } from '../shared/notImplemented';
import type { ActiveTask, CompletedTask } from '../shared/types';
import type { ActivityWatchClient } from './activitywatch/client';
import type { ClassifierModel } from './classifier/classify';

export interface PipelineDeps {
  activityWatch: ActivityWatchClient;
  classifier: ClassifierModel;
}

export async function processCompletedTask(
  deps: PipelineDeps,
  task: ActiveTask,
  endedAt: number,
): Promise<CompletedTask> {
  return notImplemented(`processCompletedTask(${typeof deps}, ${task.id}, ${endedAt})`);
}
