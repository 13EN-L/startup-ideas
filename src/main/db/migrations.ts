import type { DatabaseSync } from 'node:sqlite'
import { withTransaction } from './transaction'

export interface Migration {
  version: number
  name: string
  sql: string
}

// Append only. Never edit a migration that has shipped: add a new one instead. Lists of
// categories and animals are written out literally so old migrations never change.
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        category TEXT NOT NULL CHECK (category IN (
          'Work', 'School / Study', 'Health & Fitness', 'Finance', 'Home', 'Relationships',
          'Personal Growth', 'Creative', 'Career Development', 'Self-Care'
        )),
        animal TEXT NOT NULL CHECK (animal IN (
          'Cow', 'Horse', 'Pig', 'Sheep', 'Dog', 'Duck', 'Chicken', 'Donkey', 'Goat', 'Cat'
        )),
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'done')),
        CHECK ((status = 'active') = (stopped_at IS NULL)),
        CHECK (stopped_at IS NULL OR stopped_at >= started_at)
      ) STRICT;

      CREATE UNIQUE INDEX tasks_active_animal ON tasks (animal) WHERE status = 'active';
      CREATE INDEX tasks_stopped_at ON tasks (stopped_at);

      CREATE TRIGGER tasks_max_active BEFORE INSERT ON tasks
      WHEN NEW.status = 'active' AND (SELECT COUNT(*) FROM tasks WHERE status = 'active') >= 3
      BEGIN
        SELECT RAISE(ABORT, 'At most 3 tasks can be active');
      END;

      CREATE TRIGGER tasks_status_forward BEFORE UPDATE OF status ON tasks
      WHEN NOT (
        OLD.status = NEW.status
        OR (OLD.status = 'active' AND NEW.status = 'pending')
        OR (OLD.status = 'pending' AND NEW.status = 'done')
      )
      BEGIN
        SELECT RAISE(ABORT, 'Task status can only move forward');
      END;

      CREATE TABLE task_items (
        id INTEGER PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        app TEXT NOT NULL,
        title TEXT NOT NULL,
        domain TEXT,
        seconds REAL NOT NULL CHECK (seconds >= 0),
        label TEXT CHECK (label IN ('on-task', 'off-task')),
        intervals_json TEXT NOT NULL CHECK (json_valid(intervals_json))
      ) STRICT;

      CREATE INDEX task_items_task ON task_items (task_id);

      CREATE TRIGGER task_items_labels_final BEFORE UPDATE OF label ON task_items
      WHEN OLD.label IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'Labels are final');
      END;

      CREATE TABLE task_buckets (
        task_id INTEGER PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
        idle_seconds REAL NOT NULL CHECK (idle_seconds >= 0),
        productive_seconds REAL CHECK (productive_seconds >= 0),
        unproductive_seconds REAL CHECK (unproductive_seconds >= 0)
      ) STRICT;

      CREATE TABLE plants (
        category TEXT PRIMARY KEY CHECK (category IN (
          'Work', 'School / Study', 'Health & Fitness', 'Finance', 'Home', 'Relationships',
          'Personal Growth', 'Creative', 'Career Development', 'Self-Care'
        )),
        total_seconds REAL NOT NULL CHECK (total_seconds >= 0),
        position INTEGER NOT NULL UNIQUE
      ) STRICT;

      CREATE TABLE credited_intervals (
        id INTEGER PRIMARY KEY,
        category TEXT NOT NULL REFERENCES plants (category) ON DELETE CASCADE,
        start_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        CHECK (end_at > start_at)
      ) STRICT;

      CREATE INDEX credited_intervals_category ON credited_intervals (category, start_at);
    `
  }
]

export function userVersion(db: DatabaseSync): number {
  return Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0)
}

// Applies every migration newer than the database, each in its own transaction.
export function runMigrations(
  db: DatabaseSync,
  migrations: readonly Migration[] = MIGRATIONS
): void {
  const current = userVersion(db)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    withTransaction(db, () => {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${migration.version}`)
    })
  }
}
