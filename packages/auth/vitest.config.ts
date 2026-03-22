import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@ancstra/db': path.resolve(__dirname, '../db/src'),
    },
  },
});
