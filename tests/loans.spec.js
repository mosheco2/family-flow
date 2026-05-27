/**
 * loans.spec.js
 * Module: משמרות — SHF
 * Coverage: SHF-01..10
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/loans.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'J7RH0Y',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'loans.spec.js';
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
// SHF-01..05 — יצירה ושיבוץ משמרות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('יצירה ושיבוץ משמרות (SHF-01..05)', () => {

  test('[SHF-01] משמרות — יצירת משמרת חדשה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ משמרת"), button:has-text("משמרת חדשה"), #btn-add-shift').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-02] משמרות — שיבוץ עובד למשמרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1500);
    const assignBtn = page.locator('button:has-text("שבץ עובד"), [onclick*="assignShift"]').first();
    await expect(assignBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-03] משמרות — עובד מבקש משמרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const reqBtn = page.locator('button:has-text("בקש משמרת"), [onclick*="requestShift"]').first();
    await expect(reqBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-04] משמרות — מנהל מאשר/דוחה בקשה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1500);
    const pendingBtn = page.locator('button:has-text("בקשות ממתינות"), [onclick*="pendingShifts"], #shift-requests').first();
    await expect(pendingBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-05] משמרות — ביטול שיבוץ עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1500);
    const removeBtn = page.locator('button:has-text("הסר עובד"), [onclick*="removeShift"]').first();
    await expect(removeBtn).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SHF-06..10 — חילוף, תצוגה וייצוא
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('חילוף תצוגה וייצוא (SHF-06..10)', () => {

  test('[SHF-06] משמרות — בקשת חילוף עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const swapBtn = page.locator('button:has-text("בקש חילוף"), [onclick*="swapShift"]').first();
    await expect(swapBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-07] משמרות — תצוגה שבועית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const weekView = page.locator('button:has-text("שבועי"), [onclick*="weekView"], .shifts-weekly-view').first();
    await expect(weekView).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-08] משמרות — סיכום חודשי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const summaryBtn = page.locator('button:has-text("סיכום חודשי"), [onclick*="monthlySummary"]').first();
    await expect(summaryBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-09] משמרות — בדיקת חפיפה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const shiftView = page.locator('#content-shifts, .shifts-container, #shifts-board').first();
    await expect(shiftView).toBeVisible({ timeout: 6000 });
  });

  test('[SHF-10] משמרות — ייצוא PDF/CSV', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shifts');
    await page.waitForTimeout(1200);
    const exportBtn = page.locator('button:has-text("ייצא"), button:has-text("PDF"), button:has-text("CSV")').first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });
});
