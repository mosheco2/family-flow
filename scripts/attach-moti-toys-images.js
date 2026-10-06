/**
 * attach-moti-toys-images.js
 * ============================================================
 * משיכה חד-פעמית: מקשר בין קובצי תמונה שהועלו ל-public/images/products/toys/
 * (שם הקובץ = שם המוצר בעברית, כפי שנמסר ברשימה) לבין מוצרי הקטלוג התואמים
 * של "צעצועי מוטי" (שנזרעו ע"י scripts/seed-moti-toys.js), ומעדכן את
 * image_url של כל מוצר בהתאמה.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BA8D4D53 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/attach-moti-toys-images.js
 *
 * הערות:
 * - סורק את public/images/products/toys/ בסביבה המקומית שבה מריצים את הסקריפט (לא דרך
 *   HTTP) - חייבים להריץ מתוך שורש הריפו, אחרי שהתמונות כבר הועלו/נמצאות בתיקייה הזו
 *   (על אותו שרת/דיסק שמגיש את public/).
 * - שם קובץ חייב להתאים *בדיוק* (ללא הסיומת) לשם המוצר בעברית. סיומות נתמכות:
 *   .jpg .jpeg .png .webp
 * - עדכון התמונה נעשה ב-PUT /api/store/catalog/:id שמחייב לשלוח את כל שדות המוצר
 *   (לא רק imageUrl) - הסקריפט שולף קודם את הפריט המלא מהקטלוג כדי לא לדרוס שדות אחרים.
 * - אידמפוטנטי: ניתן להריץ שוב בבטחה, רק מעדכן imageUrl.
 * - לא הורץ מול ה-DB/דיסק האמיתיים (אין גישת רשת/דיסק מתאימה מסביבת הכתיבה) — יש
 *   להריץ בעצמכם ולעבור על פלט הקונסול.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BA8D4D53';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'products', 'toys');
const PUBLIC_PATH_PREFIX = '/images/products/toys';
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

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

// מנרמל וריאציות מרכאות/גרש כדי שהתאמה בין שם קובץ לשם מוצר לא תיכשל על הבדלי טיפוגרפיה
// (למשל ״...״ עברי מול "..." רגיל, או ׳ מול ')
function normalizeQuotes(s) {
  return s
    .replace(/[״“”]/g, '"')  // ״ / “ / ” -> "
    .replace(/[׳‘’]/g, "'")  // ׳ / ‘ / ’ -> '
    .trim();
}

// בונה מפה: שם קובץ מנורמל (ללא סיומת) -> נתיב ציבורי לתמונה
function buildImageIndex() {
  if (!fs.existsSync(IMAGES_DIR)) {
    throw new Error(`התיקייה ${IMAGES_DIR} לא קיימת. ודא/י שאתה מריץ מתוך שורש הריפו ושהתמונות כבר הועלו.`);
  }
  const files = fs.readdirSync(IMAGES_DIR);
  const index = new Map();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTENSIONS.includes(ext)) continue;
    const baseName = path.basename(file, path.extname(file));
    index.set(normalizeQuotes(baseName), `${PUBLIC_PATH_PREFIX}/${file}`);
  }
  return index;
}

async function main() {
  console.log('🚀 מתחיל קישור תמונות למוצרי "צעצועי מוטי"...\n');
  try {
    await resolveGroupIdAndLogin();

    console.log(`\n🖼️  סורק תמונות ב-${IMAGES_DIR}...`);
    const imageIndex = buildImageIndex();
    console.log(`   נמצאו ${imageIndex.size} קבצי תמונה`);

    const catalogRes = await api('GET', `/store/catalog/${GROUP_ID}`, undefined, false);
    if (!catalogRes.ok || !Array.isArray(catalogRes.data)) {
      throw new Error('נכשל בשליפת הקטלוג');
    }
    const catalog = catalogRes.data;
    console.log(`   נמצאו ${catalog.length} מוצרים בקטלוג\n`);

    let updated = 0, skipped = 0;
    for (const item of catalog) {
      const imagePath = imageIndex.get(normalizeQuotes(item.name));
      if (!imagePath) {
        log(false, `אין תמונה תואמת: ${item.name}`, 'מדלג');
        skipped++;
        continue;
      }
      // שליחת כל שדות המוצר הקיימים + imageUrl החדש - ה-PUT לא עושה COALESCE על רוב השדות
      const r = await api('PUT', `/store/catalog/${item.id}`, {
        name: item.name, description: item.description, price: item.price, category: item.category,
        imageUrl: imagePath, optionsText: item.options_text, badgeText: item.badge_text, badgeColor: item.badge_color,
        productType: item.product_type, longDescription: item.long_description, kitchenStation: item.kitchen_station,
        isComplimentary: item.is_complimentary, nameEn: item.name_en, descriptionEn: item.description_en, categoryEn: item.category_en,
        sku: item.sku, barcode: item.barcode, unitType: item.unit_type, costPrice: item.cost_price,
        lowStockThreshold: item.low_stock_threshold, supplierId: item.supplier_id, supplierSku: item.supplier_sku,
        hasVariants: item.has_variants, trackInventory: item.track_inventory,
        variantAttributesSchema: item.variant_attributes_schema,
      });
      log(r.ok && r.data.success !== false, `תמונה עודכנה: ${item.name}`, r.ok ? imagePath : JSON.stringify(r.data));
      if (r.ok && r.data.success !== false) updated++; else skipped++;
    }

    console.log('\n================= סיכום =================');
    console.log(`מוצרים עודכנו עם תמונה: ${updated}`);
    console.log(`מוצרים ללא תמונה תואמת / נכשלו: ${skipped}`);
    console.log('===========================================\n');
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exit(1);
  }
}

main();
