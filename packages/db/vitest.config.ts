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
      // Baseline 55.51 / 41.72 / 28.50 / 54.98 captured 2026-05-21 — see commit 763fa82.
      thresholds: { lines: 50, branches: 36, functions: 23, statements: 49 },
    },
  },
});
