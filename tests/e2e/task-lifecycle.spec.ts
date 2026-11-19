// Issue #19 (and #17 via fake services): start, limit and stop tasks in the real app
import { expect, test } from '@playwright/test';
import { launchApp, makeUserDataDir, removeUserDataDir, startTask, type LaunchedApp } from './helpers';

let dir: string;
let launched: LaunchedApp;

test.beforeEach(async () => {
  dir = await makeUserDataDir();
  launched = await launchApp(dir);
});

test.afterEach(async () => {
  await launched.app.close();
  await removeUserDataDir(dir);
});

test('#19 a started task spawns an animal with a nametag in the pen', async () => {
  const { page } = launched;
  await page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(page, 'Write essay', 'School / Study');

  const pen = page.getByRole('region', { name: 'Animal pen' });
  await expect(pen.getByRole('button', { name: /^Write essay \(/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' })).toBeDisabled();
});

test('#19 the start button greys out at 3 animals', async () => {
  const { page } = launched;
  await page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(page, 'One', 'Work');
  await startTask(page, 'Two', 'Home');
  await startTask(page, 'Three', 'Creative');

  await expect(page.getByRole('region', { name: 'Animal pen' }).getByRole('button')).toHaveCount(3);
  await page.getByPlaceholder('enter task').fill('Four');
  await expect(page.getByRole('button', { name: 'start task' })).toBeDisabled();
});

test('#19 stopping a task walks the animal out and creates a result cloud', async () => {
  const { page } = launched;
  await page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(page, 'Budget review', 'Finance');

  await page.getByRole('button', { name: /^Budget review \(/ }).click();
  await page.getByRole('dialog', { name: 'Budget review' }).getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByRole('region', { name: 'Animal pen' }).getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();

  await page.getByRole('list', { name: 'Recent tasks' }).getByRole('button', { name: 'Budget review' }).click();
  const popup = page.getByRole('dialog', { name: 'Budget review' });
  await expect(popup.getByText('What you did:')).toBeVisible();
  await expect(popup.getByRole('list', { name: 'What you did' }).getByRole('listitem')).not.toHaveCount(0);
});

test('#19 the gate and walk-out take 4 seconds in total', async () => {
  const { page } = launched;
  await page.getByRole('button', { name: 'Tasks' }).click();
  await startTask(page, 'Slow exit', 'Home');

  const animal = page.getByRole('button', { name: /^Slow exit \(/ });
  const gate = page.getByTestId('pen-gate');
  await animal.click();
  await page.getByRole('button', { name: 'Stop' }).click();

  const seconds = (value: string) => parseFloat(value);
  const walk = seconds(await animal.evaluate((el) => getComputedStyle(el).animationDuration));
  const swing = seconds(await gate.evaluate((el) => getComputedStyle(el).transitionDuration));
  expect(walk).toBe(3.2);
  expect(swing).toBe(0.8);
  // The gate swings shut after the animal has left, so the whole thing is walk + closing swing.
  expect(walk + swing).toBeCloseTo(4);

  await expect(gate).toHaveAttribute('data-open', 'true');
  await page.waitForTimeout(2500);
  await expect(animal).toBeVisible(); // still walking out
  await expect(animal).toHaveCount(0, { timeout: 3000 });
  await expect(gate).toHaveAttribute('data-open', 'false');
});
