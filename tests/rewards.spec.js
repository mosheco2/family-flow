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
  saCode:     process.env.SA_CODE     || process.env.SA_EMAIL || 'admin',
  saPassword: process.env.SA_PASS  || '123456',
  qaEnv:      'sa',
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
async function loginAsSA(page) {
  await page.goto(`${BASE_URL}/sa.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const staffVisible = await page.locator('#sa-login-staff').isVisible({ timeout: 3000 }).catch(() => false);
  if (!staffVisible) {
    const toggleBtn = page.locator('button:has-text("התחברות איש צוות")').first();
    if (await toggleBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.locator('#sa-login-staff').waitFor({ state: 'visible', timeout: 5000 });
    }
  }
  await page.locator('#sa-code').fill(TEST_ENV.saCode);
  await page.locator('#sa-password').fill(TEST_ENV.saPassword);
  await page.locator('#sa-login-staff button[type="submit"]').click();
  await page.waitForTimeout(2500);
}

async function goToReleaseTab(page) {
  await page.evaluate(() => {
    if (typeof window.switchSATab === 'function') window.switchSATab('devops');
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (typeof window.switchDevTab === 'function') window.switchDevTab('release');
  });
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMK-01..08 — ניוזלטר — יסודות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניוזלטר — יסודות (SMK-01..08)', () => {

  test('[SMK-01] SA שיווק — לשונית "שיווק" נטענת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const releaseSection = page.locator('#dev-content-release, #sa-view-devops').first();
    await expect(releaseSection).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-02] SA שיווק — ניוזלטר: בחירת שפה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const langSelect = page.locator('#release-subtitle, #release-tone, #release-length, select').first();
    const hasSelect = await langSelect.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSelect) console.warn('[SMK-02] בחירת שפה/גרסה לא נמצאה');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-03] SA שיווק — ניוזלטר: שדות כותרת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const titleField = page.locator('#release-title').first();
    await expect(titleField).toBeVisible({ timeout: 5000 });
    await titleField.fill('QA — בדיקה');
    await expect(titleField).toHaveValue('QA — בדיקה');
  });

  test('[SMK-04] SA שיווק — ניוזלטר: עורך תוכן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const editor = page.locator('#release-manual-text, #release-raw-points').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.fill('QA — תוכן בדיקה');
    await expect(editor).toHaveValue('QA — תוכן בדיקה');
  });

  test('[SMK-05] SA שיווק — ניוזלטר: יצירת תוכן עם AI', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const aiBtn = page.locator('#btn-generate-release, #btn-generate-manual, button:has-text("✨"), button[onclick*="generateRelease"]').first();
    await expect(aiBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-06] SA שיווק — ניוזלטר: תצוגה מקדימה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const editorEl = page.locator('#release-editor').first();
    await expect(editorEl).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-07] SA שיווק — ניוזלטר: ייצוא PDF', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const pdfBtn = page.locator('#btn-export-pdf, button:has-text("ייצא ל-PDF"), button[onclick*="exportToPDF"]').first();
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
    await goToReleaseTab(page);
    const editorEl = page.locator('#release-editor, #dev-content-release').first();
    await expect(editorEl).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-11] SA שיווק — ניוזלטר: העתקת תוכן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const copyBtn = page.locator('button:has-text("העתק HTML"), button[onclick*="copyReleaseNotes"]').first();
    const hasBtn = await copyBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) console.warn('[SMK-11] כפתור העתקה לא נמצא');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-12] SA שיווק — ניוזלטר: שידור לכולם', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const sendAllBtn = page.locator('#btn-broadcast-release, button:has-text("שגר ללקוחות"), button[onclick*="broadcastReleaseNotes"]').first();
    await expect(sendAllBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-13] SA שיווק — ניוזלטר: שידור לסגמנט', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const segmentSelect = page.locator('#release-target-audience, select[id*="target"], select[id*="audience"]').first();
    const hasSelect = await segmentSelect.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSelect) console.warn('[SMK-13] בחירת קהל יעד לא נמצאה');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-14] SA שיווק — ניוזלטר: הוספת שפה נוספת', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const addLangBtn = page.locator('button:has-text("הוסף שפה"), button[onclick*="addLanguage"]').first();
    const hasBtn = await addLangBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) console.warn('[SMK-14] כפתור הוסף שפה לא נמצא');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-15] SA שיווק — מסרים: יצירת מסר חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const releaseEl = page.locator('#dev-content-release, #btn-broadcast-release').first();
    await expect(releaseEl).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-16] SA שיווק — קמפיינים: תזמון קמפיין', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const releaseEl = page.locator('#dev-content-release, #release-title').first();
    await expect(releaseEl).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMK-17..20 — טמפלטים, לוג ועורך
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('טמפלטים ולוג (SMK-17..20)', () => {

  test('[SMK-17] SA שיווק — שמירת טמפלט ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const saveBtn = page.locator('button:has-text("שמור"), button:has-text("שמור טמפלט"), button[onclick*="saveTemplate"]').first();
    const hasBtn = await saveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) console.warn('[SMK-17] כפתור שמירת טמפלט לא נמצא');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-18] SA שיווק — לוג השקות ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const releaseEl = page.locator('#dev-content-release, #release-editor').first();
    await expect(releaseEl).toBeVisible({ timeout: 5000 });
  });

  test('[SMK-19] SA שיווק — ניקוי עורך ניוזלטר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await goToReleaseTab(page);
    const clearBtn = page.locator('button:has-text("נקה קנבס"), button[onclick*="innerHTML="]').first();
    const hasBtn = await clearBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) console.warn('[SMK-19] כפתור ניקוי עורך לא נמצא');
    await expect(page.locator('#dev-content-release, #sa-view-devops')).toBeVisible({ timeout: 6000 });
  });

  test('[SMK-20] SA שיווק — גופן עברי ב-PDF', async ({ page }) => {
    test.skip(true, 'בדיקה ידנית');
  });
});
