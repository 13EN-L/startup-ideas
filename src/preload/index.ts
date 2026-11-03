import { contextBridge, ipcRenderer } from 'electron'
import { createApi } from './api'

// Only the narrow FocusGarden API is exposed; the renderer never gets raw ipcRenderer.
// contextIsolation must stay on (see CLAUDE.md), so there is no fallback to window globals.
contextBridge.exposeInMainWorld('api', createApi(ipcRenderer))
