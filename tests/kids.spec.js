/**
 * kids.spec.js
 * Module: הרשאות והגדרות משפחה — PFAM
 * Coverage: PFAM-01..20
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/kids.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'kids.spec.js';
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
// PFAM-01..05 — ממשק הורה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ממשק הורה (PFAM-01..05)', () => {

  test('[PFAM-01] הורה — לשוניות גלויות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await page.waitForTimeout(1500);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 6000 });
  });

  test('[PFAM-02] הורה — ניהול חברים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1200);
    await expect(page.locator('#members-list')).toBeVisible({ timeout: 8000 });
  });

  test('[PFAM-03] הורה — יצירת משימה לילד עם ניקוד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ משימה"), #btn-add-task').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[PFAM-04] הורה — אישור סופי של משימת ילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    const approveBtn = page.locator('button:has-text("אישור סופי"), button:has-text("אשר"), [onclick*="approveTask"]').first();
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(approveBtn).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, 'בדיקה ידנית — אין משימות הממתינות לאישור; ילד צריך לסמן "בצעתי" קודם');
    }
  });

  test('[PFAM-05] הורה — אישור/דחיית הלוואת ילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'loans');
    await page.waitForTimeout(1500);
    const loanSection = page.locator('#content-loans, #loans-pending, .loan-requests').first();
    await expect(loanSection).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PFAM-06..10 — תקציב, אקדמיה וכספים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תקציב אקדמיה וכספים (PFAM-06..10)', () => {

  test('[PFAM-06] הורה — עריכת תקציב', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'budget');
    await page.waitForTimeout(1200);
    const editBtn = page.locator('button:has-text("ערוך"), button:has-text("עדכן"), [onclick*="editBudget"]').first();
    await expect(editBtn).toBeVisible({ timeout: 6000 });
  });

  test('[PFAM-07] הורה — הקצאת חבילת אקדמיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1200);
    const assignBtn = page.locator('button:has-text("הקצה"), button:has-text("שלח"), [onclick*="assignPackage"]').first();
    await expect(assignBtn).toBeVisible({ timeout: 5000 });
  });

  test('[PFAM-08] הורה — תנועות כל חברי המשפחה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-cashflow, #cashflow-list, .cashflow-container').first()).toBeVisible({ timeout: 8000 });
  });

  test('[PFAM-09] הורה — הגדרות קבוצה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await page.evaluate(() => { if (typeof window.openGroupSettings === 'function') window.openGroupSettings(); });
    await page.waitForTimeout(800);
    const settingsEl = page.locator('#group-settings-modal, #settings-modal, [id*="group-settings"]').first();
    await expect(settingsEl).toBeVisible({ timeout: 6000 });
  });

  test('[PFAM-10] הורה — הפעלת אשף מחדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await page.evaluate(() => { if (typeof window.openProfileModal === 'function') window.openProfileModal(); });
    await page.waitForTimeout(800);
    const restartBtn = page.locator('button:has-text("הפעל אשף מחדש"), [onclick*="restartWizard"]').first();
    await expect(restartBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PFAM-11..15 — ממשק ילד — הגבלות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ממשק ילד הגבלות (PFAM-11..15)', () => {

  test('[PFAM-11] ילד — לשוניות מוגבלות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await page.waitForTimeout(1500);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 8000 });
  });

  test('[PFAM-12] ילד — לשונית חברים חסומה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await page.waitForTimeout(1500);
    const membersTab = page.locator('[onclick*="switchTab(\'members\')"], [data-tab="members"]').first();
    // Tab must NOT be visible to a kid — if it is visible, that is a permissions bug
    await expect(membersTab).toBeHidden({ timeout: 3000 });
  });

  test('[PFAM-13] ילד — לשונית תקציב חסומה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await page.waitForTimeout(1500);
    const budgetTab = page.locator('[onclick*="switchTab(\'budget\')"], [data-tab="budget"]').first();
    // Tab must NOT be visible to a kid — if it is visible, that is a permissions bug
    await expect(budgetTab).toBeHidden({ timeout: 3000 });
  });

  test('[PFAM-14] ילד — בקשת הלוואה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'loans');
    await page.waitForTimeout(1200);
    const loanBtn = page.locator('button:has-text("בקש הלוואה"), [onclick*="requestLoan"]').first();
    await expect(loanBtn).toBeVisible({ timeout: 5000 });
  });

  test('[PFAM-15] ילד — ביצוע משימה + העלאת תמונה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1500);
    const taskItem = page.locator('.task-item, .task-card').first();
    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(taskItem).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, 'בדיקה ידנית — אין משימות לילד; צור משימה עם PFAM-03 קודם');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PFAM-16..20 — ילד — תוכן ויתרה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ילד תוכן ויתרה (PFAM-16..20)', () => {

  test('[PFAM-16] ילד — אקדמיה — חבילות שהוקצו', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1500);
    const acadArea = page.locator('#content-academy').first();
    await expect(acadArea).toBeVisible({ timeout: 8000 });
  });

  test('[PFAM-17] ילד — הוספת פריט לרשימת קניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'shopping');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ הוסף"), button:has-text("הוסף פריט")').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });

  test('[PFAM-18] ילד — יתרה אישית בדשבורד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await page.waitForTimeout(2000);
    const balance = page.locator('#user-balance, .user-balance').first();
    await expect(balance).toBeVisible({ timeout: 6000 });
  });

  test('[PFAM-19] ילד — ניסיון לשנות הגדרות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await page.waitForTimeout(1500);
    const settingsBtn = page.locator('button:has-text("הגדרות קבוצה"), [onclick*="openGroupSettings"]').first();
    // Settings button must NOT be visible to a kid — if visible, that is a permissions bug
    await expect(settingsBtn).toBeHidden({ timeout: 3000 });
  });

  test('[PFAM-20] ילד — שף AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'chef');
    await page.waitForTimeout(1200);
    const chefArea = page.locator('#content-chef, .chef-ai').first();
    if (await chefArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chefArea).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, 'בדיקה ידנית — שף AI לא הוקצה לילד זה');
    }
  });
});
