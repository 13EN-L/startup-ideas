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

test('clicking a plant lists its tasks, including ones no longer in a cloud, and opens their results', async () => {
  // Six tasks, each with a ~3 s walk-out animation.
  test.setTimeout(90_000);
  const dir = await makeUserDataDir();
  const { app, page } = await launchApp(dir);
  try {
    await page.getByRole('button', { name: 'Tasks' }).click();
    // Six Work tasks: the oldest falls out of the five recent-task clouds.
    for (let i = 1; i <= 6; i++) {
      await startTask(page, `Report ${i}`, 'Work');
      await page.getByRole('button', { name: new RegExp(`^Report ${i} \\(`) }).click();
      await page.getByRole('button', { name: 'Stop' }).click();
      await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    }
    await expect(page.getByRole('list', { name: 'Recent tasks' }).getByRole('button', { name: 'Report 1' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open garden' }).click();
    await expect(page.getByTestId('decorative-clouds')).not.toContainText('Report');

    await page.getByRole('button', { name: 'Pine: Work tasks' }).click();
    const history = page.getByRole('dialog', { name: 'Work tasks' });
    await expect(history.getByRole('listitem')).toHaveCount(6);

    await history.getByRole('button', { name: /Report 1/ }).click();
    const result = page.getByRole('dialog', { name: 'Report 1' });
    await expect(result.getByText('What you did:')).toBeVisible();
    await expect(result.getByText('Google search: Report 1')).toBeVisible();
    await expect(result.getByText('Search', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(result).toHaveCount(0);
    await expect(history).toBeVisible();
  } finally {
    await app.close();
    await removeUserDataDir(dir);
  }
});

test('Reset all data in Settings empties the garden and stays empty after a restart', async () => {
  const dir = await makeUserDataDir();
  try {
    const first = await launchApp(dir);
    await first.page.getByRole('button', { name: 'Tasks' }).click();
    await startTask(first.page, 'Sketching', 'Creative');
    await first.page.getByRole('button', { name: /^Sketching \(/ }).click();
    await first.page.getByRole('button', { name: 'Stop' }).click();
    await expect(first.page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await first.page.getByRole('button', { name: 'Home' }).click();

    await first.page.getByRole('button', { name: 'Settings' }).click();
    await first.page.getByRole('button', { name: 'Reset all data' }).click();
    await first.page.getByRole('button', { name: 'Yes, erase everything' }).click();
    await expect(first.page.getByText('All data was reset.')).toBeVisible();
    await first.app.close();

    const second = await launchApp(dir);
    await expect(second.page.getByRole('button', { name: 'Tasks' })).toBeVisible();
    await expect(second.page.getByRole('button', { name: 'Sketching' })).toHaveCount(0);
    await second.page.getByRole('button', { name: 'Open garden' }).click();
    await expect(second.page.getByText('Complete a task to plant your first seed.')).toBeVisible();
    await second.app.close();
  } finally {
    await removeUserDataDir(dir);
  }
});
