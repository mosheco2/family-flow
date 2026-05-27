/**
 * rewards.spec.js
 * Module: SuperAdmin — שיווק וניוזלטר
 * Coverage: SMK-01..20
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/rewards.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  saPassword: process.env.SA_PASS || 'admin',
  qaEnv: 'family',
};

// ── Reporter ──────────────────────────────────────────────────────────────────
test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/\[(.*?)\]/);
  if (!match) return;
  const testId = match[1];
  const status = testInfo.status === 'passed' ? 'ok' : 'fail';
  const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  let note = `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'rewards.spec.js';
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

// ── Helpers ──────────────────────────────────────────────────────────────────
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

async function loginAsSA(page) {
  await page.goto(`${BASE_URL}/sa.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#sa-password, input[type="password"]', { timeout: 20000 });
  const pwdInput = page.locator('#sa-password, input[type="password"]').first();
  await pwdInput.fill(TEST_ENV.saPassword);
  const loginBtn = page.locator('button:has-text("כנס"), button:has-text("כניסה"), button[type="submit"]').first();
  await loginBtn.click();
  await page.waitForTimeout(2000);
}

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

async function goToMarketingTab(page) {
  const marketingTab = page.locator('button:has-text("שיווק"), a:has-text("שיווק"), button:has-text("Marketing")').first();
  const hasTab = await marketingTab.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasTab) {
    await marketingTab.click();
    await page.waitForTimeout(1000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMK-01..08 — ניוזלטר — יסודות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניוזלטר — יסודות (SMK-01..08)', () => {

  test('[SMK-01] SA שיווק — לשונית "שיווק" נטענת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const marketingSection = page.locator('[id*="marketing"], [id*="newsletter"], [class*="marketing"]').first();
    await expect(marketingSection).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-02] SA שיווק — ניוזלטר: בחירת שפה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const langSelect = page.locator('#newsletter-lang, select[name*="lang"], select[name*="language"]').first();
    await expect(langSelect).toBeVisible({ timeout: 5000 });
    await langSelect.selectOption({ label: 'עברית' }).catch(async () => {
      await langSelect.selectOption({ index: 0 });
    });
    await page.waitForTimeout(500);
  });

  test('[SMK-03] SA שיווק — ניוזלטר: שדות כותרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const subjectField = page.locator('#newsletter-subject, input[name*="subject"], input[placeholder*="נושא"]').first();
    await expect(subjectField).toBeVisible({ timeout: 5000 });
    await subjectField.fill('QA — ניוזלטר בדיקה');
    await expect(subjectField).toHaveValue('QA — ניוזלטר בדיקה');
  });

  test('[SMK-04] SA שיווק — ניוזלטר: עורך תוכן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const editor = page.locator('#newsletter-content, textarea[name*="content"], .newsletter-editor').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.fill('QA — תוכן ניוזלטר בדיקה');
    await expect(editor).toHaveValue('QA — תוכן ניוזלטר בדיקה');
  });

  test('[SMK-05] SA שיווק — ניוזלטר: יצירת תוכן עם AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const aiBtn = page.locator('button:has-text("✨"), button:has-text("AI"), button[onclick*="generateNewsletter"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 5000 });
    await aiBtn.click();
    await page.waitForTimeout(1500);
  });

  test('[SMK-06] SA שיווק — ניוזלטר: תצוגה מקדימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const previewBtn = page.locator('button:has-text("תצוגה מקדימה"), button:has-text("Preview"), button[onclick*="previewNewsletter"]').first();
    await expect(previewBtn).toBeVisible({ timeout: 5000 });
    await previewBtn.click();
    await page.waitForTimeout(1000);
    const preview = page.locator('[id*="newsletter-preview"], [class*="preview"]').first();
    await expect(preview).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-07] SA שיווק — ניוזלטר: ייצוא PDF', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const pdfBtn = page.locator('button:has-text("ייצוא PDF"), button:has-text("PDF"), button[onclick*="exportPDF"]').first();
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-08] SA שיווק — ניוזלטר: בדיקת ריווח RTL ב-PDF', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMK-09..16 — ניוזלטר — שידורים ומסרים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניוזלטר — שידורים ומסרים (SMK-09..16)', () => {

  test('[SMK-09] SA שיווק — ניוזלטר: בדיקת פיסוק RTL', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });

  test('[SMK-10] SA שיווק — ניוזלטר: header/footer', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const headerSection = page.locator('[id*="newsletter-header"], [id*="header-template"], input[name*="header"]').first();
    await expect(headerSection).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-11] SA שיווק — ניוזלטר: העתקת תוכן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const copyBtn = page.locator('button:has-text("העתק"), button:has-text("Copy"), button[onclick*="copyNewsletter"]').first();
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
    await copyBtn.click();
    await page.waitForTimeout(500);
  });

  test('[SMK-12] SA שיווק — ניוזלטר: שידור לכולם', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const sendAllBtn = page.locator('button:has-text("שלח לכולם"), button:has-text("שדר לכולם"), button[onclick*="sendAll"]').first();
    await expect(sendAllBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-13] SA שיווק — ניוזלטר: שידור לסגמנט', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const segmentSelect = page.locator('#newsletter-segment, select[name*="segment"], [id*="segment-select"]').first();
    await expect(segmentSelect).toBeVisible({ timeout: 5000 });
    await segmentSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  });

  test('[SMK-14] SA שיווק — ניוזלטר: הוספת שפה נוספת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const addLangBtn = page.locator('button:has-text("הוסף שפה"), button[onclick*="addLanguage"]').first();
    await expect(addLangBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-15] SA שיווק — מסרים: יצירת מסר חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const messagesTab = page.locator('button:has-text("מסרים"), a:has-text("מסרים"), [onclick*="messages"]').first();
    await expect(messagesTab).toBeVisible({ timeout: 5000 });
    await messagesTab.click();
    await page.waitForTimeout(800);
    const addMsgBtn = page.locator('button:has-text("מסר חדש"), button:has-text("+ מסר"), button[onclick*="newMessage"]').first();
    await expect(addMsgBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-16] SA שיווק — קמפיינים: תזמון קמפיין', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const campaignsTab = page.locator('button:has-text("קמפיינים"), a:has-text("קמפיינים"), [onclick*="campaigns"]').first();
    await expect(campaignsTab).toBeVisible({ timeout: 5000 });
    await campaignsTab.click();
    await page.waitForTimeout(800);
    const scheduleBtn = page.locator('button:has-text("תזמן"), button:has-text("Schedule"), button[onclick*="schedule"]').first();
    await expect(scheduleBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMK-17..20 — טמפלטים, לוג ועורך
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('טמפלטים ולוג (SMK-17..20)', () => {

  test('[SMK-17] SA שיווק — שמירת טמפלט ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const saveTemplateBtn = page.locator('button:has-text("שמור טמפלט"), button:has-text("שמור תבנית"), button[onclick*="saveTemplate"]').first();
    await expect(saveTemplateBtn).toBeVisible({ timeout: 5000 });
    await saveTemplateBtn.click();
    await page.waitForTimeout(1000);
  });

  test('[SMK-18] SA שיווק — לוג השקות ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const logTab = page.locator('button:has-text("לוג"), button:has-text("היסטוריה"), a:has-text("לוג"), [onclick*="showLog"]').first();
    await expect(logTab).toBeVisible({ timeout: 5000 });
    await logTab.click();
    await page.waitForTimeout(800);
    const logSection = page.locator('[id*="newsletter-log"], [id*="send-log"], [class*="log"]').first();
    await expect(logSection).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-19] SA שיווק — ניקוי עורך ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToMarketingTab(page);
    const clearBtn = page.locator('button:has-text("נקה"), button:has-text("אפס"), button[onclick*="clearEditor"], button[onclick*="resetNewsletter"]').first();
    await expect(clearBtn).toBeVisible({ timeout: 5000 });
    const editor = page.locator('#newsletter-content, textarea[name*="content"]').first();
    await expect(editor).toBeVisible({ timeout: 3000 });
    await editor.fill('תוכן לניקוי');
    await clearBtn.click();
    await page.waitForTimeout(500);
    await expect(editor).toHaveValue('');
  });

  test('[SMK-20] SA שיווק — גופן עברי ב-PDF', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });
});
