/**
 * capture-maintenance-brochure-screenshots.js
 * צילום מסכים אמיתיים לחומר שיווקי/תיעודי לעסקי תחזוקה ותיקונים.
 * כל id ממופה לפרק המקביל במסמך "יכולות ללקוח — עסק תחזוקה ותיקונים".
 *
 * הרצה:
 *   BIZ_CODE=XXXXXXXX BIZ_NAME="שם העסק" BIZ_PASS=123456 node scripts/capture-maintenance-brochure-screenshots.js
 *
 * דרישות (env vars):
 *   - BIZ_URL   : כתובת אפליקציית העסק (ברירת מחדל: https://weflowz.co.il/business.html)
 *   - BIZ_CODE  : קוד עסק (חובה)
 *   - BIZ_NAME  : שם משתמש מנהל (חובה)
 *   - BIZ_PASS  : סיסמה (חובה)
 *   - DEMO_CUSTOMER_NAME : שם לקוח אמיתי קיים בעסק, לצילום כרטיס לקוח + לשונית "קריאות" (אופציונלי —
 *                          אם לא סופק, יילקח הלקוח הראשון ברשימה, אם קיים)
 *
 * הפלט: public/screenshots/brochure-maintenance/<id>.png (1280x800, deviceScaleFactor 2)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'public', 'screenshots', 'brochure-maintenance');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BIZ_URL  = process.env.BIZ_URL  || 'https://weflowz.co.il/business.html';
const BIZ_CODE = process.env.BIZ_CODE || 'J3X2AR';
const BIZ_NAME = process.env.BIZ_NAME || 'דויד כהן';
const BIZ_PASS = process.env.BIZ_PASS || '123456';
const DEMO_CUSTOMER_NAME = process.env.DEMO_CUSTOMER_NAME || '';
// עסק ברירת מחדל: דויד תיקונים (J3X2AR)

if (!BIZ_CODE || !BIZ_NAME || !BIZ_PASS) {
  console.error('❌ חובה לספק BIZ_CODE, BIZ_NAME, BIZ_PASS (משתני סביבה).');
  console.error('   דוגמה: BIZ_CODE=XXXXXXXX BIZ_NAME="שם העסק" BIZ_PASS=123456 node scripts/capture-maintenance-brochure-screenshots.js');
  process.exit(1);
}

// ------------------------------------------------------------------
// כל שורה ממופה לפרק המקביל במסמך "יכולות ללקוח — תחזוקה ותיקונים"
// ------------------------------------------------------------------
const SCREENS = [
  // 1. לוח בקרה
  { id: 'm01-dashboard',        tab: 'feed', label: 'לוח בקרה ראשי (מנהל)' },

  // 2. קריאות שירות
  { id: 'm02-new-call-form',    tab: 'feed', label: 'טופס פתיחת קריאת שירות', afterSwitch: (p) => openOverlay(p, 'showNewServiceCallModal') },
  { id: 'm02-calls-list',       tab: 'feed', label: 'רשימת כל הקריאות', afterSwitch: (p) => openOverlay(p, 'showAllServiceCalls') },
  { id: 'm02-call-detail',      tab: 'feed', label: 'מסך פרטי קריאה', afterSwitch: openDemoCallDetail },

  // 3. פקודות עבודה
  { id: 'm03-work-orders',      tab: 'sales', label: 'פקודות עבודה', afterSwitch: (p) => switchSubTab(p, 'switchSalesTab', 'work-orders') },

  // 4. ניהול לקוחות
  { id: 'm04-customers-list',   tab: 'customers', label: 'רשימת לקוחות' },
  { id: 'm04-customer-detail',  tab: 'customers', label: 'כרטיס לקוח + לשונית קריאות', afterSwitch: openDemoCustomerCard },

  // 5. ניהול צוות
  { id: 'm05-team-feed',        tab: 'members', label: 'ניהול צוות + פיד הצוות' },

  // 6. משימות
  { id: 'm06-tasks',            tab: 'tasks', label: 'משימות ונהלי עבודה' },

  // 7. תזרים וגביה
  { id: 'm07-cashflow',         tab: 'cashflow', label: 'תזרים מזומנים' },
  { id: 'm07-collection',       tab: 'cashflow', label: 'לשונית גביה', afterSwitch: (p) => switchSubTab(p, 'switchCfSubTab', 'collection') },

  // 8. דוחות
  { id: 'm08-reports-main',     tab: 'reports', label: 'טאב דוחות מאוחד' },
  { id: 'm08-reports-detail',   tab: 'feed', label: 'מסך דוחות ואנליטיקות מפורט', afterSwitch: (p) => openOverlay(p, 'showMaintenanceReports') },

  // 9. נוכחות ושכר
  { id: 'm09-timeclock',        tab: 'timeclock', label: 'שעון נוכחות' },
  { id: 'm09-payroll',          tab: 'timeclock', label: 'תשלום שכר לפי נוכחות', afterSwitch: (p) => openOverlay(p, 'openPayrollModal') },

  // 10. מלאי
  { id: 'm10-pantry',           tab: 'pantry', label: 'ניהול מלאי' },

  // 11. רכש וספקים
  { id: 'm11-shop-catalog',     tab: 'shop', label: 'קטלוג רכש', afterSwitch: (p) => switchSubTab(p, 'switchProcurementTab', 'list') },
  { id: 'm11-shop-suppliers',   tab: 'shop', label: 'מאגר ספקים', afterSwitch: (p) => switchSubTab(p, 'switchProcurementTab', 'suppliers') },
  { id: 'm11-shop-orders',      tab: 'shop', label: 'מעקב הזמנות רכש', afterSwitch: (p) => switchSubTab(p, 'switchProcurementTab', 'rfq') },

  // 12. פרסום
  { id: 'm12-biz-ads',          tab: 'biz-ads', label: 'פרסום FLOW' },

  // 13. הזמנת עובד
  { id: 'm13-smart-invite',     tab: 'members', label: 'הזמנת עובד חדש בוואטסאפ', afterSwitch: (p) => openOverlay(p, 'openSmartInviteModal') },
];

// ------------------------------------------------------------------

async function login(page) {
  await page.goto(BIZ_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const codeInput = page.locator('#biz-group-code, input[placeholder*="קוד"], input[name="code"]').first();
  if (await codeInput.isVisible().catch(() => false)) {
    await codeInput.fill(BIZ_CODE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  const nameInput = page.locator('#biz-login-name, input[placeholder*="שם"]').first();
  if (await nameInput.isVisible().catch(() => false)) await nameInput.fill(BIZ_NAME);

  const passInput = page.locator('#biz-login-pass, input[type="password"]').first();
  if (await passInput.isVisible().catch(() => false)) await passInput.fill(BIZ_PASS);

  const loginBtn = page.locator('button:has-text("כניסה"), button:has-text("התחבר")').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(2500);
  }

  await dismissOverlays(page);
}

// סוגר את אשף הברוכים-הבאים ואת באנר "הוסף לדף הבית"
async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const skipBtn = page.locator('button:has-text("דלג")').first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(600);
      continue;
    }
    const installBanner = page.locator('button:has-text("הוסף לדף הבית")').first();
    if (await installBanner.isVisible().catch(() => false)) {
      const closeX = page.locator('button:has(i.fa-xmark), button:has-text("×")').first();
      if (await closeX.isVisible().catch(() => false)) { await closeX.click(); await page.waitForTimeout(400); }
      else break;
      continue;
    }
    break;
  }
  await page.waitForTimeout(500);
}

// סוגר כל מודל/overlay שנשאר פתוח משלב קודם (כולל מודלים של תחזוקה ותיקונים: sc-modal, sc-reports-modal,
// sc-new-modal, sc-all-modal, payroll-modal, smart-invite-modal וכו')
async function closeAnyOpenModal(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.fixed.inset-0').forEach(el => {
      const z = parseInt(getComputedStyle(el).zIndex || '0', 10);
      if (z >= 60) el.remove();
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function switchTab(page, tabId) {
  await closeAnyOpenModal(page);
  await page.evaluate((id) => {
    if (typeof window.switchTab === 'function') window.switchTab(id);
  }, tabId).catch(() => {});
  await page.waitForTimeout(1200);
}

// פותח overlay/מודל דרך קריאה ישירה לפונקציית window.showX()/window.openX()
async function openOverlay(page, fnName, argsLiteral) {
  await page.evaluate(({ fn, args }) => {
    const call = args ? `window.${fn}(${args})` : `window.${fn}()`;
    // eslint-disable-next-line no-eval
    try { eval(call); } catch (e) {}
  }, { fn: fnName, args: argsLiteral || '' });
  await page.waitForTimeout(1200);
}

// עובר לתת-לשונית בתוך tab פתוח (למשל switchSalesTab('work-orders'), switchCfSubTab('collection'))
async function switchSubTab(page, fnName, subTabId) {
  await page.evaluate(({ fn, sub }) => {
    if (typeof window[fn] === 'function') window[fn](sub);
  }, { fn: fnName, sub: subTabId }).catch(() => {});
  await page.waitForTimeout(1000);
}

// פותח את כרטיס הלקוח האמיתי (DEMO_CUSTOMER_NAME) ולא "הראשון ברשימה" כשאפשר
async function openDemoCustomerCard(page) {
  await page.waitForTimeout(800);
  const clicked = await page.evaluate((name) => {
    const rows = Array.from(document.querySelectorAll('#content-customers [onclick*="openCustomerModal"]'));
    const match = name ? rows.find(el => el.textContent && el.textContent.includes(name)) : rows[0];
    if (match) { match.click(); return true; }
    return false;
  }, DEMO_CUSTOMER_NAME);
  if (!clicked) { console.warn('⚠️  לא נמצא לקוח לפתיחת כרטיס — ודא שקיים לקוח אחד לפחות בעסק'); return; }
  await page.waitForTimeout(1000);
  // מעבר ללשונית "קריאות" בכרטיס הלקוח, אם קיימת (רק לעסקי תחזוקה ותיקונים)
  await page.evaluate(() => {
    const btn = document.getElementById('btn-cust-main-calls') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('קריאות') && b.onclick);
    if (btn) btn.click();
  }).catch(() => {});
  await page.waitForTimeout(800);
}

// פותח קריאת שירות אמיתית מתוך הרשימה (לא "הראשונה" בהכרח, אבל אמיתית ולא ריקה)
async function openDemoCallDetail(page) {
  await openOverlay(page, 'showAllServiceCalls');
  await page.waitForTimeout(800);
  const clicked = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[onclick^="showServiceCallModal("]'));
    if (cards.length) { cards[0].click(); return true; }
    return false;
  });
  if (!clicked) console.warn('⚠️  לא נמצאה קריאת שירות לפתיחה — ודא שקיימת לפחות קריאה אחת בעסק');
  await page.waitForTimeout(1000);
}

async function capture(page, id, label) {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✅ ${label} → ${id}.png`);
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל צילום מסכים לחומר השיווקי (תחזוקה ותיקונים)...');
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
      : undefined,
    headless: true,
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await login(page);
  console.log('🔐 מחובר לעסק');

  for (const screen of SCREENS) {
    try {
      await switchTab(page, screen.tab);
      await dismissOverlays(page);
      if (screen.afterSwitch) await screen.afterSwitch(page);
      await dismissOverlays(page);
      await capture(page, screen.id, screen.label);
    } catch (e) {
      console.warn(`⚠️  דילג על ${screen.id}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n✅ הושלם! התמונות נשמרו ב: ${OUT_DIR}`);
  console.log('שלח את התיקייה (למשל כ-ZIP) בחזרה כדי לשלב אותן בחומר השיווקי/במדריך.');
}

main().catch(e => { console.error('❌ שגיאה:', e.message); process.exit(1); });
