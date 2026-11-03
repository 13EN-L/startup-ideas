import type { FocusGardenApi } from '../shared/api'
import { IPC } from '../shared/ipc'

// The parts of ipcRenderer the API uses, so it can be tested without Electron.
export interface IpcLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown
  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown
}

export function createApi(ipc: IpcLike): FocusGardenApi {
  const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
    ipc.invoke(channel, ...args) as Promise<T>

  // Never hand the raw IPC event to the renderer, only the payload.
  const subscribe = (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const listener = (_event: unknown, ...args: unknown[]): void => callback(...args)
    ipc.on(channel, listener)
    return () => {
      ipc.removeListener(channel, listener)
    }
  }

  return {
    tasks: {
      start: (input) => invoke(IPC.tasksStart, input),
      stop: (id) => invoke(IPC.tasksStop, id),
      listActive: () => invoke(IPC.tasksListActive),
      listRecent: () => invoke(IPC.tasksListRecent),
      getResults: (id) => invoke(IPC.tasksGetResults, id)
    },
    garden: {
      getState: () => invoke(IPC.gardenGetState)
    },
    settings: {
      setApiKey: (key) => invoke(IPC.settingsSetApiKey, key),
      hasApiKey: () => invoke(IPC.settingsHasApiKey)
    },
    events: {
      onTaskResults: (callback) =>
        subscribe(IPC.taskResultsReady, (taskId) => callback(taskId as number)),
      onGardenChanged: (callback) => subscribe(IPC.gardenChanged, () => callback())
    }
  }
}
