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

// --- שדרוג והזרקת תוכן (מקבץ 2) ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL, balance DECIMAL(10, 2) DEFAULT 0, pin_code VARCHAR(10), birth_year INTEGER, age_group VARCHAR(20) DEFAULT 'adult', weekly_allowance DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, xp INTEGER DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), amount DECIMAL(10, 2) NOT NULL, description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, reward DECIMAL(10, 2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id))`,
        `CREATE TABLE IF NOT EXISTS shopping_list (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', estimated_price DECIMAL(10, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(100) NOT NULL, target_amount DECIMAL(10, 2) NOT NULL, current_amount DECIMAL(10, 2) DEFAULT 0, icon VARCHAR(50) DEFAULT 'star', status VARCHAR(20) DEFAULT 'active', target_date TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), original_amount DECIMAL(10, 2) NOT NULL, remaining_amount DECIMAL(10, 2) NOT NULL, reason VARCHAR(255), interest_rate DECIMAL(5, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, category VARCHAR(50) NOT NULL UNIQUE, limit_amount DECIMAL(10, 2) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(255) NOT NULL, icon VARCHAR(50) DEFAULT 'bell', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        // טבלה משודרגת לחידונים ומקבצים
        `CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, title VARCHAR(255), type VARCHAR(20) NOT NULL, questions_json JSONB, reward DECIMAL(10, 2) DEFAULT 1, target_min_age INTEGER DEFAULT 0, target_max_age INTEGER DEFAULT 99, category VARCHAR(50) DEFAULT 'general', is_set BOOLEAN DEFAULT FALSE)`,
        `CREATE TABLE IF NOT EXISTS user_quiz_history (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), score INTEGER, completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS product_prices (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, last_price DECIMAL(10, 2) NOT NULL, store_name VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trips (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), item_count INTEGER, trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INTEGER REFERENCES shopping_trips(id), item_name VARCHAR(255), price DECIMAL(10, 2))`,
        // טבלה חדשה לשיוך משימות
        `CREATE TABLE IF NOT EXISTS assignments (id SERIAL PRIMARY KEY, parent_id INTEGER REFERENCES users(id), child_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), status VARCHAR(20) DEFAULT 'assigned', assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
    ];

    for (const query of tables) await client.query(query);

    // הזרקת תוכן מאסיבית (רק אם הטבלה ריקה)
    const quizCount = await client.query('SELECT COUNT(*) FROM quizzes');
    if (parseInt(quizCount.rows[0].count) === 0) {
        
        // 1. מחולל תרגילי חשבון (20 מקבצים לכל קבוצת גיל)
        const generateMathSet = (minAge, maxAge, op, count, diff) => {
            const questions = [];
            for(let i=0; i<15; i++) { // 15 שאלות במקבץ
                let a = Math.floor(Math.random() * diff) + 1;
                let b = Math.floor(Math.random() * diff) + 1;
                let qStr = "", ans = 0, opts = [];
                
                if(op === '+') { qStr = `${a} + ${b} = ?`; ans = a+b; }
                if(op === '-') { if(a<b) [a,b]=[b,a]; qStr = `${a} - ${b} = ?`; ans = a-b; }
                if(op === '*') { a = Math.floor(Math.random()*10)+1; b = Math.floor(Math.random()*10)+1; qStr = `${a} x ${b} = ?`; ans = a*b; }
                
                opts = [ans, ans+1, ans-1, ans+2].sort(()=>Math.random()-0.5);
                questions.push({q: qStr, opts: opts, correct: opts.indexOf(ans)});
            }
            return {
                title: `חשבון: ${op === '+' ? 'חיבור' : (op === '-' ? 'חיסור' : 'כפל')} (גילאי ${minAge}-${maxAge})`,
                questions: questions,
                min: minAge, max: maxAge, cat: 'math', rew: 5
            };
        };

        const sets = [];
        // גילאי 6-8 (חיבור/חיסור פשוט)
        for(let i=0; i<10; i++) sets.push(generateMathSet(6, 8, '+', i, 10));
        for(let i=0; i<10; i++) sets.push(generateMathSet(6, 8, '-', i, 10));
        // גילאי 8-10 (חיבור/חיסור מורכב)
        for(let i=0; i<10; i++) sets.push(generateMathSet(8, 10, '+', i, 50));
        for(let i=0; i<10; i++) sets.push(generateMathSet(8, 10, '-', i, 50));
        // גילאי 10-15 (כפל)
        for(let i=0; i<20; i++) sets.push(generateMathSet(10, 15, '*', i, 0));

        // 2. הבנת הנקרא (דוגמאות לסטים)
        const textSets = [
            {
                title: "הבנת הנקרא: דני והכלב",
                min: 6, max: 9, cat: 'reading', rew: 10,
                questions: [
                    { content: "לדני יש כלב חמוד בשם כתם. לכתם יש פרווה לבנה עם כתם שחור על הגב. דני אוהב לרוץ עם כתם בפארק.", q: "מה השם של הכלב?", opts: ["דני", "כתם", "פארק", "שחור"], correct: 1 },
                    { content: "המשך הסיפור...", q: "איזה צבע הפרווה של כתם?", opts: ["שחור", "חום", "לבן", "אפור"], correct: 2 },
                    { content: "המשך...", q: "איפה דני רץ עם כתם?", opts: ["בבית", "בבית הספר", "בפארק", "ברחוב"], correct: 2 }
                ]
            },
            {
                title: "הבנת הנקרא: החיסכון הראשון",
                min: 8, max: 12, cat: 'reading', rew: 15,
                questions: [
                    { content: "מאיה רצתה לקנות אופניים חדשים. האופניים עלו 500 שקלים. למאיה היו רק 200 שקלים בקופה. היא החליטה לחסוך את דמי הכיס שלה במשך חודשיים.", q: "כמה כסף היה למאיה בהתחלה?", opts: ["500", "200", "300", "100"], correct: 1 },
                    { content: "המשך...", q: "מה מאיה רצתה לקנות?", opts: ["בובה", "מחשב", "אופניים", "ספר"], correct: 2 }
                ]
            }
        ];

        // 3. חינוך פיננסי (שאלות בודדות ומקבצים)
        const financeSets = [
            {
                title: "מושגים בסיסיים בכסף",
                min: 8, max: 15, cat: 'finance', rew: 20,
                questions: [
                    { q: "מהי ריבית?", opts: ["מתנה מהבנק", "תשלום על הלוואת כסף", "סוג של מס", "כרטיס אשראי"], correct: 1 },
                    { q: "מה זה 'אוברדרפט' (מינוס)?", opts: ["שיש הרבה כסף", "כשמוציאים יותר ממה שיש", "שם של בנק", "הנחה בחנות"], correct: 1 },
                    { q: "למה כדאי לחסוך?", opts: ["כדי לקנות דברים יקרים בעתיד", "כדי שהכסף יעלם", "סתם ככה", "לא כדאי לחסוך"], correct: 0 }
                ]
            }
        ];

        // הוספה ל-DB
        const allContent = [...sets, ...textSets, ...financeSets];
        for (const s of allContent) {
            await client.query(
                `INSERT INTO quizzes (title, type, questions_json, reward, target_min_age, target_max_age, category, is_set) 
                 VALUES ($1, 'set', $2, $3, $4, $5, $6, TRUE)`,
                [s.title, JSON.stringify(s.questions), s.rew, s.min, s.max, s.cat]
            );
        }
    }

    // משתמש אדמין
    const userCheck = await client.query('SELECT * FROM users');
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code, birth_year) VALUES ('Admin Parent', 'parent', 0, '1234', 1980)`);
    }

    res.send(`<h2 style="color: green;">System Updated! Academy Content (Sets) & Assignments Enabled.</h2>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- API Endpoints ---

// 1. משתמשים (כולל עדכון פרופיל וגיל)
app.get('/api/public-users', async (req, res) => { try { const result = await client.query('SELECT id, name, role, birth_year FROM users ORDER BY role DESC, id ASC'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/login', async (req, res) => { const { userId, pin } = req.body; try { if (!userId && pin) { const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]); if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] }); return res.status(401).json({ success: false, message: 'קוד שגוי' }); } const result = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]); if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] }); else res.status(401).json({ success: false, message: 'קוד שגוי' }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/create-user', async (req, res) => { 
    const { name, pin, role, initialBalance, birthYear } = req.body; 
    try { 
        await client.query(`INSERT INTO users (name, role, balance, pin_code, birth_year, weekly_allowance, interest_rate) VALUES ($1, $2, $3, $4, $5, 0, 0)`, [name, role, parseFloat(initialBalance)||0, pin, parseInt(birthYear)]); 
        await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES (NULL, $1, 'user-plus')`, [`משתמש חדש: ${name}`]); 
        res.json({ success: true }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

app.post('/api/users/update', async (req, res) => {
    const { userId, name, pin, birthYear } = req.body;
    try {
        await client.query('UPDATE users SET name = $1, pin_code = $2, birth_year = $3 WHERE id = $4', [name, pin, birthYear, userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. נתונים מלאים (כולל משימות אקדמיה)
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let familyMembers = [];
    if (user.role === 'parent' || user.role === 'child') {
        familyMembers = (await client.query('SELECT id, name, balance, role, birth_year, weekly_allowance, interest_rate, xp FROM users ORDER BY id')).rows;
    }
    
    // לוגיקה חכמה לשליפת אקדמיה (כולל משימות משויכות וגיל מדויק)
    let quizzes = [];
    if (user.role === 'child') {
        const userAge = new Date().getFullYear() - (user.birth_year || 2015);
        
        // 1. משימות ששויכו ע"י הורה
        const assigned = await client.query(`
            SELECT q.*, a.id as assignment_id, 'assigned' as origin 
            FROM quizzes q 
            JOIN assignments a ON q.id = a.quiz_id 
            WHERE a.child_id = $1 AND a.status = 'assigned'
        `, [userId]);

        // 2. משימות כלליות לפי גיל
        const general = await client.query(`
            SELECT q.*, NULL as assignment_id, 'pool' as origin 
            FROM quizzes q 
            WHERE $1 >= q.target_min_age AND $1 <= q.target_max_age
            AND NOT EXISTS (SELECT 1 FROM user_quiz_history h WHERE h.quiz_id = q.id AND h.user_id = $2)
            ORDER BY RANDOM() LIMIT 10
        `, [userAge, userId]);

        quizzes = [...assigned.rows, ...general.rows];

    } else if (user.role === 'parent') {
        // הורה רואה הכל כדי לשייך
        quizzes = (await client.query('SELECT * FROM quizzes ORDER BY category, target_min_age')).rows;
    }

    // שאילתות קיימות (שופינג, משימות וכו')
    let transQuery = `SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`; if (user.role === 'child') transQuery += ` WHERE t.user_id = ${userId}`; transQuery += ` ORDER BY t.date DESC LIMIT 50`; const transRes = await client.query(transQuery);
    let tasksQuery = `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id `; if (user.role === 'child') tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`; else tasksQuery += ` WHERE t.status != 'approved'`; tasksQuery += ` ORDER BY t.id DESC`; const tasksRes = await client.query(tasksQuery);
    const shopRes = await client.query(`SELECT s.*, u.name as requester_name, latest.last_price, latest.store_name as last_store, latest.updated_at as last_date, best.price as best_price, best.store_name as best_store, best.updated_at as best_date FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id LEFT JOIN (SELECT DISTINCT ON (item_name) item_name, last_price, store_name, updated_at FROM product_prices ORDER BY item_name, updated_at DESC) latest ON s.item_name = latest.item_name LEFT JOIN (SELECT DISTINCT ON (item_name) item_name, last_price as price, store_name, updated_at FROM product_prices WHERE updated_at > NOW() - INTERVAL '3 months' ORDER BY item_name, last_price ASC) best ON s.item_name = best.item_name WHERE s.status != 'bought' ORDER BY s.id DESC`);
    const goalsRes = await client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [userId]);
    let loansQuery = `SELECT l.*, u.name as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id`; if (user.role === 'child') loansQuery += ` WHERE l.user_id = ${userId}`; else loansQuery += ` WHERE l.status != 'paid'`; loansQuery += ` ORDER BY l.created_at DESC`; const loansRes = await client.query(loansQuery);

    res.json({ user, transactions: transRes.rows, family: familyMembers, tasks: tasksRes.rows, shopping_list: shopRes.rows, goals: goalsRes.rows, loans: loansRes.rows, quizzes: quizzes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. אקדמיה - שיוך ומענה (מתקדם)
app.post('/api/academy/assign', async (req, res) => {
    const { parentId, childId, quizId } = req.body;
    try {
        await client.query(`INSERT INTO assignments (parent_id, child_id, quiz_id) VALUES ($1, $2, $3)`, [parentId, childId, quizId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/academy/complete', async (req, res) => {
    const { userId, quizId, score, assignmentId, reward } = req.body;
    try {
        await client.query('BEGIN');
        
        // מתן תגמול אם הציון חיובי (מעל 60 למשל)
        if (score >= 60) {
            await client.query('UPDATE users SET balance = balance + $1, xp = xp + 50 WHERE id = $2', [reward, userId]);
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'education', 'income')`, [userId, reward, `סיום אתגר בהצלחה (${score}%)`]);
        }
        
        await client.query('INSERT INTO user_quiz_history (user_id, quiz_id, score) VALUES ($1, $2, $3)', [userId, quizId, score]);
        
        if (assignmentId) {
            await client.query("UPDATE assignments SET status = 'completed' WHERE id = $1", [assignmentId]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

// שאר האנדפוינטים (קניות, בנק וכו' - ללא שינוי)
app.post('/api/shopping/add', async (req, res) => { const { itemName, userId } = req.body; try { const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]); const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending'; const priceRes = await client.query('SELECT last_price FROM product_prices WHERE item_name = $1 ORDER BY updated_at DESC LIMIT 1', [itemName]); const estimatedPrice = priceRes.rows.length > 0 ? priceRes.rows[0].last_price : 0; await client.query(`INSERT INTO shopping_list (item_name, requested_by, status, estimated_price) VALUES ($1, $2, $3, $4)`, [itemName, userId, status, estimatedPrice]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/update', async (req, res) => { const { itemId, status } = req.body; try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/update-price', async (req, res) => { const { itemId, price } = req.body; try { await client.query('UPDATE shopping_list SET estimated_price = $1 WHERE id = $2', [price, itemId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/shopping/history', async (req, res) => { try { const trips = await client.query('SELECT * FROM shopping_trips ORDER BY trip_date DESC LIMIT 20'); const tripsWithItems = []; for (const trip of trips.rows) { const itemsRes = await client.query('SELECT * FROM shopping_trip_items WHERE trip_id = $1', [trip.id]); tripsWithItems.push({ ...trip, items: itemsRes.rows }); } res.json(tripsWithItems); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/checkout', async (req, res) => { const { totalAmount, userId, storeName, items } = req.body; try { await client.query('BEGIN'); await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'"); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, [userId, parseFloat(totalAmount), `קניות ב-${storeName}`]); const tripRes = await client.query(`INSERT INTO shopping_trips (user_id, store_name, total_amount, item_count) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, storeName, parseFloat(totalAmount), items.length]); const tripId = tripRes.rows[0].id; for (const item of items) { await client.query(`INSERT INTO product_prices (item_name, last_price, store_name) VALUES ($1, $2, $3)`, [item.name, item.price, storeName]); await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, price) VALUES ($1, $2, $3)`, [tripId, item.name, item.price]); } await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, $3)`, [userId, `סיים קנייה ב-${storeName} (₪${totalAmount})`, 'cart-shopping']); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
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
