import Anthropic from '@anthropic-ai/sdk';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { loadState, saveState } from '../core/persistence';
import { IPC } from '../shared/bridge';
import type { ActiveTask, AppState } from '../shared/types';
import { ActivityWatchClient } from './activitywatch/client';
import { createAnthropicClassifierModel } from './classifier/anthropicModel';
import { fakeProcessCompletedTask } from './fakeServices';
import { processCompletedTask } from './pipeline';
import { createFileStore } from './storage/fileStore';

// Lets e2e tests isolate each run's saved state.
if (process.env.FOCUSGARDEN_USER_DATA) {
  app.setPath('userData', process.env.FOCUSGARDEN_USER_DATA);
}

const useFakeServices = process.env.FOCUSGARDEN_FAKE_SERVICES === '1';

function registerIpc() {
  const store = createFileStore(path.join(app.getPath('userData'), 'focusgarden-state.json'));

  ipcMain.handle(IPC.loadState, () => loadState(store));
  ipcMain.handle(IPC.saveState, (_event, state: AppState) => saveState(store, state));

  if (useFakeServices) {
    ipcMain.handle(IPC.finishTask, (_event, task: ActiveTask, endedAt: number) =>
      fakeProcessCompletedTask(task, endedAt),
    );
    return;
  }

  const deps = {
    activityWatch: new ActivityWatchClient(),
    classifier: createAnthropicClassifierModel(new Anthropic()),
  };
  ipcMain.handle(IPC.finishTask, (_event, task: ActiveTask, endedAt: number) =>
    processCompletedTask(deps, task, endedAt),
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'FocusGarden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

void app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
