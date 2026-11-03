// Issue #20: state survives app restarts via a JSON file in userData
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState } from '../../src/core/persistence';
import { createFileStore } from '../../src/main/storage/fileStore';
import { makeActiveTask, makeCompletedTask, makeState } from '../fixtures';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'focusgarden-'));
  file = path.join(dir, 'focusgarden-state.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('#20 createFileStore', () => {
  it('returns null before anything has been saved', async () => {
    await expect(createFileStore(file).load()).resolves.toBeNull();
  });

  it('writes and reads back the same text', async () => {
    const store = createFileStore(file);
    await store.save('{"a":1}');
    await expect(store.load()).resolves.toBe('{"a":1}');
    await expect(readFile(file, 'utf8')).resolves.toBe('{"a":1}');
  });

  it('creates the parent directory if needed', async () => {
    const nested = path.join(dir, 'a', 'b', 'state.json');
    await createFileStore(nested).save('{}');
    await expect(readFile(nested, 'utf8')).resolves.toBe('{}');
  });

  it('leaves no temp files behind after saving', async () => {
    await createFileStore(file).save('{}');
    expect(await readdir(dir)).toEqual(['focusgarden-state.json']);
  });
});

describe('#20 restart round trip', () => {
  it('restores active tasks, history, plants and page after a "restart"', async () => {
    const state = makeState({
      route: 'task',
      activeTasks: [makeActiveTask({ slot: 0 }), makeActiveTask({ slot: 1, animal: 'duck' })],
      completedTasks: [makeCompletedTask()],
      plants: { school: { category: 'school', totalMinutes: 20 } },
    });

    await saveState(createFileStore(file), state);
    // A fresh store instance stands in for a relaunched app.
    await expect(loadState(createFileStore(file))).resolves.toEqual(state);
  });

  it('recovers with a fresh state if the file is corrupted', async () => {
    await writeFile(file, '{"version":1, "route": "task", "activeTa');
    const state = await loadState(createFileStore(file));
    expect(state.activeTasks).toEqual([]);
    expect(state.route).toBe('main');
  });
});
