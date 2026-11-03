import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, withTransaction } from './connection'
import { listActiveTasks } from './tasks'
import { freshDb, startTask, T0 } from './test-helpers'

describe('openDatabase', () => {
  const dirs: string[] = []
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  it('turns on foreign keys', () => {
    expect(freshDb().prepare('PRAGMA foreign_keys').get()).toMatchObject({ foreign_keys: 1 })
  })

  it('keeps active tasks across closing and reopening the app', () => {
    const dir = mkdtempSync(join(tmpdir(), 'focusgarden-'))
    dirs.push(dir)
    const path = join(dir, 'focusgarden.db')

    const first = openDatabase(path)
    startTask(first, { animal: 'Cow' })
    startTask(first, { animal: 'Pig', category: 'Work', startedAt: T0 + 1000 })
    first.close()

    const reopened = openDatabase(path)
    expect(listActiveTasks(reopened).map((t) => t.animal)).toEqual(['Cow', 'Pig'])
    reopened.close()
  })
})

describe('withTransaction', () => {
  it('returns the callback’s result and keeps its writes', () => {
    const db = freshDb()
    const task = withTransaction(db, () => startTask(db))
    expect(listActiveTasks(db)).toEqual([task])
  })

  it('undoes every write when the callback throws', () => {
    const db = freshDb()
    expect(() =>
      withTransaction(db, () => {
        startTask(db, { animal: 'Cow' })
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(listActiveTasks(db)).toEqual([])
  })

  it('nests: an inner failure only undoes the inner writes', () => {
    const db = freshDb()
    withTransaction(db, () => {
      startTask(db, { animal: 'Cow' })
      expect(() =>
        withTransaction(db, () => {
          startTask(db, { animal: 'Pig' })
          throw new Error('inner')
        })
      ).toThrow('inner')
    })
    expect(listActiveTasks(db).map((t) => t.animal)).toEqual(['Cow'])
  })
})
