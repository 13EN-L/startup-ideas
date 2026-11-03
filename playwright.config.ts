import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Each test launches its own Electron instance with its own userData dir.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
