// Issue #20: StateStore backed by a JSON file (atomic write via temp + rename).
import { notImplemented } from '../../shared/notImplemented';
import type { StateStore } from '../../core/persistence';

export function createFileStore(filePath: string): StateStore {
  return notImplemented(`createFileStore(${filePath})`);
}
