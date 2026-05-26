// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 15000 },
  navigationTimeout: 45000,
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://oneflowlife.co.il',
    headless: true,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 5'] } },
  ],
});