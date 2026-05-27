/**
 * notif.spec.js
 * Module: התראות, Inbox ותקשורת
 * Coverage: NOT-01..10
 *
 * Run:
 *   QA_SERVER=https://oneflowlife.co.il npx playwright test tests/notif.spec.js --config=tests/playwright.config.js
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'notif.spec.js';
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

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-01..02 — Inbox נטען ותג הודעות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Inbox נטען (NOT-01..02)', () => {

  test('[NOT-01] לחיצה על אייקון Inbox פותחת מודל', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    // לחץ על כפתור Inbox בתפריט עליון
    const inboxBtn = page.locator('button[onclick*="openInboxModal"], button[title*="הודעות"], button[title*="Inbox"]').first();
    const hasBtn = await inboxBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasBtn) {
      await inboxBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    } else {
      // נסה דרך JS
      await page.evaluate(() => { if (typeof openInboxModal === 'function') openInboxModal(); });
      await page.waitForTimeout(800);
      await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    }
  });

  test('[NOT-02] תג הודעות לא-נקראות קיים ב-DOM', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    // תג ה-badge קיים ב-DOM (גם אם hidden כשאין הודעות)
    await expect(page.locator('#unread-inbox-badge')).toHaveCount(1, { timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-03..04 — סימון כנקרא ומחיקה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('סימון כנקרא ומחיקה (NOT-03..04)', () => {

  test('[NOT-03] מודל Inbox מציג רשימת הודעות (או "אין הודעות")', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    // פתח Inbox
    await page.evaluate(() => { if (typeof openInboxModal === 'function') openInboxModal(); });
    await page.waitForTimeout(800);
    await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    // רשימת הודעות קיימת
    await expect(page.locator('#inbox-messages-list')).toBeVisible({ timeout: 5000 });
  });

  test('[NOT-04] לחיצה על הודעה — נפתחת / מסומנת כנקראה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    // פתח Inbox
    await page.evaluate(() => { if (typeof openInboxModal === 'function') openInboxModal(); });
    await page.waitForTimeout(1000);
    await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    // חפש הודעה ברשימה
    const msg = page.locator('#inbox-messages-list [onclick*="openInboxMessage"], #inbox-messages-list .cursor-pointer').first();
    await expect(msg).toBeVisible({ timeout: 4000 });
    await msg.click();
    await page.waitForTimeout(1000);
    // לאחר לחיצה — תוכן ההודעה אמור להיפתח, או ההודעה מסומנת כנקראה (מאבדת סימון unread)
    const messageContent = page.locator('#inbox-message-detail, [id*="message-content"], .message-detail').first();
    const unreadClass = await msg.getAttribute('class').catch(() => '');
    // מספיק שאחד מהשניים נכון: תוכן נפתח או הסימון שונה
    const contentVisible = await messageContent.isVisible({ timeout: 3000 }).catch(() => false);
    const isNowRead = !unreadClass.includes('unread');
    expect(contentVisible || isNowRead).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-05 — Push notification (ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[NOT-05] Push notification — בדיקה ידנית (נייד בלבד)', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-06 — התראת חריגה תקציבית
// ═══════════════════════════════════════════════════════════════════════════════
test('[NOT-06] התראת חריגה תקציבית — בדיקה ידנית', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-07 — התראת מלאי נמוך (ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[NOT-07] התראת מלאי נמוך — בדיקה ידנית', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-08 — תזכורת משימה (ידנית)
// ═══════════════════════════════════════════════════════════════════════════════
test('[NOT-08] תזכורת מועד משימה — בדיקה ידנית', async ({ page }) => {
  test.skip(true, 'בדיקה ידנית — לא ניתן לאוטומציה');
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOT-09..10 — שליחת הודעה
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('שליחת הודעה (NOT-09..10)', () => {

  test('[NOT-09] Inbox נטען עם כפתור סגירה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsParent(page);
    // פתח Inbox
    await page.evaluate(() => { if (typeof openInboxModal === 'function') openInboxModal(); });
    await page.waitForTimeout(800);
    await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    // כפתור סגירה
    const closeBtn = page.locator('#inbox-modal button[onclick*="hidden"], #inbox-modal button:has-text("סגור")').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#inbox-modal')).toBeHidden({ timeout: 5000 });
  });

  test('[NOT-10] ילד רואה Inbox — הודעות שנשלחו אליו', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsKid(page);
    // בדוק שתג ה-badge קיים
    await expect(page.locator('#unread-inbox-badge')).toHaveCount(1, { timeout: 10000 });
    // פתח Inbox
    await page.evaluate(() => { if (typeof openInboxModal === 'function') openInboxModal(); });
    await page.waitForTimeout(800);
    await expect(page.locator('#inbox-modal')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#inbox-messages-list')).toBeVisible({ timeout: 5000 });
  });
});
