import { describe, expect, it } from 'vitest'
import type { ActivityItem, ActivitySummary } from '../../shared/activity'
import { MAX_SUMMARY_ITEMS, MAX_TITLE_LENGTH } from '../../shared/activity'
import { totalSeconds } from '../rewards'
import { buildSummary, type ActivityEvents } from './summary'
import { REDACTED } from './redact'
import { afk, at, span, web, win } from './test-helpers'

const RANGE = span(0, 3600)

const events = (partial: Partial<ActivityEvents>): ActivityEvents => ({
  window: [],
  afk: [],
  web: [],
  ...partial
})

const find = (summary: ActivitySummary, name: string, title?: string): ActivityItem => {
  const item = summary.items.find(
    (i) => i.name === name && (title === undefined || i.title === title)
  )
  if (!item) throw new Error(`No item ${name}`)
  return item
}

const itemSeconds = (summary: ActivitySummary): number =>
  summary.items.reduce((sum, i) => sum + i.seconds, 0)

// Every item's intervals are inside the range, outside idle time, and disjoint from other items.
function expectConsistent(summary: ActivitySummary): void {
  const all = summary.items.flatMap((i) => i.intervals)
  expect(totalSeconds(all)).toBeCloseTo(itemSeconds(summary), 6)
  for (const item of summary.items) {
    expect(item.seconds).toBeCloseTo(totalSeconds(item.intervals), 6)
    expect(item.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
    for (const i of item.intervals) {
      expect(i.start).toBeGreaterThanOrEqual(summary.range.start)
      expect(i.end).toBeLessThanOrEqual(summary.range.end)
      for (const idle of summary.idleIntervals) {
        expect(i.end <= idle.start || i.start >= idle.end).toBe(true)
      }
    }
  }
  expect(summary.items.length).toBeLessThanOrEqual(MAX_SUMMARY_ITEMS)
  expect(summary.idleSeconds).toBeCloseTo(totalSeconds(summary.idleIntervals), 6)
  const seconds = summary.items.map((i) => i.seconds)
  expect(seconds).toEqual([...seconds].sort((a, b) => b - a))
}

describe('buildSummary', () => {
  it('returns an empty summary when there are no events', () => {
    expect(buildSummary(events({}), RANGE)).toEqual({
      range: RANGE,
      items: [],
      idleIntervals: [],
      idleSeconds: 0
    })
  })

  it('returns an empty summary for an empty range', () => {
    const summary = buildSummary(
      events({ window: [win('Code', 'index.ts', 0, 60)], afk: [afk('afk', 0, 60)] }),
      span(30, 30)
    )
    expect(summary).toEqual({ range: span(30, 30), items: [], idleIntervals: [], idleSeconds: 0 })
  })

  it.each([
    ['ends before it starts', span(10, 5)],
    ['has no start', { start: NaN, end: at(10) }],
    ['has no end', { start: at(0), end: Infinity }]
  ])('rejects a range that %s', (_case, range) => {
    expect(() => buildSummary(events({}), range)).toThrow(RangeError)
  })

  it('trims whitespace around app names and titles', () => {
    const summary = buildSummary(
      events({ window: [win(' Code ', '  a.ts  ', 0, 60), win('Code', 'a.ts', 60, 60)] }),
      RANGE
    )
    expect(summary.items).toEqual([expect.objectContaining({ app: 'Code', title: 'a.ts' })])
  })

  it('breaks ties in time by name, then title', () => {
    const input = [
      win('Slack', 'b', 0, 60),
      win('Code', 'z', 60, 60),
      win('Slack', 'a', 120, 60),
      win('Code', 'y', 180, 60)
    ]
    const order = (list: typeof input): string[][] =>
      buildSummary(events({ window: list }), RANGE).items.map((i) => [i.name, i.title])
    const expected = [
      ['Code', 'y'],
      ['Code', 'z'],
      ['Slack', 'a'],
      ['Slack', 'b']
    ]
    expect(order(input)).toEqual(expected)
    expect(order([...input].reverse())).toEqual(expected)
  })

  it('resolves overlaps the same way when events arrive newest first', () => {
    const summary = buildSummary(
      events({ window: [win('Slack', 'dm', 50, 100), win('Code', 'a.ts', 0, 100)] }),
      RANGE
    )
    expect(find(summary, 'Code').intervals).toEqual([span(0, 50)])
    expect(find(summary, 'Slack').intervals).toEqual([span(50, 150)])
  })

  it('gives overlapping events with the same start to the later one in input order', () => {
    const summary = buildSummary(
      events({ window: [win('Code', 'a.ts', 0, 100), win('Slack', 'dm', 0, 40)] }),
      RANGE
    )
    expect(find(summary, 'Slack').intervals).toEqual([span(0, 40)])
    expect(find(summary, 'Code').intervals).toEqual([span(40, 100)])
  })

  it('totals time per app and title', () => {
    const summary = buildSummary(
      events({
        window: [
          win('Code', 'summary.ts — FocusGarden', 0, 600),
          win('Slack', 'general | Team', 600, 120),
          win('Code', 'summary.ts — FocusGarden', 720, 300)
        ]
      }),
      RANGE
    )
    expect(summary.items).toEqual([
      {
        name: 'Code',
        app: 'Code',
        title: 'summary.ts — FocusGarden',
        domain: null,
        seconds: 900,
        intervals: [span(0, 600), span(720, 1020)]
      },
      {
        name: 'Slack',
        app: 'Slack',
        title: 'general | Team',
        domain: null,
        seconds: 120,
        intervals: [span(600, 720)]
      }
    ])
    expectConsistent(summary)
  })

  it('accepts events in any order (ActivityWatch returns newest first)', () => {
    const forward = [win('Code', 'a.ts', 0, 60), win('Slack', 'dm', 60, 60)]
    const a = buildSummary(events({ window: forward }), RANGE)
    const b = buildSummary(events({ window: [...forward].reverse() }), RANGE)
    expect(b).toEqual(a)
  })

  it('clips events that cross the range boundaries', () => {
    const summary = buildSummary(
      events({
        window: [win('Code', 'a.ts', -300, 400), win('Slack', 'dm', 3500, 500)],
        afk: [afk('afk', -1000, 1100), afk('afk', 3550, 1000)]
      }),
      RANGE
    )
    expect(summary.idleIntervals).toEqual([span(0, 100), span(3550, 3600)])
    expect(summary.idleSeconds).toBe(150)
    // Code's in-range part (0 to 100) is all idle, so it drops out.
    expect(summary.items.map((i) => i.name)).toEqual(['Slack'])
    expect(find(summary, 'Slack').intervals).toEqual([span(3500, 3550)])
    expectConsistent(summary)
  })

  it('ignores events entirely outside the range', () => {
    const summary = buildSummary(
      events({ window: [win('Code', 'a.ts', -500, 100), win('Code', 'a.ts', 4000, 100)] }),
      RANGE
    )
    expect(summary.items).toEqual([])
  })

  it('removes idle time in the middle of an app', () => {
    const summary = buildSummary(
      events({
        window: [win('Code', 'a.ts', 0, 1200)],
        afk: [afk('not-afk', 0, 300), afk('afk', 300, 600), afk('not-afk', 900, 300)]
      }),
      RANGE
    )
    expect(find(summary, 'Code').intervals).toEqual([span(0, 300), span(900, 1200)])
    expect(find(summary, 'Code').seconds).toBe(600)
    expect(summary.idleIntervals).toEqual([span(300, 900)])
    expect(summary.idleSeconds).toBe(600)
    expectConsistent(summary)
  })

  it('counts idle time even when no window was active', () => {
    const summary = buildSummary(events({ afk: [afk('afk', 0, 3600)] }), RANGE)
    expect(summary.idleSeconds).toBe(3600)
    expect(summary.items).toEqual([])
  })

  it('merges overlapping AFK spans', () => {
    const summary = buildSummary(events({ afk: [afk('afk', 0, 100), afk('afk', 50, 100)] }), RANGE)
    expect(summary.idleIntervals).toEqual([span(0, 150)])
    expect(summary.idleSeconds).toBe(150)
  })

  it('counts overlapping window events once, the later-starting event winning', () => {
    const summary = buildSummary(
      events({
        window: [win('Code', 'a.ts', 0, 100), win('Slack', 'dm', 50, 100)]
      }),
      RANGE
    )
    expect(find(summary, 'Code').intervals).toEqual([span(0, 50)])
    expect(find(summary, 'Slack').intervals).toEqual([span(50, 150)])
    expect(itemSeconds(summary)).toBe(150)
    expectConsistent(summary)
  })

  it('lets a window resume after a shorter overlapping event ends', () => {
    const summary = buildSummary(
      events({
        window: [
          win('Code', 'a.ts', 0, 300),
          win('Slack', 'dm', 100, 50),
          win('Notes', 'todo', 120, 10)
        ]
      }),
      RANGE
    )
    expect(find(summary, 'Code').intervals).toEqual([span(0, 100), span(150, 300)])
    expect(find(summary, 'Slack').intervals).toEqual([span(100, 120), span(130, 150)])
    expect(find(summary, 'Notes').intervals).toEqual([span(120, 130)])
    expect(itemSeconds(summary)).toBe(300)
    expectConsistent(summary)
  })

  it('gives duplicate window events the same time once', () => {
    const summary = buildSummary(
      events({ window: [win('Code', 'a.ts', 0, 100), win('Code', 'a.ts', 0, 100)] }),
      RANGE
    )
    expect(summary.items).toHaveLength(1)
    expect(summary.items[0].seconds).toBe(100)
  })

  it('attributes browser time to websites when web data exists', () => {
    const summary = buildSummary(
      events({
        window: [win('Google Chrome', 'Lecture 12: Fourier Transforms - YouTube', 0, 600)],
        web: [
          {
            browser: 'chrome',
            events: [
              web(
                'https://www.youtube.com/watch?v=abc123',
                'Lecture 12: Fourier Transforms',
                0,
                400
              ),
              web('https://docs.google.com/document/d/1x/edit', 'Notes - Google Docs', 400, 200)
            ]
          }
        ]
      }),
      RANGE
    )
    expect(summary.items).toEqual([
      {
        name: 'youtube.com',
        app: 'Google Chrome',
        title: 'Lecture 12: Fourier Transforms',
        domain: 'youtube.com',
        seconds: 400,
        intervals: [span(0, 400)]
      },
      {
        name: 'docs.google.com',
        app: 'Google Chrome',
        title: 'Notes - Google Docs',
        domain: 'docs.google.com',
        seconds: 200,
        intervals: [span(400, 600)]
      }
    ])
    expectConsistent(summary)
  })

  it('keeps different videos on one site as separate items', () => {
    const summary = buildSummary(
      events({
        window: [win('Safari', 'YouTube', 0, 600)],
        web: [
          {
            browser: 'safari',
            events: [
              web('https://www.youtube.com/watch?v=1', 'MIT 18.06 Lecture 3 - YouTube', 0, 300),
              web('https://www.youtube.com/watch?v=2', 'Funny cats compilation - YouTube', 300, 300)
            ]
          }
        ]
      }),
      RANGE
    )
    expect(summary.items.map((i) => [i.domain, i.title])).toEqual([
      ['youtube.com', 'Funny cats compilation - YouTube'],
      ['youtube.com', 'MIT 18.06 Lecture 3 - YouTube']
    ])
  })

  it('falls back to the window title for browser time without web data', () => {
    const summary = buildSummary(
      events({ window: [win('Firefox', 'Inbox - Mail', 0, 300)] }),
      RANGE
    )
    expect(summary.items).toEqual([
      {
        name: 'Firefox',
        app: 'Firefox',
        title: 'Inbox - Mail',
        domain: null,
        seconds: 300,
        intervals: [span(0, 300)]
      }
    ])
  })

  it('uses the window title for the part of browser time the web data does not cover', () => {
    const summary = buildSummary(
      events({
        window: [win('chrome.exe', 'New Tab - Google Chrome', 0, 300)],
        web: [{ browser: 'chrome', events: [web('https://github.com/', 'GitHub', 100, 100)] }]
      }),
      RANGE
    )
    expect(find(summary, 'github.com').intervals).toEqual([span(100, 200)])
    expect(find(summary, 'chrome.exe').intervals).toEqual([span(0, 100), span(200, 300)])
    expect(find(summary, 'chrome.exe').title).toBe('New Tab - Google Chrome')
    expectConsistent(summary)
  })

  it('uses the tab URL from the window watcher when there is no web data (Safari)', () => {
    const summary = buildSummary(
      events({
        window: [
          win(
            'Safari',
            'Cute dogs - Google Search',
            0,
            200,
            'https://www.google.com/search?q=dogs'
          ),
          win('Safari', 'Golden retriever - Wikipedia', 200, 100, 'https://en.wikipedia.org/wiki/X')
        ]
      }),
      RANGE
    )
    expect(summary.items).toEqual([
      {
        name: 'google.com',
        app: 'Safari',
        title: 'Cute dogs - Google Search',
        domain: 'google.com',
        seconds: 200,
        intervals: [span(0, 200)]
      },
      {
        name: 'en.wikipedia.org',
        app: 'Safari',
        title: 'Golden retriever - Wikipedia',
        domain: 'en.wikipedia.org',
        seconds: 100,
        intervals: [span(200, 300)]
      }
    ])
    expect(JSON.stringify(summary)).not.toContain('q=dogs')
    expect(JSON.stringify(summary)).not.toContain('/wiki')
    expectConsistent(summary)
  })

  it('prefers web data and uses the window tab URL for the time it does not cover', () => {
    const summary = buildSummary(
      events({
        window: [win('Google Chrome', 'Docs', 0, 300, 'https://docs.google.com/document/d/1')],
        web: [{ browser: 'chrome', events: [web('https://github.com/', 'GitHub', 100, 100)] }]
      }),
      RANGE
    )
    expect(find(summary, 'github.com').intervals).toEqual([span(100, 200)])
    expect(find(summary, 'docs.google.com').intervals).toEqual([span(0, 100), span(200, 300)])
    expectConsistent(summary)
  })

  it('uses the window tab URL over another browser’s web data', () => {
    const summary = buildSummary(
      events({
        window: [win('Safari', 'Dogs', 0, 60, 'https://www.google.com/search?q=dogs')],
        web: [{ browser: 'chrome', events: [web('https://github.com/', 'GitHub', 0, 60)] }]
      }),
      RANGE
    )
    expect(summary.items).toEqual([expect.objectContaining({ name: 'google.com', app: 'Safari' })])
  })

  it('still prefers the browser’s own web data over its window tab URL', () => {
    const summary = buildSummary(
      events({
        window: [win('Safari', 'Docs', 0, 60, 'https://docs.google.com/document/d/1')],
        web: [
          { browser: 'chrome', events: [web('https://github.com/', 'GitHub', 0, 60)] },
          { browser: 'safari', events: [web('https://youtube.com/watch?v=1', 'Video', 0, 60)] }
        ]
      }),
      RANGE
    )
    expect(summary.items).toEqual([expect.objectContaining({ name: 'youtube.com', app: 'Safari' })])
  })

  it('falls back to the app for a window tab URL that is not a web page', () => {
    const summary = buildSummary(
      events({ window: [win('Safari', 'Favorites', 0, 60, 'favorites://')] }),
      RANGE
    )
    expect(summary.items).toEqual([expect.objectContaining({ name: 'Safari', domain: null })])
  })

  it('ignores a URL on a window that is not a browser', () => {
    const summary = buildSummary(
      events({ window: [win('Code', 'a.ts', 0, 60, 'https://github.com/')] }),
      RANGE
    )
    expect(summary.items).toEqual([expect.objectContaining({ name: 'Code', domain: null })])
  })

  it('ignores web events while a non-browser app is focused', () => {
    const summary = buildSummary(
      events({
        window: [win('Code', 'a.ts', 0, 300)],
        web: [{ browser: 'chrome', events: [web('https://reddit.com/', 'reddit', 0, 300)] }]
      }),
      RANGE
    )
    expect(summary.items.map((i) => i.name)).toEqual(['Code'])
  })

  it('removes idle time in the middle of a website', () => {
    const summary = buildSummary(
      events({
        window: [win('Arc', 'Docs', 0, 600)],
        afk: [afk('afk', 200, 100)],
        web: [{ browser: 'arc', events: [web('https://arxiv.org/abs/1', 'Paper', 0, 600)] }]
      }),
      RANGE
    )
    expect(find(summary, 'arxiv.org').intervals).toEqual([span(0, 200), span(300, 600)])
    expect(find(summary, 'arxiv.org').seconds).toBe(500)
    expectConsistent(summary)
  })

  it('never puts URL paths or query strings in the summary', () => {
    const summary = buildSummary(
      events({
        window: [win('Google Chrome', 'Reset your password - Example', 0, 300)],
        web: [
          {
            browser: 'chrome',
            events: [
              web(
                'https://www.example.com/account/reset?token=abc123secret&user=bob#step2',
                'Reset your password - Example',
                0,
                300
              )
            ]
          }
        ]
      }),
      RANGE
    )
    const output = JSON.stringify(summary)
    expect(find(summary, 'example.com').domain).toBe('example.com')
    for (const fragment of ['/account', 'reset?', 'abc123secret', 'user=bob', 'step2', 'https']) {
      expect(output).not.toContain(fragment)
    }
  })

  it('falls back to the window title for non-web URLs such as new tab pages', () => {
    const summary = buildSummary(
      events({
        window: [win('Google Chrome', 'New Tab', 0, 60)],
        web: [{ browser: 'chrome', events: [web('chrome://newtab/', 'Tab title', 0, 60)] }]
      }),
      RANGE
    )
    expect(summary.items.map((i) => [i.name, i.title, i.domain])).toEqual([
      ['Google Chrome', 'New Tab', null]
    ])
  })

  it('only uses web events during the browser window they overlap', () => {
    const summary = buildSummary(
      events({
        window: [
          win('Code', 'a.ts', 0, 200),
          win('Google Chrome', 'Docs', 200, 100),
          win('Code', 'a.ts', 300, 300)
        ],
        web: [
          {
            browser: 'chrome',
            events: [
              web('https://reddit.com/', 'reddit', 0, 100),
              web('https://docs.python.org/3/', 'Python docs', 200, 100),
              web('https://news.ycombinator.com/', 'HN', 400, 100)
            ]
          }
        ]
      }),
      RANGE
    )
    expect(summary.items.map((i) => [i.name, i.seconds])).toEqual([
      ['Code', 500],
      ['docs.python.org', 100]
    ])
  })

  it('uses the window title when the web event has none', () => {
    const summary = buildSummary(
      events({
        window: [win('Safari', 'Apple Developer', 0, 60)],
        web: [{ browser: 'safari', events: [web('https://developer.apple.com/', '', 0, 60)] }]
      }),
      RANGE
    )
    expect(summary.items).toEqual([
      expect.objectContaining({ name: 'developer.apple.com', title: 'Apple Developer' })
    ])
  })

  it('uses the web bucket of the focused browser when there are several', () => {
    const summary = buildSummary(
      events({
        window: [win('Firefox', 'MDN', 0, 300), win('Google Chrome', 'Gmail', 300, 300)],
        web: [
          {
            browser: 'chrome',
            events: [web('https://mail.google.com/mail/u/0/#inbox', 'Inbox - Gmail', 0, 600)]
          },
          {
            browser: 'firefox',
            events: [web('https://developer.mozilla.org/en-US/docs/Web', 'MDN Web Docs', 0, 600)]
          }
        ]
      }),
      RANGE
    )
    expect(find(summary, 'developer.mozilla.org').intervals).toEqual([span(0, 300)])
    expect(find(summary, 'mail.google.com').intervals).toEqual([span(300, 600)])
    expect(summary.items).toHaveLength(2)
    expectConsistent(summary)
  })

  it('uses any web bucket when none matches the focused browser', () => {
    // Brave, Arc and Vivaldi run the Chrome extension, which may report under a chrome bucket.
    const summary = buildSummary(
      events({
        window: [win('Brave Browser', 'Wikipedia', 0, 300)],
        web: [
          {
            browser: 'chrome',
            events: [web('https://en.wikipedia.org/wiki/Fourier', 'Fourier - Wikipedia', 0, 300)]
          }
        ]
      }),
      RANGE
    )
    expect(summary.items.map((i) => i.name)).toEqual(['en.wikipedia.org'])
  })

  it('counts overlapping web events once', () => {
    const summary = buildSummary(
      events({
        window: [win('Safari', 'x', 0, 300)],
        web: [
          {
            browser: null,
            events: [web('https://a.com/', 'A', 0, 200), web('https://b.com/', 'B', 100, 200)]
          }
        ]
      }),
      RANGE
    )
    expect(find(summary, 'a.com').intervals).toEqual([span(0, 100)])
    expect(find(summary, 'b.com').intervals).toEqual([span(100, 300)])
    expect(itemSeconds(summary)).toBe(300)
  })

  it('redacts secrets from window and web titles', () => {
    const summary = buildSummary(
      events({
        window: [
          win('Terminal', 'export OPENAI_KEY=sk-proj-AbC123dEf456GhI789jKl012MnO345', 0, 60),
          win('Google Chrome', 'Checkout', 60, 60)
        ],
        web: [
          {
            browser: 'chrome',
            events: [web('https://shop.example/pay', 'Pay with 4111 1111 1111 1111', 60, 60)]
          }
        ]
      }),
      RANGE
    )
    expect(find(summary, 'Terminal').title).toBe(`export OPENAI_KEY=${REDACTED}`)
    expect(find(summary, 'shop.example').title).toBe(`Pay with ${REDACTED}`)
    const output = JSON.stringify(summary)
    expect(output).not.toContain('sk-proj')
    expect(output).not.toContain('4111')
  })

  it('truncates long titles and groups by the truncated title', () => {
    const prefix = 'x'.repeat(MAX_TITLE_LENGTH + 10)
    const summary = buildSummary(
      events({
        window: [win('Notes', `${prefix} one`, 0, 60), win('Notes', `${prefix} two`, 60, 60)]
      }),
      RANGE
    )
    expect(summary.items).toHaveLength(1)
    expect(summary.items[0].title).toHaveLength(MAX_TITLE_LENGTH)
    expect(summary.items[0].seconds).toBe(120)
  })

  it('keeps fractional seconds', () => {
    const summary = buildSummary(events({ window: [win('Code', 'a.ts', 0, 12.345)] }), RANGE)
    expect(summary.items[0].seconds).toBeCloseTo(12.345, 3)
  })

  describe('with more groups than MAX_SUMMARY_ITEMS', () => {
    // 80 ten-second pages on one site, a few bigger apps, and one tiny app that gets folded on
    // its own.
    const pages = Array.from({ length: 80 }, (_, i) =>
      web(`https://news.example/story/${i}`, `Story ${i}`, i * 10, 10)
    )
    const input = events({
      window: [
        win('Google Chrome', 'News', 0, 800),
        win('Code', 'summary.ts', 800, 1000),
        win('Slack', 'general', 1800, 500),
        win('Notes', 'todo', 2300, 5)
      ],
      web: [{ browser: 'chrome', events: pages }]
    })

    it('folds the smallest groups into one item per app or domain', () => {
      const summary = buildSummary(input, span(0, 2400))
      expect(summary.items).toHaveLength(MAX_SUMMARY_ITEMS)
      expect(itemSeconds(summary)).toBe(800 + 1000 + 500 + 5)
      expectConsistent(summary)

      const folded = summary.items.filter((i) => i.title === '')
      expect(folded).toHaveLength(1)
      expect(folded[0]).toMatchObject({ name: 'news.example', domain: 'news.example' })
      expect(folded[0].seconds).toBe(10 * (80 - (MAX_SUMMARY_ITEMS - 4)))
      expect(find(summary, 'Code').seconds).toBe(1000)
      expect(find(summary, 'Slack').seconds).toBe(500)
      // Alone in its fold, Notes keeps its title.
      expect(find(summary, 'Notes')).toMatchObject({ title: 'todo', seconds: 5 })
      expect(summary.items.at(-1)?.name).toBe('Notes')
    })

    it('merges a folded item into a kept item with the same app, domain and title', () => {
      const commands = Array.from({ length: 60 }, (_, i) =>
        win('Terminal', `cmd ${i}`, 1000 + i * 10, 10)
      )
      const summary = buildSummary(
        events({ window: [win('Terminal', '', 0, 1000), ...commands] }),
        span(0, 1600)
      )
      expect(itemSeconds(summary)).toBe(1600)
      const untitled = summary.items.filter((i) => i.title === '')
      expect(untitled).toHaveLength(1)
      expect(untitled[0].seconds).toBe(1000 + 10 * (60 - (MAX_SUMMARY_ITEMS - 2)))
      expectConsistent(summary)
    })

    it('is deterministic', () => {
      expect(buildSummary(input, span(0, 2400))).toEqual(buildSummary(input, span(0, 2400)))
    })

    it('folds by app when there are too many domains', () => {
      const sites = Array.from({ length: 120 }, (_, i) =>
        web(`https://site${i}.example/`, `Site ${i}`, i * 10, 10)
      )
      const summary = buildSummary(
        events({
          window: [win('Google Chrome', 'x', 0, 1200)],
          web: [{ browser: 'chrome', events: sites }]
        }),
        span(0, 1200)
      )
      expect(summary.items.length).toBeLessThanOrEqual(MAX_SUMMARY_ITEMS)
      expect(itemSeconds(summary)).toBe(1200)
      expect(summary.items.filter((i) => i.domain === null && i.title === '')).toEqual([
        expect.objectContaining({ name: 'Google Chrome', app: 'Google Chrome' })
      ])
      expectConsistent(summary)
    })

    it('folds into one catch-all item when there are too many apps', () => {
      const apps = Array.from({ length: 120 }, (_, i) => win(`App ${i}`, 'main', i * 10, 10))
      const summary = buildSummary(events({ window: apps }), span(0, 1200))
      expect(summary.items).toHaveLength(MAX_SUMMARY_ITEMS)
      expect(itemSeconds(summary)).toBe(1200)
      expect(find(summary, 'Other apps')).toMatchObject({
        app: 'Other apps',
        title: '',
        domain: null,
        seconds: 10 * (120 - MAX_SUMMARY_ITEMS + 1)
      })
      expectConsistent(summary)
    })
  })

  it('uses real timestamps', () => {
    const summary = buildSummary(events({ window: [win('Code', 'a.ts', 0, 1)] }), RANGE)
    expect(summary.items[0].intervals[0].start).toBe(at(0))
  })
})
