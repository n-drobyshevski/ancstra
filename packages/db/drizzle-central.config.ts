import { defineConfig } from 'drizzle-kit';
import path from 'path';
import os from 'os';

export default defineConfig({
  schema: './src/central-schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${path.join(os.homedir(), '.ancstra', 'ancstra.sqlite')}`,
  },
});
