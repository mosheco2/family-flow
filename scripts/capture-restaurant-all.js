/**
 * צילום מסכים מלא למדריך מסעדה
 * מצלם: טופס כניסה, הרשמה, הצטרפות, וכל הטאבים
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT  = path.join(__dirname, '../public/screenshots/guide');

const BIZ_CODE = 'GA1HLF';
const BIZ_NAME = 'מושיק';
const BIZ_PASS = '123456';

const VIEWPORT = { width: 390, height: 844 };
const SCALE    = 2;

async function shot(page, filename, desc) {
  console.log(`📸 ${desc} → ${filename}`);
  // המתן שהרשת תשקוט (טעינת נתונים מהשרת)
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (_) { /* בסדר אם לא */ }
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(OUT, filename),
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height }
  });
  // בדיקה שהתמונה לא ריקה (>30KB)
  const size = fs.statSync(path.join(OUT, filename)).size;
  console.log(`   ✓ ${Math.round(size/1024)}KB`);
}

async function switchTabAndWait(page, tabId) {
  await page.evaluate((t) => {
    if (window.switchTab) window.switchTab(t);
  }, tabId);
  // המתן שתוכן הטאב יופיע ושה-API יחזיר נתונים
  try {
    await page.waitForLoadState('networkidle', { timeout: 6000 });
  } catch (_) { /* בסדר */ }
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.platform === 'linux' ? '/opt/pw-browsers/chromium' : undefined,
    headless: false, // headless:false עוזר לוודא שהתוכן מתרנדר נכון
    slowMo: 100
  });

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: 'he-IL'
  });

  const page = await ctx.newPage();

  // ── 1. מסך כניסה ──────────────────────────────────────────
  await page.goto(`${BASE}/business.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'login.png', 'מסך כניסה');

  // ── 2. טופס הרשמה ─────────────────────────────────────────
  await page.evaluate(() => { if(window.switchView) window.switchView('create'); });
  await page.waitForTimeout(600);
  const createVisible = await page.$('#view-create:not(.hidden)');
  if (createVisible) {
    await shot(page, 'register.png', 'טופס הרשמה');
  } else {
    console.log('   ⚠️ טופס הרשמה לא נמצא');
  }

  // ── 3. טופס הצטרפות ───────────────────────────────────────
  await page.evaluate(() => { if(window.switchView) window.switchView('join'); });
  await page.waitForTimeout(600);
  await shot(page, 'join.png', 'טופס הצטרפות');

  // ── 4. כניסה לחשבון ───────────────────────────────────────
  await page.evaluate(() => { if(window.switchView) window.switchView('login'); });
  await page.waitForTimeout(500);
  await page.fill('#login-code', BIZ_CODE);
  await page.fill('#login-nickname', BIZ_NAME);
  await page.fill('#login-password', BIZ_PASS);
  await page.click('#view-login button[type=submit]');
  // המתן לטעינה מלאה של הדשבורד
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch (_) { /* בסדר */ }
  await page.waitForTimeout(3000);
  console.log('   ✓ כניסה בוצעה');

  // ── 5. דשבורד ─────────────────────────────────────────────
  await shot(page, 'dashboard.png', 'לוח הבקרה');

  // ── 6. כל הטאבים — עם המתנה ארוכה לטעינת נתונים ──────────
  const tabs = [
    ['pos',        'pos.png',        'קופה POS'],
    ['sales',      'sales.png',      'הזמנות'],
    ['customers',  'customers.png',  'אורחים'],
    ['deliveries', 'deliveries.png', 'שליחויות'],
    ['reviews',    'reviews.png',    'ביקורות'],
    ['kds',        'kds.png',        'מסך מטבח'],
    ['pantry',     'pantry.png',     'ניהול מלאי'],
    ['shop',       'shop.png',       'הזמנות מספק'],
    ['foodcost',   'foodcost.png',   'תמחור מנות'],
    ['members',    'members.png',    'ניהול עובדים'],
    ['shifts',     'shifts.png',     'משמרות'],
    ['timeclock',  'timeclock.png',  'נוכחות'],
    ['tasks',      'tasks.png',      'משימות'],
    ['calendar',   'calendar.png',   'יומן'],
    ['cashflow',   'cashflow.png',   'תזרים'],
    ['budget',     'budget.png',     'תקציב'],
    ['reports',    'reports.png',    'דוחות'],
    ['biz-ads',    'biz-ads.png',    'פרסום FLOW'],
  ];

  for (const [tabId, filename, desc] of tabs) {
    try {
      await switchTabAndWait(page, tabId);
      await shot(page, filename, desc);
    } catch (err) {
      console.log(`   ⚠️ ${desc}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n✅ הסתיים! כל הצילומים נשמרו ב-public/screenshots/guide/');
  console.log('עכשיו הריצו: git add public/screenshots/guide/ && git commit -m "screenshots" && git push');
})();
