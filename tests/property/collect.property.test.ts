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

const toEvent = <T,>(span: { offset: number; duration: number }, data: T): AWEvent<T> => ({
  timestamp: new Date(T0 + span.offset * 1000).toISOString(),
  duration: span.duration,
  data,
});

const windowEventArb = fc.record({ span: spanArb, app: fc.constantFrom('Code', 'Slack', 'Spotify') });
const afkEventArb = fc.record({ span: spanArb, status: fc.constantFrom('afk' as const, 'not-afk' as const) });

/** Back-to-back window events (one app in front at a time), as aw-watcher-window records them. */
const windowTimelineArb = fc
  .record({
    start: fc.integer({ min: -3600, max: TASK_SECONDS }),
    parts: fc.array(fc.record({ duration: fc.integer({ min: 1, max: 900 }), app: fc.constantFrom('Code', 'Slack', 'chrome.exe') }), { maxLength: 12 }),
  })
  .map(({ start, parts }) => {
    let offset = start;
    return parts.map(({ duration, app }) => {
      const span = { offset, duration };
      offset += duration;
      return { span, app };
    });
  });

/** Seconds of the task (as indexes 0..TASK_SECONDS-1) covered by the span. */
const secondsOf = ({ offset, duration }: { offset: number; duration: number }) => {
  const covered: number[] = [];
  for (let s = Math.max(offset, 0); s < Math.min(offset + duration, TASK_SECONDS); s++) covered.push(s);
  return covered;
};

describe('#17 collectTaskActivity properties', () => {
  it('counts exactly the non-idle part of each event that falls inside the task window', async () => {
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

          // Oracle: mark idle seconds one by one, then count each event's other seconds.
          const idle = new Set(afkEvents.filter((e) => e.status === 'afk').flatMap((e) => secondsOf(e.span)));
          const expected = new Map<string, number>();
          for (const e of windowEvents) {
            const active = secondsOf(e.span).filter((s) => !idle.has(s)).length;
            expected.set(e.app, (expected.get(e.app) ?? 0) + active);
          }
          for (const [app, seconds] of expected) if (seconds === 0) expected.delete(app);

          expect(new Map(result.activities.map((a) => [a.name, a.seconds]))).toEqual(expected);
          expect(result.idleSeconds).toBe(idle.size);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('never counts more time than the session lasted', async () => {
    await fc.assert(
      fc.asyncProperty(
        windowTimelineArb,
        fc.array(spanArb, { maxLength: 6 }),
        fc.array(afkEventArb, { maxLength: 10 }),
        async (windowEvents, webSpans, afkEvents) => {
          const fetch = fakeActivityWatchFetch(BUCKETS, {
            'aw-watcher-window_desk': windowEvents.map((e) => toEvent(e.span, { app: e.app, title: 'Page - Google Chrome' })),
            'aw-watcher-web-chrome_desk': webSpans.map((span, i) => toEvent(span, { url: `https://site${i % 3}.com/`, title: '' })),
            'aw-watcher-afk_desk': afkEvents.map((e) => toEvent(e.span, { status: e.status })),
          });
          const { activities, idleSeconds } = await collectTaskActivity(new ActivityWatchClient({ fetch }), range);
          const counted = activities.reduce((sum, a) => sum + a.seconds, 0) + idleSeconds;
          // Each activity is rounded to whole seconds, so allow one second per entry.
          expect(counted).toBeLessThanOrEqual(TASK_SECONDS + activities.length);
          expect(activities.some((a) => a.name === 'chrome.exe')).toBe(false);
        },
      ),
      { numRuns: 100 },
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
