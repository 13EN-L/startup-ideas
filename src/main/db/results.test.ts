import { describe, expect, it } from 'vitest'
import { getTaskBuckets, getTaskItems, saveLabels, saveTaskBuckets, saveTaskItems } from './results'
import { freshDb, startTask, T0 } from './test-helpers'

const items = [
  {
    name: 'docs.google.com',
    app: 'Google Chrome',
    title: 'Essay draft',
    domain: 'docs.google.com',
    seconds: 600,
    intervals: [{ start: T0, end: T0 + 600_000 }]
  },
  {
    name: 'Spotify',
    app: 'Spotify',
    title: '',
    domain: null,
    seconds: 120.5,
    intervals: [
      { start: T0 + 600_000, end: T0 + 660_000 },
      { start: T0 + 700_000, end: T0 + 760_500 }
    ]
  }
]

describe('task items', () => {
  it('round-trip with intervals and no labels yet', () => {
    const db = freshDb()
    const task = startTask(db)
    saveTaskItems(db, task.id, items)
    expect(getTaskItems(db, task.id)).toEqual(
      items.map((item) => ({ ...item, id: expect.any(Number), label: null }))
    )
  })

  it('are empty for a task without a summary', () => {
    const db = freshDb()
    expect(getTaskItems(db, startTask(db).id)).toEqual([])
  })

  it('save labels once', () => {
    const db = freshDb()
    const task = startTask(db)
    saveTaskItems(db, task.id, items)
    const [docs, spotify] = getTaskItems(db, task.id)

    saveLabels(db, task.id, [
      { itemId: docs.id, label: 'on-task' },
      { itemId: spotify.id, label: 'off-task' }
    ])
    expect(getTaskItems(db, task.id).map((i) => i.label)).toEqual(['on-task', 'off-task'])

    expect(() => saveLabels(db, task.id, [{ itemId: docs.id, label: 'off-task' }])).toThrow(
      'Labels are final'
    )
  })

  it('reject a label for an item from another task', () => {
    const db = freshDb()
    const first = startTask(db, { animal: 'Cow' })
    const second = startTask(db, { animal: 'Pig' })
    saveTaskItems(db, first.id, items)
    const [docs] = getTaskItems(db, first.id)
    expect(() => saveLabels(db, second.id, [{ itemId: docs.id, label: 'on-task' }])).toThrow(
      `Item ${docs.id} is not an item of task ${second.id}`
    )
  })

  it('reject an invalid label', () => {
    const db = freshDb()
    const task = startTask(db)
    saveTaskItems(db, task.id, items)
    const [docs] = getTaskItems(db, task.id)
    expect(() => saveLabels(db, task.id, [{ itemId: docs.id, label: 'maybe' as never }])).toThrow()
  })
})

describe('task buckets', () => {
  it('start with idle only, then fill in once labeled', () => {
    const db = freshDb()
    const task = startTask(db)
    expect(getTaskBuckets(db, task.id)).toBeUndefined()

    saveTaskBuckets(db, task.id, {
      idleSeconds: 30,
      productiveSeconds: null,
      unproductiveSeconds: null
    })
    expect(getTaskBuckets(db, task.id)).toEqual({
      idleSeconds: 30,
      productiveSeconds: null,
      unproductiveSeconds: null
    })

    saveTaskBuckets(db, task.id, {
      idleSeconds: 30,
      productiveSeconds: 600,
      unproductiveSeconds: 120.5
    })
    expect(getTaskBuckets(db, task.id)).toEqual({
      idleSeconds: 30,
      productiveSeconds: 600,
      unproductiveSeconds: 120.5
    })
  })
})
