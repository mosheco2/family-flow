const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Connection error', err.stack));

// --- SETUP DB ---
app.get('/setup-db', async (req, res) => {
  try {
    // ניקוי טבלאות לפי סדר תלות
    const tables = ['shopping_trip_items', 'shopping_trips', 'product_prices', 'assignments', 'user_quiz_history', 'quizzes', 'activity_log', 'budgets', 'loans', 'goals', 'shopping_list', 'tasks', 'transactions', 'users', 'groups'];
    for (const tbl of tables) await client.query(`DROP TABLE IF EXISTS ${tbl} CASCADE`);

    // יצירת טבלאות
    await client.query(`
      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        admin_email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('FAMILY', 'GROUP')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        nickname VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL, 
        role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'CHILD')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('ACTIVE', 'PENDING', 'BLOCKED')),
        birth_year INTEGER,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, nickname)
      )
    `);

    res.send(`<h1 style="color:green; font-family:sans-serif;">DB Setup Complete V2 ✅</h1><p>Tables recreated with 'balance' column.</p>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- API ---

// 1. Create Group
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  
  // ניקוי רווחים
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  if(adminNickname) adminNickname = adminNickname.trim();

  if (!groupName || !adminEmail || !adminNickname || !password) return res.status(400).json({ error: 'חסרים פרטים' });

  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'המייל כבר קיים במערכת' }); }

    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const groupId = gRes.rows[0].id;

    const uRes = await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING id, nickname, role, status, balance`,
      [groupId, adminNickname, password, parseInt(birthYear)||0]
    );

    await client.query('COMMIT');
    res.json({ success: true, user: uRes.rows[0], group: { id: groupId, name: groupName, type, adminEmail } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// 2. Join
app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  if(nickname) nickname = nickname.trim();

  try {
    const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND nickname = $2', [gRes.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'הכינוי תפוס בקבוצה זו' });

    await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`,
      [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Login
app.post('/api/login', async (req, res) => {
  let { groupEmail, nickname, password } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  if(nickname) nickname = nickname.trim();

  try {
    const gRes = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(401).json({ error: 'קבוצה לא נמצאה (בדוק אימייל)' });
    const group = gRes.rows[0];

    const uRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2', [group.id, nickname]);
    if (uRes.rows.length === 0) return res.status(401).json({ error: 'משתמש לא נמצא (בדוק כינוי)' });
    const user = uRes.rows[0];

    if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
    if (user.status === 'PENDING') return res.status(403).json({ error: 'ממתין לאישור מנהל' });
    if (user.status === 'BLOCKED') return res.status(403).json({ error: 'משתמש חסום' });

    res.json({ 
      success: true, 
      user: { id: user.id, nickname: user.nickname, role: user.role, birth_year: user.birth_year, balance: user.balance },
      group: { id: group.id, name: group.name, type: group.type, adminEmail: group.admin_email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Pending Users
app.get('/api/admin/pending-users', async (req, res) => {
  try {
    const result = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Approve User
app.post('/api/admin/approve-user', async (req, res) => {
  try {
    await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Get Active Members (NEW FOR MODULE 1 FIX)
app.get('/api/group/members', async (req, res) => {
  try {
    const result = await client.query("SELECT id, nickname, role, balance, birth_year FROM users WHERE group_id = $1 AND status = 'ACTIVE' ORDER BY role, nickname", [req.query.groupId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
