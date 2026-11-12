// Issue #17: gather and aggregate ActivityWatch events for one task session.
//
// Everything is worked out locally on a timeline, before anything reaches
// Claude:
// 1. Idle (AFK) stretches are cut out of app and website time, so the time you
//    were away is only ever counted as idle, never as on- or off-task.
// 2. Time in a browser window is split into the websites and searches seen in
//    it: from the aw-watcher-web extension where it reported, otherwise from
//    the browser window's page title. The browser itself is not listed, so
//    nothing is counted twice.
// 3. Time with FocusGarden itself in front, or on an empty browser new tab,
//    counts as idle: it is never listed as an activity, so it is never sent
//    to Claude.
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
import {
  activityFromPageTitle,
  activityFromUrl,
  isBrowserApp,
  isNewTabPage,
  isNewTabWindowTitle,
  type NamedActivity,
} from './web';

/** Credit time to an activity, or to IDLE for time that is counted as idle and never classified. */
const IDLE = 'idle' as const;
type Credit = NamedActivity | typeof IDLE;

export interface TaskActivity {
  /** Apps by app name, web pages ("hostname — title", or the title alone), and searches; sorted by time spent, descending. */
  activities: ActivityItem[];
  idleSeconds: number;
}

/** [start, end) in epoch milliseconds. */
type Span = [number, number];

/** The part of the event inside the range, or null if there is none. */
function clip(event: AWEvent<unknown>, range: TimeRange): Span | null {
  const start = Date.parse(event.timestamp);
  const end = start + event.duration * 1000;
  const clipped: Span = [Math.max(start, range.start.getTime()), Math.min(end, range.end.getTime())];
  return clipped[1] > clipped[0] ? clipped : null;
}

/** Sorted, non-overlapping spans covering the same time. */
function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: Span[] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** The parts of span not covered by `holes` (which must be merged). */
function subtract(span: Span, holes: Span[]): Span[] {
  const parts: Span[] = [];
  let cursor = span[0];
  for (const [start, end] of holes) {
    if (end <= cursor) continue;
    if (start >= span[1]) break;
    if (start > cursor) parts.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < span[1]) parts.push([cursor, span[1]]);
  return parts;
}

function intersect(a: Span, b: Span): Span | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return end > start ? [start, end] : null;
}

const seconds = (spans: Span[]) => spans.reduce((sum, [start, end]) => sum + (end - start) / 1000, 0);

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

export const isWebBucket = (type: string) => type.startsWith('web.tab');

const APP_TITLE = 'FocusGarden';

/**
 * True for FocusGarden's own window as aw-watcher-window reports it: the
 * installed app ("FocusGarden.exe" on Windows, "FocusGarden" on macOS,
 * "focusgarden" on Linux), or the Electron binary showing the FocusGarden
 * window during development (`npm run dev`).
 */
export function isFocusGardenWindow({ app, title }: WindowData): boolean {
  const name = app.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z]/g, '');
  if (name === 'focusgarden') return true;
  return name === 'electron' && title.trim() === APP_TITLE;
}

/**
 * Reads the window, web and AFK buckets, clips every event to the task's
 * start/end timestamps, removes idle time, and sums time per app, website
 * and search.
 */
export async function collectTaskActivity(
  client: ActivityWatchClient,
  range: TimeRange,
): Promise<TaskActivity> {
  const buckets = await client.getBuckets();
  const [windowEvents, webEvents, afkEvents] = await Promise.all([
    eventsOfType<WindowData>(client, buckets, (t) => t === 'currentwindow', range),
    eventsOfType<WebData>(client, buckets, isWebBucket, range),
    eventsOfType<AfkData>(client, buckets, (t) => t === 'afkstatus', range),
  ]);

  const idle = merge(
    afkEvents
      .filter((e) => e.data.status === 'afk')
      .map((e) => clip(e, range))
      .filter((span): span is Span => span !== null),
  );

  /** Active (non-AFK) time that still counts as idle: FocusGarden itself and empty new tabs. */
  const alsoIdle: Span[] = [];

  const totals = new Map<string, { name: string; source: ActivitySource; seconds: number }>();
  const add = (activity: Credit, spans: Span[]) => {
    if (activity === IDLE) {
      alsoIdle.push(...spans);
      return;
    }
    const time = seconds(spans);
    if (time <= 0) return;
    const id = `${activity.source}:${activity.name}`;
    const entry = totals.get(id) ?? { ...activity, seconds: 0 };
    entry.seconds += time;
    totals.set(id, entry);
  };

  const web = webEvents
    .map((e) => ({
      span: clip(e, range),
      activity: isNewTabPage(e.data.url, e.data.title) ? IDLE : activityFromUrl(e.data.url, e.data.title),
    }))
    .filter((w): w is { span: Span; activity: Credit } => w.span !== null)
    .sort((a, b) => a.span[0] - b.span[0]);

  /** Credits the active (non-idle) part of a browser span to the websites seen in it. */
  const addBrowserTime = (span: Span, fallback: Credit | null) => {
    const claimed: Span[] = [];
    for (const w of web) {
      const overlap = intersect(span, w.span);
      if (!overlap) continue;
      // Two browsers reporting at once must not count the same second twice.
      const fresh = subtract(overlap, merge(claimed));
      add(w.activity, fresh);
      claimed.push(overlap);
    }
    if (fallback) add(fallback, subtract(span, merge(claimed)));
  };

  const hasWindowWatcher = buckets.some((b) => b.type === 'currentwindow');
  if (hasWindowWatcher) {
    for (const event of windowEvents) {
      const span = clip(event, range);
      if (!span) continue;
      for (const active of subtract(span, idle)) {
        if (isFocusGardenWindow(event.data)) {
          add(IDLE, [active]);
        } else if (isBrowserApp(event.data.app)) {
          const title = event.data.title;
          addBrowserTime(active, isNewTabWindowTitle(title) ? IDLE : activityFromPageTitle(title));
        } else {
          add({ name: event.data.app, source: 'app' }, [active]);
        }
      }
    }
  } else {
    // No window watcher (e.g. some Linux desktops): trust the extension alone.
    const session: Span = [range.start.getTime(), range.end.getTime()];
    for (const active of subtract(session, idle)) addBrowserTime(active, null);
  }

  const activities = [...totals]
    .map(([id, { name, source, seconds: time }]) => ({ id, name, source, seconds: Math.round(time) }))
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  return { activities, idleSeconds: Math.round(seconds(merge([...idle, ...alsoIdle]))) };
}
