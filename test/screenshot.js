const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('נכנס למערכת...');
  await page.goto('https://oneflowlife.co.il/business.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // מלא פרטי כניסה
  await page.fill('[id*="code"], [id*="login-code"], input[placeholder*="קוד"]', 'GA1HLF');
  await page.fill('[id*="username"], [id*="name"], input[placeholder*="שם"]', 'מושיק');
  await page.fill('[id*="password"], input[type="password"]', '123456');

  // לחץ כניסה
  await page.click('button[type="submit"], button:has-text("כניסה"), #login-btn');

  console.log('ממתין ללוח בקרה...');
  await page.waitForTimeout(4000);

  // צלם
  await page.screenshot({
    path: 'test/dashboard.png',
    fullPage: false,
  });

  console.log('✅ נשמר: test/dashboard.png');
  await browser.close();
})();
