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
    const tables = ['shopping_trip_items', 'shopping_trips', 'product_prices', 'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    await client.query(`CREATE TABLE groups (id SERIAL PRIMARY KEY, name VARCHAR(100), admin_email VARCHAR(255) UNIQUE, type VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await client.query(`CREATE TABLE users (
        id SERIAL PRIMARY KEY, 
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, 
        nickname VARCHAR(50), 
        password VARCHAR(255), 
        role VARCHAR(20), 
        status VARCHAR(20) DEFAULT 'PENDING', 
        birth_year INTEGER, 
        balance DECIMAL(10, 2) DEFAULT 0, 
        allowance_amount DECIMAL(10, 2) DEFAULT 0, 
        interest_rate DECIMAL(5, 2) DEFAULT 0,
        xp INTEGER DEFAULT 0, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        UNIQUE(group_id, nickname)
    )`);

    await client.query(`CREATE TABLE transactions (
        id SERIAL PRIMARY KEY, 
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
        amount DECIMAL(10, 2), 
        description VARCHAR(255), 
        category VARCHAR(50), 
        type VARCHAR(20), 
        is_manual BOOLEAN DEFAULT TRUE,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE goals (
        id SERIAL PRIMARY KEY, 
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, 
        title VARCHAR(100), 
        target_amount DECIMAL(10, 2), 
        current_amount DECIMAL(10, 2) DEFAULT 0, 
        status VARCHAR(20) DEFAULT 'active', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE budgets (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, category VARCHAR(50), limit_amount DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(255), reward DECIMAL(10, 2), status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', estimated_price DECIMAL(10, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, original_amount DECIMAL(10, 2), remaining_amount DECIMAL(10, 2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    res.send(`<h1 style="color:blue">FamilyFlow V5.8 - Self Healing Budget 🛠️</h1>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

const initBudgets = async (groupId, userId = null) => {
  const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
  for (const c of cats) {
    // Insert only if not exists (to avoid duplicates in self-healing)
    const check = await client.query(`SELECT id FROM budgets WHERE group_id=$1 AND category=$2 AND (user_id=$3 OR ($3::int IS NULL AND user_id IS NULL))`, [groupId, c, userId]);
    if (check.rows.length === 0) {
        await client.query(`INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1, $2, $3, 0)`, [groupId, userId, c]);
    }
  }
};

// --- AUTH ---
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'מייל קיים' }); }
    
    const gRes = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const groupId = gRes.rows[0].id;
    const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [groupId, adminNickname, password, parseInt(birthYear)||0]);
    
    await initBudgets(groupId, null);
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
    
    const uRes = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0) RETURNING id`, [gRes.rows[0].id, nickname, password, parseInt(birthYear)||0]);
    await initBudgets(gRes.rows[0].id, uRes.rows[0].id);
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

app.get('/api/admin/pending-users', async (req, res) => {
  try { const r = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); }
});
app.post('/api/admin/approve-user', async (req, res) => {
  try { await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]); res.json({success:true}); } catch (e) { res.status(500).json({error:e.message}); }
});

app.get('/api/group/members', async (req, res) => {
  const { groupId, requesterId } = req.query;
  try {
    const u = await client.query('SELECT role FROM users WHERE id = $1', [requesterId]);
    const isAdmin = u.rows.length > 0 && u.rows[0].role === 'ADMIN';
    const r = await client.query("SELECT id, nickname, role, balance, birth_year, allowance_amount, interest_rate FROM users WHERE group_id = $1 AND status = 'ACTIVE' ORDER BY role, nickname", [groupId]);
    
    const members = r.rows.map(m => ({
      ...m,
      balance: (isAdmin || m.id == requesterId) ? m.balance : null,
      allowance_amount: (isAdmin || m.id == requesterId) ? m.allowance_amount : null,
      interest_rate: (isAdmin || m.id == requesterId) ? m.interest_rate : null
    }));
    res.json(members);
  } catch (e) { res.status(500).json({error:e.message}); }
});

// --- GOALS API ---
app.post('/api/goals', async (req, res) => {
    const { userId, targetUserId, title, target } = req.body;
    try {
        const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const ownerId = targetUserId || userId;
        await client.query(`INSERT INTO goals (user_id, group_id, title, target_amount, current_amount, status) VALUES ($1, $2, $3, $4, 0, 'active')`, [ownerId, u.rows[0].group_id, title, target]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/goals/deposit', async (req, res) => {
    const { userId, goalId, amount } = req.body;
    try {
        await client.query('BEGIN');
        const goalRes = await client.query('SELECT user_id FROM goals WHERE id = $1', [goalId]);
        const goalOwnerId = goalRes.rows[0].user_id;
        
        if (parseInt(userId) === parseInt(goalOwnerId)) {
            const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
            const currentBalance = parseFloat(userRes.rows[0].balance);
            if (currentBalance < parseFloat(amount)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'אין מספיק יתרה בחשבון' });
            }
            await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'savings', 'transfer_out', FALSE)`, [userId, amount, 'הפקדה לחיסכון']);
        } else {
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'bonus', 'income', FALSE)`, [goalOwnerId, amount, 'הפקדה ליעד ע"י הורה']);
        }

        await client.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [amount, goalId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

// --- BANKING API ---
app.post('/api/admin/update-settings', async (req, res) => {
    const { userId, allowance, interest } = req.body;
    try {
        await client.query(`UPDATE users SET allowance_amount = $1, interest_rate = $2 WHERE id = $3`, [allowance, interest, userId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/payday', async (req, res) => {
    const { groupId } = req.body;
    try {
        await client.query('BEGIN');
        const members = await client.query(`SELECT * FROM users WHERE group_id = $1 AND role = 'MEMBER' AND status = 'ACTIVE'`, [groupId]);
        let totalDistributed = 0;
        let report = [];

        for (const user of members.rows) {
            const currentBalance = parseFloat(user.balance);
            const allowance = parseFloat(user.allowance_amount);
            const rate = parseFloat(user.interest_rate);
            
            const expensesRes = await client.query(`
                SELECT SUM(amount) as total FROM transactions 
                WHERE user_id = $1 AND type = 'expense' 
                AND date > NOW() - INTERVAL '7 days'
            `, [user.id]);
            const expensesLastWeek = parseFloat(expensesRes.rows[0].total || 0);

            const goalsRes = await client.query(`SELECT SUM(current_amount) as total FROM goals WHERE user_id = $1 AND status = 'active'`, [user.id]);
            const goalsTotal = parseFloat(goalsRes.rows[0].total || 0);

            const totalAvailableApprox = currentBalance + goalsTotal + expensesLastWeek;
            const allowedSpending = totalAvailableApprox * 0.20;
            
            let interestAmount = 0;
            let interestNote = '';

            if (expensesLastWeek <= allowedSpending) {
                 if (currentBalance > 0 && rate > 0) {
                     interestAmount = currentBalance * (rate / 100);
                     interestAmount = Math.round(interestAmount * 100) / 100;
                     interestNote = `ריבית על עו"ש (${rate}%)`;
                 }
            } else {
                 interestNote = 'לא עמד ביעד חיסכון (בזבז מעל 20%)';
                 interestAmount = 0;
            }

            if (allowance > 0) {
                await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'allowance', 'income', FALSE)`, [user.id, allowance, 'דמי כיס שבועיים']);
                await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [allowance, user.id]);
                totalDistributed += allowance;
            }

            if (interestAmount > 0) {
                await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'bonus', 'income', FALSE)`, [user.id, interestAmount, interestNote]);
                await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [interestAmount, user.id]);
                totalDistributed += interestAmount;
            }

            report.push({ nickname: user.nickname, allowance, interest: interestAmount, note: interestNote });
        }
        await client.query('COMMIT');
        res.json({ success: true, report, totalDistributed });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

// --- DATA ---
app.get('/api/data/:userId', async (req, res) => {
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const gid = user.group_id;

    let tasksSql = `SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1`;
    if(user.role !== 'ADMIN') tasksSql += ` AND t.assigned_to = ${user.id}`;
    tasksSql += ` ORDER BY t.created_at DESC`;

    let loansSql = `SELECT l.*, u.nickname as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id WHERE l.group_id = $1`;
    if(user.role !== 'ADMIN') loansSql += ` AND l.user_id = ${user.id}`;
    loansSql += ` ORDER BY l.created_at DESC`;

    const expensesRes = await client.query(`
        SELECT SUM(amount) as total FROM transactions 
        WHERE user_id = $1 AND type = 'expense' 
        AND date > NOW() - INTERVAL '7 days'
    `, [user.id]);
    const weeklyExpenses = parseFloat(expensesRes.rows[0].total || 0);
    
    let goalsSql = '';
    let goalsParams = [];
    
    if (user.role === 'ADMIN') {
        goalsSql = `SELECT g.*, u.nickname as owner_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.group_id = $1 AND g.status = 'active' ORDER BY g.created_at DESC`;
        goalsParams = [gid];
    } else {
        goalsSql = `SELECT g.*, u.nickname as owner_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.user_id = $1 AND g.status = 'active' ORDER BY g.created_at DESC`;
        goalsParams = [user.id];
    }
    const goalsRes = await client.query(goalsSql, goalsParams);
    const goalsList = goalsRes.rows;
    
    const userGoals = goalsList.filter(g => g.user_id === user.id);
    const goalsTotal = userGoals.reduce((sum, g) => sum + parseFloat(g.current_amount), 0);

    const totalAvailable = parseFloat(user.balance) + goalsTotal + weeklyExpenses;
    const allowedSpending = totalAvailable * 0.20;

    const [tasks, shop, loans] = await Promise.all([
      client.query(tasksSql, [gid]),
      client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.group_id = $1 AND s.status != 'bought'`, [gid]),
      client.query(loansSql, [gid])
    ]);

    res.json({ 
        user, 
        tasks: tasks.rows, 
        shopping_list: shop.rows, 
        loans: loans.rows,
        goals: goalsList, 
        weekly_stats: { spent: weeklyExpenses, limit: allowedSpending } 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FIXED: Self-healing Budget
app.get('/api/budget/filter', async (req, res) => {
  const { groupId, targetUserId } = req.query;
  try {
    const budgetStatus = [];
    let budgetQuery = '';
    let queryParams = [];

    if (targetUserId && targetUserId !== 'all') {
        budgetQuery = `SELECT * FROM budgets WHERE group_id = $1 AND user_id = $2 ORDER BY category`;
        queryParams = [groupId, targetUserId];
    } else {
        budgetQuery = `SELECT * FROM budgets WHERE group_id = $1 AND user_id IS NULL ORDER BY category`;
        queryParams = [groupId];
    }
    
    let budgets = await client.query(budgetQuery, queryParams);
    
    // --- SELF HEALING FIX ---
    if (budgets.rows.length === 0) {
        // If no budget rows exist for this view, create them now.
        const uid = (targetUserId && targetUserId !== 'all') ? targetUserId : null;
        await initBudgets(groupId, uid);
        // Fetch again after fix
        budgets = await client.query(budgetQuery, queryParams);
    }
    // ------------------------

    if(targetUserId === 'all') {
       const allocationsTotal = await client.query(`
        SELECT SUM(amount) as total FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE u.group_id = $1 AND u.role != 'ADMIN' AND t.type = 'income' 
        AND t.is_manual = FALSE
        AND (t.category = 'allowance' OR t.category = 'salary' OR t.category = 'bonus')
        AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
      `, [groupId]);
      budgetStatus.push({ category: 'allocations', label: 'הפרשות לילדים 👶', limit: 0, spent: parseFloat(allocationsTotal.rows[0].total || 0) });
    }

    for (const b of budgets.rows) {
      let spentQuery = '';
      let spentParams = [];
      if (targetUserId && targetUserId !== 'all') {
          spentQuery = `SELECT SUM(amount) as total FROM transactions WHERE user_id = $1 AND category = $2 AND type = 'expense' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)`;
          spentParams = [targetUserId, b.category];
      } else {
          spentQuery = `SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id = $1 AND t.category = $2 AND t.type = 'expense' AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)`;
          spentParams = [groupId, b.category];
      }
      const spent = await client.query(spentQuery, spentParams);
      budgetStatus.push({ category: b.category, limit: parseFloat(b.limit_amount), spent: parseFloat(spent.rows[0].total || 0) });
    }
    res.json(budgetStatus);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/budget/update', async (req, res) => {
  const { groupId, category, limit, targetUserId } = req.body;
  try {
    let query = '', params = [];
    if (targetUserId && targetUserId !== 'all') {
        query = `UPDATE budgets SET limit_amount = $1 WHERE group_id = $2 AND user_id = $3 AND category = $4`;
        params = [limit, groupId, targetUserId, category];
    } else {
        query = `UPDATE budgets SET limit_amount = $1 WHERE group_id = $2 AND user_id IS NULL AND category = $3`;
        params = [limit, groupId, category];
    }
    await client.query(query, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const { groupId, userId, limit = 20 } = req.query;
    const userRole = (await client.query('SELECT role FROM users WHERE id = $1', [userId])).rows[0].role;
    let sql = '';
    let params = [];

    if (userRole === 'ADMIN') {
        sql = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id = $1 ORDER BY t.date DESC LIMIT $2`;
        params = [groupId, limit];
    } else {
        sql = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id = $1 AND t.user_id = $2 ORDER BY t.date DESC LIMIT $3`;
        params = [groupId, userId, limit];
    }
    const r = await client.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, $5, TRUE)`, [userId, amount, description, category, type]);
    const factor = type === 'income' ? 1 : -1;
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amount * factor, userId]);
    const uRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    res.json({ success: true, newBalance: uRes.rows[0].balance });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks', async (req, res) => {
  const { title, reward, assignedTo } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [assignedTo]);
    await client.query(`INSERT INTO tasks (title, reward, assigned_to, group_id, status) VALUES ($1, $2, $3, $4, 'pending')`, [title, reward, assignedTo, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
  const { taskId, status } = req.body; 
  try {
    await client.query('BEGIN');
    let finalStatus = status;
    const t = (await client.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
    if (status === 'done' && (t.reward == 0 || t.reward == null)) finalStatus = 'approved';
    else if (status === 'completed_self') finalStatus = 'approved';

    if (finalStatus === 'approved') {
      if (t && t.status !== 'approved') {
        if (t.reward > 0) {
            await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [t.reward, t.assigned_to]);
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'salary', 'income', FALSE)`, [t.assigned_to, t.reward, `בוצע: ${t.title}`]);
        }
      }
    }
    await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [finalStatus, taskId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/add', async (req, res) => {
  const { itemName, userId } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    await client.query(`INSERT INTO shopping_list (item_name, requested_by, group_id, status) VALUES ($1, $2, $3, 'pending')`, [itemName, userId, u.rows[0].group_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
  const { itemId, status } = req.body;
  try {
    await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
  const { totalAmount, userId, storeName } = req.body; 
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    const gid = u.rows[0].group_id;
    await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart' AND group_id = $1", [gid]);
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'groceries', 'expense', TRUE)`, [userId, totalAmount, `קניות ב-${storeName}`]);
    await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
    await client.query(`INSERT INTO shopping_trips (group_id, user_id, store_name, total_amount) VALUES ($1, $2, $3, $4)`, [gid, userId, storeName, totalAmount]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/loans/request', async (req, res) => {
  const { userId, amount, reason } = req.body;
  try {
    const u = await client.query('SELECT group_id FROM users WHERE id=$1', [userId]);
    await client.query(`INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $3, $3, $4, 'pending')`, [userId, u.rows[0].group_id, amount, reason]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/loans/handle', async (req, res) => {
  const { loanId, status } = req.body; 
  try {
    await client.query('BEGIN');
    const l = (await client.query('SELECT * FROM loans WHERE id=$1', [loanId])).rows[0];
    if(status === 'active') {
      await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [l.original_amount, l.user_id]);
      await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'loans', 'income', FALSE)`, [l.user_id, l.original_amount, `הלוואה אושרה: ${l.reason}`]);
    }
    await client.query('UPDATE loans SET status = $1 WHERE id = $2', [status, loanId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));


