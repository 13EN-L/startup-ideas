import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createApi, type IpcLike } from './api'
import { IPC } from '../shared/ipc'
import type { FocusGardenApi } from '../shared/api'

function fakeIpc(): IpcLike & { emit(channel: string, ...args: unknown[]): void } {
  const listeners = new Map<string, Set<(event: unknown, ...args: unknown[]) => void>>()
  return {
    invoke: vi.fn(async () => 'result'),
    on(channel, listener) {
      if (!listeners.has(channel)) listeners.set(channel, new Set())
      listeners.get(channel)!.add(listener)
      return this
    },
    removeListener(channel, listener) {
      listeners.get(channel)?.delete(listener)
      return this
    },
    emit(channel, ...args) {
      listeners.get(channel)?.forEach((listener) => listener({}, ...args))
    }
  }
}

describe('preload api', () => {
  it('matches the shared FocusGardenApi contract', () => {
    expectTypeOf(createApi(fakeIpc())).toEqualTypeOf<FocusGardenApi>()
  })

  it.each([
    [
      'tasks.start',
      IPC.tasksStart,
      (api: FocusGardenApi) => api.tasks.start({ name: 'Essay', category: 'Work' }),
      [{ name: 'Essay', category: 'Work' }]
    ],
    ['tasks.stop', IPC.tasksStop, (api: FocusGardenApi) => api.tasks.stop(7), [7]],
    ['tasks.listActive', IPC.tasksListActive, (api: FocusGardenApi) => api.tasks.listActive(), []],
    ['tasks.listRecent', IPC.tasksListRecent, (api: FocusGardenApi) => api.tasks.listRecent(), []],
    [
      'tasks.getResults',
      IPC.tasksGetResults,
      (api: FocusGardenApi) => api.tasks.getResults(7),
      [7]
    ],
    ['garden.getState', IPC.gardenGetState, (api: FocusGardenApi) => api.garden.getState(), []],
    [
      'settings.setApiKey',
      IPC.settingsSetApiKey,
      (api: FocusGardenApi) => api.settings.setApiKey('k'),
      ['k']
    ],
    [
      'settings.hasApiKey',
      IPC.settingsHasApiKey,
      (api: FocusGardenApi) => api.settings.hasApiKey(),
      []
    ]
  ] as const)('%s invokes %s', async (_name, channel, call, args) => {
    const ipc = fakeIpc()
    await expect(call(createApi(ipc))).resolves.toBe('result')
    expect(ipc.invoke).toHaveBeenCalledWith(channel, ...args)
  })

  it('delivers task-results events until unsubscribed', () => {
    const ipc = fakeIpc()
    const api = createApi(ipc)
    const callback = vi.fn()
    const unsubscribe = api.events.onTaskResults(callback)

    ipc.emit(IPC.taskResultsReady, 42)
    unsubscribe()
    ipc.emit(IPC.taskResultsReady, 43)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
  })

  it('delivers garden-changed events without the IPC event object', () => {
    const ipc = fakeIpc()
    const callback = vi.fn()
    const unsubscribe = createApi(ipc).events.onGardenChanged(callback)

    ipc.emit(IPC.gardenChanged)
    unsubscribe()
    ipc.emit(IPC.gardenChanged)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith()
  })
})
