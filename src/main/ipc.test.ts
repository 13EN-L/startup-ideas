import { describe, expect, it, vi } from 'vitest'
import { IPC } from '../shared/ipc'
import { registerIpcHandlers, type IpcHandlerDeps } from './ipc'

type Handler = (event: unknown, ...args: unknown[]) => unknown

function setup(): { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } & {
  deps: IpcHandlerDeps
} {
  const handlers = new Map<string, Handler>()
  const deps: IpcHandlerDeps = {
    service: {
      start: vi.fn(() => ({ id: 1 }) as never),
      stop: vi.fn(),
      listActive: vi.fn(() => []),
      listRecent: vi.fn(() => []),
      getResults: vi.fn(() => ({ id: 1 }) as never),
      retryPending: vi.fn(async () => {})
    },
    apiKeys: { set: vi.fn(), has: vi.fn(() => true) },
    getGardenState: vi.fn(() => ({ plants: [], globalPrestige: 0, trophies: [] }))
  }
  registerIpcHandlers({ handle: (channel, handler) => void handlers.set(channel, handler) }, deps)
  return {
    deps,
    invoke: async (channel, ...args) => handlers.get(channel)!({}, ...args)
  }
}

describe('ipc handlers', () => {
  it('registers a handler for every request channel', () => {
    const handlers: string[] = []
    registerIpcHandlers({ handle: (channel) => void handlers.push(channel) }, setup().deps)
    const requestChannels = Object.values(IPC).filter((c) => !c.startsWith('events:'))
    expect(handlers.sort()).toEqual([...requestChannels].sort())
  })

  it('delegates task calls to the service', async () => {
    const { invoke, deps } = setup()
    await invoke(IPC.tasksStart, { name: 'Essay', category: 'Work' })
    await invoke(IPC.tasksStop, 3)
    await invoke(IPC.tasksListActive)
    await invoke(IPC.tasksListRecent)
    await invoke(IPC.tasksGetResults, 3)
    expect(deps.service.start).toHaveBeenCalledWith({ name: 'Essay', category: 'Work' })
    expect(deps.service.stop).toHaveBeenCalledWith(3)
    expect(deps.service.listActive).toHaveBeenCalled()
    expect(deps.service.listRecent).toHaveBeenCalled()
    expect(deps.service.getResults).toHaveBeenCalledWith(3)
  })

  it('returns the garden state', async () => {
    const { invoke } = setup()
    expect(await invoke(IPC.gardenGetState)).toEqual({
      plants: [],
      globalPrestige: 0,
      trophies: []
    })
  })

  it('saves the API key, then retries pending tasks, without returning the key', async () => {
    const { invoke, deps } = setup()
    expect(await invoke(IPC.settingsSetApiKey, 'sk-ant-key')).toBeUndefined()
    expect(deps.apiKeys.set).toHaveBeenCalledWith('sk-ant-key')
    expect(deps.service.retryPending).toHaveBeenCalled()
    expect(await invoke(IPC.settingsHasApiKey)).toBe(true)
  })

  it.each([
    [IPC.tasksStart, [{ name: 'Essay', category: 'Gaming' }]],
    [IPC.tasksStart, [{ name: 42, category: 'Work' }]],
    [IPC.tasksStart, [{ name: 'x'.repeat(201), category: 'Work' }]],
    [IPC.tasksStart, [{ name: 'Essay', category: 'Work', extra: true }]],
    [IPC.tasksStop, ['3']],
    [IPC.tasksStop, [1.5]],
    [IPC.tasksGetResults, [-1]],
    [IPC.settingsSetApiKey, [{ key: 'x' }]]
  ])('rejects invalid input on %s', async (channel, args) => {
    const { invoke, deps } = setup()
    await expect(invoke(channel, ...args)).rejects.toThrow('Invalid request')
    expect(deps.service.start).not.toHaveBeenCalled()
    expect(deps.service.stop).not.toHaveBeenCalled()
    expect(deps.service.getResults).not.toHaveBeenCalled()
    expect(deps.apiKeys.set).not.toHaveBeenCalled()
  })
})
