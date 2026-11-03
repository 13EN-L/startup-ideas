import type { DatabaseSync } from 'node:sqlite'

// Runs fn atomically: all of its writes are kept, or none are if it throws. Uses a
// savepoint, so calls can nest and an inner failure only undoes the inner writes.
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('SAVEPOINT focusgarden_tx')
  try {
    const result = fn()
    db.exec('RELEASE focusgarden_tx')
    return result
  } catch (error) {
    db.exec('ROLLBACK TO focusgarden_tx')
    db.exec('RELEASE focusgarden_tx')
    throw error
  }
}
