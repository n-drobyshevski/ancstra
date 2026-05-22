import { defineConfig } from 'vitest/config';

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
      // Baseline 36.84 / 15.38 / 66.66 / 39.02 captured 2026-05-21 — see commit 763fa82.
      thresholds: { lines: 31, branches: 10, functions: 61, statements: 34 },
    },
  },
});
