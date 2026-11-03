import { z } from 'zod'
import { CATEGORIES } from '../shared/domain'
import { IPC } from '../shared/ipc'
import type { GardenState } from '../shared/api'
import type { ApiKeyStore } from './settings/apiKey'
import type { TaskService } from './tasks'

export interface IpcMainLike {
  handle(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): void
}

export interface IpcHandlerDeps {
  service: Pick<
    TaskService,
    'start' | 'stop' | 'listActive' | 'listRecent' | 'getResults' | 'retryPending'
  >
  apiKeys: Pick<ApiKeyStore, 'set' | 'has'>
  getGardenState: () => GardenState
}

// The renderer is untrusted: every argument is validated before it reaches the service.
const StartInput = z.strictObject({
  name: z.string().max(200),
  category: z.enum(CATEGORIES)
})
const TaskId = z.number().int().positive()
const ApiKey = z.string().max(1000)

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error('Invalid request')
  return result.data
}

export function registerIpcHandlers(ipcMain: IpcMainLike, deps: IpcHandlerDeps): void {
  const { service, apiKeys, getGardenState } = deps

  ipcMain.handle(IPC.tasksStart, (_e, input) => service.start(parse(StartInput, input)))
  ipcMain.handle(IPC.tasksStop, (_e, id) => service.stop(parse(TaskId, id)))
  ipcMain.handle(IPC.tasksListActive, () => service.listActive())
  ipcMain.handle(IPC.tasksListRecent, () => service.listRecent())
  ipcMain.handle(IPC.tasksGetResults, (_e, id) => service.getResults(parse(TaskId, id)))
  ipcMain.handle(IPC.gardenGetState, () => getGardenState())
  ipcMain.handle(IPC.settingsSetApiKey, async (_e, key) => {
    apiKeys.set(parse(ApiKey, key))
    await service.retryPending()
  })
  ipcMain.handle(IPC.settingsHasApiKey, () => apiKeys.has())
}
