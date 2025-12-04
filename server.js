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

client.connect();

// --- מנוע יצירת תוכן אקדמי (Seeding Engine) ---
async function seedAcademy() {
    // בדיקה אם כבר יש תוכן כדי לא להעמיס סתם
    const count = (await client.query('SELECT COUNT(*) FROM quizzes')).rows[0].count;
    if (parseInt(count) > 50) return; 

    console.log("Generating Massive Academy Content...");

    const ageGroups = [
        { min: 6, max: 7, code: 'child_6_7' },
        { min: 7, max: 8, code: 'child_7_8' },
        { min: 8, max: 9, code: 'child_8_9' },
        { min: 9, max: 10, code: 'child_9_10' },
        { min: 10, max: 12, code: 'child_10_12' },
        { min: 12, max: 14, code: 'child_12_14' },
        { min: 14, max: 16, code: 'teen_14_16' },
        { min: 16, max: 18, code: 'teen_16_18' }
    ];

    // 1. מחולל תרגילי חשבון (Math Generator)
    for (const age of ageGroups) {
        for (let set = 1; set <= 5; set++) { // מייצרים 5 סטים לכל גיל (לדוגמה, במקום 20 כדי לחסוך זמן אתחול)
            const groupId = `math_${age.code}_set_${set}`;
            const difficulty = Math.ceil((age.min - 5) * 1.5); 
            
            // יצירת 15 תרגילים לכל סט
            for (let i = 1; i <= 15; i++) {
                let q, a, opts;
                
                if (age.min < 8) { // חיבור חיסור פשוט
                    const n1 = Math.floor(Math.random() * 20);
                    const n2 = Math.floor(Math.random() * 20);
                    const op = Math.random() > 0.5 ? '+' : '-';
                    q = `${n1} ${op} ${n2}`;
                    a = eval(q);
                    if (a < 0) { q = `${n2} ${op} ${n1}`; a = eval(q); } // להימנע משליליים לקטנים
                } else if (age.min < 10) { // כפל וחילוק
                    const n1 = Math.floor(Math.random() * 10);
                    const n2 = Math.floor(Math.random() * 10);
                    q = `${n1} x ${n2}`;
                    a = n1 * n2;
                } else { // אחוזים וריביות לגדולים
                    const n1 = Math.floor(Math.random() * 500);
                    const pct = Math.floor(Math.random() * 20) * 5;
                    q = `כמה הם ${pct}% מתוך ${n1}?`;
                    a = (n1 * pct) / 100;
                }

                // יצירת מסיחים
                opts = [a, a + 2, a - 3, a + 5].sort(() => Math.random() - 0.5);
                const correctIdx = opts.indexOf(a);

                await client.query(
                    `INSERT INTO quizzes (type, category, question, options, correct_index, reward, target_age_group, group_id, sequence_order) 
                     VALUES ('math', 'math', $1, $2, $3, $4, $5, $6, $7)`,
                    [q, JSON.stringify(opts), correctIdx, 1, age.code, groupId, i]
                );
            }
        }
    }

    // 2. מחולל שאלות פיננסיות (Financial Trivia)
    const financeQuestions = [
        { q: "מאיפה מגיע הכסף של ההורים?", a: "מעבודה", opts: ["מהקיר", "מהבנק", "מעבודה", "מהעצים"], ages: ['child_6_7', 'child_7_8'] },
        { q: "מה זה 'עודף'?", a: "כסף שמקבלים חזרה כשמשלמים יותר מדי", opts: ["כסף שמקבלים במתנה", "כסף שמקבלים חזרה כשמשלמים יותר מדי", "כסף שהולך לפח", "כסף של מונופול"], ages: ['child_6_7', 'child_7_8'] },
        { q: "למה שמים כסף בבנק?", a: "כדי לשמור עליו ולקבל ריבית", opts: ["כי אין מקום בכיס", "כדי לשמור עליו ולקבל ריבית", "כדי שהפקידים ישחקו איתו", "לא שמים כסף בבנק"], ages: ['child_8_9', 'child_9_10'] },
        { q: "מה זו ריבית?", a: "תשלום על השימוש בכסף", opts: ["קנס", "תשלום על השימוש בכסף", "סוג של מס", "מתנה לחג"], ages: ['child_10_12', 'child_12_14'] },
        { q: "מה ההבדל בין כרטיס אשראי לכרטיס דביט?", a: "באשראי החיוב יורד פעם בחודש, בדביט מיד", opts: ["אין הבדל", "באשראי החיוב יורד פעם בחודש, בדביט מיד", "דביט זה רק לחו''ל", "אשראי זה כסף חינם"], ages: ['teen_14_16', 'teen_16_18'] },
        { q: "מהי אינפלציה?", a: "עליית מחירים וירידת ערך הכסף", opts: ["ירידת מחירים", "עליית מחירים וירידת ערך הכסף", "שם של מניה", "סוג של הלוואה"], ages: ['teen_14_16', 'teen_16_18'] }
    ];

    for (const item of financeQuestions) {
        for (const age of item.ages) {
             await client.query(
                `INSERT INTO quizzes (type, category, question, options, correct_index, reward, target_age_group, group_id) 
                 VALUES ('trivia', 'finance', $1, $2, $3, $4, $5, 'finance_basics')`,
                [item.q, JSON.stringify(item.opts.sort(() => Math.random() - 0.5)), item.opts.indexOf(item.a), 5, age]
            );
        }
    }
    
    console.log("Seeding Completed.");
}

// --- Setup DB ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL, balance DECIMAL(10, 2) DEFAULT 0, pin_code VARCHAR(10), age_group VARCHAR(20) DEFAULT 'adult', weekly_allowance DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, xp INTEGER DEFAULT 0, birth_year INTEGER)`,
        `CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), amount DECIMAL(10, 2) NOT NULL, description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, reward DECIMAL(10, 2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id))`,
        `CREATE TABLE IF NOT EXISTS shopping_list (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', estimated_price DECIMAL(10, 2) DEFAULT 0, trip_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(100) NOT NULL, target_amount DECIMAL(10, 2) NOT NULL, current_amount DECIMAL(10, 2) DEFAULT 0, icon VARCHAR(50) DEFAULT 'star', status VARCHAR(20) DEFAULT 'active', target_date TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), original_amount DECIMAL(10, 2) NOT NULL, remaining_amount DECIMAL(10, 2) NOT NULL, reason VARCHAR(255), interest_rate DECIMAL(5, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, category VARCHAR(50) NOT NULL UNIQUE, limit_amount DECIMAL(10, 2) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(255) NOT NULL, icon VARCHAR(50) DEFAULT 'bell', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, type VARCHAR(20) NOT NULL, category VARCHAR(50) DEFAULT 'general', question VARCHAR(500) NOT NULL, content TEXT, options JSONB NOT NULL, correct_index INTEGER NOT NULL, reward DECIMAL(10, 2) DEFAULT 1, target_age_group VARCHAR(20) DEFAULT 'all', group_id VARCHAR(100), sequence_order INTEGER DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS user_quiz_history (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS assigned_quizzes (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), group_id VARCHAR(100), assigned_by INTEGER REFERENCES users(id), assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS product_prices (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, last_price DECIMAL(10, 2) NOT NULL, store_name VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trips (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), item_count INTEGER, trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
    ];

    for (const query of tables) await client.query(query);

    // Migrations
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER"); } catch(e) {}
    try { await client.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general'"); } catch(e) {}
    try { await client.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS group_id VARCHAR(100)"); } catch(e) {}
    try { await client.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS sequence_order INTEGER DEFAULT 0"); } catch(e) {}

    const userCheck = await client.query('SELECT * FROM users');
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group, birth_year) VALUES ('Admin Parent', 'parent', 0, '1234', 'adult', 1980)`);
    }

    await seedAcademy();

    res.send(`<h2 style="color: green;">System Updated, DB Migrated, Content Seeded!</h2>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- API Endpoints ---

app.get('/api/public-users', async (req, res) => { try { const result = await client.query('SELECT id, name, role, age_group FROM users ORDER BY role DESC, id ASC'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/login', async (req, res) => { const { userId, pin } = req.body; try { if (!userId && pin) { const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]); if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] }); return res.status(401).json({ success: false, message: 'קוד שגוי' }); } const result = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]); if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] }); else res.status(401).json({ success: false, message: 'קוד שגוי' }); } catch (err) { res.status(500).json({ error: err.message }); } });

// יצירת משתמש עם שנת לידה
app.post('/api/create-user', async (req, res) => { 
    const { name, pin, role, initialBalance, birthYear } = req.body; 
    try { 
        // חישוב קבוצת גיל אוטומטי
        const currentYear = new Date().getFullYear();
        const age = currentYear - parseInt(birthYear);
        let ageGroup = 'adult';
        if (role === 'child') {
            if (age <= 7) ageGroup = 'child_6_7';
            else if (age <= 8) ageGroup = 'child_7_8';
            else if (age <= 9) ageGroup = 'child_8_9';
            else if (age <= 10) ageGroup = 'child_9_10';
            else if (age <= 12) ageGroup = 'child_10_12';
            else if (age <= 14) ageGroup = 'child_12_14';
            else if (age <= 16) ageGroup = 'teen_14_16';
            else ageGroup = 'teen_16_18';
        }

        await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group, birth_year, weekly_allowance, interest_rate) VALUES ($1, $2, $3, $4, $5, $6, 0, 0)`, 
            [name, role, parseFloat(initialBalance)||0, pin, ageGroup, parseInt(birthYear)]); 
        await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES (NULL, $1, 'user-plus')`, [`משתמש חדש: ${name}`]); 
        res.json({ success: true }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

// עדכון פרופיל
app.post('/api/update-user', async (req, res) => {
    const { userId, name, pin, birthYear } = req.body;
    try {
        await client.query('UPDATE users SET name=$1, pin_code=$2, birth_year=$3 WHERE id=$4', [name, pin, birthYear, userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// שליפת נתונים
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let familyMembers = [];
    if (user.role === 'parent' || user.role === 'child') {
        familyMembers = (await client.query('SELECT id, name, balance, role, age_group, birth_year, weekly_allowance, interest_rate, xp FROM users ORDER BY id')).rows;
    }
    
    // שליפת חידונים (לפי הקצאה או גיל)
    let quizzes = [];
    if (user.role === 'child') {
        // שליפת משימות ששוייכו ע"י הורה + משימות לפי גיל שטרם בוצעו
        // נותן עדיפות למה ששויך
        quizzes = (await client.query(`
            SELECT q.*, 
            CASE WHEN aq.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned 
            FROM quizzes q
            LEFT JOIN assigned_quizzes aq ON q.group_id = aq.group_id AND aq.user_id = $2
            WHERE ((q.target_age_group = $1 OR q.target_age_group = 'all') OR aq.id IS NOT NULL)
            AND NOT EXISTS (SELECT 1 FROM user_quiz_history h WHERE h.quiz_id = q.id AND h.user_id = $2)
            ORDER BY is_assigned DESC, q.category, q.sequence_order ASC, q.id ASC
            LIMIT 20
        `, [user.age_group, userId])).rows;
    } else if (user.role === 'parent') {
        // הורים רואים רשימה של קבוצות שאלות לשיוך
        quizzes = (await client.query(`
            SELECT DISTINCT group_id, category, target_age_group, COUNT(*) as q_count 
            FROM quizzes 
            WHERE group_id IS NOT NULL 
            GROUP BY group_id, category, target_age_group
            ORDER BY category, target_age_group
        `)).rows;
    }

    let transQuery = `SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`;
    if (user.role === 'child') transQuery += ` WHERE t.user_id = ${userId}`;
    transQuery += ` ORDER BY t.date DESC LIMIT 50`;
    const transRes = await client.query(transQuery);
    
    let tasksQuery = `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id `;
    if (user.role === 'child') tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`; else tasksQuery += ` WHERE t.status != 'approved'`; tasksQuery += ` ORDER BY t.id DESC`;
    const tasksRes = await client.query(tasksQuery);

    // רשימת קניות - עם תאריך עדכון מחיר
    const shopRes = await client.query(`
        SELECT 
            s.*, 
            u.name as requester_name, 
            latest.last_price, 
            latest.store_name as last_store,
            best.price as best_price,
            best.store_name as best_store,
            best.updated_at as best_date
        FROM shopping_list s 
        LEFT JOIN users u ON s.requested_by = u.id 
        LEFT JOIN (
            SELECT DISTINCT ON (item_name) item_name, last_price, store_name 
            FROM product_prices ORDER BY item_name, updated_at DESC
        ) latest ON s.item_name = latest.item_name
        LEFT JOIN (
            SELECT DISTINCT ON (item_name) item_name, last_price as price, store_name, updated_at
            FROM product_prices WHERE updated_at > NOW() - INTERVAL '3 months'
            ORDER BY item_name, last_price ASC
        ) best ON s.item_name = best.item_name
        WHERE s.status != 'bought' 
        ORDER BY s.id DESC
    `);

    const goalsRes = await client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [userId]);
    let loansQuery = `SELECT l.*, u.name as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id`;
    if (user.role === 'child') loansQuery += ` WHERE l.user_id = ${userId}`; else loansQuery += ` WHERE l.status != 'paid'`; loansQuery += ` ORDER BY l.created_at DESC`;
    const loansRes = await client.query(loansQuery);

    res.json({ user, transactions: transRes.rows, family: familyMembers, tasks: tasksRes.rows, shopping_list: shopRes.rows, goals: goalsRes.rows, loans: loansRes.rows, quizzes: quizzes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// שיוך משימות (אקדמיה)
app.post('/api/academy/assign', async (req, res) => {
    const { userId, groupId, assignerId } = req.body;
    try {
        await client.query(`INSERT INTO assigned_quizzes (user_id, group_id, assigned_by) VALUES ($1, $2, $3)`, [userId, groupId, assignerId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// שאר ה-API (קניות, משימות, בנק - ללא שינוי)
app.get('/api/shopping/history', async (req, res) => { try { const trips = await client.query(`SELECT * FROM shopping_trips ORDER BY trip_date DESC LIMIT 10`); const history = []; for (const trip of trips.rows) { const items = await client.query(`SELECT item_name, estimated_price FROM shopping_list WHERE trip_id = $1`, [trip.id]); history.push({ ...trip, items: items.rows }); } res.json(history); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/add', async (req, res) => { const { itemName, userId } = req.body; try { const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]); const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending'; const priceRes = await client.query('SELECT last_price FROM product_prices WHERE item_name = $1 ORDER BY updated_at DESC LIMIT 1', [itemName]); const estimatedPrice = priceRes.rows.length > 0 ? priceRes.rows[0].last_price : 0; await client.query(`INSERT INTO shopping_list (item_name, requested_by, status, estimated_price) VALUES ($1, $2, $3, $4)`, [itemName, userId, status, estimatedPrice]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/update', async (req, res) => { const { itemId, status } = req.body; try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/update-price', async (req, res) => { const { itemId, price } = req.body; try { await client.query('UPDATE shopping_list SET estimated_price = $1 WHERE id = $2', [price, itemId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/checkout', async (req, res) => { const { totalAmount, userId, storeName, items } = req.body; try { await client.query('BEGIN'); const tripRes = await client.query(`INSERT INTO shopping_trips (user_id, store_name, total_amount, item_count) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, storeName, parseFloat(totalAmount), items.length]); const tripId = tripRes.rows[0].id; await client.query("UPDATE shopping_list SET status = 'bought', trip_id = $1 WHERE status = 'in_cart'", [tripId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, [userId, parseFloat(totalAmount), `קניות ב-${storeName}`]); for (const item of items) { await client.query(`INSERT INTO product_prices (item_name, last_price, store_name) VALUES ($1, $2, $3)`, [item.name, item.price, storeName]); } await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, $3)`, [userId, `סיים קנייה ב-${storeName} (₪${totalAmount})`, 'cart-shopping']); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/academy/answer', async (req, res) => { const { userId, quizId, answerIndex } = req.body; try { await client.query('BEGIN'); const quiz = (await client.query('SELECT * FROM quizzes WHERE id = $1', [quizId])).rows[0]; if (parseInt(answerIndex) === quiz.correct_index) { const reward = parseFloat(quiz.reward); await client.query('UPDATE users SET balance = balance + $1, xp = xp + 20 WHERE id = $2', [reward, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'education', 'income')`, [userId, reward, `הצלחה באקדמיה`]); await client.query('INSERT INTO user_quiz_history (user_id, quiz_id) VALUES ($1, $2)', [userId, quizId]); await client.query('COMMIT'); res.json({ success: true, correct: true, reward: reward }); } else { await client.query('ROLLBACK'); res.json({ success: true, correct: false }); } } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.get('/api/budget/status', async (req, res) => { try { const budgets = (await client.query('SELECT * FROM budgets')).rows; const spending = (await client.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE type = 'expense' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE) GROUP BY category`)).rows; const result = budgets.map(b => { const s = spending.find(x => x.category === b.category); return { category: b.category, limit: parseFloat(b.limit_amount), spent: s ? parseFloat(s.spent) : 0 }; }); res.json(result); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/budget/set', async (req, res) => { const { category, limit } = req.body; try { await client.query(`INSERT INTO budgets (category, limit_amount) VALUES ($1, $2) ON CONFLICT (category) DO UPDATE SET limit_amount = $2`, [category, limit]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/bank/settings', async (req, res) => { const { userId, allowance, interest } = req.body; try { await client.query(`UPDATE users SET weekly_allowance = $1, interest_rate = $2 WHERE id = $3`, [allowance, interest, userId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/bank/payday', async (req, res) => { try { await client.query('BEGIN'); const children = (await client.query("SELECT * FROM users WHERE role = 'child'")).rows; let report = []; for (const child of children) { if (child.weekly_allowance > 0) { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [child.weekly_allowance, child.id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'דמי כיס', 'income', 'income')`, [child.id, child.weekly_allowance]); report.push(`${child.name}: +₪${child.weekly_allowance}`); } if (child.interest_rate > 0 && child.balance > 0) { const interest = (parseFloat(child.balance) * parseFloat(child.interest_rate)) / 100; if (interest > 0) { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [interest, child.id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'ריבית שבועית', 'savings', 'income')`, [child.id, interest]); report.push(`${child.name}: +₪${interest.toFixed(2)} (ריבית)`); } } } await client.query('COMMIT'); res.json({ success: true, report }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/goals', async (req, res) => { const { userId, title, targetAmount } = req.body; try { await client.query(`INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3)`, [userId, title, targetAmount]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/goals/deposit', async (req, res) => { const { goalId, amount, userId } = req.body; try { await client.query('BEGIN'); const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]); if (parseFloat(userRes.rows[0].balance) < parseFloat(amount)) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'אין יתרה' }); } await client.query('UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2', [amount, goalId]); await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'הפקדה לחיסכון', 'savings', 'expense')`, [userId, amount]); await client.query('UPDATE users SET xp = xp + 10 WHERE id = $1', [userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/tasks', async (req, res) => { const { title, reward, assignedTo } = req.body; try { await client.query(`INSERT INTO tasks (title, reward, status, assigned_to) VALUES ($1, $2, 'pending', $3)`, [title, reward, assignedTo]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/tasks/update', async (req, res) => { const { taskId, status } = req.body; try { await client.query('BEGIN'); if (status === 'approved') { const task = (await client.query('SELECT * FROM tasks WHERE id = $1', [taskId])).rows[0]; if (task && task.status !== 'approved') { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [task.reward, task.assigned_to]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'tasks', 'income')`, [task.assigned_to, task.reward, `בוצע: ${task.title}`]); await client.query('UPDATE users SET xp = xp + 5 WHERE id = $1', [task.assigned_to]); } } await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/transaction', async (req, res) => { const { userId, amount, description, category, type } = req.body; try { const cleanAmount = parseFloat(amount); const factor = type === 'income' ? 1 : -1; await client.query('BEGIN'); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, cleanAmount, description, category, type]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [cleanAmount * factor, userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/loans/request', async (req, res) => { const { userId, amount, reason } = req.body; try { await client.query(`INSERT INTO loans (user_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $2, $3, 'pending')`, [userId, amount, reason]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/loans/handle', async (req, res) => { const { loanId, status, interestRate } = req.body; try { await client.query('BEGIN'); if (status === 'active') { const loan = (await client.query('SELECT * FROM loans WHERE id = $1', [loanId])).rows[0]; const total = parseFloat(loan.original_amount) * (1 + (parseFloat(interestRate)||0)/100); await client.query(`UPDATE loans SET status = 'active', interest_rate = $1, remaining_amount = $2 WHERE id = $3`, [interestRate, total, loanId]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [loan.original_amount, loan.user_id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'loans', 'income')`, [loan.user_id, loan.original_amount, `קבלת הלוואה: ${loan.reason}`]); } else { await client.query(`UPDATE loans SET status = 'rejected' WHERE id = $1`, [loanId]); } await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/loans/repay', async (req, res) => { const { loanId, amount, userId } = req.body; try { await client.query('BEGIN'); const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]); if (userRes.rows[0].balance < amount) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'אין מספיק יתרה' }); } await client.query(`UPDATE loans SET remaining_amount = remaining_amount - $1 WHERE id = $2`, [amount, loanId]); const loanRes = await client.query('SELECT remaining_amount FROM loans WHERE id = $1', [loanId]); if (loanRes.rows[0].remaining_amount <= 0) { await client.query(`UPDATE loans SET status = 'paid', remaining_amount = 0 WHERE id = $1`, [loanId]); } await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'החזר הלוואה', 'loans', 'expense')`, [userId, amount]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(port, () => { console.log(`Server running on port ${port}`); });
