/**
 * integration.js — בדיקות זרימה קריטיות: עסק ↔ לקוח
 *
 * הרצה:
 *   node test/integration.js                          # ברירת מחדל: production
 *   BASE_URL=http://localhost:3000 node test/integration.js   # לשרת מקומי
 *
 * תלויות: אפס (fetch בלבד — Node 18+)
 */

const BASE_URL = process.env.BASE_URL || 'https://oneflowlife.co.il';

// ─── utils ────────────────────────────────────────────────────────────────────

const results = [];

async function run(label, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`  ✅  ${label}  (${ms}ms)`);
    results.push({ label, ok: true, ms });
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`  ❌  ${label}  (${ms}ms)`);
    console.log(`       ${err.message}`);
    results.push({ label, ok: false, ms, error: err.message });
  }
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status} — תגובה לא JSON`); }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} on GET ${path}`);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status} — תגובה לא JSON`); }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── state shared between tests ───────────────────────────────────────────────

const state = {};

// ─── tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  בדיקות אינטגרציה — זרימת עסק ↔ לקוח');
  console.log(`  ${BASE_URL}`);
  console.log('══════════════════════════════════════════════\n');

  // ── 0. בדיקת קישוריות לשרת ──────────────────────────────────────────────────
  await run('0. בדיקת קישוריות לשרת', async () => {
    const res = await fetch(`${BASE_URL}/api/alerts/notifications?groupId=0&limit=1`);
    assert(res.status < 500, `שרת החזיר ${res.status}`);
  });

  // בדיקות 1–8 תרוצנה רק אם קישוריות עברה
  if (!results[0]?.ok) {
    console.log('\n  ⛔  אין קישוריות לשרת — שאר הבדיקות מדולגות\n');
    console.log('  הרץ: BASE_URL=http://localhost:3000 node test/integration.js\n');
    printSummary();
    process.exit(1);
  }

  // ── 1. יצירת עסק חדש (מסעדה) ───────────────────────────────────────────────
  await run('1. יצירת עסק חדש — מסעדה', async () => {
    const ts = Date.now();
    const data = await apiPost('/api/groups', {
      type:         'BUSINESS',
      groupName:    `מסעדת בדיקה ${ts}`,
      adminEmail:   `test_biz_${ts}@integration.test`,
      password:     'Test1234!',
      firstName:    'בדיקה',
      lastName:     'עסק',
      phone:        `05${String(ts).slice(-8)}`,
      businessType: 'restaurant',
    });
    assert(data.group?.id,         'חסר group.id בתגובה');
    assert(data.group?.group_code, 'חסר group_code בתגובה');
    state.bizGroupId   = data.group.id;
    state.bizGroupCode = data.group.group_code;
    state.bizNickname  = data.user?.nickname || 'בדיקה עסק';
  });

  // ── 2. הוספת מוצר לקטלוג ────────────────────────────────────────────────────
  await run('2. הוספת מוצר לקטלוג', async () => {
    assert(state.bizGroupId, 'נדרש bizGroupId מבדיקה 1');
    const data = await apiPost('/api/store/catalog', {
      groupId:     state.bizGroupId,
      name:        'שניצל בדיקה',
      description: 'שניצל לבדיקת אינטגרציה',
      price:       55,
      category:    'עיקריות',
      productType: 'food',
    });
    assert(data.item?.id,    'חסר item.id בתגובה');
    assert(data.item?.name,  'חסר item.name בתגובה');
    state.catalogItemId = data.item.id;
  });

  // ── 3. יצירת לקוח חבר (member_type='member') ───────────────────────────────
  await run('3. יצירת לקוח חבר', async () => {
    assert(state.bizGroupId, 'נדרש bizGroupId מבדיקה 1');
    const ts = Date.now();
    const data = await apiPost('/api/member/create-for-business', {
      business_group_id: state.bizGroupId,
      name:              `לקוח בדיקה ${ts}`,
      phone:             `05${String(ts).slice(-8)}`,
      admin_name:        state.bizNickname,
    });
    assert(data.success,          'success=false');
    assert(data.member_group_id,  'חסר member_group_id');
    assert(data.is_new === true,   'לקוח אמור להיות חדש');
    assert(data.group_code,       'חסר group_code ללקוח');
    assert(data.link_status === 'pending', `link_status צפוי pending, קיבלנו: ${data.link_status}`);
    state.memberGroupId = data.member_group_id;
    state.memberCode    = data.group_code;
    state.memberPass    = data.password;
  });

  // ── 4. יצירת הצעת מחיר ─────────────────────────────────────────────────────
  await run('4. יצירת הצעת מחיר ללקוח', async () => {
    assert(state.bizGroupId,    'נדרש bizGroupId מבדיקה 1');
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');
    const data = await apiPost('/api/store/quotes', {
      groupId:       state.bizGroupId,
      customerName:  'לקוח בדיקה',
      customerPhone: '0501234567',
      totalAmount:   55,
      items:         [{ name: 'שניצל בדיקה', quantity: 1, price: 55 }],
      notes:         'הצעת בדיקה',
      familyGroupId: state.memberGroupId,
    });
    assert(data.quoteId,     'חסר quoteId');
    assert(data.quoteNumber, 'חסר quoteNumber');
    state.quoteId     = data.quoteId;
    state.quoteNumber = data.quoteNumber;
  });

  // ── 5. המרת הצעה → פקודת עבודה ─────────────────────────────────────────────
  await run('5. המרה לפקודת עבודה (convert)', async () => {
    assert(state.quoteId, 'נדרש quoteId מבדיקה 4');
    const data = await apiPost(`/api/work-orders/convert/${state.quoteId}`, {
      userName: state.bizNickname,
    });
    assert(data.success,     'success=false');
    assert(data.workOrderId, 'חסר workOrderId');
    state.workOrderId = data.workOrderId;
  });

  // ── 6. notification ללקוח על יצירת פקודת עבודה ─────────────────────────────
  await run('6. notification ללקוח — work_order_created', async () => {
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');
    // המתנה קצרה לייצוב DB
    await new Promise(r => setTimeout(r, 500));
    const rows = await apiGet(`/api/alerts/notifications?groupId=${state.memberGroupId}&limit=20`);
    assert(Array.isArray(rows), 'תגובה לא מערך');
    const found = rows.find(n =>
      (n.trigger_type === 'work_order_created' || n.type === 'work_order_created') &&
      String(n.group_id) === String(state.memberGroupId)
    );
    const dump = rows.map(n => `${n.trigger_type || n.type}`).join(', ') || 'אין';
    assert(found, `לא נמצא notification מסוג work_order_created. קיימים: [${dump}]`);
  });

  // ── 7. שינוי סטטוס פקודת עבודה → completed ──────────────────────────────────
  await run('7. שינוי סטטוס פקודה → completed', async () => {
    assert(state.workOrderId, 'נדרש workOrderId מבדיקה 5');
    const data = await apiPut(`/api/work-orders/${state.workOrderId}/status`, {
      status:   'completed',
      userName: state.bizNickname,
    });
    assert(data.success, 'success=false');
  });

  // ── 8. notification ללקוח על שינוי סטטוס ───────────────────────────────────
  await run('8. notification ללקוח — work_order_status (הושלם)', async () => {
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');
    await new Promise(r => setTimeout(r, 500));
    const rows = await apiGet(`/api/alerts/notifications?groupId=${state.memberGroupId}&limit=20`);
    assert(Array.isArray(rows), 'תגובה לא מערך');
    const found = rows.find(n =>
      (n.trigger_type === 'work_order_status' || n.type === 'work_order_status') &&
      String(n.group_id) === String(state.memberGroupId) &&
      (n.message || '').includes('הושלם')
    );
    const dump = rows.map(n => `${n.trigger_type || n.type}:${(n.message || '').slice(0, 30)}`).join(' | ') || 'אין';
    assert(found, `לא נמצא notification work_order_status עם "הושלם". קיימים: [${dump}]`);
  });

  printSummary();
}

function printSummary() {
  const passed  = results.filter(r => r.ok).length;
  const total   = results.length;
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  console.log('\n══════════════════════════════════════════════');
  console.log(`  עברו ${passed}/${total} בדיקות  (${totalMs}ms סה"כ)`);
  if (passed < total) {
    console.log('\n  נכשלו:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`    ❌  ${r.label}`);
      console.log(`         ${r.error}`);
    });
  }
  console.log('══════════════════════════════════════════════\n');
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\nשגיאה קריטית:', err.message);
  process.exit(1);
});
