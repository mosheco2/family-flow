const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// FIXED: Serve static files from 'public' OR root (robustness fix)
if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static('public'));
} else {
    app.use(express.static(__dirname));
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log('Connected to DB'))
  .catch(err => console.error('Connection Error', err.stack));

// --- CONTENT GENERATOR ---
const generateMathQuestions = (ageGroup) => {
    const questions = [];
    for (let i = 0; i < 5; i++) {
        let q, a;
        if (ageGroup === '6-8') {
            const n1 = Math.floor(Math.random() * 10) + 1;
            const n2 = Math.floor(Math.random() * 10) + 1;
            q = `${n1} + ${n2} = ?`; a = n1 + n2;
        } else if (ageGroup === '8-10') {
            const n1 = Math.floor(Math.random() * 10) + 2;
            const n2 = Math.floor(Math.random() * 9) + 2;
            q = `${n1} × ${n2} = ?`; a = n1 * n2;
        } else if (ageGroup === '10-13') {
            const n1 = Math.floor(Math.random() * 50) + 10;
            const n2 = Math.floor(Math.random() * 40) + 5;
            q = `${n1} - ${n2} + 5 = ?`; a = n1 - n2 + 5;
        } else { 
            const n1 = Math.floor(Math.random() * 12) + 2;
            q = `${n1}² = ?`; a = n1 * n1;
        }
        
        let wrong1 = a + 1, wrong2 = a - 1, wrong3 = a + Math.floor(Math.random() * 5) + 2;
        if(wrong1 === a) wrong1 += 2;
        const opts = [a.toString(), wrong1.toString(), wrong2.toString(), wrong3.toString()].sort(() => Math.random() - 0.5);
        questions.push({ q, options: opts, correct: opts.indexOf(a.toString()) });
    }
    return questions;
};

const seedQuizzes = async () => {
    try {
        const check = await client.query('SELECT count(*) FROM quiz_bundles');
        if (parseInt(check.rows[0].count) > 10) return;

        console.log('Seeding Content...');
        const ageGroups = ['6-8', '8-10', '10-13', '13-15', '15-18', '18+'];
        const COUNT = 5; 

        for (const age of ageGroups) {
            for (let i = 1; i <= COUNT; i++) {
                await client.query(`INSERT INTO quiz_bundles (title, type, age_group, reward, threshold, questions) VALUES ($1, $2, $3, $4, $5, $6)`, [`חשבון #${i} (${age})`, 'math', age, 2 + Math.floor(Math.random()*5), 85, JSON.stringify(generateMathQuestions(age))]);
            }
        }
    } catch (e) { console.error("Seeding error:", e); }
};

// --- SETUP ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = ['user_assignments', 'quiz_bundles', 'shopping_trip_items', 'shopping_trips', 'product_prices', 'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    await client.query(`CREATE TABLE groups (id SERIAL PRIMARY KEY, name VARCHAR(100), admin_email VARCHAR(255) UNIQUE, type VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, nickname VARCHAR(50), password VARCHAR(255), role VARCHAR(20), status VARCHAR(20) DEFAULT 'PENDING', birth_year INTEGER, balance DECIMAL(10, 2) DEFAULT 0, allowance_amount DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, xp INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, nickname))`);
    await client.query(`CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, amount DECIMAL(10, 2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), is_manual BOOLEAN DEFAULT TRUE, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(100), target_amount DECIMAL(10, 2), current_amount DECIMAL(10, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE budgets (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, category VARCHAR(50), limit_amount DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(255), reward DECIMAL(10, 2), status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', estimated_price DECIMAL(10, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, original_amount DECIMAL(10, 2), remaining_amount DECIMAL(10, 2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, title VARCHAR(150), type VARCHAR(50), age_group VARCHAR(50), reward DECIMAL(10,2), threshold INTEGER, text_content TEXT, questions JSONB)`);
    await client.query(`CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, bundle_id INTEGER REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INTEGER, custom_reward DECIMAL(10,2), deadline TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await seedQuizzes();
    res.send(`<h1 style="color:green">System Ready V7.0 (Stable) 🛡️</h1>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

const initBudgets = async (groupId, userId = null) => {
  const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
  for (const c of cats) {
    let check;
    if (userId) check = await client.query('SELECT id FROM budgets WHERE group_id=$1 AND category=$2 AND user_id=$3', [groupId, c, userId]);
    else check = await client.query('SELECT id FROM budgets WHERE group_id=$1 AND category=$2 AND user_id IS NULL', [groupId, c]);
    
    if (check.rows.length === 0) {
        await client.query(`INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1, $2, $3, 0)`, [groupId, userId, c]);
    }
  }
};

// --- API ROUTES (Protected with try-catch) ---
app.post('/api/groups', async (req, res) => {
  try {
      const { groupName, adminEmail, adminNickname, password, birthYear } = req.body;
      const email = adminEmail.trim().toLowerCase();
      const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [email]);
      if (check.rows.length > 0) return res.status(400).json({ error: 'מייל זה כבר רשום במערכת' });
      await client.query('BEGIN');
      const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, email, 'FAMILY']);
      const groupId = gRes.rows[0].id;
      const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [groupId, adminNickname, password, parseInt(birthYear)||0]);
      await initBudgets(groupId, null);
      await client.query('COMMIT');
      res.json({ success: true, user: uRes.rows[0], group: { id: groupId, name: groupName, type: 'FAMILY', adminEmail: email } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/join', async (req, res) => {
  try {
      const { groupEmail, nickname, password, birthYear } = req.body;
      const email = groupEmail.trim().toLowerCase();
      const gRes = await client.query('SELECT id FROM groups WHERE admin_email = $1', [email]);
      if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
      const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [gRes.rows[0].id, nickname.trim()]);
      if (check.rows.length > 0) return res.status(400).json({ error: 'כינוי תפוס בקבוצה זו' });
      await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0) RETURNING id`, [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]);
      res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
      const { groupEmail, nickname, password } = req.body;
      const email = groupEmail.trim().toLowerCase();
      const gRes = await client.query('SELECT * FROM groups WHERE admin_email = $1', [email]);
      if (gRes.rows.length === 0) return res.status(401).json({ error: 'קבוצה לא נמצאה' });
      const uRes = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [gRes.rows[0].id, nickname.trim()]);
      if (uRes.rows.length === 0) return res.status(401).json({ error: 'משתמש לא נמצא' });
      const user = uRes.rows[0];
      if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
      if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'חשבון בהמתנה לאישור' });
      res.json({ success: true, user, group: gRes.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', async (req, res) => { try { const r = await client.query('SELECT * FROM users WHERE id = $1', [req.params.id]); res.json(r.rows[0] || {}); } catch (e) { res.status(500).json({}); } });
app.get('/api/admin/pending-users', async (req, res) => { try { const r = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json([]); } });
app.post('/api/admin/approve-user', async (req, res) => { 
    try { 
        await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]); 
        // Init budget for new user
        const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        if(u.rows[0]) await initBudgets(u.rows[0].group_id, req.body.userId);
        res.json({success:true}); 
    } catch (e) { res.status(500).json({error:e.message}); } 
});

app.get('/api/data/:userId', async (req, res) => {
  try {
      const user = (await client.query('SELECT * FROM users WHERE id = $1', [req.params.userId])).rows[0];
      if (!user) return res.json({ error: 'User not found' });
      
      const gid = user.group_id;
      
      // Safe queries
      let tasks = [], shop = [], loans = [], goals = [], assignments = [], history = [];
      
      try { tasks = (await client.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 ORDER BY t.created_at DESC`, [gid])).rows; } catch(e){}
      try { shop = (await client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.group_id = $1 AND s.status != 'bought'`, [gid])).rows; } catch(e){}
      try { loans = (await client.query(`SELECT l.*, u.nickname as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id WHERE l.group_id = $1 ORDER BY l.created_at DESC`, [gid])).rows; } catch(e){}
      try { goals = (await client.query(`SELECT g.*, u.nickname as owner_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.group_id = $1 AND g.status = 'active' ORDER BY g.created_at DESC`, [gid])).rows; } catch(e){}
      
      // Academy
      if(user.role !== 'ADMIN') {
         try { assignments = (await client.query(`SELECT ua.*, qb.title, qb.type, qb.reward, qb.threshold, ua.deadline FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id WHERE ua.user_id = $1 AND ua.status != 'completed'`, [user.id])).rows; } catch(e){}
      } else {
         try { history = (await client.query(`SELECT ua.*, u.nickname, qb.title, ua.status, ua.score FROM user_assignments ua JOIN users u ON ua.user_id = u.id JOIN quiz_bundles qb ON ua.bundle_id = qb.id WHERE u.group_id = $1 ORDER BY ua.created_at DESC`, [gid])).rows; } catch(e){}
      }

      res.json({ user, tasks, shopping_list: shop, loans, goals, weekly_stats: { spent: 0, limit: 0 }, assignments, academyHistory: history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/budget/filter', async (req, res) => {
    const { groupId, targetUserId } = req.query;
    try {
        let budgetQuery = `SELECT * FROM budgets WHERE group_id = $1 AND user_id IS NULL ORDER BY category`;
        let queryParams = [groupId];
        if (targetUserId && targetUserId !== 'all') {
            budgetQuery = `SELECT * FROM budgets WHERE group_id = $1 AND user_id = $2 ORDER BY category`;
            queryParams = [groupId, targetUserId];
        }

        let budgets = await client.query(budgetQuery, queryParams);
        
        // AUTO FIX if empty
        if (budgets.rows.length === 0) {
            const uid = (targetUserId && targetUserId !== 'all') ? targetUserId : null;
            await initBudgets(groupId, uid);
            budgets = await client.query(budgetQuery, queryParams);
        }
        
        const budgetStatus = [];
        for (const b of budgets.rows) {
             budgetStatus.push({ category: b.category, limit: parseFloat(b.limit_amount), spent: 0 });
        }
        res.json(budgetStatus);
    } catch(e) { res.json([]); }
});

// Default fallback
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(__dirname, 'public', 'index.html'))) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
