import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.OPERIA_E2E_BASE_URL ?? 'http://localhost:4200',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run start -- --host localhost',
    url: 'http://localhost:4200/auth/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
