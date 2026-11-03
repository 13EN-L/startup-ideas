import type { DatabaseSync } from 'node:sqlite'
import type { Category, Interval } from '../rewards'
import { withTransaction } from './transaction'

export interface PlantRow {
  category: Category
  totalSeconds: number
  position: number // 1 for the first plant that appeared, 2 for the next, ...
}

function toPlant(row: Record<string, unknown>): PlantRow {
  return {
    category: row.category as Category,
    totalSeconds: Number(row.total_seconds),
    position: Number(row.position)
  }
}

export function getPlant(db: DatabaseSync, category: Category): PlantRow | undefined {
  const row = db
    .prepare('SELECT category, total_seconds, position FROM plants WHERE category = ?')
    .get(category)
  return row ? toPlant(row) : undefined
}

// Creates the plant at the end of the garden on first use; afterwards only the total changes.
export function upsertPlantTotal(db: DatabaseSync, category: Category, totalSeconds: number): void {
  db.prepare(
    `INSERT INTO plants (category, total_seconds, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM plants))
     ON CONFLICT (category) DO UPDATE SET total_seconds = excluded.total_seconds`
  ).run(category, totalSeconds)
}

export function listPlants(db: DatabaseSync): PlantRow[] {
  return db
    .prepare('SELECT category, total_seconds, position FROM plants ORDER BY position')
    .all()
    .map(toPlant)
}

export function getCreditedIntervals(db: DatabaseSync, category: Category): Interval[] {
  return db
    .prepare('SELECT start_at, end_at FROM credited_intervals WHERE category = ? ORDER BY start_at')
    .all(category)
    .map((row) => ({ start: Number(row.start_at), end: Number(row.end_at) }))
}

// Stores the category's full credited list (as returned by applyGrowth), replacing the old one.
export function replaceCreditedIntervals(
  db: DatabaseSync,
  category: Category,
  intervals: readonly Interval[]
): void {
  const insert = db.prepare(
    'INSERT INTO credited_intervals (category, start_at, end_at) VALUES (?, ?, ?)'
  )
  withTransaction(db, () => {
    db.prepare('DELETE FROM credited_intervals WHERE category = ?').run(category)
    for (const { start, end } of intervals) insert.run(category, start, end)
  })
}
