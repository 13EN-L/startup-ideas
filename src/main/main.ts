import Anthropic from '@anthropic-ai/sdk';
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import path from 'node:path';
import { loadState, saveState } from '../core/persistence';
import { EXTERNAL_LINKS, IPC, type ExternalLink, type SetupStatus } from '../shared/bridge';
import type { ActiveTask, AppState } from '../shared/types';
import { ActivityWatchClient } from './activitywatch/client';
import { createAnthropicClassifierModel } from './classifier/anthropicModel';
import { fakeProcessCompletedTask } from './fakeServices';
import { processCompletedTask } from './pipeline';
import { createSettingsStore, resolveApiKey, saveApiKey } from './settings';
import { createFileStore } from './storage/fileStore';
import { verifyAnthropicApiKey } from './verifyApiKey';

// Lets e2e tests isolate each run's saved state.
if (process.env.FOCUSGARDEN_USER_DATA) {
  app.setPath('userData', process.env.FOCUSGARDEN_USER_DATA);
}

const useFakeServices = process.env.FOCUSGARDEN_FAKE_SERVICES === '1';

function registerIpc() {
  const userData = app.getPath('userData');
  const store = createFileStore(path.join(userData, 'focusgarden-state.json'));
  const settings = createSettingsStore(createFileStore(path.join(userData, 'settings.json')), safeStorage);
  const activityWatch = new ActivityWatchClient();

  const currentApiKey = async () =>
    resolveApiKey(await settings.getApiKey(), process.env.ANTHROPIC_API_KEY);

  ipcMain.handle(IPC.loadState, () => loadState(store));
  ipcMain.handle(IPC.saveState, (_event, state: AppState) => saveState(store, state));

  ipcMain.handle(IPC.getSetupStatus, async (): Promise<SetupStatus> => {
    if (useFakeServices) return { activityWatchRunning: true, apiKey: 'environment' };
    return {
      activityWatchRunning: await activityWatch.isAvailable(),
      apiKey: (await currentApiKey()).source,
    };
  });
  ipcMain.handle(IPC.saveApiKey, (_event, key: string) =>
    saveApiKey(String(key), { store: settings, verify: verifyAnthropicApiKey }),
  );
  ipcMain.handle(IPC.clearApiKey, () => settings.clearApiKey());
  ipcMain.handle(IPC.openExternal, async (_event, link: ExternalLink) => {
    // Only named links, so the renderer can never open an arbitrary URL.
    if (Object.hasOwn(EXTERNAL_LINKS, link)) await shell.openExternal(EXTERNAL_LINKS[link]);
  });

  ipcMain.handle(IPC.finishTask, async (_event, task: ActiveTask, endedAt: number) => {
    if (useFakeServices) return fakeProcessCompletedTask(task, endedAt);

    const { key } = await currentApiKey();
    if (!key) {
      throw new Error('No Anthropic API key is set. Add one in Settings on the main page.');
    }
    const classifier = createAnthropicClassifierModel(new Anthropic({ apiKey: key }));
    return processCompletedTask({ activityWatch, classifier }, task, endedAt);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FocusGarden',
    autoHideMenuBar: true,
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

// A second launch focuses the existing window instead of opening another copy
// that would fight over the same save file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
