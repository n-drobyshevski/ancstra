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
      // Baseline 95.86 / 89.47 / 100.00 / 95.12 captured 2026-05-21 — see commit 763fa82.
      thresholds: { lines: 90, branches: 84, functions: 95, statements: 90 },
    },
  },
});
