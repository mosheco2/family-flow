/**
 * biz-permissions.spec.js
 * Module: הרשאות תפקידים — עסקים
 * Coverage: PBIZ-01..35
 *
 * Run:
 *   npx playwright test tests/biz-permissions.spec.js --reporter=html
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';
const QA_SERVER = process.env.QA_SERVER || 'http://localhost:3000';

const TEST_ENV = {
  groupCode:    process.env.BIZ_GROUP_CODE    || 'J7RH0Y',
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
  const specFile = testInfo.file ? testInfo.file.split(/[\\/]/).pop() : 'biz-permissions.spec.js';
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

async function goToTab(page, tabName) {
  await page.evaluate((t) => { if (typeof window.switchTab === 'function') window.switchTab(t); }, tabName);
  await page.waitForTimeout(800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PBIZ-01..10 — הרשאות ADMIN (מנהל ראשי)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הרשאות ADMIN (PBIZ-01..10)', () => {

  test('[PBIZ-01] ADMIN — גישה לכל הלשוניות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    const tabs = ['feed', 'timeclock', 'bank', 'members', 'tasks'];
    for (const tab of tabs) {
      await goToTab(page, tab);
      await expect(page.locator(`#content-${tab}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test('[PBIZ-02] ADMIN — ניהול עובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1000);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-03] ADMIN — עריכת הרשאות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1000);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('button[onclick*="openPermissionsModal"], button:has-text("הרשאות")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-04] ADMIN — גישה לנתוני כספים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1000);
    const adminView = page.locator('#bank-admin-view, #content-bank');
    await expect(adminView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-05] ADMIN — יצירת משימות לעובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-tasks')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('#btn-add-task, button:has-text("הוסף משימה"), button:has-text("משימה חדשה")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-06] ADMIN — גישה לדוחות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'timeclock');
    await page.waitForTimeout(1000);
    const adminView = page.locator('#timeclock-admin-view, #content-timeclock');
    await expect(adminView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-07] ADMIN — גישה לקופה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-08] ADMIN — ניהול מלאי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'pantry');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-pantry')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-09] ADMIN — ניהול לקוחות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'customers');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-customers')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-10] ADMIN — הגדרות עסק', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await page.evaluate(() => { if (typeof window.openProfileModal === 'function') window.openProfileModal(); });
    await page.waitForTimeout(600);
    await expect(page.locator('#profile-modal')).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PBIZ-11..18 — הרשאות MANAGER (מנהל)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הרשאות MANAGER (PBIZ-11..18)', () => {

  test('[PBIZ-11] MANAGER — גישה לנוכחות עובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'timeclock');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-timeclock')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-12] MANAGER — אישור משימות עובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    const adminView = page.locator('#tasks-admin-view, #content-tasks');
    await expect(adminView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-13] MANAGER — גישה ליומן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'calendar');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-calendar')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-14] MANAGER — גישה למכירות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'sales');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-sales')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-15] MANAGER — גישה לרכש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'shop');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-shop')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-16] MANAGER — גישה לאקדמיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-academy')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-17] MANAGER — הגדרות שירות ביומן', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'calendar');
    await page.waitForTimeout(1200);
    await expect(page.locator('#content-calendar')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('#cal-view-settings, button:has-text("הגדרות שירות")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-18] MANAGER — הפקת דוחות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await expect(
      page.locator('button:has-text("דוח"), button:has-text("הפק"), #btn-report').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PBIZ-19..23 — הרשאות SENIOR (עובד בכיר)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הרשאות SENIOR (PBIZ-19..23)', () => {

  test('[PBIZ-19] SENIOR — גישה לקופה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pos');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-pos')).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-20] SENIOR — גישה לשליחויות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'deliveries');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-deliveries')).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-21] SENIOR — גישה למלאי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'pantry');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-pantry')).toBeVisible({ timeout: 5000 });
  });

  test('[PBIZ-22] SENIOR — גישה לאקדמיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1000);
    const userView = page.locator('#academy-user-view, #content-academy');
    await expect(userView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-23] SENIOR — ממשק ניהול לא זמין', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#tasks-admin-view').first()).not.toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PBIZ-24..30 — הרשאות MEMBER (עובד רגיל)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('הרשאות MEMBER (PBIZ-24..30)', () => {

  test('[PBIZ-24] MEMBER — גישה לנוכחות עצמית', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'timeclock');
    await page.waitForTimeout(1000);
    const userView = page.locator('#timeclock-user-view, #content-timeclock');
    await expect(userView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-25] MEMBER — גישה למשימות עצמיות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'tasks');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-tasks')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-26] MEMBER — גישה לאקדמיה', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'academy');
    await page.waitForTimeout(1000);
    const userView = page.locator('#academy-user-view, #content-academy');
    await expect(userView).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-27] MEMBER — גישה לקהילות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'community');
    await page.waitForTimeout(1000);
    await expect(page.locator('#content-community')).toBeVisible({ timeout: 8000 });
  });

  test('[PBIZ-28] MEMBER — אין גישה לנתוני כספים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'bank');
    await page.waitForTimeout(1000);
    await expect(page.locator('#bank-admin-view').first()).not.toBeVisible({ timeout: 3000 });
  });

  test('[PBIZ-29] MEMBER — אין גישה לניהול עובדים', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1000);
    await expect(
      page.locator('#btn-invite-member, button:has-text("הוסף עובד"), button:has-text("הזמן עובד")').first()
    ).not.toBeVisible({ timeout: 3000 });
  });

  test('[PBIZ-30] MEMBER — גישה לפרופיל אישי', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsEmployee(page);
    await page.evaluate(() => { if (typeof window.openProfileModal === 'function') window.openProfileModal(); });
    await page.waitForTimeout(600);
    await expect(page.locator('#profile-modal')).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PBIZ-31..35 — ניהול הרשאות
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('ניהול הרשאות (PBIZ-31..35)', () => {

  test('[PBIZ-31] ניהול — פתיחת מודל הרשאות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1500);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    const permBtn = page.locator('button[onclick*="openPermissionsModal"], button:has-text("הרשאות")').first();
    await expect(permBtn).toBeVisible({ timeout: 5000 });
    await permBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#permissions-modal')).toBeVisible({ timeout: 6000 });
  });

  test('[PBIZ-32] ניהול — שינוי תפקיד עובד', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1500);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    const permBtn = page.locator('button[onclick*="openPermissionsModal"], button:has-text("הרשאות")').first();
    await expect(permBtn).toBeVisible({ timeout: 5000 });
    await permBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#permissions-modal')).toBeVisible({ timeout: 6000 });
    await expect(
      page.locator('#permissions-modal select, #permissions-modal [id*="role"]').first()
    ).toBeVisible({ timeout: 4000 });
  });

  test('[PBIZ-33] ניהול — הרשאות לשוניות ספציפיות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1500);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    const permBtn = page.locator('button[onclick*="openPermissionsModal"], button:has-text("הרשאות")').first();
    await expect(permBtn).toBeVisible({ timeout: 5000 });
    await permBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#permissions-modal')).toBeVisible({ timeout: 6000 });
    const checkboxes = page.locator('#permissions-modal input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 4000 });
    expect(await checkboxes.count()).toBeGreaterThan(0);
  });

  test('[PBIZ-34] ניהול — שמירת שינויי הרשאות', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1500);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    const permBtn = page.locator('button[onclick*="openPermissionsModal"], button:has-text("הרשאות")').first();
    await expect(permBtn).toBeVisible({ timeout: 5000 });
    await permBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('#permissions-modal')).toBeVisible({ timeout: 6000 });
    await expect(
      page.locator('#permissions-modal button:has-text("שמור"), #permissions-modal button:has-text("אשר")').first()
    ).toBeVisible({ timeout: 4000 });
  });

  test('[PBIZ-35] ניהול — תפקיד ברירת מחדל לעובד חדש', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsManager(page);
    await goToTab(page, 'members');
    await page.waitForTimeout(1000);
    await expect(page.locator('#members-list, #content-members')).toBeVisible({ timeout: 8000 });
    const addBtn = page.locator('button:has-text("הזמן"), button:has-text("הוסף עובד")').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.waitForTimeout(600);
    await expect(
      page.locator('[id*="role"], select[name*="role"]').first()
    ).toBeVisible({ timeout: 4000 });
  });
});
