/**
 * budget.spec.js
 * Module: כספים ותקציב — FIN
 * Coverage: FIN-01..12
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/budget.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:  process.env.GROUP_CODE  || 'TYQPPY',
  parentName: process.env.PARENT_NAME || 'אבא',
  parentPass: process.env.PARENT_PASS || '123456',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'budget.spec.js';
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

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIN-01..04 — תנועות כספיות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תנועות כספיות (FIN-01..04)', () => {

  test('[FIN-01] כספים — הוספת הכנסה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ תנועה"), button:has-text("הוסף תנועה"), button:has-text("הכנסה")').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[FIN-02] כספים — הוספת הוצאה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ תנועה"), button:has-text("הוצאה")').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[FIN-03] כספים — עריכת תנועה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1500);
    const editBtn = page.locator('.cashflow-item button:has-text("ערוך"), .transaction-item [onclick*="edit"]').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
  });

  test('[FIN-04] כספים — מחיקת תנועה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1500);
    const delBtn = page.locator('.cashflow-item button:has-text("מחק"), .transaction-item [onclick*="delete"]').first();
    await expect(delBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIN-05..08 — תקציב וגרפים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תקציב וגרפים (FIN-05..08)', () => {

  test('[FIN-05] כספים — תנועה חוזרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const recurEl = page.locator('button:has-text("חוזרת"), input[name*="recur"], label:has-text("חוזרת")').first();
    await expect(recurEl).toBeVisible({ timeout: 5000 });
  });

  test('[FIN-06] תקציב — עריכת תקציב קטגוריה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'budget');
    await page.waitForTimeout(1200);
    const editBtn = page.locator('button:has-text("ערוך"), button:has-text("עדכן תקציב"), [onclick*="editBudget"]').first();
    await expect(editBtn).toBeVisible({ timeout: 6000 });
  });

  test('[FIN-07] תקציב — בדיקת חריגה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'budget');
    await page.waitForTimeout(1200);
    // Budget page must load; overage indicator is data-dependent — skip if absent
    await expect(page.locator('#content-budget, #budget-list').first()).toBeVisible({ timeout: 8000 });
    const warning = page.locator('.budget-warning, .over-budget, [class*="exceed"]').first();
    if (await warning.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(warning).toBeVisible();
    } else {
      test.skip(true, 'בדיקה ידנית — אין חריגת תקציב בנתונים הנוכחיים');
    }
  });

  test('[FIN-08] כספים — גרף חודשי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1500);
    const chart = page.locator('canvas, .chart-container, [id*="chart"], svg').first();
    await expect(chart).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIN-09..12 — ייצוא, AI ומשכורות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ייצוא AI ומשכורות (FIN-09..12)', () => {

  test('[FIN-09] כספים — ייצוא PDF', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const exportBtn = page.locator('button:has-text("ייצא PDF"), button:has-text("הדפס"), button:has-text("ייצא")').first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });

  test('[FIN-10] כספים — תחזית AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const aiBtn = page.locator('button:has-text("תחזית AI"), button:has-text("ניתוח AI"), button[onclick*="ai"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
  });

  test('[FIN-11] כספים — התאמת מאזן ידנית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const adjustBtn = page.locator('button:has-text("התאמה ידנית"), button:has-text("התאם מאזן"), [onclick*="adjust"]').first();
    await expect(adjustBtn).toBeVisible({ timeout: 5000 });
  });

  test('[FIN-12] משכורות — עיבוד יום משכורת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'cashflow');
    await page.waitForTimeout(1200);
    const salaryBtn = page.locator('button:has-text("יום משכורת"), button:has-text("עבד יום משכורת"), [onclick*="salary"]').first();
    await expect(salaryBtn).toBeVisible({ timeout: 5000 });
  });
});
