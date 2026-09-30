/**
 * fill-work-orders-full.js
 * מעבר שני על עסק דמו קיים (למשל אחרי seed-demo-business.js) — משייך הצעות מחיר
 * קיימות לפקודות עבודה קיימות, וממלא את כל הטאבים של כל פקודת עבודה: צוות,
 * מצרכים, ציוד, הערות, שיח פנימי, תשלום, יומן, רכש. לא יוצר פקודות עבודה/הצעות
 * חדשות — עובד על מה שכבר קיים בעסק.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BC327E18 BIZ_PASS=123456 BIZ_PHONE=0500000149 \
 *     node scripts/fill-work-orders-full.js
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BC327E18';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0500000149';
const ADMIN_NAME = process.env.BIZ_NAME || 'יוסי';

let TOKEN = null, GROUP_ID = null;

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}
function log(ok, label, extra) { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); }

async function login() {
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`);
  if (!lookup.ok || !lookup.data.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE} (status ${lookup.status})`);
  GROUP_ID = lookup.data.groupId;
  const loginRes = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID });
  if (!loginRes.ok || !loginRes.data.token) throw new Error(`התחברות נכשלה: ${loginRes.data.error}`);
  TOKEN = loginRes.data.token;
  log(true, 'התחברות הצליחה', `group_id=${GROUP_ID}`);
}

async function getTeam() {
  const r = await api('GET', `/work-orders/users/${GROUP_ID}`);
  return (r.ok && r.data.users) ? r.data.users : [];
}

async function main() {
  console.log('🚀 ממלא נתונים מלאים בפקודות עבודה קיימות...\n');
  await login();

  const woRes = await api('GET', `/work-orders/list/${GROUP_ID}`);
  const workOrders = woRes.ok ? (woRes.data.workOrders || []) : [];
  if (!workOrders.length) { console.log('⚠️  אין פקודות עבודה קיימות בעסק זה — הרץ קודם seed-demo-business.js'); return; }
  console.log(`נמצאו ${workOrders.length} פקודות עבודה`);

  const quotesRes = await api('GET', `/store/quotes/${GROUP_ID}`);
  const quotes = quotesRes.ok ? (Array.isArray(quotesRes.data) ? quotesRes.data : (quotesRes.data.quotes || [])) : [];
  const availableQuotes = quotes.filter(q => (q.status === 'quote' || q.quote_status) && q.call_type !== 'work_order');
  console.log(`נמצאו ${availableQuotes.length} הצעות מחיר זמינות לשיוך`);

  const team = await getTeam();
  const tech = team.find(u => u.employee_role_type === 'field_tech') || team[0];
  const mgr = team.find(u => u.employee_role_type === 'branch_manager') || team[0];

  // ספק לרכש (ליצור פעם אחת אם עוד לא קיים)
  await api('POST', '/suppliers', { groupId: GROUP_ID, name: 'חשמל ואינסטלציה בע"מ', category: 'חלקי חילוף', phone: '0507654321' });

  // פריט ציוד לדוגמה
  const eqRes = await api('POST', '/equipment/items', { name: 'מקדחה מקצועית', category: 'כלי עבודה', status: 'active' });
  const equipmentItemId = eqRes.ok && eqRes.data.item ? eqRes.data.item.id : null;
  log(eqRes.ok, 'פריט ציוד: מקדחה מקצועית');

  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i];
    const woLabel = wo.quote_title || wo.quote_number || `פקודה #${wo.id}`;
    console.log(`\n🧰 ${woLabel} (#${wo.id})`);

    // 1. שיוך הצעת מחיר (לפי אותו שם לקוח, אם קיים; אחרת ההצעה הפנויה הבאה בתור)
    let matchedQuote = availableQuotes.find(q => q.customer_name && wo.customer_name && q.customer_name === wo.customer_name) || availableQuotes.shift();
    if (matchedQuote) {
      const linkRes = await api('POST', `/work-orders/${wo.id}/quotes`, { quoteId: matchedQuote.id, userName: ADMIN_NAME });
      log(linkRes.ok && linkRes.data.success !== false, `שיוך הצעת מחיר: ${matchedQuote.quote_title || matchedQuote.quote_number || ('#' + matchedQuote.id)}`, linkRes.ok ? '' : JSON.stringify(linkRes.data));
      availableQuotes.splice(availableQuotes.indexOf(matchedQuote), 1);
    } else {
      console.log('   ↷ אין עוד הצעות מחיר פנויות לשיוך');
    }

    // 2. צוות — שיוך טכנאי (אם עוד לא משויך)
    if (tech) {
      const assignRes = await api('POST', `/work-orders/${wo.id}/assignees`, { userId: tech.id, userName: tech.name, assignedBy: ADMIN_NAME, roleLabel: 'טכנאי אחראי' });
      log(assignRes.ok && assignRes.data.success !== false, `שיוך צוות: ${tech.name}`);
    }

    // 3. מצרכים — שריון פריט מלאי (ללא pantryId ספציפי — עדיין נרשם כפריט תחת הפקודה)
    const invRes = await api('POST', `/work-orders/${wo.id}/inventory`, { itemName: 'אטמים לברז (סט)', neededQty: 2, unitPrice: 12, reservedBy: ADMIN_NAME });
    log(invRes.ok && invRes.data.success !== false, 'שיוך מצרך: אטמים לברז (סט)');

    // 4. ציוד — שיוך המקדחה לתאריך קרוב
    if (equipmentItemId) {
      const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      const eqReserveRes = await api('POST', `/work-orders/${wo.id}/equipment`, {
        equipmentItemId, eventDate: inDays(1 + i), startTime: '10:00', durationMinutes: 120, reservedBy: ADMIN_NAME, cost: 0,
      });
      log(eqReserveRes.ok && eqReserveRes.data.success !== false, 'שיוך ציוד: מקדחה מקצועית', eqReserveRes.ok ? '' : JSON.stringify(eqReserveRes.data));
    }

    // 5. הערות
    const notesRes = await api('PUT', `/work-orders/${wo.id}/notes`, { notes: 'יש לוודא זמינות חניה בכתובת הלקוח לפני ההגעה.', updatedBy: ADMIN_NAME });
    log(notesRes.ok && notesRes.data.success !== false, 'עדכון הערות פנימיות');

    // 6. תשלום — תחנה ידנית (מקדמה)
    const totalForPayment = matchedQuote ? parseFloat(matchedQuote.total_amount || 0) : parseFloat(wo.total_amount || 0);
    if (totalForPayment > 0) {
      const payRes = await api('POST', `/work-orders/${wo.id}/payments`, {
        milestoneName: 'מקדמה', amount: parseFloat((totalForPayment * 0.3).toFixed(2)), paymentMethod: 'cash', totalAmount: totalForPayment,
      });
      log(payRes.ok && payRes.data.success !== false, 'תחנת תשלום: מקדמה (30%)');
    } else {
      console.log('   ↷ אין סכום הצעה זמין — מדלג על תחנת תשלום');
    }

    // 7. יומן — זימון ביקור
    const calDate = new Date(); calDate.setDate(calDate.getDate() + 2 + i);
    const calRes = await api('POST', `/work-orders/${wo.id}/calendar`, {
      groupId: GROUP_ID, title: woLabel, eventDate: calDate.toISOString().slice(0, 10), startTime: '11:00',
      customerName: wo.customer_name || '', address: '', assigneeIds: tech ? [tech.id] : [], notes: '', durationMinutes: 90,
    });
    log(calRes.ok && calRes.data.success !== false, 'זימון ביומן');

    // 8. שיח פנימי
    const msgRes = await api('POST', `/work-orders/${wo.id}/messages`, { userId: null, userName: ADMIN_NAME, message: `בואו נסגור את ${woLabel} השבוע.` });
    log(msgRes.ok && msgRes.data.success !== false, 'הודעת שיח פנימי');

    // 9. רכש
    const poRes = await api('POST', `/work-orders/${wo.id}/purchase-orders`, {
      groupId: GROUP_ID, supplierName: 'חשמל ואינסטלציה בע"מ',
      items: [{ item_name: 'ברז מטבח סטנדרטי', unit_price: 95, quantity: 1 }], notes: 'להזמין בהקדם', userName: ADMIN_NAME,
    });
    log(poRes.ok && poRes.data.success !== false, 'הזמנת רכש');
  }

  console.log('\n✅ הושלם! כל פקודות העבודה מולאו בכל הטאבים.');
}

main().catch(e => { console.error('\n❌ שגיאה:', e.message); process.exit(1); });
