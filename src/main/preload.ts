import { contextBridge, ipcRenderer } from 'electron';
import type { FocusGardenBridge, IPC as SharedIPC } from '../shared/bridge';

// Sandboxed preload scripts can only require 'electron', so the channel names
// are repeated here; the type annotation fails the build if they drift.
const IPC: typeof SharedIPC = {
  loadState: 'state:load',
  saveState: 'state:save',
  finishTask: 'task:finish',
  getSetupStatus: 'setup:status',
  saveApiKey: 'setup:save-api-key',
  clearApiKey: 'setup:clear-api-key',
  openExternal: 'app:open-external',
  getPlantAbout: 'plants:about',
  setActivityWatchAutostart: 'setup:activitywatch-autostart',
};

const bridge: FocusGardenBridge = {
  loadState: () => ipcRenderer.invoke(IPC.loadState),
  saveState: (state) => ipcRenderer.invoke(IPC.saveState, state),
  finishTask: (task, endedAt) => ipcRenderer.invoke(IPC.finishTask, task, endedAt),
  getSetupStatus: () => ipcRenderer.invoke(IPC.getSetupStatus),
  saveApiKey: (key) => ipcRenderer.invoke(IPC.saveApiKey, key),
  clearApiKey: () => ipcRenderer.invoke(IPC.clearApiKey),
  openExternal: (link) => ipcRenderer.invoke(IPC.openExternal, link),
  getPlantAbout: (category) => ipcRenderer.invoke(IPC.getPlantAbout, category),
  setActivityWatchAutostart: (enabled) => ipcRenderer.invoke(IPC.setActivityWatchAutostart, enabled),
};

contextBridge.exposeInMainWorld('focusGarden', bridge);
