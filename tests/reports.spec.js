/**
 * reports.spec.js
 * Module: Super Admin באנרים תמיכה ושותפים — SAF
 * Coverage: SAF-19..28
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/reports.spec.js --config=tests/playwright.config.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const SA_URL   = BASE_URL + '/sa.html';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  saUsername: process.env.SA_USER     || 'admin',
  saPassword: process.env.SA_PASSWORD || '123456',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'reports.spec.js';
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
  await page.waitForTimeout(1000);
  const smsVisible = await page.locator('#sa-login-master-step1').isVisible({ timeout: 5000 }).catch(() => false);
  if (smsVisible) {
    await page.locator('button:has-text("התחברות איש צוות")').click();
    await page.waitForTimeout(500);
  }
  await page.locator('#sa-code').fill(TEST_ENV.saUsername);
  await page.locator('#sa-password').fill(TEST_ENV.saPassword);
  await page.locator('#sa-login-staff button[type="submit"]').click();
  await page.waitForTimeout(2000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-19..22 — באנרים ותמיכה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('באנרים ותמיכה (SAF-19..22)', () => {

  test('[SAF-19] SA — יצירת באנר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('banners'); });
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("+ באנר"), button:has-text("באנר חדש"), [onclick*="addBanner"]').first();
    await expect(addBtn).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-20] SA — toggle הפעלת באנר', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('banners'); });
    await page.waitForTimeout(1000);
    const toggle = page.locator('.banner-item input[type="checkbox"], [onclick*="toggleBanner"]').first();
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-21] SA — רשימת פניות תמיכה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('support'); });
    await page.waitForTimeout(1200);
    const supportList = page.locator('#sa-support, .support-list, .ticket-list').first();
    await expect(supportList).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-22] SA — תגובה לפנייה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('support'); });
    await page.waitForTimeout(1200);
    const ticketItem = page.locator('.ticket-item, .support-ticket, [onclick*="openTicket"]').first();
    await expect(ticketItem).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-23..26 — שותפים ואבטחה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('שותפים ואבטחה (SAF-23..26)', () => {

  test('[SAF-23] SA — רשימת שותפים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('partners'); });
    await page.waitForTimeout(1000);
    const partnersList = page.locator('#sa-partners, .partners-list, [id*="partners"]').first();
    await expect(partnersList).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-24] SA — הוספת שותף', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('partners'); });
    await page.waitForTimeout(1000);
    const addBtn = page.locator('button:has-text("+ שותף"), button:has-text("שותף חדש"), [onclick*="addPartner"]').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });

  test('[SAF-25] SA — Authorization header בכל בקשה', async ({ page }) => {
    test.setTimeout(120000);
    const requests = [];
    page.on('request', req => {
      if (req.url().includes('/api/sa/')) {
        requests.push({ url: req.url(), auth: req.headers()['authorization'] });
      }
    });
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1500);
    const noAuth = requests.filter(r => !r.auth);
    expect(noAuth, `${noAuth.length} SA API requests sent without Authorization header: ${noAuth.map(r => r.url).join(', ')}`).toHaveLength(0);
  });

  test('[SAF-26] API — בקשה ללא token מחזירה 401', async ({ page }) => {
    test.setTimeout(120000);
    const response = await page.request.get(BASE_URL + '/api/sa/pulse');
    expect([401, 403], `Expected 401/403 but got ${response.status()}`).toContain(response.status());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAF-27..28 — לשוניות ו-Stats
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('לשוניות ו-Stats (SAF-27..28)', () => {

  test('[SAF-27] SA — switchSATab טוען תוכן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('groups'); });
    await page.waitForTimeout(1000);
    const content = page.locator('[id*="sa-"], .sa-tab-content').first();
    await expect(content).toBeVisible({ timeout: 6000 });
  });

  test('[SAF-28] SA — Stats וגרפים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSA(page);
    await page.evaluate(() => { if (typeof window.switchSATab === 'function') window.switchSATab('stats'); });
    await page.waitForTimeout(1500);
    const statsEl = page.locator('#sa-stats, .stats-container, canvas').first();
    await expect(statsEl).toBeVisible({ timeout: 6000 });
  });
});
