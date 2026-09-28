/**
 * capture-beauty-brochure-screenshots.js
 * צילום מסכים אמיתיים לחוברת השיווקית "כתב יכולות · WEFLOWZ" (עסקי יופי/קוסמטיקה).
 * כל id תואם בדיוק לעמוד המקביל בחוברת (WEFLOWZ_Brochure_Draft.pdf) —
 * כך שקל להשתיל כל תמונה במקומה הנכון בבנייה מחדש של החוברת.
 *
 * הרצה:
 *   BIZ_CODE=B16631FE BIZ_NAME=ששון BIZ_PASS=123456 node scripts/capture-beauty-brochure-screenshots.js
 *
 * דרישות (env vars, עם ברירות מחדל לעסק "המספרה של וויווי"):
 *   - BIZ_URL   : כתובת אפליקציית העסק
 *   - BIZ_CODE  : קוד עסק
 *   - BIZ_NAME  : שם משתמש מנהל
 *   - BIZ_PASS  : סיסמה
 *
 * הפלט: public/screenshots/brochure-beauty/<page-id>.png  (רזולוציה גבוהה, 1280x800, deviceScaleFactor 2)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'public', 'screenshots', 'brochure-beauty');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BIZ_URL  = process.env.BIZ_URL  || 'https://weflowz.co.il/business.html';
const BIZ_CODE = process.env.BIZ_CODE || 'B16631FE';
const BIZ_NAME = process.env.BIZ_NAME || 'ששון';
const BIZ_PASS = process.env.BIZ_PASS || '123456';

// ------------------------------------------------------------------
// כל שורה תואמת לעמוד מקביל בחוברת (המספר בהערה = מספר העמוד ב-PDF)
// ------------------------------------------------------------------
// כל id ממופה למסמך הטקסט המדויק של אותו עמוד בחוברת — לא לטאב כללי,
// אלא למצב הפעולה הספציפי שהטקסט מתאר (כרטיס פתוח, טאב פנימי, מודל וכו'),
// באותה רמת דיוק שנעשתה בעסק מהסוג מסעדה.
// ------------------------------------------------------------------
const SCREENS = [
  // עמ' 4 — "יום עבודה במערכת אחת": לוח הבקרה הראשי עם פאנל ההתראות בכניסה
  { id: 'p04-dashboard',          tab: 'feed',              label: 'לוח בקרה ראשי + פאנל התראות', afterSwitch: waitForBeautyAdminDashboard },

  // עמ' 5 — "יומן תורים": התצוגה היומית עם עמודה נפרדת לכל מטפלת
  { id: 'p05-calendar',           tab: 'beauty_calendar',   label: 'יומן תורים — תצוגה יומית' },
  // עמ' 5 — מודל קביעת תור חדש: בחירת שירות/מטפלת/משאב עם בדיקת זמינות כפולה
  { id: 'p05-new-appointment',    tab: 'beauty_calendar',   label: 'מודל קביעת תור חדש', afterSwitch: openNewAppointmentModal },

  // עמ' 6 — "כרטיס הלקוחה": כרטיס פתוח על לקוחה ספציפית, טאב "פרטים ומאזן"
  { id: 'p06-client-details',     tab: 'beauty_clients',    label: 'כרטיס לקוחה — פרטים ומאזן', afterSwitch: openFirstBeautyClient },
  // עמ' 6 — טאב "יופי" בתוך הכרטיס: פורמולות טיפול + תמונות לפני/אחרי
  { id: 'p06-client-formulas',    tab: 'beauty_clients',    label: 'כרטיס לקוחה — פורמולות ותמונות', afterSwitch: (p) => openClientCardTab(p, 'beauty') },

  // עמ' 7 — "מנויים וחבילות טיפולים": יתרת כניסות של לקוחה ספציפית, לא קטלוג המסלולים
  { id: 'p07-client-subscription', tab: 'beauty_clients',   label: 'כרטיס לקוחה — טאב מנוי', afterSwitch: (p) => openClientCardTab(p, 'sub') },
  // עמ' 7 — "קטלוג שירותים": הגדרת השירותים והתמחור (מסך ניהול, פעם אחת)
  { id: 'p07-services',           tab: 'beauty_services',   label: 'קטלוג שירותים' },

  // עמ' 8 — "צוות מטפלות ועמלות"
  { id: 'p08-practitioners',      tab: 'beauty_practitioners', label: 'צוות מטפלות' },
  { id: 'p08-commissions',        tab: 'beauty_commissions',   label: 'מסך עמלות — חישוב אוטומטי' },

  // עמ' 9 — "מלאי מקצועי": הפרדה בין back-bar למלאי קמעונאי
  { id: 'p09-inventory',          tab: 'beauty_inventory',     label: 'מלאי מקצועי + קמעונאי' },

  // עמ' 10 — "קופה וגבייה" + "פניות ותוכניות טיפול"
  { id: 'p10-pos',                tab: 'pos',                  label: 'קופה' },
  { id: 'p10-collection',         tab: 'beauty_clients',       label: 'מרכז גבייה', afterSwitch: openCollectionCenter },
  { id: 'p10-rfq',                tab: 'beauty_rfq',           label: 'פניות ותוכניות טיפול' },

  // עמ' 11 — "אתר עסק וחנות מקוונת" (עמוד ציבורי נפרד, לא טאב בממשק הניהול)
  { id: 'p11-storefront',         publicUrl: true,             label: 'אתר עסק ציבורי' },

  // עמ' 12 — "בקרה ודוחות": דווקא לוח הבקרה הראשי (KPIs + התראות בזמן אמת) — לא טאב "דוחות" הכללי
  { id: 'p12-dashboard-kpis',     tab: 'feed',                 label: 'לוח בקרה — KPIs ודוחות', afterSwitch: waitForBeautyAdminDashboard },

  // עמ' 13 — "חיבור לקהילות"
  { id: 'p13-biz-ads',            tab: 'biz-ads',              label: 'פרסום לקהילות' },
];

// ------------------------------------------------------------------

async function login(page) {
  await page.goto(BIZ_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const codeInput = page.locator('#biz-group-code, input[placeholder*="קוד"], input[name="code"]').first();
  if (await codeInput.isVisible()) {
    await codeInput.fill(BIZ_CODE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  const nameInput = page.locator('#biz-login-name, input[placeholder*="שם"]').first();
  if (await nameInput.isVisible()) await nameInput.fill(BIZ_NAME);

  const passInput = page.locator('#biz-login-pass, input[type="password"]').first();
  if (await passInput.isVisible()) await passInput.fill(BIZ_PASS);

  const loginBtn = page.locator('button:has-text("כניסה"), button:has-text("התחבר")').first();
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
    await page.waitForTimeout(2500);
  }

  await dismissOverlays(page);
}

// סוגר את אשף הברוכים-הבאים (welcome tour) ואת באנר "הוסף לדף הבית", שחוסמים את המסך בכניסה ראשונה
async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const skipBtn = page.locator('button:has-text("דלג")').first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(600);
      continue;
    }
    const installBanner = page.locator('button:has-text("הוסף לדף הבית")').first();
    if (await installBanner.isVisible().catch(() => false)) {
      const closeX = page.locator('button:has(i.fa-xmark), button:has-text("×")').first();
      if (await closeX.isVisible().catch(() => false)) { await closeX.click(); await page.waitForTimeout(400); }
      else break;
      continue;
    }
    break;
  }
  await page.waitForTimeout(500);
}

// סוגר כל מודל/overlay פתוח משלב קודם (כרטיס לקוח, תור חדש, מרכז גבייה...) —
// אחרת הוא נשאר צף מעל הטאב הבא ונתפס בטעות בצילום שלו
async function closeAnyOpenModal(page) {
  await page.evaluate(() => {
    ['beauty-client-modal', 'beauty-collection-center'].forEach(id => {
      const el = document.getElementById(id); if (el) el.remove();
    });
    document.querySelectorAll('.fixed.inset-0').forEach(el => {
      const z = parseInt(getComputedStyle(el).zIndex || '0', 10);
      if (z >= 100) el.remove();
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function switchTab(page, tabId) {
  await closeAnyOpenModal(page);
  await page.evaluate((id) => {
    if (typeof window.switchTab === 'function') window.switchTab(id);
  }, tabId).catch(() => {});
  await page.waitForTimeout(1200);
}

// פותח כרטיס לקוחה אמיתית וספציפית מתוך seed_vivi_beauty.js — לא "הראשונה ברשימה" סתם,
// כי ייתכנו רשומות ישנות/טסט שקדמו לזריעת הנתונים ומכילות שדות ריקים
const DEMO_CLIENT_NAME = process.env.DEMO_CLIENT_NAME || 'מאיה בן דוד';
async function openFirstBeautyClient(page) {
  await page.waitForTimeout(800);
  const clicked = await page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('[onclick^="window._beautyOpenClient("]'));
    const match = cards.find(c => c.textContent && c.textContent.includes(name)) || cards[0];
    if (match) { match.click(); return true; }
    return false;
  }, DEMO_CLIENT_NAME);
  if (!clicked) console.warn(`⚠️  לא נמצאה לקוחה בשם "${DEMO_CLIENT_NAME}" — ודא ש-seed_vivi_beauty.js רץ קודם`);
  await page.waitForTimeout(1200);
}

// פותח את כרטיס הלקוחה הראשונה ועובר לטאב פנימי ספציפי בתוכו (details/appts/beauty/sub/collection)
async function openClientCardTab(page, tabName) {
  await openFirstBeautyClient(page);
  await page.evaluate((t) => {
    if (typeof window._bcmTab === 'function' && window._bcmData && window._bcmData.clientId) {
      window._bcmTab(t, window._bcmData.clientId);
    }
  }, tabName).catch(() => {});
  await page.waitForTimeout(900);
}

// טאב "ראשי" למנהל/ת עסק יופי מציג את renderBeautyAdminDashboard (KPIs + התראות), לא את content-feed
// הכללי — הוא נטען אסינכרונית וקצת אחרי switchTab, אז קוראים לו במפורש וממתינים שיסתיים
async function waitForBeautyAdminDashboard(page) {
  await page.evaluate(async () => {
    const el = document.getElementById('content-role-dashboard');
    if (el && typeof window.renderBeautyAdminDashboard === 'function') {
      await window.renderBeautyAdminDashboard(el);
    }
  }).catch(() => {});
  await page.waitForTimeout(1000);
}

// פותח את מודל "קביעת תור חדש" (בחירת שירות/מטפלת/משאב) מעל היומן
async function openNewAppointmentModal(page) {
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (typeof window._beautyNewApModal === 'function') window._beautyNewApModal();
  }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function openCollectionCenter(page) {
  await page.evaluate(() => {
    if (typeof window._beautyOpenCollectionCenter === 'function') window._beautyOpenCollectionCenter();
  }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function capture(page, id, label) {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✅ ${label} → ${id}.png`);
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל צילום מסכים לחוברת השיווקית (יופי)...');
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
      : undefined,
    headless: true,
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await login(page);
  console.log('🔐 מחובר לעסק');

  // שמור את קוד הקבוצה בפועל (לעמוד האתר הציבורי) מתוך המצב הגלובלי בדף
  const groupCode = await page.evaluate(() => window.currentGroup?.group_code || null).catch(() => null);

  for (const screen of SCREENS) {
    try {
      if (screen.publicUrl) {
        const storeCode = groupCode || BIZ_CODE;
        const storePage = await ctx.newPage();
        await storePage.goto(`${new URL(BIZ_URL).origin}/storefront.html?store=${storeCode}`, { waitUntil: 'networkidle', timeout: 30000 });
        await storePage.waitForTimeout(1500);
        await storePage.screenshot({ path: path.join(OUT_DIR, `${screen.id}.png`) });
        console.log(`✅ ${screen.label} → ${screen.id}.png`);
        await storePage.close();
        continue;
      }
      await switchTab(page, screen.tab);
      await dismissOverlays(page);
      if (screen.afterSwitch) await screen.afterSwitch(page);
      await dismissOverlays(page); // חלק מהרינדורים (כמו renderBeautyAdminDashboard) יכולים להציג מחדש את אשף הברוכים-הבאים
      await capture(page, screen.id, screen.label);
    } catch (e) {
      console.warn(`⚠️  דילג על ${screen.id}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n✅ הושלם! התמונות נשמרו ב: ${OUT_DIR}`);
  console.log('שלח את התיקייה (או קבצים ספציפיים ממנה) בחזרה כדי לשלב אותם בחוברת השיווקית.');
}

main().catch(e => { console.error('❌ שגיאה:', e.message); process.exit(1); });
