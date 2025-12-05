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

// --- SETUP DB (MODULE 2 UPDATE) ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = ['transactions', 'budgets', 'users', 'groups']; // סדר מחיקה חשוב
    for (const tbl of tables) await client.query(`DROP TABLE IF EXISTS ${tbl} CASCADE`);

    // 1. Groups
    await client.query(`
      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        admin_email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('FAMILY', 'GROUP')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Users
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        nickname VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL, 
        role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'CHILD')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        birth_year INTEGER,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, nickname)
      )
    `);

    // 3. Transactions (New!)
    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        description VARCHAR(255),
        category VARCHAR(50),
        type VARCHAR(10) CHECK (type IN ('income', 'expense')),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Budgets (New!)
    await client.query(`
      CREATE TABLE budgets (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        limit_amount DECIMAL(10, 2) NOT NULL,
        UNIQUE(group_id, category)
      )
    `);

    res.send(`<h1 style="color:green; font-family:sans-serif;">Module 2 DB Setup Complete! ✅</h1><p>Tables: Groups, Users, Transactions, Budgets created.</p>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- API ---

// 1. Create Group
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  
  if (!groupName || !adminEmail || !adminNickname || !password) return res.status(400).json({ error: 'חסרים פרטים' });

  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'המייל כבר קיים' }); }

    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const groupId = gRes.rows[0].id;

    const uRes = await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING id, nickname, role, status, balance`,
      [groupId, adminNickname, password, parseInt(birthYear)||0]
    );

    // אתחול תקציבים ברירת מחדל לקבוצה חדשה
    const defaultBudgets = [['food', 2000], ['transport', 1000], ['general', 500]];
    for (const [cat, lim] of defaultBudgets) {
        await client.query('INSERT INTO budgets (group_id, category, limit_amount) VALUES ($1, $2, $3)', [groupId, cat, lim]);
    }

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

  try {
    const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND nickname = $2', [gRes.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'הכינוי תפוס' });

    await client.query(
      `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`,
      [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Login
app.post('/api/login', async (req, res) => {
  let { groupEmail, nickname, password } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();

  try {
    const gRes = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(401).json({ error: 'קבוצה לא נמצאה' });
    const group = gRes.rows[0];

    const uRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2', [group.id, nickname]);
    if (uRes.rows.length === 0) return res.status(401).json({ error: 'משתמש לא נמצא' });
    const user = uRes.rows[0];

    if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
    if (user.status === 'PENDING') return res.status(403).json({ error: 'ממתין לאישור' });
    if (user.status === 'BLOCKED') return res.status(403).json({ error: 'חסום' });

    res.json({ success: true, user, group });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- MODULE 2 APIs (Transactions & Budget) ---

// 4. Add Transaction
app.post('/api/transaction', async (req, res) => {
  const { userId, groupId, amount, type, category, description } = req.body;
  const numAmount = parseFloat(amount);
  
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'סכום לא תקין' });

  try {
    await client.query('BEGIN');
    
    // הוספת התנועה
    await client.query(
      `INSERT INTO transactions (user_id, group_id, amount, type, category, description) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, groupId, numAmount, type, category, description]
    );

    // עדכון יתרת המשתמש
    const factor = type === 'income' ? 1 : -1;
    await client.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`, 
        [numAmount * factor, userId]
    );

    await client.query('COMMIT');
    
    // החזרת היתרה המעודכנת
    const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
    res.json({ success: true, newBalance: userRes.rows[0].balance });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Transactions
app.get('/api/transactions', async (req, res) => {
  const { groupId, userId, limit } = req.query;
  try {
    let query = `
      SELECT t.*, u.nickname as user_name 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.group_id = $1
    `;
    const params = [groupId];

    // אם נשלח userId, נסנן רק לתנועות שלו (אלא אם זה אדמין שרוצה לראות הכל - לוגיקה זו תורחב בהמשך)
    if (userId) {
        query += ` AND t.user_id = $2`;
        params.push(userId);
    }

    query += ` ORDER BY t.date DESC LIMIT ${limit || 20}`;
    
    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Get Budget Status
app.get('/api/budget', async (req, res) => {
  const { groupId } = req.query;
  try {
    // שליפת התקציב המוגדר
    const budgets = await client.query('SELECT category, limit_amount FROM budgets WHERE group_id = $1', [groupId]);
    
    // חישוב הוצאות החודש הנוכחי לפי קטגוריה
    const spent = await client.query(`
        SELECT category, SUM(amount) as total 
        FROM transactions 
        WHERE group_id = $1 AND type = 'expense' 
        AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
        GROUP BY category
    `, [groupId]);

    // מיזוג התוצאות
    const result = budgets.rows.map(b => {
        const s = spent.rows.find(x => x.category === b.category);
        return {
            category: b.category,
            limit: parseFloat(b.limit_amount),
            spent: s ? parseFloat(s.total) : 0
        };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN ROUTES (FROM MODULE 1) ---
app.get('/api/admin/pending-users', async (req, res) => {
  try {
    const result = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/approve-user', async (req, res) => {
  try {
    await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/group/members', async (req, res) => {
  try {
    const result = await client.query("SELECT id, nickname, role, balance FROM users WHERE group_id = $1 AND status = 'ACTIVE' ORDER BY role, nickname", [req.query.groupId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
