/**
 * apply-templates-golden-hands.js
 * השלמה חד-פעמית: מחיל שגרות מספריית התבניות על האתר "בניין A" שכבר נוצר
 * ב-expand-golden-hands-full.js (שם נכשל השלב הזה בגלל באג בבקשת ה-GET).
 * לא נוגע בשום דבר אחר.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/apply-templates-golden-hands.js
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_NAME = process.env.BIZ_NAME || 'יוסי';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';
const SITE_NAME = process.env.SITE_NAME || 'חברת ניהול נכסי צפון — בניין A';

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

  const sitesRes = await api('GET', `/routines/${GROUP_ID}/sites`);
  const site = (sitesRes.data.sites || []).find(s => s.name === SITE_NAME);
  if (!site) throw new Error(`לא נמצא אתר בשם "${SITE_NAME}" — ודא שהרצת קודם את expand-golden-hands-full.js`);
  log(true, `אתר נמצא: ${site.name}`, `id=${site.id}`);

  const templatesR = await api('GET', `/routines/${GROUP_ID}/templates`);
  const keys = (templatesR.data.templates || []).slice(0, 5).map(t => t.key);
  if (!keys.length) { log(false, 'ספריית תבניות ריקה או שגיאה', JSON.stringify(templatesR.data)); return; }

  const applyR = await api('POST', `/routines/${GROUP_ID}/templates/apply`, { templateKeys: keys, siteId: site.id, createdBy: ADMIN_NAME });
  log(applyR.ok && applyR.data.success !== false, `שגרות מתבניות (${keys.length})`, applyR.ok ? '' : JSON.stringify(applyR.data));
  console.log('\n✅ הושלם.');
}

main().catch(e => { console.error('\n❌ שגיאה:', e.message); process.exit(1); });
