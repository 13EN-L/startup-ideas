// Starting the bundled ActivityWatch at sign-in (Windows Run entry, macOS LaunchAgent)
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAutostart,
  MAC_AGENT_LABEL,
  macLaunchAgentPlist,
  macLoginItem,
  WINDOWS_RUN_VALUE,
  windowsLoginItem,
  type LoginItem,
} from '../../src/main/activitywatch/autostart';

const fakeItem = () => ({ register: vi.fn(async () => {}), unregister: vi.fn(async () => {}) }) satisfies LoginItem;

describe('applyAutostart', () => {
  it('is on by default, and registers the sign-in entry', async () => {
    const item = fakeItem();
    await expect(applyAutostart(undefined, item)).resolves.toBe('on');
    expect(item.register).toHaveBeenCalledTimes(1);
    expect(item.unregister).not.toHaveBeenCalled();
  });

  it('registers again when on, so the entry follows an updated or moved app', async () => {
    const item = fakeItem();
    await applyAutostart(true, item);
    await applyAutostart(true, item);
    expect(item.register).toHaveBeenCalledTimes(2);
  });

  it('removes the entry when turned off', async () => {
    const item = fakeItem();
    await expect(applyAutostart(false, item)).resolves.toBe('off');
    expect(item.unregister).toHaveBeenCalledTimes(1);
    expect(item.register).not.toHaveBeenCalled();
  });

  it('is unavailable without a bundled ActivityWatch', async () => {
    await expect(applyAutostart(true, null)).resolves.toBe('unavailable');
  });
});

describe('windowsLoginItem', () => {
  it('adds and removes a named Run entry for aw-qt.exe', async () => {
    const app = { setLoginItemSettings: vi.fn() };
    const exe = 'C:\\Users\\me\\AppData\\Local\\Programs\\FocusGarden\\resources\\activitywatch\\aw-qt.exe';
    const item = windowsLoginItem(app, exe);

    await item.register();
    expect(app.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: true, path: exe, args: [], name: WINDOWS_RUN_VALUE });
    await item.unregister();
    expect(app.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: false, path: exe, args: [], name: WINDOWS_RUN_VALUE });
  });

  it('uses the value name the uninstaller removes', async () => {
    const installer = await readFile(path.resolve(__dirname, '../../build/installer.nsh'), 'utf8');
    expect(installer).toContain(`"${WINDOWS_RUN_VALUE}"`);
  });
});

describe('macLaunchAgentPlist', () => {
  it('opens ActivityWatch.app in the background at sign-in', () => {
    const plist = macLaunchAgentPlist('/Applications/FocusGarden.app/Contents/Resources/activitywatch/ActivityWatch.app');
    expect(plist).toContain(`<string>${MAC_AGENT_LABEL}</string>`);
    expect(plist).toMatch(
      /<string>\/usr\/bin\/open<\/string>\s*<string>-g<\/string>\s*<string>\/Applications\/FocusGarden\.app\/Contents\/Resources\/activitywatch\/ActivityWatch\.app<\/string>/,
    );
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/);
  });

  it('escapes paths so the plist stays valid XML', () => {
    expect(macLaunchAgentPlist('/Users/Tom & Jerry/<Apps>/ActivityWatch.app')).toContain(
      '<string>/Users/Tom &amp; Jerry/&lt;Apps&gt;/ActivityWatch.app</string>',
    );
  });
});

describe('macLoginItem', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'focusgarden-agents-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the LaunchAgent, creating the folder, and removes it again', async () => {
    const agents = path.join(dir, 'Library', 'LaunchAgents');
    const item = macLoginItem(agents, '/Applications/FocusGarden.app/Contents/Resources/activitywatch/ActivityWatch.app');

    await item.register();
    const file = path.join(agents, `${MAC_AGENT_LABEL}.plist`);
    expect(await readFile(file, 'utf8')).toContain('ActivityWatch.app');

    await item.unregister();
    expect(await readdir(agents)).toEqual([]);
    await expect(item.unregister()).resolves.toBeUndefined(); // already gone is fine
  });
});
