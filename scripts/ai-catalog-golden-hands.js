/**
 * ai-catalog-golden-hands.js
 * בניית קטלוג עשיר אוטומטית לעסק "יוסי ובניו ידי זהב" (BC327E18) באמצעות שני מנגנונים
 * קיימים במערכת (לא ספריית חיצונית אקראית):
 *   1. POST /api/ai/generate-catalog — Gemini בונה רשימת קטלוג ריאליסטית בעברית
 *   2. POST /api/store/catalog/generate-image — חיפוש תמונה אמיתית ורלוונטית דרך
 *      Pixabay/Pexels (עם fallback ל-AI), מועלית ל-Cloudinary לכתובת קבועה
 * מנקה לגמרי את הקטלוג הקיים לפני הבנייה מחדש (לפי בקשה מפורשת) — כדי שההפרדה בין
 * "מוצרים למכירה" (productType='retail', מוצג באזור המוצרים) לבין "שירותים" (productType='service',
 * מוצג לפי לוגיקת השירותים) תהיה נקייה ועקבית, בלי שאריות מהרצות קודמות.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/ai-catalog-golden-hands.js
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';

// שתי קריאות ל-generate-catalog — אחת למוצרים (retail) ואחת לשירותים (service) —
// כדי לקבל שני סוגים נפרדים, כמו שכבר קיים בפועל בקטלוג הזה
const PROMPTS = [
  { promptText: 'עסק תחזוקה ותיקונים לבית — אינסטלציה, חשמל, מיזוג אוויר, מנעולנות ותיקוני מחשבים/סלולר. זקוק למוצרים/חלקי חילוף למכירה בחנות שלו (לא שירותי תיקון עצמם).', productType: 'retail' },
  { promptText: 'עסק תחזוקה ותיקונים לבית — אינסטלציה, חשמל, מיזוג אוויר, מנעולנות ותיקוני מחשבים/סלולר. זקוק לרשימת שירותי תיקון שהוא מציע ללקוחות (קריאות שירות בתשלום, לא מוצרים פיזיים).', productType: 'service' },
];

let TOKEN = null, GROUP_ID = null;
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}
function log(ok, label, extra) { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); }

async function main() {
  const lookup = await fetch(`${API}/storefront/${GROUP_CODE}`).then(r => r.json());
  if (!lookup.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE}`);
  GROUP_ID = lookup.groupId;
  const loginRes = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID });
  if (!loginRes.data.token) throw new Error(`התחברות נכשלה: ${JSON.stringify(loginRes.data)}`);
  TOKEN = loginRes.data.token;
  log(true, 'התחברות הצליחה', `group_id=${GROUP_ID}`);

  const catalogRes = await api('GET', `/store/catalog/${GROUP_ID}`);
  const existing = Array.isArray(catalogRes.data) ? catalogRes.data : (catalogRes.data.catalog || catalogRes.data.items || []);
  console.log(`\n🗑️  מנקה קטלוג קיים (${(existing || []).length} פריטים)...`);
  for (const item of (existing || [])) {
    const delRes = await api('DELETE', `/store/catalog/${item.id}`, { groupId: GROUP_ID });
    log(delRes.ok && delRes.data.success !== false, `נמחק: ${item.name}`, delRes.ok ? '' : JSON.stringify(delRes.data));
  }
  const existingNames = new Set();

  for (const { promptText, productType } of PROMPTS) {
    console.log(`\n🤖 יצירת רשימת ${productType === 'retail' ? 'מוצרים' : 'שירותים'} ע"י AI...`);
    const genRes = await api('POST', '/ai/generate-catalog', { promptText, type: 'BUSINESS', groupId: GROUP_ID });
    if (!genRes.ok || !genRes.data.success) { log(false, 'יצירת קטלוג AI נכשלה', JSON.stringify(genRes.data)); continue; }
    const items = genRes.data.items || [];
    log(true, `AI יצר ${items.length} פריטים`);

    for (const item of items) {
      if (existingNames.has(item.name)) { console.log(`   ↷ קיים כבר: ${item.name}`); continue; }

      // nameEn מגיע מה-AI (generate-catalog מעודכן לספק אותו) — חיפוש תמונה מדויק בלי תלות
      // בתרגום-נפילה פנימי (שכשל קודם ברגע ש-Gemini היה עמוס, והחזיר תמונות אקראיות לגמרי)
      const imgRes = await api('POST', '/store/catalog/generate-image', {
        groupId: GROUP_ID, productName: item.name, nameEn: item.nameEn || '', description: item.description || '', category: item.category || '', productType,
      });
      const imageUrl = (imgRes.ok && imgRes.data.success) ? imgRes.data.imageUrl : null;
      log(!!imageUrl, `תמונה עבור: ${item.name} (${item.nameEn || 'ללא nameEn'})`, imageUrl ? `(${imgRes.data.source})` : JSON.stringify(imgRes.data));

      const createRes = await api('POST', '/store/catalog', {
        name: item.name, nameEn: item.nameEn || '', description: item.description || '', price: item.price || 0, category: item.category || '',
        imageUrl: imageUrl || undefined, productType,
      });
      log(createRes.ok && createRes.data.success !== false, `נוסף לקטלוג: ${item.name}`, createRes.ok ? '' : JSON.stringify(createRes.data));
      existingNames.add(item.name);
    }
  }
  console.log('\n✅ הושלם.');
}

main().catch(e => { console.error('\n❌ שגיאה:', e.message); process.exit(1); });
