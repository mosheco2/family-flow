const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ שגיאה: לא נמצא משתנה DATABASE_URL בקובץ .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function resetDatabase() {
  console.log('🔄 מתחבר למסד הנתונים ב-Render...');
  const client = await pool.connect();
  
  try {
    // שלב א': שליפת כל הטבלאות הקיימות בסכמה הציבורית (public)
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `);
    
    // סינון טבלאות מערכת פנימיות אם ישנן, ועטיפת שמות הטבלאות במרכאות כפולות עקב תמיכה באותיות קטנות/גדולות
    const tables = res.rows
      .map(row => `"${row.table_name}"`)
      .filter(name => !name.includes('spatial_ref_sys')); // הגנה מפני טבלאות מערכת גיאוגרפיות במידה וקיימות

    if (tables.length === 0) {
      console.log('✨ מסד הנתונים כבר ריק לחלוטין מטבלאות. אין מה לנקות.');
      return;
    }

    console.log(`🗑️ נמצאו ${tables.length} טבלאות. מתחיל מחיקה המונית של המידע...`);

    // שלב ב': הרצת פקודת מחיקה משולבת שמנקה את כל הטבלאות ומאפסת מזהים (IDs)
    const truncateQuery = `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;
    await client.query(truncateQuery);
    
    console.log('✅ הניקוי הושלם בהצלחה! כל נתוני הבדיקות נמחקו. שלד הטבלאות נשמר ונשאר ריק.');

  } catch (err) {
    console.error('❌ שגיאה קריטית במהלך איפוס מסד הנתונים:', err);
  } finally {
    // סגירת החיבור וסיום התהליך
    client.release();
    await pool.end();
  }
}

// הרצת פונקציית האיפוס
resetDatabase();