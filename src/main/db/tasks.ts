import type { DatabaseSync } from 'node:sqlite'
import type { Animal, Category } from '../rewards'

export type TaskStatus = 'active' | 'pending' | 'done'

// Times are UTC epoch milliseconds.
export interface TaskRow {
  id: number
  name: string
  category: Category
  animal: Animal
  startedAt: number
  stoppedAt: number | null
  status: TaskStatus
}

const COLUMNS = 'id, name, category, animal, started_at, stopped_at, status'

function toTask(row: Record<string, unknown>): TaskRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    category: row.category as Category,
    animal: row.animal as Animal,
    startedAt: Number(row.started_at),
    stoppedAt: row.stopped_at === null ? null : Number(row.stopped_at),
    status: row.status as TaskStatus
  }
}

export function insertActiveTask(
  db: DatabaseSync,
  task: { name: string; category: Category; animal: Animal; startedAt: number }
): TaskRow {
  const row = db
    .prepare(
      `INSERT INTO tasks (name, category, animal, started_at, status)
       VALUES (?, ?, ?, ?, 'active') RETURNING ${COLUMNS}`
    )
    .get(task.name, task.category, task.animal, task.startedAt)
  return toTask(row as Record<string, unknown>)
}

export function stopTask(db: DatabaseSync, id: number, stoppedAt: number): void {
  const { changes } = db
    .prepare(
      `UPDATE tasks SET stopped_at = ?, status = 'pending' WHERE id = ? AND status = 'active'`
    )
    .run(stoppedAt, id)
  if (Number(changes) === 0) throw new Error(`Task ${id} is not active`)
}

export function markTaskDone(db: DatabaseSync, id: number): void {
  const { changes } = db
    .prepare(`UPDATE tasks SET status = 'done' WHERE id = ? AND status = 'pending'`)
    .run(id)
  if (Number(changes) === 0) throw new Error(`Task ${id} is not pending`)
}

export function getTask(db: DatabaseSync, id: number): TaskRow | undefined {
  const row = db.prepare(`SELECT ${COLUMNS} FROM tasks WHERE id = ?`).get(id)
  return row ? toTask(row) : undefined
}

export function listActiveTasks(db: DatabaseSync): TaskRow[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM tasks WHERE status = 'active' ORDER BY started_at, id`)
    .all()
    .map(toTask)
}

export function listPendingTasks(db: DatabaseSync): TaskRow[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM tasks WHERE status = 'pending' ORDER BY stopped_at, id`)
    .all()
    .map(toTask)
}

// Feeds the recent-task clouds: the most recently stopped tasks, newest first.
export function listRecentStoppedTasks(db: DatabaseSync, limit = 5): TaskRow[] {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM tasks WHERE stopped_at IS NOT NULL
       ORDER BY stopped_at DESC, id DESC LIMIT ?`
    )
    .all(limit)
    .map(toTask)
}
