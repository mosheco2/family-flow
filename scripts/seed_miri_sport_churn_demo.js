// סקריפט חד-פעמי: מבטל 2 מנויים קיימים ב"מירי ספורט" כדי שדוח הנטישה יציג נתונים אמיתיים.
// יש להריץ אחרי seed_miri_sport.js (כדי שיהיו מנויים קיימים לבטל).
// הרצה:  node scripts/seed_miri_sport_churn_demo.js

const BASE_URL = process.env.BASE_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;

const CREDS = {
    groupCode: 'B61091CF',
    nickname: 'מירי ספורט',
    password: '123456',
};

// שמות חברים לביטול לדוגמה (מתוך seed_miri_sport.js)
const MEMBERS_TO_CANCEL = ['טל ברקוביץ', 'רון פרץ'];

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data };
}

function log(label, result) {
    if (result.ok && result.data?.success !== false) console.log(`✅ ${label}`);
    else console.log(`❌ ${label} — status ${result.status} — ${JSON.stringify(result.data)}`);
    return result;
}

async function main() {
    console.log(`מתחבר לעסק "${CREDS.nickname}"...`);
    const loginRes = await api('POST', '/login', CREDS);
    if (!loginRes.ok || !loginRes.data?.success) {
        console.log('❌ ההתחברות נכשלה.', loginRes.data);
        return;
    }
    TOKEN = loginRes.data.token;
    GROUP_ID = loginRes.data.group.id;
    console.log(`✅ התחברות הצליחה. groupId=${GROUP_ID}\n`);

    const membersRes = await api('GET', `/sport/members/${GROUP_ID}?status=active`);
    const members = membersRes.data?.members || [];
    if (!members.length) {
        console.log('❌ לא נמצאו מנויים פעילים — ודא ש-seed_miri_sport.js רץ קודם.');
        return;
    }

    for (const name of MEMBERS_TO_CANCEL) {
        const member = members.find(m => (m.member_name || '').includes(name));
        if (!member) {
            console.log(`⚠️  לא נמצא מנוי פעיל בשם "${name}" — מדלג`);
            continue;
        }
        await log(`ביטול מנוי: ${member.member_name}`, await api('POST', `/sport/members/${member.id}/cancel`, {
            reason: 'דוגמה להדגמת דוח נטישה',
        }));
    }

    console.log('\n🎉 הושלם. דוח הנטישה בטאב "דוחות" יציג כעת נתונים לחודש הנוכחי.');
}

main().catch(e => console.error('שגיאה כללית:', e));
