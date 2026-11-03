// Issue #18: completing a task creates and grows its category plot
import { expect, test } from '@playwright/test';
import { launchApp, makeUserDataDir, removeUserDataDir, startTask } from './helpers';

test('#18 a completed task makes its category plot appear in the garden', async () => {
  const dir = await makeUserDataDir();
  const { app, page } = await launchApp(dir);
  try {
    await page.getByRole('button', { name: 'Tasks' }).click();
    await startTask(page, 'Sketching', 'Creative');
    await page.getByRole('button', { name: /^Sketching \(/ }).click();
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open garden' }).click();

    await expect(page.getByTestId('plot-creative')).toBeVisible();
    await expect(page.getByTestId('plot-creative').getByRole('img', { name: /Basil/ })).toBeVisible();
    await expect(page.getByTestId('plot-work')).toHaveCount(0);
  } finally {
    await app.close();
    await removeUserDataDir(dir);
  }
});
