/**
 * admin.spec.js
 * Module: Super Admin קבוצות וקהילות — SAF
 * Coverage: SAF-01..18
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/admin.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const SA_URL   = BASE_URL + '/sa.html';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  saEmail:    process.env.SA_EMAIL    || 'mosheco2@gmail.com',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'admin.spec.js';
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
  // If staff form is not yet visible, click the toggle
  const staffVisible = await page.locator('#sa-login-staff').isVisible({ timeout: 3000 }).catch(() => false);
  if (!staffVisible) {
    const toggleBtn = page.locator('button:has-text("התחברות איש צוות")').first();
    if (await toggleBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.locator('#sa-login-staff').waitFor({ state: 'visible', timeout: 5000 });
    }
  }
  await page.locator('#sa-code').fill(TEST_ENV.saEmail);
  await page.locator('#sa-password').fill(TEST_ENV.saPassword);
  await page.locator('#sa-login-staff button[type="submit"]').click();
  await page.waitForTimeout(2500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-01..06 — כניסה ו-Pulse
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('כניסה ו-Pulse (SAF-01..06)', () => {

  test('[SAF-01] SA — כניסה עם token', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    const dashboard = page.locator('#sa-dashboard, #sa-content, .sa-main').first();
    await expect(dashboard).toBeVisible({ timeout: 8000 });
  });

  test('[SAF-02] SA — טעינה עם token שמור', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.goto(SA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const dashboard = page.locator('#sa-dashboard, #sa-content, .sa-main').first();
    await expect(dashboard).toBeVisible({ timeout: 8000 });
  });

  test('[SAF-03] SA — התנתקות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    const logoutBtn = page.locator('button:has-text("התנתק"), [onclick*="logout"]').first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await page.waitForTimeout(1000);
    // After logout the login form must reappear
    const loginForm = page.locator('#sa-password, input[type="password"]').first();
    await expect(loginForm).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-04] SA — כניסה עם קוד שגוי', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(SA_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    const passInput = page.locator('#sa-password, input[type="password"]').first();
    await expect(passInput).toBeVisible({ timeout: 8000 });
    await passInput.fill('wrongpassword123');
    await page.locator('button:has-text("כנס"), button[type="submit"]').first().click();
    await page.waitForTimeout(1500);
    const errorEl = page.locator('#toast-message, .error-msg, :has-text("שגיאה")').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-05] SA — Pulse — KPIs', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('pulse'); });
    await page.waitForTimeout(1200);
    const kpiEl = page.locator('.kpi-card, [id*="kpi"], [class*="stats"]').first();
    await expect(kpiEl).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-06] SA — Pulse — familyUsers + businessUsers', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('pulse'); });
    await page.waitForTimeout(1200);
    const userCount = page.locator('[id*="family-users"], [id*="total-users"], .user-count').first();
    await expect(userCount).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-07..12 — קבוצות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול קבוצות (SAF-07..12)', () => {

  test('[SAF-07] SA — Pulse — פעילות חיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('pulse'); });
    await page.waitForTimeout(1200);
    const activityEl = page.locator('.activity-stream, .live-activity, [id*="activity"]').first();
    await expect(activityEl).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-08] SA — חיפוש קבוצות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input[placeholder*="חיפוש"], #groups-search, input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-09] SA — תצוגת קבוצה 360°', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const groupItem = page.locator('.group-item, .group-row, [onclick*="viewGroup"]').first();
    await expect(groupItem).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-10] SA — מחיקת קבוצה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const delBtn = page.locator('.group-item button:has-text("מחק"), [onclick*="deleteGroup"]').first();
    await expect(delBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-11] SA — toggle פרמיום', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const premToggle = page.locator('.group-item input[type="checkbox"], [onclick*="togglePremium"]').first();
    await expect(premToggle).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-12] SA — עריכת מנהל קבוצה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const editBtn = page.locator('button:has-text("ערוך מנהל"), [onclick*="editAdmin"]').first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-13..18 — קהילות ו-Inbox
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('קהילות ו-Inbox (SAF-13..18)', () => {

  test('[SAF-13] SA — יצירת קהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("+ קהילה"), button:has-text("קהילה חדשה")').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-14] SA — אישור עסק לקהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const approveBtn = page.locator('button:has-text("אשר"), [onclick*="approveBiz"]').first();
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-15] SA — דחיית עסק מקהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const rejectBtn = page.locator('button:has-text("דחה"), [onclick*="rejectBiz"]').first();
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-16] SA — חיפוש ועריכת קהילה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('communities'); });
    await page.waitForTimeout(1000);
    const commList = page.locator('#sa-communities, .communities-list, [id*="communities"]').first();
    await expect(commList).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-17] SA — שידור לכל הקבוצות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('inbox'); });
    await page.waitForTimeout(1000);
    const broadcastBtn = page.locator('button:has-text("שדר לכולם"), button:has-text("שדר לכל הקבוצות"), [onclick*="broadcastAll"]').first();
    await expect(broadcastBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-18] SA — שידור לקבוצה ספציפית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('inbox'); });
    await page.waitForTimeout(1000);
    const targetBtn = page.locator('button:has-text("שדר לקבוצה"), [onclick*="broadcastGroup"]').first();
    await expect(targetBtn).toBeVisible({ timeout: 5000 });
  });
});
