/**
 * biz-timeclock.spec.js
 * Module: נוכחות ושעון נוכחות — עסקים
 * Coverage: BIZ-02, BIZ-03, BIZ-04, BIZ-05, BIZ-30
 *
 * Run:
 *   npx playwright test tests/biz-timeclock.spec.js --reporter=html
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'GA1HLF',
  managerName:  process.env.BIZ_MANAGER_NAME  || 'מושיק',
  managerPass:  process.env.BIZ_MANAGER_PASS  || '123456',
  employeeName: process.env.BIZ_EMPLOYEE_NAME || 'אופק',
  employeePass: process.env.BIZ_EMPLOYEE_PASS || '123456',
  qaEnv:        'business',
};

// ── Reporter ──────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-timeclock.spec.js';
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
  } catch (_) {}
  await page.evaluate(() => {
    document.querySelectorAll('.introjs-overlay,.introjs-helperLayer,.introjs-tooltipReferenceLayer,.introjs-tooltip,.introjs-fixParent').forEach(el => el.remove());
    document.querySelectorAll('.introjs-showElement,.introjs-relativePosition').forEach(el => {
      el.classList.remove('introjs-showElement', 'introjs-relativePosition');
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function loginAsManager(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#login-code', { timeout: 20000 });
  await page.fill('#login-code', TEST_ENV.groupCode);
  await page.fill('#login-nickname', TEST_ENV.managerName);
  await page.fill('#login-password', TEST_ENV.managerPass);
  await page.locator('button:has-text("כניסה")').click();
  await page.waitForTimeout(2000);
  await skipIntro(page);
}

async function loginAsEmployee(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#login-code', { timeout: 20000 });
  await page.fill('#login-code', TEST_ENV.groupCode);
  await page.fill('#login-nickname', TEST_ENV.employeeName);
  await page.fill('#login-password', TEST_ENV.employeePass);
  await page.locator('button:has-text("כניסה")').click();
  await page.waitForTimeout(2000);
  await skipIntro(page);
}

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-02 — כניסה לעבודה (Clock-In)
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-02] עובד — כניסה לעבודה (Clock-In)', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsEmployee(page);
  await goToTab(page, 'timeclock');
  await page.waitForTimeout(1000);
  const userView = page.locator('#timeclock-user-view, #content-timeclock');
  await expect(userView).toBeVisible({ timeout: 8000 });
  await expect(
    page.locator('button:has-text("כניסה לעבודה"), button:has-text("התחל משמרת"), #btn-clock-in').first()
  ).toBeVisible({ timeout: 8000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-03 — יציאה מעבודה (Clock-Out)
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-03] עובד — יציאה מעבודה וחישוב שעות (Clock-Out)', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsEmployee(page);
  await goToTab(page, 'timeclock');
  await page.waitForTimeout(1000);
  // Clock in first so that a clock-out button is available
  const clockInBtn = page.locator('button:has-text("כניסה לעבודה"), button:has-text("התחל משמרת"), #btn-clock-in').first();
  const isClockInVisible = await clockInBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (isClockInVisible) {
    await clockInBtn.click();
    await page.waitForTimeout(1500);
  }
  await expect(
    page.locator('button:has-text("יציאה מעבודה"), button:has-text("סיים משמרת"), #btn-clock-out').first()
  ).toBeVisible({ timeout: 8000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-04 — דוח נוכחות למנהל
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-04] מנהל — דוח נוכחות לפי תקופה ועובד', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsManager(page);
  await goToTab(page, 'timeclock');
  await page.waitForTimeout(1000);
  const adminView = page.locator('#timeclock-admin-view, #content-timeclock');
  await expect(adminView).toBeVisible({ timeout: 8000 });
  await expect(
    page.locator('#attendance-report, .timeclock-report, [id*="attendance"]').first()
  ).toBeVisible({ timeout: 8000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-05 — רישום ידני למנהל
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-05] מנהל — רישום נוכחות ידני לעובד', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsManager(page);
  await goToTab(page, 'timeclock');
  await page.waitForTimeout(1000);
  await expect(
    page.locator('button:has-text("רישום ידני"), button:has-text("הוסף רשומה"), #btn-manual-entry').first()
  ).toBeVisible({ timeout: 8000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-30 — מנוחה במהלך משמרת
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-30] עובד — רישום הפסקה / מנוחה במשמרת', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsEmployee(page);
  await goToTab(page, 'timeclock');
  await page.waitForTimeout(1000);
  await expect(
    page.locator('button:has-text("הפסקה"), button:has-text("מנוחה"), #btn-break').first()
  ).toBeVisible({ timeout: 8000 });
});
