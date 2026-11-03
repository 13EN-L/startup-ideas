// Issue #17: turn classified activity into productive/unproductive/idle time.
import type { ClassifiedActivity, TaskMetrics } from '../shared/types';

export function computeMetrics(
  activities: ClassifiedActivity[],
  idleSeconds: number,
): TaskMetrics {
  if (!Number.isFinite(idleSeconds) || idleSeconds < 0) {
    throw new RangeError(`Idle seconds must be a finite number >= 0, got ${idleSeconds}`);
  }

  let productiveSeconds = 0;
  let unproductiveSeconds = 0;
  for (const activity of activities) {
    if (activity.status === 'on-task') productiveSeconds += activity.seconds;
    else unproductiveSeconds += activity.seconds;
  }
  return { productiveSeconds, unproductiveSeconds, idleSeconds };
}

/** Productive minutes that feed plant growth. */
export function productiveMinutes(metrics: TaskMetrics): number {
  return metrics.productiveSeconds / 60;
}
