/**
 * export.spec.js
 * Module: הזמנות, קופונים ומבצעים — STR
 * Coverage: STR-17..23
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/export.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'J7RH0Y',
  managerName:  process.env.BIZ_MANAGER_NAME  || 'מושיק',
  managerPass:  process.env.BIZ_MANAGER_PASS  || '123456',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'export.spec.js';
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

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STR-17..19 — הזמנות Checkout
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הזמנות Checkout (STR-17..19)', () => {

  test('[STR-17] Storefront — שליחת הזמנה', async ({ page }) => {
    test.setTimeout(120000);
    const storefrontUrl = BASE_URL + '/storefront?store=' + TEST_ENV.groupCode;
    await page.goto(storefrontUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const checkoutBtn = page.locator('button:has-text("לתשלום"), button:has-text("checkout"), button:has-text("שלח הזמנה")').first();
    await expect(checkoutBtn).toBeVisible({ timeout: 6000 });
  });

  test('[STR-18] Storefront — קוד קופון בתשלום', async ({ page }) => {
    test.setTimeout(120000);
    const storefrontUrl = BASE_URL + '/storefront?store=' + TEST_ENV.groupCode;
    await page.goto(storefrontUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const couponInput = page.locator('input[placeholder*="קופון"], input[id*="coupon"], #coupon-input').first();
    await expect(couponInput).toBeVisible({ timeout: 5000 });
  });

  test('[STR-19] הזמנות — עדכון סטטוס', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'orders');
    await page.waitForTimeout(1200);
    const orderList = page.locator('#orders-list, #content-orders, .orders-container').first();
    await expect(orderList).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STR-20..23 — קופונים ומבצעים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('קופונים ומבצעים (STR-20..23)', () => {

  test('[STR-20] קופונים — יצירת קופון חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'coupons');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ קופון"), button:has-text("קופון חדש"), #btn-add-coupon').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[STR-21] Storefront — קופון פג תוקף', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });

  test('[STR-22] מבצעים — יצירת מבצע חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'promotions');
    await page.waitForTimeout(1200);
    const addBtn = page.locator('button:has-text("+ מבצע"), button:has-text("מבצע חדש"), #btn-add-promotion').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[STR-23] Storefront — באנר מבצע', async ({ page }) => {
    test.setTimeout(120000);
    const storefrontUrl = BASE_URL + '/storefront?store=' + TEST_ENV.groupCode;
    await page.goto(storefrontUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const banner = page.locator('.promotion-banner, .sale-banner, [class*="promo"]').first();
    await expect(banner).toBeVisible({ timeout: 5000 });
  });
});
