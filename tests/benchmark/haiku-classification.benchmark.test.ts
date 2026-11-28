// Benchmark: does Haiku label activities the way a person would?
//
// These tests make REAL Claude API calls (model: CLASSIFIER_MODEL) and cost a
// little money each run. They are not part of `npm test`. Run them with:
//
//   npm run test:benchmark -- --api-key sk-ant-...
//
// Nothing is really visited: each scenario is a made-up ActivityWatch history
// (a browser window plus the aw-watcher-web extension's page events, or an app
// window) served by a fake aw-server. It goes through the same pipeline as a
// real stopped task (collect -> classify with Haiku -> metrics), so Haiku sees
// exactly what it would see in the app: "hostname — page title" for pages and
// the app name for apps.
import Anthropic from '@anthropic-ai/sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import { ActivityWatchClient, type AWBucket, type AWEvent } from '../../src/main/activitywatch/client';
import { activityFromUrl } from '../../src/main/activitywatch/web';
import { createAnthropicClassifierModel } from '../../src/main/classifier/anthropicModel';
import type { ClassifierModel } from '../../src/main/classifier/classify';
import { processCompletedTask } from '../../src/main/pipeline';
import type { ActivityStatus } from '../../src/shared/types';
import { makeActiveTask, MINUTE, T0 } from '../fixtures';
import { fakeActivityWatchFetch } from '../integration/fakeActivityWatch';

const API_KEY = process.env.FOCUSGARDEN_BENCHMARK_API_KEY;

type Visit =
  | { kind: 'web'; url: string; title: string; minutes: number; expected: ActivityStatus }
  | { kind: 'app'; app: string; title: string; minutes: number; expected: ActivityStatus };

interface Scenario {
  task: string;
  /** Kept from the original fixed categories so the prompts stay comparable. */
  categoryLabel: string;
  visits: Visit[];
  onTaskMinutes: number;
  offTaskMinutes: number;
}

const BUCKETS: AWBucket[] = [
  { id: 'aw-watcher-window_bench', type: 'currentwindow', client: 'aw-watcher-window', hostname: 'bench' },
  { id: 'aw-watcher-web-chrome_bench', type: 'web.tab.current', client: 'aw-client-web', hostname: 'bench' },
  { id: 'aw-watcher-afk_bench', type: 'afkstatus', client: 'aw-watcher-afk', hostname: 'bench' },
];

/** Back-to-back visits from T0, as the watchers would record them; no idle time. */
function history(visits: Visit[]) {
  const windows: AWEvent[] = [];
  const pages: AWEvent[] = [];
  let start = T0;
  for (const visit of visits) {
    const timestamp = new Date(start).toISOString();
    const duration = visit.minutes * 60;
    if (visit.kind === 'web') {
      windows.push({ timestamp, duration, data: { app: 'chrome.exe', title: `${visit.title} - Google Chrome` } });
      pages.push({ timestamp, duration, data: { url: visit.url, title: visit.title } });
    } else {
      windows.push({ timestamp, duration, data: { app: visit.app, title: visit.title } });
    }
    start += visit.minutes * MINUTE;
  }
  const events: Record<string, AWEvent[]> = {
    'aw-watcher-window_bench': windows.reverse(),
    'aw-watcher-web-chrome_bench': pages.reverse(),
    'aw-watcher-afk_bench': [{ timestamp: new Date(T0).toISOString(), duration: (start - T0) / 1000, data: { status: 'not-afk' } }],
  };
  return { events, endedAt: start };
}

const SCENARIOS: Scenario[] = [
  {
    task: 'study chemistry',
    categoryLabel: 'School / Study',
    visits: [
      // youtu.be links; page titles as YouTube reports them.
      { kind: 'web', url: 'https://youtu.be/-KfG8kH-r3Y?si=XcKrEpTS1a-BJt0Y', title: 'Chemistry - YouTube', minutes: 10, expected: 'on-task' },
      { kind: 'web', url: 'https://youtu.be/WsQQvHm4lSw?si=GgOjfBZh9pBTWAqF', title: 'Understand Calculus in 35 Minutes - YouTube', minutes: 10, expected: 'off-task' },
      { kind: 'web', url: 'https://protobowl.com/lobby', title: 'Protobowl', minutes: 10, expected: 'off-task' },
    ],
    onTaskMinutes: 10,
    offTaskMinutes: 20,
  },
  {
    task: 'play Wordle',
    categoryLabel: 'Self-Care',
    visits: [
      { kind: 'web', url: 'https://www.nytimes.com/games/wordle/index.html', title: 'Wordle — The New York Times', minutes: 4, expected: 'on-task' },
      { kind: 'web', url: 'https://loldle.net/', title: 'LoLdle', minutes: 4, expected: 'off-task' },
      { kind: 'web', url: 'https://pokedle.net/', title: 'Pokédle', minutes: 4, expected: 'off-task' },
      { kind: 'web', url: 'https://dartle.net/', title: 'Dartle: the daily trivia darts game', minutes: 4, expected: 'off-task' },
    ],
    onTaskMinutes: 4,
    offTaskMinutes: 12,
  },
  {
    task: 'make money',
    categoryLabel: 'Finance',
    visits: [
      {
        kind: 'web',
        url: 'https://www.wsj.com/world/americas/the-peruvian-pope-returns-home-to-elation-83890915?mod=hp_lead_pos8',
        title: 'The Peruvian Pope Returns Home to Elation - WSJ',
        minutes: 5,
        expected: 'off-task',
      },
      { kind: 'web', url: 'https://finance.yahoo.com/', title: 'Yahoo Finance - Stock Market Live, Quotes, Business & Finance News', minutes: 5, expected: 'on-task' },
      // Minecraft (Bedrock) as aw-watcher-window reports it on Windows.
      { kind: 'app', app: 'Minecraft.Windows.exe', title: 'Minecraft', minutes: 5, expected: 'off-task' },
    ],
    onTaskMinutes: 5,
    offTaskMinutes: 10,
  },
];

/** The activity name the collector gives a visit, which is what Haiku sees. */
const activityName = (v: Visit) => (v.kind === 'web' ? activityFromUrl(v.url, v.title).name : v.app);

describe('Haiku classification benchmark', () => {
  let classifier: ClassifierModel;
  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('No API key. Run: npm run test:benchmark -- --api-key sk-ant-...');
    }
    classifier = createAnthropicClassifierModel(new Anthropic({ apiKey: API_KEY }));
  });

  describe.each(SCENARIOS.map((s, i) => [i + 1, s] as const))('Test %i', (_n, scenario) => {
    it(`"${scenario.task}" → ${scenario.onTaskMinutes} on-task min, ${scenario.offTaskMinutes} off-task min`, async () => {
      const { events, endedAt } = history(scenario.visits);
      const activityWatch = new ActivityWatchClient({ fetch: fakeActivityWatchFetch(BUCKETS, events) });
      const task = makeActiveTask({ name: scenario.task, categoryLabel: scenario.categoryLabel, startedAt: T0 });

      const result = await processCompletedTask({ activityWatch, classifier }, task, endedAt);

      const labels = (rows: { name: string; status: ActivityStatus }[]) =>
        Object.fromEntries(rows.map((r) => [r.name, r.status]));
      const haiku = labels(result.activities);
      console.info(`\nTest ${_n} "${scenario.task}", Haiku's labels:\n${JSON.stringify(haiku, null, 2)}`);

      // Per-site labels first, so a failure shows which site Haiku got wrong.
      expect(haiku).toEqual(labels(scenario.visits.map((v) => ({ name: activityName(v), status: v.expected }))));
      expect(result.metrics).toEqual({
        productiveSeconds: scenario.onTaskMinutes * 60,
        unproductiveSeconds: scenario.offTaskMinutes * 60,
        idleSeconds: 0,
      });
    });
  });
});
