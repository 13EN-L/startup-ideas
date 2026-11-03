import type { ActivityItem, ActivitySummary } from '../../shared/activity'
import { MAX_SUMMARY_ITEMS } from '../../shared/activity'
import type { Interval } from '../../shared/domain'
import { mergeIntervals, subtractIntervals, totalSeconds } from '../rewards'
import { browserForApp, domainFromUrl, type Browser } from './browsers'
import { redactSecrets, truncateTitle } from './redact'

// ActivityWatch events: timestamp is ISO 8601, duration is in seconds.
export interface AwEvent<T> {
  timestamp: string
  duration: number
  data: T
}

export type WindowEvent = AwEvent<{ app: string; title: string }>
export type AfkEvent = AwEvent<{ status: 'afk' | 'not-afk' }>
export type WebEvent = AwEvent<{ url: string; title?: string }>

// One web watcher bucket. There is one per browser; browser is null if we can't tell which.
export interface WebBucketEvents {
  browser: Browser | null
  events: WebEvent[]
}

export interface ActivityEvents {
  window: WindowEvent[]
  afk: AfkEvent[]
  web: WebBucketEvents[]
}

interface Span<T> extends Interval {
  value: T
}

interface Group {
  app: string
  domain: string | null
  title: string
  pieces: Interval[]
}

const OTHER_APPS = 'Other apps'

function clip<T>(events: readonly AwEvent<T>[], range: Interval): Span<T>[] {
  const spans: Span<T>[] = []
  for (const event of events) {
    const start = Date.parse(event.timestamp)
    const end = start + Math.round(event.duration * 1000)
    const clipped = { start: Math.max(start, range.start), end: Math.min(end, range.end) }
    if (clipped.end > clipped.start) spans.push({ ...clipped, value: event.data })
  }
  return spans
}

// Splits overlapping spans so each millisecond belongs to one span: the later-starting one (on a
// tie, the later one in input order). Walks spans from the latest start back, keeping the
// already-claimed time as a merged stack with the earliest interval on top.
function resolveOverlaps<T>(spans: readonly Span<T>[]): Span<T>[] {
  const ordered = spans
    .map((span, index) => ({ span, index }))
    .sort((a, b) => a.span.start - b.span.start || a.index - b.index)
    .map(({ span }) => span)

  const owned: Span<T>[] = []
  const claimed: Interval[] = []
  for (let i = ordered.length - 1; i >= 0; i--) {
    const { start, end, value } = ordered[i]
    let cursor = start
    let mergedEnd = end
    while (claimed.length > 0 && claimed[claimed.length - 1].start <= end) {
      const next = claimed.pop() as Interval
      if (next.start > cursor) owned.push({ start: cursor, end: next.start, value })
      cursor = Math.max(cursor, next.end)
      mergedEnd = Math.max(mergedEnd, next.end)
    }
    if (cursor < end) owned.push({ start: cursor, end, value })
    claimed.push({ start, end: mergedEnd })
  }
  return owned.sort((a, b) => a.start - b.start)
}

// Index of the first span ending after `time`, in spans sorted by start and non-overlapping.
function firstEndingAfter(spans: readonly Interval[], time: number): number {
  let lo = 0
  let hi = spans.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (spans[mid].end <= time) lo = mid + 1
    else hi = mid
  }
  return lo
}

function cleanTitle(title: string): string {
  return truncateTitle(redactSecrets(title.trim()))
}

function webSpansFor(
  buckets: readonly WebBucketEvents[],
  range: Interval
): (b: Browser) => Span<WebEvent['data']>[] {
  const cache = new Map<Browser, Span<WebEvent['data']>[]>()
  return (browser) => {
    let spans = cache.get(browser)
    if (!spans) {
      const own = buckets.filter((b) => b.browser === browser)
      // Chromium browsers can report under a chrome bucket, so with no exact match use them all.
      const chosen = own.length > 0 ? own : buckets
      spans = resolveOverlaps(chosen.flatMap((b) => clip(b.events, range)))
      cache.set(browser, spans)
    }
    return spans
  }
}

// Attributes every non-overlapping window span to an app/title or, for browser time covered by
// web data, to a domain/tab title.
function groupActivity(events: ActivityEvents, range: Interval): Map<string, Group> {
  const groups = new Map<string, Group>()
  const add = (app: string, domain: string | null, rawTitle: string, piece: Interval): void => {
    const title = cleanTitle(rawTitle)
    const key = JSON.stringify([app, domain, title])
    const group = groups.get(key)
    if (group) group.pieces.push(piece)
    else groups.set(key, { app, domain, title, pieces: [piece] })
  }
  const webFor = webSpansFor(events.web, range)

  for (const window of resolveOverlaps(clip(events.window, range))) {
    const app = redactSecrets(window.value.app.trim())
    const browser = browserForApp(window.value.app)
    const pages = browser && events.web.length > 0 ? webFor(browser) : []

    let cursor = window.start
    for (let i = firstEndingAfter(pages, window.start); i < pages.length; i++) {
      const page = pages[i]
      if (page.start >= window.end) break
      const domain = domainFromUrl(page.value.url)
      if (domain === null) continue
      const start = Math.max(page.start, window.start)
      const end = Math.min(page.end, window.end)
      if (start > cursor) add(app, null, window.value.title, { start: cursor, end: start })
      add(app, domain, page.value.title || window.value.title, { start, end })
      cursor = end
    }
    if (cursor < window.end) add(app, null, window.value.title, { start: cursor, end: window.end })
  }
  return groups
}

function toItem(
  app: string,
  domain: string | null,
  title: string,
  intervals: Interval[]
): ActivityItem {
  const merged = mergeIntervals(intervals)
  return {
    name: domain ?? app,
    app,
    title,
    domain,
    seconds: totalSeconds(merged),
    intervals: merged
  }
}

// Most time first; ties broken by name, app, then title so output never depends on input order.
function byTime(a: ActivityItem, b: ActivityItem): number {
  return (
    b.seconds - a.seconds ||
    compare(a.name, b.name) ||
    compare(a.app, b.app) ||
    compare(a.title, b.title)
  )
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Folds items sharing a key into one item with an empty title. A key with a single item keeps
// that item as is. A folded item that matches an existing one's key is merged into it.
function foldBy(
  items: readonly ActivityItem[],
  key: (item: ActivityItem) => [string, string | null]
): ActivityItem[] {
  const buckets = new Map<string, ActivityItem[]>()
  for (const item of items) {
    const k = JSON.stringify(key(item))
    buckets.set(k, [...(buckets.get(k) ?? []), item])
  }
  return [...buckets.values()].map((bucket) => {
    if (bucket.length === 1) return bucket[0]
    const [app, domain] = key(bucket[0])
    return toItem(
      app,
      domain,
      '',
      bucket.flatMap((i) => i.intervals)
    )
  })
}

function combineDuplicates(items: readonly ActivityItem[]): ActivityItem[] {
  const byKey = new Map<string, ActivityItem>()
  for (const item of items) {
    const k = JSON.stringify([item.app, item.domain, item.title])
    const existing = byKey.get(k)
    byKey.set(
      k,
      existing
        ? toItem(item.app, item.domain, item.title, [...existing.intervals, ...item.intervals])
        : item
    )
  }
  return [...byKey.values()]
}

const FOLD_LEVELS: ((item: ActivityItem) => [string, string | null])[] = [
  (item) => [item.app, item.domain],
  (item) => [item.app, null]
]

// Keeps the summary at MAX_SUMMARY_ITEMS without losing any time. Items are ranked by time
// (see byTime); the largest are kept as is and the rest are folded into one item per app and
// domain, keeping as many whole items as fit. If that can't fit, the rest are folded per app,
// and as a last resort the smallest apps go into a single "Other apps" item.
function limitItems(items: ActivityItem[]): ActivityItem[] {
  const sorted = [...items].sort(byTime)
  if (sorted.length <= MAX_SUMMARY_ITEMS) return sorted

  for (const level of FOLD_LEVELS) {
    for (let keep = MAX_SUMMARY_ITEMS - 1; keep >= 0; keep--) {
      const folded = combineDuplicates([
        ...sorted.slice(0, keep),
        ...foldBy(sorted.slice(keep), level)
      ])
      if (folded.length <= MAX_SUMMARY_ITEMS) return folded.sort(byTime)
    }
  }

  const apps = foldBy(sorted, FOLD_LEVELS[1]).sort(byTime)
  const rest = apps.slice(MAX_SUMMARY_ITEMS - 1).flatMap((i) => i.intervals)
  return [...apps.slice(0, MAX_SUMMARY_ITEMS - 1), toItem(OTHER_APPS, null, '', rest)].sort(byTime)
}

// Builds the activity summary for one task's time range from ActivityWatch events, following
// docs/architecture.md: clip to the range, take out AFK time, attribute browser time to the site
// when web data exists, count overlapping events once, group, redact, and cap the item count.
// Items are grouped by (app, domain, title) after redaction and truncation, so two videos on
// one site stay separate and can be labeled differently.
export function buildSummary(events: ActivityEvents, range: Interval): ActivitySummary {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end < range.start) {
    throw new RangeError('Invalid summary range')
  }

  const idleIntervals = mergeIntervals(
    clip(
      events.afk.filter((e) => e.data.status === 'afk'),
      range
    )
  )

  const items: ActivityItem[] = []
  for (const { app, domain, title, pieces } of groupActivity(events, range).values()) {
    const active = subtractIntervals(pieces, idleIntervals)
    if (active.length > 0) items.push(toItem(app, domain, title, active))
  }

  return {
    range: { start: range.start, end: range.end },
    items: limitItems(items),
    idleIntervals,
    idleSeconds: totalSeconds(idleIntervals)
  }
}
