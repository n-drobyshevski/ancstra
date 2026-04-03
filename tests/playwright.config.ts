import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'pnpm --filter web exec next dev --port 3001',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      NEXTAUTH_URL: 'http://localhost:3001',
      AUTH_TRUST_HOST: 'true',
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
