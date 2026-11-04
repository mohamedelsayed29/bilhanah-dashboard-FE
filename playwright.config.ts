import { defineConfig } from '@playwright/test';

// The API only allows credentialed requests from http://127.0.0.1:5174 (CORS_ORIGINS), so that is the default.
// Another port only works if the API also lists it.
const port = Number(process.env['DASHBOARD_E2E_PORT'] ?? 5174);
const baseURL = `http://127.0.0.1:${port}`;
const adminPort = Number(process.env['ADMIN_E2E_PORT'] ?? 5175);

export default defineConfig({
  testDir: './tests',
  // Playwright empties its output folder on every run; screenshots go next to it (test-results/screens).
  outputDir: './test-results/playwright',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    // Installed Chrome locally; CI installs Playwright's Chromium.
    channel: process.env['CI'] ? undefined : 'chrome',
    viewport: { width: 1440, height: 960 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: true, timeout: 30_000 },
    // The admin console is its own app (VITE_APP=admin), origin and session; admin specs use ADMIN_URL.
    { command: `VITE_APP=admin npm run dev -- --port ${adminPort} --strictPort`, url: `http://127.0.0.1:${adminPort}`, reuseExistingServer: true, timeout: 30_000 },
  ],
});
