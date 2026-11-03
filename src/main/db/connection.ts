import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'

export { withTransaction } from './transaction'

// Opens (or creates) the app database and brings its schema up to date.
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true })
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  runMigrations(db)
  return db
}
