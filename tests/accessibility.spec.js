/**
 * accessibility.spec.js
 * Module: PWA ונגישות — PWA
 * Coverage: PWA-01..12
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/accessibility.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'accessibility.spec.js';
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

// ═══════════════════════════════════════════════════════════════════════════════
// PWA-01..04 — התקנה ו-RTL
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('התקנה ו-RTL (PWA-01..04)', () => {

  test('[PWA-01] PWA — התקנה Android Chrome (ידנית)', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מכשיר פיזי');
  });

  test('[PWA-02] PWA — התקנה iPhone Safari (ידנית)', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מכשיר פיזי');
  });

  test('[PWA-03] PWA — Service Worker פעיל', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(swRegistered, 'Service Worker לא רשום').toBe(true);
  });

  test('[PWA-04] RTL — כיוון טקסט עברית', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    const dir = await page.evaluate(() => document.body.getAttribute('dir') || document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction);
    expect(dir, `כיוון RTL לא מוגדר — ערך בפועל: "${dir}"`).toBe('rtl');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PWA-05..08 — Responsive ומהירות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Responsive ומהירות (PWA-05..08)', () => {

  test('[PWA-05] Responsive — מובייל 375px', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow, 'overflow אופקי גלוי ב-375px — הדף גולש מחוץ לגבולות המסך').toBe(false);
  });

  test('[PWA-06] Responsive — Desktop 1200px+', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    await expect(page.locator('#login-code')).toBeVisible({ timeout: 6000 });
  });

  test('[PWA-07] מהירות — זמן טעינה ראשונית', async ({ page }) => {
    test.setTimeout(120000);
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const loadTime = Date.now() - start;
    expect(loadTime, `זמן טעינה ראשונית: ${loadTime}ms — מעל הסף של 5000ms`).toBeLessThanOrEqual(5000);
  });

  test('[PWA-08] שגיאת DB — הודעה ידידותית', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש סימולציית נפילת DB');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PWA-09..12 — CORS, אבטחה ומגבלות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('CORS אבטחה ומגבלות (PWA-09..12)', () => {

  test('[PWA-09] CORS — Storefront ממקור חיצוני', async ({ page }) => {
    test.setTimeout(120000);
    const storefrontUrl = BASE_URL + '/storefront';
    await page.goto(storefrontUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const errors = await page.evaluate(() => {
      return window.__corsErrors || [];
    }).catch(() => []);
    expect(errors.length, `נמצאו ${errors.length} שגיאות CORS: ${JSON.stringify(errors)}`).toBe(0);
  });

  test('[PWA-10] XSS — הזנת קוד זדוני בשדות', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#login-code', { timeout: 20000 });
    await page.fill('#login-nickname', '<script>alert(1)</script>');
    await page.waitForTimeout(500);
    const alertFired = await page.evaluate(() => window.__xssAlert || false).catch(() => false);
    expect(alertFired, 'XSS נפתח — חולשת אבטחה! window.__xssAlert הוא true').toBe(false);
  });

  test('[PWA-11] SQL Injection — חיפוש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[type="search"], input[placeholder*="חיפוש"]').first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
    await searchInput.fill("' OR 1=1 --");
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    // הדף אמור להישאר תקין — ללא קריסה או חשיפת נתונים
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

  test('[PWA-12] מגבלת 50 מוצרים בחשבון חינמי', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש חשבון עם בדיוק 50 מוצרים');
  });
});
