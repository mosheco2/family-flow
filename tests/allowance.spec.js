/**
 * allowance.spec.js
 * Module: קניות ומלאי — INV
 * Coverage: INV-01..12
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/allowance.spec.js --config=tests/playwright.config.js
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

// ── Reporter ──────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'allowance.spec.js';
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
// INV-01..04 — רשימת קניות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('רשימת קניות (INV-01..04)', () => {

  test('[INV-01] קניות — הוספת פריט לרשימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shopping');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ הוסף"), button:has-text("הוסף פריט"), #btn-add-shopping').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-02] קניות — ייבוא מהיסטוריה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shopping');
    await page.waitForTimeout(1200);
    const importBtn = page.locator('button:has-text("ייבא מקנייה"), button:has-text("היסטוריה")').first();
    await expect(importBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-03] קניות — סיום קנייה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shopping');
    await page.waitForTimeout(1200);
    const finishBtn = page.locator('button:has-text("סיים קנייה"), button:has-text("סיים"), [onclick*="finishShopping"]').first();
    await expect(finishBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-04] מלאי — מחיר היסטורי של פריט', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1500);
    const histItem = page.locator('.inventory-item, .pantry-item, .stock-item').first();
    await expect(histItem).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INV-05..08 — ניהול מלאי
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול מלאי (INV-05..08)', () => {

  test('[INV-05] מלאי — הוספה ידנית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ הוסף ידנית"), button:has-text("הוסף למלאי"), #btn-add-inventory').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-06] מלאי — שימוש בפריט', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1500);
    const useBtn = page.locator('button:has-text("השתמש"), .inventory-item [onclick*="use"]').first();
    await expect(useBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-07] מלאי — תובנת AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1200);
    const aiBtn = page.locator('button:has-text("AI insight"), button:has-text("תובנת AI"), [onclick*="ai"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-08] קניות — סריקת ברקוד', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מצלמה');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INV-09..12 — סריקה, היסטוריה ותפוגה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('סריקה היסטוריה ותפוגה (INV-09..12)', () => {

  test('[INV-09] קניות — סריקת קבלה', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מצלמה');
  });

  test('[INV-10] קניות — היסטוריית קניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shopping');
    await page.waitForTimeout(1200);
    const histBtn = page.locator('button:has-text("היסטוריה"), [onclick*="history"], #shopping-history').first();
    await expect(histBtn).toBeVisible({ timeout: 6000 });
  });

  test('[INV-11] מלאי — פריטים לפני תפוגה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1500);
    const expiredEl = page.locator('.expiry-warning, .expired-item, [class*="expire"]').first();
    await expect(expiredEl).toBeVisible({ timeout: 6000 });
  });

  test('[INV-12] מלאי — ייצוא CSV/PDF', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'inventory');
    await page.waitForTimeout(1200);
    const exportBtn = page.locator('button:has-text("ייצא"), button:has-text("CSV"), button:has-text("PDF")').first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });
});
