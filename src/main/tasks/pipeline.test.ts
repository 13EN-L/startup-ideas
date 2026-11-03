import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '../../shared/activity'
import {
  getPlant,
  getTask,
  getTaskBuckets,
  getTaskItems,
  markTaskDone,
  saveLabels,
  stopTask
} from '../db'
import { freshDb, startTask, T0 } from '../db/test-helpers'
import { completeTask, offTaskLabels, saveSummary } from './pipeline'

const summary: ActivitySummary = {
  range: { start: T0, end: T0 + 600_000 },
  items: [
    {
      name: 'docs.google.com',
      app: 'Google Chrome',
      title: 'Essay',
      domain: 'docs.google.com',
      seconds: 300,
      intervals: [{ start: T0, end: T0 + 300_000 }]
    }
  ],
  idleIntervals: [{ start: T0 + 300_000, end: T0 + 600_000 }],
  idleSeconds: 300
}

function pendingTask(): { db: ReturnType<typeof freshDb>; id: number } {
  const db = freshDb()
  const task = startTask(db)
  stopTask(db, task.id, T0 + 600_000)
  return { db, id: task.id }
}

describe('saveSummary', () => {
  it('saves items and idle time only once', () => {
    const { db, id } = pendingTask()
    saveSummary(db, getTask(db, id)!, summary)
    saveSummary(db, getTask(db, id)!, summary)
    expect(getTaskItems(db, id)).toHaveLength(1)
    expect(getTaskBuckets(db, id)).toEqual({
      idleSeconds: 300,
      productiveSeconds: null,
      unproductiveSeconds: null
    })
  })

  it('does nothing for a task that is no longer pending', () => {
    const { db, id } = pendingTask()
    const task = getTask(db, id)!
    markTaskDone(db, id)
    saveSummary(db, task, summary)
    expect(getTaskItems(db, id)).toEqual([])
    expect(getTaskBuckets(db, id)).toBeUndefined()
  })
})

describe('completeTask', () => {
  it('labels, grows the plant, and marks the task done', () => {
    const { db, id } = pendingTask()
    saveSummary(db, getTask(db, id)!, summary)
    const [docs] = getTaskItems(db, id)

    expect(completeTask(db, id, [{ id: docs.id, label: 'on-task' }])).toBe(true)
    expect(getTask(db, id)?.status).toBe('done')
    expect(getPlant(db, 'School / Study')?.totalSeconds).toBe(300)
    expect(getTaskBuckets(db, id)).toEqual({
      idleSeconds: 300,
      productiveSeconds: 300,
      unproductiveSeconds: 0
    })
  })

  it('never completes a task twice', () => {
    const { db, id } = pendingTask()
    saveSummary(db, getTask(db, id)!, summary)
    const [docs] = getTaskItems(db, id)
    completeTask(db, id, [{ id: docs.id, label: 'on-task' }])

    expect(completeTask(db, id, [{ id: docs.id, label: 'on-task' }])).toBe(false)
    expect(getPlant(db, 'School / Study')?.totalSeconds).toBe(300)
  })

  it('returns false for a missing task', () => {
    expect(completeTask(freshDb(), 999, [])).toBe(false)
  })

  it('rolls everything back when an item is left unlabeled', () => {
    const { db, id } = pendingTask()
    saveSummary(db, getTask(db, id)!, {
      ...summary,
      items: [...summary.items, { ...summary.items[0], name: 'other', title: 'Other' }]
    })
    const [docs] = getTaskItems(db, id)

    expect(() => completeTask(db, id, [{ id: docs.id, label: 'on-task' }])).toThrow(
      /^Item \d+ of task \d+ has no label$/
    )
    expect(getTask(db, id)?.status).toBe('pending')
    expect(getTaskItems(db, id).map((i) => i.label)).toEqual([null, null])
    expect(getPlant(db, 'School / Study')).toBeUndefined()
  })

  it('completes a task that has no summary row with 0 idle time', () => {
    const { db, id } = pendingTask()
    expect(completeTask(db, id, [])).toBe(true)
    expect(getTaskBuckets(db, id)).toEqual({
      idleSeconds: 0,
      productiveSeconds: 0,
      unproductiveSeconds: 0
    })
  })
})

describe('offTaskLabels', () => {
  it('labels every item off-task', () => {
    const { db, id } = pendingTask()
    saveSummary(db, getTask(db, id)!, summary)
    const labels = offTaskLabels(db, id)
    expect(labels).toEqual(getTaskItems(db, id).map((i) => ({ id: i.id, label: 'off-task' })))
    saveLabels(
      db,
      id,
      labels.map(({ id: itemId, label }) => ({ itemId, label }))
    )
  })
})
