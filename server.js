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

// --- Setup DB & Content Injection (V2.5) ---
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
        `CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, title VARCHAR(255), type VARCHAR(20) NOT NULL, question VARCHAR(500), content TEXT, options JSONB, correct_index INTEGER, questions_json JSONB, reward DECIMAL(10, 2) DEFAULT 1, target_min_age INTEGER DEFAULT 0, target_max_age INTEGER DEFAULT 99, category VARCHAR(50) DEFAULT 'general', is_set BOOLEAN DEFAULT FALSE)`,
        `CREATE TABLE IF NOT EXISTS user_quiz_history (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), score INTEGER, completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS assignments (id SERIAL PRIMARY KEY, parent_id INTEGER REFERENCES users(id), child_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id), status VARCHAR(20) DEFAULT 'assigned', assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS product_prices (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, last_price DECIMAL(10, 2) NOT NULL, store_name VARCHAR(100), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trips (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), item_count INTEGER, trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INTEGER REFERENCES shopping_trips(id), item_name VARCHAR(255), price DECIMAL(10, 2))`
    ];

    for (const query of tables) await client.query(query);

    // Auto-Migration
    const columns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) DEFAULT 'adult'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0",
        "ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(10, 2) DEFAULT 0",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS title VARCHAR(255)",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS questions_json JSONB",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_set BOOLEAN DEFAULT FALSE",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general'",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS target_min_age INTEGER DEFAULT 0",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS target_max_age INTEGER DEFAULT 99",
        "ALTER TABLE quizzes ALTER COLUMN question DROP NOT NULL",
        "ALTER TABLE quizzes ALTER COLUMN options DROP NOT NULL",
        "ALTER TABLE quizzes ALTER COLUMN correct_index DROP NOT NULL"
    ];
    for (const query of columns) try { await client.query(query); } catch(e) { console.log('Migration:', e.message); }

    // Inject Academy Content (Sets) - Expanded for Teens
    const quizCount = await client.query('SELECT COUNT(*) FROM quizzes WHERE is_set = TRUE');
    if (parseInt(quizCount.rows[0].count) < 10) {
        console.log("Injecting Massive Academy Content...");
        
        const generateMathSet = (min, max, op, diff, count=10) => {
            const qs = [];
            for(let i=0; i<count; i++) {
                let a = Math.floor(Math.random() * diff) + 1;
                let b = Math.floor(Math.random() * diff) + 1;
                let qStr = "", ans = 0;
                
                if(op === '+') { qStr = `${a} + ${b} = ?`; ans = a+b; }
                else if(op === '-') { if(a<b) [a,b]=[b,a]; qStr = `${a} - ${b} = ?`; ans = a-b; }
                else if(op === '*') { a = Math.floor(Math.random()*12)+1; b = Math.floor(Math.random()*12)+1; qStr = `${a} x ${b} = ?`; ans = a*b; }
                else if(op === '^') { a = Math.floor(Math.random()*5)+2; b = 2; qStr = `${a} בריבוע = ?`; ans = a*a; } // חזקות
                else if(op === 'sq') { ans = Math.floor(Math.random()*10)+1; a = ans*ans; qStr = `שורש של ${a} = ?`; } // שורשים
                
                let opts = [ans, ans+1, ans-1, ans+Math.floor(Math.random()*5)+2].filter(x=>x>=0);
                opts = [...new Set(opts)].sort(()=>Math.random()-0.5);
                while(opts.length < 4) opts.push(ans + opts.length + 1); // Fill if duplicates removed
                
                qs.push({q: qStr, opts: opts, correct: opts.indexOf(ans)});
            }
            return { title: `מתמטיקה: ${op==='+'?'חיבור':(op==='-'?'חיסור':(op==='*'?'כפל':(op==='^'?'חזקות':'שורשים')))} (גיל ${min}-${max})`, questions: qs, min, max, cat: 'math', rew: (max>12?10:5) };
        };

        const content = [
            // גילאי 6-8
            generateMathSet(6, 8, '+', 10), 
            generateMathSet(6, 8, '-', 10),
            {
                title: "הבנת הנקרא: דני והכלב (צעירים)",
                min: 6, max: 9, cat: 'reading', rew: 10,
                questions: [
                    { content: "לדני יש כלב חמוד בשם כתם. לכתם יש פרווה לבנה עם כתם שחור על הגב.", q: "מה השם של הכלב?", opts: ["דני", "כתם", "פארק", "שחור"], correct: 1 },
                    { content: "המשך...", q: "איזה צבע הפרווה של כתם?", opts: ["שחור", "חום", "לבן", "אפור"], correct: 2 }
                ]
            },
            
            // גילאי 8-12
            generateMathSet(8, 12, '+', 50),
            generateMathSet(8, 12, '-', 50),
            generateMathSet(8, 12, '*', 0),
            {
                title: "חינוך פיננסי: חיסכון (יסודי)",
                min: 8, max: 13, cat: 'finance', rew: 15,
                questions: [
                    { q: "למה כדאי לשמור כסף בצד?", opts: ["כדי לקנות משהו יקר בעתיד", "כדי לאבד אותו", "כדי לתת לחברים", "לא כדאי"], correct: 0 },
                    { q: "מה זה בנק?", opts: ["חנות ממתקים", "מקום לשמירת כסף", "בית ספר", "פארק"], correct: 1 }
                ]
            },

            // נוער 13-18 (מתקדם)
            generateMathSet(13, 18, '*', 0),
            generateMathSet(13, 18, '^', 0), // חזקות
            generateMathSet(13, 18, 'sq', 0), // שורשים
            {
                title: "שוק ההון ופיננסים (מתקדם)",
                min: 14, max: 99, cat: 'finance', rew: 25,
                questions: [
                    { q: "מהי מניה?", opts: ["חלק בבעלות על חברה", "הלוואה לממשלה", "כסף מזומן", "סוג של מס"], correct: 0 },
                    { q: "מהי ריבית דריבית?", opts: ["ריבית על הקרן ועל הריבית שנצברה", "ריבית רגילה", "ריבית שלילית", "עמלת בנק"], correct: 0 },
                    { q: "מה זה מדד המחירים לצרכן?", opts: ["כמה עולה עגבניה", "מדד לשינוי במחירים במשק (אינפלציה)", "מדד של בורסה", "מחיר הדירות"], correct: 1 },
                    { q: "מה ההבדל בין ברוטו לנטו?", opts: ["אין הבדל", "ברוטו זה לפני מיסים, נטו זה מה שנכנס לבנק", "נטו זה לפני מיסים", "ברוטו זה המשקל של הכסף"], correct: 1 }
                ]
            },
            {
                title: "הבנת הנקרא: המהפכה התעשייתית",
                min: 13, max: 18, cat: 'reading', rew: 20,
                questions: [
                    { content: "המהפכה התעשייתית החלה במאה ה-18 בבריטניה. היא שינתה את העולם מחברה חקלאית לחברה תעשייתית ומודרנית.", q: "היכן החלה המהפכה?", opts: ["צרפת", "בריטניה", "ארה\"ב", "סין"], correct: 1 },
                    { content: "המשך...", q: "באיזו מאה זה קרה?", opts: ["17", "18", "19", "20"], correct: 1 }
                ]
            }
        ];

        for (const c of content) {
            await client.query(`INSERT INTO quizzes (title, type, questions_json, reward, target_min_age, target_max_age, category, is_set) VALUES ($1, 'set', $2, $3, $4, $5, $6, TRUE)`, 
            [c.title, JSON.stringify(c.questions), c.rew, c.min, c.max, c.cat]);
        }
    }

    // Default Admin
    const uCheck = await client.query('SELECT * FROM users');
    if (uCheck.rows.length === 0) await client.query(`INSERT INTO users (name, role, balance, pin_code, birth_year) VALUES ('Admin Parent', 'parent', 0, '1234', 1980)`);

    res.send(`<h2 style="color: green;">System Updated V2.5 (Full Content)</h2><p>Teens, Math, Finance & Reading content injected.</p>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- API Endpoints ---

// 1. Users & Logic
app.get('/api/public-users', async (req, res) => { try { const r = await client.query('SELECT id, name, role, birth_year FROM users ORDER BY role DESC, id ASC'); res.json(r.rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/login', async (req, res) => { const { userId, pin } = req.body; try { if (!userId && pin) { const r = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]); if (r.rows.length > 0) return res.json({ success: true, user: r.rows[0] }); return res.status(401).json({ success: false }); } const r = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]); if (r.rows.length > 0) res.json({ success: true, user: r.rows[0] }); else res.status(401).json({ success: false }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.post('/api/create-user', async (req, res) => { 
    const { name, pin, role, birthYear } = req.body; 
    try { 
        // חישוב גיל וקטגוריה
        const currentYear = new Date().getFullYear();
        const age = currentYear - parseInt(birthYear);
        let ageGroup = 'adult';
        if (role === 'child') {
            if (age <= 10) ageGroup = 'child_6_10';
            else if (age <= 14) ageGroup = 'child_10_15';
            else ageGroup = 'teen_15_18';
        }

        await client.query(`INSERT INTO users (name, role, balance, pin_code, birth_year, age_group, weekly_allowance, interest_rate) VALUES ($1, $2, 0, $3, $4, $5, 0, 0)`, [name, role, pin, parseInt(birthYear), ageGroup]); 
        await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES (NULL, $1, 'user-plus')`, [`משתמש חדש: ${name}`]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/users/update', async (req, res) => { const { userId, name, pin, birthYear } = req.body; try { await client.query('UPDATE users SET name = $1, pin_code = $2, birth_year = $3 WHERE id = $4', [name, pin, birthYear, userId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// 2. Data Fetch (Smart Content Filtering)
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let family = [], quizzes = [];
    family = (await client.query('SELECT id, name, balance, role, birth_year, weekly_allowance, interest_rate, xp, pin_code FROM users ORDER BY id')).rows;

    if (user.role === 'child') {
        const age = user.birth_year ? (new Date().getFullYear() - user.birth_year) : 10;
        
        // שליפת משימות משויכות
        const assigned = await client.query(`SELECT q.*, a.id as assignment_id, 'assigned' as origin FROM quizzes q JOIN assignments a ON q.id = a.quiz_id WHERE a.child_id = $1 AND a.status = 'assigned'`, [userId]);
        
        // שליפת מאגר כללי לפי גיל (כולל 15+)
        // אם הגיל מעל 15, נשלוף גם שאלות של 'teen_15_18' וגם 'general'
        const general = await client.query(`
            SELECT q.*, NULL as assignment_id, 'pool' as origin 
            FROM quizzes q 
            WHERE ($1 >= q.target_min_age AND $1 <= q.target_max_age) 
            AND NOT EXISTS (SELECT 1 FROM user_quiz_history h WHERE h.quiz_id = q.id AND h.user_id = $2)
            ORDER BY category, RANDOM() LIMIT 15
        `, [age, userId]);
        
        quizzes = [...assigned.rows, ...general.rows];
    } else {
        quizzes = (await client.query('SELECT * FROM quizzes ORDER BY target_min_age, category')).rows;
    }

    const [trans, tasks, shop, goals, loans] = await Promise.all([
        client.query(`SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id ${user.role==='child' ? `WHERE t.user_id=${userId}`:''} ORDER BY t.date DESC LIMIT 50`),
        client.query(`SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id ${user.role==='child' ? `WHERE t.assigned_to=${userId} AND t.status!='approved'` : `WHERE t.status!='approved'`} ORDER BY t.id DESC`),
        client.query(`SELECT s.*, u.name as requester_name, l.last_price, l.store_name as last_store, l.updated_at as last_date, b.price as best_price, b.store_name as best_store, b.updated_at as best_date FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id LEFT JOIN (SELECT DISTINCT ON (item_name) item_name, last_price, store_name, updated_at FROM product_prices ORDER BY item_name, updated_at DESC) l ON s.item_name = l.item_name LEFT JOIN (SELECT DISTINCT ON (item_name) item_name, last_price as price, store_name, updated_at FROM product_prices WHERE updated_at > NOW() - INTERVAL '3 months' ORDER BY item_name, last_price ASC) b ON s.item_name = b.item_name WHERE s.status != 'bought' ORDER BY s.id DESC`),
        client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [userId]),
        client.query(`SELECT l.*, u.name as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id ${user.role==='child' ? `WHERE l.user_id=${userId}` : `WHERE l.status!='paid'`} ORDER BY l.created_at DESC`)
    ]);

    res.json({ user, transactions: trans.rows, family, tasks: tasks.rows, shopping_list: shop.rows, goals: goals.rows, loans: loans.rows, quizzes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Academy & Requests
app.post('/api/academy/assign', async (req, res) => { const { parentId, childId, quizId } = req.body; try { await client.query(`INSERT INTO assignments (parent_id, child_id, quiz_id) VALUES ($1, $2, $3)`, [parentId, childId, quizId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/academy/request', async (req, res) => { const { userId, name } = req.body; try { await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, 'hand-raised')`, [userId, `${name} ביקש/ה אתגר חדש!`]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/academy/complete', async (req, res) => { const { userId, quizId, score, assignmentId, reward } = req.body; try { await client.query('BEGIN'); if (score >= 60) { await client.query('UPDATE users SET balance = balance + $1, xp = xp + 50 WHERE id = $2', [reward, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'education', 'income')`, [userId, reward, `הצלחה באתגר (${score}%)`]); } await client.query('INSERT INTO user_quiz_history (user_id, quiz_id, score) VALUES ($1, $2, $3)', [userId, quizId, score]); if (assignmentId) await client.query("UPDATE assignments SET status = 'completed' WHERE id = $1", [assignmentId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });

// Shopping & Others (Unchanged)
app.post('/api/shopping/add', async (req, res) => { const { itemName, userId } = req.body; try { const r = await client.query('SELECT role FROM users WHERE id=$1', [userId]); const st = r.rows[0].role==='parent'?'approved':'pending'; const p = await client.query('SELECT last_price FROM product_prices WHERE item_name=$1 ORDER BY updated_at DESC LIMIT 1', [itemName]); const ep = p.rows.length>0?p.rows[0].last_price:0; await client.query(`INSERT INTO shopping_list (item_name, requested_by, status, estimated_price) VALUES ($1, $2, $3, $4)`, [itemName, userId, st, ep]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/update', async (req, res) => { const { itemId, status } = req.body; try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/update-price', async (req, res) => { const { itemId, price } = req.body; try { await client.query('UPDATE shopping_list SET estimated_price = $1 WHERE id = $2', [price, itemId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/shopping/history', async (req, res) => { try { const t = await client.query('SELECT * FROM shopping_trips ORDER BY trip_date DESC LIMIT 20'); const resArr = []; for(const trip of t.rows) { const i = await client.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [trip.id]); resArr.push({...trip, items: i.rows}); } res.json(resArr); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/checkout', async (req, res) => { const { totalAmount, userId, storeName, items } = req.body; try { await client.query('BEGIN'); await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'"); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, [userId, totalAmount, `קניות ב-${storeName}`]); const tr = await client.query(`INSERT INTO shopping_trips (user_id, store_name, total_amount, item_count) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, storeName, totalAmount, items.length]); const tid = tr.rows[0].id; for(const i of items) { await client.query(`INSERT INTO product_prices (item_name, last_price, store_name) VALUES ($1, $2, $3)`, [i.name, i.price, storeName]); await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, price) VALUES ($1, $2, $3)`, [tid, i.name, i.price]); } await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, $3)`, [userId, `סיים קנייה ב-${storeName} (₪${totalAmount})`, 'cart-shopping']); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.get('/api/budget/status', async (req, res) => { try { const b = (await client.query('SELECT * FROM budgets')).rows; const s = (await client.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE type = 'expense' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE) GROUP BY category`)).rows; const r = b.map(bg => { const sp = s.find(x => x.category === bg.category); return { category: bg.category, limit: parseFloat(bg.limit_amount), spent: sp ? parseFloat(sp.spent) : 0 }; }); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/budget/set', async (req, res) => { const { category, limit } = req.body; try { await client.query(`INSERT INTO budgets (category, limit_amount) VALUES ($1, $2) ON CONFLICT (category) DO UPDATE SET limit_amount = $2`, [category, limit]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/bank/settings', async (req, res) => { const { userId, allowance, interest } = req.body; try { await client.query(`UPDATE users SET weekly_allowance = $1, interest_rate = $2 WHERE id = $3`, [allowance, interest, userId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/bank/payday', async (req, res) => { try { await client.query('BEGIN'); const kids = (await client.query("SELECT * FROM users WHERE role = 'child'")).rows; const rep = []; for(const k of kids) { if(k.weekly_allowance>0) { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [k.weekly_allowance, k.id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'דמי כיס', 'income', 'income')`, [k.id, k.weekly_allowance]); rep.push(`${k.name}: +${k.weekly_allowance}`); } } await client.query('COMMIT'); res.json({ success: true, report: rep }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/goals', async (req, res) => { const { userId, title, targetAmount } = req.body; try { await client.query(`INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3)`, [userId, title, targetAmount]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/goals/deposit', async (req, res) => { const { goalId, amount, userId } = req.body; try { await client.query('BEGIN'); const u = await client.query('SELECT balance FROM users WHERE id=$1', [userId]); if(u.rows[0].balance < amount) { await client.query('ROLLBACK'); return res.json({success:false}); } await client.query('UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2', [amount, goalId]); await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'הפקדה לחיסכון', 'savings', 'expense')`, [userId, amount]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/tasks', async (req, res) => { const { title, reward, assignedTo } = req.body; try { await client.query(`INSERT INTO tasks (title, reward, status, assigned_to) VALUES ($1, $2, 'pending', $3)`, [title, reward, assignedTo]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/tasks/update', async (req, res) => { const { taskId, status } = req.body; try { await client.query('BEGIN'); if(status==='approved') { const t = (await client.query('SELECT * FROM tasks WHERE id=$1',[taskId])).rows[0]; if(t && t.status!=='approved') { await client.query(`UPDATE users SET balance=balance+$1, xp=xp+5 WHERE id=$2`,[t.reward, t.assigned_to]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'tasks', 'income')`,[t.assigned_to, t.reward, `בוצע: ${t.title}`]); } } await client.query('UPDATE tasks SET status=$1 WHERE id=$2', [status, taskId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/transaction', async (req, res) => { const { userId, amount, description, category, type } = req.body; try { const factor = type==='income'?1:-1; await client.query('BEGIN'); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, amount, description, category, type]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amount*factor, userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/loans/request', async (req, res) => { const { userId, amount, reason } = req.body; try { await client.query(`INSERT INTO loans (user_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $2, $3, 'pending')`, [userId, amount, reason]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/loans/handle', async (req, res) => { const { loanId, status, interestRate } = req.body; try { await client.query('BEGIN'); if(status==='active') { const l = (await client.query('SELECT * FROM loans WHERE id=$1',[loanId])).rows[0]; const total = parseFloat(l.original_amount)*(1+(parseFloat(interestRate)||0)/100); await client.query(`UPDATE loans SET status='active', interest_rate=$1, remaining_amount=$2 WHERE id=$3`, [interestRate, total, loanId]); await client.query(`UPDATE users SET balance=balance+$1 WHERE id=$2`, [l.original_amount, l.user_id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'loans', 'income')`, [l.user_id, l.original_amount, `הלוואה: ${l.reason}`]); } else { await client.query(`UPDATE loans SET status='rejected' WHERE id=$1`, [loanId]); } await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/loans/repay', async (req, res) => { const { loanId, amount, userId } = req.body; try { await client.query('BEGIN'); const u = await client.query('SELECT balance FROM users WHERE id=$1', [userId]); if(u.rows[0].balance < amount) { await client.query('ROLLBACK'); return res.json({success:false}); } await client.query(`UPDATE loans SET remaining_amount = remaining_amount - $1 WHERE id = $2`, [amount, loanId]); await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'החזר הלוואה', 'loans', 'expense')`, [userId, amount]); const l = await client.query('SELECT remaining_amount FROM loans WHERE id=$1', [loanId]); if(l.rows[0].remaining_amount<=0) await client.query(`UPDATE loans SET status='paid' WHERE id=$1`,[loanId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(port, () => { console.log(`Server running on port ${port}`); });
