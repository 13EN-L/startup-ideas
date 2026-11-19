// Issue #17: stopping a task runs ActivityWatch -> Claude -> metrics end to end
import { describe, expect, it, vi } from 'vitest';
import { ActivityWatchClient, ActivityWatchError } from '../../src/main/activitywatch/client';
import type { ClassifierModel } from '../../src/main/classifier/classify';
import { processCompletedTask } from '../../src/main/pipeline';
import { makeActiveTask, MINUTE, T0 } from '../fixtures';
import { fakeActivityWatchFetch, unreachableFetch } from './fakeActivityWatch';

function classifierFrom(statuses: Record<string, 'on-task' | 'off-task'>) {
  const complete = vi.fn(async () => ({
    classifications: Object.entries(statuses).map(([id, status]) => ({ id, status })),
  }));
  return { complete } satisfies ClassifierModel;
}

const task = makeActiveTask({ id: 't1', name: 'Fix login bug', category: 'work', startedAt: T0 });
const endedAt = T0 + 30 * MINUTE;

describe('#17 processCompletedTask', () => {
  const statuses = {
    'app:Code': 'on-task',
    'web:github.com — Login fails on Safari · Issue #1 · org/repo': 'on-task',
    'web:Pull request #2 · org/repo': 'on-task',
    'search:Google search: fix login bug': 'on-task',
    'app:Slack': 'off-task',
    'web:youtube.com — Lofi beats to study to - YouTube': 'off-task',
    'search:Google search: cats': 'off-task',
  } as const;

  it('produces a CompletedTask with classified activities and metrics', async () => {
    const classifier = classifierFrom(statuses);
    const activityWatch = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });

    const done = await processCompletedTask({ activityWatch, classifier }, task, endedAt);

    expect(done).toMatchObject({
      id: 't1',
      name: 'Fix login bug',
      category: 'work',
      startedAt: T0,
      endedAt,
      // 600 + 240 + 240 + 120 on, 180 + 120 + 60 off, 240 idle: exactly the 30 minutes.
      metrics: { productiveSeconds: 1200, unproductiveSeconds: 360, idleSeconds: 240 },
    });
    expect(done.activities).toContainEqual({
      id: 'web:youtube.com — Lofi beats to study to - YouTube',
      name: 'youtube.com — Lofi beats to study to - YouTube',
      source: 'web',
      seconds: 120,
      status: 'off-task',
    });
  });

  it('triggers exactly one Claude call that names the task', async () => {
    const classifier = classifierFrom(statuses);
    const activityWatch = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    await processCompletedTask({ activityWatch, classifier }, task, endedAt);

    expect(classifier.complete).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(classifier.complete.mock.calls[0])).toContain('Fix login bug');
  });

  it('sends Claude websites and searches but never idle time', async () => {
    const classifier = classifierFrom(statuses);
    const activityWatch = new ActivityWatchClient({ fetch: fakeActivityWatchFetch() });
    await processCompletedTask({ activityWatch, classifier }, task, endedAt);

    const sent = JSON.stringify(classifier.complete.mock.calls[0]);
    expect(sent).toContain('Google search: fix login bug');
    expect(sent).toContain('Login fails on Safari · Issue #1 · org/repo');
    expect(sent).not.toMatch(/afk|idle/i);
    expect(sent).not.toContain('chrome.exe');
  });

  it('rejects when ActivityWatch is unreachable so the UI can report it', async () => {
    const classifier = classifierFrom({});
    const activityWatch = new ActivityWatchClient({ fetch: unreachableFetch() });
    await expect(processCompletedTask({ activityWatch, classifier }, task, endedAt)).rejects.toBeInstanceOf(
      ActivityWatchError,
    );
    expect(classifier.complete).not.toHaveBeenCalled();
  });
});
