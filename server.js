const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(async (client) => {
      console.log('✅ Connected to DB (Pool)');
      try {
          // Auto-migrate schema safely
          await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMP`);
          await client.query(`ALTER TABLE quiz_bundles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
          console.log('✅ Auto-migration complete');
      } catch(err) {
          console.error('Migration error:', err.message);
      }
      client.release();
  })
  .catch(err => console.error('Connection Error', err.stack));

const calculateAge = (birthYear) => new Date().getFullYear() - (birthYear || new Date().getFullYear());
const getAgeGroup = (age) => {
    if (age >= 6 && age < 8) return '6-8';
    if (age >= 8 && age < 10) return '8-10';
    if (age >= 10 && age < 13) return '10-13';
    if (age >= 13 && age < 15) return '13-15';
    if (age >= 15 && age < 18) return '15-18';
    if (age >= 18) return '18+';
    return 'other';
};

const generateGroupCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// --- AI ENDPOINTS ---

app.post('/api/academy/ai-generate', async (req, res) => {
    try {
        if (!genAI) throw new Error('GEMINI_API_KEY is not set in environment variables');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const { ageGroup, topic } = req.body;
        const prompt = `Create a fun and educational 5-question multiple-choice quiz in Hebrew about "${topic}" for children aged ${ageGroup}. Requirements: 1. Language MUST be Hebrew. 2. Output strictly as JSON matching this schema exactly: { "title": "A catchy title for the quiz", "text_content": "A short educational text before the questions. Make it engaging.", "questions": [ { "q": "The question text", "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 0 } ] }`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const quizData = JSON.parse(responseText);

        const bundleRes = await pool.query(
            `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward) VALUES ('financial', $1, $2, $3, 80, 10.0) RETURNING id`,
            [ageGroup, quizData.title, quizData.text_content || '']
        );
        const newBundleId = bundleRes.rows[0].id;

        for (const q of quizData.questions) {
            await pool.query(
                `INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`,
                [newBundleId, q.q, JSON.stringify(q.options), q.correct]
            );
        }
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) {
        console.error('AI Gen Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tasks/ai-generate', async (req, res) => {
    try {
        if (!genAI) throw new Error('GEMINI_API_KEY is not set in environment variables');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const { age, topic } = req.body;
        const prompt = `You are a parenting and financial education expert. Suggest 3 age-appropriate household chores or educational tasks for a child aged ${age} related to "${topic}". For each task, suggest a fair monetary reward in ILS (Israeli Shekels, integer between 5 and 50). Requirements: 1. Language MUST be Hebrew. 2. Output STRICTLY as a JSON array of objects matching this schema exactly: [ { "title": "Task description in Hebrew (e.g., סידור החדר ושאיבת אבק)", "reward": 15 } ]`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const tasks = JSON.parse(responseText);
        res.json({ success: true, tasks });
    } catch (e) {
        console.error('AI Task Gen Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/goals/familai-advice', async (req, res) => {
    try {
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const { userId, goalId } = req.body;
        const userRes = await pool.query('SELECT nickname, birth_year, balance, allowance_amount FROM users WHERE id=$1', [userId]);
        const goalRes = await pool.query('SELECT title, target_amount, current_amount FROM goals WHERE id=$1', [goalId]);

        if (userRes.rows.length === 0 || goalRes.rows.length === 0) throw new Error('Data not found');

        const user = userRes.rows[0];
        const goal = goalRes.rows[0];
        const age = calculateAge(user.birth_year);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are 'familAI', a friendly, encouraging, and smart digital character in a family banking app. A child named ${user.nickname} (age ${age}) is saving money for a goal called "${goal.title}". Target amount needed: ${goal.target_amount} ILS. Current saved amount for this goal: ${goal.current_amount} ILS. The child's current free wallet balance is: ${user.balance} ILS. The child's weekly allowance is: ${user.allowance_amount} ILS. Write a short, fun, encouraging message directly to ${user.nickname} in Hebrew. 1. Tell them they are doing a great job saving. 2. Give them a practical, simple 2-step plan to reach their specific goal faster based on their numbers. 3. Keep it under 4 sentences. 4. Do NOT use markdown like **bolding** or bullets, just plain text with a few emojis. 5. Introduce yourself as 'familAI' at the start or end (e.g., "כאן familAI!").`;

        const result = await model.generateContent(prompt);
        const advice = result.response.text().trim();
        res.json({ success: true, advice });
    } catch (e) {
        console.error('familAI Advice Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Setup DB
app.get('/setup-db', async (req, res) => {
    try {
        await pool.query(`
            DROP TABLE IF EXISTS user_assignments CASCADE;
            DROP TABLE IF EXISTS quiz_questions CASCADE;
            DROP TABLE IF EXISTS quiz_bundles CASCADE;
            DROP TABLE IF EXISTS budget_allocations CASCADE;
            DROP TABLE IF EXISTS goals CASCADE;
            DROP TABLE IF EXISTS loans CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS transactions CASCADE;
            DROP TABLE IF EXISTS shopping_list CASCADE;
            DROP TABLE IF EXISTS shopping_trips CASCADE;
            DROP TABLE IF EXISTS shopping_trip_items CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS family_groups CASCADE;

            CREATE TABLE family_groups (id SERIAL PRIMARY KEY, name VARCHAR(100), type VARCHAR(20) DEFAULT 'FAMILY', admin_email VARCHAR(100) UNIQUE, group_code VARCHAR(10) UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE users (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, nickname VARCHAR(50), birth_year INT, password_hash VARCHAR(100), role VARCHAR(20) DEFAULT 'MEMBER', status VARCHAR(20) DEFAULT 'pending', balance DECIMAL(10,2) DEFAULT 0.00, allowance_amount DECIMAL(10,2) DEFAULT 0.00, interest_rate DECIMAL(5,2) DEFAULT 0.00);
            CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, amount DECIMAL(10,2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_manual BOOLEAN DEFAULT TRUE);
            CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, created_by INT REFERENCES users(id), assigned_to INT REFERENCES users(id), title VARCHAR(255), reward DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', deadline TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE budget_allocations (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, category VARCHAR(50), target_user_id INT REFERENCES users(id) ON DELETE CASCADE, amount_limit DECIMAL(10,2) DEFAULT 0.00);
            CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, target_user_id INT REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(255), target_amount DECIMAL(10,2), current_amount DECIMAL(10,2) DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, original_amount DECIMAL(10,2), remaining_amount DECIMAL(10,2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, requester_id INT REFERENCES users(id), item_name VARCHAR(100), quantity INT DEFAULT 1, estimated_price DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, buyer_id INT REFERENCES users(id), store_name VARCHAR(100), branch_name VARCHAR(100), total_amount DECIMAL(10,2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INT REFERENCES shopping_trips(id) ON DELETE CASCADE, item_name VARCHAR(100), quantity INT, price_per_unit DECIMAL(10,2));
            CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, type VARCHAR(20), age_group VARCHAR(10), title VARCHAR(255), text_content TEXT, threshold INT DEFAULT 85, reward DECIMAL(10,2) DEFAULT 10.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE quiz_questions (id SERIAL PRIMARY KEY, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, q TEXT, options JSONB, correct INT);
            CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INT, custom_reward DECIMAL(10,2), deadline TIMESTAMP, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>DB tables reset.</p><a href="/">Go to App</a>');
    } catch (e) { res.status(500).send(e.message); }
});

// Auth
app.post('/api/groups', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        let code = generateGroupCode();
        const gRes = await dbClient.query(`INSERT INTO family_groups (type, name, admin_email, group_code) VALUES ($1, $2, $3, $4) RETURNING *`, [req.body.type, req.body.groupName, req.body.adminEmail, code]);
        const group = gRes.rows[0];
        const uRes = await dbClient.query(`INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ADMIN', 'active') RETURNING *`, [group.id, req.body.adminNickname, req.body.birthYear, req.body.password]);
        await dbClient.query('COMMIT');
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { dbClient.release(); }
});

app.post('/api/join', async (req, res) => {
    try {
        const { groupCode, nickname, birthYear, password, role } = req.body;
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד משפחה לא חוקי' });
        const group = gRes.rows[0];
        const reqRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        await pool.query(`INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [group.id, nickname, birthYear, password, reqRole]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [req.body.groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד משפחה שגוי' });
        const group = gRes.rows[0];
        const uRes = await pool.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2 AND password_hash = $3', [group.id, req.body.nickname, req.body.password]);
        if (uRes.rows.length === 0) return res.status(401).json({ error: 'כינוי או סיסמה שגויים' });
        if (uRes.rows[0].status !== 'active') return res.status(403).json({ error: 'חשבון ממתין לאישור מנהל' });
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const u = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (u.rows.length > 0) res.json(u.rows[0]); else res.status(404).json({error: 'Not found'});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Dash Data - SECURED WITH TRY/CATCH
app.get('/api/data/:userId', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.userId]);
        if(uRes.rows.length===0) return res.status(404).json({error: 'No user'});
        const user = uRes.rows[0];

        let tasksRes={rows:[]}, shopRes={rows:[]}, allBRes={rows:[]};
        try { tasksRes = await pool.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id=$1 ORDER BY t.created_at DESC`, [user.group_id]); } catch(e){}
        try { shopRes = await pool.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requester_id = u.id WHERE s.group_id=$1 ORDER BY s.added_at DESC`, [user.group_id]); } catch(e){}
        try { allBRes = await pool.query(`SELECT id, type, age_group, title, reward FROM quiz_bundles ORDER BY id DESC`); } catch(e){}

        let goalsRes = {rows:[]}, weeklyStats = null, userBundles = [];

        if(user.role === 'ADMIN') {
            try { goalsRes = await pool.query(`SELECT g.*, u.nickname as owner_name FROM goals g LEFT JOIN users u ON g.target_user_id = u.id WHERE g.user_id=$1 OR g.target_user_id IN (SELECT id FROM users WHERE group_id=$2)`, [user.id, user.group_id]); } catch(e){}
            try { 
                const ubRes = await pool.query(`SELECT ua.status, ua.score, ua.deadline, ua.custom_reward, ua.assigned_at, ua.user_id as assigned_to_user, qb.id as bundle_id, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content, u.nickname as assignee_name FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id JOIN users u ON ua.user_id = u.id WHERE u.group_id = $1 ORDER BY ua.assigned_at DESC`, [user.group_id]); 
                userBundles = ubRes.rows;
            } catch(e){}
        } else {
            try { goalsRes = await pool.query(`SELECT * FROM goals WHERE target_user_id=$1`, [user.id]); } catch(e){}
            try { 
                const spentRes = await pool.query(`SELECT COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id=$1 AND type='expense' AND date >= date_trunc('week', CURRENT_DATE)`, [user.id]);
                const limitRes = await pool.query(`SELECT COALESCE(amount_limit, 0) as limit FROM budget_allocations WHERE target_user_id=$1 AND category='allowance_spend'`, [user.id]);
                weeklyStats = { spent: spentRes.rows[0].spent, limit: limitRes.rows.length > 0 ? limitRes.rows[0].limit : user.allowance_amount * 0.2 };
            } catch(e){}
            try {
                const ubRes = await pool.query(`SELECT ua.status, ua.score, ua.deadline, ua.custom_reward, ua.assigned_at, ua.user_id as assigned_to_user, qb.id as bundle_id, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content, u.nickname as assignee_name FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id JOIN users u ON ua.user_id = u.id WHERE ua.user_id = $1 ORDER BY ua.assigned_at DESC`, [user.id]);
                userBundles = ubRes.rows;
                const activeBundleIds = userBundles.filter(b => b.status === 'assigned').map(b => b.bundle_id);
                if (activeBundleIds.length > 0) {
                    const qRes = await pool.query(`SELECT id, bundle_id, q, options, correct FROM quiz_questions WHERE bundle_id = ANY($1::int[])`, [activeBundleIds]);
                    userBundles.forEach(b => {
                        if (b.status === 'assigned') b.questions = qRes.rows.filter(q => q.bundle_id === b.bundle_id);
                    });
                }
            } catch(e){}
        }

        res.json({
            user: user, tasks: tasksRes.rows || [], shopping_list: shopRes.rows || [], goals: goalsRes ? (goalsRes.rows || []) : [],
            weekly_stats: weeklyStats, quiz_bundles: userBundles || [], all_bundles: allBRes.rows || []
        });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const { groupId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        const users = await pool.query(`SELECT * FROM users WHERE group_id = $1 AND status = 'pending'`, [groupId]);
        res.json(users.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/approve-user', async (req, res) => {
    try {
        await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [req.body.userId]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/group/members', async (req, res) => {
    try {
        const { requesterId, groupId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        
        const uReq = await pool.query('SELECT role FROM users WHERE id=$1', [requesterId]);
        const isAdmin = uReq.rows[0].role === 'ADMIN';
        const members = await pool.query('SELECT id, nickname, role, birth_year, balance, allowance_amount, interest_rate FROM users WHERE group_id=$1 AND status=$2', [groupId, 'active']);
        if(isAdmin) res.json(members.rows);
        else res.json(members.rows.map(m => ({id: m.id, nickname: m.nickname, role: m.role, birth_year: m.birth_year, balance: m.id == requesterId ? m.balance : null})));
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/update-settings', async (req, res) => {
    try {
        await pool.query(`UPDATE users SET allowance_amount=$1, interest_rate=$2 WHERE id=$3`, [req.body.allowance || 0, req.body.interest || 0, req.body.userId]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/payday', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const children = await dbClient.query(`SELECT id, allowance_amount, interest_rate, balance FROM users WHERE group_id=$1 AND role='MEMBER' AND status='active'`, [req.body.groupId]);
        let totalDistributed = 0;
        for(let child of children.rows) {
            const allowance = parseFloat(child.allowance_amount) || 0;
            let interest = 0;
            const spentRes = await dbClient.query(`SELECT COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id=$1 AND type='expense' AND date >= date_trunc('week', CURRENT_DATE - INTERVAL '7 days') AND date < date_trunc('week', CURRENT_DATE)`, [child.id]);
            const spent = parseFloat(spentRes.rows[0].spent);
            const limit = allowance * 0.2; 
            if (spent <= limit && parseFloat(child.balance) > 0) interest = parseFloat(child.balance) * ((parseFloat(child.interest_rate)||0) / 100);
            const totalAdded = allowance + interest;
            if(totalAdded > 0) {
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [totalAdded, child.id]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'allowance', 'income', FALSE)`, [child.id, req.body.groupId, totalAdded, `יום תשלום: ${allowance} דמי כיס + ${interest.toFixed(2)} ריבית`]);
                totalDistributed += totalAdded;
            }
        }
        await dbClient.query('COMMIT');
        res.json({success: true, totalDistributed});
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({error: e.message}); } finally { dbClient.release(); }
});

app.post('/api/transaction', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        await dbClient.query('BEGIN');
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5, $6)`, [req.body.userId, u.rows[0].group_id, req.body.amount, req.body.description, req.body.category, req.body.type]);
        const op = req.body.type === 'income' ? '+' : '-';
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id = $2`, [req.body.amount, req.body.userId]);
        if (req.body.type === 'expense') await dbClient.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING`, [u.rows[0].group_id, req.body.category, req.body.userId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';
        const { groupId, userId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        let query, params;
        if(userId === 'all') {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 ORDER BY t.date DESC ${limit}`;
             params = [groupId];
        } else {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.user_id=$1 ORDER BY t.date DESC ${limit}`;
             params = [userId];
        }
        const t = await pool.query(query, params);
        res.json(t.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.assignedTo]);
        let deadline = null;
        if (req.body.days && parseInt(req.body.days) > 0) {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + parseInt(req.body.days));
        }
        await dbClient.query(`INSERT INTO tasks (group_id, created_by, assigned_to, title, reward, deadline) VALUES ($1, $2, $3, $4, $5, $6)`, 
            [u.rows[0].group_id, req.body.createdBy || req.body.assignedTo, req.body.assignedTo, req.body.title, req.body.reward, deadline]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/tasks/update', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const t = (await dbClient.query('SELECT * FROM tasks WHERE id=$1', [req.body.taskId])).rows[0];
        if (req.body.status === 'completed_self') await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', ['approved', req.body.taskId]);
        else if (req.body.status === 'approved' && t.reward > 0) {
            await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [t.reward, t.assigned_to]);
            await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`, [t.assigned_to, t.group_id, t.reward, `תגמול משימה: ${t.title}`]);
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', ['approved', req.body.taskId]);
        } else {
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', [req.body.status, req.body.taskId]);
        }
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/goals', async (req, res) => {
    try {
        const { userId, targetUserId, title, target } = req.body;
        const finalTargetId = targetUserId || userId;
        await pool.query(`INSERT INTO goals (user_id, target_user_id, title, target_amount) VALUES ($1, $2, $3, $4)`, [userId, finalTargetId, title, target]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/goals/deposit', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, goalId, amount } = req.body;
        const g = (await dbClient.query('SELECT target_user_id, title FROM goals WHERE id=$1', [goalId])).rows[0];
        const u = (await dbClient.query('SELECT balance, group_id FROM users WHERE id=$1', [userId])).rows[0];
        if (parseFloat(u.balance) < parseFloat(amount)) { await dbClient.query('ROLLBACK'); return res.status(400).json({ error: 'אין מספיק יתרה' }); }
        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);
        await dbClient.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [amount, goalId]);
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'savings', 'expense', FALSE)`, [userId, u.group_id, amount, `הפקדה ליעד: ${g.title}`]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/shopping/add', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT group_id, role FROM users WHERE id=$1', [req.body.userId]);
        const user = uRes.rows[0];
        const initialStatus = user.role === 'ADMIN' ? 'pending' : 'requested';
        const iRes = await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [user.group_id, req.body.userId, req.body.itemName, req.body.quantity, req.body.estimatedPrice || 0, initialStatus]);
        res.json({ success: true, id: iRes.rows[0].id, alert: null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    try {
        const { itemId, status, estimatedPrice } = req.body;
        if (status) await pool.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if (estimatedPrice !== undefined) await pool.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [estimatedPrice, itemId]);
        res.json({ success: true, alert: null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, totalAmount, storeName, branchName, boughtItems, missingItems } = req.body;
        const u = (await dbClient.query('SELECT group_id FROM users WHERE id=$1', [userId])).rows[0];
        const tripRes = await dbClient.query(`INSERT INTO shopping_trips (group_id, buyer_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [u.group_id, userId, storeName || 'סופר', branchName || '', totalAmount]);
        const tripId = tripRes.rows[0].id;
        for (let item of boughtItems) {
            await dbClient.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [tripId, item.name, item.quantity, item.price]);
            await dbClient.query(`DELETE FROM shopping_list WHERE id=$1`, [item.id]);
        }
        for (let item of missingItems) { await dbClient.query(`UPDATE shopping_list SET status='pending' WHERE id=$1`, [item.id]); }
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'groceries', 'expense', FALSE)`, [userId, u.group_id, totalAmount, `קניות בסופר: ${storeName}`]);
        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const trips = await pool.query(`SELECT st.*, u.nickname FROM shopping_trips st JOIN users u ON st.buyer_id = u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC LIMIT 10`, [req.query.groupId]);
        for (let t of trips.rows) {
            const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [t.id]);
            t.items = items.rows;
        }
        res.json(trips.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/copy', async (req, res) => {
    try {
        const { tripId, userId } = req.body;
        const u = (await pool.query('SELECT group_id FROM users WHERE id=$1', [userId])).rows[0];
        const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [tripId]);
        for(let i of items.rows) {
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, status) VALUES ($1, $2, $3, $4, 'pending')`, [u.group_id, userId, i.item_name, i.quantity]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/budget/filter', async (req, res) => {
    try {
        const { groupId, targetUserId } = req.query;
        let expenses;
        let limitsQuery = `SELECT category, amount_limit as limit FROM budget_allocations WHERE group_id=$1`;
        let limitParams = [groupId];
        if (targetUserId && targetUserId !== 'all') {
            expenses = await pool.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE group_id=$1 AND user_id=$2 AND type='expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [groupId, targetUserId]);
            limitsQuery += ` AND target_user_id=$2`;
            limitParams.push(targetUserId);
        } else {
            expenses = await pool.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE group_id=$1 AND type='expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [groupId]);
            limitsQuery = `SELECT category, SUM(amount_limit) as limit FROM budget_allocations WHERE group_id=$1 GROUP BY category`;
        }
        const limits = await pool.query(limitsQuery, limitParams);
        const result = [];
        const cats = new Set([...expenses.rows.map(r=>r.category), ...limits.rows.map(r=>r.category)]);
        cats.forEach(c => {
            const spent = expenses.rows.find(r=>r.category === c)?.spent || 0;
            const limit = limits.rows.find(r=>r.category === c)?.limit || 0;
            result.push({ category: c, spent: parseFloat(spent), limit: parseFloat(limit) });
        });
        if (targetUserId === 'all') {
             const allocations = await pool.query(`SELECT SUM(amount) as spent FROM transactions WHERE group_id=$1 AND category='allowance' AND type='income' AND date >= date_trunc('month', CURRENT_DATE)`, [groupId]);
             if (allocations.rows[0].spent > 0) result.push({ category: 'allocations', spent: parseFloat(allocations.rows[0].spent), limit: 0 });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        const target = targetUserId === 'all' ? null : targetUserId;
        const exists = await pool.query(`SELECT id FROM budget_allocations WHERE group_id=$1 AND category=$2 AND (target_user_id=$3 OR ($3 IS NULL AND target_user_id IS NULL))`, [groupId, category, target]);
        if (exists.rows.length > 0) await pool.query(`UPDATE budget_allocations SET amount_limit=$1 WHERE id=$2`, [limit || 0, exists.rows[0].id]);
        else await pool.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, $4)`, [groupId, category, target, limit || 0]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/academy/bundles', async (req, res) => {
    try {
        const bundles = await pool.query(`SELECT id, type, age_group, title, reward, threshold FROM quiz_bundles ORDER BY id DESC`);
        res.json(bundles.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/assign', async (req, res) => {
    try {
        const { userId, bundleId, reward, days } = req.body;
        let deadline = null;
        if (days && parseInt(days) > 0) {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + parseInt(days));
        }
        const existing = await pool.query(`SELECT id FROM user_assignments WHERE user_id=$1 AND bundle_id=$2 AND status='assigned'`, [userId, bundleId]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'מבחן זה כבר משויך לילד' });
        await pool.query(`INSERT INTO user_assignments (user_id, bundle_id, custom_reward, deadline) VALUES ($1, $2, $3, $4)`, [userId, bundleId, reward || null, deadline]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/request-challenge', async (req, res) => {
    try {
        const { userId, bundleId } = req.body;
        const user = await pool.query(`SELECT birth_year FROM users WHERE id=$1`, [userId]);
        const age = calculateAge(user.rows[0].birth_year);
        const ageGroup = getAgeGroup(age);
        let targetBundleId = bundleId;
        if (!targetBundleId) {
            const available = await pool.query(`SELECT id FROM quiz_bundles WHERE age_group = $1 AND id NOT IN (SELECT bundle_id FROM user_assignments WHERE user_id=$2)`, [ageGroup, userId]);
            if (available.rows.length === 0) return res.status(404).json({ error: 'לא מצאנו אתגרים חדשים לגיל שלך כרגע.' });
            targetBundleId = available.rows[Math.floor(Math.random() * available.rows.length)].id;
        }
        await pool.query(`INSERT INTO user_assignments (user_id, bundle_id) VALUES ($1, $2)`, [userId, targetBundleId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/submit', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, bundleId, score } = req.body;
        const assignment = await dbClient.query(`
            SELECT ua.id, ua.custom_reward, qb.reward as default_reward, qb.threshold, qb.title
            FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id
            WHERE ua.user_id = $1 AND ua.bundle_id = $2 AND ua.status = 'assigned'
            ORDER BY ua.assigned_at DESC LIMIT 1
        `, [userId, bundleId]);
        if (assignment.rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(400).json({ error: 'Assignment not found or already completed.' });
        }
        const a = assignment.rows[0];
        const passed = score >= a.threshold;
        const status = passed ? 'completed' : 'failed';
        await dbClient.query(`UPDATE user_assignments SET status=$1, score=$2 WHERE id=$3`, [status, score, a.id]);
        if (passed) {
            const reward = a.custom_reward !== null ? parseFloat(a.custom_reward) : parseFloat(a.default_reward);
            if (reward > 0) {
                const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [userId]);
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [reward, userId]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'academy', 'income', FALSE)`,
                    [userId, u.rows[0].group_id, reward, `בונוס אקדמיה: ${a.title}`]);
            }
        }
        await dbClient.query('COMMIT');
        res.json({ success: true, passed });
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { dbClient.release(); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
