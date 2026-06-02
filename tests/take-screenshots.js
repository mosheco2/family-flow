// Screenshot script — run from your LOCAL machine
// Saves screenshots to public/guide-screens/
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://oneflowlife.co.il';
const OUT = path.join(__dirname, '../public/guide-screens');
const GROUP = 'GA1HLF';
const NAME = 'מושיק';
const PASS = '123456';

const TABS = [
  { tab: 'feed',       file: 'dashboard.png',    label: 'לוח בקרה' },
  { tab: 'pos',        file: 'pos.png',           label: 'קופה' },
  { tab: 'sales',      file: 'sales.png',         label: 'מכירות וחנות' },
  { tab: 'pantry',     file: 'inventory.png',     label: 'מלאי' },
  { tab: 'shop',       file: 'procurement.png',   label: 'רכש' },
  { tab: 'foodcost',   file: 'foodcost.png',      label: 'פוד קוסט' },
  { tab: 'customers',  file: 'crm.png',           label: 'לקוחות' },
  { tab: 'cashflow',   file: 'cashflow.png',      label: 'תזרים' },
  { tab: 'budget',     file: 'budget.png',        label: 'תקציב' },
  { tab: 'forecast',   file: 'forecast.png',      label: 'תשקיף' },
  { tab: 'bank',       file: 'bank.png',          label: 'כספים' },
  { tab: 'timeclock',  file: 'timeclock.png',     label: 'נוכחות' },
  { tab: 'members',    file: 'members.png',       label: 'צוות' },
  { tab: 'tasks',      file: 'tasks.png',         label: 'משימות' },
  { tab: 'academy',    file: 'academy.png',       label: 'הכשרות' },
  { tab: 'calendar',   file: 'calendar.png',      label: 'יומן' },
  { tab: 'deliveries', file: 'deliveries.png',    label: 'שליחויות' },
  { tab: 'community',  file: 'community.png',     label: 'קהילות' },
  { tab: 'surveys',    file: 'surveys.png',       label: 'סקרים' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  });
  const page = await ctx.newPage();

  console.log('פותח:', BASE_URL + '/business.html');
  await page.goto(BASE_URL + '/business.html', { waitUntil: 'networkidle', timeout: 60000 });

  // Login
  await page.waitForSelector('#login-code', { timeout: 30000 });
  await page.fill('#login-code', GROUP);
  await page.fill('#login-nickname', NAME);
  await page.fill('#login-password', PASS);
  await page.click('button[type=submit]');
  console.log('מתחבר...');
  await page.waitForTimeout(4000);

  for (const { tab, file, label } of TABS) {
    try {
      process.stdout.write(`📸 ${label}... `);
      await page.evaluate((t) => {
        if (typeof window.switchTab === 'function') window.switchTab(t);
      }, tab);
      await page.waitForTimeout(2000);
      // Scroll past the top banner to show the tab content
      await page.evaluate(() => {
        const content = document.querySelector('#tab-content, .tab-content, main, #main-content, #app-content');
        if (content) content.scrollIntoView({ behavior: 'instant', block: 'start' });
        else window.scrollTo(0, 260);
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${file}` });
      console.log(`✅ נשמר: ${file}`);
    } catch (e) {
      console.log(`❌ שגיאה: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\nסיום! הצילומים נשמרו ב: ${OUT}`);
})();
