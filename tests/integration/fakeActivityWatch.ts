import { vi } from 'vitest';
import type { AWBucket, AWEvent } from '../../src/main/activitywatch/client';
import { MINUTE, T0 } from '../fixtures';

const at = (minutes: number) => new Date(T0 + minutes * MINUTE).toISOString();

export const BUCKETS: AWBucket[] = [
  { id: 'aw-watcher-window_desk', type: 'currentwindow', client: 'aw-watcher-window', hostname: 'desk' },
  { id: 'aw-watcher-web-chrome_desk', type: 'web.tab.current', client: 'aw-client-web', hostname: 'desk' },
  { id: 'aw-watcher-afk_desk', type: 'afkstatus', client: 'aw-watcher-afk', hostname: 'desk' },
];

/** A 30-minute task from T0 to T0+30min. Events are newest first, like aw-server. */
export const EVENTS: Record<string, AWEvent[]> = {
  'aw-watcher-window_desk': [
    { timestamp: at(31), duration: 120, data: { app: 'Code', title: 'after the task' } },
    { timestamp: at(20), duration: 180, data: { app: 'Slack', title: 'general' } },
    { timestamp: at(10), duration: 300, data: { app: 'Code', title: 'login.ts' } },
    // Started 5 minutes before the task: only 5 of its 10 minutes count.
    { timestamp: at(-5), duration: 600, data: { app: 'Code', title: 'auth.ts' } },
  ],
  'aw-watcher-web-chrome_desk': [
    { timestamp: at(25), duration: 60, data: { url: 'https://github.com/org/repo/pull/2', title: 'PR' } },
    { timestamp: at(15), duration: 120, data: { url: 'https://www.youtube.com/watch?v=x', title: 'Video' } },
    { timestamp: at(5), duration: 240, data: { url: 'https://github.com/org/repo/issues/1', title: 'Bug' } },
  ],
  'aw-watcher-afk_desk': [
    // Runs 2 minutes past the end: only 4 of 6 minutes count as idle.
    { timestamp: at(26), duration: 360, data: { status: 'afk' } },
    { timestamp: at(0), duration: 26 * 60, data: { status: 'not-afk' } },
  ],
};

export const TASK_RANGE = { start: new Date(T0), end: new Date(T0 + 30 * MINUTE) };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** fetch replacement that serves the aw-server REST API from the fixtures above. */
export function fakeActivityWatchFetch(
  buckets: AWBucket[] = BUCKETS,
  events: Record<string, AWEvent[]> = EVENTS,
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === '/api/0/buckets/') {
      return json(Object.fromEntries(buckets.map((b) => [b.id, b])));
    }
    const match = url.pathname.match(/^\/api\/0\/buckets\/([^/]+)\/events$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      return id in events ? json(events[id]) : json({ message: 'no such bucket' }, 404);
    }
    if (url.pathname === '/api/0/info') {
      return json({ hostname: 'desk', version: 'v0.13.2' });
    }
    return json({ message: 'not found' }, 404);
  });
}

export function unreachableFetch() {
  return vi.fn(async () => {
    throw new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:5600');
  });
}
