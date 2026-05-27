/**
 * family-core.spec.js
 * Module: Family Core — פיד, קניות, מזווה
 * Coverage: FAM-01..FAM-10
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/family-core.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'family-core.spec.js';
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

async function callAppFn(page, fn, ...args) {
  return page.evaluate(
    ([f, a]) => { const fn = window[f]; if (typeof fn === 'function') return fn(...a); },
    [fn, args]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAM-01..02 — פיד ראשי
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('פיד ראשי (FAM-01..02)', () => {

  test('[FAM-01] פיד הבית נטען עם תוכן לאחר כניסה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    // כרטיס יתרה ופיד פעילות קיימים
    await expect(page.locator('#tour-balance-card')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#user-balance')).toBeVisible();
  });

  test('[FAM-02] כרטיסי קיצורי דרך גלויים בפיד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    // כפתורי פעולה מהירה בדף הבית
    const shortcuts = page.locator('#content-feed button, #content-feed a').filter({ hasText: /קניות|משימה|הלוואה|יעד|הוסף|הפק/ });
    const count = await shortcuts.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAM-03..06 — רשימת קניות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('רשימת קניות (FAM-03..06)', () => {

  test('[FAM-03] הוספת פריט לרשימת קניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shop');
    await page.waitForTimeout(1000);
    // פתח מודל הוספה
    await callAppFn(page, 'openShopModal');
    await page.waitForSelector('#shop-modal', { timeout: 8000 });
    await expect(page.locator('#shop-modal')).toBeVisible();
    // מלא שם פריט
    await page.fill('#shop-item', 'QA בדיקה — חלב');
    await page.locator('#btn-submit-shop').click();
    await page.waitForTimeout(1500);
    // המודל נסגר לאחר שמירה
    await expect(page.locator('#shop-modal')).not.toBeVisible({ timeout: 5000 });
    // הפריט אמור להופיע ברשימה
    await expect(page.locator('#content-shop')).toContainText('חלב', { timeout: 6000 });
  });

  test('[FAM-04] עריכת פריט ברשימת קניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shop');
    await page.waitForTimeout(1500);
    // חפש כפתור עריכה בפריט הראשון — חייב להיות קיים (FAM-03 מוסיף פריט)
    const editBtn = page.locator('#content-shop button[onclick*="edit"], #content-shop button[title*="ערוך"], #content-shop .edit-btn').first();
    await expect(editBtn).toBeVisible({ timeout: 8000 });
    await editBtn.click();
    await page.waitForTimeout(600);
    // וודא שמשהו נפתח — מודל עריכה או שדה עריכה inline
    const modal = page.locator('#shop-modal, [id*="edit-shop"], input:focus').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('[FAM-05] מחיקת פריטים מרשימת הקניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shop');
    await page.waitForTimeout(1500);
    // נסה כפתור "נקה הכל" תחילה
    const clearBtn = page.locator('button:has-text("נקה"), button:has-text("מחק הכל"), button[onclick*="deleteAll"], button[onclick*="clearAll"]').first();
    const hasClear = await clearBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasClear) {
      page.once('dialog', dialog => dialog.accept());
      await clearBtn.click();
      await page.waitForTimeout(1000);
      // הרשימה אמורה להתרוקן
      const items = page.locator('#content-shop li, #content-shop [data-item]');
      await expect(items).toHaveCount(0, { timeout: 6000 });
    } else {
      // מחק פריט בודד
      const delBtn = page.locator('#content-shop button[onclick*="delete"], #content-shop button[title*="מחק"]').first();
      await expect(delBtn).toBeVisible({ timeout: 6000 });
      const countBefore = await page.locator('#content-shop li, #content-shop [data-item]').count();
      page.once('dialog', dialog => dialog.accept());
      await delBtn.click();
      await page.waitForTimeout(800);
      const countAfter = await page.locator('#content-shop li, #content-shop [data-item]').count();
      expect(countAfter).toBeLessThan(countBefore);
    }
  });

  test('[FAM-06] סיום קניות — פעולה נשמרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'shop');
    await page.waitForTimeout(1500);
    // הוסף פריט לרשימה תחילה אם ריקה
    const listText = await page.locator('#content-shop').innerText().catch(() => '');
    if (!listText.includes('QA')) {
      await callAppFn(page, 'openShopModal');
      await page.waitForSelector('#shop-modal', { timeout: 6000 });
      await page.fill('#shop-item', 'QA complete test');
      await page.locator('#btn-submit-shop').click();
      await page.waitForTimeout(1000);
    }
    // כפתור "סיים קניות" חייב להיות גלוי
    const doneBtn = page.locator('button:has-text("סיים קניות"), button:has-text("השלם"), button:has-text("קנינו")').first();
    await expect(doneBtn).toBeVisible({ timeout: 6000 });
    page.once('dialog', dialog => dialog.accept().catch(() => {}));
    await doneBtn.click();
    await page.waitForTimeout(1500);
    // toast הצלחה חייב להופיע, או שהרשימה מתרוקנת
    const toastVisible = await page.locator('#toast:not(.hidden)').isVisible({ timeout: 4000 }).catch(() => false);
    const listEmpty = (await page.locator('#content-shop li, #content-shop [data-item]').count()) === 0;
    expect(toastVisible || listEmpty).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAM-07 — סריקת קבלה עם AI (בדיקה ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[FAM-07] סריקת קבלה עם AI — בדיקה ידנית (דורש מצלמה ו-AI)', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — דורש מצלמה ו-AI לניתוח קבלה, לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAM-08..09 — מזווה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('מזווה (FAM-08..09)', () => {

  test('[FAM-08] הוספת פריט למזווה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'pantry');
    await page.waitForTimeout(1000);
    // פתח מודל מזווה
    await callAppFn(page, 'openPantryModal');
    await page.waitForSelector('#pantry-modal', { timeout: 8000 });
    await expect(page.locator('#pantry-modal')).toBeVisible();
    await page.fill('#pantry-item', 'QA בדיקה — ביצים');
    await page.fill('#pantry-quantity', '12');
    await page.locator('#btn-submit-pantry').click();
    await page.waitForTimeout(1500);
    // המודל נסגר לאחר שמירה
    await expect(page.locator('#pantry-modal')).not.toBeVisible({ timeout: 5000 });
    // בדוק שהפריט הופיע ברשימה
    await expect(page.locator('#pantry-list')).toContainText('ביצים', { timeout: 6000 });
  });

  test('[FAM-09] שימוש/הפחתת כמות מפריט במזווה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'pantry');
    await page.waitForTimeout(1500);
    // כפתור "השתמש" חייב להיות קיים (FAM-08 הוסיף פריט)
    const useBtn = page.locator('#pantry-list button[onclick*="openUse"], #pantry-list button[onclick*="use"], #pantry-list button:has-text("השתמשתי")').first();
    await expect(useBtn).toBeVisible({ timeout: 8000 });
    await useBtn.click();
    await page.waitForTimeout(600);
    // מודל שימוש חייב להיפתח
    await expect(page.locator('#pantry-use-modal')).toBeVisible({ timeout: 6000 });
    await page.fill('#use-pantry-qty', '1');
    await page.locator('#pantry-use-modal button:has-text("אשר"), #pantry-use-modal button:has-text("השתמש")').first().click();
    await page.waitForTimeout(800);
    // המודל נסגר לאחר אישור
    await expect(page.locator('#pantry-use-modal')).not.toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAM-10 — תובנות AI מזווה (בדיקה ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[FAM-10] תובנות AI מזווה — בדיקה ידנית (דורש AI)', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — דורש ניתוח AI, לא ניתן לאוטומציה');
});
