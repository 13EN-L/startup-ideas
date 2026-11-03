// Issue #17: gather and aggregate ActivityWatch events for one task session.
import type { ActivityItem, ActivitySource } from '../../shared/types';
import type {
  ActivityWatchClient,
  AfkData,
  AWBucket,
  AWEvent,
  TimeRange,
  WebData,
  WindowData,
} from './client';

export interface TaskActivity {
  /** Apps by app name, websites by hostname; sorted by time spent, descending. */
  activities: ActivityItem[];
  idleSeconds: number;
}

/** Seconds of the event that fall inside the range. */
function overlapSeconds(event: AWEvent<unknown>, range: TimeRange): number {
  const start = Date.parse(event.timestamp);
  const end = start + event.duration * 1000;
  const clippedStart = Math.max(start, range.start.getTime());
  const clippedEnd = Math.min(end, range.end.getTime());
  return Math.max(0, (clippedEnd - clippedStart) / 1000);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

async function eventsOfType<TData>(
  client: ActivityWatchClient,
  buckets: AWBucket[],
  matches: (type: string) => boolean,
  range: TimeRange,
): Promise<AWEvent<TData>[]> {
  const lists = await Promise.all(
    buckets.filter((b) => matches(b.type)).map((b) => client.getEvents<TData>(b.id, range)),
  );
  return lists.flat();
}

/**
 * Reads the window, web and AFK buckets, clips every event to the task's
 * start/end timestamps, and sums time per app and per website.
 */
export async function collectTaskActivity(
  client: ActivityWatchClient,
  range: TimeRange,
): Promise<TaskActivity> {
  const buckets = await client.getBuckets();
  const [windowEvents, webEvents, afkEvents] = await Promise.all([
    eventsOfType<WindowData>(client, buckets, (t) => t === 'currentwindow', range),
    eventsOfType<WebData>(client, buckets, (t) => t.startsWith('web.tab'), range),
    eventsOfType<AfkData>(client, buckets, (t) => t === 'afkstatus', range),
  ]);

  const totals = new Map<string, { name: string; source: ActivitySource; seconds: number }>();
  const add = (source: ActivitySource, name: string, seconds: number) => {
    if (seconds <= 0) return;
    const id = `${source}:${name}`;
    const entry = totals.get(id) ?? { name, source, seconds: 0 };
    entry.seconds += seconds;
    totals.set(id, entry);
  };

  for (const event of windowEvents) add('app', event.data.app, overlapSeconds(event, range));
  for (const event of webEvents) add('web', hostname(event.data.url), overlapSeconds(event, range));

  const activities = [...totals]
    .map(([id, { name, source, seconds }]) => ({ id, name, source, seconds: Math.round(seconds) }))
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  const idleSeconds = Math.round(
    afkEvents
      .filter((e) => e.data.status === 'afk')
      .reduce((sum, e) => sum + overlapSeconds(e, range), 0),
  );

  return { activities, idleSeconds };
}
