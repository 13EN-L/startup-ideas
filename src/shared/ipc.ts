// IPC channel names shared by the preload script and the main process handlers.
export const IPC = {
  tasksStart: 'tasks:start',
  tasksStop: 'tasks:stop',
  tasksListActive: 'tasks:list-active',
  tasksListRecent: 'tasks:list-recent',
  tasksGetResults: 'tasks:get-results',
  gardenGetState: 'garden:get-state',
  settingsSetApiKey: 'settings:set-api-key',
  settingsHasApiKey: 'settings:has-api-key',
  // main → renderer events
  taskResultsReady: 'events:task-results',
  gardenChanged: 'events:garden-changed'
} as const
