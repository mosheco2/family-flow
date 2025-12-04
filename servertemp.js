const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// הגדרת חיבור ל-DB - וודא שהמשתנה DATABASE_URL מוגדר אצלך בסביבה
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect();

// --- שדרוג והזרקת תוכן (כולל אקדמיה) ---
app.get('/setup-db', async (req, res) => {
  try {
    // 1. יצירת טבלאות
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL, balance DECIMAL(10, 2) DEFAULT 0, pin_code VARCHAR(10), age_group VARCHAR(20) DEFAULT 'adult', weekly_allowance DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, xp INTEGER DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), amount DECIMAL(10, 2) NOT NULL, description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, reward DECIMAL(10, 2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id))`,
        `CREATE TABLE IF NOT EXISTS shopping_list (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', estimated_price DECIMAL(10, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(100) NOT NULL, target_amount DECIMAL(10, 2) NOT NULL, current_amount DECIMAL(10, 2) DEFAULT 0, icon VARCHAR(50) DEFAULT 'star', status VARCHAR(20) DEFAULT 'active', target_date TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), original_amount DECIMAL(10, 2) NOT NULL, remaining_amount DECIMAL(10, 2) NOT NULL, reason VARCHAR(255), interest_rate DECIMAL(5, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, category VARCHAR(50) NOT NULL UNIQUE, limit_amount DECIMAL(10, 2) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(255) NOT NULL, icon VARCHAR(50) DEFAULT 'bell', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, type VARCHAR(20) NOT NULL, question VARCHAR(500) NOT NULL, content TEXT, options JSONB NOT NULL, correct_index INTEGER NOT NULL, reward DECIMAL(10, 2) DEFAULT 1, target_age_group VARCHAR(20) DEFAULT 'all', category VARCHAR(50) DEFAULT 'general')`,
        `CREATE TABLE IF NOT EXISTS user_quiz_history (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS product_prices (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, last_price DECIMAL(10, 2) NOT NULL, store_name VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trips (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), item_count INTEGER, trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
    ];

    for (const query of tables) await client.query(query);

    // 2. עדכון עמודות חסרות (למקרה של שדרוג)
    const columns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) DEFAULT 'adult'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0",
        "ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(10, 2) DEFAULT 0",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general'"
    ];
    for (const query of columns) try { await client.query(query); } catch(e) {}

    // 3. הזרקת תוכן אקדמיה (אם הטבלה ריקה)
    const quizCheck = await client.query('SELECT COUNT(*) FROM quizzes');
    if (parseInt(quizCheck.rows[0].count) === 0) {
        const quizzes = [
            // גילאי 6-10: חשבון
            { q: "כמה זה 5 + 3?", opts: ["7", "8", "9", "6"], ans: 1, age: "child_6_10", cat: "math", rew: 2 },
            { q: "כמה זה 12 - 4?", opts: ["6", "8", "10", "7"], ans: 1, age: "child_6_10", cat: "math", rew: 2 },
            { q: "לדני יש 2 תפוחים וקיבל עוד 3. כמה יש לו?", opts: ["4", "6", "5", "3"], ans: 2, age: "child_6_10", cat: "math", rew: 3 },
            { q: "מהו המספר הבא בסדרה: 2, 4, 6, __?", opts: ["7", "8", "9", "10"], ans: 1, age: "child_6_10", cat: "math", rew: 3 },
            { q: "כמה זה 10 + 10?", opts: ["100", "20", "0", "15"], ans: 1, age: "child_6_10", cat: "math", rew: 2 },
            { q: "כמה זה 6 כפול 2?", opts: ["12", "8", "14", "3"], ans: 0, age: "child_6_10", cat: "math", rew: 4 },
            { q: "חצי מ-10 הוא:", opts: ["2", "4", "5", "6"], ans: 2, age: "child_6_10", cat: "math", rew: 3 },
            { q: "כמה אצבעות יש ב-2 ידיים?", opts: ["8", "12", "10", "5"], ans: 2, age: "child_6_10", cat: "math", rew: 2 },
            { q: "איזה מספר גדול יותר?", opts: ["15", "51", "5", "11"], ans: 1, age: "child_6_10", cat: "math", rew: 2 },
            { q: "כמה זה 100 - 1?", opts: ["90", "99", "101", "0"], ans: 1, age: "child_6_10", cat: "math", rew: 3 },
            
            // גילאי 10-15: פיננסים וחשבון מתקדם
            { q: "מה זה 'ריבית'?", opts: ["כסף שמקבלים מתנה", "תשלום על הלוואת כסף", "סוג של מס", "הנחה בחנות"], ans: 1, age: "child_10_15", cat: "finance", rew: 10 },
            { q: "כמה זה 15 כפול 4?", opts: ["45", "50", "60", "55"], ans: 2, age: "child_10_15", cat: "math", rew: 5 },
            { q: "אם מוצר עולה 100 ש״ח ויש 50% הנחה, כמה הוא יעלה?", opts: ["10", "50", "20", "80"], ans: 1, age: "child_10_15", cat: "math", rew: 5 },
            { q: "איך כדאי לחסוך למשהו יקר?", opts: ["לבקש מההורים הכל", "לשים בצד חלק מדמי הכיס כל שבוע", "לקנות כרטיס הגרלה", "לוותר"], ans: 1, age: "child_10_15", cat: "finance", rew: 10 },
            { q: "מהו התקציב?", opts: ["רשימת חלומות", "תכנית לניהול הכנסות והוצאות", "כסף מהבנק", "דף קניות"], ans: 1, age: "child_10_15", cat: "finance", rew: 8 },
            
            // הבנת הנקרא (טקסט קצר)
            { q: "קרא את הקטע וענה: דנה חסכה 10 שקלים כל יום במשך שבוע. מה הסכום הכולל?", content: "דנה החליטה לקנות מתנה לאמא. כל יום, מראשון עד שבת (7 ימים), היא שמה בצד 10 שקלים.", opts: ["50", "60", "70", "100"], ans: 2, age: "child_6_10", cat: "reading", rew: 15 }
        ];

        for (const quiz of quizzes) {
            await client.query(
                `INSERT INTO quizzes (type, question, options, correct_index, target_age_group, category, reward, content) VALUES ('trivia', $1, $2, $3, $4, $5, $6, $7)`,
                [quiz.q, JSON.stringify(quiz.opts), quiz.ans, quiz.age, quiz.cat, quiz.rew, quiz.content || null]
            );
        }
    }

    // משתמש ברירת מחדל אם אין
    const userCheck = await client.query('SELECT * FROM users');
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group) VALUES ('Admin Parent', 'parent', 0, '1234', 'adult')`);
    }

    res.send(`<h2 style="color: green;">System Restored & Content Injected!</h2><p>Added ${quizCheck.rows[0].count === '0' ? 'new' : '0'} quizzes.</p>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- API Endpoints ---

// 1. משתמשים
app.get('/api/public-users', async (req, res) => { try { const result = await client.query('SELECT id, name, role, age_group FROM users ORDER BY role DESC, id ASC'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/login', async (req, res) => { const { userId, pin } = req.body; try { if (!userId && pin) { const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]); if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] }); return res.status(401).json({ success: false, message: 'קוד שגוי' }); } const result = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]); if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] }); else res.status(401).json({ success: false, message: 'קוד שגוי' }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/create-user', async (req, res) => { const { name, pin, role, initialBalance, ageGroup } = req.body; try { const age = ageGroup || (role === 'parent' ? 'adult' : 'child_6_10'); await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group, weekly_allowance, interest_rate) VALUES ($1, $2, $3, $4, $5, 0, 0)`, [name, role, parseFloat(initialBalance)||0, pin, age]); await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES (NULL, $1, 'user-plus')`, [`משתמש חדש: ${name}`]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

// 2. נתונים מלאים
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let familyMembers = [];
    if (user.role === 'parent' || user.role === 'child') {
        familyMembers = (await client.query('SELECT id, name, balance, role, age_group, weekly_allowance, interest_rate, xp FROM users ORDER BY id')).rows;
    }
    
    // שליפת חידונים חכמה לפי גיל + שלא בוצעו
    let quizzes = [];
    if (user.role === 'child') {
        quizzes = (await client.query(`SELECT q.* FROM quizzes q WHERE (q.target_age_group = $1 OR q.target_age_group = 'all') AND NOT EXISTS (SELECT 1 FROM user_quiz_history h WHERE h.quiz_id = q.id AND h.user_id = $2) ORDER BY id ASC LIMIT 5`, [user.age_group || 'child_6_10', userId])).rows;
    } else if (user.role === 'parent') {
        quizzes = (await client.query('SELECT * FROM quizzes ORDER BY id DESC LIMIT 20')).rows;
    }

    let transQuery = `SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`;
    if (user.role === 'child') transQuery += ` WHERE t.user_id = ${userId}`;
    transQuery += ` ORDER BY t.date DESC LIMIT 50`;
    const transRes = await client.query(transQuery);
    
    let tasksQuery = `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id `;
    if (user.role === 'child') tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`; else tasksQuery += ` WHERE t.status != 'approved'`; tasksQuery += ` ORDER BY t.id DESC`;
    const tasksRes = await client.query(tasksQuery);

    // חכמת ההמונים בסופר
    const shopRes = await client.query(`
        SELECT 
            s.*, 
            u.name as requester_name, 
            -- שליפת המחיר הכי זול שנמצא אי פעם לאותו מוצר
            best.last_price as best_price,
            best.store_name as best_store,
            best.updated_at as best_date
        FROM shopping_list s 
        LEFT JOIN users u ON s.requested_by = u.id 
        LEFT JOIN (
            SELECT DISTINCT ON (item_name) item_name, last_price, store_name, updated_at
            FROM product_prices
            ORDER BY item_name, last_price ASC -- הכי זול ראשון
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

// 3. קניות - הוספה, עדכון וסיום
app.post('/api/shopping/add', async (req, res) => { 
    const { itemName, userId } = req.body; 
    try { 
        const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]); 
        const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending'; 
        // ניסיון לנחש מחיר לפי היסטוריה
        const priceRes = await client.query('SELECT last_price FROM product_prices WHERE item_name = $1 ORDER BY updated_at DESC LIMIT 1', [itemName]);
        const estimatedPrice = priceRes.rows.length > 0 ? priceRes.rows[0].last_price : 0;

        await client.query(`INSERT INTO shopping_list (item_name, requested_by, status, estimated_price) VALUES ($1, $2, $3, $4)`, [itemName, userId, status, estimatedPrice]); 
        res.json({ success: true }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

app.post('/api/shopping/update', async (req, res) => { 
    const { itemId, status } = req.body; 
    try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); } 
});

app.post('/api/shopping/update-price', async (req, res) => {
    const { itemId, price } = req.body;
    try {
        await client.query('UPDATE shopping_list SET estimated_price = $1 WHERE id = $2', [price, itemId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// היסטוריית קניות
app.get('/api/shopping/history', async (req, res) => {
    try {
        // שליפת קניות אחרונות עם פירוט פריטים (לוגיקה מפושטת)
        const trips = await client.query('SELECT * FROM shopping_trips ORDER BY trip_date DESC LIMIT 10');
        // לגרסה מתקדמת יותר נצטרך טבלת קישור, כרגע נחזיר את הטיולים
        // ונוסיף פירוט דמה או נשמור JSON של פריטים בטבלת הטיולים בעתיד
        // לבינתיים, נשלוף פשוט את הטבלה
        res.json(trips.rows.map(t => ({...t, items: []}))); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const { totalAmount, userId, storeName, items } = req.body; 
    try {
        await client.query('BEGIN');
        // העברת כל המוצרים שבסל לסטטוס 'bought'
        await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'");
        
        // תיעוד הוצאה
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, 
            [userId, parseFloat(totalAmount), `קניות ב-${storeName}`]);
            
        // תיעוד הטיול עצמו
        await client.query(`INSERT INTO shopping_trips (user_id, store_name, total_amount, item_count) VALUES ($1, $2, $3, $4)`, 
            [userId, storeName, parseFloat(totalAmount), items.length]);

        // עדכון מחירים למאגר חכמת ההמונים
        for (const item of items) {
            await client.query(`
                INSERT INTO product_prices (item_name, last_price, store_name) 
                VALUES ($1, $2, $3)
            `, [item.name, item.price, storeName]);
        }

        await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, $3)`, [userId, `סיים קנייה ב-${storeName} (₪${totalAmount})`, 'cart-shopping']); 
        await client.query('COMMIT'); 
        res.json({ success: true }); 
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } 
});

// 4. אקדמיה, יעדים ועוד
app.post('/api/academy/create', async (req, res) => { const { type, question, content, options, correctIndex, reward, targetAge } = req.body; try { await client.query(`INSERT INTO quizzes (type, question, content, options, correct_index, reward, target_age_group) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [type, question, content, JSON.stringify(options), correctIndex, reward, targetAge]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
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
