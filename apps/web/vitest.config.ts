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
      '@ancstra/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
