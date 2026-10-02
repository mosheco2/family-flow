/**
 * expand-golden-hands-full.js
 * מילוי נתונים רחב ונוסף לעסק הקיים "יוסי ובניו ידי זהב" (BC327E18, תחזוקה ותיקונים) —
 * לא מוחק/דורס נתונים קיימים ותקינים, רק מוסיף: מוצרים+שירותים עם תמונות, הצעות מחיר,
 * עובדים, הזמנות, פקודות עבודה, ושגרות (כולל אתר, חוזה שירות, ושגרות מתוך ספריית התבניות).
 * בסיום גם מוחק את פקודות העבודה #161-#164 לפי בקשה מפורשת.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/expand-golden-hands-full.js
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_NAME = process.env.BIZ_NAME || 'יוסי';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';
const WORK_ORDERS_TO_DELETE = (process.env.DELETE_WO_IDS || '161,162,163,164').split(',').map(s => s.trim()).filter(Boolean);

let TOKEN = null, GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}
function log(ok, label, extra) { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); }
const img = (keyword) => `https://loremflickr.com/480/360/${encodeURIComponent(keyword)}?lock=${Math.floor(Math.random() * 100000)}`;

async function resolveGroupIdAndLogin() {
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`, undefined, false);
  if (!lookup.ok || !lookup.data.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE} (status ${lookup.status})`);
  GROUP_ID = lookup.data.groupId;
  const r = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID }, false);
  if (!r.ok || !r.data.success || !r.data.token) throw new Error(`התחברות נכשלה: ${JSON.stringify(r.data)}`);
  TOKEN = r.data.token;
  log(true, 'התחברות הצליחה', `group_id=${GROUP_ID}`);
}

// ------------------------------------------------------------------
// 1. קטלוג — מוצרים ושירותים נוספים, עם תמונות רלוונטיות (לא דורסים קיימים — מדלגים על שם זהה)
const NEW_PRODUCTS = [
  { name: 'מפסק פחת דו-קוטבי 40A', category: 'חלקי חשמל', price: 95, description: 'מפסק פחת תקני להגנה על מעגל ביתי', imageKeyword: 'circuit-breaker' },
  { name: 'ברז מטבח עם זרוע נשלפת', category: 'מוצרי אינסטלציה', price: 320, description: 'ברז מטבח איכותי עם ראש נשלף', imageKeyword: 'kitchen-faucet' },
  { name: 'מנעול רב בריח 5 נקודות', category: 'מנעולנות', price: 450, description: 'מנעול דלת כניסה ברמת אבטחה גבוהה', imageKeyword: 'door-lock' },
  { name: 'מצבר גיבוי לגנרטור ביתי', category: 'חלקי חשמל', price: 380, description: 'מצבר 12V איכותי לגיבוי חירום', imageKeyword: 'battery' },
  { name: 'מסנן אוויר למזגן עילי', category: 'מיזוג אוויר', price: 55, description: 'מסנן חלופי סטנדרטי ליחידה עילית', imageKeyword: 'air-conditioner' },
  { name: 'כבל רשת Cat6 מוגן 20 מ׳', category: 'תיקוני מחשבים וסלולר', price: 75, description: 'כבל רשת איכותי לחיבור יציב', imageKeyword: 'ethernet-cable' },
];
const NEW_SERVICES = [
  { name: 'ניקוי וטיפול שנתי למזגן', category: 'מיזוג אוויר', price: 220, description: 'ניקוי מסננים, בדיקת גז ותקינות כללית', imageKeyword: 'ac-technician' },
  { name: 'החלפת מנעול דלת כניסה', category: 'מנעולנות', price: 280, description: 'הסרת מנעול ישן והתקנת מנעול חדש כולל כוונון', imageKeyword: 'locksmith' },
  { name: 'תיקון מסך שבור בטלפון נייד', category: 'תיקוני מחשבים וסלולר', price: 350, description: 'החלפת מסך מקורי/תואם, כולל בדיקת מגע ותצוגה', imageKeyword: 'phone-repair' },
  { name: 'שחזור נתונים ממחשב שלא עולה', category: 'תיקוני מחשבים וסלולר', price: 300, description: 'איתור תקלה ושחזור קבצים מדיסק פגום', imageKeyword: 'computer-repair' },
  { name: 'התקנת מצלמת אבטחה ביתית', category: 'חשמל', price: 420, description: 'התקנה והגדרה כולל חיבור לאפליקציה', imageKeyword: 'security-camera' },
  { name: 'בדיקת תקינות גנרטור חירום', category: 'חשמל', price: 260, description: 'הרצה תחת עומס ובדיקת מצברים', imageKeyword: 'generator' },
];

let existingCatalogNames = new Set();
async function loadExistingCatalog() {
  const r = await api('GET', `/store/catalog/${GROUP_ID}`, undefined, false);
  const list = Array.isArray(r.data) ? r.data : (r.data.catalog || r.data.items || []);
  if (Array.isArray(list)) existingCatalogNames = new Set(list.map(i => i.name));
  log(true, `קטלוג קיים נטען`, `${existingCatalogNames.size} פריטים`);
}

async function seedCatalog() {
  console.log('\n📦 קטלוג — מוצרים ושירותים נוספים (עם תמונות)');
  for (const p of NEW_PRODUCTS) {
    if (existingCatalogNames.has(p.name)) { console.log(`   ↷ קיים כבר: ${p.name}`); continue; }
    const r = await api('POST', '/store/catalog', { ...p, imageUrl: img(p.imageKeyword), productType: 'retail' });
    log(r.ok && r.data.success !== false, `מוצר: ${p.name}`, r.ok ? '' : JSON.stringify(r.data));
  }
  for (const s of NEW_SERVICES) {
    if (existingCatalogNames.has(s.name)) { console.log(`   ↷ קיים כבר: ${s.name}`); continue; }
    const r = await api('POST', '/store/catalog', { ...s, imageUrl: img(s.imageKeyword), productType: 'service' });
    log(r.ok && r.data.success !== false, `שירות: ${s.name}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 2. צוות — עובדים נוספים
const NEW_TEAM = [
  { nickname: 'יעל חשמלאית', firstName: 'יעל', lastName: 'ברק', phone: '0500000301', email: 'yael.elec@example.com', employee_role_type: 'field_tech' },
  { nickname: 'רונן מנעולן', firstName: 'רונן', lastName: 'שגיא', phone: '0500000302', email: 'ronen.lock@example.com', employee_role_type: 'field_tech' },
];
let teamUserIds = {};
async function loadExistingTeam() {
  const r = await api('GET', `/work-orders/users/${GROUP_ID}`, undefined, false);
  const list = r.ok ? (r.data.users || []) : [];
  for (const u of list) teamUserIds[u.name] = u.id;
  log(true, 'צוות קיים נטען', `${list.length} אנשי צוות`);
}
async function seedTeam() {
  console.log('\n👷 צוות — עובדים נוספים');
  for (const t of NEW_TEAM) {
    if (teamUserIds[t.nickname]) { console.log(`   ↷ קיים כבר: ${t.nickname}`); continue; }
    const joinRes = await api('POST', '/join', {
      groupCode: GROUP_CODE, nickname: t.nickname, firstName: t.firstName, lastName: t.lastName,
      phone: t.phone, email: t.email, password: '123456', role: 'MEMBER', employee_role_type: t.employee_role_type,
    }, false);
    log(joinRes.ok, `בקשת הצטרפות: ${t.nickname}`, joinRes.ok ? '' : JSON.stringify(joinRes.data));
    const pendingRes = await api('GET', `/admin/pending-users?groupId=${GROUP_ID}`, undefined, false);
    const pendingList = Array.isArray(pendingRes.data) ? pendingRes.data : [];
    const match = pendingList.find(u => u.nickname === t.nickname);
    if (match) {
      const approveRes = await api('POST', '/admin/approve-user', { userId: match.id }, false);
      log(approveRes.ok && approveRes.data.success !== false, `אישור עובד: ${t.nickname}`);
      teamUserIds[t.nickname] = match.id;
    } else {
      log(false, `אישור עובד: ${t.nickname}`, 'לא נמצא ברשימת ממתינים (אולי כבר קיים)');
    }
  }
}

// ------------------------------------------------------------------
// 3. לקוחות נוספים
const NEW_CUSTOMERS = [
  { name: 'יעקב שרון', phone: '0524445566', email: 'yaakov@example.com', notes: 'בניין משרדים, קומה 2' },
  { name: 'מיכל אזולאי', phone: '0525556677', email: 'michal@example.com', notes: '' },
  { name: 'חברת ניהול נכסי צפון בע״מ', phone: '0526667788', email: 'office@north-props.example.com', notes: 'לקוח חוזה — כמה בניינים' },
];
async function seedCustomers() {
  console.log('\n👥 לקוחות נוספים');
  for (const c of NEW_CUSTOMERS) {
    const r = await api('POST', '/store/customers', { groupId: GROUP_ID, ...c, adminName: ADMIN_NAME }, false);
    log(r.ok && r.data.success !== false, `לקוח: ${c.name}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 4. הצעות מחיר נוספות
async function seedQuotes() {
  console.log('\n📝 הצעות מחיר נוספות');
  const quotes = [
    { customerName: 'יעקב שרון', customerPhone: '0524445566', items: [{ name: 'התקנת מצלמת אבטחה ביתית', price: 420, qty: 4 }], totalAmount: 1680, notes: 'ארבע מצלמות בבניין המשרדים' },
    { customerName: 'מיכל אזולאי', customerPhone: '0525556677', items: [{ name: 'החלפת מנעול דלת כניסה', price: 280, qty: 1 }], totalAmount: 280, notes: '' },
    { customerName: 'חברת ניהול נכסי צפון בע״מ', customerPhone: '0526667788', items: [{ name: 'בדיקת תקינות גנרטור חירום', price: 260, qty: 3 }], totalAmount: 780, notes: 'שלושה בניינים תחת ניהול' },
  ];
  for (const q of quotes) {
    const r = await api('POST', '/store/quotes', q);
    log(r.ok && r.data.success !== false, `הצעת מחיר: ${q.customerName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 5. הזמנות מוצרים נוספות
async function seedOrders() {
  console.log('\n🛒 הזמנות מוצרים נוספות');
  const orders = [
    { customerName: 'יעקב שרון', customerPhone: '0524445566', items: [{ name: 'מסנן אוויר למזגן עילי', price: 55, qty: 6 }], totalAmount: 330, notes: 'לכל יחידות המזגן בבניין' },
    { customerName: 'מיכל אזולאי', customerPhone: '0525556677', items: [{ name: 'כבל רשת Cat6 מוגן 20 מ׳', price: 75, qty: 1 }], totalAmount: 75, notes: '' },
  ];
  for (const o of orders) {
    const r = await api('POST', '/store/orders', { groupId: GROUP_ID, ...o }, false);
    log(r.ok && r.data.success !== false, `הזמנה: ${o.customerName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 6. פקודות עבודה נוספות
let newWorkOrderIds = [];
async function seedWorkOrders() {
  console.log('\n🧰 פקודות עבודה נוספות');
  const workOrders = [
    { customer_name: 'יעקב שרון', customer_phone: '0524445566', title: 'התקנת מצלמות אבטחה — בניין משרדים' },
    { customer_name: 'מיכל אזולאי', customer_phone: '0525556677', title: 'החלפת מנעול דלת כניסה' },
    { customer_name: 'חברת ניהול נכסי צפון בע״מ', customer_phone: '0526667788', title: 'בדיקת גנרטור חירום — 3 בניינים' },
  ];
  for (const wo of workOrders) {
    const r = await api('POST', `/work-orders/new/${GROUP_ID}`, wo);
    log(r.ok && r.data.success !== false, `פקודת עבודה: ${wo.title}`, r.ok ? '' : JSON.stringify(r.data));
    if (r.ok && r.data.id) newWorkOrderIds.push(r.data.id);
  }
  // שיוך טכנאים לפקודות החדשות
  const techNames = ['יעל חשמלאית', 'רונן מנעולן'];
  for (let i = 0; i < newWorkOrderIds.length && i < techNames.length; i++) {
    const techId = teamUserIds[techNames[i]];
    if (!techId) continue;
    const r = await api('POST', `/work-orders/${newWorkOrderIds[i]}/assignees`, { userId: techId, userName: techNames[i], assignedBy: ADMIN_NAME, roleLabel: 'טכנאי אחראי' });
    log(r.ok && r.data.success !== false, `שיוך ${techNames[i]} לפקודה #${newWorkOrderIds[i]}`);
  }
}

// ------------------------------------------------------------------
// 7. שגרות — אתר, חוזה שירות, ושגרות מתוך ספריית התבניות + שגרה מותאמת
async function seedRoutines() {
  console.log('\n🔁 שגרות (אתר + חוזה שירות + ספריית תבניות)');

  const siteR = await api('POST', `/routines/${GROUP_ID}/sites`, {
    name: 'חברת ניהול נכסי צפון — בניין A', address: 'רחוב ההדר 12, חיפה',
    contactName: 'חברת ניהול נכסי צפון בע״מ', contactPhone: '0526667788', isInternal: false,
  });
  log(siteR.ok && siteR.data.success !== false, 'אתר לקוח: בניין A', siteR.ok ? '' : JSON.stringify(siteR.data));
  const siteId = siteR.ok ? siteR.data.id : null;

  let contractId = null;
  if (siteId) {
    const contractR = await api('POST', `/routines/${GROUP_ID}/contracts`, {
      siteId, startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      billingModel: 'subscription', subscriptionAmount: 450, coverageScope: 'labor',
      visitsIncludedPerYear: 4, availability: 'business_hours',
    });
    log(contractR.ok && contractR.data.success !== false, 'חוזה שירות — בניין A', contractR.ok ? '' : JSON.stringify(contractR.data));
    contractId = contractR.ok ? contractR.data.id : null;
  }

  // תבניות מוכנות לענף התחזוקה/תיקונים
  const templatesR = await api('GET', `/routines/${GROUP_ID}/templates`);
  if (templatesR.ok && Array.isArray(templatesR.data.templates)) {
    const keys = templatesR.data.templates.slice(0, 5).map(t => t.key);
    const applyR = await api('POST', `/routines/${GROUP_ID}/templates/apply`, { templateKeys: keys, siteId, createdBy: ADMIN_NAME });
    log(applyR.ok && applyR.data.success !== false, `שגרות מתבניות (${keys.length})`, applyR.ok ? '' : JSON.stringify(applyR.data));
  } else {
    log(false, 'טעינת ספריית תבניות', JSON.stringify(templatesR.data));
  }

  // שגרה מותאמת — ביקור שגרתי שמייצר פקודת עבודה, מקושרת לחוזה
  const techId = teamUserIds['יעל חשמלאית'] || null;
  const customR = await api('POST', `/routines/${GROUP_ID}`, {
    name: 'ביקור תחזוקה רבעוני — בניין A', category: 'preventive_maintenance',
    targetLevel: 'site', siteId, serviceContractId: contractId,
    outputType: 'work_order_template', frequencyType: 'fixed', frequencyInterval: 'quarterly',
    scheduledTime: '09:00', gracePeriodMinutes: 120,
    assigneeMode: techId ? 'employee' : 'role', assigneeUserId: techId, createdBy: ADMIN_NAME,
  });
  log(customR.ok && customR.data.success !== false, 'שגרה: ביקור תחזוקה רבעוני (בניין A)', customR.ok ? '' : JSON.stringify(customR.data));
}

// ------------------------------------------------------------------
// 8. מחיקת פקודות עבודה לפי בקשה מפורשת
async function deleteRequestedWorkOrders() {
  console.log(`\n🗑️  מחיקת פקודות עבודה: ${WORK_ORDERS_TO_DELETE.join(', ')}`);
  for (const id of WORK_ORDERS_TO_DELETE) {
    const r = await api('DELETE', `/work-orders/${id}`);
    log(r.ok && r.data.success !== false, `מחיקת פקודה #${id}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מרחיב את הנתונים של "יוסי ובניו ידי זהב"...\n');
  try {
    await resolveGroupIdAndLogin();
    await loadExistingCatalog();
    await seedCatalog();
    await loadExistingTeam();
    await seedTeam();
    await seedCustomers();
    await seedQuotes();
    await seedOrders();
    await seedWorkOrders();
    await seedRoutines();
    await deleteRequestedWorkOrders();
    console.log('\n✅ הושלם.');
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exit(1);
  }
}

main();
