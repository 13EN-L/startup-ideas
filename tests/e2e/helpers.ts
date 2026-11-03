import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
}

/** Launches the built app (npm run build) with fake ActivityWatch/Claude services. */
export async function launchApp(userDataDir: string): Promise<LaunchedApp> {
  // Inherited from VS Code's own Electron process; it would make our app run as plain Node.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../..')],
    env: {
      ...env,
      FOCUSGARDEN_FAKE_SERVICES: '1',
      FOCUSGARDEN_USER_DATA: userDataDir,
    } as Record<string, string>,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function makeUserDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'focusgarden-e2e-'));
}

export async function removeUserDataDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function startTask(page: Page, name: string, category: string): Promise<void> {
  await page.getByPlaceholder('enter task').fill(name);
  await page.getByRole('combobox', { name: 'category' }).selectOption({ label: category });
  await page.getByRole('button', { name: 'start task' }).click();
}
