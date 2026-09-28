// סקריפט הזנת נתוני דמו מלאים לעסק "המספרה של וויווי" (סוג עסק: יופי) בכל הפרמטרים הקיימים במערכת.
// דורש Node.js 18+ (fetch מובנה). הרץ עם:  node scripts/seed_vivi_beauty.js
// אפשר לשנות את כתובת השרת עם משתנה סביבה: BASE_URL=https://weflowz.co.il node scripts/seed_vivi_beauty.js

const BASE_URL = process.env.BASE_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;

const CREDS = {
    groupCode: 'B16631FE',
    nickname: 'ששון',
    password: '123456',
};

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data };
}

function log(label, result) {
    if (result.ok && (result.data?.success !== false) && !result.data?.error) {
        console.log(`✅ ${label}`);
    } else {
        console.log(`❌ ${label} — status ${result.status} — ${JSON.stringify(result.data)}`);
    }
    return result;
}

function isoAt(daysFromToday, hour, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString().slice(0, 19);
}

function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

async function main() {
    console.log(`מתחבר לעסק "${CREDS.nickname}" (קוד ${CREDS.groupCode})...`);
    const loginRes = await api('POST', '/login', CREDS);
    if (!loginRes.ok || !loginRes.data?.success) {
        console.log('❌ ההתחברות נכשלה — בדוק את פרטי ההתחברות / כתובת השרת.', loginRes.data);
        return;
    }
    TOKEN = loginRes.data.token;
    GROUP_ID = loginRes.data.group.id;
    console.log(`✅ התחברות הצליחה. groupId=${GROUP_ID}\n`);

    // ===== 1. מטפלות/ספרים (Practitioners) =====
    console.log('--- מטפלות/ספרים ---');
    const practitionerDefs = [
        { display_name: 'ויווי כהן', tier: 'senior', color_hex: '#ec4899', specializations: ['תספורת', 'צבע'], commission_rate_svc: 35, commission_rate_retail: 15, work_days: [0,1,2,3,4], slot_minutes: 45 },
        { display_name: 'שרון לוי', tier: 'standard', color_hex: '#8b5cf6', specializations: ['מניקור', 'פדיקור'], commission_rate_svc: 30, commission_rate_retail: 10, work_days: [0,1,2,3,4,5], slot_minutes: 30 },
        { display_name: 'דניאל אזולאי', tier: 'junior', color_hex: '#06b6d4', specializations: ['החלקות', 'טיפולי פנים'], commission_rate_svc: 25, commission_rate_retail: 10, work_days: [1,2,3,4], slot_minutes: 60 },
    ];
    const practitionerIds = [];
    for (const p of practitionerDefs) {
        const r = log(`מטפלת: ${p.display_name}`, await api('POST', `/beauty/${GROUP_ID}/practitioners`, p));
        if (r.data?.id) practitionerIds.push(r.data.id);
    }

    // ===== 2. משאבים (חדרים/כיסאות) =====
    console.log('\n--- משאבים ---');
    const resourceDefs = [
        { name: 'כיסא 1', resource_type: 'chair', color_hex: '#f472b6' },
        { name: 'כיסא 2', resource_type: 'chair', color_hex: '#a78bfa' },
        { name: 'חדר טיפולים', resource_type: 'room', color_hex: '#38bdf8' },
    ];
    const resourceIds = [];
    for (const r0 of resourceDefs) {
        const r = log(`משאב: ${r0.name}`, await api('POST', `/beauty/${GROUP_ID}/resources`, r0));
        if (r.data?.id) resourceIds.push(r.data.id);
    }

    // ===== 3. קטלוג שירותים =====
    console.log('\n--- קטלוג שירותים ---');
    const serviceDefs = [
        { name: 'תספורת נשים', category: 'שיער', duration_minutes: 45, price: 150, color_hex: '#ec4899' },
        { name: 'צבע שיער', category: 'שיער', duration_minutes: 90, price: 320, color_hex: '#db2777', requires_patch_test: true },
        { name: 'מניקור ג\'ל', category: 'ציפורניים', duration_minutes: 45, price: 130, color_hex: '#a78bfa' },
        { name: 'פדיקור רפואי', category: 'ציפורניים', duration_minutes: 50, price: 160, color_hex: '#8b5cf6' },
        { name: 'טיפול פנים', category: 'קוסמטיקה', duration_minutes: 60, price: 220, color_hex: '#06b6d4' },
        { name: 'החלקת קרטין', category: 'שיער', duration_minutes: 150, price: 650, color_hex: '#0ea5e9', requires_patch_test: true },
    ];
    const serviceIds = [];
    for (const s of serviceDefs) {
        const r = log(`שירות: ${s.name}`, await api('POST', `/beauty/${GROUP_ID}/services`, s));
        if (r.data?.id) serviceIds.push(r.data.id);
    }

    // ===== 4. מסלולי מנוי (חבילות) =====
    console.log('\n--- מסלולי מנוי ---');
    const subTypeDefs = [
        { name: 'חבילת מניקור (5 טיפולים)', sessions_count: 5, price: 550, validity_days: 180, service_ids: serviceIds[2] ? [serviceIds[2]] : [] },
        { name: 'חבילת טיפולי פנים (4 טיפולים)', sessions_count: 4, price: 750, validity_days: 365, service_ids: serviceIds[4] ? [serviceIds[4]] : [] },
    ];
    const subTypeIds = [];
    for (const st of subTypeDefs) {
        const r = log(`מסלול מנוי: ${st.name}`, await api('POST', `/beauty/${GROUP_ID}/subscription-types`, st));
        if (r.data?.id) subTypeIds.push(r.data.id);
    }

    // ===== 5. כרטיסי לקוחות =====
    console.log('\n--- לקוחות ---');
    const clientDefs = [
        { client_name: 'מאיה בן דוד', client_phone: '0541111111', client_email: 'maya@example.com', skin_type: 'רגיל', hair_type: 'מתולתל' },
        { client_name: 'רותם שגיא', client_phone: '0542222222', client_email: 'rotem@example.com', hair_type: 'ישר' },
        { client_name: 'ליאור כספי', client_phone: '0543333333', skin_type: 'שמן' },
        { client_name: 'נטע פרידמן', client_phone: '0544444444', client_email: 'neta@example.com' },
        { client_name: 'עומר וקנין', client_phone: '0545555555' },
    ];
    const clientIds = [];
    for (const c of clientDefs) {
        const r = log(`לקוח/ה: ${c.client_name}`, await api('POST', `/beauty/${GROUP_ID}/clients`, c));
        if (r.data?.id) clientIds.push(r.data.id);
    }

    // מנוי פעיל ללקוחה ראשונה
    if (clientIds[0] && subTypeIds[0]) {
        log('רכישת מסלול מנוי ללקוחה', await api('POST', `/beauty/${GROUP_ID}/client-subscriptions`, {
            client_record_id: clientIds[0], subscription_type_id: subTypeIds[0], sessions_total: 5, subscription_name: subTypeDefs[0].name, validity_days: 180,
        }));
    }

    // ===== 6. מלאי (מקצועי + קמעונאי) =====
    console.log('\n--- מלאי ---');
    const inventoryDefs = [
        { product_name: 'צבע שיער בלונד', brand: 'Wella', inventory_type: 'professional', category: 'צבע', unit: 'gram', stock_qty: 500, reorder_threshold: 100, cost_price: 0.3, retail_price: 0 },
        { product_name: 'שמפו מקצועי', brand: "L'Oreal", inventory_type: 'retail', category: 'טיפוח שיער', unit: 'unit', stock_qty: 25, reorder_threshold: 5, cost_price: 35, retail_price: 79 },
        { product_name: 'לק ג\'ל אדום', brand: 'OPI', inventory_type: 'retail', category: 'ציפורניים', unit: 'unit', stock_qty: 15, reorder_threshold: 3, cost_price: 20, retail_price: 55 },
        { product_name: 'קרם פנים יומי', brand: 'Dermalogica', inventory_type: 'retail', category: 'קוסמטיקה', unit: 'unit', stock_qty: 10, reorder_threshold: 2, cost_price: 60, retail_price: 145 },
    ];
    const inventoryIds = [];
    for (const inv of inventoryDefs) {
        const r = log(`מלאי: ${inv.product_name}`, await api('POST', `/beauty/${GROUP_ID}/inventory`, inv));
        if (r.data?.id) inventoryIds.push(r.data.id);
    }

    // מכירת פריט קמעונאי — יוצר הכנסה אוטומטית
    if (inventoryIds[1]) {
        log('מכירת שמפו ללקוחה', await api('POST', `/beauty/${GROUP_ID}/inventory/${inventoryIds[1]}/sell`, { qty: 1 }));
    }

    // ===== 7. תורים (עתידיים + היסטוריים שהושלמו) =====
    console.log('\n--- תורים ---');
    // תור עתידי (מחר) — סטטוס confirmed
    if (clientIds[0] && practitionerIds[0] && resourceIds[0] && serviceIds[0]) {
        const start = isoAt(1, 10, 0);
        const end = isoAt(1, 10, 45);
        log('תור עתידי: תספורת למאיה', await api('POST', `/beauty/${GROUP_ID}/appointments`, {
            booking_source: 'biz', client_name: clientDefs[0].client_name, client_phone: clientDefs[0].client_phone,
            client_type: 'external', notes: 'תספורת רגילה',
            segments: [{ segment_order: 1, segment_type: 'active', service_name: serviceDefs[0].name, service_catalog_id: serviceIds[0], practitioner_id: practitionerIds[0], resource_id: resourceIds[0], start_time: start, end_time: end, duration_minutes: 45, price: serviceDefs[0].price }],
        }));
    }

    // תור עתידי נוסף — מחרתיים
    if (clientIds[1] && practitionerIds[1] && resourceIds[1] && serviceIds[2]) {
        const start = isoAt(2, 12, 0);
        const end = isoAt(2, 12, 45);
        log('תור עתידי: מניקור לרותם', await api('POST', `/beauty/${GROUP_ID}/appointments`, {
            booking_source: 'biz', client_name: clientDefs[1].client_name, client_phone: clientDefs[1].client_phone,
            client_type: 'external',
            segments: [{ segment_order: 1, segment_type: 'active', service_name: serviceDefs[2].name, service_catalog_id: serviceIds[2], practitioner_id: practitionerIds[1], resource_id: resourceIds[1], start_time: start, end_time: end, duration_minutes: 45, price: serviceDefs[2].price }],
        }));
    }

    // תור היסטורי (אתמול) שיושלם ברגע זה — כדי ליצור הכנסה, עמלה והיסטוריית ביקור אמיתית
    if (clientIds[2] && practitionerIds[0] && resourceIds[0] && serviceIds[4]) {
        const start = isoAt(-1, 15, 0);
        const end = isoAt(-1, 16, 0);
        const apptRes = log('תור עבר: טיפול פנים לליאור', await api('POST', `/beauty/${GROUP_ID}/appointments`, {
            booking_source: 'biz', client_name: clientDefs[2].client_name, client_phone: clientDefs[2].client_phone,
            client_type: 'external',
            segments: [{ segment_order: 1, segment_type: 'active', service_name: serviceDefs[4].name, service_catalog_id: serviceIds[4], practitioner_id: practitionerIds[0], resource_id: resourceIds[0], start_time: start, end_time: end, duration_minutes: 60, price: serviceDefs[4].price }],
        }));
        if (apptRes.data?.id) {
            log('השלמת תור (יוצר הכנסה + עמלה)', await api('POST', `/beauty/${GROUP_ID}/appointments/${apptRes.data.id}/complete`, {}));
        }
    }

    // תור נוסף שהושלם — עם החלקה (מחיר גבוה, בדיקת עור נדרשת) לנטע
    if (clientIds[3] && practitionerIds[2] && resourceIds[2] && serviceIds[5]) {
        // מסמנים שבדיקת עור עברה בהצלחה כדי שהתור יעבור בלי חסימה
        await api('PATCH', `/beauty/${GROUP_ID}/clients/${clientIds[3]}`, { patch_test_status: 'passed', patch_test_date: daysFromNow(-30), patch_test_expires_at: daysFromNow(300) });
        const start = isoAt(-3, 9, 0);
        const end = isoAt(-3, 11, 30);
        const apptRes = log('תור עבר: החלקה לנטע', await api('POST', `/beauty/${GROUP_ID}/appointments`, {
            booking_source: 'biz', client_name: clientDefs[3].client_name, client_phone: clientDefs[3].client_phone,
            client_type: 'external',
            segments: [{ segment_order: 1, segment_type: 'active', service_name: serviceDefs[5].name, service_catalog_id: serviceIds[5], practitioner_id: practitionerIds[2], resource_id: resourceIds[2], start_time: start, end_time: end, duration_minutes: 150, price: serviceDefs[5].price }],
        }));
        if (apptRes.data?.id) {
            log('השלמת תור (יוצר הכנסה + עמלה)', await api('POST', `/beauty/${GROUP_ID}/appointments/${apptRes.data.id}/complete`, {}));
        }
    }

    // תור שיסומן כ-no-show
    if (clientIds[4] && practitionerIds[1] && resourceIds[1] && serviceIds[3]) {
        const start = isoAt(-2, 11, 0);
        const end = isoAt(-2, 11, 50);
        const apptRes = log('תור עבר: פדיקור לעומר (יסומן לא הגיע)', await api('POST', `/beauty/${GROUP_ID}/appointments`, {
            booking_source: 'biz', client_name: clientDefs[4].client_name, client_phone: clientDefs[4].client_phone,
            client_type: 'external',
            segments: [{ segment_order: 1, segment_type: 'active', service_name: serviceDefs[3].name, service_catalog_id: serviceIds[3], practitioner_id: practitionerIds[1], resource_id: resourceIds[1], start_time: start, end_time: end, duration_minutes: 50, price: serviceDefs[3].price }],
        }));
        if (apptRes.data?.id) {
            log('סימון "לא הגיע"', await api('POST', `/beauty/${GROUP_ID}/appointments/${apptRes.data.id}/no-show`, {}));
        }
    }

    // ===== 8. תבניות משמרת =====
    console.log('\n--- תבניות משמרת ---');
    const shiftTemplateDefs = [
        { name: 'בוקר', start: '08:00', end: '16:00' },
        { name: 'ערב', start: '13:00', end: '21:00' },
    ];
    for (const t of shiftTemplateDefs) {
        log(`תבנית משמרת: ${t.name}`, await api('POST', '/shift-templates', { groupId: GROUP_ID, ...t }));
    }

    // ===== 9. צוות — משימות/משמרות =====
    console.log('\n--- צוות עובדים ---');
    const membersRes = await api('GET', `/members/${GROUP_ID}`, null);
    const staff = (membersRes.data?.members || []).filter(m => m.role !== 'ADMIN');
    if (staff.length === 0) {
        console.log('ℹ️ לא נמצאו עובדים נוספים (המטפלות שנוצרו הן משתמשים פנימיים ללא כניסה למערכת) — דילוג על שיבוץ משימות/משמרות דרך /api/tasks.');
    } else {
        const firstStaff = staff[0];
        log(`משימה לדוגמה עבור ${firstStaff.nickname}`, await api('POST', '/tasks', {
            title: 'ניקיון וסידור עמדות בסוף היום', reward: 25, assignedTo: firstStaff.id, days: 3, status: 'pending', priority: 'medium',
        }));
        const shiftDate = daysFromNow(1);
        log(`משמרת בוקר לדוגמה עבור ${firstStaff.nickname}`, await api('POST', '/tasks', {
            title: `SHIFT|${shiftDate}|08:00|16:00|בוקר`, reward: 0, assignedTo: firstStaff.id, days: null, status: 'approved',
        }));
    }

    // ===== 10. תנועת הוצאה כללית ידנית =====
    console.log('\n--- תנועות תזרים ---');
    log('הוצאה כללית לדוגמה', await api('POST', '/transaction', {
        groupId: GROUP_ID, userId: loginRes.data.user.id, amount: 620, description: 'רכישת מוצרי צריכה למספרה', category: 'other', type: 'expense',
    }));

    console.log('\n🎉 הזנת הנתונים הושלמה. אפשר להתחבר לעסק ולראות את כל הנתונים בממשק.');
    console.log('   הערה: לא הוזנו בקשות הצעת מחיר (RFQ) — אלו נוצרות מצד חשבון משפחה (לקוח), לא מצד ניהול העסק.');
}

main().catch(e => console.error('שגיאה כללית:', e));
