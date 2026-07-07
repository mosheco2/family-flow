/**
 * capture-guide-screenshots.js
 * צילום מסכים אוטומטי לצורך מדריך הקמת עסקים
 *
 * הרצה:
 *   node scripts/capture-guide-screenshots.js
 *
 * דרישות:
 *   - BIZ_URL      : URL לאפליקציית העסק  (ברירת מחדל: https://oneflowlife.co.il/business.html)
 *   - BIZ_CODE     : קוד עסק (env var BIZ_CODE)
 *   - BIZ_NAME     : שם מנהל (env var BIZ_NAME)
 *   - BIZ_PASS     : סיסמת מנהל (env var BIZ_PASS)
 *
 * הפלט: public/screenshots/guide/<name>.png
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'public', 'screenshots', 'guide');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BIZ_URL  = process.env.BIZ_URL  || 'https://oneflowlife.co.il/business.html';
const BIZ_CODE = process.env.BIZ_CODE || 'GA1HLF';
const BIZ_NAME = process.env.BIZ_NAME || 'מושיק';
const BIZ_PASS = process.env.BIZ_PASS || '123456';

// ------------------------------------------------------------------
// רשימת המסכים לצילום: { id, tab, subTab?, label, waitFor? }
// ------------------------------------------------------------------
const SCREENS = [
  // ─── כניסה ─────────────────────────────────────────────────────
  { id: 'login',           tab: null,                label: 'מסך כניסה'                  },

  // ─── כלל סוגי העסקים (מסכים משותפים) ─────────────────────────
  { id: 'dashboard',       tab: 'feed',              label: 'לוח בקרה ראשי'              },
  { id: 'calendar',        tab: 'calendar',          label: 'יומן פגישות'                },
  { id: 'customers',       tab: 'customers',         label: 'ניהול לקוחות'               },
  { id: 'pos',             tab: 'pos',               label: 'קופה / מכירות'              },
  { id: 'cashflow',        tab: 'cashflow',          label: 'תזרים מזומנים'              },
  { id: 'members',         tab: 'members',           label: 'ניהול צוות'                 },
  { id: 'timeclock',       tab: 'timeclock',         label: 'שעון נוכחות'                },
  { id: 'tasks',           tab: 'tasks',             label: 'משימות'                     },
  { id: 'reports',         tab: 'reports',           label: 'דוחות'                      },
  { id: 'biz-ads',         tab: 'biz-ads',           label: 'פרסום FLOW'                 },
  { id: 'equipment',       tab: 'equipment',         label: 'ניהול ציוד'                 },
  { id: 'shifts',          tab: 'shifts',            label: 'ניהול משמרות'               },
  { id: 'pantry',          tab: 'pantry',            label: 'מחסן / מלאי'               },
  { id: 'sales',           tab: 'sales',             label: 'מוצרים ושירותים'            },
  { id: 'deliveries',      tab: 'deliveries',        label: 'ניהול משלוחים'              },

  // ─── לוגיסטיקה (ייחודי) ───────────────────────────────────────
  { id: 'logistics-orders',   tab: 'logistics_orders',   label: 'הזמנות לוגיסטיקה'     },
  { id: 'logistics-drivers',  tab: 'logistics_drivers',  label: 'נהגים'                 },
  { id: 'logistics-vehicles', tab: 'logistics_vehicles', label: 'צי רכבים'              },
  { id: 'logistics-routes',   tab: 'logistics_routes',   label: 'מסלולים'               },
  { id: 'logistics-tracking', tab: 'logistics_tracking', label: 'מעקב הזמנות'           },
  { id: 'logistics-invoices', tab: 'logistics_invoices', label: 'חשבוניות לוגיסטיקה'    },

  // ─── יופי (ייחודי) ────────────────────────────────────────────
  { id: 'beauty-calendar',      tab: 'beauty_calendar',      label: 'יומן יופי'          },
  { id: 'beauty-practitioners', tab: 'beauty_practitioners', label: 'מטפלות'             },
  { id: 'beauty-services',      tab: 'beauty_services',      label: 'שירותי יופי'        },
  { id: 'beauty-clients',       tab: 'beauty_clients',       label: 'לקוחות יופי'        },
  { id: 'beauty-subscriptions', tab: 'beauty_subscriptions', label: 'מנויים יופי'        },
  { id: 'beauty-commissions',   tab: 'beauty_commissions',   label: 'עמלות מטפלות'       },

  // ─── מקצועי/ייעוץ (ייחודי) ───────────────────────────────────
  { id: 'cases',     tab: 'cases',     label: 'תיקי לקוחות'                             },
  { id: 'leads',     tab: 'leads',     label: 'לידים'                                   },
  { id: 'timelog',   tab: 'timelog',   label: 'יומן שעות'                              },
  { id: 'documents', tab: 'documents', label: 'מסמכים'                                 },
];

// ------------------------------------------------------------------

async function login(page) {
  await page.goto(BIZ_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // מלא קוד עסק
  const codeInput = page.locator('#biz-group-code, input[placeholder*="קוד"], input[name="code"]').first();
  if (await codeInput.isVisible()) {
    await codeInput.fill(BIZ_CODE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  // מלא שם
  const nameInput = page.locator('#biz-login-name, input[placeholder*="שם"]').first();
  if (await nameInput.isVisible()) await nameInput.fill(BIZ_NAME);

  // מלא סיסמה
  const passInput = page.locator('#biz-login-pass, input[type="password"]').first();
  if (await passInput.isVisible()) await passInput.fill(BIZ_PASS);

  // לחץ כניסה
  const loginBtn = page.locator('button:has-text("כניסה"), button:has-text("התחבר")').first();
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
    await page.waitForTimeout(2500);
  }
}

async function switchTab(page, tabId) {
  // נסה קליק על כפתור הטאב (GNAV או ALL_TABS)
  const selectors = [
    `[onclick*="switchTab('${tabId}')"]`,
    `[data-tab="${tabId}"]`,
    `button[onclick*="${tabId}"]`,
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }
  // נסה JS
  await page.evaluate((id) => {
    if (typeof switchTab === 'function') switchTab(id);
    else if (typeof window.switchTab === 'function') window.switchTab(id);
  }, tabId).catch(() => {});
  await page.waitForTimeout(1000);
  return false;
}

async function capture(page, id, label) {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✅ ${label} → ${id}.png`);
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל צילום מסכים...');
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
      : undefined,
    headless: true,
  });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    deviceScaleFactor: 2, // Retina — תמונות חדות יותר
  });
  const page = await ctx.newPage();

  // --- צלם מסך כניסה ---
  await page.goto(BIZ_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await capture(page, 'login', 'מסך כניסה');

  // --- התחבר ---
  await login(page);
  console.log('🔐 מחובר לעסק');

  // --- צלם כל שאר המסכים ---
  for (const screen of SCREENS.slice(1)) { // דלג על login שכבר צולם
    try {
      const switched = await switchTab(page, screen.tab);
      await page.waitForTimeout(800);
      await capture(page, screen.id, screen.label);
    } catch (e) {
      console.warn(`⚠️  דילג על ${screen.id}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n✅ הושלם! התמונות נשמרו ב: ${OUT_DIR}`);
  console.log('הפעל את שרת האפליקציה כדי לצפות במדריך: http://localhost:3000/biz-setup-guide.html');
}

main().catch(e => { console.error('❌ שגיאה:', e.message); process.exit(1); });
