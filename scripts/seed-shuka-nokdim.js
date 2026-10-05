/**
 * seed-shuka-nokdim.js
 * ============================================================
 * מכניס את כל העסקים הקיימים במערכת לקהילת "נוקדים", ומשקף מכל
 * עסק עד 10 מוצרים לשוק ה"שוקה" הקיים של אותה קהילה, במחירים
 * ייעודיים לשוק (הנחה מול הקטלוג הרגיל).
 *
 * ⚠️ חשוב — קרא לפני הרצה:
 * נכתב ולא הורץ מול ה-DB האמיתי (אין גישת רשת ל-DATABASE_URL מסביבת
 * הכתיבה). יש להריץ בעצמכם בסביבה עם גישה ל-DB, ולעבור על פלט
 * הקונסול סעיף-אחר-סעיף.
 *
 * הסקריפט אידמפוטנטי — אפשר להריץ כמה פעמים בבטחה:
 *   - חברות בקהילה (community_businesses) — UPSERT לפי (community_id, business_id)
 *   - חברות בקמפיין (community_campaign_businesses) — UPSERT לפי (campaign_id, business_group_id)
 *   - מוצרים בקמפיין (community_campaign_products) — UPSERT לפי (campaign_id, catalog_id),
 *     מחיר/סטטוס מחושבים דטרמיניסטית לפי catalog_id כך שהרצה חוזרת נותנת תוצאה זהה
 *   - רשומת community_campaign_requests נוצרת רק אם אין עדיין אף בקשה לצמד הזה
 *     (לא יוצר כפילויות בהרצות חוזרות)
 *
 * מגוון מכוון לצורך בדיקת כל מצבי ה-UI (לפי docs/test-checklist-shuka.md):
 *   - כ-70% מהמוצרים שמוקצים -> approval_status='approved' (יופיעו בעמוד השוק הציבורי)
 *   - כ-20% -> 'pending' (לבדיקת תור הסקירה אצל מנהל הקהילה/אזור)
 *   - כ-10% -> 'rejected' (לבדיקת מוצר שנדחה, לא מוצג בשוק)
 *
 * הרצה:
 *   node scripts/seed-shuka-nokdim.js
 * ============================================================
 */

'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const COMMUNITY_NAME_PATTERN = '%נוקדים%';
const PRODUCTS_PER_BUSINESS = 10;

const counts = {};
function bump(table, n = 1) { counts[table] = (counts[table] || 0) + n; }

// הנחה דטרמיניסטית לפי catalogId (75%-90% מהמחיר המקורי) - אותה תוצאה בכל הרצה
function specialPrice(basePrice, catalogId) {
  const factors = [0.75, 0.80, 0.85, 0.90];
  const f = factors[catalogId % factors.length];
  const price = Math.round((parseFloat(basePrice) || 0) * f * 2) / 2; // עיגול לחצי שקל
  return Math.max(price, 0);
}

// סטטוס אישור דטרמיניסטי לפי catalogId - כ-70% approved / 20% pending / 10% rejected
function approvalStatusFor(catalogId) {
  const m = catalogId % 10;
  if (m < 7) return 'approved';
  if (m < 9) return 'pending';
  return 'rejected';
}

async function main() {
  const client = await pool.connect();
  console.log('=== seed-shuka-nokdim.js — זריעת עסקים + מוצרים לשוקה "נוקדים" ===');

  try {
    // -----------------------------------------------------------
    // שלב 0: איתור קהילת "נוקדים" והקמפיין הקיים שלה
    // -----------------------------------------------------------
    const commRes = await client.query(
      `SELECT * FROM communities WHERE name ILIKE $1 ORDER BY id ASC LIMIT 1`, [COMMUNITY_NAME_PATTERN]);
    if (!commRes.rows.length) {
      throw new Error(`לא נמצאה קהילה בשם דומה ל"נוקדים" (ILIKE '${COMMUNITY_NAME_PATTERN}'). עצירה.`);
    }
    const community = commRes.rows[0];
    console.log(`✓ קהילה נמצאה: id=${community.id}, name="${community.name}", code=${community.code}`);

    const campRes = await client.query(
      `SELECT * FROM community_campaigns WHERE community_id=$1 ORDER BY created_at DESC LIMIT 1`, [community.id]);
    if (!campRes.rows.length) {
      throw new Error(`לא נמצא קמפיין "שוקה" קיים לקהילה id=${community.id}. יש ליצור קמפיין קודם דרך מנהל הקהילה/אזור. עצירה.`);
    }
    const campaign = campRes.rows[0];
    console.log(`✓ קמפיין "שוקה" נמצא: id=${campaign.id}, title="${campaign.title || '(ללא כותרת)'}", code=${campaign.code}, status=${campaign.status}`);

    // -----------------------------------------------------------
    // שלב 1: כל העסקים הקיימים במערכת
    // -----------------------------------------------------------
    const bizRes = await client.query(
      `SELECT id, name, business_type, group_code FROM family_groups WHERE type='BUSINESS' AND (is_deleted=false OR is_deleted IS NULL) ORDER BY id ASC`);
    const businesses = bizRes.rows;
    console.log(`✓ נמצאו ${businesses.length} עסקים במערכת`);
    if (!businesses.length) {
      throw new Error('לא נמצא אף עסק פעיל במערכת. עצירה.');
    }

    let joinedCount = 0, requestsCreatedCount = 0, productsSubmittedCount = 0, approvedCount = 0, pendingCount = 0, rejectedCount = 0;
    const perBusinessSummary = [];

    for (const biz of businesses) {
      try {
        await client.query('BEGIN');

        // --- 1. חברות בקהילה (approved) ---
        await client.query(
          `INSERT INTO community_businesses (community_id, business_id, status)
           VALUES ($1,$2,'approved')
           ON CONFLICT (community_id, business_id) DO UPDATE SET status='approved'`,
          [community.id, biz.id]);
        bump('community_businesses');

        // --- 2. רשומת בקשה היסטורית (רק אם עדיין אין אף בקשה לצמד הזה) ---
        const existingReq = await client.query(
          `SELECT 1 FROM community_campaign_requests WHERE campaign_id=$1 AND business_group_id=$2 LIMIT 1`,
          [campaign.id, biz.id]);
        if (!existingReq.rows.length) {
          // מחצית מהעסקים "ביקשו" להצטרף בעצמם, מחצית "הוזמנו" ע"י הקהילה — לכיסוי שני הכיוונים
          const direction = biz.id % 2 === 0 ? 'business_request' : 'manager_invite';
          await client.query(
            `INSERT INTO community_campaign_requests (campaign_id, business_group_id, direction, status, message, responded_at)
             VALUES ($1,$2,$3,'approved',$4,NOW())`,
            [campaign.id, biz.id, direction, 'seed-shuka-nokdim']);
          requestsCreatedCount++;
          bump('community_campaign_requests');
        }

        // --- 3. חברות בקמפיין (העסק "בשוק" בפועל) ---
        await client.query(
          `INSERT INTO community_campaign_businesses (campaign_id, business_group_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [campaign.id, biz.id]);
        joinedCount++;
        bump('community_campaign_businesses');

        // --- 4. עד 10 מוצרים מהקטלוג של העסק, במחיר שוק ייעודי ---
        const catalogRes = await client.query(
          `SELECT id, name, price FROM store_catalog WHERE group_id=$1 ORDER BY id ASC LIMIT $2`,
          [biz.id, PRODUCTS_PER_BUSINESS]);

        let bizProductsCount = 0;
        for (const item of catalogRes.rows) {
          const priceOverride = specialPrice(item.price, item.id);
          const status = approvalStatusFor(item.id);
          const reviewedAt = status === 'pending' ? null : 'NOW()';
          await client.query(
            `INSERT INTO community_campaign_products (campaign_id, business_group_id, catalog_id, price_override, approval_status, reviewed_at)
             VALUES ($1,$2,$3,$4,$5,${reviewedAt ? 'NOW()' : 'NULL'})
             ON CONFLICT (campaign_id, catalog_id) DO UPDATE SET
               price_override=$4, approval_status=$5, reviewed_at=${reviewedAt ? 'NOW()' : 'NULL'}`,
            [campaign.id, biz.id, item.id, priceOverride, status]);
          bizProductsCount++;
          productsSubmittedCount++;
          if (status === 'approved') approvedCount++;
          else if (status === 'pending') pendingCount++;
          else rejectedCount++;
        }
        bump('community_campaign_products', bizProductsCount);

        await client.query('COMMIT');
        perBusinessSummary.push(`  - ${biz.name} (id=${biz.id}, ${biz.business_type || 'כללי'}): ${bizProductsCount} מוצרים הוקצו לשוק`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`✗ עסק id=${biz.id} (${biz.name}) נכשל: ${e.message} — ממשיכים לעסק הבא`);
      }
    }

    console.log('\n================= סיכום =================');
    console.log(`קהילה: ${community.name} (id=${community.id})`);
    console.log(`קמפיין שוקה: ${campaign.title || campaign.code} (id=${campaign.id}, code=${campaign.code})`);
    console.log(`קישור ציבורי: /campaign/${campaign.code}`);
    console.log('------------------------------------------');
    console.log(`עסקים שעובדו: ${businesses.length}`);
    console.log(`עסקים שהצטרפו לשוק (community_campaign_businesses): ${joinedCount}`);
    console.log(`בקשות היסטוריות חדשות שנוצרו (community_campaign_requests): ${requestsCreatedCount}`);
    console.log(`מוצרים שהוקצו לשוק: ${productsSubmittedCount}`);
    console.log(`  מתוכם: ${approvedCount} אושרו | ${pendingCount} ממתינים לאישור | ${rejectedCount} נדחו`);
    console.log('------------------------------------------');
    console.log('פירוט לפי עסק:');
    perBusinessSummary.forEach(line => console.log(line));
    console.log('------------------------------------------');
    console.log('שורות שנוספו/עודכנו לפי טבלה:');
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
