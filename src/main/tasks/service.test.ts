import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityItem, ActivitySummary } from '../../shared/activity'
import {
  ClassificationError,
  type ClassificationRequest,
  type ItemLabel
} from '../../shared/classifier'
import type { Interval, Label } from '../../shared/domain'
import { getCreditedIntervals, getPlant, getTask, openDatabase } from '../db'
import { freshDb, T0 } from '../db/test-helpers'
import { plantState } from '../rewards'
import { RETRY_DELAYS_MS } from './retry'
import { createTaskService, type TaskService, type TaskServiceDeps } from './service'

const MIN = 60_000
const span = (fromMin: number, toMin: number): Interval => ({
  start: T0 + fromMin * MIN,
  end: T0 + toMin * MIN
})
const item = (name: string, intervals: Interval[]): ActivityItem => ({
  name,
  app: 'Google Chrome',
  title: name,
  domain: name,
  seconds: intervals.reduce((s, i) => s + (i.end - i.start) / 1000, 0),
  intervals
})

// A summary for a task from 0 to 40 min: 25 min docs, 5 min reddit, 10 min idle.
const SUMMARY_ITEMS = [item('docs.google.com', [span(0, 25)]), item('reddit.com', [span(25, 30)])]
const LABELS: Record<string, Label> = { 'docs.google.com': 'on-task', 'reddit.com': 'off-task' }

interface Harness {
  db: DatabaseSync
  service: TaskService
  clock: { now: number }
  getSummary: ReturnType<typeof vi.fn<(range: Interval) => Promise<ActivitySummary>>>
  classify: ReturnType<typeof vi.fn<(req: ClassificationRequest) => Promise<ItemLabel[]>>>
  events: string[]
}

function labelByName(req: ClassificationRequest): ItemLabel[] {
  return req.items.map((i) => ({ id: i.id, label: LABELS[i.domain ?? ''] ?? 'off-task' }))
}

function harness(
  options: { db?: DatabaseSync; items?: ActivityItem[]; idle?: Interval[] } = {}
): Harness {
  const db = options.db ?? freshDb()
  const clock = { now: T0 }
  const events: string[] = []
  const getSummary = vi.fn(async (range: Interval) => ({
    range,
    items: structuredClone(options.items ?? SUMMARY_ITEMS),
    idleIntervals: options.idle ?? [span(30, 40)],
    idleSeconds: (options.idle ?? [span(30, 40)]).reduce((s, i) => s + (i.end - i.start) / 1000, 0)
  }))
  const classify = vi.fn(async (req: ClassificationRequest) => labelByName(req))
  const deps: TaskServiceDeps = {
    db,
    activity: { getSummary },
    getClassifier: () => classify,
    notify: {
      taskResults: (id) => events.push(`results:${id}`),
      gardenChanged: () => events.push('garden')
    },
    now: () => clock.now,
    random: () => 0
  }
  return { db, service: createTaskService(deps), clock, getSummary, classify, events }
}

async function runTask(
  h: Harness,
  name = 'Essay',
  category: 'Work' | 'School / Study' = 'School / Study'
): Promise<number> {
  h.clock.now = T0
  const task = h.service.start({ name, category })
  h.clock.now = T0 + 40 * MIN
  h.service.stop(task.id)
  await h.service.settled()
  return task.id
}

describe('task service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  describe('start', () => {
    it('saves an active task with a free animal and the current time', () => {
      const h = harness()
      const task = h.service.start({ name: '  Write essay  ', category: 'School / Study' })
      expect(task).toMatchObject({
        name: 'Write essay',
        category: 'School / Study',
        animal: 'Cow',
        startedAt: T0,
        status: 'active'
      })
      expect(h.service.listActive()).toEqual([task])
    })

    it('never gives two active tasks the same animal', () => {
      const h = harness()
      const animals = ['A', 'B', 'C'].map(
        (name) => h.service.start({ name, category: 'Work' }).animal
      )
      expect(new Set(animals).size).toBe(3)
    })

    it('allows at most 3 active tasks', () => {
      const h = harness()
      for (const name of ['A', 'B', 'C']) h.service.start({ name, category: 'Work' })
      expect(() => h.service.start({ name: 'D', category: 'Work' })).toThrow(
        'At most 3 tasks can be active'
      )
    })

    it('rejects an empty name and an unknown category', () => {
      const h = harness()
      expect(() => h.service.start({ name: '   ', category: 'Work' })).toThrow(
        'Task name is required'
      )
      expect(() => h.service.start({ name: 'X', category: 'Gaming' as never })).toThrow(
        'Unknown category'
      )
    })
  })

  describe('stop → summarize → classify → grow', () => {
    it('completes a task and grows its plant by only the productive time', async () => {
      const h = harness()
      const id = await runTask(h)

      expect(h.getSummary).toHaveBeenCalledWith({ start: T0, end: T0 + 40 * MIN })
      expect(getTask(h.db, id)?.status).toBe('done')
      expect(h.service.getResults(id)).toEqual({
        task: expect.objectContaining({ id, status: 'done' }),
        buckets: { productiveSeconds: 25 * 60, unproductiveSeconds: 5 * 60, idleSeconds: 10 * 60 },
        items: [
          { name: 'docs.google.com', seconds: 25 * 60, label: 'on-task' },
          { name: 'reddit.com', seconds: 5 * 60, label: 'off-task' }
        ]
      })
      expect(getPlant(h.db, 'School / Study')?.totalSeconds).toBe(25 * 60)
      // stopped (now pending), summary saved, labeled and grown
      expect(h.events).toEqual([`results:${id}`, `results:${id}`, `results:${id}`, 'garden'])
    })

    it('shows idle time and the item list while classification is pending', async () => {
      const h = harness()
      let release: (labels: ItemLabel[]) => void = () => {}
      h.classify.mockImplementationOnce(
        (req) => new Promise((resolve) => (release = () => resolve(labelByName(req))))
      )
      const task = h.service.start({ name: 'Essay', category: 'School / Study' })
      h.clock.now = T0 + 40 * MIN
      h.service.stop(task.id)
      await vi.waitFor(() => expect(h.classify).toHaveBeenCalled())

      const pending = h.service.getResults(task.id)
      expect(pending.task.status).toBe('pending')
      expect(pending.buckets).toEqual({
        productiveSeconds: null,
        unproductiveSeconds: null,
        idleSeconds: 600
      })
      expect(pending.items.map((i) => i.label)).toEqual([null, null])
      expect(getPlant(h.db, 'School / Study')).toBeUndefined()

      release([])
      await h.service.settled()
      expect(getTask(h.db, task.id)?.status).toBe('done')
    })

    it('sends only app, title and domain for each saved item', async () => {
      const h = harness()
      await runTask(h, 'Essay')
      const request = h.classify.mock.calls[0][0]
      expect(request.taskName).toBe('Essay')
      expect(request.category).toBe('School / Study')
      for (const i of request.items) {
        expect(Object.keys(i).sort()).toEqual(['app', 'domain', 'id', 'title'])
      }
    })

    it('creates the plant on a first task with no productive time', async () => {
      const h = harness({ items: [], idle: [span(0, 40)] })
      h.classify.mockResolvedValue([])
      const id = await runTask(h)
      expect(getTask(h.db, id)?.status).toBe('done')
      expect(getPlant(h.db, 'School / Study')).toMatchObject({ totalSeconds: 0, position: 1 })
      expect(plantState(0)).toMatchObject({ stage: 1, scale: 1 })
    })

    it('does not count overlapping time twice for tasks in the same category', async () => {
      const h = harness()
      await runTask(h, 'First', 'Work')
      await runTask(h, 'Second', 'Work')
      expect(getPlant(h.db, 'Work')?.totalSeconds).toBe(25 * 60)
      expect(getCreditedIntervals(h.db, 'Work')).toEqual([span(0, 25)])
    })

    it('grows each plant for overlapping tasks in different categories', async () => {
      const h = harness()
      await runTask(h, 'Report', 'Work')
      await runTask(h, 'Essay', 'School / Study')
      expect(getPlant(h.db, 'Work')?.totalSeconds).toBe(25 * 60)
      expect(getPlant(h.db, 'School / Study')?.totalSeconds).toBe(25 * 60)
    })

    it('rejects stopping a task that is not active', async () => {
      const h = harness()
      const id = await runTask(h)
      expect(() => h.service.stop(id)).toThrow(`Task ${id} is not active`)
    })

    it('reports a missing task', () => {
      expect(() => harness().service.getResults(999)).toThrow('Task 999 not found')
    })
  })

  describe('retries', () => {
    const retryable = (): ClassificationError => new ClassificationError('overloaded', true)

    it('retries a retryable failure after the first delay', async () => {
      const h = harness()
      h.classify.mockRejectedValueOnce(retryable())
      const id = await runTask(h)
      expect(getTask(h.db, id)?.status).toBe('pending')

      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] - 1)
      expect(h.classify).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await h.service.settled()

      expect(h.classify).toHaveBeenCalledTimes(2)
      expect(getTask(h.db, id)?.status).toBe('done')
      expect(getPlant(h.db, 'School / Study')?.totalSeconds).toBe(25 * 60)
    })

    it('waits 30 s, 1, 2, 5 and 10 min between retries', async () => {
      const h = harness()
      h.classify.mockRejectedValue(retryable())
      await runTask(h)
      expect(RETRY_DELAYS_MS).toEqual([30_000, 60_000, 120_000, 300_000, 600_000])

      for (const [i, delay] of RETRY_DELAYS_MS.entries()) {
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(h.classify).toHaveBeenCalledTimes(i + 1)
        await vi.advanceTimersByTimeAsync(1)
        await h.service.settled()
        expect(h.classify).toHaveBeenCalledTimes(i + 2)
      }
    })

    it('labels everything off-task after 5 failed retries: done, 0 growth, plant created', async () => {
      const h = harness()
      h.classify.mockRejectedValue(retryable())
      const id = await runTask(h)
      for (const delay of RETRY_DELAYS_MS) {
        await vi.advanceTimersByTimeAsync(delay)
        await h.service.settled()
      }

      expect(h.classify).toHaveBeenCalledTimes(6)
      expect(getTask(h.db, id)?.status).toBe('done')
      const results = h.service.getResults(id)
      expect(results.items.every((i) => i.label === 'off-task')).toBe(true)
      expect(results.buckets).toEqual({
        productiveSeconds: 0,
        unproductiveSeconds: 30 * 60,
        idleSeconds: 10 * 60
      })
      expect(getPlant(h.db, 'School / Study')?.totalSeconds).toBe(0)

      await vi.advanceTimersByTimeAsync(60 * MIN)
      expect(h.classify).toHaveBeenCalledTimes(6)
    })

    it('does not retry a non-retryable failure until an API key is saved', async () => {
      const h = harness()
      h.classify.mockRejectedValueOnce(new ClassificationError('No Claude API key is set', false))
      const id = await runTask(h)

      await vi.advanceTimersByTimeAsync(60 * MIN)
      expect(h.classify).toHaveBeenCalledTimes(1)
      expect(getTask(h.db, id)?.status).toBe('pending')

      await h.service.retryPending()
      expect(getTask(h.db, id)?.status).toBe('done')
    })

    it('never falls back to off-task for a missing or rejected key', async () => {
      const h = harness()
      h.classify.mockRejectedValue(new ClassificationError('Claude API key was rejected', false))
      const id = await runTask(h)
      for (let i = 0; i < 8; i++) await h.service.retryPending()
      expect(getTask(h.db, id)?.status).toBe('pending')
      expect(h.service.getResults(id).items.every((i) => i.label === null)).toBe(true)
    })

    it('starts a fresh count of 5 retries on retryPending (app launch or new key)', async () => {
      const h = harness()
      h.classify.mockRejectedValue(retryable())
      const id = await runTask(h)
      for (const delay of RETRY_DELAYS_MS.slice(0, 4)) {
        await vi.advanceTimersByTimeAsync(delay)
        await h.service.settled()
      }
      expect(h.classify).toHaveBeenCalledTimes(5)

      await h.service.retryPending()
      expect(h.classify).toHaveBeenCalledTimes(6)
      expect(getTask(h.db, id)?.status).toBe('pending')

      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
      await h.service.settled()
      expect(h.classify).toHaveBeenCalledTimes(7)
      expect(getTask(h.db, id)?.status).toBe('pending')
    })

    it('tells the UI a task stopped even when ActivityWatch is down', async () => {
      const h = harness()
      h.getSummary.mockRejectedValue(new Error('down'))
      const id = await runTask(h)
      expect(h.events).toEqual([`results:${id}`])
      expect(h.service.listRecent().map((t) => t.id)).toEqual([id])
    })

    it('retries summarizing when ActivityWatch is down, without falling back', async () => {
      const h = harness()
      h.getSummary.mockRejectedValueOnce(new Error('ActivityWatch server is unreachable'))
      h.getSummary.mockRejectedValueOnce(new Error('ActivityWatch server is unreachable'))
      const id = await runTask(h)
      expect(h.classify).not.toHaveBeenCalled()
      expect(h.service.getResults(id).buckets.idleSeconds).toBe(0)

      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
      await h.service.settled()
      expect(getTask(h.db, id)?.status).toBe('pending')
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1])
      await h.service.settled()

      expect(h.getSummary).toHaveBeenCalledTimes(3)
      expect(getTask(h.db, id)?.status).toBe('done')
    })

    it('keeps retrying ActivityWatch past 5 failures at the longest delay', async () => {
      const h = harness()
      h.getSummary.mockRejectedValue(new Error('down'))
      const id = await runTask(h)
      for (const delay of [...RETRY_DELAYS_MS, 600_000, 600_000]) {
        await vi.advanceTimersByTimeAsync(delay)
        await h.service.settled()
      }
      expect(h.getSummary).toHaveBeenCalledTimes(8)
      expect(getTask(h.db, id)?.status).toBe('pending')
    })

    it('stops scheduling after dispose', async () => {
      const h = harness()
      h.classify.mockRejectedValue(retryable())
      await runTask(h)
      h.service.dispose()
      await vi.advanceTimersByTimeAsync(60 * MIN)
      expect(h.classify).toHaveBeenCalledTimes(1)
    })

    it('does not schedule a retry for a failure that lands after dispose', async () => {
      const h = harness()
      let fail: () => void = () => {}
      h.classify.mockImplementationOnce(
        () => new Promise((_, reject) => (fail = () => reject(retryable())))
      )
      const task = h.service.start({ name: 'Essay', category: 'School / Study' })
      h.clock.now = T0 + 40 * MIN
      h.service.stop(task.id)
      await vi.waitFor(() => expect(h.classify).toHaveBeenCalled())

      h.service.dispose()
      fail()
      await h.service.settled()
      await vi.advanceTimersByTimeAsync(60 * MIN)
      expect(h.classify).toHaveBeenCalledTimes(1)
    })

    it('notifies the UI when the off-task fallback completes a task', async () => {
      const h = harness()
      h.classify.mockRejectedValue(retryable())
      const id = await runTask(h)
      for (const delay of RETRY_DELAYS_MS) {
        await vi.advanceTimersByTimeAsync(delay)
        await h.service.settled()
      }
      expect(h.events.slice(-2)).toEqual([`results:${id}`, 'garden'])
    })

    it('does not count an unexpected error as a failed classification', async () => {
      const h = harness()
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      h.classify.mockRejectedValue(new TypeError('bug'))
      const id = await runTask(h)
      await vi.advanceTimersByTimeAsync(60 * MIN)

      expect(h.classify).toHaveBeenCalledTimes(1)
      expect(getTask(h.db, id)?.status).toBe('pending')
      expect(log).toHaveBeenCalledWith(`Task ${id} could not be processed:`, 'bug')
      expect(JSON.stringify(log.mock.calls)).not.toContain('docs.google.com')
      log.mockRestore()
    })
  })

  describe('restarts and races', () => {
    const dirs: string[] = []
    afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

    it('finishes a pending task after the app is reopened', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'focusgarden-'))
      dirs.push(dir)
      const path = join(dir, 'focusgarden.db')

      const first = harness({ db: openDatabase(path) })
      first.classify.mockRejectedValue(new ClassificationError('offline', true))
      const id = await runTask(first)
      const active = first.service.start({ name: 'Still running', category: 'Work' })
      first.service.dispose()
      first.db.close()

      const second = harness({ db: openDatabase(path) })
      expect(second.service.listActive().map((t) => t.id)).toEqual([active.id])
      await second.service.retryPending()
      expect(getTask(second.db, id)?.status).toBe('done')
      expect(second.getSummary).not.toHaveBeenCalled()
      second.db.close()
    })

    it('classifies a task exactly once when stop races with retryPending', async () => {
      const h = harness()
      const task = h.service.start({ name: 'Essay', category: 'School / Study' })
      h.clock.now = T0 + 40 * MIN
      h.service.stop(task.id)
      await Promise.all([h.service.retryPending(), h.service.retryPending()])
      await h.service.settled()
      expect(h.classify).toHaveBeenCalledTimes(1)
      expect(getPlant(h.db, 'School / Study')?.totalSeconds).toBe(25 * 60)
    })

    it('never classifies a done task again', async () => {
      const h = harness()
      await runTask(h)
      await h.service.retryPending()
      expect(h.classify).toHaveBeenCalledTimes(1)
    })
  })

  describe('recent tasks', () => {
    it('lists the 5 most recently stopped tasks, newest first', async () => {
      const h = harness()
      const ids: number[] = []
      for (let i = 0; i < 6; i++) {
        h.clock.now = T0 + i * MIN
        const task = h.service.start({ name: `Task ${i}`, category: 'Work' })
        h.clock.now = T0 + i * MIN + 30_000
        h.service.stop(task.id)
        ids.push(task.id)
      }
      await h.service.settled()
      expect(h.service.listRecent().map((t) => t.id)).toEqual(ids.slice(1).reverse())
    })
  })
})
