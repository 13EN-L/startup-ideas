import type { ActiveTask, AppState, CompletedTask } from './types';

/** API the preload script exposes to the renderer as window.focusGarden. */
export interface FocusGardenBridge {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  /** Runs the ActivityWatch + Claude pipeline for a stopped task. */
  finishTask(task: ActiveTask, endedAt: number): Promise<CompletedTask>;
}

export const IPC = {
  loadState: 'state:load',
  saveState: 'state:save',
  finishTask: 'task:finish',
} as const;
