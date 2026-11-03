// Starts the ActivityWatch copy bundled with FocusGarden when none is running.
import path from 'node:path';

export type LaunchOutcome = 'already-running' | 'started' | 'not-bundled' | 'failed-to-start';

export interface LaunchDeps {
  isRunning(): Promise<boolean>;
  /** Bundled aw-qt, or null when this build ships without ActivityWatch. */
  executable: string | null;
  exists(filePath: string): boolean;
  launch(executable: string): void;
  sleep(ms: number): Promise<void>;
}

/** Only the Windows build bundles ActivityWatch (see scripts/fetch-activitywatch.mjs). */
export function bundledActivityWatchExecutable(resourcesDir: string, platform: NodeJS.Platform): string | null {
  return platform === 'win32' ? path.join(resourcesDir, 'activitywatch', 'aw-qt.exe') : null;
}

export async function ensureActivityWatchRunning(
  deps: LaunchDeps,
  { timeoutMs = 30_000, pollMs = 500 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<LaunchOutcome> {
  if (await deps.isRunning()) return 'already-running';
  if (!deps.executable || !deps.exists(deps.executable)) return 'not-bundled';

  try {
    deps.launch(deps.executable);
  } catch {
    return 'failed-to-start';
  }

  for (let waited = 0; waited < timeoutMs; waited += pollMs) {
    await deps.sleep(pollMs);
    if (await deps.isRunning()) return 'started';
  }
  return 'failed-to-start';
}
