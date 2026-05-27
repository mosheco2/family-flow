/**
 * ai.spec.js
 * Module: תכונות AI ובינה מלאכותית
 * Coverage: AI-01..15
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/ai.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'ai.spec.js';
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
// AI-01..04 — ממשק AI בסיסי
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ממשק AI (AI-01..04)', () => {

  test('[AI-01] כפתור AI / "יצירת משימה חכמה" גלוי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    const aiBtn = page.locator('button:has-text("✨"), button:has-text("AI"), button:has-text("חכם"), button[onclick*="ai"], button[onclick*="AI"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
  });

  test('[AI-02] כפתור "יצירת אתגר AI" בАкадемיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1000);
    const aiBtn = page.locator('button:has-text("✨"), button:has-text("יצירת אתגר"), button[onclick*="generateAI"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
  });

  test('[AI-03] תובנות AI על פיד הבית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await page.waitForTimeout(1500);
    const aiInsight = page.locator('[id*="ai-insight"], [id*="insight"], button:has-text("תובנות")').first();
    await expect(aiInsight).toBeVisible({ timeout: 6000 });
  });

  test('[AI-04] כפתור AI ב-Pantry — ניתוח מלאי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'pantry');
    await page.waitForTimeout(1000);
    const aiBtn = page.locator('button:has-text("✨"), button:has-text("AI"), button[onclick*="aiAnalyze"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-05..08 — יצירת תוכן AI
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('יצירת תוכן AI (AI-05..08)', () => {

  test('[AI-05] יצירת משימה חכמה — פתיחת מודל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(800);
    const aiBtn = page.locator('button:has-text("✨"), button[onclick*="openAITaskModal"], button[onclick*="generateTask"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 6000 });
    await aiBtn.click();
    await page.waitForTimeout(800);
    const modal = page.locator('#ai-task-modal, [id*="ai-task"], [id*="generate"]').first();
    await expect(modal).toBeVisible({ timeout: 6000 });
  });

  test('[AI-06] שדה תיאור AI — הזנת טקסט חופשי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(800);
    await page.evaluate(() => { if (typeof openAITaskModal === 'function') openAITaskModal(); });
    await page.waitForTimeout(800);
    const modal = page.locator('#ai-task-modal, [id*="ai-task"]').first();
    await expect(modal).toBeVisible({ timeout: 6000 });
    const inputField = page.locator('#ai-task-input, #ai-prompt, textarea[name*="ai"]').first();
    await expect(inputField).toBeVisible({ timeout: 5000 });
    await inputField.fill('צור משימה לדני — לסדר את החדר שלו');
    await expect(inputField).toHaveValue('צור משימה לדני — לסדר את החדר שלו');
  });

  test('[AI-07] יצירת אתגר Academy ע"י AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(800);
    await page.evaluate(() => { if (typeof openAIQuizModal === 'function') openAIQuizModal(); });
    await page.waitForTimeout(800);
    const modal = page.locator('#ai-quiz-modal, [id*="ai-quiz"], [id*="generate-quiz"]').first();
    await expect(modal).toBeVisible({ timeout: 6000 });
  });

  test('[AI-08] ניתוח קבלה עם AI — ממשק סריקה', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מצלמה');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-09..12 — תוצאות AI
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תוצאות AI (AI-09..12)', () => {

  test('[AI-09] AI מחזיר תוצאה בזמן סביר', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש מדידת זמן תגובה AI אמיתי');
  });

  test('[AI-10] תוצאת AI מוצגת למשתמש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(800);
    const aiResult = page.locator('[id*="ai-result"], [id*="ai-output"], [class*="ai-"]').first();
    await expect(aiResult).toBeVisible({ timeout: 6000 });
  });

  test('[AI-11] אישור/ביטול תוצאת AI', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש הפעלת AI תחילה לקבלת תוצאה לאישור');
  });

  test('[AI-12] שגיאת AI — הודעה מתאימה', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(true, 'בדיקה ידנית — דורש סימולציית שגיאת AI (אין חיבור / quota)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-13..16 — הגדרות AI
// ═══════════════════════════════════════════════════════════════════════════════
test('[AI-13] מפתח API של OpenAI — הגדרה בסביבה', async ({ page }) => {
  test.setTimeout(120000);
  test.skip(true, 'בדיקה ידנית — בדיקת מפתח API בסביבת שרת בלבד');
});

test('[AI-14] AI מציע המלצות חיסכון', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsParent(page);
  await page.waitForTimeout(2000);
  const suggestionEl = page.locator('[id*="ai-suggestion"], [id*="saving-tip"], :has-text("טיפ")').first();
  await expect(suggestionEl).toBeVisible({ timeout: 6000 });
});

test('[AI-15] AI יוצר שאלות חידון לגיל ילד', async ({ page }) => {
  test.setTimeout(120000);
  test.skip(true, 'בדיקה ידנית — דורש הפעלת AI ובדיקת שאלות לפי גיל');
});
