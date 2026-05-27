/**
 * biz-tasks.spec.js
 * Module: משימות — עסקים
 * Coverage: TSK-01..10
 *
 * Run:
 *   npx playwright test tests/biz-tasks.spec.js --reporter=html
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-tasks.spec.js';
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
// TSK-01..04 — רשימת משימות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('רשימת משימות עסקית (TSK-01..04)', () => {

  test('[TSK-01] כרטיסיית משימות נטענת — מנהל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#tasks-section, #tab-tasks')).toBeVisible({ timeout: 10000 });
  });

  test('[TSK-02] כרטיסיית משימות נטענת — עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#tasks-section, #tab-tasks')).toBeVisible({ timeout: 10000 });
  });

  test('[TSK-03] מנהל רואה כפתור הוספת משימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(
      page.locator('#btn-add-task, button:has-text("הוסף משימה"), button:has-text("משימה חדשה")').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[TSK-04] עובד לא רואה ממשק ניהול משימות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(
      page.locator('#tasks-admin-view, #btn-add-task').first()
    ).not.toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-05..07 — יצירה ועריכת משימה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('יצירה ועריכת משימה (TSK-05..07)', () => {

  test('[TSK-05] מנהל פותח מודל הוספת משימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    const addBtn = page.locator('#btn-add-task, button:has-text("הוסף משימה"), button:has-text("משימה חדשה")').first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('#task-modal, #add-task-modal, [id*="task"][id*="modal"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[TSK-06] שדות משימה קיימים בטופס', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    const addBtn = page.locator('#btn-add-task, button:has-text("הוסף משימה"), button:has-text("משימה חדשה")').first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('#task-title, input[name="title"], input[placeholder*="שם משימה"]').first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('[TSK-07] הקצאת משימה לעובד — שדה בחירת עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    const addBtn = page.locator('#btn-add-task, button:has-text("הוסף משימה"), button:has-text("משימה חדשה")').first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('#task-assignee, select[name="assignee"], [id*="assign"]').first()
    ).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-08..10 — השלמה ומעקב
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('השלמה ומעקב (TSK-08..10)', () => {

  test('[TSK-08] עובד יכול לסמן משימה כהושלמה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('button[onclick*="completeTask"], button:has-text("בצעתי"), .task-complete-btn').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[TSK-09] מנהל רואה משימות שהושלמו', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('#tasks-completed, .tasks-done, [data-status="completed"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[TSK-10] פילטר משימות לפי עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    await expect(
      page.locator('#tasks-filter, select[id*="filter"], button:has-text("סנן")').first()
    ).toBeVisible({ timeout: 8000 });
  });
});
