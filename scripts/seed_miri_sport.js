// סקריפט הזנת נתוני דמו מלאים לעסק "מירי ספורט" בכל הפרמטרים הקיימים במערכת.
// דורש Node.js 18+ (fetch מובנה). הרץ עם:  node scripts/seed_miri_sport.js
// אפשר לשנות את כתובת השרת עם משתנה סביבה: BASE_URL=https://weflowz.co.il node scripts/seed_miri_sport.js

const BASE_URL = process.env.BASE_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;

const CREDS = {
    groupCode: 'B61091CF',
    nickname: 'מירי ספורט',
    password: '123456',
};

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
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
    if (result.ok && (result.data?.success !== false)) {
        console.log(`✅ ${label}`);
    } else {
        console.log(`❌ ${label} — status ${result.status} — ${JSON.stringify(result.data)}`);
    }
    return result;
}

function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

async function main() {
    console.log(`מתחבר לעסק "${CREDS.nickname}" (קוד ${CREDS.groupCode})...`);
    const loginRes = await api('POST', '/login', CREDS, false);
    if (!loginRes.ok || !loginRes.data?.success) {
        console.log('❌ ההתחברות נכשלה — בדוק את פרטי ההתחברות / כתובת השרת.', loginRes.data);
        return;
    }
    TOKEN = loginRes.data.token;
    GROUP_ID = loginRes.data.group.id;
    console.log(`✅ התחברות הצליחה. groupId=${GROUP_ID}\n`);

    // ===== 1. סוגי מנוי =====
    console.log('--- סוגי מנוי ---');
    const membershipTypeDefs = [
        { name: 'מנוי חודשי', type: 'monthly', price: 199, durationDays: 30 },
        { name: 'מנוי שנתי', type: 'yearly', price: 1800, durationDays: 365 },
        { name: 'כרטיסיית 10 כניסות', type: 'punch_card', price: 350, sessions: 10 },
        { name: 'כניסה יומית', type: 'day_pass', price: 50, durationDays: 1 },
        { name: 'אימונים אישיים (חבילת 5)', type: 'pt_sessions', price: 900, sessions: 5 },
    ];
    const membershipTypeIds = [];
    for (const t of membershipTypeDefs) {
        const r = log(`סוג מנוי: ${t.name}`, await api('POST', '/sport/membership-types', { groupId: GROUP_ID, ...t }));
        if (r.data?.type?.id) membershipTypeIds.push(r.data.type.id);
    }

    // ===== 2. מאמנים =====
    console.log('\n--- מאמנים ---');
    const trainerDefs = [
        { name: 'דני כהן', phone: '0501234567', email: 'danny@example.com', specialties: 'כוח, קרוספיט', payType: 'per_class', perClassRate: 120 },
        { name: 'שירה לוי', phone: '0507654321', email: 'shira@example.com', specialties: 'יוגה, פילאטיס', payType: 'hourly', hourlyRate: 100 },
        { name: 'אורן ברק', phone: '0509998877', specialties: 'ספינינג, אירובי', payType: 'per_class', perClassRate: 110 },
    ];
    const trainerIds = [];
    for (const t of trainerDefs) {
        const r = log(`מאמן/ת: ${t.name}`, await api('POST', '/sport/trainers', { groupId: GROUP_ID, ...t }));
        if (r.data?.id) trainerIds.push(r.data.id);
    }

    // ===== 3. סוגי חוגים =====
    console.log('\n--- סוגי חוגים ---');
    const classTypeDefs = [
        { name: 'יוגה', color: 'violet', defaultDurationMin: 60 },
        { name: 'קרוספיט', color: 'red', defaultDurationMin: 45 },
        { name: 'ספינינג', color: 'blue', defaultDurationMin: 45 },
        { name: 'פילאטיס', color: 'emerald', defaultDurationMin: 50 },
    ];
    const classTypeIds = [];
    for (const t of classTypeDefs) {
        const r = log(`סוג חוג: ${t.name}`, await api('POST', '/sport/class-types', { groupId: GROUP_ID, ...t }));
        if (r.data?.type?.id) classTypeIds.push(r.data.type.id);
    }

    // ===== 4. חוגים מתוזמנים =====
    console.log('\n--- חוגים ---');
    const classDefs = [
        { classTypeId: classTypeIds[0], className: 'יוגה בוקר', trainerId: trainerIds[1], classDate: daysFromNow(1), startTime: '08:00', endTime: '09:00', capacity: 15 },
        { classTypeId: classTypeIds[1], className: 'קרוספיט ערב', trainerId: trainerIds[0], classDate: daysFromNow(1), startTime: '18:00', endTime: '18:45', capacity: 12 },
        { classTypeId: classTypeIds[2], className: 'ספינינג צהריים', trainerId: trainerIds[2], classDate: daysFromNow(2), startTime: '13:00', endTime: '13:45', capacity: 20 },
        { classTypeId: classTypeIds[3], className: 'פילאטיס בוקר', trainerId: trainerIds[1], classDate: daysFromNow(3), startTime: '09:00', endTime: '09:50', capacity: 10 },
        { classTypeId: classTypeIds[0], className: 'יוגה ערב', trainerId: trainerIds[1], classDate: daysFromNow(4), startTime: '19:00', endTime: '20:00', capacity: 15 },
    ];
    const classIds = [];
    for (const c of classDefs) {
        const r = log(`חוג: ${c.className} (${c.classDate})`, await api('POST', '/sport/classes', { groupId: GROUP_ID, ...c }));
        if (r.data?.class?.id) classIds.push(r.data.class.id);
    }

    // ===== 5. חברי מועדון =====
    console.log('\n--- חברים ---');
    const memberDefs = [
        { memberName: 'יוסי אברהם', memberPhone: '0521111111', memberEmail: 'yossi@example.com', membershipTypeId: membershipTypeIds[0], paymentAmount: 199, paymentMethod: 'cash', gender: 'male', dateOfBirth: '1990-05-14' },
        { memberName: 'מיכל שרון', memberPhone: '0522222222', memberEmail: 'michal@example.com', membershipTypeId: membershipTypeIds[1], paymentAmount: 1800, paymentMethod: 'credit', gender: 'female', dateOfBirth: '1985-11-02' },
        { memberName: 'רון פרץ', memberPhone: '0523333333', membershipTypeId: membershipTypeIds[2], paymentAmount: 350, paymentMethod: 'cash', gender: 'male', dateOfBirth: '1995-03-20' },
        { memberName: 'נועה גל', memberPhone: '0524444444', memberEmail: 'noa@example.com', membershipTypeId: membershipTypeIds[0], paymentAmount: 199, paymentMethod: 'transfer', gender: 'female', dateOfBirth: '2000-07-08' },
        { memberName: 'איתי לביא', memberPhone: '0525555555', membershipTypeId: membershipTypeIds[4], paymentAmount: 900, paymentMethod: 'credit', gender: 'male', dateOfBirth: '1988-01-30' },
        { memberName: 'טל ברקוביץ', memberPhone: '0526666666', membershipTypeId: membershipTypeIds[0], paymentAmount: 199, paymentMethod: 'app', gender: 'other', dateOfBirth: '1992-09-17' },
    ];
    const memberIds = [];
    for (const m of memberDefs) {
        const r = log(`חבר/ה: ${m.memberName}`, await api('POST', '/sport/members', { groupId: GROUP_ID, ...m }));
        if (r.data?.member?.id) memberIds.push(r.data.member.id);
    }

    // תשלום נוסף (ידני) לאחד החברים, לדוגמת תזרים
    if (memberIds[0]) {
        log('תשלום נוסף לחבר', await api('POST', '/sport/payments', {
            groupId: GROUP_ID, membershipId: memberIds[0], memberName: memberDefs[0].memberName, amount: 50, paymentMethod: 'cash', notes: 'תוספת אימון אישי',
        }));
    }

    // הרשמת חברים לחוגים
    if (classIds[0] && memberIds[0]) {
        log('הרשמת חבר לחוג יוגה', await api('POST', `/sport/classes/${classIds[0]}/register`, { membershipId: memberIds[0], memberName: memberDefs[0].memberName }));
    }
    if (classIds[1] && memberIds[1]) {
        log('הרשמת חבר לחוג קרוספיט', await api('POST', `/sport/classes/${classIds[1]}/register`, { membershipId: memberIds[1], memberName: memberDefs[1].memberName }));
    }

    // ===== 6. לידים =====
    console.log('\n--- לידים ---');
    const leadDefs = [
        { memberName: 'דורית כץ', memberPhone: '0531111111', source: 'facebook', notes: 'התעניינה במנוי שנתי' },
        { memberName: 'עידו שמש', memberPhone: '0532222222', source: 'drop-in', notes: 'בא לניסיון חינם' },
    ];
    for (const l of leadDefs) {
        log(`ליד: ${l.memberName}`, await api('POST', '/sport/leads', { groupId: GROUP_ID, ...l }));
    }

    // ===== 7. ציוד =====
    console.log('\n--- ציוד ---');
    const equipmentDefs = [
        { name: 'מסלול ריצה חשמלי #1', category: 'קרדיו', serialNumber: 'TR-1001', purchaseDate: daysFromNow(-400), warrantyExpiry: daysFromNow(-30) },
        { name: 'מכונת סקוואט', category: 'כוח', serialNumber: 'SQ-2002', purchaseDate: daysFromNow(-200), warrantyExpiry: daysFromNow(160) },
        { name: 'אופני ספינינג (סט 10)', category: 'קרדיו', serialNumber: 'SP-3003', purchaseDate: daysFromNow(-100), warrantyExpiry: daysFromNow(260) },
    ];
    const equipmentIds = [];
    for (const eq of equipmentDefs) {
        const r = log(`ציוד: ${eq.name}`, await api('POST', '/equipment/items', { groupId: GROUP_ID, ...eq }));
        if (r.data?.item?.id) equipmentIds.push(r.data.item.id);
    }

    // טכנאי ציוד
    let technicianId = null;
    {
        const r = log('טכנאי ציוד: אבי תחזוקה', await api('POST', '/equipment/technicians', {
            groupId: GROUP_ID, name: 'אבי תחזוקה', companyName: 'שירותי אחזקה בע"מ', phone: '0541234567', specialty: 'ציוד קרדיו',
        }));
        technicianId = r.data?.technician?.id || null;
    }

    // תחזוקה מתוזמנת + היסטוריית עלות
    if (equipmentIds[0]) {
        log('תחזוקה מתוזמנת למסלול ריצה', await api('POST', '/equipment/maintenance', {
            groupId: GROUP_ID, equipmentId: equipmentIds[0], maintenanceType: 'periodic', description: 'החלפת שמן ובדיקת מנוע',
            scheduledDate: daysFromNow(5), cost: 350, technicianName: 'אבי תחזוקה', intervalDays: 90,
        }));
    }

    // תקלה פתוחה
    if (equipmentIds[1]) {
        log('תקלה במכונת סקוואט', await api('POST', '/equipment/faults', {
            groupId: GROUP_ID, equipmentId: equipmentIds[1], title: 'רעש חריג בזמן שימוש', severity: 'medium', status: 'open',
        }));
    }

    // ===== 8. שיוך ציוד לחוג =====
    if (classIds[1] && equipmentIds[1]) {
        log('שיוך ציוד לחוג קרוספיט', await api('POST', `/sport/classes/${classIds[1]}/equipment`, { equipmentItemIds: [equipmentIds[1]] }));
    }

    // ===== 9. תבניות משמרת =====
    console.log('\n--- תבניות משמרת ---');
    const shiftTemplateDefs = [
        { name: 'בוקר', start: '07:00', end: '15:00' },
        { name: 'ערב', start: '15:00', end: '23:00' },
    ];
    for (const t of shiftTemplateDefs) {
        log(`תבנית משמרת: ${t.name}`, await api('POST', '/shift-templates', { groupId: GROUP_ID, ...t }));
    }

    // ===== 10. עובדי הצוות הקיימים — משימות/משמרות =====
    console.log('\n--- צוות עובדים ---');
    const membersRes = await api('GET', `/members/${GROUP_ID}`, null, false);
    const staff = (membersRes.data?.members || []).filter(m => m.role !== 'ADMIN');
    if (staff.length === 0) {
        console.log('ℹ️ לא נמצאו עובדים נוספים מלבד המנהל/ת — דילוג על שיבוץ משימות/משמרות לעובדים אחרים.');
        console.log('   (ניתן להוסיף עובדים דרך "הזמנת איש צוות חדש" בממשק, ואז להריץ שוב את החלק הזה)');
    } else {
        console.log(`נמצאו ${staff.length} עובדים — משבץ משימות ומשמרות לדוגמה...`);
        const firstStaff = staff[0];
        log(`משימה לדוגמה עבור ${firstStaff.nickname}`, await api('POST', '/tasks', {
            title: 'סידור מכשירי כושר לאחר סגירה', reward: 30, assignedTo: firstStaff.id, days: 3, status: 'pending', priority: 'medium',
        }));
        const shiftDate = daysFromNow(1);
        log(`משמרת בוקר לדוגמה עבור ${firstStaff.nickname}`, await api('POST', '/tasks', {
            title: `SHIFT|${shiftDate}|08:00|16:00|בוקר`, reward: 0, assignedTo: firstStaff.id, days: null, status: 'approved',
        }));
    }

    // ===== 11. תנועת הכנסה/הוצאה כללית ידנית (לדוגמת תזרים) =====
    console.log('\n--- תנועות תזרים ---');
    log('הוצאה כללית לדוגמה', await api('POST', '/transaction', {
        groupId: GROUP_ID, userId: loginRes.data.user.id, amount: 850, description: 'רכישת מגבות וציוד ניקיון', category: 'other', type: 'expense',
    }));

    console.log('\n🎉 הזנת הנתונים הושלמה. אפשר להתחבר לעסק ולראות את כל הנתונים בממשק.');
}

main().catch(e => console.error('שגיאה כללית:', e));
