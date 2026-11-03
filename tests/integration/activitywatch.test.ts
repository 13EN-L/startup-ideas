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
  it('aggregates apps by name and websites by hostname, clipped to the task window', async () => {
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    const { activities } = await collectTaskActivity(client, TASK_RANGE);

    expect(activities).toEqual([
      { id: 'app:Code', name: 'Code', source: 'app', seconds: 600 },
      { id: 'web:github.com', name: 'github.com', source: 'web', seconds: 300 },
      { id: 'app:Slack', name: 'Slack', source: 'app', seconds: 180 },
      { id: 'web:youtube.com', name: 'youtube.com', source: 'web', seconds: 120 },
    ]);
  });

  it('counts AFK time inside the window as idle', async () => {
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    const { idleSeconds } = await collectTaskActivity(client, TASK_RANGE);
    expect(idleSeconds).toBe(240);
  });

  it('still works when the browser watcher is not installed', async () => {
    const buckets = BUCKETS.filter((b) => b.type !== 'web.tab.current');
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch(buckets, EVENTS) });
    const { activities } = await collectTaskActivity(client, TASK_RANGE);
    expect(activities.every((a) => a.source === 'app')).toBe(true);
  });

  it('returns empty activity for a window with no events', async () => {
    const client = new ActivityWatchClient({ fetch: fakeActivityWatchFetch(BUCKETS, {
      'aw-watcher-window_desk': [],
      'aw-watcher-web-chrome_desk': [],
      'aw-watcher-afk_desk': [],
    }) });
    await expect(collectTaskActivity(client, TASK_RANGE)).resolves.toEqual({ activities: [], idleSeconds: 0 });
  });

  it('fails loudly when ActivityWatch is unreachable', async () => {
    const client = new ActivityWatchClient({ fetch: unreachableFetch() });
    await expect(collectTaskActivity(client, TASK_RANGE)).rejects.toBeInstanceOf(ActivityWatchError);
  });
});
