const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // מבטל ריצה מקבילית שעשויה להכביד
  timeout: 60000,
  use: {
    headless: false, // פותח חלון גלוי לחלוטין (מונע חסימות של חלונות נסתרים)
    actionTimeout: 15000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});