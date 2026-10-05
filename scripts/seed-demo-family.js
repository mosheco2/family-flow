/**
 * seed-demo-family.js
 * ============================================================
 * סקריפט עצמאי לזריעת משפחת DEMO/TEST מלאה ב-DB, הנוגעת כמעט
 * בכל פיצ'ר של סביבת FAMILY, לצורך הדגמה/בדיקות.
 *
 * ⚠️ חשוב מאוד — קרא לפני הרצה:
 * סקריפט זה נכתב ולא הורץ/נבדק מול ה-DB האמיתי. בסביבת הכתיבה (sandbox)
 * אין גישת רשת ל-DATABASE_URL (לא TCP ל-pg, לא HTTPS ל-API) — כך שלא
 * ניתן היה להריץ אותו בפועל. יש להריץ אותו בעצמכם בסביבה עם גישה ל-DB
 * (למשל מקומית או בשל deploy), לבדוק בעיון את פלט הקונסול סעיף-אחר-סעיף,
 * ורצוי להריץ קודם מול DB שאינו פרודקשן (staging) אם קיים כזה — הסקריפט
 * מבצע INSERT-ים אמיתיים, כולל שורות "פיננסיות"-למראה (transactions,
 * loans, goals) המשויכות לקבוצת משפחה חדשה שהוא יוצר בעצמו (לא נוגע
 * בנתונים של אף משפחה קיימת).
 *
 * הרצה:
 *   node scripts/seed-demo-family.js
 *
 * דרישות מוקדמות (לא נוצרות ע"י הסקריפט — הוא רק מאתר ומקשר אליהן):
 *   - קהילה בשם דומה ל"נוקדים" בטבלת communities
 *   - עסק (family_groups.type='BUSINESS') בשם דומה ל"פיצה מושיק"
 *   - עסק (family_groups.type='BUSINESS') בשם דומה ל"יוסי ובניו ידי זהב"
 *
 * הערה לגבי "3 ילדים, גילאים 10/12/14/16": בבקשה המקורית נכתבו 4 גילאים
 * עבור 3 ילדים — פער מובהק. ברירת המחדל כאן: 3 ילדים בגילאים 10/12/14
 * (הראשונים ברשימה). אם המשתמש התכוון לגיל אחר — יש לערוך את מערך
 * CHILDREN למטה ולהריץ מחדש (ניתן להריץ שוב בבטחה: קבוצה חדשה כל פעם).
 * ============================================================
 */

'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const DEMO_PASSWORD = 'Demo1234';
// קוד קבוצה קבוע למשפחת הדמו - כדי שתמיד תהיה אותה כתובת/קוד כניסה בין
// הרצות חוזרות (נמחק ונוצר מחדש בכל הרצה, אך תמיד עם אותו group_code),
// ולא קוד אקראי חדש שמבלבל איזו משפחה היא העדכנית.
const FIXED_GROUP_CODE = '7ITOMA';
const COMMUNITY_NAME_PATTERN = '%נוקדים%';
const BIZ_PIZZA_PATTERN = '%פיצה%מושיק%';
const BIZ_GOLD_PATTERN = '%ידי%זהב%'; // "יוסי ובניו ידי זהב"

const counts = {}; // table -> rows inserted, for the final summary
function bump(table, n = 1) { counts[table] = (counts[table] || 0) + n; }

function genGroupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function uniqueGroupCode(client) {
  for (let i = 0; i < 25; i++) {
    const code = genGroupCode();
    const r = await client.query('SELECT 1 FROM family_groups WHERE group_code=$1', [code]);
    if (r.rows.length === 0) return code;
  }
  throw new Error('לא הצלחנו להפיק group_code ייחודי אחרי 25 ניסיונות');
}

function israeliPhone(seed) {
  // 05X-XXXXXXX בפורמט ללא מקף (כמו שרוב הטלפונים נשמרים: 05XXXXXXXX)
  const prefixes = ['050', '052', '053', '054', '058'];
  const prefix = prefixes[seed % prefixes.length];
  const rest = String(1000000 + ((seed * 7919) % 9000000)).slice(0, 7);
  return prefix + rest;
}

async function phoneIsUnique(client, phone) {
  const r = await client.query(
    `SELECT u.id FROM users u JOIN family_groups fg ON fg.id=u.group_id WHERE u.phone=$1 AND fg.type='FAMILY' LIMIT 1`,
    [phone]
  );
  return r.rows.length === 0;
}

async function uniquePhone(client, seedBase) {
  for (let i = 0; i < 50; i++) {
    const phone = israeliPhone(seedBase + i);
    if (await phoneIsUnique(client, phone)) return phone;
  }
  throw new Error('לא הצלחנו להפיק מספר טלפון ייחודי');
}

async function findByNameILike(client, table, pattern, extraWhere = '', extraParams = []) {
  const sql = `SELECT * FROM ${table} WHERE name ILIKE $1 ${extraWhere} ORDER BY id ASC LIMIT 1`;
  const r = await client.query(sql, [pattern, ...extraParams]);
  return r.rows[0] || null;
}

const DEMO_ADMIN_EMAIL = 'demo.family.weflowz@example.com';

// הסקריפט אינו אידמפוטנטי מטבעו (כל הרצה יוצרת group_code חדש) - הרצות
// חוזרות (לצורך בדיקה/תיקון) היו משאירות משפחות-דמו "יתומות" ברקע, מה
// שעלול לבלבל איזו מהן באמת מלאה בנתונים. לכן: לפני יצירת משפחה חדשה,
// מנקים כל משפחת-דמו קודמת (לפי admin_email הקבוע) כולל כל הרשומות
// התלויות בה שאין להן ON DELETE CASCADE אמיתי בסכמה (למשל store_orders -
// family_group_id הוא עמודה רגילה בלי FK בפועל).
async function cleanupPreviousDemoFamily(client) {
  // מזהים לפי admin_email המקורי *וגם* לפי group_code הקבוע/family_nickname -
  // כי admin_email עלול להשתנות בין הרצות (למשל אם נערך ידנית ב-SA לצורך
  // בדיקה, כפי שקרה בפועל), ואז זיהוי לפי admin_email בלבד משאיר רשומה
  // יתומה שתופסת את ה-group_code הקבוע לצמיתות.
  const prev = await client.query(
    `SELECT id, name, group_code FROM family_groups
     WHERE type='FAMILY' AND (LOWER(admin_email)=$1 OR group_code=$2 OR family_nickname='משפחת הדמו')`,
    [DEMO_ADMIN_EMAIL, FIXED_GROUP_CODE]
  );
  if (prev.rows.length === 0) { console.log('✓ אין משפחת-דמו קודמת לניקוי.'); return; }
  for (const row of prev.rows) {
    console.log(`… מנקה משפחת-דמו קודמת: id=${row.id}, name="${row.name}", group_code=${row.group_code}`);
    await client.query('BEGIN');
    try {
      // טבלאות עם family_group_id/group_id ללא ON DELETE CASCADE אמיתי בסכמה
      await client.query(`DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE family_group_id=$1)`, [row.id]);
      await client.query(`DELETE FROM store_orders WHERE family_group_id=$1`, [row.id]);
      // service_calls/service_call_messages/work_order_payments כן נמחקים
      // אוטומטית ב-CASCADE דרך family_groups, אך מוחקים כאן מפורשות ליתר
      // ביטחון (אם הסכמה בפועל שונה מהתיעוד שנבדק).
      await client.query(`DELETE FROM work_order_payments WHERE service_call_id IN (SELECT id FROM service_calls WHERE family_group_id=$1)`, [row.id]);
      await client.query(`DELETE FROM service_call_messages WHERE call_id IN (SELECT id FROM service_calls WHERE family_group_id=$1)`, [row.id]);
      await client.query(`DELETE FROM service_calls WHERE family_group_id=$1`, [row.id]);
      // לומדות אקדמיה שנוצרו ע"י הסקריפט (לא קשורות ל-group_id ישירות)
      await client.query(`DELETE FROM quiz_bundles WHERE created_by='SEED'`);
      // family_groups עצמה - ON DELETE CASCADE אמור לנקות users/transactions/
      // goals/loans/pantry/shopping_list/tasks/flw_kid_wallets/flow_wallets/
      // family_communities וכו' (כולם מוגדרים עם group_id REFERENCES
      // family_groups(id) ON DELETE CASCADE בסכמה)
      await client.query(`DELETE FROM family_groups WHERE id=$1`, [row.id]);
      await client.query('COMMIT');
      console.log(`✓ נוקתה משפחת-דמו קודמת id=${row.id}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`✗ ניקוי משפחת-דמו קודמת id=${row.id} נכשל (ממשיכים בכל זאת ליצירת משפחה חדשה):`, e.message);
    }
  }
}

async function main() {
  const client = await pool.connect();
  console.log('=== seed-demo-family.js — זריעת משפחת דמו ===');

  try {
    // -----------------------------------------------------------
    // שלב -1: ניקוי משפחת-דמו קודמת (ר' הסבר ב-cleanupPreviousDemoFamily)
    // -----------------------------------------------------------
    await cleanupPreviousDemoFamily(client);

    // -----------------------------------------------------------
    // שלב 0: איתור ישויות קיימות (קהילה + 2 עסקים) — אסור ליצור!
    // -----------------------------------------------------------
    const community = await findByNameILike(client, 'communities', COMMUNITY_NAME_PATTERN);
    if (!community) {
      throw new Error(`לא נמצאה קהילה בשם דומה ל"נוקדים" (חיפוש ILIKE '${COMMUNITY_NAME_PATTERN}' בטבלת communities). עצירה.`);
    }
    console.log(`✓ קהילה נמצאה: id=${community.id}, name="${community.name}", code=${community.code}`);

    const pizzaBiz = await findByNameILike(client, 'family_groups', BIZ_PIZZA_PATTERN, `AND type='BUSINESS'`);
    if (!pizzaBiz) {
      throw new Error(`לא נמצא עסק בשם דומה ל"פיצה מושיק" (type='BUSINESS') בטבלת family_groups. עצירה.`);
    }
    console.log(`✓ עסק פיצה נמצא: id=${pizzaBiz.id}, name="${pizzaBiz.name}", group_code=${pizzaBiz.group_code}`);

    const goldBiz = await findByNameILike(client, 'family_groups', BIZ_GOLD_PATTERN, `AND type='BUSINESS'`);
    if (!goldBiz) {
      throw new Error(`לא נמצא עסק בשם דומה ל"יוסי ובניו ידי זהב" (type='BUSINESS') בטבלת family_groups. עצירה.`);
    }
    console.log(`✓ עסק שירות (ידי זהב) נמצא: id=${goldBiz.id}, name="${goldBiz.name}", group_code=${goldBiz.group_code}`);

    // -----------------------------------------------------------
    // שלב 1: יצירת קבוצת FAMILY חדשה
    // -----------------------------------------------------------
    let group, owner;
    const CHILDREN = [
      { ages: 10 }, { ages: 12 }, { ages: 14 } // ברירת מחדל — ר' הערה בראש הקובץ
    ];
    const currentYear = new Date().getFullYear();

    await client.query('BEGIN');
    try {
      // אם קוד הקבוצה הקבוע תפוס ע"י רשומה שלא נוקתה (למשל כשל בניקוי קודם),
      // נופלים חזרה לקוד אקראי במקום להיכשל - אבל במצב הרגיל (ניקוי הצליח)
      // תמיד ייווצר כאן עם FIXED_GROUP_CODE.
      const codeTaken = await client.query('SELECT 1 FROM family_groups WHERE group_code=$1', [FIXED_GROUP_CODE]);
      const groupCode = codeTaken.rows.length === 0 ? FIXED_GROUP_CODE : await uniqueGroupCode(client);
      if (groupCode !== FIXED_GROUP_CODE) {
        console.warn(`⚠ קוד הקבוצה הקבוע ${FIXED_GROUP_CODE} תפוס - נוצר קוד אקראי ${groupCode} במקום (ייתכן שהניקוי הקודם נכשל - כדאי לבדוק)`);
      }
      const familyLastName = 'לוי';
      const familyCity = 'ראשון לציון';

      const gRes = await client.query(
        `INSERT INTO family_groups (type, name, admin_email, group_code, community_id, family_nickname, last_name, city, plan, account_status, referred_by_group_id)
         VALUES ('FAMILY', $1, LOWER($2), $3, $4, $5, $6, $7, 'solo', 'active', NULL) RETURNING *`,
        [`משפחת ${familyLastName}`, DEMO_ADMIN_EMAIL, groupCode, community.id, 'משפחת הדמו', familyLastName, familyCity]
      );
      group = gRes.rows[0];
      bump('family_groups');
      console.log(`✓ נוצרה קבוצת משפחה חדשה: id=${group.id}, group_code=${group.group_code}`);

      // -----------------------------------------------------------
      // שלב 2: 2 הורים (ADMIN)
      // -----------------------------------------------------------
      const parentPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      const parentsData = [
        { first_name: 'דנה', last_name: familyLastName, nickname: 'דנה (אמא)', birth_year: currentYear - 38 },
        { first_name: 'איתי', last_name: familyLastName, nickname: 'איתי (אבא)', birth_year: currentYear - 40 }
      ];

      const parentUsers = [];
      for (let i = 0; i < parentsData.length; i++) {
        const p = parentsData[i];
        const phone = await uniquePhone(client, 1000 + i);
        const permissions = { tabs: ['feed', 'shop', 'tasks', 'budget', 'members', 'goals', 'pantry', 'loans', 'academy', 'cashflow', 'community'] };
        const uRes = await client.query(
          `INSERT INTO users (group_id, nickname, first_name, last_name, birth_year, password_hash, role, status, phone, registration_source, permissions, must_change_password)
           VALUES ($1,$2,$3,$4,$5,$6,'ADMIN','active',$7,'seed-script',$8,false) RETURNING *`,
          [group.id, p.nickname, p.first_name, p.last_name, p.birth_year, parentPasswordHash, phone, JSON.stringify(permissions)]
        );
        parentUsers.push(uRes.rows[0]);
        bump('users');
      }
      owner = parentUsers[0];

      await client.query(`UPDATE family_groups SET owner_user_id=$1 WHERE id=$2`, [owner.id, group.id]);

      // -----------------------------------------------------------
      // שלב 3: 3 ילדים (CHILD)
      // -----------------------------------------------------------
      const childNames = [
        { first_name: 'נויה', nickname: 'נויה' },
        { first_name: 'עומר', nickname: 'עומר' },
        { first_name: 'תום', nickname: 'תום' }
      ];
      const childPermissions = { tabs: ['feed', 'shop', 'tasks', 'goals', 'academy', 'bank', 'cashflow', 'community'] };

      const childUsers = [];
      for (let i = 0; i < CHILDREN.length; i++) {
        const age = CHILDREN[i].ages;
        const birthYear = currentYear - age;
        const cn = childNames[i];
        const phone = age >= 10 ? await uniquePhone(client, 2000 + i) : null;
        const uRes = await client.query(
          `INSERT INTO users (group_id, nickname, first_name, last_name, birth_year, password_hash, role, status, phone, registration_source, permissions, must_change_password)
           VALUES ($1,$2,$3,$4,$5,$6,'CHILD','active',$7,'seed-script',$8,false) RETURNING *`,
          [group.id, cn.nickname, cn.first_name, familyLastName, birthYear, parentPasswordHash, phone, JSON.stringify(childPermissions)]
        );
        childUsers.push({ ...uRes.rows[0], age });
        bump('users');
      }

      // welcome transaction (כמו בזרימת ההרשמה האמיתית)
      await client.query(
        `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1,$2,0,'הבנק המשפחתי נפתח בהצלחה! 🎉','system','income', FALSE)`,
        [owner.id, group.id]
      );
      bump('transactions');

      await client.query('COMMIT');
      console.log(`✓ נוצרו 2 הורים ו-${childUsers.length} ילדים (גילאים: ${childUsers.map(c => c.age).join('/')})`);

      // -----------------------------------------------------------
      // מכאן ואילך — כל סעיף בטרנזקציה נפרדת משלו, עם try/catch עצמאי
      // -----------------------------------------------------------
      global.__seedCtx = { group, owner, parentUsers, childUsers, community, pizzaBiz, goldBiz };
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error('כשל בשלב הקמת המשפחה/המשתמשים (שלב קריטי, לא ניתן להמשיך): ' + e.message);
    }

    const { parentUsers, childUsers } = global.__seedCtx;

    // =================================================================
    // SECTION A: family_communities — קישור לקהילה (approved)
    // =================================================================
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO family_communities (group_id, community_id) VALUES ($1,$2) ON CONFLICT (group_id, community_id) DO NOTHING`,
        [group.id, community.id]
      );
      bump('family_communities');
      await client.query('COMMIT');
      console.log('✓ SECTION A (family_communities) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION A FAILED (family_communities):', e.message);
    }

    // =================================================================
    // SECTION B: תזרים — transactions / budget_allocations
    // =================================================================
    try {
      await client.query('BEGIN');
      const now = new Date();
      const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
      const txRows = [
        { user: parentUsers[1], amount: 12500, desc: 'משכורת חודשית', cat: 'עסק', type: 'income', days: 55 },
        { user: parentUsers[0], amount: 4200, desc: 'משכורת חודשית', cat: 'עסק', type: 'income', days: 50 },
        { user: parentUsers[0], amount: 380, desc: 'קניות סופר שבועיות', cat: 'סופר ופארם', type: 'expense', days: 40 },
        { user: parentUsers[1], amount: 220, desc: 'ארוחת ערב משפחתית', cat: 'מסעדות', type: 'expense', days: 30 },
        { user: childUsers[0], amount: 40, desc: 'דמי כיס שבועיים', cat: 'דמי כיס', type: 'income', days: 21 },
        { user: parentUsers[0], amount: 650, desc: 'תדלוק + חניה', cat: 'תחבורה ודלק', type: 'expense', days: 14 },
        { user: parentUsers[1], amount: 300, desc: 'בונוס על יעד', cat: 'בונוס', type: 'income', days: 10 },
        { user: childUsers[1], amount: 25, desc: 'דמי כיס שבועיים', cat: 'דמי כיס', type: 'income', days: 7 }
      ];
      for (const t of txRows) {
        await client.query(
          `INSERT INTO transactions (user_id, group_id, amount, description, category, type, date, is_manual) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`,
          [t.user.id, group.id, t.amount, t.desc, t.cat, t.type, daysAgo(t.days)]
        );
        bump('transactions');
      }

      const budgetRows = [
        { cat: 'סופר ופארם', limit: 2200, target: null },
        { cat: 'מסעדות', limit: 800, target: null },
        { cat: 'דמי כיס לילדים', limit: 400, target: null }
      ];
      for (const b of budgetRows) {
        await client.query(
          `INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1,$2,$3,$4)
           ON CONFLICT (group_id, category, target_user_id) DO UPDATE SET amount_limit=EXCLUDED.amount_limit`,
          [group.id, b.cat, b.target, b.limit]
        );
        bump('budget_allocations');
      }

      // goals לשני ילדים
      await client.query(
        `INSERT INTO goals (user_id, target_user_id, title, target_amount, current_amount) VALUES ($1,$1,'אופניים חדשות',900,180)`,
        [childUsers[0].id]
      );
      await client.query(
        `INSERT INTO goals (user_id, target_user_id, title, target_amount, current_amount) VALUES ($1,$1,'קונסולת משחקים',1500,0)`,
        [childUsers[1].id]
      );
      bump('goals', 2);

      // loans
      await client.query(
        `INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status) VALUES ($1,$2,300,300,'הלוואה לרכישת אוזניות',  'pending')`,
        [childUsers[2].id, group.id]
      );
      await client.query(
        `INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status) VALUES ($1,$2,600,350,'הלוואה לטיול כיתתי','approved')`,
        [childUsers[0].id, group.id]
      );
      bump('loans', 2);

      await client.query('COMMIT');
      console.log('✓ SECTION B (transactions/budget/goals/loans) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION B FAILED (cashflow/budget/goals/loans):', e.message);
    }

    // =================================================================
    // SECTION C: Flw wallets + flow_wallets
    // =================================================================
    try {
      await client.query('BEGIN');
      const flwAmounts = [75, 40, 20];
      for (let i = 0; i < childUsers.length; i++) {
        const bal = flwAmounts[i] ?? 25;
        await client.query(
          `INSERT INTO flw_kid_wallets (child_user_id, family_group_id, balance_flw, lifetime_flw)
           VALUES ($1,$2,$3,$3)
           ON CONFLICT (child_user_id) DO UPDATE SET balance_flw=EXCLUDED.balance_flw, lifetime_flw=flw_kid_wallets.lifetime_flw+EXCLUDED.lifetime_flw`,
          [childUsers[i].id, group.id, bal]
        );
        bump('flw_kid_wallets');
      }

      await client.query(
        `INSERT INTO flow_wallets (entity_type, entity_id, balance) VALUES ('family',$1,45)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET balance=EXCLUDED.balance`,
        [group.id]
      );
      bump('flow_wallets');

      await client.query('COMMIT');
      console.log('✓ SECTION C (flw_kid_wallets/flow_wallets) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION C FAILED (bank/Flw wallets):', e.message);
    }

    // =================================================================
    // SECTION D: מזווה (pantry)
    // =================================================================
    try {
      await client.query('BEGIN');
      const pantryItems = [
        { name: 'קמח', qty: 2, unit: 'ק"ג', upp: 1 },
        { name: 'סוכר', qty: 1, unit: 'ק"ג', upp: 1 },
        { name: 'שמן קנולה', qty: 0.5, unit: 'ליטר', upp: 1 }, // נמוך
        { name: 'אורז', qty: 3, unit: 'ק"ג', upp: 1 },
        { name: 'פסטה', qty: 4, unit: 'חבילה', upp: 1 },
        { name: 'חלב', qty: 1, unit: 'ליטר', upp: 1 }, // נמוך
        { name: 'ביצים', qty: 12, unit: 'יח׳', upp: 1 },
        { name: 'נייר טואלט', qty: 2, unit: 'חבילה', upp: 24 },
        { name: 'סבון כלים', qty: 1, unit: 'יח׳', upp: 1 },
        { name: 'קפה שחור', qty: 0.3, unit: 'ק"ג', upp: 1 } // נמוך
      ];
      for (const p of pantryItems) {
        await client.query(
          `INSERT INTO pantry (group_id, item_name, quantity, unit, units_per_package) VALUES ($1,$2,$3,$4,$5)`,
          [group.id, p.name, p.qty, p.unit, p.upp]
        );
        bump('pantry');
      }
      await client.query('COMMIT');
      console.log('✓ SECTION D (pantry) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION D FAILED (pantry):', e.message);
    }

    // =================================================================
    // SECTION E: רשימת קניות (shopping_list)
    // =================================================================
    try {
      await client.query('BEGIN');
      const shoppingItems = [
        { requester: parentUsers[0], name: 'עגבניות', status: 'pending' },
        { requester: parentUsers[0], name: 'לחם פרוס', status: 'pending' },
        { requester: parentUsers[1], name: 'יוגורטים', status: 'in_cart' },
        { requester: childUsers[0], name: 'חטיף שוקולד', status: 'requested' },
        { requester: childUsers[1], name: 'גלידה', status: 'requested' }
      ];
      for (const s of shoppingItems) {
        await client.query(
          `INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, unit, status)
           VALUES ($1,$2,$3,$3,1,'יח׳',$4)`,
          [group.id, s.requester.id, s.name, s.status]
        );
        bump('shopping_list');
      }
      await client.query('COMMIT');
      console.log('✓ SECTION E (shopping_list) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION E FAILED (shopping_list):', e.message);
    }

    // =================================================================
    // SECTION F: משימות (tasks)
    // =================================================================
    try {
      await client.query('BEGIN');
      const taskRows = [
        { title: 'סידור החדר', assigned: childUsers[0], reward: 10, status: 'pending', recurring: true, days: '0,1,2,3,4,5,6' },
        { title: 'הוצאת זבל', assigned: childUsers[1], reward: 8, status: 'done', recurring: true, days: '0,3' },
        { title: 'שיעורי בית במתמטיקה', assigned: childUsers[2], reward: 15, status: 'approved', recurring: false, days: null },
        { title: 'האכלת חתול', assigned: childUsers[0], reward: 5, status: 'pending', recurring: true, days: '0,1,2,3,4,5,6' },
        { title: 'קיפול כביסה', assigned: childUsers[1], reward: 12, status: 'done', recurring: false, days: null }
      ];
      for (const t of taskRows) {
        await client.query(
          `INSERT INTO tasks (group_id, created_by, assigned_to, title, reward, status, is_recurring, recurring_days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [group.id, parentUsers[0].id, t.assigned.id, t.title, t.reward, t.status, t.recurring, t.days]
        );
        bump('tasks');
      }
      await client.query('COMMIT');
      console.log('✓ SECTION F (tasks) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION F FAILED (tasks):', e.message);
    }

    // =================================================================
    // SECTION G: אקדמיה (quiz_bundles + quiz_questions + user_assignments)
    // =================================================================
    try {
      await client.query('BEGIN');
      const bundleRes = await client.query(
        `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by)
         VALUES ('quiz','10-13','יסודות החיסכון','חידון קצר על חשיבות החיסכון וניהול כסף',70,10,'SEED') RETURNING id`
      );
      const bundle1 = bundleRes.rows[0].id;
      bump('quiz_bundles');

      const bundle2Res = await client.query(
        `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by)
         VALUES ('quiz','13-15','ריבית והלוואות','חידון על עולם הריבית וההלוואות',70,15,'SEED') RETURNING id`
      );
      const bundle2 = bundle2Res.rows[0].id;
      bump('quiz_bundles');

      const q1 = [
        { q: 'מהי "קרן" בהלוואה?', options: ['הסכום המקורי שהולווה', 'הריבית בלבד', 'עמלת הבנק', 'אין דבר כזה'], correct: 0 },
        { q: 'למה כדאי לחסוך חלק מדמי הכיס?', options: ['כדי לבזבז מהר יותר', 'כדי לבנות הרגל פיננסי בריא', 'אין סיבה', 'כדי לשלם מס'], correct: 1 },
        { q: 'מהי "תקציב"?', options: ['תוכנית הוצאות והכנסות', 'סוג מטבע', 'חשבון בנק', 'כרטיס אשראי'], correct: 0 }
      ];
      const q2 = [
        { q: 'מהי ריבית?', options: ['תוספת תשלום על כסף שהולווה', 'סוג מס', 'הנחה בחנות', 'בונוס חודשי'], correct: 0 },
        { q: 'מה קורה אם לא מחזירים הלוואה בזמן?', options: ['כלום', 'עלולה להצטבר ריבית/קנס פיגורים', 'מקבלים בונוס', 'ההלוואה נמחקת'], correct: 1 },
        { q: 'מהו "תזרים מזומנים"?', options: ['תנועת הכסף הנכנס והיוצא לאורך זמן', 'סוג חשבון חיסכון', 'מספר כרטיס האשראי', 'אין דבר כזה'], correct: 0 },
        { q: 'למה כדאי להשוות מחירים לפני קנייה?', options: ['כדי לבזבז יותר', 'כדי לחסוך כסף ולקבל ערך טוב יותר', 'זה לא משנה', 'כי זה חוקי'], correct: 1 }
      ];
      for (const q of q1) {
        await client.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bundle1, q.q, JSON.stringify(q.options), q.correct]);
        bump('quiz_questions');
      }
      for (const q of q2) {
        await client.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bundle2, q.q, JSON.stringify(q.options), q.correct]);
        bump('quiz_questions');
      }

      const assignments = [
        { user: childUsers[0], bundle: bundle1, status: 'assigned', score: null },
        { user: childUsers[1], bundle: bundle1, status: 'completed', score: 90 },
        { user: childUsers[2], bundle: bundle2, status: 'failed', score: 40 },
        { user: childUsers[2], bundle: bundle1, status: 'assigned', score: null }
      ];
      for (const a of assignments) {
        await client.query(
          `INSERT INTO user_assignments (user_id, bundle_id, status, score) VALUES ($1,$2,$3,$4)`,
          [a.user.id, a.bundle, a.status, a.score]
        );
        bump('user_assignments');
      }

      await client.query('COMMIT');
      console.log('✓ SECTION G (academy: quiz_bundles/quiz_questions/user_assignments) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION G FAILED (academy):', e.message);
    }

    // =================================================================
    // SECTION H: הזמנות מול "פיצה מושיק" (store_orders + store_order_items)
    // =================================================================
    try {
      await client.query('BEGIN');
      const now = new Date();
      const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
      const parentName = `${parentUsers[0].first_name} ${parentUsers[0].last_name}`;

      const ordersSpec = [
        {
          status: 'completed', days: 20, total: 92,
          items: [{ name: 'פיצה משפחתית - מרגריטה', qty: 1, price: 62 }, { name: 'שתיה 1.5 ליטר', qty: 1, price: 12 }, { name: 'לחם שום', qty: 1, price: 18 }]
        },
        {
          status: 'completed', days: 6, total: 78,
          items: [{ name: 'פיצה אישית - פפרוני', qty: 2, price: 39 }]
        },
        {
          status: 'new', days: 0, total: 54,
          items: [{ name: 'פיצה משפחתית - ירקות', qty: 1, price: 54 }]
        }
      ];

      for (const o of ordersSpec) {
        // store_orders.items (JSONB) הוא מקור הנתונים האמיתי שה-UI קורא ממנו
        // בפועל (ר' app.post('/api/store/orders') ב-server.js - תמיד נכתב, גם
        // כש-store_order_items מדלג על פריטים ללא catalog_id אמיתי). ממלאים
        // את שניהם כדי שההזמנה תוצג נכון גם אם מסך כלשהו קורא מהטבלה המנורמלת.
        const itemsJson = JSON.stringify(o.items.map(it => ({ name: it.name, qty: it.qty, quantity: it.qty, price: it.price })));
        const orderRes = await client.query(
          `INSERT INTO store_orders (group_id, customer_name, customer_phone, total_amount, status, created_at, family_group_id, order_source, items)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'website',$8) RETURNING id`,
          [pizzaBiz.id, parentName, parentUsers[0].phone, o.total, o.status, daysAgo(o.days), group.id, itemsJson]
        );
        const orderId = orderRes.rows[0].id;
        bump('store_orders');
        for (const it of o.items) {
          await client.query(
            `INSERT INTO store_order_items (order_id, item_name, quantity, price_at_order) VALUES ($1,$2,$3,$4)`,
            [orderId, it.name, it.qty, it.price]
          );
          bump('store_order_items');
        }
      }

      await client.query('COMMIT');
      console.log('✓ SECTION H (store_orders מול פיצה מושיק) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION H FAILED (pizza store_orders):', e.message);
    }

    // =================================================================
    // SECTION I: הצעת מחיר + קריאת שירות מול "יוסי ובניו ידי זהב"
    // הצעת מחיר ממומשת כרשומת store_orders עם quote_status (כפי שהמערכת
    // עושה בפועל — "הצעות מחיר" ו"פקודות עבודה" חולקות את טבלת store_orders),
    // וקריאת השירות עצמה ממומשת בטבלה הייעודית service_calls.
    // =================================================================
    try {
      await client.query('BEGIN');
      const parentName = `${parentUsers[1].first_name} ${parentUsers[1].last_name}`;

      // הצעת מחיר (quote) — נשמרת בטבלת store_orders עם quote_status
      const quoteItemsJson = JSON.stringify([
        { name: 'דלת ברזל 90 ס"מ כולל משקוף', qty: 1, quantity: 1, price: 1150 },
        { name: 'מנעול רב בריח 5 נקודות', qty: 1, quantity: 1, price: 220 },
        { name: 'התקנה ועבודה', qty: 1, quantity: 1, price: 80 },
      ]);
      // status='quote' + quote_status='waiting_customer' הם הערכים האמיתיים
      // שה-query של "הזמנות שלי"/הצעות מחיר מסנן לפיהם בפועל (ר' server.js,
      // שאילתות על store_orders בטאב ההצעות) - "ממתין לתשובתך".
      const quoteRes = await client.query(
        `INSERT INTO store_orders (group_id, customer_name, customer_phone, total_amount, status, quote_status, quote_title, family_group_id, items)
         VALUES ($1,$2,$3,$4,'quote','waiting_customer',$5,$6,$7) RETURNING id`,
        [goldBiz.id, parentName, parentUsers[1].phone, 1450, 'התקנת דלת ברזל + מנעול רב בריח', group.id, quoteItemsJson]
      );
      bump('store_orders');
      console.log(`  → quote id=${quoteRes.rows[0].id} (store_orders.status='quote', quote_status='waiting_customer')`);

      // קריאת שירות (service_calls)
      const callRes = await client.query(
        `INSERT INTO service_calls (family_group_id, business_group_id, title, description, address, status, priority, customer_name, customer_phone, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,'in_progress','normal',$6,$7,$8) RETURNING id`,
        [group.id, goldBiz.id, 'תיקון מנעול דלת כניסה', 'המנעול בדלת הכניסה נתקע ולא נפתח בבוקר, צריך טכנאי בהקדם.', 'רחוב הדמו 12, ראשון לציון', parentName, parentUsers[1].phone, parentUsers[1].id]
      );
      const callId = callRes.rows[0].id;
      bump('service_calls');

      await client.query(
        `INSERT INTO service_call_messages (call_id, sender_type, sender_name, message) VALUES ($1,'customer',$2,'שלום, מתי אפשר לצפות לטכנאי?')`,
        [callId, parentName]
      );
      await client.query(
        `INSERT INTO service_call_messages (call_id, sender_type, sender_name, message) VALUES ($1,'business','יוסי ובניו ידי זהב','שלום, נגיע מחר בין 10:00-12:00.')`,
        [callId]
      );
      bump('service_call_messages', 2);

      // שלב תשלום לקריאת השירות (work_order_payments תומך גם ב-service_call_id)
      await client.query(
        `INSERT INTO work_order_payments (service_call_id, total_amount) VALUES ($1,$2)`,
        [callId, 280]
      );
      bump('work_order_payments');

      await client.query('COMMIT');
      console.log('✓ SECTION I (quote + service_calls מול יוסי ובניו ידי זהב) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION I FAILED (quote/service_call ידי זהב):', e.message);
    }

    // =================================================================
    // SECTION J: ניהול הבית — equipment_technicians / equipment_items /
    // equipment_maintenance / equipment_faults / equipment_loans
    // (קטגוריות תואמות ל-HM_CAT_COLORS ב-public/app.js)
    // =================================================================
    try {
      await client.query('BEGIN');
      const hmNow = new Date();
      const hmDaysAgo = (n) => new Date(hmNow.getTime() - n * 24 * 60 * 60 * 1000);
      const hmDaysAhead = (n) => new Date(hmNow.getTime() + n * 24 * 60 * 60 * 1000);

      const techRows = [
        { name: 'דורון חשמלאי', company: 'דורון שירותי חשמל', phone: '0521234567', specialty: 'חשמל' },
        { name: 'אבי מזגנים', company: 'קרירות אבי', phone: '0537654321', specialty: 'מזגן' },
        { name: 'משה אינסטלטור', company: 'מים ומשה', phone: '0541122334', specialty: 'אינסטלציה' },
        { name: 'רוני תיקוני רכב', company: 'מוסך רוני', phone: '0528899001', specialty: 'רכב' },
        { name: 'יעל מקררים', company: 'קירור יעל', phone: '0533344556', specialty: 'מקרר/הקפאה' },
        { name: 'שי תנורים ואפייה', company: 'שי שירות טכני', phone: '0509988776', specialty: 'תנור/אפייה' },
        { name: 'עומר הנדימן כללי', company: 'הנדימן עומר', phone: '0527766554', specialty: 'כללי' },
        { name: 'גלית מנעולנית', company: 'מנעולי גלית', phone: '0546677889', specialty: 'אינסטלציה' },
        { name: 'בני חשמלאי מוסמך', company: 'חשמל בני ובניו', phone: '0512233445', specialty: 'חשמל' },
        { name: 'טל גינון ותחזוקה', company: 'גינות טל', phone: '0539900112', specialty: 'כללי' }
      ];
      const techIds = [];
      for (const t of techRows) {
        const r = await client.query(
          `INSERT INTO equipment_technicians (group_id, name, company_name, phone, specialty) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [group.id, t.name, t.company, t.phone, t.specialty]
        );
        techIds.push(r.rows[0].id);
        bump('equipment_technicians');
      }

      const itemRows = [
        { name: 'מקרר סמסונג', category: 'מקרר/הקפאה', serial: 'SN-RF-2021', purchase: hmDaysAgo(900), warranty: hmDaysAhead(0 - 30), techIdx: 4 },
        { name: 'מזגן סלון', category: 'מזגן', serial: 'SN-AC-1180', purchase: hmDaysAgo(400), warranty: hmDaysAhead(330), techIdx: 1 },
        { name: 'תנור אפייה', category: 'תנור/אפייה', serial: 'SN-OV-0099', purchase: hmDaysAgo(650), warranty: hmDaysAgo(20), techIdx: 5 },
        { name: 'רכב משפחתי - מאזדה 3', category: 'רכב', serial: 'SN-CAR-7788', purchase: hmDaysAgo(1200), warranty: null, techIdx: 3 },
        { name: 'מזגן חדר הורים', category: 'מזגן', serial: 'SN-AC-2290', purchase: hmDaysAgo(250), warranty: hmDaysAhead(480), techIdx: 1 },
        { name: 'דוד שמש', category: 'אינסטלציה', serial: 'SN-WH-0456', purchase: hmDaysAgo(1500), warranty: null, techIdx: 2 },
        { name: 'לוח חשמל ראשי', category: 'חשמל', serial: 'SN-EL-1122', purchase: hmDaysAgo(2000), warranty: null, techIdx: 8 },
        { name: 'מכונת כביסה', category: 'כללי', serial: 'SN-WM-3344', purchase: hmDaysAgo(500), warranty: hmDaysAhead(210), techIdx: 6 },
        { name: 'מייבש כביסה', category: 'כללי', serial: 'SN-DR-5566', purchase: hmDaysAgo(500), warranty: hmDaysAhead(210), techIdx: 6 },
        { name: 'מדיח כלים', category: 'כללי', serial: 'SN-DW-7788', purchase: hmDaysAgo(300), warranty: hmDaysAhead(430), techIdx: 6 }
      ];
      const itemIds = [];
      for (const it of itemRows) {
        const techId = it.techIdx !== null ? techIds[it.techIdx] : null;
        const r = await client.query(
          `INSERT INTO equipment_items (group_id, name, category, serial_number, purchase_date, warranty_expiry, status, technician_id)
           VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING id`,
          [group.id, it.name, it.category, it.serial, it.purchase, it.warranty, techId]
        );
        itemIds.push(r.rows[0].id);
        bump('equipment_items');
      }

      // תחזוקה — 10 רשומות: הושלמו/ממתינות/מתוזמנות
      const maintRows = [
        { itemIdx: 1, type: 'periodic', desc: 'ניקוי מסננים וגז', days: -60, status: 'completed', cost: 280, techIdx: 1 },
        { itemIdx: 0, type: 'periodic', desc: 'בדיקת תקינות שנתית', days: 14, status: 'pending', cost: null, techIdx: 4 },
        { itemIdx: 4, type: 'periodic', desc: 'ניקוי מסננים וגז - חדר הורים', days: -30, status: 'completed', cost: 260, techIdx: 1 },
        { itemIdx: 5, type: 'periodic', desc: 'בדיקת אלמנט חימום בדוד', days: 21, status: 'pending', cost: null, techIdx: 2 },
        { itemIdx: 6, type: 'periodic', desc: 'בדיקת לוח חשמל תקופתית', days: -400, status: 'completed', cost: 350, techIdx: 8 },
        { itemIdx: 2, type: 'repair', desc: 'החלפת גוף חימום בתנור', days: -15, status: 'completed', cost: 420, techIdx: 5 },
        { itemIdx: 3, type: 'periodic', desc: 'טיפול 10,000 ק"מ', days: 30, status: 'pending', cost: null, techIdx: 3 },
        { itemIdx: 7, type: 'repair', desc: 'תיקון דליפה במכונת כביסה', days: -10, status: 'completed', cost: 190, techIdx: 6 },
        { itemIdx: 8, type: 'periodic', desc: 'ניקוי מסנן מייבש', days: 7, status: 'pending', cost: null, techIdx: 6 },
        { itemIdx: 9, type: 'periodic', desc: 'ניקוי מסנני מדיח', days: -5, status: 'completed', cost: 0, techIdx: 6 }
      ];
      for (const m of maintRows) {
        const tech = techRows[m.techIdx];
        if (m.status === 'completed') {
          await client.query(
            `INSERT INTO equipment_maintenance (equipment_id, group_id, maintenance_type, description, scheduled_date, completed_date, status, cost, technician_name, technician_phone)
             VALUES ($1,$2,$3,$4,$5,$5,'completed',$6,$7,$8)`,
            [itemIds[m.itemIdx], group.id, m.type, m.desc, hmDaysAgo(-m.days), m.cost, tech.name, tech.phone]
          );
        } else {
          await client.query(
            `INSERT INTO equipment_maintenance (equipment_id, group_id, maintenance_type, description, scheduled_date, status, technician_name, technician_phone, interval_days)
             VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,365)`,
            [itemIds[m.itemIdx], group.id, m.type, m.desc, hmDaysAhead(m.days), tech.name, tech.phone]
          );
        }
        bump('equipment_maintenance');
      }

      // תקלות — 10 רשומות: פתוחות/בטיפול/טופלו, חומרות מגוונות
      const faultRows = [
        { itemIdx: 2, title: 'תנור לא מתחמם כראוי', desc: 'התנור לוקח הרבה זמן להגיע לטמפרטורה, ייתכן תקלה בגוף חימום', severity: 'high', status: 'open' },
        { itemIdx: 1, title: 'מזגן מרעיש בהפעלה', desc: 'רעש קליקים בהפעלה ראשונית', severity: 'low', status: 'resolved', resDays: -55, resNotes: 'התברר כאוויר בצנרת - טופל בבדיקת השירות התקופתית' },
        { itemIdx: 6, title: 'נתיך קופץ בחדר הכביסה', desc: 'הנתיך הראשי קופץ כשמפעילים כביסה ומזגן יחד', severity: 'high', status: 'open' },
        { itemIdx: 5, title: 'מים פושרים בלבד', desc: 'דוד השמש לא מספק מים חמים מספיק בימים מעוננים', severity: 'medium', status: 'open' },
        { itemIdx: 3, title: 'חריקה בבלמים', desc: 'חריקה קלה בבלימה, נשמעת בעיקר במהירות נמוכה', severity: 'medium', status: 'resolved', resDays: -20, resNotes: 'הוחלפו רפידות בלם במוסך' },
        { itemIdx: 7, title: 'מכונת כביסה מרעידה חזק', desc: 'רעידות חזקות בסחיטה, ייתכן חוסר איזון', severity: 'medium', status: 'in_progress' },
        { itemIdx: 0, title: 'איטום דלת מקרר רופף', desc: 'הגומייה סביב הדלת לא אוטמת היטב', severity: 'low', status: 'open' },
        { itemIdx: 9, title: 'מדיח לא מייבש כלים', desc: 'הכלים יוצאים רטובים בסוף המחזור', severity: 'low', status: 'resolved', resDays: -8, resNotes: 'התברר מחסור במלח למדיח - טופל' },
        { itemIdx: 4, title: 'טפטוף מהמזגן', desc: 'טפטוף מים קל מיחידת המזגן בחדר ההורים', severity: 'medium', status: 'open' },
        { itemIdx: 8, title: 'מייבש לא מסיים ייבוש', desc: 'הבגדים יוצאים לחים בסוף התוכנית', severity: 'medium', status: 'in_progress' }
      ];
      for (const f of faultRows) {
        if (f.status === 'resolved') {
          await client.query(
            `INSERT INTO equipment_faults (equipment_id, group_id, title, description, severity, status, resolved_date, resolution_notes)
             VALUES ($1,$2,$3,$4,$5,'resolved',$6,$7)`,
            [itemIds[f.itemIdx], group.id, f.title, f.desc, f.severity, hmDaysAgo(-f.resDays), f.resNotes]
          );
        } else {
          await client.query(
            `INSERT INTO equipment_faults (equipment_id, group_id, title, description, severity, status)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [itemIds[f.itemIdx], group.id, f.title, f.desc, f.severity, f.status]
          );
        }
        bump('equipment_faults');
      }

      // השאלות ציוד — 3 (לא נדרש 10, פיצ'ר משני)
      const loanRows = [
        { itemIdx: 3, borrower: 'יונתן השכן', phone: '0541112233', days: 5, notes: 'השאלת סולם לצורך תלייה', returned: false },
        { itemIdx: 6, borrower: 'משפחת אברג׳יל', phone: '0528765432', days: 20, notes: 'השאלת מברג חשמלי', returned: true },
        { itemIdx: 7, borrower: 'אורית מהבניין', phone: '0537651234', days: 2, notes: 'השאלת מגהץ קיטור', returned: false }
      ];
      for (const l of loanRows) {
        await client.query(
          `INSERT INTO equipment_loans (equipment_id, group_id, borrower_name, borrower_phone, loaned_at, returned_at, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [itemIds[l.itemIdx], group.id, l.borrower, l.phone, hmDaysAgo(l.days), l.returned ? hmDaysAgo(l.days - 3) : null, l.notes]
        );
        bump('equipment_loans');
      }

      await client.query('COMMIT');
      console.log('✓ SECTION J (ניהול הבית: ציוד/תחזוקה/תקלות/אנשי קשר/השאלות) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION J FAILED (ניהול הבית):', e.message);
    }

    // =================================================================
    // SECTION K: תשקיף — תנועות קבועות (recurring) לטווח קדימה
    // (התשקיף נגזר ב-UI ישירות מ-transactions עם is_recurring=true,
    // אין טבלה ייעודית - ר' renderForecast ב-public/app.js)
    // =================================================================
    try {
      await client.query('BEGIN');
      const fcNow = new Date();
      const fcMonthStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const fcEndMonth = fcMonthStr(new Date(fcNow.getFullYear(), fcNow.getMonth() + 6, 1));

      const recurringRows = [
        { user: parentUsers[0], amount: 4500, desc: 'שכירות דירה', cat: 'דיור', type: 'expense' },
        { user: parentUsers[1], amount: 420, desc: 'ביטוח רכב חודשי', cat: 'תחבורה ודלק', type: 'expense' },
        { user: parentUsers[0], amount: 150, desc: 'מנוי חדר כושר', cat: 'בריאות וספורט', type: 'expense' },
        { user: parentUsers[1], amount: 300, desc: 'קצבת ילדים (ביטוח לאומי)', cat: 'קצבאות', type: 'income' },
        { user: parentUsers[0], amount: 220, desc: 'ביטוח בריאות משלים', cat: 'בריאות וספורט', type: 'expense' },
        { user: parentUsers[1], amount: 180, desc: 'ארנונה חודשית', cat: 'דיור', type: 'expense' },
        { user: parentUsers[0], amount: 99, desc: 'מנוי סטרימינג (טלוויזיה+סרטים)', cat: 'בילויים ופנאי', type: 'expense' },
        { user: parentUsers[1], amount: 250, desc: 'חוג כדורגל - עומר', cat: 'חוגים לילדים', type: 'expense' },
        { user: parentUsers[0], amount: 200, desc: 'חוג בלט - נויה', cat: 'חוגים לילדים', type: 'expense' },
        { user: parentUsers[1], amount: 12500, desc: 'משכורת חודשית', cat: 'עסק', type: 'income' }
      ];
      for (const r of recurringRows) {
        await client.query(
          `INSERT INTO transactions (user_id, group_id, amount, description, category, type, date, is_recurring, end_month, is_manual)
           VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,TRUE)`,
          [r.user.id, group.id, r.amount, r.desc, r.cat, r.type, fcNow, fcEndMonth]
        );
        bump('transactions');
      }

      await client.query('COMMIT');
      console.log('✓ SECTION K (תשקיף: תנועות קבועות 6 חודשים קדימה) הושלם בהצלחה');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('✗ SECTION K FAILED (תשקיף):', e.message);
    }

    // =================================================================
    // סיכום סופי
    // =================================================================
    console.log('\n================= סיכום =================');
    console.log(`קבוצת משפחה: ${group.name}  |  group_code: ${group.group_code}  |  id: ${group.id}`);
    console.log(`סיסמה משותפת לכל חברי המשפחה: ${DEMO_PASSWORD}`);
    console.log('חברי המשפחה:');
    for (const p of parentUsers) console.log(`  - ${p.nickname}  (ADMIN)`);
    for (const c of childUsers) console.log(`  - ${c.nickname}  (CHILD, גיל ${c.age})`);
    console.log(`קהילה מקושרת: ${community.name} (id=${community.id})`);
    console.log(`עסק פיצה מקושר: ${pizzaBiz.name} (id=${pizzaBiz.id})`);
    console.log(`עסק שירות מקושר: ${goldBiz.name} (id=${goldBiz.id})`);
    console.log('------------------------------------------');
    console.log('שורות שנוספו לפי טבלה:');
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table}: ${n}`);
    console.log('===========================================\n');
  } catch (e) {
    console.error('\n❌ שגיאה קריטית — הסקריפט נעצר:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
