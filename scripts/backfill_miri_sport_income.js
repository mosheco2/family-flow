// סקריפט חד-פעמי: משלים בדיעבד את תנועות ההכנסה בטבלת transactions עבור מירי ספורט,
// שלא נוצרו בזמן אמת בגלל עמודת payment_method שהייתה חסרה בסביבת הייצור (תוקן בקומיט b18ec43).
// הרץ אך ורק פעם אחת, אחרי שהשרת עלה מחדש עם התיקון.
// הרצה:  node scripts/backfill_miri_sport_income.js

const BASE_URL = process.env.BASE_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;

const CREDS = {
    groupCode: 'B61091CF',
    nickname: 'מירי ספורט',
    password: '123456',
};

let TOKEN = null;
let GROUP_ID = null;
let USER_ID = null;

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

// בדיוק אותן תנועות שנרשמו ב-sport_payments בזמן ה-seed המקורי (ולא הגיעו ל-transactions)
const INCOME_ENTRIES = [
    { amount: 199, description: 'הצטרפות מנוי חדש — יוסי אברהם' },
    { amount: 1800, description: 'הצטרפות מנוי חדש — מיכל שרון' },
    { amount: 350, description: 'הצטרפות מנוי חדש — רון פרץ' },
    { amount: 199, description: 'הצטרפות מנוי חדש — נועה גל' },
    { amount: 900, description: 'הצטרפות מנוי חדש — איתי לביא' },
    { amount: 199, description: 'הצטרפות מנוי חדש — טל ברקוביץ' },
    { amount: 50, description: 'תוספת אימון אישי' },
];

async function main() {
    console.log(`מתחבר לעסק "${CREDS.nickname}"...`);
    const loginRes = await api('POST', '/login', CREDS);
    if (!loginRes.ok || !loginRes.data?.success) {
        console.log('❌ ההתחברות נכשלה.', loginRes.data);
        return;
    }
    TOKEN = loginRes.data.token;
    GROUP_ID = loginRes.data.group.id;
    USER_ID = loginRes.data.user.id;
    console.log(`✅ התחברות הצליחה. groupId=${GROUP_ID}\n`);

    for (const entry of INCOME_ENTRIES) {
        await log(`השלמת הכנסה: ${entry.description} (₪${entry.amount})`, await api('POST', '/transaction', {
            groupId: GROUP_ID, userId: USER_ID, amount: entry.amount, description: entry.description, category: 'sales', type: 'income',
        }));
    }

    console.log('\n🎉 ההשלמה הסתיימה. "הכנסות החודש" בדשבורד ובדוחות אמורות כעת להציג ₪3,697.');
}

main().catch(e => console.error('שגיאה כללית:', e));
