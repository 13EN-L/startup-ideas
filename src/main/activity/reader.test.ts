import { describe, expect, it, vi } from 'vitest'
import { ActivityWatchError, createActivityReader } from './reader'
import { BASE, span } from './test-helpers'

const RANGE = span(0, 3600)

// ActivityWatch's own timestamp format: microseconds and an explicit UTC offset.
const awTime = (seconds: number): string =>
  new Date(BASE + seconds * 1000).toISOString().replace('Z', '000+00:00')

const bucket = (id: string, type: string, client: string): Record<string, unknown> => ({
  id,
  created: '2026-01-10T08:00:00.000000+00:00',
  name: null,
  type,
  client,
  hostname: id.includes('web') ? 'unknown' : 'my-laptop',
  last_updated: '2026-11-02T10:00:00.000000+00:00'
})

const BUCKETS = {
  'aw-watcher-window_my-laptop': bucket(
    'aw-watcher-window_my-laptop',
    'currentwindow',
    'aw-watcher-window'
  ),
  'aw-watcher-afk_my-laptop': bucket('aw-watcher-afk_my-laptop', 'afkstatus', 'aw-watcher-afk'),
  'aw-watcher-web-chrome': bucket('aw-watcher-web-chrome', 'web.tab.current', 'aw-client-web'),
  'aw-watcher-web-firefox': bucket('aw-watcher-web-firefox', 'web.tab.current', 'aw-client-web'),
  'aw-watcher-input_my-laptop': bucket('aw-watcher-input_my-laptop', 'os.hid.input', 'aw-input')
}

// Newest first, as ActivityWatch returns them.
const EVENTS: Record<string, unknown[]> = {
  'aw-watcher-window_my-laptop': [
    { id: 3, timestamp: awTime(1200), duration: 600, data: { app: 'Code', title: 'a.ts' } },
    { id: 2, timestamp: awTime(600), duration: 600, data: { app: 'Firefox', title: 'MDN' } },
    { id: 1, timestamp: awTime(0), duration: 600, data: { app: 'Google Chrome', title: 'Gmail' } }
  ],
  'aw-watcher-afk_my-laptop': [
    { id: 2, timestamp: awTime(1500), duration: 300, data: { status: 'afk' } },
    { id: 1, timestamp: awTime(0), duration: 1500, data: { status: 'not-afk' } }
  ],
  'aw-watcher-web-chrome': [
    {
      id: 1,
      timestamp: awTime(0),
      duration: 600,
      data: {
        url: 'https://mail.google.com/mail/u/0/#inbox',
        title: 'Inbox - Gmail',
        audible: false,
        incognito: false,
        tabCount: 3
      }
    }
  ],
  'aw-watcher-web-firefox': [
    {
      id: 1,
      timestamp: awTime(600),
      duration: 600,
      data: { url: 'https://developer.mozilla.org/en-US/docs/Web?q=x', title: 'MDN Web Docs' }
    }
  ]
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function fakeFetch(
  routes: { buckets?: unknown; events?: Record<string, unknown> } = {}
): ReturnType<typeof vi.fn<typeof fetch>> {
  const buckets = routes.buckets ?? BUCKETS
  const events = routes.events ?? EVENTS
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/0/info') return json({ hostname: 'my-laptop', version: 'v0.13.2' })
    if (url.pathname === '/api/0/buckets/') return json(buckets)
    const match = /^\/api\/0\/buckets\/([^/]+)\/events$/.exec(url.pathname)
    if (match) {
      const id = decodeURIComponent(match[1])
      if (id in events) return json(events[id])
    }
    return json({ message: 'Not found' }, 404)
  })
}

describe('isServerRunning', () => {
  it('returns true when the info endpoint answers', async () => {
    const fetch = fakeFetch()
    const reader = createActivityReader({ fetch })
    await expect(reader.isServerRunning()).resolves.toBe(true)
    expect(String(fetch.mock.calls[0][0])).toBe('http://localhost:5600/api/0/info')
  })

  it('uses a custom base URL', async () => {
    const fetch = fakeFetch()
    await createActivityReader({ baseUrl: 'http://127.0.0.1:5666/', fetch }).isServerRunning()
    expect(String(fetch.mock.calls[0][0])).toBe('http://127.0.0.1:5666/api/0/info')
  })

  it('returns false when the server is down', async () => {
    const fetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    await expect(createActivityReader({ fetch }).isServerRunning()).resolves.toBe(false)
  })

  it('returns false on an error status', async () => {
    const fetch = vi.fn<typeof fetch>().mockResolvedValue(json({}, 500))
    await expect(createActivityReader({ fetch }).isServerRunning()).resolves.toBe(false)
  })

  it('returns false when the server does not answer in time', async () => {
    const fetch = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    const reader = createActivityReader({ fetch, infoTimeoutMs: 20 })
    await expect(reader.isServerRunning()).resolves.toBe(false)
  })
})

describe('getSummary', () => {
  it('reads window, AFK and every web bucket and builds the summary', async () => {
    const fetch = fakeFetch()
    const summary = await createActivityReader({ fetch }).getSummary(RANGE)

    expect(summary.range).toEqual(RANGE)
    expect(summary.idleIntervals).toEqual([span(1500, 1800)])
    expect(summary.idleSeconds).toBe(300)
    expect(summary.items.map((i) => [i.name, i.title, i.seconds])).toEqual([
      ['developer.mozilla.org', 'MDN Web Docs', 600],
      ['mail.google.com', 'Inbox - Gmail', 600],
      ['Code', 'a.ts', 300]
    ])
    expect(JSON.stringify(summary)).not.toContain('/mail/u/0')
    expect(JSON.stringify(summary)).not.toContain('q=x')
  })

  it('requests each bucket for the range with no limit, and never writes', async () => {
    const fetch = fakeFetch()
    await createActivityReader({ fetch }).getSummary(RANGE)

    const urls = fetch.mock.calls.map(([input]) => new URL(String(input)))
    const eventUrls = urls.filter((u) => u.pathname.endsWith('/events'))
    expect(eventUrls.map((u) => u.pathname).sort()).toEqual([
      '/api/0/buckets/aw-watcher-afk_my-laptop/events',
      '/api/0/buckets/aw-watcher-web-chrome/events',
      '/api/0/buckets/aw-watcher-web-firefox/events',
      '/api/0/buckets/aw-watcher-window_my-laptop/events'
    ])
    for (const u of eventUrls) {
      expect(u.searchParams.get('start')).toBe(new Date(RANGE.start).toISOString())
      expect(u.searchParams.get('end')).toBe(new Date(RANGE.end).toISOString())
      expect(u.searchParams.get('limit')).toBe('-1')
    }
    for (const [, init] of fetch.mock.calls) {
      expect(init?.method ?? 'GET').toBe('GET')
    }
  })

  it('summarizes from window data alone when there are no web buckets', async () => {
    const buckets = Object.fromEntries(
      Object.entries(BUCKETS).filter(([, b]) => b.type !== 'web.tab.current')
    )
    const summary = await createActivityReader({ fetch: fakeFetch({ buckets }) }).getSummary(RANGE)
    expect(summary.items.map((i) => [i.name, i.domain])).toEqual([
      ['Firefox', null],
      ['Google Chrome', null],
      ['Code', null]
    ])
  })

  it('returns only idle time when there is no window bucket', async () => {
    const buckets = { 'aw-watcher-afk_my-laptop': BUCKETS['aw-watcher-afk_my-laptop'] }
    const summary = await createActivityReader({ fetch: fakeFetch({ buckets }) }).getSummary(RANGE)
    expect(summary.items).toEqual([])
    expect(summary.idleSeconds).toBe(300)
  })

  it('only reads this computer’s buckets, ignoring ones synced from another machine', async () => {
    const other = (id: string, type: string): Record<string, unknown> => ({
      ...bucket(id, type, 'aw-watcher'),
      hostname: 'work-desktop'
    })
    const buckets = {
      ...BUCKETS,
      'aw-watcher-window_work-desktop': other('aw-watcher-window_work-desktop', 'currentwindow'),
      'aw-watcher-afk_work-desktop': other('aw-watcher-afk_work-desktop', 'afkstatus'),
      'aw-watcher-web-chrome_work-desktop': other(
        'aw-watcher-web-chrome_work-desktop',
        'web.tab.current'
      )
    }
    const fetch = fakeFetch({ buckets })
    const summary = await createActivityReader({ fetch }).getSummary(RANGE)

    const requested = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)
    expect(requested.filter((p) => p.includes('work-desktop'))).toEqual([])
    expect(summary.items.map((i) => i.name)).toEqual([
      'developer.mozilla.org',
      'mail.google.com',
      'Code'
    ])
  })

  it('keeps web buckets that report an unknown hostname (older browser extensions)', async () => {
    const fetch = fakeFetch()
    await createActivityReader({ fetch }).getSummary(RANGE)
    const requested = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)
    expect(requested).toContain('/api/0/buckets/aw-watcher-web-chrome/events')
  })

  it('ignores window buckets that report an unknown hostname', async () => {
    const buckets = {
      ...BUCKETS,
      'aw-watcher-window_unknown': {
        ...bucket('aw-watcher-window_unknown', 'currentwindow', 'aw-watcher-window'),
        hostname: 'unknown'
      }
    }
    const fetch = fakeFetch({ buckets })
    await createActivityReader({ fetch }).getSummary(RANGE)
    const requested = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)
    expect(requested).not.toContain('/api/0/buckets/aw-watcher-window_unknown/events')
  })

  it('encodes bucket ids in the URL', async () => {
    const id = 'aw-watcher-window_my laptop/2'
    const fetch = fakeFetch({
      buckets: { [id]: bucket(id, 'currentwindow', 'aw-watcher-window') },
      events: { [id]: [] }
    })
    await createActivityReader({ fetch }).getSummary(RANGE)
    expect(fetch.mock.calls.map(([u]) => String(u))).toContain(
      `http://localhost:5600/api/0/buckets/${encodeURIComponent(id)}/events?start=${encodeURIComponent(new Date(RANGE.start).toISOString())}&end=${encodeURIComponent(new Date(RANGE.end).toISOString())}&limit=-1`
    )
  })

  it('throws ActivityWatchError when the server is unreachable', async () => {
    const fetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const promise = createActivityReader({ fetch }).getSummary(RANGE)
    await expect(promise).rejects.toBeInstanceOf(ActivityWatchError)
    await expect(promise).rejects.toThrow(/unreachable/)
  })

  it('throws ActivityWatchError on an error status', async () => {
    const fetch = vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'boom' }, 500))
    await expect(createActivityReader({ fetch }).getSummary(RANGE)).rejects.toThrow(/HTTP 500/)
  })

  it.each([
    ['a bucket list that is not an object', { buckets: [1, 2, 3] }],
    ['a bucket without a type', { buckets: { x: { id: 'x' } } }],
    [
      'window events that are not a list',
      { events: { ...EVENTS, 'aw-watcher-window_my-laptop': { oops: true } } }
    ],
    [
      'a window event without an app',
      {
        events: {
          ...EVENTS,
          'aw-watcher-window_my-laptop': [{ timestamp: awTime(0), duration: 5, data: {} }]
        }
      }
    ],
    [
      'an unknown AFK status',
      {
        events: {
          ...EVENTS,
          'aw-watcher-afk_my-laptop': [
            { timestamp: awTime(0), duration: 5, data: { status: 'asleep' } }
          ]
        }
      }
    ],
    [
      'a bad timestamp',
      {
        events: {
          ...EVENTS,
          'aw-watcher-web-chrome': [
            { timestamp: 'yesterday', duration: 5, data: { url: 'https://a.com', title: 'A' } }
          ]
        }
      }
    ],
    [
      'a negative duration',
      {
        events: {
          ...EVENTS,
          'aw-watcher-afk_my-laptop': [
            { timestamp: awTime(0), duration: -1, data: { status: 'afk' } }
          ]
        }
      }
    ]
  ])('throws ActivityWatchError for %s', async (_case, routes) => {
    const promise = createActivityReader({ fetch: fakeFetch(routes) }).getSummary(RANGE)
    await expect(promise).rejects.toBeInstanceOf(ActivityWatchError)
    await expect(promise).rejects.toThrow(/malformed/)
  })

  it('throws ActivityWatchError for a body that is not JSON', async () => {
    const fetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 }))
    await expect(createActivityReader({ fetch }).getSummary(RANGE)).rejects.toThrow(/malformed/)
  })

  it('keeps window titles out of error messages', async () => {
    const events = {
      ...EVENTS,
      'aw-watcher-window_my-laptop': [
        { timestamp: awTime(0), duration: 'long', data: { app: 'Code', title: 'secret-plan.md' } }
      ]
    }
    const error = await createActivityReader({ fetch: fakeFetch({ events }) })
      .getSummary(RANGE)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ActivityWatchError)
    expect(String((error as Error).message)).not.toContain('secret-plan')
  })

  it('accepts a window event with no title', async () => {
    const events = {
      ...EVENTS,
      'aw-watcher-window_my-laptop': [
        { timestamp: awTime(0), duration: 60, data: { app: 'Finder' } }
      ]
    }
    const summary = await createActivityReader({ fetch: fakeFetch({ events }) }).getSummary(RANGE)
    expect(summary.items).toEqual([expect.objectContaining({ name: 'Finder', title: '' })])
  })
})
