/**
 * seed-miri-sport-inventory.js
 * השלמת נתוני מלאי ורכש לעסק "מירי ספורט" (B61091CF): מלאי לכל מוצרי הקטלוג הקיימים,
 * ספקים, הזמנות רכש (במגוון סטטוסים), וציוד (equipment items — טבלת הציוד הכללית,
 * לא ציוד שיעור ספציפי). תוסף לסקריפט הבסיס (seed-miri-sport.js) — לא מוחק כלום, רק מוסיף.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=B61091CF BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/seed-miri-sport-inventory.js
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'B61091CF';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';

let TOKEN = null, GROUP_ID = null, USER_ID = null;
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}
function log(ok, label, extra) { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); }

// מלאי לכל מוצר (לפי שם, כפי שנוצר ב-seed-miri-sport.js) — כמויות שונות כדי לדמות מצב אמיתי
// (כולל פריט אחד כמעט אזל, כדי שיופיע בהתראות/דוחות מלאי נמוך)
const STOCK_BY_NAME = {
  'אבקת חלבון וניל 1 ק"ג': 24,
  'אבקת חלבון שוקולד 1 ק"ג': 18,
  'שייקר 600 מ"ל': 40,
  'גומיות התנגדות (סט 3)': 30,
  'מזרן יוגה פרימיום': 15,
  'כפפות אימון': 22,
  'תיק ספורט': 3,   // מלאי נמוך בכוונה
  'חטיף אנרגיה (יחידה)': 60,
  'מגבת ספורט מיקרופייבר': 35,
  'בקבוק שתייה 1 ליטר': 50,
  'מנעול לוקר קוד': 12,
  'חגורת גב תמיכה': 9,
};

const SUPPLIERS = [
  { name: 'ספורט-פרו ציוד כושר בע"מ', contactPerson: 'אבי רונן', phone: '0528001001', email: 'orders@sportpro.co.il', category: 'ציוד אימון', minOrder: 500, cutoffTime: '14:00:00' },
  { name: 'ניוטרישן פלוס — תוספי תזונה', contactPerson: 'דנה פז', phone: '0528001002', email: 'sales@nutritionplus.co.il', category: 'תוספי תזונה', minOrder: 300, cutoffTime: '12:00:00' },
  { name: 'אביזרי ספורט אקספרס', contactPerson: 'יואב שחר', phone: '0528001003', email: 'info@sportaccess.co.il', category: 'אביזרים', minOrder: 150, cutoffTime: '16:00:00' },
];

const EQUIPMENT = [
  { name: 'הליכון מקצועי', category: 'קרדיו', serialNumber: 'TM-2024-001', status: 'active', notes: 'אולם ראשי, תחזוקה כל 3 חודשים' },
  { name: 'אופני ספינינג', category: 'קרדיו', serialNumber: 'SP-2024-012', status: 'active', notes: 'סטודיו ספין, 18 יחידות בשימוש' },
  { name: 'מכשיר רפורמר פילאטיס', category: 'פילאטיס', serialNumber: 'RF-2024-003', status: 'active', notes: 'חדר פילאטיס' },
  { name: 'סטיישן משקולות חופשיות', category: 'כוח', serialNumber: 'WS-2024-007', status: 'maintenance', notes: 'ממתין לטכנאי — כבל קרוע' },
  { name: 'מכונת TRX קיר', category: 'פונקציונלי', serialNumber: 'TRX-2024-002', status: 'active', notes: 'אולם פונקציונלי' },
];

async function main() {
  const lookup = await fetch(`${API}/storefront/${GROUP_CODE}`).then(r => r.json());
  if (!lookup.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE}`);
  GROUP_ID = lookup.groupId;
  const loginRes = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID });
  if (!loginRes.data.token) throw new Error(`התחברות נכשלה: ${JSON.stringify(loginRes.data)}`);
  TOKEN = loginRes.data.token;
  USER_ID = loginRes.data.user_id || null;
  log(true, 'התחברות הצליחה', `group_id=${GROUP_ID}`);

  // ONLY_RECEIVE=true — הרצה חוזרת ממוקדת: רק מתקנת את ה"קבלה" של הזמנת הרכש הראשונה דרך
  // ה-endpoint האמיתי, בלי ליצור שוב ספקים/הזמנות/ציוד כפולים מהריצה הקודמת
  if (process.env.ONLY_RECEIVE === 'true') {
    console.log('\n↷ ONLY_RECEIVE=true — מדלג על מלאי/ספקים/הזמנות/ציוד, מתקן רק את הקבלה');
    const ordersRes = await api('GET', `/b2b/orders/${GROUP_ID}`);
    const createdOrders = ordersRes.data.orders || [];
    const matchedOrder = createdOrders.find(o => o.supplier_name === 'ספורט-פרו ציוד כושר בע"מ');
    if (matchedOrder) {
      const receivedItems = [
        { name: 'מזרן יוגה פרימיום', qty: 20, unit: "יח'", price: 65 },
        { name: 'גומיות התנגדות (סט 3)', qty: 25, unit: "יח'", price: 32 },
      ];
      const r = await api('POST', '/b2b/orders/receive', { orderId: matchedOrder.id, groupId: GROUP_ID, userId: USER_ID, receivedItems, missingItems: [] });
      log(r.ok && r.data.success !== false, `הזמנת רכש #${matchedOrder.id} התקבלה בפועל ונכנסה ל"מזווה"`, r.ok ? '' : JSON.stringify(r.data));
    } else {
      log(false, 'לא נמצאה הזמנת הרכש הראשונה מהספק "ספורט-פרו"');
    }
    console.log('\n✅ הושלם.');
    return;
  }

  // ── מלאי לקטלוג קיים ──────────────────────────────────────────────────
  console.log('\n📦 מעדכן מלאי למוצרי הקטלוג...');
  const catRes = await api('GET', `/store/catalog/${GROUP_ID}`);
  const catalog = Array.isArray(catRes.data) ? catRes.data : [];
  const stockItems = catalog
    .filter(p => STOCK_BY_NAME[p.name] !== undefined)
    .map(p => ({ id: p.id, stock_quantity: STOCK_BY_NAME[p.name] }));
  if (stockItems.length) {
    const r = await api('POST', '/store/inventory-count', { groupId: GROUP_ID, items: stockItems, sendEmail: false });
    log(r.ok && r.data.success !== false, `מלאי עודכן ל-${stockItems.length} מוצרים`);
  } else {
    log(false, 'לא נמצאו מוצרים תואמים בקטלוג לעדכון מלאי — ודא ש-seed-miri-sport.js הורץ קודם');
  }

  // ── ספקים ──────────────────────────────────────────────────────────────
  console.log('\n🚚 בונה ספקים...');
  const supplierIds = {};
  for (const s of SUPPLIERS) {
    const r = await api('POST', '/suppliers', { groupId: GROUP_ID, ...s });
    log(r.ok && r.data.success, `ספק: ${s.name}`);
    if (r.data.success) supplierIds[s.name] = r.data.supplier.id;
  }

  // ── הזמנות רכש (מגוון סטטוסים) ───────────────────────────────────────
  console.log('\n🧾 בונה הזמנות רכש...');
  const poOrders = [
    {
      supplierId: supplierIds['ספורט-פרו ציוד כושר בע"מ'],
      items: [
        { item_name: 'מזרן יוגה פרימיום', quantity: 20, unit_price: 65 },
        { item_name: 'גומיות התנגדות (סט 3)', quantity: 25, unit_price: 32 },
      ],
    },
    {
      supplierId: supplierIds['ניוטרישן פלוס — תוספי תזונה'],
      items: [
        { item_name: 'אבקת חלבון וניל 1 ק"ג', quantity: 15, unit_price: 95 },
        { item_name: 'אבקת חלבון שוקולד 1 ק"ג', quantity: 15, unit_price: 95 },
        { item_name: 'חטיף אנרגיה (יחידה)', quantity: 100, unit_price: 6 },
      ],
    },
    {
      supplierId: supplierIds['אביזרי ספורט אקספרס'],
      items: [
        { item_name: 'תיק ספורט', quantity: 30, unit_price: 55 },
        { item_name: 'מנעול לוקר קוד', quantity: 20, unit_price: 15 },
      ],
    },
  ];
  for (const po of poOrders) {
    const totalAmount = po.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const r = await api('POST', '/b2b/orders', {
      groupId: GROUP_ID, userId: USER_ID,
      orders: [{ supplierId: po.supplierId, items: po.items, totalAmount }],
    });
    log(r.ok && r.data.success !== false, `הזמנת רכש נוצרה (סה"כ ₪${totalAmount})`, r.ok ? '' : JSON.stringify(r.data));
  }
  // מסמנים את ההזמנה הראשונה כ"התקבלה" — לא עם PUT /status בלבד (זה רק מסמן סטטוס, לא
  // מכניס בפועל כלום לשום מקום), אלא דרך POST /receive האמיתי, שהוא היחיד שבאמת מזין את
  // הפריטים שהתקבלו ל"מזווה וארונות" (pantry) — היעד האמיתי שאליו נכנסת סחורה שמתקבלת מרכש
  const ordersRes = await api('GET', `/b2b/orders/${GROUP_ID}`);
  const createdOrders = ordersRes.data.orders || [];
  const firstPo = poOrders[0];
  const matchedOrder = createdOrders.find(o => o.supplier_id === firstPo.supplierId);
  if (matchedOrder) {
    const receivedItems = firstPo.items.map(i => ({ name: i.item_name, qty: i.quantity, unit: "יח'", price: i.unit_price }));
    const r = await api('POST', '/b2b/orders/receive', {
      orderId: matchedOrder.id, groupId: GROUP_ID, userId: USER_ID, receivedItems, missingItems: [],
    });
    log(r.ok && r.data.success !== false, `הזמנת רכש #${matchedOrder.id} התקבלה בפועל ונכנסה ל"מזווה"`, r.ok ? '' : JSON.stringify(r.data));
  } else {
    log(false, 'לא נמצאה הזמנת הרכש הראשונה לסימון כהתקבלה');
  }

  // ── ציוד (equipment items) ───────────────────────────────────────────
  console.log('\n🏋️ בונה פריטי ציוד...');
  for (const eq of EQUIPMENT) {
    const r = await api('POST', '/equipment/items', { groupId: GROUP_ID, ...eq });
    log(r.ok && r.data.success, `ציוד: ${eq.name}`);
  }

  console.log('\n✅ הושלם! מלאי, ספקים, הזמנות רכש וציוד נוספו לעסק "מירי ספורט".');
}

main().catch(e => { console.error('\n❌ שגיאה:', e.message); process.exit(1); });
