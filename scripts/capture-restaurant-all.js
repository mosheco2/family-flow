/**
 * צילום מסכים מלא למדריך מסעדה
 * מצלם: טופס כניסה, טופס הרשמה, טופס הצטרפות, ויזארד, וכל הטאבים
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, '../public/screenshots/guide');

const BIZ_CODE    = 'GA1HLF';
const BIZ_NAME    = 'מושיק';
const BIZ_PASS    = '123456';

const VIEWPORT = { width: 390, height: 844 };
const SCALE    = 2;

async function shot(page, filename, desc) {
  console.log(`📸 ${desc} → ${filename}`);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT, filename),
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height }
  });
  console.log(`   ✓`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: 'he-IL'
  });

  const page = await ctx.newPage();

  // ── 1. מסך כניסה ──────────────────────────────────────────
  await page.goto(`${BASE}/business.html`);
  await page.waitForTimeout(1500);
  await shot(page, 'login.png', 'מסך כניסה');

  // ── 2. טופס הרשמה ─────────────────────────────────────────
  // לחיצה על כפתור "הרשמה" / "פתיחת עסק חדש"
  const regBtn = await page.$('button:has-text("הרשמה"), button:has-text("פתיחת עסק"), a:has-text("הרשמה"), [onclick*="create"], [onclick*="switchView(\'create\')"]');
  if (regBtn) {
    await regBtn.click();
  } else {
    // ניסיון ישיר
    await page.evaluate(() => { if(window.switchView) window.switchView('create'); });
  }
  await page.waitForTimeout(1000);
  // ודא שהתצוגה עברה לטופס ההרשמה
  const createVisible = await page.$('#view-create:not(.hidden)');
  if (createVisible) {
    await shot(page, 'register.png', 'טופס הרשמה');
  } else {
    console.log('   ⚠️ טופס הרשמה לא נמצא');
  }

  // ── 3. טופס הצטרפות ───────────────────────────────────────
  await page.evaluate(() => { if(window.switchView) window.switchView('join'); });
  await page.waitForTimeout(800);
  await shot(page, 'join.png', 'טופס הצטרפות');

  // ── 4. כניסה לחשבון ───────────────────────────────────────
  await page.evaluate(() => { if(window.switchView) window.switchView('login'); });
  await page.waitForTimeout(500);
  await page.fill('#login-code', BIZ_CODE);
  await page.fill('#login-nickname', BIZ_NAME);
  await page.fill('#login-password', BIZ_PASS);
  await page.click('#view-login button[type=submit]');
  await page.waitForTimeout(4000);
  console.log('   ✓ כניסה בוצעה');

  // ── 5. דשבורד ─────────────────────────────────────────────
  await shot(page, 'dashboard.png', 'לוח הבקרה');

  // ── 6. כל הטאבים ──────────────────────────────────────────
  const tabs = [
    ['pos',       'pos.png',       'קופה POS'],
    ['sales',     'sales.png',     'הזמנות'],
    ['customers', 'customers.png', 'אורחים'],
    ['deliveries','deliveries.png','שליחויות'],
    ['reviews',   'reviews.png',   'ביקורות'],
    ['kds',       'kds.png',       'מסך מטבח'],
    ['pantry',    'pantry.png',    'ניהול מלאי'],
    ['shop',      'shop.png',      'הזמנות מספק'],
    ['foodcost',  'foodcost.png',  'תמחור מנות'],
    ['members',   'members.png',   'עובדים'],
    ['shifts',    'shifts.png',    'משמרות'],
    ['timeclock', 'timeclock.png', 'נוכחות'],
    ['tasks',     'tasks.png',     'משימות'],
    ['calendar',  'calendar.png',  'יומן'],
    ['cashflow',  'cashflow.png',  'תזרים'],
    ['budget',    'budget.png',    'תקציב'],
    ['reports',   'reports.png',   'דוחות'],
    ['biz-ads',   'biz-ads.png',   'פרסום FLOW'],
  ];

  for (const [tabId, filename, desc] of tabs) {
    try {
      await page.evaluate((t) => {
        if (window.switchTab) window.switchTab(t);
      }, tabId);
      await page.waitForTimeout(1200);
      await shot(page, filename, desc);
    } catch (err) {
      console.log(`   ⚠️ ${desc}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n✅ הסתיים! כל הצילומים נשמרו ב-public/screenshots/guide/');
})();
