import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  timeout: process.env.OPERIA_E2E_SLOW_MO_MS ? 120_000 : 30_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.OPERIA_E2E_BASE_URL ?? 'http://localhost:4200',
    browserName: 'chromium',
    channel: process.env.OPERIA_E2E_BROWSER_CHANNEL || 'chrome',
    headless: false,
    launchOptions: {
      slowMo: Number(process.env.OPERIA_E2E_SLOW_MO_MS ?? 0),
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.OPERIA_E2E_VIDEO === '1' ? 'on' : 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start -- --host localhost',
    url: 'http://localhost:4200/auth/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
