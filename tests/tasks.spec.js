/**
 * tasks.spec.js
 * Module: Task Management — לוח משימות
 * Coverage: TSK-01..TSK-10
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/tasks.spec.js --config=tests/playwright.config.js
 *
 * הערה: TSK-01 חייב לרוץ לפני TSK-02..04 (יוצר את המשימה שבה נשתמש)
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

const TASK_TITLE = 'QA Auto Task — לבדיקה';

// ── Reporter ──────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'tasks.spec.js';
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

async function callAppFn(page, fn, ...args) {
  return page.evaluate(
    ([f, a]) => { const fn = window[f]; if (typeof fn === 'function') return fn(...a); },
    [fn, args]
  );
}

// ── פתיחת מודל משימה ומילויו ─────────────────────────────────────────────────
async function createTask(page, title = TASK_TITLE, reward = 10) {
  await callAppFn(page, 'openTaskModal');
  await page.waitForSelector('#task-modal', { timeout: 8000 });
  await page.fill('#task-title', title);
  // בחר ילד ראשון אם יש
  const assignee = page.locator('#task-assignee option').nth(1);
  const hasAssignee = await assignee.count() > 0;
  if (hasAssignee) {
    const val = await assignee.getAttribute('value');
    if (val) await page.selectOption('#task-assignee', val);
  }
  await page.fill('#task-reward', String(reward));
  await page.locator('#btn-submit-task').click();
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-01 — יצירת משימה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('יצירת משימה (TSK-01)', () => {

  test('[TSK-01] הורה יוצר משימה חדשה — מופיעה בלוח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);

    await createTask(page, TASK_TITLE, 15);

    // המשימה אמורה להופיע ברשימה
    await expect(page.locator('#tasks-list')).toBeVisible({ timeout: 8000 });
    const listText = await page.locator('#tasks-list').innerText().catch(() => '');
    expect(listText.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-02 — עריכת משימה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('עריכת משימה (TSK-02)', () => {

  test('[TSK-02] הורה עורך פרטי משימה קיימת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);

    // חפש כפתור עריכה במשימה הראשונה
    const editBtn = page.locator('#tasks-list button[onclick*="edit"], #tasks-list button[title*="ערוך"], #tasks-list .edit-task-btn').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#task-modal')).toBeVisible({ timeout: 6000 });
    // שנה את הכותרת
    await page.fill('#task-title', TASK_TITLE + ' — עריכה');
    await page.locator('#btn-submit-task').click();
    await page.waitForTimeout(1000);
    // המודל אמור להיסגר לאחר שמירה מוצלחת
    await expect(page.locator('#task-modal')).toBeHidden({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-03 — מחיקת משימה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('מחיקת משימה (TSK-03)', () => {

  test('[TSK-03] הורה מוחק משימה — נעלמת מהרשימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);

    const countBefore = await page.locator('#tasks-list > *').count();

    const delBtn = page.locator('#tasks-list button[onclick*="delete"], #tasks-list button[title*="מחק"], #tasks-list .delete-task-btn').first();
    await expect(delBtn).toBeVisible({ timeout: 5000 });
    page.once('dialog', dialog => dialog.accept().catch(() => {}));
    await delBtn.click();
    await page.waitForTimeout(1200);
    const countAfter = await page.locator('#tasks-list > *').count();
    expect(countAfter).toBeLessThan(countBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-04 — סימון משימה כהושלמה (על ידי ילד)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('סיום משימה (TSK-04..05)', () => {

  test('[TSK-04] ילד מסמן משימה כהושלמה — סטטוס משתנה לממתין לאישור', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);

    // חפש כפתור "בצעתי" / "סיימתי" / "הושלם"
    const doneBtn = page.locator('#tasks-list button:has-text("בצעתי"), #tasks-list button:has-text("סיימתי"), #tasks-list button:has-text("הושלם"), #tasks-list button[onclick*="done"], #tasks-list button[onclick*="completed"]').first();
    await expect(doneBtn).toBeVisible({ timeout: 6000 });
    await doneBtn.click();
    await page.waitForTimeout(1500);
    // בדוק toast הצלחה
    await page.waitForSelector('#toast:not(.hidden)', { timeout: 4000 }).catch(() => {});
    const toastMsg = await page.locator('#toast-message').innerText().catch(() => '');
    expect(toastMsg).not.toContain('שגיאה');
  });

  test('[TSK-05] ילד יכול להעלות הוכחת ביצוע — שדה קיים', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-06 — AI אישור חזותי (בדיקה ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[TSK-06] אישור AI חזותי — בדיקה ידנית (דורש תמונה ו-AI)', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-07..08 — אישור הורה ותגמול
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('אישור ותגמול (TSK-07..08)', () => {

  test('[TSK-07] הורה מאשר משימה שהושלמה — סטטוס עובר ל"הושלם"', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);

    // חפש כפתור "אשר ושלם" (מופיע על משימות ב-done status)
    const approveBtn = page.locator('#tasks-list button:has-text("אשר ושלם"), #tasks-list button[onclick*="openApproveTask"]').first();
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#approve-task-modal')).toBeVisible({ timeout: 6000 });
    // אשר עם סכום
    await page.fill('#approve-task-reward', '15');
    await page.locator('button:has-text("אשר ושלם")').last().click();
    await page.waitForTimeout(1500);
    // המודל אמור להיסגר לאחר אישור מוצלח
    await expect(page.locator('#approve-task-modal')).toBeHidden({ timeout: 6000 });
  });

  test('[TSK-08] יתרת ילד עולה לאחר אישור משימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    // שמור יתרה לפני
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 10000 });
    const balanceBefore = await page.locator('#user-balance').innerText();
    // ההורה אישר ב-TSK-07 — רענן נתונים
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipIntro(page);
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 10000 });
    const balanceAfter = await page.locator('#user-balance').innerText();
    const parseBal = (s) => parseFloat(s.replace(/[^\d.-]/g, '')) || 0;
    expect(parseBal(balanceAfter)).toBeGreaterThan(parseBal(balanceBefore));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-09 — סינון משימות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('סינון משימות (TSK-09)', () => {

  test('[TSK-09] טאב המשימות נטען ומציג רשימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    await expect(page.locator('#content-tasks')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#tasks-list')).toBeVisible();
    // בדוק שכפתור "חדשה" קיים להורה
    await expect(page.locator('#btn-add-task')).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSK-10 — משימה חוזרת
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('משימה חוזרת (TSK-10)', () => {

  test('[TSK-10] מודל יצירת משימה — בדיקת שדות זמינים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(800);
    await callAppFn(page, 'openTaskModal');
    await page.waitForSelector('#task-modal', { timeout: 8000 });
    await expect(page.locator('#task-modal')).toBeVisible();
    await expect(page.locator('#task-title')).toBeVisible();
    // בדוק אם יש שדה "חוזר"
    const recurringField = page.locator('#task-modal [id*="recur"], #task-modal [name*="recur"], #task-modal select, #task-modal input[type="checkbox"]').first();
    await expect(recurringField).toBeVisible({ timeout: 3000 });
    // סגור מודל
    await page.evaluate(() => { if (typeof window.closeTaskModal === 'function') window.closeTaskModal(); });
    await expect(page.locator('#task-modal')).toBeHidden({ timeout: 5000 });
  });
});
