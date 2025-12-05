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

// --- 1. SETUP DB (הקמת כל הטבלאות כולל משימות וקניות) ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = [
      'shopping_trip_items', 'shopping_trips', 'product_prices', // טבלאות קניות מתקדמות
      'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 
      'users', 'groups'
    ];
    // מחיקה נקייה
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    // --- יצירת הטבלאות ---
    
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
        weekly_allowance DECIMAL(10, 2) DEFAULT 0,
        xp INTEGER DEFAULT 0,
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

    await client.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        reward DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- pending, done, approved
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
        status VARCHAR(20) DEFAULT 'pending', -- pending, in_cart, bought
        estimated_price DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // טבלאות להיסטוריית קניות
    await client.query(`
      CREATE TABLE shopping_trips (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        store_name VARCHAR(100),
        total_amount DECIMAL(10, 2),
        item_count INTEGER,
        trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE shopping_trip_items (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER REFERENCES shopping_trips(id) ON DELETE CASCADE,
        item_name VARCHAR(255),
        price DECIMAL(10, 2)
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

    res.send(`<h1 style="color:green; font-family:sans-serif;">System Ready V3 (All Modules Active) 🚀</h1>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- 2. AUTH & USERS API ---

app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'מייל זה כבר קיים' }); }

    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const groupId = gRes.rows[0].id;
    const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [groupId, adminNickname, password, parseInt(birthYear)||0]);
    
    // יצירת קטגוריות ברירת מחדל
    const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'other'];
    for (const c of cats) await client.query(`INSERT INTO budgets (group_id, category, limit_amount) VALUES ($1, $2, 0)`, [groupId, c]);

    await client.query('COMMIT');
    res.json({ success: true, user: uRes.rows[0], group: { id: groupId, name: groupName, type, adminEmail } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  if(groupEmail) groupEmail = groupEmail.trim().toLowerCase();
  try {
    const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail]);
    if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [gRes.rows[0].id, nickname.trim()]);
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
    const uRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [gRes.rows[0].id, nickname.trim()]);
    if (uRes.rows.length === 0) return res.status(401).json({ error: 'משתמש לא נמצא' });
    const user = uRes.rows[0];
    if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'חשבון לא פעיל' });
    res.json({ success: true, user, group: gRes.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const r = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ניהול משתמשים (Admin)
app.get('/api/admin/pending-users', async (req, res) => {
  try { const r = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); }
});
app.post('/api/admin/approve-user', async (req, res) => {
  try { await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]); res.json({success:true}); } catch (e) { res.status(500).json({error:e.message}); }
});
app.get('/api/group/members', async (req, res) => {
  try { const r = await client.query("SELECT id, nickname, role, balance, birth_year FROM users WHERE group_id = $1 AND status = 'ACTIVE'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); }
});

// --- 3. CORE MODULES (Budget, Transactions, Tasks) ---

// שליפת כל המידע הרלוונטי למשתמש (Dashboard)
app.get('/api/data/:userId', async (req, res) => {
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const gid = user.group_id;

    // שליפת משימות רלוונטיות
    let tasksSql = `SELECT t.*, u.nickname as assignee_name FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1`;
    // מנהל רואה הכל, משתמש רואה רק את שלו או משימות פתוחות
    if(user.role !== 'ADMIN') tasksSql += ` AND t.assigned_to = ${user.id}`;
    tasksSql += ` AND t.status != 'approved' ORDER BY t.created_at DESC`;

    const [trans, tasks, shop, goals, loans, budgets] = await Promise.all([
      // תנועות (סינון כבר מתבצע בנפרד ב-API אחר, אבל לדשבורד נביא 5 אחרונות)
      client.query(`SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.user_id = $1 ORDER BY t.date DESC LIMIT 5`, [user.id]),
      client.query(tasksSql, [gid]),
      client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s JOIN users u ON s.requested_by = u.id WHERE s.group_id = $1 AND s.status != 'bought'`, [gid]),
      client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [user.id]),
      client.query(`SELECT l.*, u.nickname as user_name FROM loans l JOIN users u ON l.user_id = u.id WHERE l.group_id = $1 AND l.status != 'paid'`, [gid]),
      client.query(`SELECT * FROM budgets WHERE group_id = $1`, [gid])
    ]);

    // חישוב תקציב (רק למנהל רלוונטי לראות הכל, אבל נחזיר לכולם לבינתיים)
    const budgetStatus = [];
    for (const b of budgets.rows) {
      const spent = await client.query(`
        SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id = u.id 
        WHERE u.group_id = $1 AND t.category = $2 AND t.type = 'expense' 
        AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
      `, [gid, b.category]);
      budgetStatus.push({ category: b.category, limit: parseFloat(b.limit_amount), spent: parseFloat(spent.rows[0].total || 0) });
    }

    res.json({ user, transactions: trans.rows, tasks: tasks.rows, shopping_list: shop.rows, goals: goals.rows, loans: loans.rows, budget_status: budgetStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// תנועות + תקציב
app.get('/api/transactions', async (req, res) => {
  try {
    const { groupId, userId, limit = 20 } = req.query;
    const userRole = (await client.query('SELECT role FROM users WHERE id = $1', [userId])).rows[0].role;
    
    let sql = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id = $1`;
    const params = [groupId, limit];
    
    if (userRole !== 'ADMIN') { sql += ` AND t.user_id = $3`; params.push(userId); }
    sql += ` ORDER BY t.date DESC LIMIT $2`;
    
    const r = await client.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, amount, description, category, type]);
    const factor = type === 'income' ? 1 : -1;
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amount * factor, userId]);
    const uRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    res.json({ success: true, newBalance: uRes.rows[0].balance });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

// משימות (Create & Update)
app.post('/api/tasks', async (req, res) => {
  const { title, reward, assignedTo } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [assignedTo]);
    await client.query(`INSERT INTO tasks (title, reward, assigned_to, group_id) VALUES ($1, $2, $3, $4)`, [title, reward, assignedTo, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
  const { taskId, status } = req.body; // status: 'done' or 'approved'
  try {
    await client.query('BEGIN');
    
    if(status === 'approved') {
      const t = (await client.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
      if(t && t.status !== 'approved') {
        // העברת תגמול למשתמש
        await client.query(`UPDATE users SET balance = balance + $1, xp = xp + 10 WHERE id = $2`, [t.reward, t.assigned_to]);
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'salary', 'income')`, [t.assigned_to, t.reward, `בוצע: ${t.title}`]);
      }
    }
    
    await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

// קניות (Shopping)
app.post('/api/shopping/add', async (req, res) => {
  const { itemName, userId } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    await client.query(`INSERT INTO shopping_list (item_name, requested_by, group_id, status) VALUES ($1, $2, $3, 'pending')`, [itemName, userId, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
  const { itemId, status } = req.body; // status: 'in_cart', 'approved'
  try {
    await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
  const { totalAmount, userId, storeName, items } = req.body; // items = [{id, name, price}]
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    const gid = u.rows[0].group_id;

    // 1. סימון פריטים כנקנו
    await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart' AND group_id = $1", [gid]);

    // 2. יצירת טרנזקציה (הוצאה למשתמש המשלם)
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, [userId, totalAmount, `קניות ב-${storeName}`]);
    await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);

    // 3. תיעוד היסטוריית קנייה
    const tripRes = await client.query(`INSERT INTO shopping_trips (group_id, user_id, store_name, total_amount, item_count) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [gid, userId, storeName, totalAmount, items.length]);
    const tripId = tripRes.rows[0].id;

    for (const item of items) {
      await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, price) VALUES ($1, $2, $3)`, [tripId, item.name, item.price]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.get('/api/shopping/history', async (req, res) => {
  try {
    const { groupId } = req.query;
    const trips = await client.query('SELECT * FROM shopping_trips WHERE group_id = $1 ORDER BY trip_date DESC LIMIT 10', [groupId]);
    // לא נחזיר פריטים לכל קנייה כרגע כדי לא להכביד, אפשר להוסיף אם צריך
    res.json(trips.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// הלוואות
app.post('/api/loans/request', async (req, res) => {
  const { userId, amount, reason } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id=$1', [userId]);
    await client.query(`INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $3, $3, $4, 'pending')`, [userId, u.rows[0].group_id, amount, reason]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/loans/handle', async (req, res) => {
  const { loanId, status } = req.body; // active / rejected
  try {
    await client.query('BEGIN');
    const l = (await client.query('SELECT * FROM loans WHERE id=$1', [loanId])).rows[0];
    
    if(status === 'active') {
      // העברת כסף למשתמש
      await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [l.original_amount, l.user_id]);
      await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'loans', 'income')`, [l.user_id, l.original_amount, `הלוואה אושרה: ${l.reason}`]);
    }
    
    await client.query('UPDATE loans SET status = $1 WHERE id = $2', [status, loanId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
