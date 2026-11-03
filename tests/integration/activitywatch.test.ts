// Issue #17: ActivityWatch integration - client and per-task activity collection
import { describe, expect, it } from 'vitest';
import { ActivityWatchClient, ActivityWatchError } from '../../src/main/activitywatch/client';
import { collectTaskActivity } from '../../src/main/activitywatch/collect';
import {
  BUCKETS,
  EVENTS,
  fakeActivityWatchFetch,
  TASK_RANGE,
  unreachableFetch,
} from './fakeActivityWatch';

const BASE = 'http://localhost:5600';

describe('#17 ActivityWatchClient', () => {
  it('defaults to the local aw-server', () => {
    expect(new ActivityWatchClient().baseUrl).toBe(BASE);
  });

  it('lists buckets as an array', async () => {
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    await expect(client.getBuckets()).resolves.toEqual(BUCKETS);
  });

  it('requests events for the exact task window with no limit', async () => {
    const fetch = fakeActivityWatchFetch();
    const client = new ActivityWatchClient({ fetch });
    await client.getEvents('aw-watcher-window_desk', TASK_RANGE);

    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/0/buckets/aw-watcher-window_desk/events');
    expect(url.searchParams.get('start')).toBe(TASK_RANGE.start.toISOString());
    expect(url.searchParams.get('end')).toBe(TASK_RANGE.end.toISOString());
    expect(url.searchParams.get('limit')).toBe('-1');
  });

  it('URL-encodes bucket ids', async () => {
    const fetch = fakeActivityWatchFetch();
    await new ActivityWatchClient({ fetch }).getEvents('weird id/1', TASK_RANGE).catch(() => {});
    expect(String(fetch.mock.calls[0][0])).toContain('weird%20id%2F1');
  });

  it('throws ActivityWatchError with the status for HTTP errors', async () => {
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    const error = await client.getEvents('missing-bucket', TASK_RANGE).catch((e) => e);
    expect(error).toBeInstanceOf(ActivityWatchError);
    expect(error.status).toBe(404);
  });

  it('throws ActivityWatchError when aw-server is not running', async () => {
    const client = new ActivityWatchClient({ fetch: unreachableFetch() });
    await expect(client.getBuckets()).rejects.toBeInstanceOf(ActivityWatchError);
  });

  it('reports availability without throwing', async () => {
    await expect(new ActivityWatchClient({ fetch: fakeActivityWatchFetch() }).isAvailable()).resolves.toBe(true);
    await expect(new ActivityWatchClient({ fetch: unreachableFetch() }).isAvailable()).resolves.toBe(false);
  });
});

describe('#17 collectTaskActivity', () => {
  const collect = (buckets = BUCKETS, events = EVENTS) =>
    collectTaskActivity(new ActivityWatchClient({ fetch: fakeActivityWatchFetch(buckets, events) }), TASK_RANGE);

  it('splits browser time into websites and searches, clipped to the task window', async () => {
    const { activities } = await collect();
    expect(activities).toEqual([
      { id: 'app:Code', name: 'Code', source: 'app', seconds: 600 },
      { id: 'web:github.com — Login fails on Safari · Issue #1 · org/repo', name: 'github.com — Login fails on Safari · Issue #1 · org/repo', source: 'web', seconds: 240 },
      { id: 'web:Pull request #2 · org/repo', name: 'Pull request #2 · org/repo', source: 'web', seconds: 240 },
      { id: 'app:Slack', name: 'Slack', source: 'app', seconds: 180 },
      { id: 'search:Google search: fix login bug', name: 'Google search: fix login bug', source: 'search', seconds: 120 },
      { id: 'web:youtube.com — Lofi beats to study to - YouTube', name: 'youtube.com — Lofi beats to study to - YouTube', source: 'web', seconds: 120 },
      { id: 'search:Google search: cats', name: 'Google search: cats', source: 'search', seconds: 60 },
    ]);
  });

  it('never lists the browser itself, so its time is not counted twice', async () => {
    const { activities } = await collect();
    expect(activities.map((a) => a.name)).not.toContain('chrome.exe');
  });

  it('counts AFK time inside the window as idle, and only as idle', async () => {
    const { activities, idleSeconds } = await collect();
    expect(idleSeconds).toBe(240);
    // Everything adds up to the 30-minute session, with nothing counted twice.
    expect(activities.reduce((sum, a) => sum + a.seconds, 0) + idleSeconds).toBe(30 * 60);
  });

  it('takes idle time out of the app that was in front', async () => {
    const { activities, idleSeconds } = await collect(BUCKETS, {
      'aw-watcher-window_desk': [{ timestamp: TASK_RANGE.start.toISOString(), duration: 1800, data: { app: 'Code', title: '' } }],
      'aw-watcher-web-chrome_desk': [],
      // Away for minutes 10-25 with Code still focused.
      'aw-watcher-afk_desk': [{ timestamp: new Date(TASK_RANGE.start.getTime() + 600_000).toISOString(), duration: 900, data: { status: 'afk' } }],
    });
    expect(activities).toEqual([{ id: 'app:Code', name: 'Code', source: 'app', seconds: 900 }]);
    expect(idleSeconds).toBe(900);
  });

  it('ignores websites the extension reports while another app is in front', async () => {
    const { activities } = await collect(BUCKETS, {
      'aw-watcher-window_desk': [{ timestamp: TASK_RANGE.start.toISOString(), duration: 1800, data: { app: 'Code', title: '' } }],
      'aw-watcher-web-chrome_desk': [{ timestamp: TASK_RANGE.start.toISOString(), duration: 1800, data: { url: 'https://youtube.com/', title: '' } }],
      'aw-watcher-afk_desk': [],
    });
    expect(activities.map((a) => a.name)).toEqual(['Code']);
  });

  it('does not double count when two browser extensions report at once', async () => {
    const buckets = [...BUCKETS, { id: 'aw-watcher-web-firefox_desk', type: 'web.tab.current', client: 'aw-client-web', hostname: 'desk' }];
    const start = TASK_RANGE.start.toISOString();
    const { activities } = await collect(buckets, {
      'aw-watcher-window_desk': [{ timestamp: start, duration: 600, data: { app: 'chrome.exe', title: 'Docs - Google Chrome' } }],
      'aw-watcher-web-chrome_desk': [{ timestamp: start, duration: 600, data: { url: 'https://docs.google.com/d/1', title: '' } }],
      'aw-watcher-web-firefox_desk': [{ timestamp: start, duration: 600, data: { url: 'https://reddit.com/', title: '' } }],
      'aw-watcher-afk_desk': [],
    });
    expect(activities.reduce((sum, a) => sum + a.seconds, 0)).toBe(600);
  });

  it('uses browser page titles when the extension is not installed', async () => {
    const buckets = BUCKETS.filter((b) => b.type !== 'web.tab.current');
    const { activities } = await collect(buckets, EVENTS);
    expect(activities).toEqual([
      { id: 'app:Code', name: 'Code', source: 'app', seconds: 600 },
      { id: 'web:Pull request #2 · org/repo', name: 'Pull request #2 · org/repo', source: 'web', seconds: 600 },
      // Equal times are listed alphabetically.
      { id: 'search:Google search: cats', name: 'Google search: cats', source: 'search', seconds: 180 },
      { id: 'app:Slack', name: 'Slack', source: 'app', seconds: 180 },
    ]);
  });

  it('uses the extension alone, minus idle time, when there is no window watcher', async () => {
    const buckets = BUCKETS.filter((b) => b.type !== 'currentwindow');
    const { activities, idleSeconds } = await collect(buckets, EVENTS);
    expect(activities.map((a) => [a.name, a.seconds])).toEqual([
      ['github.com — Login fails on Safari · Issue #1 · org/repo', 240],
      ['Google search: fix login bug', 120],
      ['youtube.com — Lofi beats to study to - YouTube', 120],
    ]);
    expect(idleSeconds).toBe(240);
  });

  it('returns empty activity for a window with no events', async () => {
    await expect(
      collect(BUCKETS, { 'aw-watcher-window_desk': [], 'aw-watcher-web-chrome_desk': [], 'aw-watcher-afk_desk': [] }),
    ).resolves.toEqual({ activities: [], idleSeconds: 0 });
  });

  it('counts overlapping AFK events once', async () => {
    const start = TASK_RANGE.start.toISOString();
    const { idleSeconds } = await collect(BUCKETS, {
      'aw-watcher-window_desk': [],
      'aw-watcher-web-chrome_desk': [],
      'aw-watcher-afk_desk': [
        { timestamp: start, duration: 300, data: { status: 'afk' } },
        { timestamp: start, duration: 120, data: { status: 'afk' } },
      ],
    });
    expect(idleSeconds).toBe(300);
  });

  it('fails loudly when ActivityWatch is unreachable', async () => {
    const client = new ActivityWatchClient({ fetch: unreachableFetch() });
    await expect(collectTaskActivity(client, TASK_RANGE)).rejects.toBeInstanceOf(ActivityWatchError);
  });
});
