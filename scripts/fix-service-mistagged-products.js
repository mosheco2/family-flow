/**
 * fix-service-mistagged-products.js
 * תיקון חד-פעמי: מוצרים אמיתיים (product_type='retail') שהוסטו בטעות ל-'service'
 * ע"י מיגרציית שרת שגויה שרצה בכל אתחול (הוסרה מ-server.js). מריצים פעם אחת ידנית.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PASS=123456 BIZ_PHONE=0500000149 \
 *     node scripts/fix-service-mistagged-products.js
 *
 * מציין אילו שמות מוצרים אמורים להיות retail (PRODUCT_NAMES) — כל שאר הפריטים נשארים כמו שהם.
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0500000149';

const PRODUCT_NAMES = [
  'קיט אטמים אוניברסלי לברז',
  'ראש מקלחת חסכוני',
  'שקע חשמל דו-קוטבי',
  'גוף חימום לדוד שמש 3000W',
  'ניקוז סיפון למטבח',
];

let TOKEN = null, GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`, undefined, false);
  if (!lookup.ok || !lookup.data.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE}`);
  GROUP_ID = lookup.data.groupId;
  console.log(`🔎 נמצא group_id=${GROUP_ID}`);

  const login = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID }, false);
  if (!login.ok || !login.data.token) throw new Error(`התחברות נכשלה: ${login.data.error}`);
  TOKEN = login.data.token;
  console.log('✅ התחברות הצליחה');

  const catRes = await api('GET', `/store/catalog/${GROUP_ID}`, undefined, false);
  const catalog = Array.isArray(catRes.data) ? catRes.data : (catRes.data.catalog || catRes.data.items || []);
  if (!Array.isArray(catalog)) throw new Error('לא הצלחתי לקרוא את הקטלוג — בדוק ידנית');

  for (const name of PRODUCT_NAMES) {
    const item = catalog.find(i => i.name === name);
    if (!item) { console.log(`⚠️  לא נמצא: ${name}`); continue; }
    if (item.product_type === 'retail') { console.log(`↷ כבר תקין: ${name}`); continue; }
    const r = await api('PUT', `/store/catalog/${item.id}`, {
      name: item.name, description: item.description, price: item.price, category: item.category,
      optionsText: item.options_text, badgeText: item.badge_text, badgeColor: item.badge_color,
      productType: 'retail', longDescription: item.long_description, sku: item.sku,
      nameEn: item.name_en, descriptionEn: item.description_en, categoryEn: item.category_en,
    });
    console.log(`${r.ok && r.data.success !== false ? '✅' : '❌'} תוקן ל-retail: ${name}`);
  }
  console.log('\n✅ הושלם.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
