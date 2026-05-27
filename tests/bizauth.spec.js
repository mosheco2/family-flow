/**
 * biz-auth.spec.js
 * Module: אימות וניהול משתמשים — עסקים
 * Coverage: AUTH-01..15
 *
 * Run:
 *   npx playwright test tests/biz-auth.spec.js --reporter=html
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-auth.spec.js';
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
// AUTH-01..02 — מסך כניסה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('מסך כניסה עסקי (AUTH-01..02)', () => {

  test('[AUTH-01] מסך כניסה נטען עם שדות קוד, שם, סיסמה', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#login-code', { timeout: 20000 });
    await expect(page.locator('#login-code')).toBeVisible();
    await expect(page.locator('#login-nickname')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('button:has-text("כניסה")')).toBeVisible();
  });

  test('[AUTH-02] כניסה עם קוד שגוי — הודעת שגיאה', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#login-code', { timeout: 20000 });
    await page.fill('#login-code', 'INVALID');
    await page.fill('#login-nickname', 'בדיקה');
    await page.fill('#login-password', 'wrong');
    await page.locator('button:has-text("כניסה")').click();
    await expect(
      page.locator('#toast-message, :has-text("שגיאה"), :has-text("לא נמצא")').first()
    ).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-03..04 — כניסת מנהל ועובד
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('כניסת מנהל ועובד (AUTH-03..04)', () => {

  test('[AUTH-03] כניסת מנהל — דשבורד מנהל נטען', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 8000 });
  });

  test('[AUTH-04] כניסת עובד — דשבורד עובד נטען', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-05..06 — הרשאות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הרשאות (AUTH-05..06)', () => {

  test('[AUTH-05] מנהל רואה כפתורי ניהול — עובד לא רואה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#btn-add-task').first()).toBeVisible({ timeout: 8000 });
  });

  test('[AUTH-06] עובד — ממשק ניהול מוגבל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(
      page.locator('#tasks-admin-view, #academy-admin-view').first()
    ).not.toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-07..09 — ניהול עובדים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול עובדים (AUTH-07..09)', () => {

  test('[AUTH-07] מנהל רואה רשימת עובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1500);
    await expect(page.locator('#members-list')).toBeVisible({ timeout: 8000 });
  });

  test('[AUTH-08] הזמנת עובד חדש — כפתור WhatsApp', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1000);
    await expect(
      page.locator('#admin-members-tools button:has-text("וואטסאפ"), button:has-text("הזמן")').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('[AUTH-09] עריכת הרשאות עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(2000);
    const permBtn = page.locator('#members-list button[onclick*="openPermissionsModal"]').first();
    await expect(permBtn).toBeVisible({ timeout: 8000 });
    await permBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#permissions-modal')).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-10..12 — פרופיל ויציאה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('פרופיל ויציאה (AUTH-10..12)', () => {

  test('[AUTH-10] מודל פרופיל מנהל נפתח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openProfileModal === 'function') window.openProfileModal(); });
    await page.waitForTimeout(600);
    await expect(page.locator('#profile-modal')).toBeVisible({ timeout: 6000 });
  });

  test('[AUTH-11] שינוי סיסמה — שדות קיימים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openProfileModal === 'function') window.openProfileModal(); });
    await page.waitForTimeout(600);
    await expect(page.locator('#profile-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#old-password')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#new-password')).toBeVisible({ timeout: 5000 });
  });

  test('[AUTH-12] התנתקות — חזרה למסך כניסה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.logout === 'function') window.logout(); });
    await page.waitForTimeout(1500);
    await expect(page.locator('#login-code')).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-13..15 — אבטחה
// ═══════════════════════════════════════════════════════════════════════════════
test('[AUTH-13] HTTPS — חיבור מאובטח', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  expect(page.url().startsWith('https://')).toBeTruthy();
});

test('[AUTH-14] סשן כפול — בדיקה ידנית', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

test('[AUTH-15] פקיעת סשן — בדיקה ידנית', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});
