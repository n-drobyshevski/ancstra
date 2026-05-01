import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
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
