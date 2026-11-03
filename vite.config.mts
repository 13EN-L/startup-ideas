/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the build loads from file:// inside Electron.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/{unit,integration}/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'property',
          environment: 'node',
          include: ['tests/property/**/*.property.test.ts'],
          setupFiles: ['tests/setup-property.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/{unit,integration}/**/*.test.tsx'],
          setupFiles: ['tests/setup-dom.ts'],
        },
      },
    ],
  },
});
