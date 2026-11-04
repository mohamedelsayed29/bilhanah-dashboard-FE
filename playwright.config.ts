import { defineConfig } from '@playwright/test';

// The API only allows the admin console's credentialed requests from http://127.0.0.1:5175 (ADMIN_ORIGINS).
// Another port only works if the API also lists it.
const port = Number(process.env['ADMIN_E2E_PORT'] ?? 5175);
const baseURL = `http://127.0.0.1:${port}`;

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
  // billing-admin.spec.ts also drives the restaurants' dashboard (bilhanah-client-FE/dashboard) on
  // DASHBOARD_ORIGIN; run it with the whole stack up (`npm run dev` in bilhanah-backend).
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 30_000 },
});
