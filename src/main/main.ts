import Anthropic from '@anthropic-ai/sdk';
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { loadState, saveState } from '../core/persistence';
import { EXTERNAL_LINKS, IPC, type ExternalLink, type SetupStatus } from '../shared/bridge';
import type { ActiveTask, AppState } from '../shared/types';
import { ActivityWatchClient } from './activitywatch/client';
import { isWebBucket } from './activitywatch/collect';
import {
  bundledActivityWatchExecutable,
  ensureActivityWatchRunning,
  type LaunchOutcome,
} from './activitywatch/launcher';
import { createAnthropicClassifierModel } from './classifier/anthropicModel';
import { fakeProcessCompletedTask } from './fakeServices';
import { processCompletedTask } from './pipeline';
import { readPlantAbout } from './plantAbout';
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

  // Packaged builds keep ActivityWatch in resources/; `npm run dev` uses the
  // copy fetched into vendor/ by scripts/fetch-activitywatch.mjs.
  const resourcesDir = app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), 'vendor', process.platform);
  const bundledExecutable = bundledActivityWatchExecutable(resourcesDir, process.platform);
  const bundled = bundledExecutable !== null && existsSync(bundledExecutable);

  // One start attempt at a time; later callers share it.
  let starting: Promise<LaunchOutcome> | null = null;
  const ensureActivityWatch = () =>
    (starting ??= ensureActivityWatchRunning({
      isRunning: () => activityWatch.isAvailable(),
      executable: bundledExecutable,
      exists: existsSync,
      // Opened the way a double-click would: independent of FocusGarden, so it
      // keeps tracking (from the tray) after FocusGarden closes, and it inherits
      // none of FocusGarden's handles. Failures surface via the health check.
      launch: (executable) => void shell.openPath(executable),
      sleep: (ms) => sleep(ms),
    }).finally(() => {
      starting = null;
    }));

  if (!useFakeServices) void ensureActivityWatch();

  const currentApiKey = async () =>
    resolveApiKey(await settings.getApiKey(), process.env.ANTHROPIC_API_KEY);

  ipcMain.handle(IPC.loadState, () => loadState(store));
  ipcMain.handle(IPC.saveState, (_event, state: AppState) => saveState(store, state));

  ipcMain.handle(IPC.getSetupStatus, async (): Promise<SetupStatus> => {
    if (useFakeServices) {
      return {
        activityWatchRunning: true,
        activityWatchBundled: false,
        apiKey: 'environment',
        websiteTracking: 'page-titles',
      };
    }
    const outcome = await ensureActivityWatch();
    const running = outcome === 'already-running' || outcome === 'started';
    // The extension creates its bucket the first time it reports a tab.
    const extension = running && (await activityWatch.getBuckets().catch(() => [])).some((b) => isWebBucket(b.type));
    return {
      activityWatchRunning: running,
      activityWatchBundled: bundled,
      apiKey: (await currentApiKey()).source,
      websiteTracking: extension ? 'extension' : 'page-titles',
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

  // Vite serves public/ in development and copies it into dist/ for builds.
  const assetsRoot = process.env.VITE_DEV_SERVER_URL
    ? path.join(app.getAppPath(), 'public', 'assets')
    : path.join(__dirname, '../../dist/assets');
  ipcMain.handle(IPC.getPlantAbout, (_event, category: string) => readPlantAbout(assetsRoot, String(category)));

  ipcMain.handle(IPC.finishTask, async (_event, task: ActiveTask, endedAt: number) => {
    if (useFakeServices) return fakeProcessCompletedTask(task, endedAt);

    const { key } = await currentApiKey();
    if (!key) {
      throw new Error('No Anthropic API key is set. Add one in Settings on the main page.');
    }
    // Restart ActivityWatch if it was quit from the tray since FocusGarden opened.
    await ensureActivityWatch();
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
