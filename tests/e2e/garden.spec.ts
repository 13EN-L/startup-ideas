// Issue #18: completing a task creates and grows the plant plot
import { expect, test } from '@playwright/test';
import { launchApp, makeUserDataDir, removeUserDataDir, startTask } from './helpers';

test('#18 a completed task makes the plant plot appear in the garden', async () => {
  const dir = await makeUserDataDir();
  const { app, page } = await launchApp(dir);
  try {
    await page.getByRole('button', { name: 'Tasks' }).click();
    await startTask(page, 'Sketching', 'Creative writing');
    await page.getByRole('button', { name: /^Sketching \(/ }).click();
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open garden' }).click();

    await expect(page.getByTestId('plot-basil')).toBeVisible();
    await expect(page.getByTestId('plot-basil').getByRole('img', { name: /Basil/ })).toBeVisible();
    await expect(page.getByTestId('plot-pine')).toHaveCount(0);
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
    // Six Programming tasks: the oldest falls out of the five recent-task clouds.
    for (let i = 1; i <= 6; i++) {
      await startTask(page, `Report ${i}`, 'Programming');
      await page.getByRole('button', { name: new RegExp(`^Report ${i} \\(`) }).click();
      await page.getByRole('button', { name: 'Stop' }).click();
      await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    }
    await expect(page.getByRole('list', { name: 'Recent tasks' }).getByRole('button', { name: 'Report 1' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open garden' }).click();
    await expect(page.getByTestId('decorative-clouds')).not.toContainText('Report');

    await page.getByRole('button', { name: 'Pine tasks' }).click();
    const history = page.getByRole('dialog', { name: 'Pine tasks' });
    await expect(history.getByRole('listitem')).toHaveCount(6);
    // Read from public/assets/plants/pine/about.txt in the built app.
    await expect(history.getByText(/^Pines are evergreen conifers/)).toBeVisible();
    await expect(history.getByText('Stage', { exact: true })).toBeVisible();

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
    await startTask(first.page, 'Sketching', 'Creative writing');
    await first.page.getByRole('button', { name: /^Sketching \(/ }).click();
    await first.page.getByRole('button', { name: 'Stop' }).click();
    await expect(first.page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await first.page.getByRole('button', { name: 'Home' }).click();

    await first.page.getByRole('button', { name: 'Settings' }).click();
    await first.page.getByRole('button', { name: 'Reset categories, tasks, and plants' }).click();
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

test('edited categories and plant mappings persist, and only later tasks grow the new plant', async () => {
  const dir = await makeUserDataDir();
  try {
    const first = await launchApp(dir);
    await first.page.getByRole('button', { name: 'Tasks' }).click();
    await startTask(first.page, 'Sketching', 'Creative writing');
    await first.page.getByRole('button', { name: /^Sketching \(/ }).click();
    await first.page.getByRole('button', { name: 'Stop' }).click();
    await expect(first.page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await first.page.getByRole('button', { name: 'Home' }).click();

    // Rename Creative writing and move it from the basil to the carrot.
    await first.page.getByRole('button', { name: 'Settings' }).click();
    await first.page.getByRole('button', { name: 'Modify categories and plant mappings' }).click();
    const name = first.page.getByRole('textbox', { name: 'Category 1 name' });
    await name.fill('Fiction');
    await name.press('Enter');
    await first.page.getByRole('combobox', { name: 'Plant for Fiction' }).selectOption({ label: 'Carrot' });
    await first.app.close();

    const second = await launchApp(dir);
    await expect(second.page.getByRole('heading', { name: 'Categories & plants' })).toBeVisible();
    await expect(second.page.getByRole('combobox', { name: 'Plant for Fiction' })).toHaveValue('carrot');
    await second.page.getByRole('button', { name: /Back to settings/ }).click();
    await second.page.getByRole('button', { name: 'Close' }).click();

    await second.page.getByRole('button', { name: 'Open garden' }).click();
    await expect(second.page.getByTestId('plot-basil')).toBeVisible(); // keeps its growth
    await expect(second.page.getByTestId('plot-carrot')).toHaveCount(0); // nothing grown yet
    await second.page.getByRole('button', { name: 'Home' }).click();

    await second.page.getByRole('button', { name: 'Tasks' }).click();
    await startTask(second.page, 'Short story', 'Fiction');
    await second.page.getByRole('button', { name: /^Short story \(/ }).click();
    await second.page.getByRole('button', { name: 'Stop' }).click();
    await expect(second.page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await second.page.getByRole('button', { name: 'Home' }).click();
    await second.page.getByRole('button', { name: 'Open garden' }).click();
    await expect(second.page.getByTestId('plot-carrot')).toBeVisible();
    await expect(second.page.getByTestId('plot-basil')).toBeVisible();
    await second.app.close();
  } finally {
    await removeUserDataDir(dir);
  }
});
