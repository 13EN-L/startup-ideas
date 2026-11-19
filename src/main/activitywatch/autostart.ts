// Starts the bundled ActivityWatch when the user signs in, so tracking carries
// on after a restart even if FocusGarden itself isn't opened. FocusGarden only
// reads ActivityWatch's history when a task stops, so ActivityWatch is the
// only thing that has to be running.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type AutostartState = 'on' | 'off' | 'unavailable';

/** A sign-in entry that opens the bundled ActivityWatch. */
export interface LoginItem {
  register(): Promise<void>;
  unregister(): Promise<void>;
}

/**
 * Applies the saved preference, which defaults to on. Registering again on
 * every launch keeps the entry pointing at the current install after an
 * update or after the app was moved.
 */
export async function applyAutostart(preference: boolean | undefined, item: LoginItem | null): Promise<AutostartState> {
  if (!item) return 'unavailable';
  const enabled = preference ?? true;
  if (enabled) await item.register();
  else await item.unregister();
  return enabled ? 'on' : 'off';
}

/** Registry value under HKCU\Software\Microsoft\Windows\CurrentVersion\Run; build/installer.nsh removes it on uninstall. */
export const WINDOWS_RUN_VALUE = 'FocusGarden ActivityWatch';

/** The part of Electron's `app` used on Windows. */
export interface WindowsLoginItems {
  setLoginItemSettings(settings: { openAtLogin: boolean; path: string; args: string[]; name: string }): void;
}

/** Windows: a per-user Run entry that starts aw-qt.exe directly. */
export function windowsLoginItem(app: WindowsLoginItems, executable: string): LoginItem {
  const settings = { path: executable, args: [], name: WINDOWS_RUN_VALUE };
  return {
    async register() {
      app.setLoginItemSettings({ ...settings, openAtLogin: true });
    },
    async unregister() {
      app.setLoginItemSettings({ ...settings, openAtLogin: false });
    },
  };
}

export const MAC_AGENT_LABEL = 'com.focusgarden.activitywatch';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A LaunchAgent that opens ActivityWatch.app in the background at sign-in. */
export function macLaunchAgentPlist(appPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAC_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-g</string>
    <string>${escapeXml(appPath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
</dict>
</plist>
`;
}

/** macOS: ~/Library/LaunchAgents/com.focusgarden.activitywatch.plist. */
export function macLoginItem(launchAgentsDir: string, appPath: string): LoginItem {
  const file = path.join(launchAgentsDir, `${MAC_AGENT_LABEL}.plist`);
  return {
    async register() {
      await mkdir(launchAgentsDir, { recursive: true });
      await writeFile(file, macLaunchAgentPlist(appPath), 'utf8');
    },
    async unregister() {
      await rm(file, { force: true });
    },
  };
}
