// Issue #20: StateStore backed by a JSON file (atomic write via temp + rename).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StateStore } from '../../core/persistence';

export function createFileStore(filePath: string): StateStore {
  // Saves run one at a time in call order, so an older state can never land
  // after a newer one, and two saves never share a temp file.
  let queue: Promise<void> = Promise.resolve();
  let writes = 0;

  async function write(serialized: string) {
    // Writing a temp file and renaming it means a crash mid-write can never
    // leave a half-written state file behind.
    await mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${++writes}.tmp`;
    await writeFile(tempPath, serialized, 'utf8');
    await rename(tempPath, filePath);
  }

  return {
    async load() {
      try {
        return await readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },

    save(serialized) {
      const run = queue.then(() => write(serialized));
      // A failed save is reported to its caller but doesn't block later saves.
      queue = run.catch(() => {});
      return run;
    },
  };
}
