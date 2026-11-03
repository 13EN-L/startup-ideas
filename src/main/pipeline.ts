// Issue #17: stopped task -> ActivityWatch -> Claude -> metrics -> CompletedTask.
import { computeMetrics } from '../core/metrics';
import type { ActiveTask, CompletedTask } from '../shared/types';
import type { ActivityWatchClient } from './activitywatch/client';
import { collectTaskActivity } from './activitywatch/collect';
import { classifyActivities, type ClassifierModel } from './classifier/classify';

export interface PipelineDeps {
  activityWatch: ActivityWatchClient;
  classifier: ClassifierModel;
}

export async function processCompletedTask(
  deps: PipelineDeps,
  task: ActiveTask,
  endedAt: number,
): Promise<CompletedTask> {
  const { activities, idleSeconds } = await collectTaskActivity(deps.activityWatch, {
    start: new Date(task.startedAt),
    end: new Date(endedAt),
  });
  const classified = await classifyActivities(deps.classifier, task, activities);

  return {
    id: task.id,
    name: task.name,
    category: task.category,
    startedAt: task.startedAt,
    endedAt,
    metrics: computeMetrics(classified, idleSeconds),
    activities: classified,
  };
}
