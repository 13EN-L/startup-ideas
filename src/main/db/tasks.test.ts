import { describe, expect, it } from 'vitest'
import {
  getTask,
  listActiveTasks,
  listPendingTasks,
  listRecentStoppedTasks,
  markTaskDone,
  stopTask
} from './tasks'
import { freshDb, startTask, T0 } from './test-helpers'
import type { Animal } from '../../shared/domain'

describe('tasks', () => {
  it('saves an active task with its exact UTC start time', () => {
    const db = freshDb()
    const task = startTask(db, { name: 'Read chapter 3', category: 'Personal Growth' })
    expect(task).toEqual({
      id: expect.any(Number),
      name: 'Read chapter 3',
      category: 'Personal Growth',
      animal: 'Cow',
      startedAt: T0,
      stoppedAt: null,
      status: 'active'
    })
    expect(getTask(db, task.id)).toEqual(task)
  })

  it('returns undefined for a missing task', () => {
    expect(getTask(freshDb(), 999)).toBeUndefined()
  })

  it('stops a task: saves the stop time and waits for results', () => {
    const db = freshDb()
    const task = startTask(db)
    stopTask(db, task.id, T0 + 60_000)
    expect(getTask(db, task.id)).toMatchObject({ stoppedAt: T0 + 60_000, status: 'pending' })
    expect(listActiveTasks(db)).toEqual([])
    expect(listPendingTasks(db).map((t) => t.id)).toEqual([task.id])
  })

  it('marks a pending task done', () => {
    const db = freshDb()
    const task = startTask(db)
    stopTask(db, task.id, T0 + 1000)
    markTaskDone(db, task.id)
    expect(getTask(db, task.id)?.status).toBe('done')
    expect(listPendingTasks(db)).toEqual([])
  })

  it('allows at most 3 active tasks', () => {
    const db = freshDb()
    const animals: Animal[] = ['Cow', 'Pig', 'Duck']
    const tasks = animals.map((animal) => startTask(db, { animal }))
    expect(() => startTask(db, { animal: 'Goat' })).toThrow('At most 3 tasks can be active')

    stopTask(db, tasks[0].id, T0 + 1000)
    expect(() => startTask(db, { animal: 'Goat' })).not.toThrow()
  })

  it('never gives two active tasks the same animal', () => {
    const db = freshDb()
    const cow = startTask(db, { animal: 'Cow' })
    expect(() => startTask(db, { animal: 'Cow' })).toThrow()

    stopTask(db, cow.id, T0 + 1000)
    expect(() => startTask(db, { animal: 'Cow' })).not.toThrow()
  })

  it('rejects unknown categories and animals, and empty names', () => {
    const db = freshDb()
    expect(() => startTask(db, { category: 'Gaming' as never })).toThrow()
    expect(() => startTask(db, { animal: 'Llama' as never })).toThrow()
    expect(() => startTask(db, { name: '' })).toThrow()
  })

  it('rejects a stop time before the start time', () => {
    const db = freshDb()
    const task = startTask(db)
    expect(() => stopTask(db, task.id, T0 - 1)).toThrow()
    expect(getTask(db, task.id)?.status).toBe('active')
  })

  it('only stops active tasks and only completes pending ones', () => {
    const db = freshDb()
    const task = startTask(db)
    expect(() => markTaskDone(db, task.id)).toThrow(`Task ${task.id} is not pending`)
    stopTask(db, task.id, T0 + 1000)
    expect(() => stopTask(db, task.id, T0 + 2000)).toThrow(`Task ${task.id} is not active`)
    expect(() => stopTask(db, 999, T0)).toThrow('Task 999 is not active')
  })

  it('never moves a task backwards, so labeled tasks are not classified again', () => {
    const db = freshDb()
    const task = startTask(db)
    stopTask(db, task.id, T0 + 1000)
    markTaskDone(db, task.id)
    expect(() =>
      db.prepare("UPDATE tasks SET status = 'pending' WHERE id = ?").run(task.id)
    ).toThrow('Task status can only move forward')
  })

  it('lists the 5 most recently stopped tasks, newest first', () => {
    const db = freshDb()
    const ids: number[] = []
    for (let i = 0; i < 7; i++) {
      const task = startTask(db, { name: `Task ${i}`, startedAt: T0 + i * 10_000 })
      stopTask(db, task.id, T0 + i * 10_000 + 5000)
      ids.push(task.id)
    }
    startTask(db, { name: 'Still running', startedAt: T0 + 100_000 })

    expect(listRecentStoppedTasks(db).map((t) => t.id)).toEqual(ids.slice(2).reverse())
    expect(listRecentStoppedTasks(db, 2).map((t) => t.id)).toEqual([ids[6], ids[5]])
  })

  it('lists active tasks in start order', () => {
    const db = freshDb()
    startTask(db, { animal: 'Pig', startedAt: T0 + 2000 })
    startTask(db, { animal: 'Cow', startedAt: T0 })
    expect(listActiveTasks(db).map((t) => t.animal)).toEqual(['Cow', 'Pig'])
  })
})
