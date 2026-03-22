const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// ניתוב סטטי
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); 

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// חיבור למסד הנתונים
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect().then(async (client) => {
    console.log('✅ Connected to DB (Pool)');
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS family_groups ( id SERIAL PRIMARY KEY, name VARCHAR(100), group_code VARCHAR(20) UNIQUE, type VARCHAR(20) DEFAULT 'FAMILY', ai_tokens INT DEFAULT 10, is_premium BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
            CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, nickname VARCHAR(50), password VARCHAR(100), role VARCHAR(20), birth_year INT, balance DECIMAL DEFAULT 0, allowance_amount DECIMAL DEFAULT 0, interest_rate DECIMAL DEFAULT 0, email VARCHAR(150), marketing_consent BOOLEAN DEFAULT FALSE );
            CREATE TABLE IF NOT EXISTS transactions ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, amount DECIMAL, description TEXT, category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_recurring BOOLEAN DEFAULT FALSE, end_month VARCHAR(10) );
            CREATE TABLE IF NOT EXISTS tasks ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, title VARCHAR(200), reward DECIMAL, assigned_to INT REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deadline TIMESTAMP );
            CREATE TABLE IF NOT EXISTS shopping_list ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, item_name VARCHAR(100), quantity DECIMAL DEFAULT 1, unit VARCHAR(20) DEFAULT 'יח''', estimated_price DECIMAL DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', user_id INT REFERENCES users(id) ON DELETE CASCADE );
            CREATE TABLE IF NOT EXISTS pantry ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, item_name VARCHAR(100), quantity DECIMAL DEFAULT 0, unit VARCHAR(20) DEFAULT 'יח''', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
            CREATE TABLE IF NOT EXISTS time_clock ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, punch_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, punch_out TIMESTAMP, total_minutes INT );
            CREATE TABLE IF NOT EXISTS loans ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, amount DECIMAL, reason TEXT, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
            CREATE TABLE IF NOT EXISTS budget_allocations ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, category VARCHAR(50), limit_amount DECIMAL, target_user_id VARCHAR(20) DEFAULT 'all' );
            CREATE TABLE IF NOT EXISTS quiz_assignments ( id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, bundle_id INT, status VARCHAR(20) DEFAULT 'assigned', score INT, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
        `);
        
        try { await client.query('ALTER TABLE users ADD COLUMN email VARCHAR(150)'); } catch(e) {}
        try { await client.query('ALTER TABLE users ADD COLUMN marketing_consent BOOLEAN DEFAULT FALSE'); } catch(e) {}
        
    } catch(e) { console.error('DB Init Error:', e); } finally { client.release(); }
}).catch(err => console.error('DB Connection Error:', err));

// ==========================================
// Authentication (התיקון המרכזי כאן)
// ==========================================
app.post('/api/groups', async (req, res) => {
    const { type, groupName, adminEmail, adminNickname, birthYear, password, marketingConsent } = req.body;
    
    // יצירת קוד ייחודי
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
        // שלב 1: פתיחת הסביבה
        const gRes = await pool.query(
            'INSERT INTO family_groups (name, group_code, type) VALUES ($1, $2, $3) RETURNING id, name, group_code, type, ai_tokens, is_premium', 
            [groupName, code, type || 'FAMILY']
        );
        
        const newGroup = gRes.rows[0];

        // שלב 2: פתיחת המשתמש וקישור לסביבה
        const uRes = await pool.query(
            'INSERT INTO users (group_id, nickname, password, role, birth_year, email, marketing_consent) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nickname, role, balance, birth_year', 
            [newGroup.id, adminNickname, password, 'ADMIN', birthYear, adminEmail, marketingConsent || false]
        );
        
        const newUser = uRes.rows[0];

        res.json({ success: true, group: newGroup, user: newUser });
    } catch(e) { 
        console.error('Registration Error:', e);
        res.status(500).json({ success: false, error: 'שגיאה בהקמת הסביבה: ' + e.message }); 
    }
});

app.post('/api/login', async (req, res) => {
    const { groupCode, nickname, password } = req.body;
    try {
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [groupCode]);
        if (gRes.rows.length === 0) return res.status(404).json({ success: false, error: 'קוד סביבה לא נמצא' });
        const uRes = await pool.query('SELECT id, nickname, role, balance, birth_year FROM users WHERE group_id = $1 AND nickname = $2 AND password = $3', [gRes.rows[0].id, nickname, password]);
        if (uRes.rows.length === 0) return res.status(401).json({ success: false, error: 'שם משתמש או סיסמה שגויים' });
        res.json({ success: true, group: gRes.rows[0], user: uRes.rows[0] });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/join', async (req, res) => {
    const { groupCode, role, nickname, birthYear, password } = req.body;
    try {
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode]);
        if(gRes.rows.length === 0) return res.status(404).json({ success: false, error: 'קוד סביבה לא קיים' });
        await pool.query('INSERT INTO users (group_id, nickname, password, role, birth_year) VALUES ($1, $2, $3, $4, $5)', [gRes.rows[0].id, nickname, password, role || 'MEMBER', birthYear]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/group/members', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nickname, role, balance, allowance_amount, interest_rate, birth_year FROM users WHERE group_id = $1 ORDER BY role, nickname', [req.query.groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Super Admin Routes
// ==========================================
let globalWelcomeMsg = 'ברוכים הבאים ל-Oneflow Life!';
let globalBanners = {};

app.post('/api/superadmin/login', (req, res) => {
    const { code, password } = req.body;
    if (code === 'admin' && password === '123456') { res.json({ success: true, token: 'SA_TOKEN_SECRET' }); } 
    else { res.status(401).json({ success: false, error: 'פרטי גישה שגויים' }); }
});

app.get('/api/superadmin/data', async (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const groups = await pool.query('SELECT * FROM family_groups ORDER BY created_at DESC');
        const users = await pool.query('SELECT id, group_id, nickname, role FROM users');
        res.json({ success: true, groups: groups.rows, users: users.rows, welcomeMsg: globalWelcomeMsg });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/superadmin/settings', (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    globalWelcomeMsg = req.body.welcomeMsg;
    res.json({ success: true });
});

app.get('/api/settings/welcome', (req, res) => { res.json({ message: globalWelcomeMsg }); });

app.post('/api/superadmin/groups/:id/premium', async (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    try {
        await pool.query('UPDATE family_groups SET is_premium = $1 WHERE id = $2', [req.body.enable, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/superadmin/users/:id', async (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    try { await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/superadmin/groups/:id', async (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    try { await pool.query('DELETE FROM family_groups WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/banners', (req, res) => { res.json({ success: true, banners: globalBanners }); });

app.post('/api/superadmin/banners', (req, res) => {
    if (req.headers.authorization !== 'SA_TOKEN_SECRET') return res.status(401).json({ error: 'Unauthorized' });
    globalBanners = { banner_top_text: req.body.topText, banner_top_link: req.body.topLink, banner_top_img: req.body.topImg, banner_bottom_text: req.body.bottomText, banner_bottom_link: req.body.bottomLink, banner_bottom_img: req.body.bottomImg };
    res.json({ success: true });
});

// ==========================================
// Timeclock
// ==========================================
app.get('/api/timeclock', async (req, res) => {
    const { groupId, userId } = req.query;
    try {
        let query = 'SELECT t.*, u.nickname FROM time_clock t JOIN users u ON t.user_id = u.id WHERE t.group_id = $1'; let params = [groupId];
        if (userId && userId !== 'all') { query += ' AND t.user_id = $2'; params.push(userId); }
        query += ' ORDER BY t.punch_in DESC LIMIT 50';
        const records = await pool.query(query, params);
        let activeRecord = null;
        if (userId && userId !== 'all') {
            const active = await pool.query('SELECT * FROM time_clock WHERE group_id = $1 AND user_id = $2 AND punch_out IS NULL', [groupId, userId]);
            if (active.rows.length > 0) activeRecord = active.rows[0];
        }
        res.json({ success: true, records: records.rows, activeRecord });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timeclock/punch', async (req, res) => {
    const { groupId, userId, action } = req.body;
    try {
        if (action === 'in') {
            const existing = await pool.query('SELECT id FROM time_clock WHERE user_id = $1 AND punch_out IS NULL', [userId]);
            if (existing.rows.length > 0) return res.json({ success: false, error: 'כבר מוחתמת כניסה' });
            await pool.query('INSERT INTO time_clock (group_id, user_id, punch_in) VALUES ($1, $2, CURRENT_TIMESTAMP)', [groupId, userId]);
            res.json({ success: true });
        } else if (action === 'out') {
            await pool.query('UPDATE time_clock SET punch_out = CURRENT_TIMESTAMP, total_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - punch_in)) / 60 WHERE user_id = $1 AND punch_out IS NULL', [userId]);
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Central Data Fetch (Dashboard)
// ==========================================
app.get('/api/data/:userId', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
        if(uRes.rows.length === 0) return res.status(404).json({error: 'User not found'});
        const user = uRes.rows[0];
        const gRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [user.group_id]);
        const tasks = await pool.query('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1', [user.group_id]);
        const shopping = await pool.query('SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.user_id = u.id WHERE s.group_id = $1', [user.group_id]);
        const pantry = await pool.query('SELECT * FROM pantry WHERE group_id = $1', [user.group_id]);
        const goals = await pool.query('SELECT * FROM goals WHERE group_id = $1', [user.group_id]);
        const quizAssignments = await pool.query('SELECT qa.*, u.nickname as assignee_name FROM quiz_assignments qa LEFT JOIN users u ON qa.user_id = u.id WHERE qa.group_id = $1', [user.group_id]);

        res.json({
            user: { id: user.id, role: user.role, nickname: user.nickname, balance: user.balance, birth_year: user.birth_year },
            group: { id: gRes.rows[0].id, type: gRes.rows[0].type, ai_tokens: gRes.rows[0].ai_tokens, is_premium: gRes.rows[0].is_premium, group_code: gRes.rows[0].group_code, name: gRes.rows[0].name },
            tasks: tasks.rows, shopping_list: shopping.rows, pantry: pantry.rows, goals: goals.rows, quiz_bundles: quizAssignments.rows
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Transactions & Tasks
// ==========================================
app.get('/api/transactions', async (req, res) => {
    try {
        let query = 'SELECT t.*, u.nickname as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = $1'; let params = [req.query.groupId];
        if (req.query.userId && req.query.userId !== 'all') { query += ' AND t.user_id = $2'; params.push(req.query.userId); }
        query += ' ORDER BY t.date DESC LIMIT $3'; params.push(req.query.limit || 100);
        const result = await pool.query(query, params); res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transaction', async (req, res) => {
    const { userId, amount, description, category, type, date, isRecurring, endMonth } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        await pool.query('INSERT INTO transactions (group_id, user_id, amount, description, category, type, date, is_recurring, end_month) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [uRes.rows[0].group_id, userId, amount, description, category, type, date, isRecurring, endMonth]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo, status } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [assignedTo]);
        await pool.query('INSERT INTO tasks (group_id, title, reward, assigned_to, status) VALUES ($1, $2, $3, $4, $5)', [uRes.rows[0].group_id, title, reward || 0, assignedTo, status || 'pending']);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
    const { taskId, status, finalReward } = req.body;
    try {
        await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);
        if (status === 'approved' && finalReward > 0) {
            const tRes = await pool.query('SELECT assigned_to FROM tasks WHERE id = $1', [taskId]);
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalReward, tRes.rows[0].assigned_to]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/shopping/add', async (req, res) => {
    const { itemName, quantity, unit, estimatedPrice, userId, status } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        await pool.query('INSERT INTO shopping_list (group_id, item_name, quantity, unit, estimated_price, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)', [uRes.rows[0].group_id, itemName, quantity, unit, estimatedPrice || 0, status || 'pending', userId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    const { itemId, status, estimatedPrice } = req.body;
    try {
        if (status) await pool.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]);
        if (estimatedPrice !== undefined) await pool.query('UPDATE shopping_list SET estimated_price = $1 WHERE id = $2', [estimatedPrice, itemId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE id = $1', [req.params.id]); res.json({success: true}); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const { totalAmount, userId, storeName, branchName, boughtItems, missingItems, isBusiness } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const groupId = uRes.rows[0].group_id;

        // 1. תיעוד רכישה (תזרים)
        const typeStr = isBusiness ? 'expense' : 'expense';
        const catStr = isBusiness ? 'inventory' : 'groceries';
        const descStr = `קנייה מרוכזת: ${storeName} ${branchName ? '('+branchName+')' : ''}`;
        
        await pool.query(
            'INSERT INTO transactions (group_id, user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5, $6)',
            [groupId, userId, totalAmount, descStr, catStr, typeStr]
        );

        // 2. טיפול בפריטים שנרכשו - מחיקה מהעגלה והוספה למלאי
        for (const item of boughtItems) {
            await pool.query('DELETE FROM shopping_list WHERE id = $1', [item.id]);
            
            // הכנסה למלאי הפנימי (Pantry/Inventory)
            const exist = await pool.query('SELECT id FROM pantry WHERE group_id = $1 AND item_name = $2', [groupId, item.name]);
            if (exist.rows.length > 0) {
                await pool.query('UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [item.quantity, exist.rows[0].id]);
            } else {
                await pool.query('INSERT INTO pantry (group_id, item_name, quantity) VALUES ($1, $2, $3)', [groupId, item.name, item.quantity]);
            }
        }

        // 3. טיפול בחסרים - החזרה לסטטוס ממתין
        for (const item of missingItems) {
            await pool.query('UPDATE shopping_list SET status = $1 WHERE id = $2', ['pending', item.id]);
        }

        res.json({ success: true });
    } catch(e) {
        console.error("Checkout Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});


// AI Usage Check Helper
async function decrementAITokens(groupId) {
    const gRes = await pool.query('SELECT ai_tokens, is_premium FROM family_groups WHERE id = $1', [groupId]);
    if (!gRes.rows[0].is_premium) {
        if (gRes.rows[0].ai_tokens <= 0) throw new Error('BATTERY_EMPTY');
        await pool.query('UPDATE family_groups SET ai_tokens = ai_tokens - 1 WHERE id = $1', [groupId]);
    }
}

// ==========================================
// ניתוב חכם (מונע שגיאות 404 ו-Cannot GET)
// ==========================================
app.get('*', (req, res) => {
    const publicPath = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
    const rootPath = path.join(__dirname, req.path === '/' ? 'index.html' : req.path);
    
    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        const fallbackIndex = fs.existsSync(path.join(__dirname, 'public', 'index.html')) 
            ? path.join(__dirname, 'public', 'index.html') 
            : path.join(__dirname, 'index.html');
        res.sendFile(fallbackIndex);
    }
});

app.listen(port, () => { console.log(`🚀 Server running on port ${port}`); });
