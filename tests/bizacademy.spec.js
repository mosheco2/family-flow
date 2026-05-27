/**
 * biz-academy.spec.js
 * Module: הכשרות ואקדמיה — עסקים
 * Coverage: ACAD-01..10
 *
 * Run:
 *   npx playwright test tests/biz-academy.spec.js --reporter=html
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-academy.spec.js';
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
// ACAD-01..04 — תצוגות אקדמיה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תצוגות אקדמיה (ACAD-01..04)', () => {

  test('[ACAD-01] אקדמיה — לשונית הכשרות נטענת למנהל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-academy')).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-02] אקדמיה — ממשק ניהול גלוי למנהל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    await expect(
      page.locator('#academy-admin-view, .academy-admin').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-03] אקדמיה — ממשק עובד נטען לעובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    const userView = page.locator('#academy-user-view, #content-academy');
    await expect(userView).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-04] אקדמיה — ממשק ניהול לא גלוי לעובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    await expect(
      page.locator('#academy-admin-view').first()
    ).not.toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACAD-05..07 — ניהול תכנים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול תכנים (ACAD-05..07)', () => {

  test('[ACAD-05] אקדמיה — הוספת הכשרה חדשה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ הכשרה"), button:has-text("הכשרה חדשה"), button:has-text("הוסף תוכן")').first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('[id*="academy"][id*="modal"], [id*="course"][id*="modal"], [id*="training"][id*="modal"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-06] אקדמיה — הקצאת הכשרה לעובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('button:has-text("הקצה"), button:has-text("שלח הכשרה"), .assign-btn').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-07] אקדמיה — מעקב התקדמות עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('.progress-bar, [id*="progress"], .employee-progress').first()
    ).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACAD-08..10 — צריכת תוכן
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('צריכת תוכן (ACAD-08..10)', () => {

  test('[ACAD-08] אקדמיה — עובד צופה בהכשרה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    const trainingItem = page.locator('.academy-item, .course-card, .training-item').first();
    await expect(trainingItem).toBeVisible({ timeout: 8000 });
    await trainingItem.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('[id*="modal"], [id*="content"], [id*="viewer"], .training-content').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-09] אקדמיה — סימון הכשרה כהושלמה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('button:has-text("סיימתי"), button:has-text("הושלם"), .complete-training-btn').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[ACAD-10] אקדמיה — תוכן וידאו / קובץ', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('video, iframe[src*="youtube"], .pdf-viewer, a[href*=".pdf"]').first()
    ).toBeVisible({ timeout: 8000 });
  });
});
