const { chromium } = require('playwright');
const fs = require('fs');

const OUTPUT_DIR = 'guide-screenshots';
const BASE_URL = 'https://oneflowlife.co.il/business.html';

const BUSINESSES = {
  restaurant: { code: 'GA1HLF', user: 'מושיק', pass: '123456' }
  // שאר יתווספו אחרי שנוודא שמסעדה עובד
};

// --- פונקציות עזר ---

async function login(page, { code, user, pass }) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="קוד"], #group-code, #login-code', code);
  await page.fill('input[placeholder*="שם"], #username, #login-username', user);
  await page.fill('input[type="password"]', pass);
  await page.click('button:has-text("כניסה"), button[type="submit"]');
  await page.waitForTimeout(5000);

  // סגור modal מדריך קצר אם מופיע (כפתור "דלג" או X)
  for (const sel of ['button:has-text("דלג")', 'button:has-text("✕")', 'button:has-text("×")', 'button[class*="close"]', 'button[class*="skip"]']) {
    try {
      await page.click(sel, { timeout: 2000 });
      await page.waitForTimeout(1000);
      console.log(`  ℹ️ סגרתי modal (${sel})`);
      break;
    } catch {}
  }

  console.log(`  ✅ כניסה בוצעה`);
}

async function annotate(page, selector, label) {
  try {
    const locator = page.locator(selector).first();
    const el = await locator.elementHandle({ timeout: 2000 });
    if (!el) return;
    await page.evaluate(({ lbl }) => {
      // marks the first element matching the handle
    }, { lbl: label });
    await el.evaluate((node, lbl) => {
      node.style.outline = '3px solid #FF3B30';
      node.style.outlineOffset = '3px';
      node.style.borderRadius = '6px';
      const tag = document.createElement('div');
      tag.innerText = lbl;
      tag.style.cssText = `
        position: absolute;
        background: #FF3B30;
        color: white;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: bold;
        font-family: Arial, sans-serif;
        z-index: 99999;
        white-space: nowrap;
        direction: rtl;
      `;
      const rect = node.getBoundingClientRect();
      tag.style.top = (rect.top + window.scrollY - 34) + 'px';
      tag.style.left = (rect.left + window.scrollX) + 'px';
      tag.dataset.annotation = 'true';
      document.body.appendChild(tag);
      node.dataset.annotated = 'true';
    }, label);
  } catch {
    console.log(`  ⚠️ annotate לא מצא: ${selector}`);
  }
}

async function clearAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-annotated]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.removeAttribute('data-annotated');
    });
    document.querySelectorAll('[data-annotation]').forEach(el => el.remove());
  });
}

async function capture(page, filename) {
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUTPUT_DIR}/${filename}.png`,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });
  console.log(`  📸 ${filename}.png`);
}

async function scrollTo(page, y) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await page.waitForTimeout(500);
}

async function clickTab(page, ...selectors) {
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 3000 });
      await page.waitForTimeout(2000);
      return true;
    } catch {}
  }
  console.log(`  ⚠️ לא נמצא טאב: ${selectors[0]}`);
  return false;
}

// לחץ על כפתור ניווט לפי ID מדויק
async function clickNavGroup(page, groupId) {
  try {
    await page.click(`#gnav-btn-${groupId}`, { timeout: 3000 });
    await page.waitForTimeout(1200);
    return true;
  } catch {
    console.log(`  ⚠️ לא נמצאה קבוצת ניווט: gnav-btn-${groupId}`);
    return false;
  }
}

// לחץ על פריט dropdown לפי ID מדויק
async function clickNavItem(page, itemId) {
  try {
    await page.click(`#gdrop-${itemId}`, { timeout: 3000 });
    await page.waitForTimeout(2000);
    return true;
  } catch {
    console.log(`  ⚠️ לא נמצא פריט: gdrop-${itemId}`);
    return false;
  }
}

// לחץ על טייל בלוח הבקרה לפי טקסט
async function clickDashTile(page, text) {
  try {
    await page.locator(`div:has-text("${text}")`).first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    return true;
  } catch {
    console.log(`  ⚠️ לא נמצא טייל: ${text}`);
    return false;
  }
}

// --- מסעדה ---

async function captureRestaurant(page) {
  console.log('\n🍕 מצלם מסעדה...');
  await login(page, BUSINESSES.restaurant);

  // לוח בקרה עליון
  await scrollTo(page, 0);
  await capture(page, 'restaurant-01-dashboard-top');

  // הדגש יתרה נוכחית
  await annotate(page, '[class*="revenue"], [class*="balance"], .text-green-400', 'יתרה נוכחית');
  await capture(page, 'restaurant-02-dashboard-balance');
  await clearAnnotations(page);

  // הדגש Quick Tiles — הטיילים על לוח הבקרה
  await annotate(page, 'div:has-text("KDS")', 'קיצורי דרך מהירים');
  await capture(page, 'restaurant-03-dashboard-tiles');
  await clearAnnotations(page);

  // גלול ל-KPIs
  await scrollTo(page, 400);
  await capture(page, 'restaurant-04-kpis');

  // הדגש מכירות היום
  await annotate(page, 'div:has-text("מכירות היום")', 'מכירות היום');
  await capture(page, 'restaurant-05-kpi-sales');
  await clearAnnotations(page);

  // הדגש עובדים פעילים
  await annotate(page, 'div:has-text("עובדים פעילים")', 'עובדים פעילים');
  await capture(page, 'restaurant-06-kpi-workers');
  await clearAnnotations(page);

  // הדגש Food Cost
  await annotate(page, 'div:has-text("Food Cost")', 'Food Cost %');
  await capture(page, 'restaurant-07-kpi-foodcost');
  await clearAnnotations(page);

  // חזור למעלה — קופה POS (מכירות → קופה)
  await scrollTo(page, 0);
  await clickNavGroup(page, 'sales');
  await clickNavItem(page, 'pos');
  await capture(page, 'restaurant-08-pos');

  // הדגש מוצר בקופה
  await annotate(page, '[class*="item"], [class*="product"], [class*="menu-item"]', 'לחץ למוצר');
  await capture(page, 'restaurant-09-pos-product');
  await clearAnnotations(page);

  // KDS — פונקציה אמיתית מהטייל
  await page.evaluate(() => window.openAdminKDSPanel && window.openAdminKDSPanel());
  await page.waitForTimeout(2000);
  await capture(page, 'restaurant-10-kds');
  // סגור overlay — כפתור חזרה
  try { await page.click('button:has-text("חזרה")', { timeout: 2000 }); await page.waitForTimeout(800); } catch {}

  // שולחנות — פונקציה אמיתית מהטייל
  await page.evaluate(() => window.openAdminTablesPanel && window.openAdminTablesPanel());
  await page.waitForTimeout(2000);
  await capture(page, 'restaurant-11-tables');
  // סגור overlay — כפתור חזרה
  try { await page.click('button:has-text("חזרה")', { timeout: 2000 }); await page.waitForTimeout(800); } catch {}

  // קטלוג — sales → switchSalesTab catalog
  await page.evaluate(() => {
    window.switchTab && window.switchTab('sales');
    setTimeout(() => { window.switchSalesTab && window.switchSalesTab('catalog'); }, 200);
  });
  await page.waitForTimeout(2500);
  await capture(page, 'restaurant-12-catalog');

  // הדגש כפתור הוסף מנה
  await annotate(page, 'button:has-text("מנה"), button:has-text("הוסף"), button:has-text("חדש")', 'הוסף מנה חדשה');
  await capture(page, 'restaurant-13-catalog-add');
  await clearAnnotations(page);

  // מלאי מחסן
  await page.evaluate(() => window.switchTab && window.switchTab('pantry'));
  await page.waitForTimeout(2000);
  await capture(page, 'restaurant-14-inventory');

  // צוות — ניהול צוות
  await page.evaluate(() => window.switchTab && window.switchTab('members'));
  await page.waitForTimeout(2000);
  await capture(page, 'restaurant-15-team');

  // כספים / תזרים
  await page.evaluate(() => window.switchTab && window.switchTab('cashflow'));
  await page.waitForTimeout(2000);
  await capture(page, 'restaurant-16-cashflow');

  console.log('  ✅ מסעדה — סיום');
}

// --- הרצה ראשית ---

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await captureRestaurant(page);
    console.log('\n✅ כל הצילומים נשמרו ב-guide-screenshots/');
  } catch (err) {
    console.error('\n❌ שגיאה:', err.message);
    await page.screenshot({ path: `${OUTPUT_DIR}/error.png` });
  }

  await browser.close();
})();
