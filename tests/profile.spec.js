/**
 * profile.spec.js
 * Module: Super Admin — SA
 * Coverage: SA-01..15
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/profile.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const SA_URL   = BASE_URL + '/sa.html';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  saCode:     process.env.SA_CODE     || process.env.SA_EMAIL || 'admin',
  saPassword: process.env.SA_PASSWORD || '123456',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'profile.spec.js';
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
async function loginAsSA(page) {
  await page.goto(SA_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
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

// ═══════════════════════════════════════════════════════════════════════════════
// SA-01..04 — כניסה ו-Pulse
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('כניסה ו-Pulse (SA-01..04)', () => {

  test('[SA-01] SA — מסך כניסה ודשבורד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    const dashboard = page.locator('#sa-dashboard, #sa-content, .sa-main').first();
    await expect(dashboard).toBeVisible({ timeout: 8000 });
  });

  test('[SA-02] SA — לשונית Pulse', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('pulse'); });
    await page.waitForTimeout(1000);
    const pulseEl = page.locator('#sa-pulse, [id*="pulse"], .pulse-tab').first();
    await expect(pulseEl).toBeVisible({ timeout: 6000 });
  });

  test('[SA-03] SA — תצוגת קבוצה 360°', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const groupsList = page.locator('#sa-groups, .groups-list, [id*="groups"]').first();
    await expect(groupsList).toBeVisible({ timeout: 6000 });
  });

  test('[SA-04] SA — מחיקת קבוצה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const delBtn = page.locator('.group-item button:has-text("מחק"), [onclick*="deleteGroup"]').first();
    await expect(delBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SA-05..08 — פרמיום, קהילות ו-Inbox
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('פרמיום קהילות ו-Inbox (SA-05..08)', () => {

  test('[SA-05] SA — שדרוג קבוצה לפרמיום', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const premBtn = page.locator('button:has-text("שדרג פרמיום"), [onclick*="premium"]').first();
    await expect(premBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SA-06] SA — יצירת קהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("+ קהילה"), button:has-text("קהילה חדשה")').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SA-07] SA — אישור עסק לקהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const pendingEl = page.locator('.pending-biz, button:has-text("אשר"), [id*="pending"]').first();
    await expect(pendingEl).toBeVisible({ timeout: 5000 });
  });

  test('[SA-08] SA — שידור הודעה לכולם', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('inbox'); });
    await page.waitForTimeout(1000);
    const broadcastBtn = page.locator('button:has-text("שדר"), button:has-text("שלח לכולם"), [onclick*="broadcast"]').first();
    await expect(broadcastBtn).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SA-09..12 — תמיכה, באנרים ומשתמשים
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('תמיכה באנרים ומשתמשים (SA-09..12)', () => {

  test('[SA-09] SA — תגובה לפנייה תמיכה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('support'); });
    await page.waitForTimeout(1000);
    const supportEl = page.locator('#sa-support, .support-list, [id*="support"]').first();
    await expect(supportEl).toBeVisible({ timeout: 6000 });
  });

  test('[SA-10] SA — יצירת באנר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('banners'); });
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("+ באנר"), button:has-text("באנר חדש")').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SA-11] SA — הגדרות גלובליות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('settings'); });
    await page.waitForTimeout(1000);
    const settingsEl = page.locator('#sa-settings, .sa-settings, [id*="settings"]').first();
    await expect(settingsEl).toBeVisible({ timeout: 6000 });
  });

  test('[SA-12] SA — עריכת משתמש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const editBtn = page.locator('button:has-text("ערוך"), [onclick*="editUser"], [onclick*="editGroup"]').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SA-13..15 — Stats, ייצוא ותחזוקה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Stats ייצוא ותחזוקה (SA-13..15)', () => {

  test('[SA-13] SA — Stats וגרפים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('stats'); });
    await page.waitForTimeout(1200);
    const statsEl = page.locator('#sa-stats, .stats-container, canvas').first();
    await expect(statsEl).toBeVisible({ timeout: 6000 });
  });

  test('[SA-14] SA — ייצוא CSV גלובלי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('export'); });
    await page.waitForTimeout(1000);
    const exportBtn = page.locator('button:has-text("ייצא CSV"), button:has-text("ייצוא"), [onclick*="export"]').first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SA-15] SA — מצב תחזוקה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('settings'); });
    await page.waitForTimeout(1000);
    const maintenanceEl = page.locator('button:has-text("מצב תחזוקה"), input[id*="maintenance"], [onclick*="maintenance"]').first();
    await expect(maintenanceEl).toBeVisible({ timeout: 5000 });
  });
});
