import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { DatabaseSync } from 'node:sqlite'
import { IPC } from '../shared/ipc'
import { createActivityReader } from './activity'
import { createClassifier } from './classifier'
import { openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { createApiKeyStore } from './settings/apiKey'
import { createTaskService, getGardenState, type TaskService } from './tasks'

let db: DatabaseSync | undefined
let service: TaskService | undefined

function sendToAllWindows(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => window.webContents.send(channel, ...args))
}

function startBackend(): TaskService {
  const userData = app.getPath('userData')
  const database = openDatabase(join(userData, 'focusgarden.db'))
  db = database
  const activity = createActivityReader()
  const apiKeys = createApiKeyStore({
    filePath: join(userData, 'claude-api-key.bin'),
    safeStorage,
    fs: { existsSync, readFileSync, writeFileSync, rmSync }
  })
  const tasks = createTaskService({
    db: database,
    activity,
    // With no key saved, the classifier fails as non-retryable and the task waits for one.
    getClassifier: () => createClassifier({ apiKey: apiKeys.get() ?? '' }),
    notify: {
      taskResults: (taskId) => sendToAllWindows(IPC.taskResultsReady, taskId),
      gardenChanged: () => sendToAllWindows(IPC.gardenChanged)
    }
  })
  registerIpcHandlers(ipcMain, {
    service: tasks,
    apiKeys,
    getGardenState: () => getGardenState(database)
  })
  void activity.isServerRunning().then((running) => {
    if (!running) console.warn('ActivityWatch is not running; task activity will be retried')
  })
  return tasks
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  service = startBackend()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  void service.retryPending()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  service?.dispose()
  service = undefined
  db?.close()
  db = undefined
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
