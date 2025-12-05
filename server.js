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

// --- 1. SETUP DB (איפוס והקמת כל הטבלאות) ---
app.get('/setup-db', async (req, res) => {
  try {
    // מחיקת טבלאות קיימות
    const tables = ['transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    // יצירת טבלאות
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
        type VARCHAR(20), -- 'income' / 'expense'
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        reward DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'done', 'approved'
        assigned_to INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE shopping_list (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        requested_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'in_cart', 'bought'
        estimated_price DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        target_amount DECIMAL(10, 2) NOT NULL,
        current_amount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);

    await client.query(`
      CREATE TABLE loans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        original_amount DECIMAL(10, 2) NOT NULL,
        remaining_amount DECIMAL(10, 2) NOT NULL,
        reason VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    res.send(`<h1 style="color:green">Full System Reset Complete ✅</h1><p>All tables (Groups, Users, Transactions, Tasks...) created.</p>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- 2. AUTH API ---

app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'מייל זה כבר קיים' }); }

    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [gRes.rows[0].id, adminNickname, password, parseInt(birthYear)||0]);
    
    await client.query('COMMIT');
    res.json({ success: true, user: uRes.rows[0], group: { id: gRes.rows[0].id, name: groupName, type, adminEmail } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  try {
    const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND nickname = $2', [gRes.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'כינוי תפוס' });

    await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'חשבון לא פעיל' });

    res.json({ success: true, user, group });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// --- 3. DATA & TRANSACTIONS API (החלק שהיה חסר) ---

// הבאת כל הנתונים למשתמש (דשבורד)
app.get('/api/data/:userId', async (req, res) => {
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = user.group_id;

    // שליפת נתונים במקביל
    const [trans, tasks, shop, goals, loans, budgets] = await Promise.all([
      client.query(`SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id = $1 ORDER BY t.date DESC LIMIT 50`, [groupId]),
      client.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 AND t.status != 'approved'`, [groupId]),
      client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.group_id = $1 AND s.status != 'bought'`, [groupId]),
      client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [user.id]),
      client.query(`SELECT l.*, u.nickname as user_name FROM loans l JOIN users u ON l.user_id = u.id WHERE l.group_id = $1 AND l.status != 'paid'`, [groupId]),
      client.query(`SELECT * FROM budgets WHERE group_id = $1`, [groupId])
    ]);

    // חישוב סטטוס תקציב
    const budgetStatus = [];
    for (const b of budgets.rows) {
      const spent = await client.query(`
        SELECT SUM(amount) as total FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE u.group_id = $1 AND t.category = $2 AND t.type = 'expense' 
        AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
      `, [groupId, b.category]);
      budgetStatus.push({ category: b.category, limit: parseFloat(b.limit_amount), spent: parseFloat(spent.rows[0].total || 0) });
    }

    res.json({
      user,
      transactions: trans.rows,
      tasks: tasks.rows,
      shopping_list: shop.rows,
      goals: goals.rows,
      loans: loans.rows,
      budget_status: budgetStatus
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// הוספת תנועה (הכנסה/הוצאה)
app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    await client.query('BEGIN');
    // 1. הוספת רשומה לטבלת תנועות
    await client.query(
      `INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`,
      [userId, amount, description, category, type]
    );
    
    // 2. עדכון היתרה של המשתמש
    const factor = type === 'income' ? 1 : -1;
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amount * factor, userId]);
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// משימות
app.post('/api/tasks', async (req, res) => {
  const { title, reward, assignedTo, groupId } = req.body; // groupId צריך להגיע מהלקוח או מהמשתמש
  // במקרה הזה נשלוף אותו מהמשתמש שהוקצה לו
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [assignedTo]);
    if(u.rows.length === 0) return res.status(400).json({error: 'User not found'});
    
    await client.query(`INSERT INTO tasks (title, reward, assigned_to, group_id) VALUES ($1, $2, $3, $4)`, [title, reward, assignedTo, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// הוספה לרשימת קניות
app.post('/api/shopping/add', async (req, res) => {
  const { itemName, userId } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    await client.query(`INSERT INTO shopping_list (item_name, requested_by, group_id, status) VALUES ($1, $2, $3, 'pending')`, [itemName, userId, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
