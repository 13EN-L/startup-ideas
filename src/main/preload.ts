import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type FocusGardenBridge } from '../shared/bridge';

const bridge: FocusGardenBridge = {
  loadState: () => ipcRenderer.invoke(IPC.loadState),
  saveState: (state) => ipcRenderer.invoke(IPC.saveState, state),
  finishTask: (task, endedAt) => ipcRenderer.invoke(IPC.finishTask, task, endedAt),
};

contextBridge.exposeInMainWorld('focusGarden', bridge);
