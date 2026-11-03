import type { ActiveTask, AppState, CompletedTask } from './types';

/** Where the Anthropic API key comes from; a key saved in the app wins. */
export type ApiKeySource = 'saved' | 'environment' | 'missing';

export interface SetupStatus {
  activityWatchRunning: boolean;
  /** True when this build ships its own ActivityWatch and starts it automatically. */
  activityWatchBundled: boolean;
  apiKey: ApiKeySource;
}

export type SaveApiKeyResult = { ok: true; warning?: string } | { ok: false; error: string };

/** The only pages the app may open in the user's browser. */
export const EXTERNAL_LINKS = {
  activityWatchDownload: 'https://activitywatch.net/downloads/',
  anthropicApiKeys: 'https://console.anthropic.com/settings/keys',
} as const;

export type ExternalLink = keyof typeof EXTERNAL_LINKS;

/** API the preload script exposes to the renderer as window.focusGarden. */
export interface FocusGardenBridge {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  /** Runs the ActivityWatch + Claude pipeline for a stopped task. */
  finishTask(task: ActiveTask, endedAt: number): Promise<CompletedTask>;
  getSetupStatus(): Promise<SetupStatus>;
  /** Checks the key with Anthropic, then stores it encrypted on this computer. */
  saveApiKey(key: string): Promise<SaveApiKeyResult>;
  clearApiKey(): Promise<void>;
  openExternal(link: ExternalLink): Promise<void>;
}

export const IPC = {
  loadState: 'state:load',
  saveState: 'state:save',
  finishTask: 'task:finish',
  getSetupStatus: 'setup:status',
  saveApiKey: 'setup:save-api-key',
  clearApiKey: 'setup:clear-api-key',
  openExternal: 'app:open-external',
} as const;
