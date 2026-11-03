// Issue #20: closing and reopening the app restores the exact session
import { expect, test } from '@playwright/test';
import { launchApp, makeUserDataDir, removeUserDataDir, startTask } from './helpers';

let dir: string;

test.beforeEach(async () => {
  dir = await makeUserDataDir();
});

test.afterEach(async () => {
  await removeUserDataDir(dir);
});

test('#20 active tasks reopen on the Task page with Home greyed out', async () => {
  const first = await launchApp(dir);
  await first.page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(first.page, 'Thesis draft', 'School / Study');
  await startTask(first.page, 'Gym', 'Health & Fitness');
  await expect(first.page.getByRole('region', { name: 'Animal pen' }).getByRole('button')).toHaveCount(2);
  await first.app.close();

  const second = await launchApp(dir);
  const pen = second.page.getByRole('region', { name: 'Animal pen' });
  await expect(pen.getByRole('button', { name: /^Thesis draft \(/ })).toBeVisible();
  await expect(pen.getByRole('button', { name: /^Gym \(/ })).toBeVisible();
  await expect(second.page.getByRole('button', { name: 'Home' })).toBeDisabled();
  await second.app.close();
});

test('#20 completed task clouds survive a restart and open their popup from the Main page', async () => {
  const first = await launchApp(dir);
  await first.page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(first.page, 'Inbox zero', 'Work');
  await first.page.getByRole('button', { name: /^Inbox zero \(/ }).click();
  await first.page.getByRole('button', { name: 'Stop' }).click();
  await expect(first.page.getByRole('button', { name: 'Home' })).toBeEnabled();
  await first.page.getByRole('button', { name: 'Home' }).click();
  await first.app.close();

  const second = await launchApp(dir);
  await expect(second.page.getByRole('heading', { name: 'FocusGarden' })).toBeVisible();
  await second.page.getByRole('list', { name: 'Recent tasks' }).getByRole('button', { name: 'Inbox zero' }).click();
  await expect(second.page.getByRole('dialog', { name: 'Inbox zero' })).toBeVisible();
  await second.app.close();
});
