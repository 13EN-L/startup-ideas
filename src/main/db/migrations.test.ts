import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS, runMigrations, userVersion } from './migrations'
import { ANIMALS, CATEGORIES } from '../../shared/domain'

const tableNames = (db: DatabaseSync): string[] =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name))

describe('migrations', () => {
  it('are numbered 1..n with no gaps', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1))
  })

  it('bring a fresh database to the latest version with every table', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db)
    expect(userVersion(db)).toBe(MIGRATIONS.length)
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        'tasks',
        'task_items',
        'task_buckets',
        'plants',
        'credited_intervals'
      ])
    )
  })

  it('do nothing when run again', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db)
    expect(() => runMigrations(db)).not.toThrow()
    expect(userVersion(db)).toBe(MIGRATIONS.length)
  })

  it('roll back a failing migration and keep the old version', () => {
    const db = new DatabaseSync(':memory:')
    const broken = [
      { version: 1, name: 'ok', sql: 'CREATE TABLE a (id INTEGER)' },
      { version: 2, name: 'broken', sql: 'CREATE TABLE b (id INTEGER); NOT VALID SQL' }
    ]
    expect(() => runMigrations(db, broken)).toThrow()
    expect(userVersion(db)).toBe(1)
    expect(tableNames(db)).toEqual(['a'])
  })

  // Migration 1 hardcodes these lists so it never changes. If this fails, the lists in
  // rewards/categories.ts changed: add a new migration instead of editing migration 1.
  it('allow exactly the current categories and animals', () => {
    const sql = MIGRATIONS[0].sql
    for (const value of [...CATEGORIES, ...ANIMALS]) {
      expect(sql).toContain(`'${value}'`)
    }
  })
})
