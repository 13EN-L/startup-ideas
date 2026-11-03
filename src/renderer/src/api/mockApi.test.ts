import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockApi } from './mockApi'

describe('mock api', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts tasks with different animals, at most 3 at a time', async () => {
    const api = createMockApi({ activeTasks: 0 })
    const tasks = await Promise.all([
      api.tasks.start({ name: 'A', category: 'Work' }),
      api.tasks.start({ name: 'B', category: 'Home' }),
      api.tasks.start({ name: 'C', category: 'Finance' })
    ])
    expect(new Set(tasks.map((t) => t.animal)).size).toBe(3)
    await expect(api.tasks.start({ name: 'D', category: 'Work' })).rejects.toThrow(
      'At most 3 tasks can be active'
    )
    expect(await api.tasks.listActive()).toHaveLength(3)
  })

  it('shows pending results right after stop, then labels them and notifies', async () => {
    const api = createMockApi({ activeTasks: 0, resultDelayMs: 1000 })
    const onResults = vi.fn()
    const onGarden = vi.fn()
    api.events.onTaskResults(onResults)
    api.events.onGardenChanged(onGarden)

    const task = await api.tasks.start({ name: 'Essay', category: 'School / Study' })
    await api.tasks.stop(task.id)

    const pending = await api.tasks.getResults(task.id)
    expect(pending.task.status).toBe('pending')
    expect(pending.buckets.productiveSeconds).toBeNull()
    expect(pending.buckets.idleSeconds).toBeGreaterThanOrEqual(0)
    expect(pending.items.length).toBeGreaterThan(0)
    expect(pending.items.every((item) => item.label === null)).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)

    const done = await api.tasks.getResults(task.id)
    expect(done.task.status).toBe('done')
    expect(done.buckets.productiveSeconds).not.toBeNull()
    expect(done.items.every((item) => item.label !== null)).toBe(true)
    expect(onResults).toHaveBeenCalledWith(task.id)
    expect(onGarden).toHaveBeenCalled()
    expect((await api.tasks.listRecent())[0].id).toBe(task.id)
  })

  it('keeps at most 5 recent tasks, newest first', async () => {
    const api = createMockApi({ activeTasks: 0 })
    for (let i = 0; i < 7; i++) {
      const task = await api.tasks.start({ name: `Task ${i}`, category: 'Work' })
      await api.tasks.stop(task.id)
    }
    const recent = await api.tasks.listRecent()
    expect(recent.map((t) => t.name)).toEqual(['Task 6', 'Task 5', 'Task 4', 'Task 3', 'Task 2'])
  })

  it('comes with sample data: active tasks, recent tasks, and a garden', async () => {
    const api = createMockApi()
    expect((await api.tasks.listActive()).length).toBeGreaterThan(0)
    expect(await api.tasks.listRecent()).toHaveLength(5)
    const garden = await api.garden.getState()
    expect(garden.plants.map((p) => p.position)).toEqual(garden.plants.map((_, i) => i + 1))
    expect(garden.trophies).toEqual(['bronze'])
  })

  it('stores whether an API key is set, never returning it', async () => {
    const api = createMockApi()
    expect(await api.settings.hasApiKey()).toBe(false)
    await api.settings.setApiKey('sk-test')
    expect(await api.settings.hasApiKey()).toBe(true)
  })

  it('rejects unknown task ids', async () => {
    const api = createMockApi()
    await expect(api.tasks.getResults(999)).rejects.toThrow('Task 999 not found')
    await expect(api.tasks.stop(999)).rejects.toThrow('Task 999 is not active')
  })
})
