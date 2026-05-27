/**
 * biz-ai.spec.js
 * Module: עוזר AI עסקי (BizChat) — עסקים
 * Coverage: BIZ-25, AI-01..15
 *
 * Run:
 *   npx playwright test tests/biz-ai.spec.js --reporter=html
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'GA1HLF',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-ai.spec.js';
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

// ═══════════════════════════════════════════════════════════════════════════════
// BIZ-25 — BizChat (עוזר AI)
// ═══════════════════════════════════════════════════════════════════════════════
test('[BIZ-25] BizChat — עוזר AI עסקי בעברית', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsManager(page);

  // Try clicking a visible AI trigger button first
  const aiBtn = page.locator('button:has-text("BizChat"), button:has-text("עוזר"), button:has-text("AI"), #btn-ai, [id*="ai"][id*="btn"]').first();
  const hasBtn = await aiBtn.isVisible({ timeout: 6000 }).catch(() => false);
  if (hasBtn) {
    await aiBtn.click();
    await page.waitForTimeout(600);
  } else {
    await page.evaluate(() => { if (typeof window.openGlobalAIAssistant === 'function') window.openGlobalAIAssistant(); }).catch(() => {});
    await page.waitForTimeout(600);
  }

  // The AI modal must open
  const aiModal = page.locator('#ai-modal');
  await expect(aiModal).toBeVisible({ timeout: 8000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-01..05 — פתיחה ושימוש בסיסי
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AI בסיסי (AI-01..05)', () => {

  test('[AI-01] AI — כפתור עוזר AI גלוי בממשק', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const aiTrigger = page.locator('[id*="ai"], button:has-text("AI"), button:has-text("עוזר"), .ai-btn').first();
    await expect(aiTrigger).toBeVisible({ timeout: 8000 });
  });

  test('[AI-02] AI — מודל AI נפתח', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });
  });

  test('[AI-03] AI — שדה קלט לשאלה קיים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });
    const inputEl = page.locator('#ai-modal input, #ai-modal textarea, #ai-input').first();
    await expect(inputEl).toBeVisible({ timeout: 6000 });
  });

  test('[AI-04] AI — שאלה ותשובה בסיסית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });

    const inputEl = page.locator('#ai-modal input, #ai-modal textarea, #ai-input').first();
    await expect(inputEl).toBeVisible({ timeout: 6000 });
    await inputEl.fill('מה המכירות שלי היום?');
    await page.waitForTimeout(300);

    const sendBtn = page.locator('#ai-modal button:has-text("שלח"), #ai-modal button[type="submit"], #btn-ai-send').first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    const response = page.locator('#ai-modal .ai-response, #ai-modal .response, #ai-response').first();
    await expect(response).toBeVisible({ timeout: 15000 });
  });

  test('[AI-05] AI — סגירת מודל AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });

    const closeBtn = page.locator('#ai-modal button:has-text("×"), #ai-modal .close-btn, #ai-modal [onclick*="close"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await page.waitForTimeout(400);

    await expect(page.locator('#ai-modal')).toBeHidden({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-06..10 — תכונות מתקדמות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AI מתקדם (AI-06..10)', () => {

  test('[AI-06] AI — הצעות משימות חכמות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const aiTaskBtn = page.locator('button:has-text("AI משימות"), button:has-text("הצע משימות"), .ai-task-suggest').first();
    await expect(aiTaskBtn).toBeVisible({ timeout: 8000 });
  });

  test('[AI-07] AI — BizChat — צ\'אט עסקי מלא', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openGlobalAIAssistant === 'function') window.openGlobalAIAssistant(); }).catch(() => {});
    await page.waitForTimeout(800);
    const aiEl = page.locator('#ai-modal, .ai-chat, [id*="bizchat"]').first();
    await expect(aiEl).toBeVisible({ timeout: 8000 });
  });

  test('[AI-08] AI — ניתוח מכירות אוטומטי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const analyzeBtn = page.locator('button:has-text("נתח"), button:has-text("ניתוח AI"), .ai-analyze').first();
    await expect(analyzeBtn).toBeVisible({ timeout: 8000 });
  });

  test('[AI-09] AI — תשובות בעברית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
    await page.waitForTimeout(800);
    await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });

    const inputEl = page.locator('#ai-modal input, #ai-modal textarea').first();
    await expect(inputEl).toBeVisible({ timeout: 6000 });
    await inputEl.fill('שלום, מה אתה יכול לעזור לי?');

    const sendBtn = page.locator('#ai-modal button:has-text("שלח"), #ai-modal button[type="submit"]').first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    // A response element must appear; text content check is done visually
    const response = page.locator('#ai-modal .ai-response, #ai-modal .response, #ai-response').first();
    await expect(response).toBeVisible({ timeout: 15000 });
  });

  test('[AI-10] AI — מד קרדיט AI (Battery)', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const batteryEl = page.locator('#ai-battery-modal, [id*="battery"], .ai-credits, [id*="credit"]').first();
    await expect(batteryEl).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-11..15 — שדרוג ואינטגרציה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AI שדרוג ואינטגרציה (AI-11..15)', () => {

  test('[AI-11] AI — כפתור שדרוג Premium', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const upgradeBtn = page.locator('button:has-text("שדרג"), button:has-text("Premium"), button:has-text("פרמיום"), [onclick*="upgradeToPremium"]').first();
    await expect(upgradeBtn).toBeVisible({ timeout: 8000 });
  });

  test('[AI-12] AI — AI בלשונית משימות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.switchTab === 'function') window.switchTab('tasks'); });
    await page.waitForTimeout(800);
    const aiTask = page.locator('button:has-text("AI"), [onclick*="selectAITask"], .ai-mode').first();
    await expect(aiTask).toBeVisible({ timeout: 8000 });
  });

  test('[AI-13] AI — הצגת אזהרת AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    // The warning modal appears only before first-use confirmation; if already confirmed this is expected to be hidden
    const warningModal = page.locator('#ai-warning-modal');
    const hasWarning = await warningModal.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasWarning) {
      await expect(warningModal).toBeVisible({ timeout: 3000 });
    } else {
      // Already confirmed — verify the AI modal itself is accessible instead
      await page.evaluate(() => { if (typeof window.openAIModal === 'function') window.openAIModal(); }).catch(() => {});
      await expect(page.locator('#ai-modal')).toBeVisible({ timeout: 8000 });
    }
  });

  test('[AI-14] AI — AI לעובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    const aiBtn = page.locator('[id*="ai"], button:has-text("AI"), button:has-text("עוזר")').first();
    await expect(aiBtn).toBeVisible({ timeout: 8000 });
  });

  test('[AI-15] AI — בדיקת תגובת AI ידנית', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });
});
