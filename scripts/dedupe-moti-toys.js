/**
 * dedupe-moti-toys.js
 * ============================================================
 * ניקוי כפילויות - scripts/seed-moti-toys.js רץ יותר מפעם אחת (אין בו
 * הגנת אידמפוטנטיות על יצירת מוצרים חדשים, בניגוד לשאר הסקריפטים בריפו),
 * כך שלכל אחד מ-25 המוצרים נוצרה כפילות (50 שורות בקטלוג במקום 25).
 *
 * הסקריפט הזה מאתר קבוצות מוצרים עם אותו שם, שומר עותק אחד (מעדיף את
 * העותק שכבר יש לו תמונה מקושרת; אם לשניהם יש/אין - שומר את ה-id הנמוך,
 * כלומר הראשון שנוצר) ומוחק את שאר הכפילויות. וריאציות (store_product_variants)
 * של המוצרים שנמחקים נמחקות אוטומטית איתם (ON DELETE CASCADE).
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BA8D4D53 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/dedupe-moti-toys.js
 *
 * בטוח להרצה חוזרת - אחרי שאין יותר כפילויות, הסקריפט לא מוחק כלום.
 * לא הורץ מול ה-DB האמיתי (אין גישת רשת מסביבת הכתיבה) — יש להריץ בעצמכם.
 * ============================================================
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BA8D4D53';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json response (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}

function log(ok, label, extra) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${extra ? ' — ' + extra : ''}`);
}

async function resolveGroupIdAndLogin() {
  console.log(`🔎 מאתר עסק לפי קוד ${GROUP_CODE}...`);
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`, undefined, false);
  if (lookup.ok && lookup.data && lookup.data.groupId) {
    GROUP_ID = lookup.data.groupId;
    console.log(`   נמצא group_id=${GROUP_ID} (${lookup.data.groupName || ''})`);
  } else {
    GROUP_ID = process.env.BIZ_GROUP_ID ? parseInt(process.env.BIZ_GROUP_ID) : null;
    if (!GROUP_ID) throw new Error(`לא הצלחתי לפתור group_id מקוד העסק — קבע BIZ_GROUP_ID והרץ שוב.`);
  }
  const r = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID }, false);
  if (!r.ok || !r.data.success || !r.data.token) {
    throw new Error(`התחברות נכשלה: ${JSON.stringify(r.data)}.`);
  }
  TOKEN = r.data.token;
  log(true, 'התחברות עסקית הצליחה', `group_id=${GROUP_ID}`);
}

async function main() {
  console.log('🚀 מתחיל ניקוי כפילויות מוצרים — צעצועי מוטי...\n');
  try {
    await resolveGroupIdAndLogin();

    const catalogRes = await api('GET', `/store/catalog/${GROUP_ID}`, undefined, false);
    if (!catalogRes.ok || !Array.isArray(catalogRes.data)) {
      throw new Error('נכשל בשליפת הקטלוג');
    }
    const catalog = catalogRes.data;
    console.log(`📦 נמצאו ${catalog.length} פריטים בקטלוג\n`);

    // קיבוץ לפי שם מוצר
    const groups = new Map();
    for (const item of catalog) {
      const key = item.name.trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    let totalDeleted = 0;
    for (const [name, items] of groups.entries()) {
      if (items.length <= 1) continue;
      // בחירת העותק שנשמר: מעדיפים כזה עם image_url, אחרת ה-id הנמוך ביותר
      const withImage = items.filter(i => i.image_url);
      const keep = (withImage.length ? withImage : items).sort((a, b) => a.id - b.id)[0];
      const toDelete = items.filter(i => i.id !== keep.id);
      console.log(`\n🔁 "${name}" — ${items.length} עותקים, שומר id=${keep.id}${keep.image_url ? ' (עם תמונה)' : ''}, מוחק ${toDelete.length}`);
      for (const dup of toDelete) {
        const r = await api('DELETE', `/store/catalog/${dup.id}`, { groupId: GROUP_ID }, false);
        log(r.ok && r.data.success !== false, `  נמחק id=${dup.id}`, r.ok ? '' : JSON.stringify(r.data));
        if (r.ok && r.data.success !== false) totalDeleted++;
      }
    }

    console.log('\n================= סיכום =================');
    console.log(`פריטים שנמחקו: ${totalDeleted}`);
    console.log(`פריטים שנותרו בקטלוג: ${catalog.length - totalDeleted}`);
    console.log('===========================================\n');
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exit(1);
  }
}

main();
