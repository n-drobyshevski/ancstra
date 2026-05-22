import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        '__tests__/**',
        'src/seed.ts',
        'src/__bench__/**',
        'src/test-fixtures/**',
        'migrations/**',
        '**/*.d.ts',
      ],
      // Baseline 71.93 / 67.36 / 72.72 / 69.39 captured 2026-05-21 — see commit 763fa82.
      thresholds: { lines: 66, branches: 62, functions: 67, statements: 64 },
    },
  },
  resolve: {
    alias: {
      '@ancstra/db': path.resolve(__dirname, '../db/src'),
    },
  },
});
