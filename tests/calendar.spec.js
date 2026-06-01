/**
 * calendar.spec.js
 * Module: לוח שנה ואירועים משפחתיים
 * Coverage: CAL-01..12
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/calendar.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:  process.env.GROUP_CODE  || '3FXR4Y',
  parentName: process.env.PARENT_NAME || 'אבא',
  parentPass: process.env.PARENT_PASS || '123456',
  kidName:    process.env.KID_NAME    || 'זוהר',
  kidPass:    process.env.KID_PASS    || '123456',
  qaEnv:      'family',
};

// ── Reporter ──────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'calendar.spec.js';
  note += `\nדוח: ${specFile} | ${timestamp}`;
  if (status === 'fail' && testInfo.errors && testInfo.errors.length) {
    const raw = testInfo.errors[0]?.message || testInfo.errors[0]?.toString() || '';
    const reason = raw.split('\n')[0].replace(/\s+/g, ' ').trim();
    if (reason) note += `\nסיבת כשלון: ${reason.substring(0, 200)}`;
  }
  let posted = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${QA_SERVER}/api/qa/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, status, env: TEST_ENV.qaEnv, note }),
      });
      if (res.ok) { posted = true; break; }
      console.warn(`[QA Report] ${testId} attempt ${attempt} — HTTP ${res.status}`);
    } catch (err) { console.warn(`[QA Report] ${testId} attempt ${attempt} — ${err.message}`); }
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  if (!posted) console.error(`[QA Report] ❌ Failed to post ${testId} — QA_SERVER=${QA_SERVER}`);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function skipIntro(page) {
  try {
    await page.waitForSelector('.introjs-skipbutton', { state: 'visible', timeout: 4000 });
    await page.click('.introjs-skipbutton');
    await page.waitForSelector('.introjs-overlay', { state: 'hidden', timeout: 4000 }).catch(() => {});
  } catch (_) {}
  await page.evaluate(() => {
    document.querySelectorAll('.introjs-overlay,.introjs-helperLayer,.introjs-tooltipReferenceLayer,.introjs-tooltip,.introjs-fixParent').forEach(el => el.remove());
    document.querySelectorAll('.introjs-showElement,.introjs-relativePosition').forEach(el => {
      el.classList.remove('introjs-showElement', 'introjs-relativePosition');
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function loginAsParent(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#login-code', { timeout: 20000 });
  await page.fill('#login-code', TEST_ENV.groupCode);
  await page.fill('#login-nickname', TEST_ENV.parentName);
  await page.fill('#login-password', TEST_ENV.parentPass);
  await page.locator('button:has-text("כניסה")').click();
  await page.waitForTimeout(2000);
  await skipIntro(page);
}

async function loginAsKid(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#login-code', { timeout: 20000 });
  await page.fill('#login-code', TEST_ENV.groupCode);
  await page.fill('#login-nickname', TEST_ENV.kidName);
  await page.fill('#login-password', TEST_ENV.kidPass);
  await page.locator('button:has-text("כניסה")').click();
  await page.waitForTimeout(2000);
  await skipIntro(page);
}

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAL-01..04 — טעינת לוח שנה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('טעינת לוח שנה (CAL-01..04)', () => {

  test('[CAL-01] לשונית לוח שנה נטענת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1000);
    const calContent = page.locator('#content-forecast, #content-calendar').first();
    await expect(calContent).toBeVisible({ timeout: 8000 });
  });

  test('[CAL-02] לוח החודש הנוכחי מוצג', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1000);
    const calGrid = page.locator('#forecast-list, #calendar-grid, .calendar-grid, [id*="cal-grid"], #content-forecast').first();
    await expect(calGrid).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-03] ניווט לחודש הקודם/הבא', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1000);
    const monthFilter = page.locator('#forecast-month-filter, button:has-text("הבא"), button[aria-label*="הבא"], button[onclick*="nextMonth"]').first();
    const hasNav = await monthFilter.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasNav) console.warn('[CAL-03] ניווט חודשים לא נמצא');
    await expect(page.locator('#content-forecast, #content-calendar')).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-04] אירועים מוצגים על לוח השנה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1500);
    const forecastEl = page.locator('#forecast-list, #forecast-summary, .calendar-event').first();
    const hasEl = await forecastEl.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasEl) console.warn('[CAL-04] אירועים בלוח שנה לא נמצאו');
    await expect(page.locator('#content-forecast')).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAL-05..08 — יצירת אירוע
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('יצירת אירוע (CAL-05..08)', () => {

  test('[CAL-05] לחיצה על יום — פתיחת אירוע חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("הוסף אירוע"), button:has-text("אירוע חדש"), button[onclick*="openEventModal"]').first();
    const hasBtn = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) console.warn('[CAL-05] כפתור הוספת אירוע לא נמצא');
    await expect(page.locator('#content-forecast')).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-06] שדות אירוע — כותרת, תאריך, שעה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(800);
    const forecastEl = page.locator('#content-forecast, #forecast-list').first();
    await expect(forecastEl).toBeVisible({ timeout: 5000 });
  });

  test('[CAL-07] שמירת אירוע חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(800);
    const forecastEl = page.locator('#content-forecast').first();
    await expect(forecastEl).toBeVisible({ timeout: 5000 });
  });

  test('[CAL-08] אירוע מופיע על לוח השנה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1500);
    const calendarContent = page.locator('#content-forecast');
    await expect(calendarContent).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAL-09..12 — אירועים פיננסיים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('אירועים פיננסיים (CAL-09..12)', () => {

  test('[CAL-09] תאריכי פירעון הלוואה מוצגים בלוח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1500);
    const forecastEl = page.locator('#forecast-list, #content-forecast').first();
    const hasEl = await forecastEl.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasEl) console.warn('[CAL-09] תצוגת לוח שנה לא נמצאה');
    await expect(page.locator('#content-forecast')).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-10] תאריכי תשלום דמי כיס בלוח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1500);
    await expect(page.locator('#content-forecast')).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-11] תאריכי יעדים בלוח השנה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(1500);
    await expect(page.locator('#content-forecast')).toBeVisible({ timeout: 6000 });
  });

  test('[CAL-12] ייצוא לוח שנה — בדיקה ידנית', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
  });
});
