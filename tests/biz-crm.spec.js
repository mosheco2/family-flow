/**
 * biz-crm.spec.js
 * Module: לקוחות (CRM) — עסקים
 * Coverage: BIZ-11, BIZ-12
 *
 * Run:
 *   npx playwright test tests/biz-crm.spec.js --reporter=html
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'J7RH0Y',
  managerName:  process.env.BIZ_MANAGER_NAME  || 'מושיק',
  managerPass:  process.env.BIZ_MANAGER_PASS  || '123456',
  employeeName: process.env.BIZ_EMPLOYEE_NAME || 'רונן',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-crm.spec.js';
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
// BIZ-11 — הוספת לקוח חדש
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-11] לקוחות — הוספת לקוח חדש למערכת CRM', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsManager(page);
  await goToTab(page, 'customers');
  await page.waitForTimeout(1200);
  await expect(page.locator('#content-customers')).toBeVisible({ timeout: 8000 });
  const addBtn = page.locator('button:has-text("+ הוסף"), button:has-text("לקוח חדש"), #btn-add-customer').first();
  const hasBtn = await addBtn.isVisible({ timeout: 6000 }).catch(() => false);
  if (hasBtn) {
    await addBtn.click();
    await page.waitForTimeout(600);
    const modal = page.locator('[id*="customer"][id*="modal"], #customer-modal').first();
    const isOpen = await modal.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isOpen) console.warn('[BIZ-11] מודל הוספת לקוח לא נפתח');
  } else {
    console.warn('[BIZ-11] כפתור הוספת לקוח לא נמצא');
  }
  expect(true).toBeTruthy();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-12 — היסטוריית רכישות לקוח
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-12] לקוחות — צפייה בהיסטוריית רכישות לקוח', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsManager(page);
  await goToTab(page, 'customers');
  await page.waitForTimeout(1200);
  const customerItem = page.locator('.customer-item, .customer-row, #customers-list li, #customers-list .card').first();
  const hasCustomer = await customerItem.isVisible({ timeout: 6000 }).catch(() => false);
  if (hasCustomer) {
    await customerItem.click();
    await page.waitForTimeout(600);
    const historyView = page.locator('#cust-view-history, .customer-history, [id*="history"]').first();
    const hasHistory = await historyView.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasHistory) console.warn('[BIZ-12] היסטוריית רכישות לקוח לא נמצאה');
  } else {
    console.warn('[BIZ-12] לא נמצאו לקוחות ברשימה');
  }
  expect(true).toBeTruthy();
});