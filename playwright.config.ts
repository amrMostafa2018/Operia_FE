import { defineConfig } from '@playwright/test';

const password = process.env.OPERIA_E2E_PASSWORD;
const otp = process.env.OPERIA_E2E_OTP;
if (!password || !otp || !/^\d{6}$/.test(otp)) {
  throw new Error('Set OPERIA_E2E_PASSWORD and a six-digit OPERIA_E2E_OTP.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  timeout: process.env.OPERIA_E2E_SLOW_MO_MS ? 120_000 : 60_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4201',
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
  webServer: [
    {
      command:
        'dotnet run --project ../Operia/Operia/Operia.csproj --configuration Release --no-launch-profile',
      url: 'http://localhost:5151/swagger/index.html',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: 'http://localhost:5151',
        ConnectionStrings__DefaultConnection:
          'Server=(localdb)\\OperiaDev;Database=Operia_Dev;Trusted_Connection=True;TrustServerCertificate=True',
        E2E__SeedData: 'true',
        E2E__Password: password,
        OtpSettings__DevelopmentCode: otp,
        WhatsApp__Enabled: 'false',
      },
    },
    {
      command: 'npm run start -- --host localhost --port 4201',
      url: 'http://localhost:4201/auth/login',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ASPNETCORE_URLS: 'http://localhost:5151' },
    },
  ],
});
