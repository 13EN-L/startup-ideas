// Issue #17: turn classified activity into productive/unproductive/idle time.
import { notImplemented } from '../shared/notImplemented';
import type { ClassifiedActivity, TaskMetrics } from '../shared/types';

export function computeMetrics(
  activities: ClassifiedActivity[],
  idleSeconds: number,
): TaskMetrics {
  return notImplemented(`computeMetrics(${activities.length}, ${idleSeconds})`);
}

/** Productive minutes that feed plant growth. */
export function productiveMinutes(metrics: TaskMetrics): number {
  return notImplemented(`productiveMinutes(${metrics.productiveSeconds})`);
}
