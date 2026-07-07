const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, '../../../../../home/user/family-flow/public/screenshots/guide');

const BIZ_CODE = 'GA1HLF';
const BIZ_NAME = 'מושיק';
const BIZ_PASS = '123456';

async function capture(page, tabId, filename) {
  console.log(`→ Capturing ${tabId} → ${filename}`);
  await page.evaluate((t) => { if(window.switchTab) window.switchTab(t); }, tabId);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, filename), fullPage: false });
  console.log(`  ✓ ${filename}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, locale:'he-IL' });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/business.html`);
  await page.waitForTimeout(2000);
  
  await page.fill('#login-code', BIZ_CODE);
  await page.fill('#login-nickname', BIZ_NAME);
  await page.fill('#login-password', BIZ_PASS);
  await page.click('button[type=submit], form button[onclick*="handleLogin"], #view-login button[type=submit]');
  await page.waitForTimeout(4000);

  // Capture missing restaurant tabs
  await capture(page, 'sales', 'sales.png');
  await capture(page, 'shop', 'shop.png');
  await capture(page, 'budget', 'budget.png');
  await capture(page, 'foodcost', 'foodcost.png');
  await capture(page, 'reviews', 'reviews.png');
  await capture(page, 'kds', 'kds.png');

  await browser.close();
  console.log('Done!');
})();
