// Haiku classification benchmark: real Claude API calls, so it is kept out of
// `npm test` (and Stryker). Run with `npm run test:benchmark -- --api-key <key>`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/benchmark/**/*.benchmark.test.ts'],
    // One real API call per test, plus the SDK's retries.
    testTimeout: 120_000,
  },
});
