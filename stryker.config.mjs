// Mutation testing: Stryker plants small bugs (mutants) in the source and
// checks that at least one Vitest test fails for each. Surviving mutants point
// at logic the suites do not really pin down.
// Stryker refuses to start while any test fails, so it is only useful once the
// modules it mutates are implemented and green.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vite.config.mts' },
  coverageAnalysis: 'perTest',
  // Stryker rewrites the named tsconfig in its sandbox through the TypeScript JS
  // API, which TypeScript 7 no longer ships. Our tsconfigs have no `extends` or
  // project references, so the rewrite would be a no-op; naming a file that
  // does not exist skips it. Remove once Stryker supports TypeScript 7.
  tsconfigFile: 'stryker-skips-tsconfig-rewrite.json',
  mutate: [
    'src/core/**/*.ts',
    'src/main/**/*.ts',
    'src/renderer/**/*.tsx',
    // Electron wiring and test doubles are covered by the e2e suite, which Stryker does not run.
    '!src/main/main.ts',
    '!src/main/preload.ts',
    '!src/main/fakeServices.ts',
    '!src/renderer/main.tsx',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // Only re-test mutants in code that changed since the last run.
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  // Raise `break` to fail CI on a low score once the modules are implemented.
  thresholds: { high: 85, low: 70, break: null },
  tempDirName: '.stryker-tmp',
};
