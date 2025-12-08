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

// --- SEED ---
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
            q = `${n1} x ${n2} = ?`; a = n1 * n2;
        } else if (ageGroup === '10-13') {
            const n1 = Math.floor(Math.random() * 50) + 10;
            const n2 = Math.floor(Math.random() * 40) + 5;
            q = `${n1} - ${n2} + 5 = ?`; a = n1 - n2 + 5;
        } else { 
            const n1 = Math.floor(Math.random() * 12) + 2;
            q = `${n1} בריבוע (${n1}^2) = ?`; a = n1 * n1;
        }
        const wrong = [a+1, a-1, a+2].sort(()=>Math.random()-0.5);
        const opts = [a.toString(), ...wrong.map(String)].sort(() => Math.random() - 0.5);
        questions.push({ q, options: opts, correct: opts.indexOf(a.toString()) });
    }
    return questions;
};

const seedQuizzes = async () => {
    const check = await client.query('SELECT count(*) FROM quiz_bundles');
    if (parseInt(check.rows[0].count) > 0) return;
    console.log('Seeding...');
    const ages = ['6-8', '8-10', '10-13', '13-15', '15-18', '18+'];
    for (const age of ages) {
        for (let i = 1; i <= 20; i++) {
            await client.query(`INSERT INTO quiz_bundles (title, type, age_group, reward, threshold, questions) VALUES ($1, 'math', $2, $3, 80, $4)`, 
            [`חשבון שלב ${i}`, age, 2 + Math.floor(Math.random()*5), JSON.stringify(generateMathQuestions(age))]);
        }
    }
};

// --- SETUP ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = ['user_assignments', 'quiz_bundles', 'shopping_trip_items', 'shopping_trips', 'product_prices', 'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    await client.query(`CREATE TABLE groups (id SERIAL PRIMARY KEY, name VARCHAR(100), admin_email VARCHAR(255) UNIQUE, type VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, nickname VARCHAR(50), password VARCHAR(255), role VARCHAR(20), status VARCHAR(20) DEFAULT 'PENDING', birth_year INTEGER, balance DECIMAL(10, 2) DEFAULT 0, allowance_amount DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, nickname))`);
    await client.query(`CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, amount DECIMAL(10, 2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), is_manual BOOLEAN DEFAULT TRUE, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(100), target_amount DECIMAL(10, 2), current_amount DECIMAL(10, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE budgets (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, category VARCHAR(50), limit_amount DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(255), reward DECIMAL(10, 2), status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await client.query(`CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), quantity INTEGER DEFAULT 1, estimated_price DECIMAL(10, 2) DEFAULT 0, requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), branch_name VARCHAR(100), total_amount DECIMAL(10, 2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INTEGER REFERENCES shopping_trips(id) ON DELETE CASCADE, item_name VARCHAR(255), quantity INTEGER, price_per_unit DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE product_prices (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), store_name VARCHAR(100), price DECIMAL(10, 2), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, original_amount DECIMAL(10, 2), remaining_amount DECIMAL(10, 2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, title VARCHAR(150), type VARCHAR(50), age_group VARCHAR(50), reward DECIMAL(10,2), threshold INTEGER, text_content TEXT, questions JSONB)`);
    await client.query(`CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, bundle_id INTEGER REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INTEGER, custom_reward DECIMAL(10,2), deadline TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await seedQuizzes();
    res.send('Oneflow Life DB Ready');
  } catch (err) { res.status(500).send(err.message); }
});

const initBudgets = async (groupId, userId = null) => {
  const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
  for (const c of cats) {
    const check = await client.query(`SELECT id FROM budgets WHERE group_id=$1 AND category=$2 AND (user_id=$3 OR ($3::int IS NULL AND user_id IS NULL))`, [groupId, c, userId]);
    if (check.rows.length === 0) await client.query(`INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1, $2, $3, 0)`, [groupId, userId, c]);
  }
};

// --- AUTH ---
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  adminEmail = adminEmail.trim().toLowerCase();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Email exists' }); }
    const g = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const u = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [g.rows[0].id, adminNickname, password, parseInt(birthYear)]);
    await initBudgets(g.rows[0].id, null);
    await client.query('COMMIT');
    res.json({ success: true, user: u.rows[0], group: { id: g.rows[0].id, name: groupName } });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  try {
    const g = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Nickname taken' });
    const u = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, [g.rows[0].id, nickname, password, parseInt(birthYear)||0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  let { groupEmail, nickname, password } = req.body;
  try {
    const g = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(401).json({ error: 'Group not found' });
    const u = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname]);
    if (u.rows.length === 0 || u.rows[0].password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    if (u.rows[0].status !== 'ACTIVE') return res.status(403).json({ error: 'Account pending' });
    res.json({ success: true, user: u.rows[0], group: g.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CORE ---
app.get('/api/users/:id', async (req, res) => { const r = await client.query('SELECT * FROM users WHERE id=$1', [req.params.id]); res.json(r.rows[0]); });
app.get('/api/group/members', async (req, res) => { const r = await client.query("SELECT id, nickname, role, balance, allowance_amount, interest_rate FROM users WHERE group_id=$1 AND status='ACTIVE'", [req.query.groupId]); res.json(r.rows); });
app.get('/api/admin/pending-users', async (req, res) => { const r = await client.query("SELECT id, nickname FROM users WHERE group_id=$1 AND status='PENDING'", [req.query.groupId]); res.json(r.rows); });

// **FIXED: Approve User + Init Budgets**
app.post('/api/admin/approve-user', async (req, res) => { 
    try {
        await client.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [req.body.userId]); 
        // Get user group ID to init budget
        const u = await client.query("SELECT group_id FROM users WHERE id=$1", [req.body.userId]);
        if(u.rows.length > 0) {
            await initBudgets(u.rows[0].group_id, req.body.userId);
        }
        res.json({success:true}); 
    } catch(e) {
        res.status(500).json({error:e.message});
    }
});

// --- SHOPPING ---
app.post('/api/shopping/add', async (req, res) => {
    const { itemName, quantity, userId, estimatedPrice } = req.body;
    try {
        const u = await client.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const newItem = await client.query(`INSERT INTO shopping_list (item_name, quantity, estimated_price, requested_by, group_id, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`, [itemName, quantity, estimatedPrice||0, userId, u.rows[0].group_id]);
        
        let alert = null;
        if(estimatedPrice && parseFloat(estimatedPrice) > 0) {
             const history = await client.query(`SELECT price, store_name, date FROM product_prices WHERE LOWER(TRIM(item_name)) = LOWER(TRIM($1)) AND price < $2 ORDER BY price ASC LIMIT 1`, [itemName, parseFloat(estimatedPrice)]);
             if(history.rows.length) {
                 const dateStr = new Date(history.rows[0].date).toLocaleDateString('he-IL');
                 alert = { msg: `נמצא זול יותר: ₪${history.rows[0].price} ב-${history.rows[0].store_name} (${dateStr})`, price: history.rows[0].price };
             }
        }
        res.json({ success: true, alert, id: newItem.rows[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try {
        await client.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    const { itemId, status, quantity, estimatedPrice } = req.body;
    try {
        if(status) await client.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if(quantity) await client.query('UPDATE shopping_list SET quantity=$1 WHERE id=$2', [quantity, itemId]);
        
        let alert = null;
        if(estimatedPrice !== undefined) {
            const priceVal = parseFloat(estimatedPrice);
            await client.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [priceVal, itemId]);
            const item = await client.query('SELECT item_name FROM shopping_list WHERE id=$1', [itemId]);
            
            if(item.rows.length && priceVal > 0) {
                const history = await client.query(`
                    SELECT price, store_name, date 
                    FROM product_prices 
                    WHERE LOWER(TRIM(item_name)) = LOWER(TRIM($1)) AND price < $2 
                    ORDER BY price ASC LIMIT 1
                `, [item.rows[0].item_name, priceVal]);
                
                if(history.rows.length) {
                    const dateStr = new Date(history.rows[0].date).toLocaleDateString('he-IL');
                    alert = { msg: `נמצא זול יותר: ₪${history.rows[0].price} ב-${history.rows[0].store_name} (${dateStr})`, price: history.rows[0].price };
                }
            }
        }
        res.json({ success: true, alert });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const { boughtItems, missingItems, totalAmount, userId, storeName, branchName } = req.body;
    try {
        await client.query('BEGIN');
        const u = await client.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const trip = await client.query(`INSERT INTO shopping_trips (group_id, user_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [u.rows[0].group_id, userId, storeName, branchName, totalAmount]);
        
        for (const i of boughtItems) {
            await client.query("UPDATE shopping_list SET status='bought' WHERE id=$1", [i.id]);
            await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [trip.rows[0].id, i.name, i.quantity, i.price]);
            if(i.price > 0) await client.query(`INSERT INTO product_prices (group_id, item_name, store_name, price) VALUES ($1, $2, $3, $4)`, [u.rows[0].group_id, i.name, storeName, i.price]);
        }
        
        for (const i of missingItems) {
            await client.query("UPDATE shopping_list SET status='pending' WHERE id=$1", [i.id]);
        }

        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'groceries', 'expense', TRUE)`, [userId, totalAmount, `קניות: ${storeName}`]);
        await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const trips = await client.query(`SELECT st.*, u.nickname FROM shopping_trips st JOIN users u ON st.user_id=u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC LIMIT 20`, [req.query.groupId]);
        const data = [];
        for(const t of trips.rows) {
            const items = await client.query(`SELECT * FROM shopping_trip_items WHERE trip_id=$1`, [t.id]);
            data.push({ ...t, items: items.rows });
        }
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/copy', async (req, res) => {
    try {
        const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        const items = await client.query('SELECT item_name, quantity, price_per_unit FROM shopping_trip_items WHERE trip_id=$1', [req.body.tripId]);
        for(const i of items.rows) {
            await client.query(`INSERT INTO shopping_list (item_name, quantity, estimated_price, requested_by, group_id, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [i.item_name, i.quantity, i.price_per_unit, req.body.userId, u.rows[0].group_id]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- DATA FETCH ---
app.get('/api/data/:userId', async (req, res) => {
    try {
        const user = (await client.query('SELECT * FROM users WHERE id=$1', [req.params.userId])).rows[0];
        const gid = user.group_id;
        
        let tasksSql = `SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1`;
        if (user.role !== 'ADMIN') tasksSql += ` AND t.assigned_to = ${user.id}`;
        tasksSql += ` ORDER BY t.created_at DESC`;

        const [tasks, shop, loans, goals, trans] = await Promise.all([
            client.query(tasksSql, [gid]),
            client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.group_id = $1 AND s.status != 'bought' ORDER BY s.status DESC, s.created_at DESC`, [gid]),
            client.query(`SELECT * FROM loans WHERE group_id=$1`, [gid]),
            client.query(`SELECT g.*, u.nickname as owner_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.group_id=$1`, [gid]),
            client.query(`SELECT SUM(amount) as total FROM transactions WHERE user_id=$1 AND type='expense' AND date > NOW() - INTERVAL '7 days'`, [user.id])
        ]);

        res.json({
            user,
            tasks: tasks.rows,
            shopping_list: shop.rows,
            loans: loans.rows,
            goals: goals.rows,
            weekly_stats: { spent: trans.rows[0].total || 0, limit: (parseFloat(user.balance) * 0.2) }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- OTHER ---
app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo } = req.body;
    try {
        const u = await client.query('SELECT group_id FROM users WHERE id=$1', [assignedTo]);
        await client.query(`INSERT INTO tasks (title, reward, assigned_to, group_id) VALUES ($1, $2, $3, $4)`, [title, reward, assignedTo, u.rows[0].group_id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
    const { taskId, status } = req.body;
    try {
        await client.query('BEGIN');
        let final = status;
        const t = (await client.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
        if(status === 'done' && parseFloat(t.reward) === 0) final = 'approved';
        else if(status === 'completed_self') final = 'approved';
        
        await client.query('UPDATE tasks SET status=$1 WHERE id=$2', [final, taskId]);
        if(final === 'approved' && t.reward > 0 && t.status !== 'approved') {
            await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [t.reward, t.assigned_to]);
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'salary', 'income', FALSE)`, [t.assigned_to, t.reward, `בוצע: ${t.title}`]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions', async (req, res) => {
    const { groupId, userId } = req.query;
    const r = await client.query(`SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id=$1 ${userId ? 'AND t.user_id='+userId : ''} ORDER BY t.date DESC LIMIT 20`, [groupId]);
    res.json(r.rows);
});

app.post('/api/transaction', async (req, res) => {
    const { userId, amount, description, category, type } = req.body;
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, amount, description, category, type]);
        await client.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [type==='income'?amount:-amount, userId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('/api/budget/filter', async (req, res) => {
    const { groupId, targetUserId } = req.query;
    try {
        const budgets = await client.query(`SELECT * FROM budgets WHERE group_id=$1 AND ${targetUserId==='all' ? 'user_id IS NULL' : 'user_id='+targetUserId}`, [groupId]);
        const data = [];
        if(targetUserId === 'all') {
             const alloc = await client.query(`SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id=u.id WHERE u.group_id=$1 AND u.role!='ADMIN' AND t.type='income' AND t.category IN ('allowance','salary','bonus') AND date_trunc('month', t.date)=date_trunc('month', CURRENT_DATE)`, [groupId]);
             data.push({category: 'allocations', limit: 0, spent: alloc.rows[0].total||0});
        }
        for(const b of budgets.rows) {
            const s = await client.query(`SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id=u.id WHERE u.group_id=$1 AND t.category=$2 AND t.type='expense' ${targetUserId!=='all'?'AND t.user_id='+targetUserId:''} AND date_trunc('month', t.date)=date_trunc('month', CURRENT_DATE)`, [groupId, b.category]);
            data.push({category: b.category, limit: b.limit_amount, spent: s.rows[0].total||0});
        }
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    await client.query(`UPDATE budgets SET limit_amount=$1 WHERE group_id=$2 AND category=$3 AND ${req.body.targetUserId==='all'?'user_id IS NULL':'user_id='+req.body.targetUserId}`, [req.body.limit, req.body.groupId, req.body.category]);
    res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Server running on port ${port}`));
