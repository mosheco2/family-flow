/**
 * integration.js — בדיקות זרימה קריטיות: עסק ↔ לקוח
 *
 * הרצה:
 *   node test/integration.js
 *   BASE_URL=http://localhost:3000 node test/integration.js
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

function diag(label, value) {
  const display = value === null ? 'NULL' : value === undefined ? 'undefined' : JSON.stringify(value);
  console.log(`       🔍  ${label}: ${display}`);
}

// ─── state shared between tests ───────────────────────────────────────────────

const state = {};

// ─── tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  בדיקות אינטגרציה — זרימת עסק ↔ לקוח');
  console.log(`  ${BASE_URL}`);
  console.log('══════════════════════════════════════════════\n');

  // ── 0. קישוריות + עמודות alert_notifications ────────────────────────────────
  await run('0. קישוריות לשרת', async () => {
    const res = await fetch(`${BASE_URL}/api/alerts/notifications?groupId=0&limit=1`);
    assert(res.status < 500, `שרת החזיר ${res.status}`);
  });

  if (!results[0]?.ok) {
    console.log('\n  ⛔  אין קישוריות לשרת — שאר הבדיקות מדולגות');
    console.log('  הרץ: BASE_URL=http://localhost:3000 node test/integration.js\n');
    printSummary(); process.exit(1);
  }

  // ── אבחון א: עמודות alert_notifications ─────────────────────────────────────
  console.log('\n  ── אבחון א: עמודות טבלת alert_notifications ──');
  try {
    const cols = await apiGet('/api/debug/notification-columns');
    console.log(`       עמודות: ${cols.map(c => `${c.name}(${c.type})`).join(', ')}`);
    const hasType        = cols.some(c => c.name === 'type');
    const hasTriggerType = cols.some(c => c.name === 'trigger_type');
    const hasRefKey      = cols.some(c => c.name === 'reference_key');
    console.log(`       trigger_type קיים: ${hasTriggerType}`);
    console.log(`       type קיים:         ${hasType}`);
    console.log(`       reference_key קיים: ${hasRefKey}`);
    state.hasType        = hasType;
    state.hasTriggerType = hasTriggerType;
  } catch(e) {
    console.log(`       ⚠️  endpoint debug לא זמין: ${e.message}`);
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
    assert(data.item?.id, 'חסר item.id בתגובה');
    state.catalogItemId = data.item.id;
  });

  // ── 3. יצירת לקוח חבר ───────────────────────────────────────────────────────
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
    state.memberGroupId = data.member_group_id;
    state.memberCode    = data.group_code;
    state.memberPass    = data.password;
    // ─── אבחון: האם member_group_id נראה תקין? ────────────────────────────
    diag('member_group_id שנוצר', data.member_group_id);
    diag('member group_code',     data.group_code);
    diag('link_status',           data.link_status);
  });

  // ── 4. יצירת הצעת מחיר ─────────────────────────────────────────────────────
  await run('4. יצירת הצעת מחיר ללקוח', async () => {
    assert(state.bizGroupId,    'נדרש bizGroupId מבדיקה 1');
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');

    // אבחון ג: האם familyGroupId נשלח בbody?
    const body = {
      groupId:       state.bizGroupId,
      customerName:  'לקוח בדיקה',
      customerPhone: '0501234567',
      totalAmount:   55,
      items:         [{ name: 'שניצל בדיקה', quantity: 1, price: 55 }],
      notes:         'הצעת בדיקה',
      familyGroupId: state.memberGroupId,   // ← זה שנשלח
    };
    diag('familyGroupId שנשלח ב-body', body.familyGroupId);

    const data = await apiPost('/api/store/quotes', body);
    assert(data.quoteId,     'חסר quoteId');
    assert(data.quoteNumber, 'חסר quoteNumber');
    state.quoteId     = data.quoteId;
    state.quoteNumber = data.quoteNumber;
    diag('quoteId שנוצר', data.quoteId);
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

  // ── אבחון ב: מצב store_orders אחרי convert ──────────────────────────────────
  console.log('\n  ── אבחון ב: store_orders אחרי convert ──');
  try {
    const order = await apiGet(`/api/debug/order/${state.workOrderId}`);
    diag('family_group_id', order.family_group_id ?? null);
    diag('quote_status',    order.quote_status);
    diag('call_type',       order.call_type);
    diag('status',          order.status);
    if (!order.family_group_id) {
      console.log(`       ⚠️  family_group_id=NULL — ה-INSERT של /api/store/quotes לא שומר familyGroupId!`);
      console.log(`       ⚠️  notifications לא יישלחו ללקוח — תיקון נדרש ב-POST /api/store/quotes`);
    }
    state.orderHasFamilyGroup = !!order.family_group_id;
  } catch(e) {
    console.log(`       ⚠️  לא ניתן לשלוף פרטי order: ${e.message}`);
  }

  // ── אבחון ג: notifications קיימות לפני בדיקה 6 ──────────────────────────────
  console.log('\n  ── אבחון ג: notifications קיימות ללקוח לפני בדיקה 6 ──');
  try {
    const notifs = await apiGet(`/api/debug/notifications/${state.memberGroupId}`);
    if (notifs.length === 0) {
      console.log('       אין notifications כלל ל-member_group_id זה');
    } else {
      notifs.forEach(n =>
        console.log(`       • ${n.trigger_type || '(ללא trigger_type)'}: ${(n.message||'').slice(0,50)}`)
      );
    }
  } catch(e) {
    console.log(`       ⚠️  שגיאה: ${e.message}`);
  }
  console.log('');

  // ── 6. notification ללקוח על יצירת פקודת עבודה ─────────────────────────────
  await run('6. notification ללקוח — work_order_created', async () => {
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');
    await new Promise(r => setTimeout(r, 500));
    const rows = await apiGet(`/api/alerts/notifications?groupId=${state.memberGroupId}&limit=20`);
    assert(Array.isArray(rows), 'תגובה לא מערך');
    const found = rows.find(n =>
      (n.trigger_type === 'work_order_created' || n.type === 'work_order_created') &&
      String(n.group_id) === String(state.memberGroupId)
    );
    const dump = rows.map(n => `${n.trigger_type || n.type || '?'}`).join(', ') || 'אין';
    assert(found, `לא נמצא work_order_created. קיימים: [${dump}]`);
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

  // ── אבחון ד: notifications אחרי שינוי סטטוס ────────────────────────────────
  console.log('\n  ── אבחון ד: notifications אחרי שינוי סטטוס ──');
  await new Promise(r => setTimeout(r, 500));
  try {
    const notifs = await apiGet(`/api/debug/notifications/${state.memberGroupId}`);
    if (notifs.length === 0) {
      console.log('       אין notifications כלל — family_group_id בוודאי NULL');
    } else {
      notifs.forEach(n =>
        console.log(`       • ${n.trigger_type || '(?)'}: ${(n.message||'').slice(0,60)}`)
      );
    }
  } catch(e) {
    console.log(`       ⚠️  שגיאה: ${e.message}`);
  }
  console.log('');

  // ── 8. notification ללקוח על שינוי סטטוס ───────────────────────────────────
  await run('8. notification ללקוח — work_order_status (הושלם)', async () => {
    assert(state.memberGroupId, 'נדרש memberGroupId מבדיקה 3');
    const rows = await apiGet(`/api/alerts/notifications?groupId=${state.memberGroupId}&limit=20`);
    assert(Array.isArray(rows), 'תגובה לא מערך');
    const found = rows.find(n =>
      (n.trigger_type === 'work_order_status' || n.type === 'work_order_status') &&
      String(n.group_id) === String(state.memberGroupId) &&
      (n.message || '').includes('הושלם')
    );
    const dump = rows.map(n => `${n.trigger_type||n.type||'?'}:${(n.message||'').slice(0,25)}`).join(' | ') || 'אין';
    assert(found, `לא נמצא work_order_status+הושלם. קיימים: [${dump}]`);
  });

  printSummary();
}

function printSummary() {
  const passed  = results.filter(r => r.ok).length;
  const total   = results.length;
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  console.log('══════════════════════════════════════════════');
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
