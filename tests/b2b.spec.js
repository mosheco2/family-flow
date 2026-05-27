/**
 * b2b.spec.js
 * Module: B2B — ממשק עסקי וניהול עסק בקהילה
 * Coverage: B2B-01..12
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/b2b.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:  process.env.GROUP_CODE  || '3FXR4Y',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'b2b.spec.js';
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

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// B2B-01..04 — כרטיס עסק
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('כרטיס עסק (B2B-01..04)', () => {

  test('[B2B-01] עסק בקהילה — כרטיס מוצג', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'community');
    await page.waitForTimeout(1500);

    // The businesses list section must be visible
    await expect(page.locator('#community-businesses-section')).toBeVisible({ timeout: 8000 });

    // At least one business card must be present
    const bizCard = page.locator('#community-businesses-list .business-card, #community-businesses-list [class*="biz"]').first();
    await expect(bizCard).toBeVisible({ timeout: 8000 });
  });

  test('[B2B-02] כרטיס עסק — שם ותיאור מוצגים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'community');
    await page.waitForTimeout(1500);

    await expect(page.locator('#community-businesses-section')).toBeVisible({ timeout: 8000 });

    // A business name element must be present in the list
    const bizName = page.locator('#community-businesses-list [class*="name"], #community-businesses-list h3, #community-businesses-list h4').first();
    await expect(bizName).toBeVisible({ timeout: 8000 });
  });

  test('[B2B-03] כרטיס עסק — אייקון קישור לאתר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'community');
    await page.waitForTimeout(1500);

    await expect(page.locator('#community-businesses-section')).toBeVisible({ timeout: 8000 });

    // A link to an external website must be rendered on the business card
    const link = page.locator('#community-businesses-list a[href], #community-businesses-list [onclick*="window.open"]').first();
    await expect(link).toBeVisible({ timeout: 8000 });
  });

  test('[B2B-04] כפתור "צור קשר" / WhatsApp בכרטיס', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'community');
    await page.waitForTimeout(1500);

    await expect(page.locator('#community-businesses-section')).toBeVisible({ timeout: 8000 });

    // A contact / WhatsApp button must be present on the business card
    const contactBtn = page.locator('#community-businesses-list button:has-text("צור קשר"), #community-businesses-list a[href*="wa.me"], #community-businesses-list a[href*="whatsapp"]').first();
    await expect(contactBtn).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B2B-05..09 — ניהול עסק
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול עסק (B2B-05..09)', () => {

  test('[B2B-05] ממשק בעל עסק — לוח בקרה', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-06] עדכון פרטי עסק', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-07] הגדרת שעות פעילות', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-08] ניהול קטלוג מוצרים/שירותים', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-09] קופון הנחה לחברי הקהילה', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B2B-10..13 — ממשק קהילה B2B
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ממשק קהילה B2B (B2B-10..12)', () => {

  test('[B2B-10] עסק מנהל קהילה — לוח ניהול', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-11] הוספת יוזמה לקהילה', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });

  test('[B2B-12] סטטיסטיקות קהילה — כמה משפחות מחוברות', async ({ page }) => {
    test.skip(true, 'דורש הכנת נתונים ידנית');
  });
});
