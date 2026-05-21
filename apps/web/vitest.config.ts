import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'lib/**/*.{ts,tsx}',
        'server/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'i18n/**/*.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/__mocks__/**',
        '.next/**',
        'next-env.d.ts',
        '**/*.d.ts',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/not-found.tsx',
        'app/**/error.tsx',
        'app/api/**/route.ts',
        '**/page.tsx',
      ],
      // Baseline 18.73 / 15.16 / 12.38 / 18.76 captured 2026-05-21 — see commit 763fa82.
      // Soft floor (baseline - 5) gates regression; new tests in tier-2 will raise this.
      thresholds: { lines: 13, branches: 10, functions: 7, statements: 13 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@ancstra/db': path.resolve(__dirname, '../../packages/db/src'),
      // More-specific subpath aliases must come before the general one — Vite
      // matches in declaration order. Maps the package.json `./admin` export
      // (subpath added for platform-admin v1; bare-name imports of these
      // server-only queries would leak into client bundles via Turbopack).
      '@ancstra/auth/admin': path.resolve(__dirname, '../../packages/auth/src/admin-queries'),
      '@ancstra/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@ancstra/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
