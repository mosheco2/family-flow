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
  .then(() => console.log('Connected to DB'))
  .catch(err => console.error('Connection Error', err.stack));

// --- 1. SETUP DB ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = ['transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    await client.query(`
      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        admin_email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(20) CHECK (type IN ('FAMILY', 'GROUP')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        nickname VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('ADMIN', 'MEMBER', 'CHILD')),
        status VARCHAR(20) DEFAULT 'PENDING',
        birth_year INTEGER,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, nickname)
      )
    `);

    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        description VARCHAR(255),
        category VARCHAR(50),
        type VARCHAR(20),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE budgets (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        limit_amount DECIMAL(10, 2) NOT NULL,
        UNIQUE(group_id, category)
      )
    `);

    res.send(`<h1 style="color:green">System Reset Complete ✅</h1>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- 2. AUTH API ---

// יצירת קבוצה + אתחול תקציבים (התיקון כאן)
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'מייל זה כבר קיים' }); }

    // 1. Create Group
    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const groupId = gRes.rows[0].id;

    // 2. Create Admin
    const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [groupId, adminNickname, password, parseInt(birthYear)||0]);
    
    // 3. Initialize Default Budgets (THE FIX)
    const defaultCats = ['food', 'groceries', 'transport', 'bills', 'fun', 'other'];
    for (const cat of defaultCats) {
      await client.query(`INSERT INTO budgets (group_id, category, limit_amount) VALUES ($1, $2, 0)`, [groupId, cat]);
    }

    await client.query('COMMIT');
    res.json({ success: true, user: uRes.rows[0], group: { id: groupId, name: groupName, type, adminEmail } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  if(nickname) nickname = nickname.trim();

  try {
    const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [gRes.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'כינוי תפוס' });

    await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  let { groupEmail, nickname, password } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  if(nickname) nickname = nickname.trim();

  try {
    const gRes = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(401).json({ error: 'קבוצה לא נמצאה' });
    const group = gRes.rows[0];

    const uRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [group.id, nickname]);
    if (uRes.rows.length === 0) return res.status(401).json({ error: 'משתמש לא נמצא' });
    const user = uRes.rows[0];

    if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
    if (user.status === 'PENDING') return res.status(403).json({ error: 'ממתין לאישור מנהל' });
    if (user.status === 'BLOCKED') return res.status(403).json({ error: 'חשבון חסום' });

    res.json({ success: true, user, group });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const r = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/pending-users', async (req, res) => {
  try { const r = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); }
});

app.post('/api/admin/approve-user', async (req, res) => {
  try { await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]); res.json({success:true}); } catch (e) { res.status(500).json({error:e.message}); }
});

app.get('/api/group/members', async (req, res) => {
  try { const r = await client.query("SELECT id, nickname, role, balance, birth_year FROM users WHERE group_id = $1 AND status = 'ACTIVE'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); }
});

// --- 3. DATA & TRANSACTIONS API ---

app.get('/api/transactions', async (req, res) => {
  try {
    const { groupId, userId, limit = 20 } = req.query;
    
    const userCheck = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
    if(userCheck.rows.length === 0) return res.status(404).json({error: 'User not found'});
    const role = userCheck.rows[0].role;
    
    let sql = `
      SELECT t.*, u.nickname as user_name 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      WHERE u.group_id = $1 
    `;
    const params = [groupId, limit];

    if (role !== 'ADMIN') {
      sql += ` AND t.user_id = $3`;
      params.push(userId);
    }

    sql += ` ORDER BY t.date DESC LIMIT $2`;

    const r = await client.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/budget', async (req, res) => {
  try {
    const groupId = req.query.groupId;
    const budgets = await client.query(`SELECT * FROM budgets WHERE group_id = $1`, [groupId]);
    
    const status = [];
    for (const b of budgets.rows) {
      const spent = await client.query(`
        SELECT SUM(amount) as total FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE u.group_id = $1 AND t.category = $2 AND t.type = 'expense' 
        AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
      `, [groupId, b.category]);
      status.push({ category: b.category, limit: parseFloat(b.limit_amount), spent: parseFloat(spent.rows[0].total || 0) });
    }
    res.json(status);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    await client.query('BEGIN');
    
    await client.query(
      `INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`,
      [userId, amount, description, category, type]
    );
    
    const factor = type === 'income' ? 1 : -1;
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amount * factor, userId]);
    
    const uRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
    
    await client.query('COMMIT');
    res.json({ success: true, newBalance: uRes.rows[0].balance });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
