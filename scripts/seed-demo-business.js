/**
 * seed-demo-business.js
 * הזרמת נתוני דמו מקיפים לעסק קיים מסוג תחזוקה ותיקונים — חנות ציבורית + כל צד הניהול.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PHONE=0501234567 BIZ_PASS=123456 \
 *     node scripts/seed-demo-business.js
 *
 * חשוב:
 * - BIZ_PHONE הוא **מספר הטלפון** של משתמש ה-ADMIN שנרשם בעסק (לא שם משתמש/nickname) —
 *   כך /api/biz/login מזהה משתמשים. אם לא ידוע, אפשר לבדוק/לאפס אותו דרך Super Admin.
 * - group_id מספרי נפתר אוטומטית מ-group_code דרך GET /api/storefront/:code (ציבורי);
 *   אם זה נכשל אפשר לעקוף עם BIZ_GROUP_ID (מזהה מספרי).
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_NAME = process.env.BIZ_NAME || 'יוסי';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json response (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}

function log(ok, label, extra) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${extra ? ' — ' + extra : ''}`);
}

// ------------------------------------------------------------------
async function resolveGroupIdAndLogin() {
  console.log(`🔎 מאתר עסק לפי קוד ${GROUP_CODE}...`);
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`, undefined, false);
  if (lookup.ok && lookup.data && lookup.data.id) {
    GROUP_ID = lookup.data.id;
    console.log(`   נמצא group_id=${GROUP_ID} (${lookup.data.name || ''})`);
  } else {
    GROUP_ID = process.env.BIZ_GROUP_ID ? parseInt(process.env.BIZ_GROUP_ID) : null;
    if (!GROUP_ID) throw new Error(`לא הצלחתי לפתור group_id מקוד העסק (${JSON.stringify(lookup.data)}) — קבע BIZ_GROUP_ID (מזהה מספרי) והרץ שוב.`);
  }

  // /api/biz/login דורש phone (לא שם) + groupId מספרי — יש להעביר BIZ_PHONE במשתני הסביבה
  const phone = process.env.BIZ_PHONE;
  if (!phone) throw new Error('חובה להעביר BIZ_PHONE (מספר הטלפון של המנהל שנרשם בעסק) — ההתחברות העסקית מבוססת טלפון, לא שם משתמש.');
  const r = await api('POST', '/biz/login', { phone, password: ADMIN_PASS, groupId: GROUP_ID }, false);
  if (!r.ok || !r.data.success || !r.data.token) {
    throw new Error(`התחברות נכשלה: ${JSON.stringify(r.data)}. ודא/י ש-BIZ_PHONE, BIZ_PASS ו-group_id נכונים.`);
  }
  TOKEN = r.data.token;
  log(true, 'התחברות עסקית הצליחה', `group_id=${GROUP_ID}`);
}

// ------------------------------------------------------------------
// 1. קטלוג — מוצרים (למכירה) + שירותים (להזמנה)
const PRODUCTS = [
  { name: 'קיט אטמים אוניברסלי לברז', category: 'חלקי חילוף', price: 35, description: 'סט אטמים לברזים ביתיים נפוצים' },
  { name: 'ראש מקלחת חסכוני', category: 'מוצרי אינסטלציה', price: 65, description: 'ראש מקלחת עם חוסך מים מובנה' },
  { name: 'שקע חשמל דו-קוטבי', category: 'חלקי חשמל', price: 28, description: 'שקע תקני 16A עם הארקה' },
  { name: 'גוף חימום לדוד שמש 3000W', category: 'חלקי חילוף', price: 210, description: 'גוף חימום סטנדרטי לדוד 150-200 ליטר' },
  { name: 'ניקוז סיפון למטבח', category: 'מוצרי אינסטלציה', price: 45, description: 'סיפון פלסטיק איכותי לכיור מטבח' },
];
const SERVICES = [
  { name: 'תיקון נזילה בברז', category: 'אינסטלציה', price: 180, description: 'איתור ותיקון נזילה, כולל אטמים בסיסיים' },
  { name: 'החלפת גוף חימום לדוד שמש', category: 'דודי שמש', price: 380, description: 'פירוק גוף חימום ישן והתקנת חדש, כולל אטימות' },
  { name: 'תיקון קצר חשמלי', category: 'חשמל', price: 220, description: 'איתור תקלה וטיפול בקצר במעגל ביתי' },
  { name: 'התקנת מזגן עד 1.5 כ"ס', category: 'מיזוג אוויר', price: 650, description: 'התקנה מלאה כולל צנרת עד 3 מטר' },
  { name: 'פתיחת סתימה בביוב', category: 'אינסטלציה', price: 250, description: 'פתיחת סתימה עם ספירלה מקצועית' },
  { name: 'בדיקת תקינות לוח חשמל', category: 'חשמל', price: 150, description: 'בדיקה כללית ומתן דוח תקינות' },
];

async function seedCatalog() {
  console.log('\n📦 קטלוג — מוצרים ושירותים');
  for (const p of PRODUCTS) {
    const r = await api('POST', '/store/catalog', { ...p, productType: 'retail' });
    log(r.ok && r.data.success !== false, `מוצר: ${p.name}`, r.ok ? '' : JSON.stringify(r.data));
  }
  for (const s of SERVICES) {
    const r = await api('POST', '/store/catalog', { ...s, productType: 'service' });
    log(r.ok && r.data.success !== false, `שירות: ${s.name}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 2. מבצעים + קופונים
async function seedPromotionsAndCoupons() {
  console.log('\n🎟️  מבצעים וקופונים');
  const promos = [
    { title: '10% הנחה על קריאה ראשונה', promoType: 'percent', promoValue: 10, targetType: 'all', showInBanner: true },
    { title: 'אחריות 6 חודשים על כל תיקון', promoType: 'percent', promoValue: 0, targetType: 'all', showInBanner: true },
  ];
  for (const p of promos) {
    const r = await api('POST', '/store/promotions', { groupId: GROUP_ID, ...p }, false);
    log(r.ok && r.data.success !== false, `מבצע: ${p.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
  const r = await api('POST', '/store/coupons', { groupId: GROUP_ID, code: 'WELCOME10', discountPct: 10 }, false);
  log(r.ok && r.data.success !== false, 'קופון: WELCOME10', r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 3. הגדרות חנות
async function seedStoreSettings() {
  console.log('\n🏪 הגדרות חנות');
  const r = await api('POST', '/store/settings', {
    groupId: GROUP_ID,
    isActive: true,
    welcomeMessage: 'ברוכים הבאים ליוסי ובניו ידי זהב — תיקונים ואחזקה לבית ולעסק',
    slogan: 'ידיים זהובות, פתרון לכל תקלה',
    openTime: '08:00',
    closeTime: '18:00',
    whatsappNumber: '0501234567',
  }, false);
  log(r.ok && r.data.success !== false, 'עדכון הגדרות חנות', r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 4. לקוחות
const CUSTOMERS = [
  { name: 'דנה כהן', phone: '0521112233', email: 'dana@example.com', notes: 'לקוחה קבועה, דירה בקומה 3' },
  { name: 'משה לוי', phone: '0522223344', email: 'moshe@example.com', notes: 'בעל עסק — חנות בקניון' },
  { name: 'רונית אברהם', phone: '0523334455', email: 'ronit@example.com', notes: '' },
];
let customerIds = [];

async function seedCustomers() {
  console.log('\n👥 לקוחות');
  for (const c of CUSTOMERS) {
    const r = await api('POST', '/store/customers', { groupId: GROUP_ID, ...c, adminName: ADMIN_NAME }, false);
    log(r.ok && r.data.success !== false, `לקוח: ${c.name}`, r.ok ? '' : JSON.stringify(r.data));
    if (r.ok && r.data.customer) customerIds.push(r.data.customer.id);
  }
}

// ------------------------------------------------------------------
// 5. הצעות מחיר
async function seedQuotes() {
  console.log('\n📝 הצעות מחיר');
  const quotes = [
    { customerName: 'דנה כהן', customerPhone: '0521112233', items: [{ name: 'תיקון נזילה בברז', price: 180, qty: 1 }], totalAmount: 180, notes: 'ממתין לאישור לקוחה' },
    { customerName: 'משה לוי', customerPhone: '0522223344', items: [{ name: 'התקנת מזגן עד 1.5 כ"ס', price: 650, qty: 2 }], totalAmount: 1300, notes: 'שתי יחידות בחנות' },
  ];
  for (const q of quotes) {
    const r = await api('POST', '/store/quotes', q);
    log(r.ok && r.data.success !== false, `הצעת מחיר: ${q.customerName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 6. הזמנות מוצרים
async function seedOrders() {
  console.log('\n🛒 הזמנות מוצרים');
  const orders = [
    { customerName: 'רונית אברהם', customerPhone: '0523334455', items: [{ name: 'ראש מקלחת חסכוני', price: 65, qty: 2 }], totalAmount: 130, notes: 'איסוף עצמי' },
  ];
  for (const o of orders) {
    const r = await api('POST', '/store/orders', { groupId: GROUP_ID, ...o }, false);
    log(r.ok && r.data.success !== false, `הזמנה: ${o.customerName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 7. קריאות שירות
async function seedServiceCalls() {
  console.log('\n🔧 קריאות שירות');
  const calls = [
    { title: 'נזילה מתחת לכיור', description: 'טפטוף מתמשך מתחת לכיור המטבח', customerName: 'דנה כהן', customerPhone: '0521112233', priority: 'high', businessGroupId: GROUP_ID },
    { title: 'תקלה בלוח חשמל', description: 'נתיך קופץ שוב ושוב', customerName: 'משה לוי', customerPhone: '0522223344', priority: 'normal', businessGroupId: GROUP_ID },
    { title: 'סתימה בביוב חוזרת', description: 'סתימה שחוזרת כל כמה שבועות', customerName: 'רונית אברהם', customerPhone: '0523334455', priority: 'normal', businessGroupId: GROUP_ID },
  ];
  for (const c of calls) {
    const r = await api('POST', '/service-calls', c, false);
    log(r.ok && r.data.success !== false, `קריאה: ${c.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 8. תנועות פיננסיות
async function seedTransactions() {
  console.log('\n💰 תנועות פיננסיות');
  const txs = [
    { amount: 380, description: 'תשלום עבור תיקון דוד שמש — משה לוי', category: 'sales', type: 'income' },
    { amount: 650, description: 'תשלום עבור התקנת מזגן — משה לוי', category: 'sales', type: 'income' },
    { amount: 210, description: 'רכישת חלקי חילוף מספק', category: 'supplies', type: 'expense' },
    { amount: 120, description: 'דלק לרכב שירות', category: 'transport', type: 'expense' },
  ];
  for (const t of txs) {
    const r = await api('POST', '/transaction', { groupId: GROUP_ID, ...t }, false);
    log(r.ok && r.data.success !== false, `תנועה: ${t.description}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 9. משימות
async function seedTasks() {
  console.log('\n✅ משימות');
  const tasks = [
    { title: 'להזמין מלאי אטמים נוספים', priority: 'medium', requireAiCheck: false },
    { title: 'לחזור ללקוחה דנה כהן עם הצעת מחיר', priority: 'high', requireAiCheck: false },
    { title: 'לתאם ביקורת תקינות ללוח חשמל', priority: 'low', requireAiCheck: false },
  ];
  for (const t of tasks) {
    const r = await api('POST', '/tasks', t);
    log(r.ok && r.data.success !== false, `משימה: ${t.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 10. יומן / תיאומים
async function seedCalendar() {
  console.log('\n📅 יומן ותיאומים');
  const today = new Date();
  const inDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const events = [
    { title: 'תיקון נזילה — דנה כהן', customerPhone: '0521112233', eventDate: inDays(1), startTime: '10:00', notes: 'להביא אטמים' },
    { title: 'התקנת מזגן — משה לוי', customerPhone: '0522223344', eventDate: inDays(2), startTime: '13:00', notes: 'שתי יחידות' },
  ];
  for (const e of events) {
    const r = await api('POST', '/calendar/events', { groupId: GROUP_ID, ...e }, false);
    log(r.ok && r.data.success !== false, `אירוע יומן: ${e.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 11. פקודות עבודה (+ רכש בתוכן)
async function seedWorkOrdersAndProcurement() {
  console.log('\n🧰 פקודות עבודה ורכש');
  const woResults = [];
  const workOrders = [
    { customer_name: 'דנה כהן', customer_phone: '0521112233', title: 'תיקון נזילה בברז — עבודה מלאה' },
    { customer_name: 'משה לוי', customer_phone: '0522223344', title: 'התקנת שני מזגנים בחנות' },
  ];
  for (const wo of workOrders) {
    const r = await api('POST', `/work-orders/new/${GROUP_ID}`, wo);
    log(r.ok && r.data.success !== false, `פקודת עבודה: ${wo.title}`, r.ok ? '' : JSON.stringify(r.data));
    if (r.ok && r.data.workOrder) woResults.push(r.data.workOrder);
    else if (r.ok && r.data.id) woResults.push(r.data);
  }

  // ספק + הזמנת רכש על פקודת העבודה הראשונה (אם נוצרה)
  const supplierR = await api('POST', '/suppliers', { groupId: GROUP_ID, name: 'חשמל ואינסטלציה בע"מ', category: 'חלקי חילוף', phone: '0507654321' }, false);
  log(supplierR.ok && supplierR.data.success !== false, 'ספק: חשמל ואינסטלציה בע"מ', supplierR.ok ? '' : JSON.stringify(supplierR.data));

  if (woResults.length) {
    const woId = woResults[0].id;
    const poR = await api('POST', `/work-orders/${woId}/purchase-orders`, {
      groupId: GROUP_ID,
      supplierName: 'חשמל ואינסטלציה בע"מ',
      items: [{ item_name: 'גוף חימום לדוד שמש', unit_price: 180, quantity: 3 }],
      notes: 'להזמין לפני סוף השבוע',
      userName: ADMIN_NAME,
    });
    log(poR.ok && poR.data.success !== false, 'הזמנת רכש על פקודת עבודה', poR.ok ? '' : JSON.stringify(poR.data));
  } else {
    console.log('   ⚠️  לא נוצרה פקודת עבודה — מדלג על הזמנת הרכש');
  }
}

// ------------------------------------------------------------------
// 12. מלאי
async function seedPantry() {
  console.log('\n📦 מלאי');
  const items = [
    { itemName: 'אטמים לברז (סט)', quantity: 15, unit: "יח'" },
    { itemName: 'גוף חימום לדוד שמש', quantity: 4, unit: "יח'" },
    { itemName: 'שקעי חשמל', quantity: 20, unit: "יח'" },
  ];
  for (const it of items) {
    const r = await api('POST', '/pantry/add', { groupId: GROUP_ID, ...it }, false);
    log(r.ok && r.data.success !== false, `מלאי: ${it.itemName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל הזרמת נתוני דמו מקיפים...\n');
  try {
    await resolveGroupIdAndLogin();
    await seedStoreSettings();
    await seedCatalog();
    await seedPromotionsAndCoupons();
    await seedCustomers();
    await seedQuotes();
    await seedOrders();
    await seedServiceCalls();
    await seedTransactions();
    await seedTasks();
    await seedCalendar();
    await seedWorkOrdersAndProcurement();
    await seedPantry();
    console.log('\n✅ הושלם! העסק מלא כעת בנתוני דמו מקיפים בכל תחומי הניהול והחנות הציבורית.');
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exit(1);
  }
}

main();
