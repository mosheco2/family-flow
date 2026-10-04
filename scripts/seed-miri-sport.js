/**
 * seed-miri-sport.js
 * בניית נתוני דוגמה מקיפים לעסק ספורט "מירי ספורט" (B61091CF) — ניקוי מלא של הקיים ואז
 * מילוי רחב ככל האפשר: קטלוג מוצרים (retail, בלי תמונות — מועלות ידנית), סוגי מנוי,
 * סוגי שיעורים, לוח שיעורים, מאמנים, חברים/מנויים, הרשמות לשיעורים, נוכחות, צ'ק-אין,
 * אימונים אישיים (appointments), תשלומים ולידים.
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=B61091CF BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/seed-miri-sport.js
 *
 * SKIP_CLEAR=true — דילוג על שלב הניקוי (הרצה חוזרת ממוקדת בלבד)
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'B61091CF';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';

let TOKEN = null, GROUP_ID = null;
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}
function log(ok, label, extra) { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

// ── נתוני בסיס ──────────────────────────────────────────────────────────────
const MEMBERSHIP_TYPES = [
  { name: 'מנוי חודשי רגיל', type: 'monthly', price: 199, durationDays: 30, color: 'indigo' },
  { name: 'מנוי שנתי', type: 'yearly', price: 1890, durationDays: 365, color: 'violet' },
  { name: 'כרטיסיית 10 כניסות', type: 'punch_card', price: 350, sessions: 10, color: 'amber' },
  { name: 'חבילת 8 שיעורי פילאטיס', type: 'class_pack', price: 480, sessions: 8, color: 'rose' },
  { name: 'כניסה יומית (Day Pass)', type: 'day_pass', price: 60, durationDays: 1, color: 'slate' },
];

const CLASS_TYPES = [
  { name: 'ספין', color: 'red', defaultDurationMin: 45, maxPerSession: 18 },
  { name: 'פילאטיס', color: 'rose', defaultDurationMin: 50, maxPerSession: 14 },
  { name: 'יוגה', color: 'teal', defaultDurationMin: 60, maxPerSession: 16 },
  { name: 'TRX / אימון פונקציונלי', color: 'amber', defaultDurationMin: 45, maxPerSession: 12 },
];

const TRAINERS = [
  { name: 'מירי כהן', phone: '0501112222', email: 'miri@mirisport.co.il', specialties: 'פילאטיס, יוגה', payType: 'per_class', perClassRate: 120, colorHex: '#E11D48', workStart: '07:00', workEnd: '16:00' },
  { name: 'דני לוי', phone: '0502223333', email: 'dani@mirisport.co.il', specialties: 'ספין, אימון פונקציונלי', payType: 'hourly', hourlyRate: 90, colorHex: '#DC2626', workStart: '14:00', workEnd: '22:00' },
  { name: 'שירה אברהם', phone: '0503334444', email: 'shira@mirisport.co.il', specialties: 'אימון אישי, TRX', payType: 'revenue_percent', revenuePercent: 60, colorHex: '#0D9488', workStart: '08:00', workEnd: '20:00' },
];

const CATALOG_PRODUCTS = [
  { name: 'אבקת חלבון וניל 1 ק"ג', category: 'תוספי תזונה', price: 149 },
  { name: 'אבקת חלבון שוקולד 1 ק"ג', category: 'תוספי תזונה', price: 149 },
  { name: 'שייקר 600 מ"ל', category: 'אביזרים', price: 35 },
  { name: 'גומיות התנגדות (סט 3)', category: 'ציוד אימון', price: 59 },
  { name: 'מזרן יוגה פרימיום', category: 'ציוד אימון', price: 119 },
  { name: 'כפפות אימון', category: 'אביזרים', price: 69 },
  { name: 'תיק ספורט', category: 'אביזרים', price: 99 },
  { name: 'חטיף אנרגיה (יחידה)', category: 'תוספי תזונה', price: 12 },
  { name: 'מגבת ספורט מיקרופייבר', category: 'אביזרים', price: 45 },
  { name: 'בקבוק שתייה 1 ליטר', category: 'אביזרים', price: 39 },
  { name: 'מנעול לוקר קוד', category: 'אביזרים', price: 29 },
  { name: 'חגורת גב תמיכה', category: 'ציוד אימון', price: 89 },
];

const MEMBERS = [
  { name: 'נועה שמיר', phone: '0541110001', email: 'noa.s@example.com', gender: 'female', dateOfBirth: '1992-03-14' },
  { name: 'איתי פרידמן', phone: '0541110002', email: 'itay.f@example.com', gender: 'male', dateOfBirth: '1988-07-22' },
  { name: 'תמר גולן', phone: '0541110003', email: 'tamar.g@example.com', gender: 'female', dateOfBirth: '1995-11-02' },
  { name: 'רועי ברק', phone: '0541110004', email: 'roi.b@example.com', gender: 'male', dateOfBirth: '1990-01-30' },
  { name: 'מיה אזולאי', phone: '0541110005', email: 'maya.a@example.com', gender: 'female', dateOfBirth: '1998-05-18' },
  { name: 'יובל כץ', phone: '0541110006', email: 'yuval.k@example.com', gender: 'male', dateOfBirth: '1985-09-09' },
  { name: 'שני מזרחי', phone: '0541110007', email: 'shani.m@example.com', gender: 'female', dateOfBirth: '1993-12-25' },
  { name: 'עומר דהן', phone: '0541110008', email: 'omer.d@example.com', gender: 'male', dateOfBirth: '1991-04-11' },
  { name: 'ליהי שחר', phone: '0541110009', email: 'lihi.s@example.com', gender: 'female', dateOfBirth: '1997-08-07' },
  { name: 'אסף נחום', phone: '0541110010', email: 'asaf.n@example.com', gender: 'male', dateOfBirth: '1989-02-19' },
  { name: 'גלית רז', phone: '0541110011', email: 'galit.r@example.com', gender: 'female', dateOfBirth: '1994-06-30' },
  { name: 'בן סולומון', phone: '0541110012', email: 'ben.s@example.com', gender: 'male', dateOfBirth: '1996-10-15' },
];

const LEADS = [
  { name: 'דור אלון', phone: '0559990001', source: 'instagram', notes: 'מתעניין במנוי חודשי' },
  { name: 'קרן לוסטיג', phone: '0559990002', source: 'website', notes: 'ביקשה פרטים על שיעורי פילאטיס' },
  { name: 'איל ברוך', phone: '0559990003', source: 'referral', notes: 'הגיע בהמלצת חבר' },
  { name: 'נטע ישראלי', phone: '0559990004', source: 'walk_in', notes: 'נכנסה לסניף לבירור מחירים' },
];

async function main() {
  const lookup = await fetch(`${API}/storefront/${GROUP_CODE}`).then(r => r.json());
  if (!lookup.groupId) throw new Error(`לא נמצא עסק לפי קוד ${GROUP_CODE}`);
  GROUP_ID = lookup.groupId;
  const loginRes = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID });
  if (!loginRes.data.token) throw new Error(`התחברות נכשלה: ${JSON.stringify(loginRes.data)}`);
  TOKEN = loginRes.data.token;
  log(true, 'התחברות הצליחה', `group_id=${GROUP_ID}`);

  // ── ניקוי ──────────────────────────────────────────────────────────────
  if (process.env.SKIP_CLEAR !== 'true') {
    console.log('\n🗑️  מנקה נתונים קיימים...');

    const catRes = await api('GET', `/store/catalog/${GROUP_ID}`);
    const catItems = Array.isArray(catRes.data) ? catRes.data : (catRes.data.catalog || catRes.data.items || []);
    for (const item of (catItems || [])) {
      const d = await api('DELETE', `/store/catalog/${item.id}`, { groupId: GROUP_ID });
      log(d.ok && d.data.success !== false, `נמחק מוצר: ${item.name}`);
    }

    const classesRes = await api('GET', `/sport/classes/${GROUP_ID}`);
    const classes = classesRes.data.classes || [];
    for (const c of classes) { await api('DELETE', `/sport/classes/${c.id}`); }
    log(true, `נמחקו ${classes.length} שיעורים`);

    const classTypesRes = await api('GET', `/sport/class-types/${GROUP_ID}`);
    const classTypes = classTypesRes.data.types || [];
    for (const ct of classTypes) { await api('DELETE', `/sport/class-types/${ct.id}`); }
    log(true, `נמחקו ${classTypes.length} סוגי שיעור`);

    const apptRes = await api('GET', `/sport/appointments/${GROUP_ID}`);
    const appts = apptRes.data.appointments || [];
    for (const a of appts) { await api('DELETE', `/sport/appointments/${a.id}`); }
    log(true, `נמחקו ${appts.length} אימונים אישיים`);

    const membersRes = await api('GET', `/sport/members/${GROUP_ID}`);
    const members = membersRes.data.members || [];
    for (const m of members) { await api('DELETE', `/sport/members/${m.id}`); }
    log(true, `נמחקו ${members.length} חברים`);

    const typesRes = await api('GET', `/sport/membership-types/${GROUP_ID}`);
    const types = typesRes.data.types || [];
    for (const ty of types) { await api('DELETE', `/sport/membership-types/${ty.id}`); }
    log(true, `נמחקו ${types.length} סוגי מנוי`);

    const trainersRes = await api('GET', `/sport/trainers/${GROUP_ID}`);
    const trainers = trainersRes.data.trainers || [];
    for (const tr of trainers) { await api('DELETE', `/sport/trainers/${tr.id}`); }
    log(true, `נמחקו ${trainers.length} מאמנים`);
  } else {
    console.log('\n↷ SKIP_CLEAR=true — לא נוגעים בנתונים קיימים');
  }

  // ── קטלוג מוצרים (retail, בלי תמונות) ─────────────────────────────────
  console.log('\n📦 בונה קטלוג מוצרים...');
  for (const p of CATALOG_PRODUCTS) {
    const r = await api('POST', '/store/catalog', { groupId: GROUP_ID, name: p.name, category: p.category, price: p.price, productType: 'retail', description: `${p.name} — איכות מקצועית` });
    log(r.ok && r.data.success !== false, `מוצר: ${p.name}`);
  }

  // ── סוגי מנוי ──────────────────────────────────────────────────────────
  console.log('\n🎫 בונה סוגי מנוי...');
  const typeIds = {};
  for (const mt of MEMBERSHIP_TYPES) {
    const r = await api('POST', '/sport/membership-types', { groupId: GROUP_ID, name: mt.name, type: mt.type, price: mt.price, durationDays: mt.durationDays, sessions: mt.sessions, color: mt.color });
    log(r.ok && r.data.success, `סוג מנוי: ${mt.name}`);
    if (r.data.success) typeIds[mt.name] = r.data.type.id;
  }
  const typeIdList = Object.values(typeIds);

  // ── מאמנים ─────────────────────────────────────────────────────────────
  console.log('\n🧑‍🏫 בונה מאמנים...');
  const trainerIds = {};
  for (const tr of TRAINERS) {
    const r = await api('POST', '/sport/trainers', { groupId: GROUP_ID, ...tr });
    log(r.ok && r.data.success, `מאמן/ת: ${tr.name}`);
    if (r.data.success) trainerIds[tr.name] = r.data.id;
  }

  // ── סוגי שיעור ─────────────────────────────────────────────────────────
  console.log('\n🏷️  בונה סוגי שיעור...');
  const classTypeIds = {};
  for (const ct of CLASS_TYPES) {
    const r = await api('POST', '/sport/class-types', { groupId: GROUP_ID, name: ct.name, color: ct.color, defaultDurationMin: ct.defaultDurationMin, allowedMembershipTypeIds: typeIdList, maxPerSession: ct.maxPerSession });
    log(r.ok && r.data.success, `סוג שיעור: ${ct.name}`);
    if (r.data.success) classTypeIds[ct.name] = r.data.type.id;
  }

  // ── לוח שיעורים (14 ימים קדימה + 3 ימים אחורה שהושלמו) ────────────────
  console.log('\n📅 בונה לוח שיעורים...');
  const classSchedule = [
    { type: 'ספין', trainer: 'דני לוי', time: '07:00', end: '07:45', dayOffsets: [-3, -1, 1, 3, 5, 8, 10] },
    { type: 'פילאטיס', trainer: 'מירי כהן', time: '09:00', end: '09:50', dayOffsets: [-2, 0, 2, 4, 7, 9] },
    { type: 'יוגה', trainer: 'מירי כהן', time: '18:00', end: '19:00', dayOffsets: [-1, 1, 3, 6, 8, 11] },
    { type: 'TRX / אימון פונקציונלי', trainer: 'שירה אברהם', time: '19:30', end: '20:15', dayOffsets: [0, 2, 5, 7, 10, 13] },
  ];
  const createdClasses = [];
  for (const sched of classSchedule) {
    for (const off of sched.dayOffsets) {
      const classDate = daysFromNow(off);
      const r = await api('POST', '/sport/classes', {
        groupId: GROUP_ID, classTypeId: classTypeIds[sched.type], className: sched.type,
        trainerId: trainerIds[sched.trainer], trainerName: sched.trainer,
        classDate, startTime: sched.time, endTime: sched.end, capacity: 16,
      });
      if (r.data.success) createdClasses.push({ ...r.data.class, _isPast: off < 0 });
    }
  }
  log(true, `נוצרו ${createdClasses.length} שיעורים בלוח`);

  // ── חברים/מנויים ───────────────────────────────────────────────────────
  console.log('\n🙋 בונה חברים ומנויים...');
  const typeNames = Object.keys(typeIds);
  const createdMembers = [];
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i];
    const mt = typeNames[i % typeNames.length];
    const mtPrice = MEMBERSHIP_TYPES.find(x => x.name === mt).price;
    const r = await api('POST', '/sport/members', {
      groupId: GROUP_ID, name: m.name, phone: m.phone, email: m.email, membershipTypeId: typeIds[mt],
      startDate: daysFromNow(-5), dateOfBirth: m.dateOfBirth, gender: m.gender,
      notes: `הצטרף/ה עם ${mt}`, paymentAmount: mtPrice, paymentMethod: i % 3 === 0 ? 'credit' : (i % 3 === 1 ? 'cash' : 'transfer'),
    });
    log(r.ok && r.data.success, `חבר/ה: ${m.name} (${mt})`);
    if (r.data.success) createdMembers.push(r.data.member);
  }

  // ── הרשמות לשיעורים + נוכחות בשיעורים שעברו ────────────────────────────
  console.log('\n📝 רושם חברים לשיעורים...');
  for (const cls of createdClasses) {
    // 4-7 הרשמות אקראיות לכל שיעור
    const regCount = 4 + Math.floor(Math.random() * 4);
    const picked = [...createdMembers].sort(() => Math.random() - 0.5).slice(0, regCount);
    for (const mem of picked) {
      await api('POST', `/sport/classes/${cls.id}/register`, { membershipId: mem.id, memberName: mem.member_name });
    }
    if (cls._isPast) {
      const presentIds = picked.filter(() => Math.random() > 0.2).map(m => m.id); // כ-80% נוכחות בפועל
      await api('POST', `/sport/classes/${cls.id}/attendance`, { presentIds });
    }
  }
  log(true, 'הרשמות ונוכחות נרשמו');

  // ── צ'ק-אין חופשי (לא קשור לשיעור ספציפי) ──────────────────────────────
  console.log('\n✅ רושם צ׳ק-אין...');
  for (const mem of createdMembers.slice(0, 7)) {
    const r = await api('POST', '/sport/checkin', { groupId: GROUP_ID, membershipId: mem.id, memberName: mem.member_name });
    log(r.ok && r.data.success, `צ׳ק-אין: ${mem.member_name}`);
  }

  // ── אימונים אישיים (appointments) ───────────────────────────────────────
  console.log('\n🏋️ בונה אימונים אישיים...');
  for (let i = 0; i < 6; i++) {
    const mem = createdMembers[i];
    const trainerName = TRAINERS[i % TRAINERS.length].name;
    const day = daysFromNow(i - 2);
    const hour = 10 + i;
    const r = await api('POST', '/sport/appointments', {
      groupId: GROUP_ID, trainerId: trainerIds[trainerName], clientName: mem.member_name, clientPhone: mem.member_phone,
      clientEmail: mem.member_email, serviceName: 'אימון אישי', startTime: `${day}T${String(hour).padStart(2,'0')}:00:00`,
      endTime: `${day}T${String(hour).padStart(2,'0')}:45:00`, durationMinutes: 45,
      notes: 'אימון אישי להתאמת תוכנית',
    });
    log(r.ok && r.data.success, `אימון אישי: ${mem.member_name} עם ${trainerName}`);
  }

  // ── תשלום נוסף לדוגמה (חידוש) ────────────────────────────────────────
  console.log('\n💳 רושם תשלום נוסף לדוגמה...');
  if (createdMembers[0]) {
    const r = await api('POST', '/sport/payments', { groupId: GROUP_ID, membershipId: createdMembers[0].id, memberName: createdMembers[0].member_name, amount: 199, paymentMethod: 'credit', notes: 'תשלום חידוש חודשי' });
    log(r.ok && r.data.success, 'תשלום חידוש נרשם');
  }

  // ── לידים ──────────────────────────────────────────────────────────────
  console.log('\n📇 בונה לידים...');
  for (const lead of LEADS) {
    const r = await api('POST', '/sport/leads', { groupId: GROUP_ID, memberName: lead.name, memberPhone: lead.phone, source: lead.source, notes: lead.notes });
    log(r.ok && r.data.success !== false, `ליד: ${lead.name}`);
  }

  console.log('\n✅ הושלם! מילוי נתוני דוגמה לעסק "מירי ספורט" הסתיים.');
}

main().catch(e => { console.error('\n❌ שגיאה:', e.message); process.exit(1); });
