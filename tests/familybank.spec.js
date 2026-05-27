/**
 * family-bank.spec.js
 * Module: Family Bank
 * Coverage: FAM-11..FAM-20
 *
 * Run:
 *   npx playwright test tests/family-bank.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:  process.env.GROUP_CODE  || 'TYQPPY',
  parentName: process.env.PARENT_NAME || 'אבא',
  parentPass: process.env.PARENT_PASS || '123456',
  kidName:    process.env.KID_NAME    || 'זוהר',
  kidPass:    process.env.KID_PASS    || '123456',
  qaEnv:      'family',
};

// ── Reporter ─────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'family-bank.spec.js';
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, status, env: TEST_ENV.qaEnv, note }),
      });
      if (res.ok) { posted = true; break; }
      console.warn(`[QA Report] ${testId} attempt ${attempt} — HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[QA Report] ${testId} attempt ${attempt} — ${err.message}`);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  if (!posted) console.error(`[QA Report] ❌ Failed to post result for ${testId} — QA_SERVER=${QA_SERVER}`);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function skipIntro(page) {
  try {
    await page.waitForSelector('.introjs-skipbutton', { state: 'visible', timeout: 5000 });
    await page.click('.introjs-skipbutton');
    await page.waitForSelector('.introjs-overlay', { state: 'hidden', timeout: 5000 }).catch(() => {});
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

// ═════════════════════════════════════════════════════════════════════════════
// BUDGET (FAM-11, FAM-12)
// ═════════════════════════════════════════════════════════════════════════════
test.describe('תקציב משפחתי (FAM-11..12)', () => {

  test('[FAM-11] עריכת סכומי קטגוריית תקציב', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'budget');
    await page.waitForSelector('#budget-list, #content-budget', { timeout: 10000 });

    const editBtn = page.locator('#budget-list button:has-text("ערוך"), #budget-list [onclick*="editBudget"], #budget-list button:has-text("שנה")').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await page.waitForTimeout(600);

    const amountInput = page.locator('#budget-cat-amount, input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 4000 });
    await amountInput.click({ clickCount: 3 });
    await amountInput.fill('500');

    const saveBtn = page.locator('button:has-text("שמור"), button:has-text("עדכן"), button:has-text("אישור")').first();
    await expect(saveBtn).toBeVisible({ timeout: 4000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#content-budget')).toBeVisible({ timeout: 5000 });
  });

  test('[FAM-12] תצוגת תקציב — עמודות מתוכנן ובפועל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'budget');
    await page.waitForSelector('#budget-list, #content-budget', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const budgetContent = page.locator('#budget-list, #btn-add-budget-cat, canvas, [class*="chart"]').first();
    await expect(budgetContent).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CASH FLOW (FAM-13..16)
// ═════════════════════════════════════════════════════════════════════════════
test.describe('תנועות כספיות (FAM-13..16)', () => {

  test('[FAM-13] הוספת הכנסה — מופיעה ברשימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);

    await callAppFn(page, 'openTransactionModal', 'income');
    await expect(page.locator('#transaction-modal')).toBeVisible({ timeout: 8000 });

    await page.fill('#trans-amount', '50');
    await page.fill('#trans-desc', 'QA-auto-income');
    await page.locator('#transaction-modal button:has-text("שמור"), #transaction-modal button:has-text("אשר"), #transaction-modal button:has-text("רשום")').first().click();
    await expect(page.locator('#transaction-modal')).toBeHidden({ timeout: 8000 });

    await goToTab(page, 'cashflow');
    await expect(page.locator('#cashflow-list')).toBeVisible({ timeout: 8000 });
    const listText = await page.locator('#cashflow-list').innerText();
    expect(listText.includes('QA-auto-income') || listText.includes('50')).toBeTruthy();
  });

  test('[FAM-14] לחיצה על תנועה — טופס עריכה נפתח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await expect(page.locator('#cashflow-list')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const opened = await page.evaluate(() => {
      if (!window.allTransactions || !window.allTransactions.length) return false;
      const t = window.allTransactions[0];
      window.openEditTransactionModal(t.id, t.amount, t.description || '', t.category || '', t.type || 'income');
      return true;
    });
    if (opened) {
      await expect(page.locator('#edit-transaction-modal')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, 'בדיקה ידנית — אין תנועות קיימות; הפעל FAM-13 קודם');
    }
  });

  test('[FAM-15] בדיקת מתג תנועה חוזרת בטופס', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);

    await callAppFn(page, 'openTransactionModal', 'income');
    await expect(page.locator('#transaction-modal')).toBeVisible({ timeout: 8000 });

    await expect(page.locator('#btn-trans-recurring')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-trans-recurring').click();
    await page.waitForTimeout(400);

    const val = await page.locator('#trans-is-recurring').inputValue();
    expect(val).toBe('true');
  });

  test('[FAM-16] לשונית תחזית AI נטענת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'forecast');
    await page.waitForTimeout(2000);

    await expect(page.locator('#content-forecast, [id*="forecast"], canvas, [class*="chart"]').first()).toBeVisible({ timeout: 15000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOANS (FAM-17, FAM-18)
// ═════════════════════════════════════════════════════════════════════════════
test.describe('הלוואות (FAM-17..18)', () => {

  test('[FAM-17] ילד מבקש הלוואה — הטופס נשלח בהצלחה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1000);

    await callAppFn(page, 'openLoanModal');
    await expect(page.locator('#loan-modal')).toBeVisible({ timeout: 8000 });

    await page.fill('#loan-amount', '20');
    await page.fill('#loan-reason', 'QA auto loan test');
    await expect(page.locator('#btn-submit-loan')).toBeVisible({ timeout: 4000 });
    await page.locator('#btn-submit-loan').click();

    await expect(page.locator('#loan-modal')).toBeHidden({ timeout: 8000 });
  });

  test('[FAM-18] הורה מאשר הלוואה — toast הצלחה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1500);

    const approveBtn = page.locator('#admin-loans-list button:has-text("אשר"), #admin-loans-list button:has-text("אישור"), #admin-loans-list button[onclick*="approve"]').first();
    if (await approveBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await approveBtn.click();
      await expect(page.locator('#toast:not(.hidden)')).toBeVisible({ timeout: 5000 });
      const toastMsg = await page.locator('#toast-message').innerText().catch(() => '');
      expect(toastMsg).not.toContain('שגיאה');
    } else {
      test.skip(true, 'בדיקה ידנית — אין הלוואות ממתינות; הפעל FAM-17 קודם');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GOALS (FAM-19, FAM-20)
// ═════════════════════════════════════════════════════════════════════════════
test.describe('מטרות חסכון (FAM-19..20)', () => {

  test('[FAM-19] יצירת מטרת חסכון — מופיעה ברשימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1000);

    await callAppFn(page, 'openGoalModal');
    await expect(page.locator('#goal-modal')).toBeVisible({ timeout: 8000 });

    await page.fill('#goal-title', 'QA חסכון');
    await page.fill('#goal-target', '1000');
    await expect(page.locator('#goal-modal button:has-text("צור יעד")')).toBeVisible({ timeout: 4000 });
    await page.locator('#goal-modal button:has-text("צור יעד")').click();

    await expect(page.locator('#goal-modal')).toBeHidden({ timeout: 8000 });
  });

  test('[FAM-20] הפקדה למטרה — מודל הפקדה נפתח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1500);

    const goalItem = page.locator('#my-goals-list > *, #my-goals-container > *').first();
    if (await goalItem.isVisible({ timeout: 8000 }).catch(() => false)) {
      const depositBtn = page.locator('#my-goals-list button:has-text("הפקד"), #my-goals-list button[onclick*="deposit"], #my-goals-list button[onclick*="Deposit"]').first();
      if (await depositBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await depositBtn.click();
        await expect(page.locator('#goal-deposit-modal')).toBeVisible({ timeout: 8000 });
        await page.fill('#goal-deposit-modal input[type="number"]', '10');
        await expect(page.locator('#goal-deposit-modal button:has-text("בצע הפקדה")')).toBeVisible({ timeout: 4000 });
        await page.locator('#goal-deposit-modal button:has-text("בצע הפקדה")').click();
        await expect(page.locator('#goal-deposit-modal')).toBeHidden({ timeout: 8000 });
      } else {
        await goalItem.click();
        await page.waitForTimeout(500);
        await expect(page.locator('#goal-deposit-modal')).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip(true, 'בדיקה ידנית — אין מטרות קיימות; הפעל FAM-19 קודם');
    }
  });
});
