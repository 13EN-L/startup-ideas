// Issue #20: StateStore backed by a JSON file (atomic write via temp + rename).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StateStore } from '../../core/persistence';

export function createFileStore(filePath: string): StateStore {
  return {
    async load() {
      try {
        return await readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },

    async save(serialized) {
      // Writing a temp file and renaming it means a crash mid-write can never
      // leave a half-written state file behind.
      await mkdir(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, serialized, 'utf8');
      await rename(tempPath, filePath);
    },
  };
}
