const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('https://oneflowlife.co.il/business.html');
  await page.waitForLoadState('networkidle');

  await page.fill('#login-code', 'GA1HLF');
  await page.fill('#login-username', 'מושיק');
  await page.fill('#login-password', '123456');
  await page.click('#login-btn');

  await page.waitForSelector('#dashboard', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'test-dashboard.png',
    fullPage: false,
  });

  await browser.close();
  console.log('✅ צילום נשמר: test-dashboard.png');
})();
