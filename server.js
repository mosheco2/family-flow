const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// חיבור לבסיס הנתונים (Render PostgreSQL)
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Connection error', err.stack));

// --- MODULE 1: SETUP DB ---
// הרצת נתיב זה (/setup-db) בדפדפן תאפס את ה-DB ותיצור את הטבלאות החדשות
app.get('/setup-db', async (req, res) => {
  try {
    // 1. ניקוי טבלאות ישנות (אם קיימות)
    await client.query('DROP TABLE IF EXISTS shopping_trip_items CASCADE');
    await client.query('DROP TABLE IF EXISTS shopping_trips CASCADE');
    await client.query('DROP TABLE IF EXISTS product_prices CASCADE');
    await client.query('DROP TABLE IF EXISTS assignments CASCADE');
    await client.query('DROP TABLE IF EXISTS user_quiz_history CASCADE');
    await client.query('DROP TABLE IF EXISTS quizzes CASCADE');
    await client.query('DROP TABLE IF EXISTS activity_log CASCADE');
    await client.query('DROP TABLE IF EXISTS budgets CASCADE');
    await client.query('DROP TABLE IF EXISTS loans CASCADE');
    await client.query('DROP TABLE IF EXISTS goals CASCADE');
    await client.query('DROP TABLE IF EXISTS shopping_list CASCADE');
    await client.query('DROP TABLE IF EXISTS tasks CASCADE');
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS groups CASCADE');

    // 2. יצירת טבלת קבוצות (Groups)
    await client.query(`
      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        admin_email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('FAMILY', 'GROUP')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. יצירת טבלת משתמשים (Users)
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        nickname VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL, 
        role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'CHILD')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('ACTIVE', 'PENDING', 'BLOCKED')),
        birth_year INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, nickname)
      )
    `);

    res.send(`<h1 style="color:green">OneFlow Life Database Setup Complete!</h1><p>Groups and Users tables created successfully.</p>`);
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- MODULE 1: API ROUTES ---

// 1. יצירת קבוצה חדשה (והמנהל שלה)
app.post('/api/groups', async (req, res) => {
  const { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  
  try {
    await client.query('BEGIN');

    // בדיקה אם המייל כבר קיים כמנהל
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail.toLowerCase()]);
    if (check.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'כתובת המייל הזו כבר רשומה כמנהל קבוצה.' });
    }

    // יצירת הקבוצה
    const groupRes = await client.query(
      'INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id',
      [groupName, adminEmail.toLowerCase(), type]
    );
    const groupId = groupRes.rows[0].id;

    // יצירת המשתמש המנהל (ADMIN) - אוטומטית ACTIVE
    const userRes = await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year) 
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4) RETURNING id, nickname, role, status`,
      [groupId, adminNickname, password, birthYear]
    );

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      user: userRes.rows[0],
      group: { id: groupId, name: groupName, type, adminEmail: adminEmail.toLowerCase() }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת הקבוצה' });
  }
});

// 2. בקשת הצטרפות לקבוצה
app.post('/api/join', async (req, res) => {
  const { groupEmail, nickname, password, birthYear } = req.body;

  try {
    // מציאת הקבוצה לפי המייל
    const groupRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail.toLowerCase()]);
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצאה קבוצה עם המייל הזה.' });
    }
    const groupId = groupRes.rows[0].id;

    // בדיקת כפילות כינוי
    const userCheck = await client.query('SELECT id FROM users WHERE group_id = $1 AND nickname = $2', [groupId, nickname]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'הכינוי הזה כבר תפוס בקבוצה.' });
    }

    // יצירת משתמש (PENDING)
    await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year) 
       VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4)`,
      [groupId, nickname, password, birthYear]
    );

    res.json({ success: true, message: 'בקשת ההצטרפות נשלחה למנהל.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהצטרפות' });
  }
});

// 3. התחברות (Login)
app.post('/api/login', async (req, res) => {
  const { groupEmail, nickname, password } = req.body;

  try {
    // 1. מציאת הקבוצה
    const groupRes = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail.toLowerCase()]);
    if (groupRes.rows.length === 0) return res.status(401).json({ error: 'פרטי הזיהוי שגויים (קבוצה)' });
    const group = groupRes.rows[0];

    // 2. מציאת המשתמש
    const userRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2', [group.id, nickname]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'פרטי הזיהוי שגויים (משתמש)' });
    const user = userRes.rows[0];

    // 3. בדיקת סיסמה
    if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });

    // 4. בדיקת סטטוס
    if (user.status === 'PENDING') return res.status(403).json({ error: 'החשבון ממתין לאישור מנהל' });
    if (user.status === 'BLOCKED') return res.status(403).json({ error: 'החשבון חסום' });

    res.json({ 
      success: true, 
      user: { id: user.id, nickname: user.nickname, role: user.role, birth_year: user.birth_year },
      group: { id: group.id, name: group.name, type: group.type, adminEmail: group.admin_email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// 4. ADMIN: קבלת משתמשים ממתינים
app.get('/api/admin/pending-users', async (req, res) => {
  const { groupId } = req.query; 
  try {
    const result = await client.query(
      "SELECT id, nickname, birth_year, created_at FROM users WHERE group_id = $1 AND status = 'PENDING'", 
      [groupId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ADMIN: אישור משתמש
app.post('/api/admin/approve-user', async (req, res) => {
  const { userId } = req.body;
  try {
    await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// הפניית כל שאר הבקשות ל-index.html (עבור SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
