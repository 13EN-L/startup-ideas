// Issue #17: activity collection matches an independent clipping oracle
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ActivityWatchClient, type AWEvent } from '../../src/main/activitywatch/client';
import { collectTaskActivity } from '../../src/main/activitywatch/collect';
import { T0 } from '../fixtures';
import { BUCKETS, fakeActivityWatchFetch } from '../integration/fakeActivityWatch';

const TASK_SECONDS = 30 * 60;
const range = { start: new Date(T0), end: new Date(T0 + TASK_SECONDS * 1000) };

/** Event spans in whole seconds relative to T0, reaching up to 1h either side of the task. */
const spanArb = fc.record({
  offset: fc.integer({ min: -3600, max: TASK_SECONDS + 3600 }),
  duration: fc.integer({ min: 0, max: 3600 }),
});

const overlap = ({ offset, duration }: { offset: number; duration: number }) =>
  Math.max(0, Math.min(offset + duration, TASK_SECONDS) - Math.max(offset, 0));

const toEvent = <T,>(span: { offset: number; duration: number }, data: T): AWEvent<T> => ({
  timestamp: new Date(T0 + span.offset * 1000).toISOString(),
  duration: span.duration,
  data,
});

const windowEventArb = fc.record({ span: spanArb, app: fc.constantFrom('Code', 'Slack', 'Spotify') });
const afkEventArb = fc.record({ span: spanArb, status: fc.constantFrom('afk' as const, 'not-afk' as const) });

describe('#17 collectTaskActivity properties', () => {
  it('counts exactly the part of each event that falls inside the task window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(windowEventArb, { maxLength: 15 }),
        fc.array(afkEventArb, { maxLength: 10 }),
        async (windowEvents, afkEvents) => {
          const fetch = fakeActivityWatchFetch(BUCKETS, {
            'aw-watcher-window_desk': windowEvents.map((e) => toEvent(e.span, { app: e.app, title: '' })),
            'aw-watcher-web-chrome_desk': [],
            'aw-watcher-afk_desk': afkEvents.map((e) => toEvent(e.span, { status: e.status })),
          });
          const result = await collectTaskActivity(new ActivityWatchClient({ fetch }), range);

          const expected = new Map<string, number>();
          for (const e of windowEvents) expected.set(e.app, (expected.get(e.app) ?? 0) + overlap(e.span));
          for (const [app, seconds] of expected) if (seconds === 0) expected.delete(app);

          expect(new Map(result.activities.map((a) => [a.name, a.seconds]))).toEqual(expected);
          expect(result.idleSeconds).toBe(
            afkEvents.filter((e) => e.status === 'afk').reduce((s, e) => s + overlap(e.span), 0),
          );
        },
      ),
      { numRuns: 50 },
    );
  });

  it('lists activities from most to least time spent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(windowEventArb, { maxLength: 15 }), async (windowEvents) => {
        const fetch = fakeActivityWatchFetch(BUCKETS, {
          'aw-watcher-window_desk': windowEvents.map((e) => toEvent(e.span, { app: e.app, title: '' })),
          'aw-watcher-web-chrome_desk': [],
          'aw-watcher-afk_desk': [],
        });
        const { activities } = await collectTaskActivity(new ActivityWatchClient({ fetch }), range);
        for (let i = 1; i < activities.length; i++) {
          expect(activities[i - 1].seconds).toBeGreaterThanOrEqual(activities[i].seconds);
        }
      }),
      { numRuns: 50 },
    );
  });
});
