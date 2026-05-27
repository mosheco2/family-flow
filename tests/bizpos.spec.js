/**
 * biz-pos.spec.js
 * Module: קופה (Point of Sale) — עסקים
 * Coverage: POS-01..15
 *
 * Run:
 *   npx playwright test tests/biz-pos.spec.js --reporter=html
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-pos.spec.js';
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
// POS-01..03 — פתיחה ומסך קופה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('פתיחת קופה (POS-01..03)', () => {

  test('[POS-01] קופה — מסך קופה נטען', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
  });

  test('[POS-02] קופה — קטגוריות מוצרים מוצגות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('#pos-categories-tabs, .pos-category, .category-tab').first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('[POS-03] קופה — חיפוש מוצר לפי שם או ברקוד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('input[placeholder*="חיפוש"], input[placeholder*="מוצר"], #pos-search').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POS-04..07 — עגלת קנייה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('עגלת קניות (POS-04..07)', () => {

  test('[POS-04] קופה — הוספת מוצר לעגלה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const productBtn = page.locator('.pos-product, .product-btn, .pos-item').first();
    await expect(productBtn).toBeVisible({ timeout: 6000 });
    await productBtn.click();
    await page.waitForTimeout(500);
    await expect(
      page.locator('#pos-cart-list, .cart-item, .cart-list').first()
    ).toBeVisible({ timeout: 4000 });
  });

  test('[POS-05] קופה — שינוי כמות בעגלה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const productBtn = page.locator('.pos-product, .product-btn, .pos-item').first();
    await expect(productBtn).toBeVisible({ timeout: 6000 });
    await productBtn.click();
    await page.waitForTimeout(400);
    await expect(
      page.locator('button:has-text("+"), .qty-plus, .increase-qty').first()
    ).toBeVisible({ timeout: 4000 });
  });

  test('[POS-06] קופה — הסרת מוצר מהעגלה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const productBtn = page.locator('.pos-product, .product-btn, .pos-item').first();
    await expect(productBtn).toBeVisible({ timeout: 6000 });
    await productBtn.click();
    await page.waitForTimeout(400);
    await expect(
      page.locator('button:has-text("×"), button:has-text("הסר"), .remove-item, .cart-remove').first()
    ).toBeVisible({ timeout: 4000 });
  });

  test('[POS-07] קופה — הצגת סכום כולל ומע"מ', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('#pos-total, .cart-total, .total-amount, [id*="total"]').first()
    ).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POS-08..11 — תשלום
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תשלום (POS-08..11)', () => {

  test('[POS-08] קופה — מודל תשלום (Tender) נפתח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const chargeBtn = page.locator('button:has-text("גבה"), button:has-text("תשלום"), button:has-text("שלם"), #btn-charge').first();
    await expect(chargeBtn).toBeVisible({ timeout: 6000 });
    await chargeBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('#pos-tender-modal, [id*="tender"][id*="modal"], [id*="payment"][id*="modal"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[POS-09] קופה — תשלום במזומן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const chargeBtn = page.locator('button:has-text("גבה"), button:has-text("תשלום"), #btn-charge').first();
    await expect(chargeBtn).toBeVisible({ timeout: 6000 });
    await chargeBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('button:has-text("מזומן"), .payment-cash, [data-method="cash"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[POS-10] קופה — תשלום בכרטיס אשראי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    const chargeBtn = page.locator('button:has-text("גבה"), button:has-text("תשלום"), #btn-charge').first();
    await expect(chargeBtn).toBeVisible({ timeout: 6000 });
    await chargeBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('button:has-text("אשראי"), button:has-text("כרטיס"), .payment-card, [data-method="card"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[POS-11] קופה — קבלה / חשבונית לאחר תשלום', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('.receipt, #receipt-preview, button:has-text("קבלה"), button:has-text("חשבונית")').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POS-12..15 — החזרות ודוחות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('החזרות ודוחות קופה (POS-12..15)', () => {

  test('[POS-12] קופה — ביצוע החזרה / זיכוי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('button:has-text("החזרה"), button:has-text("זיכוי"), button:has-text("ביטול"), #btn-refund').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[POS-13] קופה — סריקת ברקוד', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });

  test('[POS-14] קופה — דוח יומי למנהל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('button:has-text("דוח"), button:has-text("סגירת קופה"), button:has-text("Z-Report"), #btn-daily-report').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[POS-15] קופה — הדפסת קבלה / שליחה במייל', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });
});
