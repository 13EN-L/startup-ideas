// Bundled ActivityWatch: started automatically when FocusGarden opens
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  bundledActivityWatchExecutable,
  ensureActivityWatchRunning,
  vendorPlatformDir,
  type LaunchDeps,
} from '../../src/main/activitywatch/launcher';

const EXE = path.join('C:', 'Apps', 'FocusGarden', 'resources', 'activitywatch', 'aw-qt.exe');

function deps(overrides: Partial<LaunchDeps> = {}) {
  return {
    isRunning: vi.fn(async () => false),
    executable: EXE,
    exists: vi.fn(() => true),
    launch: vi.fn(),
    sleep: vi.fn(async () => {}),
    ...overrides,
  } satisfies LaunchDeps;
}

describe('bundledActivityWatchExecutable', () => {
  it('points at aw-qt.exe inside the app resources on Windows', () => {
    expect(bundledActivityWatchExecutable(path.join('C:', 'res'), 'win32')).toBe(
      path.join('C:', 'res', 'activitywatch', 'aw-qt.exe'),
    );
  });

  it('points at ActivityWatch.app inside the app resources on macOS', () => {
    expect(bundledActivityWatchExecutable('/res', 'darwin')).toBe(path.join('/res', 'activitywatch', 'ActivityWatch.app'));
  });

  it('has no bundled copy on Linux', () => {
    expect(bundledActivityWatchExecutable('/res', 'linux')).toBeNull();
  });
});

describe('vendorPlatformDir', () => {
  it('keeps one folder per platform, and one per CPU architecture on macOS', () => {
    expect(vendorPlatformDir('win32', 'x64')).toBe('win32');
    expect(vendorPlatformDir('darwin', 'arm64')).toBe('darwin-arm64');
    expect(vendorPlatformDir('darwin', 'x64')).toBe('darwin-x64');
  });
});

describe('ensureActivityWatchRunning', () => {
  it('leaves an ActivityWatch that is already running alone', async () => {
    const d = deps({ isRunning: vi.fn(async () => true) });
    await expect(ensureActivityWatchRunning(d)).resolves.toBe('already-running');
    expect(d.launch).not.toHaveBeenCalled();
  });

  it('starts the bundled copy and waits for its server to answer', async () => {
    const isRunning = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false) // initial check
      .mockResolvedValueOnce(false) // still starting
      .mockResolvedValueOnce(true);
    const d = deps({ isRunning });

    await expect(ensureActivityWatchRunning(d)).resolves.toBe('started');
    expect(d.launch).toHaveBeenCalledTimes(1);
    expect(d.launch).toHaveBeenCalledWith(EXE);
    expect(isRunning).toHaveBeenCalledTimes(3);
  });

  it('reports not-bundled when this build has no copy (macOS, Linux, dev without vendor files)', async () => {
    await expect(ensureActivityWatchRunning(deps({ executable: null }))).resolves.toBe('not-bundled');
    const missing = deps({ exists: vi.fn(() => false) });
    await expect(ensureActivityWatchRunning(missing)).resolves.toBe('not-bundled');
    expect(missing.launch).not.toHaveBeenCalled();
  });

  it('gives up after the timeout if the server never answers', async () => {
    const d = deps();
    await expect(ensureActivityWatchRunning(d, { timeoutMs: 2000, pollMs: 500 })).resolves.toBe('failed-to-start');
    expect(d.launch).toHaveBeenCalledTimes(1);
    expect(d.sleep).toHaveBeenCalledTimes(4);
  });

  it('reports failed-to-start if launching throws', async () => {
    const d = deps({
      launch: vi.fn(() => {
        throw new Error('EACCES');
      }),
    });
    await expect(ensureActivityWatchRunning(d)).resolves.toBe('failed-to-start');
  });
});
