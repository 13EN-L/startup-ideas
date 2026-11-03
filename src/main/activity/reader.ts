import { z } from 'zod'
import type { ActivityReader, ActivitySummary } from '../../shared/activity'
import type { Interval } from '../../shared/domain'
import { browserForBucket } from './browsers'
import { buildSummary, type WebBucketEvents } from './summary'

export const DEFAULT_ACTIVITYWATCH_URL = 'http://localhost:5600'

// Thrown when ActivityWatch can't be reached or answers with something unexpected. The caller
// keeps the task pending and retries. Messages never include event data.
export class ActivityWatchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ActivityWatchError'
  }
}

export interface ActivityReaderOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  infoTimeoutMs?: number
  requestTimeoutMs?: number
}

const InfoSchema = z.object({ hostname: z.string() })

const BucketsSchema = z.record(
  z.string(),
  z.object({ type: z.string(), hostname: z.string().optional() })
)

// Older aw-watcher-web versions report this instead of the machine's hostname.
const UNKNOWN_HOST = 'unknown'

const eventFields = {
  timestamp: z.string().refine((s) => Number.isFinite(Date.parse(s)), 'Invalid timestamp'),
  duration: z.number().nonnegative()
}

const WindowEvents = z.array(
  z.object({
    ...eventFields,
    data: z.object({
      app: z.string(),
      title: z.string().default(''),
      url: z.string().optional()
    })
  })
)
const AfkEvents = z.array(
  z.object({ ...eventFields, data: z.object({ status: z.enum(['afk', 'not-afk']) }) })
)
const WebEvents = z.array(
  z.object({ ...eventFields, data: z.object({ url: z.string(), title: z.string().optional() }) })
)

const BUCKET_TYPES = {
  window: 'currentwindow',
  afk: 'afkstatus',
  web: 'web.tab.current'
} as const

// Reads past events from ActivityWatch's local REST API. Read-only: it only sends GETs.
export function createActivityReader(options: ActivityReaderOptions = {}): ActivityReader {
  const baseUrl = (options.baseUrl ?? DEFAULT_ACTIVITYWATCH_URL).replace(/\/+$/, '')
  const fetchFn = options.fetch ?? globalThis.fetch
  const infoTimeoutMs = options.infoTimeoutMs ?? 1000
  const requestTimeoutMs = options.requestTimeoutMs ?? 15_000

  async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response
    try {
      response = await fetchFn(baseUrl + path, {
        method: 'GET',
        signal: AbortSignal.timeout(requestTimeoutMs)
      })
    } catch (cause) {
      throw new ActivityWatchError('ActivityWatch server is unreachable', { cause })
    }
    if (!response.ok) {
      throw new ActivityWatchError(`ActivityWatch returned HTTP ${response.status}`)
    }
    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new ActivityWatchError('ActivityWatch returned a malformed response (not JSON)', {
        cause
      })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const where = parsed.error.issues[0]?.path.join('.') || 'body'
      throw new ActivityWatchError(`ActivityWatch returned a malformed response at ${where}`)
    }
    return parsed.data
  }

  function eventsPath(bucketId: string, range: Interval): string {
    const query = new URLSearchParams({
      start: new Date(range.start).toISOString(),
      end: new Date(range.end).toISOString(),
      limit: '-1'
    })
    return `/api/0/buckets/${encodeURIComponent(bucketId)}/events?${query}`
  }

  return {
    async isServerRunning(): Promise<boolean> {
      try {
        const response = await fetchFn(`${baseUrl}/api/0/info`, {
          method: 'GET',
          signal: AbortSignal.timeout(infoTimeoutMs)
        })
        return response.ok
      } catch {
        return false
      }
    },

    async getSummary(range: Interval): Promise<ActivitySummary> {
      const [{ hostname }, buckets] = await Promise.all([
        getJson('/api/0/info', InfoSchema),
        getJson('/api/0/buckets/', BucketsSchema)
      ])
      // Only this computer's activity: ActivityWatch sync can bring in other machines' buckets.
      const isLocal = (id: string): boolean =>
        buckets[id].hostname === hostname ||
        (buckets[id].type === BUCKET_TYPES.web && buckets[id].hostname === UNKNOWN_HOST)
      const idsOf = (type: string): string[] =>
        Object.keys(buckets)
          .filter((id) => buckets[id].type === type && isLocal(id))
          .sort()

      const [window, afk, web] = await Promise.all([
        Promise.all(
          idsOf(BUCKET_TYPES.window).map((id) => getJson(eventsPath(id, range), WindowEvents))
        ),
        Promise.all(idsOf(BUCKET_TYPES.afk).map((id) => getJson(eventsPath(id, range), AfkEvents))),
        Promise.all(
          idsOf(BUCKET_TYPES.web).map(async (id): Promise<WebBucketEvents> => ({
            browser: browserForBucket(id),
            events: await getJson(eventsPath(id, range), WebEvents)
          }))
        )
      ])

      return buildSummary({ window: window.flat(), afk: afk.flat(), web }, range)
    }
  }
}
