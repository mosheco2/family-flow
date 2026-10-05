/**
 * remove-shuka-nokdim-no-image.js
 * ============================================================
 * מוחק מהקמפיין "שוקה" של קהילת "נוקדים אל דויד" כל מוצר שאין לו
 * תמונה (store_catalog.image_url ריק/NULL) - לא מוחק את המוצר
 * מהקטלוג של העסק עצמו, רק מסיר אותו מהשוק (community_campaign_products).
 *
 * ⚠️ לא הורץ מול ה-DB האמיתי (אין גישת רשת מסביבת הכתיבה) - יש להריץ
 * בעצמכם ולעבור על הפלט.
 *
 * הרצה:
 *   node scripts/remove-shuka-nokdim-no-image.js
 * ============================================================
 */

'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const COMMUNITY_NAME_PATTERN = '%נוקדים אל דויד%';

async function main() {
  const client = await pool.connect();
  console.log('=== remove-shuka-nokdim-no-image.js — הסרת מוצרים ללא תמונה משוקה נוקדים ===');

  try {
    const commRes = await client.query(
      `SELECT * FROM communities WHERE name ILIKE $1 ORDER BY id ASC LIMIT 1`, [COMMUNITY_NAME_PATTERN]);
    if (!commRes.rows.length) {
      throw new Error(`לא נמצאה קהילה בשם דומה ל"נוקדים אל דויד" (ILIKE '${COMMUNITY_NAME_PATTERN}'). עצירה.`);
    }
    const community = commRes.rows[0];
    console.log(`✓ קהילה נמצאה: id=${community.id}, name="${community.name}"`);

    const campRes = await client.query(
      `SELECT * FROM community_campaigns WHERE community_id=$1 ORDER BY created_at DESC LIMIT 1`, [community.id]);
    if (!campRes.rows.length) {
      throw new Error(`לא נמצא קמפיין "שוקה" לקהילה id=${community.id}. עצירה.`);
    }
    const campaign = campRes.rows[0];
    console.log(`✓ קמפיין נמצא: id=${campaign.id}, title="${campaign.title || '(ללא כותרת)'}", code=${campaign.code}`);

    // מוצרים ללא תמונה שמוקצים כרגע לקמפיין הזה
    const noImageRes = await client.query(
      `SELECT p.catalog_id, p.business_group_id, sc.name AS product_name, fg.name AS business_name
       FROM community_campaign_products p
       JOIN store_catalog sc ON sc.id = p.catalog_id
       JOIN family_groups fg ON fg.id = p.business_group_id
       WHERE p.campaign_id=$1 AND (sc.image_url IS NULL OR sc.image_url = '')
       ORDER BY fg.name, sc.name`,
      [campaign.id]);

    if (!noImageRes.rows.length) {
      console.log('✓ לא נמצאו מוצרים ללא תמונה בקמפיין הזה - אין מה למחוק.');
      return;
    }

    console.log(`נמצאו ${noImageRes.rows.length} מוצרים ללא תמונה להסרה:`);
    noImageRes.rows.forEach(r => console.log(`  - "${r.product_name}" (${r.business_name}, catalog_id=${r.catalog_id})`));

    const del = await client.query(
      `DELETE FROM community_campaign_products
       WHERE campaign_id=$1 AND catalog_id IN (
         SELECT p.catalog_id FROM community_campaign_products p
         JOIN store_catalog sc ON sc.id = p.catalog_id
         WHERE p.campaign_id=$1 AND (sc.image_url IS NULL OR sc.image_url = '')
       )`,
      [campaign.id]);

    console.log(`\n✓ הוסרו ${del.rowCount} מוצרים מהקמפיין "${campaign.title || campaign.code}" (רק מהשוק - לא נמחקו מהקטלוג של העסקים).`);
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
