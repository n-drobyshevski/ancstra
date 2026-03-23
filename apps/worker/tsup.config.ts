import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: false,
  // Don't bundle workspace packages — they're resolved from node_modules at runtime
  // The Dockerfile copies the full node_modules tree which includes workspace links
  external: [/^@ancstra\//],
});
