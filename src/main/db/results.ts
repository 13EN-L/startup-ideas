import type { DatabaseSync } from 'node:sqlite'
import type { Interval, Label } from '../rewards'
import { withTransaction } from './transaction'

// One app or website/search from a task's activity summary.
export interface NewTaskItem {
  name: string
  app: string
  title: string
  domain: string | null
  seconds: number
  intervals: Interval[]
}

export interface TaskItem extends NewTaskItem {
  id: number
  label: Label | null // null until Claude's results arrive
}

export interface TaskBuckets {
  idleSeconds: number
  productiveSeconds: number | null // null until labeled
  unproductiveSeconds: number | null
}

export function saveTaskItems(db: DatabaseSync, taskId: number, items: NewTaskItem[]): void {
  const insert = db.prepare(
    `INSERT INTO task_items (task_id, name, app, title, domain, seconds, intervals_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  withTransaction(db, () => {
    for (const item of items) {
      insert.run(
        taskId,
        item.name,
        item.app,
        item.title,
        item.domain,
        item.seconds,
        JSON.stringify(item.intervals)
      )
    }
  })
}

export function getTaskItems(db: DatabaseSync, taskId: number): TaskItem[] {
  return db
    .prepare(
      `SELECT id, name, app, title, domain, seconds, label, intervals_json
       FROM task_items WHERE task_id = ? ORDER BY id`
    )
    .all(taskId)
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      app: String(row.app),
      title: String(row.title),
      domain: row.domain === null ? null : String(row.domain),
      seconds: Number(row.seconds),
      label: row.label as Label | null,
      intervals: JSON.parse(String(row.intervals_json)) as Interval[]
    }))
}

// Labels are final: the schema rejects changing one that is already set.
export function saveLabels(
  db: DatabaseSync,
  taskId: number,
  labels: { itemId: number; label: Label }[]
): void {
  const update = db.prepare('UPDATE task_items SET label = ? WHERE id = ? AND task_id = ?')
  withTransaction(db, () => {
    for (const { itemId, label } of labels) {
      const { changes } = update.run(label, itemId, taskId)
      if (Number(changes) === 0) throw new Error(`Item ${itemId} is not an item of task ${taskId}`)
    }
  })
}

export function saveTaskBuckets(db: DatabaseSync, taskId: number, buckets: TaskBuckets): void {
  db.prepare(
    `INSERT INTO task_buckets (task_id, idle_seconds, productive_seconds, unproductive_seconds)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (task_id) DO UPDATE SET
       idle_seconds = excluded.idle_seconds,
       productive_seconds = excluded.productive_seconds,
       unproductive_seconds = excluded.unproductive_seconds`
  ).run(taskId, buckets.idleSeconds, buckets.productiveSeconds, buckets.unproductiveSeconds)
}

export function getTaskBuckets(db: DatabaseSync, taskId: number): TaskBuckets | undefined {
  const row = db
    .prepare(
      `SELECT idle_seconds, productive_seconds, unproductive_seconds
       FROM task_buckets WHERE task_id = ?`
    )
    .get(taskId)
  if (!row) return undefined
  const orNull = (value: unknown): number | null => (value === null ? null : Number(value))
  return {
    idleSeconds: Number(row.idle_seconds),
    productiveSeconds: orNull(row.productive_seconds),
    unproductiveSeconds: orNull(row.unproductive_seconds)
  }
}
