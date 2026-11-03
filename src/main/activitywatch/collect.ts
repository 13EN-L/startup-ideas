// Issue #17: gather and aggregate ActivityWatch events for one task session.
import { notImplemented } from '../../shared/notImplemented';
import type { ActivityItem } from '../../shared/types';
import type { ActivityWatchClient, TimeRange } from './client';

export interface TaskActivity {
  /** Apps by app name, websites by hostname; sorted by time spent, descending. */
  activities: ActivityItem[];
  idleSeconds: number;
}

/**
 * Reads the window, web and AFK buckets, clips every event to the task's
 * start/end timestamps, and sums time per app and per website.
 */
export async function collectTaskActivity(
  client: ActivityWatchClient,
  range: TimeRange,
): Promise<TaskActivity> {
  return notImplemented(`collectTaskActivity(${client.baseUrl}, ${range.start.toISOString()})`);
}
