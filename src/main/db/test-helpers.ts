import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from './connection'
import { insertActiveTask, type TaskRow } from './tasks'
import type { Animal, Category } from '../rewards'

export const T0 = Date.UTC(2026, 10, 2, 14, 0)

export function freshDb(): DatabaseSync {
  return openDatabase(':memory:')
}

export function startTask(
  db: DatabaseSync,
  overrides: Partial<{ name: string; category: Category; animal: Animal; startedAt: number }> = {}
): TaskRow {
  return insertActiveTask(db, {
    name: 'Write essay',
    category: 'School / Study',
    animal: 'Cow',
    startedAt: T0,
    ...overrides
  })
}
