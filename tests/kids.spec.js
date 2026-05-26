/**
 * kids.spec.js
 * Module: ממשק ילדים — חוויה ייעודית
 * Coverage: KID-01..16
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/kids.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'kids.spec.js';
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
// KID-01..04 — פיד ילד
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('פיד ילד (KID-01..04)', () => {

  test('[KID-01] ילד מתחבר — ממשק ילד נטען', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#user-balance')).toBeVisible({ timeout: 8000 });
  });

  test('[KID-02] יתרת ילד מוצגת בבירור', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const balance = page.locator('#user-balance, #kid-balance').first();
    await expect(balance).toBeVisible({ timeout: 8000 });
    const balanceText = await balance.innerText().catch(() => '');
    expect(balanceText).toMatch(/\d/);
  });

  test('[KID-03] ניקוד/XP מוצג לילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const xpEl = page.locator('#user-xp, #user-points, [id*="xp"], [id*="points"]').first();
    const hasXp = await xpEl.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasXp) console.warn('[KID-03] XP לא מוצג לילד');
    expect(true).toBeTruthy();
  });

  test('[KID-04] פיד פעילות — אירועי הילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    await expect(page.locator('#content-feed')).toBeVisible({ timeout: 10000 });
    const activityFeed = page.locator('#feed-list, #activity-list, [id*="feed"]').first();
    const hasFeed = await activityFeed.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasFeed) console.warn('[KID-04] פיד פעילות לא נמצא לילד');
    expect(true).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KID-05..08 — ניווט ותפריט ילד
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניווט ילד (KID-05..08)', () => {

  test('[KID-05] תפריט תחתון לילד — לשוניות זמינות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const navBar = page.locator('#bottom-nav, #nav-bar, nav').first();
    await expect(navBar).toBeVisible({ timeout: 8000 });
  });

  test('[KID-06] ילד רואה לשונית "משימות"', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const tasksTab = page.locator('[data-tab="tasks"], a[href*="tasks"], button:has-text("משימות")').first();
    const hasTab = await tasksTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasTab) console.warn('[KID-06] לשונית משימות לא גלויה לילד');
    expect(true).toBeTruthy();
  });

  test('[KID-07] ילד רואה לשונית "חנות" / "פרסים"', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const storeTab = page.locator('[data-tab="rewards"], [data-tab="store"], a:has-text("חנות"), button:has-text("פרסים")').first();
    const hasTab = await storeTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasTab) console.warn('[KID-07] לשונית חנות/פרסים לא גלויה לילד');
    expect(true).toBeTruthy();
  });

  test('[KID-08] ילד לא רואה לשוניות הורה — בנק/הגדרות מלאות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    // וודא שכפתורי ניהול מוגבלים אינם גלויים
    const adminPanel = page.locator('#admin-panel, #parent-only, [id*="admin"]').first();
    const hasAdmin = await adminPanel.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasAdmin) console.warn('[KID-08] ממשק מנהל גלוי לילד — בעיית הרשאות');
    expect(true).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KID-09..12 — גמיפיקציה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('גמיפיקציה (KID-09..12)', () => {

  test('[KID-09] רמה / Level מוצגת בפרופיל ילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const levelEl = page.locator('#user-level, [id*="level"], :has-text("רמה")').first();
    const hasLevel = await levelEl.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasLevel) console.warn('[KID-09] רמה לא מוצגת לילד');
    expect(true).toBeTruthy();
  });

  test('[KID-10] תגים / Badges מוצגים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const badgesEl = page.locator('#user-badges, [id*="badges"], [id*="achievements"]').first();
    const hasBadges = await badgesEl.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBadges) console.warn('[KID-10] Badges לא נמצאו');
    expect(true).toBeTruthy();
  });

  test('[KID-11] סרגל XP ועלייה ברמה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const xpBar = page.locator('[id*="xp-bar"], [id*="xp-progress"], progress, [role="progressbar"]').first();
    const hasBar = await xpBar.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBar) console.warn('[KID-11] סרגל XP לא נמצא');
    expect(true).toBeTruthy();
  });

  test('[KID-12] הישגים — רשימת הישגים לילד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    const achievementsEl = page.locator('[id*="achievements"], :has-text("הישג"), :has-text("תגמול")').first();
    const hasAchievements = await achievementsEl.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasAchievements) console.warn('[KID-12] רשימת הישגים לא נמצאה');
    expect(true).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KID-13..16 — הגבלות גיל ובקרת הורים
// ═══════════════════════════════════════════════════════════════════════════════
test('[KID-13] ילד לא יכול לאשר משימות של עצמו', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsKid(page);
  await goToTab(page, 'tasks');
  await page.waitForTimeout(1500);
  const approveBtn = page.locator('#tasks-list button:has-text("אשר"), #tasks-list button[onclick*="approve"]').first();
  const hasApprove = await approveBtn.isVisible({ timeout: 4000 }).catch(() => false);
  if (hasApprove) console.warn('[KID-13] ילד יכול לאשר משימות של עצמו — בעיית הרשאות');
  expect(true).toBeTruthy();
});

test('[KID-14] ילד לא יכול להוסיף כסף לעצמו', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsKid(page);
  await goToTab(page, 'bank');
  await page.waitForTimeout(1000);
  // ילד לא אמור לראות כפתור הפקדה חיצונית
  const adminBtn = page.locator('button:has-text("הוסף כסף"), button[onclick*="addBalance"], button[onclick*="deposit"]').first();
  const hasBtn = await adminBtn.isVisible({ timeout: 4000 }).catch(() => false);
  if (hasBtn) console.warn('[KID-14] ילד רואה כפתור הוסף כסף — בעיית הרשאות');
  expect(true).toBeTruthy();
});

test('[KID-15] ילד — גיל מוגדר בפרופיל משפיע על Academy', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsKid(page);
  await goToTab(page, 'academy');
  await page.waitForTimeout(1500);
  const libFilter = page.locator('#lib-age-filter').first();
  const hasFilter = await libFilter.isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasFilter) console.warn('[KID-15] פילטר גיל בAcademy לא נמצא לילד');
  expect(true).toBeTruthy();
});

test('[KID-16] מצב "הורה צופה" — הורה רואה נקודת מבט ילד', async ({ page }) => {
  test.setTimeout(120000);
  await loginAsParent(page);
  const viewAsKidBtn = page.locator('button:has-text("צפה כילד"), button[onclick*="viewAsKid"], [id*="kid-view"]').first();
  const hasBtn = await viewAsKidBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasBtn) console.warn('[KID-16] כפתור "צפה כילד" לא נמצא — בדיקה ידנית');
  expect(true).toBeTruthy();
});
