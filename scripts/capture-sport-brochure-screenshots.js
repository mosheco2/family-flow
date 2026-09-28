/**
 * capture-sport-brochure-screenshots.js
 * צילום מסכים אמיתיים לחומר שיווקי/תיעודי לעסקי ספורט וכושר.
 * כל id ממופה למודול המקביל במסמך "יכולות ללקוחות" (14 מודולים).
 *
 * הרצה:
 *   BIZ_CODE=B61091CF BIZ_NAME="מירי ספורט" BIZ_PASS=123456 node scripts/capture-sport-brochure-screenshots.js
 *
 * דרישות (env vars, עם ברירות מחדל לעסק "מירי ספורט"):
 *   - BIZ_URL   : כתובת אפליקציית העסק
 *   - BIZ_CODE  : קוד עסק
 *   - BIZ_NAME  : שם משתמש מנהל
 *   - BIZ_PASS  : סיסמה
 *   - DEMO_MEMBER_NAME : שם חבר/ה אמיתי/ת מתוך seed_miri_sport.js לצילום כרטיס מנוי (ברירת מחדל: יוסי אברהם)
 *
 * הפלט: public/screenshots/brochure-sport/<module-id>.png (1280x800, deviceScaleFactor 2)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'public', 'screenshots', 'brochure-sport');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BIZ_URL  = process.env.BIZ_URL  || 'https://weflowz.co.il/business.html';
const BIZ_CODE = process.env.BIZ_CODE || 'B61091CF';
const BIZ_NAME = process.env.BIZ_NAME || 'מירי ספורט';
const BIZ_PASS = process.env.BIZ_PASS || '123456';
const DEMO_MEMBER_NAME = process.env.DEMO_MEMBER_NAME || 'יוסי אברהם';

// ------------------------------------------------------------------
// כל שורה ממופה למודול המקביל במסמך "יכולות ללקוחות — עסק ספורט"
// ------------------------------------------------------------------
const SCREENS = [
  { id: 'm01-dashboard',      tab: 'feed', label: 'לוח בקרה יומי' },

  { id: 'm02-schedule',       tab: 'feed', label: 'לוח חוגים', afterSwitch: (p) => openSportOverlay(p, 'showSportSchedule') },

  { id: 'm03-members',        tab: 'feed', label: 'רשימת מנויים', afterSwitch: (p) => openSportOverlay(p, "showSportMembers", "'all'") },
  { id: 'm03-member-card',    tab: 'feed', label: 'כרטיס חבר/ה פתוח', afterSwitch: openDemoMemberCard },

  { id: 'm04-checkin',        tab: 'feed', label: 'מסך צ׳ק-אין', afterSwitch: (p) => openSportOverlay(p, 'showSportCheckIn') },

  { id: 'm05-membership-types', tab: 'feed', label: 'קטלוג סוגי מנוי', afterSwitch: (p) => openSportOverlay(p, 'showSportMembershipTypes') },
  { id: 'm05-leads',          tab: 'feed', label: 'מסך לידים', afterSwitch: (p) => openSportOverlay(p, 'showSportLeads') },

  { id: 'm07-timeclock',      tab: 'timeclock', label: 'שעון נוכחות' },

  { id: 'm08-cashflow',       tab: 'cashflow', label: 'תזרים מזומנים' },

  { id: 'm10-shifts',         tab: 'shifts', label: 'שיבוץ משמרות' },

  { id: 'm11-equipment',      tab: 'equipment', label: 'ניהול ציוד' },

  { id: 'm12-biz-ads',        tab: 'biz-ads', label: 'פרסום עסקי' },

  { id: 'm13-reports',        tab: 'reports', label: 'דוחות' },
  { id: 'm13-alerts',         tab: 'feed', label: 'התראות — פג תוקף / רדומים', afterSwitch: (p) => openSportOverlay(p, 'showSportAlerts') },
];

// ------------------------------------------------------------------

async function login(page) {
  await page.goto(BIZ_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const codeInput = page.locator('#biz-group-code, input[placeholder*="קוד"], input[name="code"]').first();
  if (await codeInput.isVisible()) {
    await codeInput.fill(BIZ_CODE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  const nameInput = page.locator('#biz-login-name, input[placeholder*="שם"]').first();
  if (await nameInput.isVisible()) await nameInput.fill(BIZ_NAME);

  const passInput = page.locator('#biz-login-pass, input[type="password"]').first();
  if (await passInput.isVisible()) await passInput.fill(BIZ_PASS);

  const loginBtn = page.locator('button:has-text("כניסה"), button:has-text("התחבר")').first();
  if (await loginBtn.isVisible()) {
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

// סוגר כל מודל ספורט (#sport-modal) או overlay אחר שנשאר פתוח משלב קודם
async function closeAnyOpenModal(page) {
  await page.evaluate(() => {
    if (typeof window._sportBack === 'function') { try { window._sportBack(); } catch (e) {} }
    const sm = document.getElementById('sport-modal'); if (sm) sm.classList.add('hidden');
    document.querySelectorAll('.fixed.inset-0').forEach(el => {
      const z = parseInt(getComputedStyle(el).zIndex || '0', 10);
      if (z >= 100) el.remove();
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

// פותח overlay ספורט (מודל מלא-מסך) דרך קריאה ישירה לפונקציית window.showSportXxx(args)
async function openSportOverlay(page, fnName, argsLiteral) {
  await page.evaluate(({ fn, args }) => {
    const call = args ? `window.${fn}(${args})` : `window.${fn}()`;
    // eslint-disable-next-line no-eval
    try { eval(call); } catch (e) {}
  }, { fn: fnName, args: argsLiteral || '' });
  await page.waitForTimeout(1200);
}

// פותח את כרטיס החבר/ה האמיתי/ת (מתוך seed_miri_sport.js) ולא "הראשון ברשימה"
async function openDemoMemberCard(page) {
  await openSportOverlay(page, 'showSportMembers', "'all'");
  await page.waitForTimeout(800);
  const clicked = await page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('[onclick^="window.showSportMemberDetail("]'));
    const match = cards.find(c => c.textContent && c.textContent.includes(name)) || cards[0];
    if (match) { match.click(); return true; }
    return false;
  }, DEMO_MEMBER_NAME);
  if (!clicked) console.warn(`⚠️  לא נמצא חבר/ה בשם "${DEMO_MEMBER_NAME}" — ודא ש-seed_miri_sport.js רץ קודם`);
  await page.waitForTimeout(1000);
}

async function capture(page, id, label) {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✅ ${label} → ${id}.png`);
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל צילום מסכים לחומר השיווקי (ספורט)...');
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
  console.log('שלח את התיקייה (למשל כ-ZIP) בחזרה כדי לשלב אותם בחומר השיווקי.');
}

main().catch(e => { console.error('❌ שגיאה:', e.message); process.exit(1); });
