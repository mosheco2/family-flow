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

// --- 1. System Setup ---
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
    
    // Inject Content (Academia)
    const quizCount = await client.query('SELECT COUNT(*) FROM quizzes WHERE is_set = TRUE');
    if (parseInt(quizCount.rows[0].count) < 5) {
        const generateMathSet = (min, max, op, diff, count=10) => {
            const qs = [];
            for(let i=0; i<count; i++) {
                let a = Math.floor(Math.random() * diff) + 1;
                let b = Math.floor(Math.random() * diff) + 1;
                let qStr = "", ans = 0;
                if(op === '+') { qStr = `${a} + ${b} = ?`; ans = a+b; }
                else if(op === '-') { if(a<b) [a,b]=[b,a]; qStr = `${a} - ${b} = ?`; ans = a-b; }
                else if(op === '*') { a = Math.floor(Math.random()*12)+1; b = Math.floor(Math.random()*12)+1; qStr = `${a} x ${b} = ?`; ans = a*b; }
                let opts = [ans, ans+1, ans-1, ans+Math.floor(Math.random()*5)+2].filter(x=>x>=0);
                opts = [...new Set(opts)].sort(()=>Math.random()-0.5);
                while(opts.length < 4) opts.push(ans + opts.length + 1);
                qs.push({q: qStr, opts: opts, correct: opts.indexOf(ans)});
            }
            return { title: `מתמטיקה: ${op==='+'?'חיבור':(op==='-'?'חיסור':(op==='*'?'כפל':'חזקות'))} (גיל ${min}-${max})`, questions: qs, min, max, cat: 'math', rew: (max>12?15:5) };
        };
        const content = [
            generateMathSet(6, 8, '+', 10), 
            generateMathSet(8, 12, '*', 0),
            { title: "ניהול תקציב (18+)", min: 18, max: 99, cat: 'finance', rew: 50, questions: [{ q: "מהו הכלל המומלץ לחלוקת הכנסה?", opts: ["50/30/20", "100% חיסכון", "לבזבז הכל", "אין כלל"], correct: 0 }] }
        ];
        for (const c of content) {
            await client.query(`INSERT INTO quizzes (title, type, questions_json, reward, target_min_age, target_max_age, category, is_set) VALUES ($1, 'set', $2, $3, $4, $5, $6, TRUE)`, [c.title, JSON.stringify(c.questions), c.rew, c.min, c.max, c.cat]);
        }
    }
    res.json({ success: true, message: "System Setup Complete" });
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- 2. Admin: Wipe Data ---
app.post('/api/admin/reset-data', async (req, res) => {
    try {
        await client.query(`
            TRUNCATE TABLE 
            shopping_trip_items, shopping_trips, product_prices, 
            assignments, user_quiz_history, quizzes, activity_log, 
            budgets, loans, goals, shopping_list, tasks, transactions, users 
            RESTART IDENTITY CASCADE
        `);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 3. User Auth (Secure) ---

// Login by Name + PIN
app.post('/api/login', async (req, res) => { 
    const { name, pin } = req.body; 
    try { 
        // Case insensitive search for name
        const r = await client.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1) AND pin_code = $2', [name, pin]); 
        if (r.rows.length > 0) res.json({ success: true, user: r.rows[0] }); 
        else res.status(401).json({ success: false, message: "פרטים שגויים" }); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// Create User
app.post('/api/create-user', async (req, res) => { 
    const { name, pin, role, birthYear } = req.body; 
    try { 
        // Check if name exists
        const check = await client.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [name]);
        if(check.rows.length > 0) return res.status(400).json({error: "שם משתמש תפוס"});

        const currentYear = new Date().getFullYear();
        const age = currentYear - parseInt(birthYear);
        let ageGroup = 'adult';
        if (role === 'child') {
            if (age >= 18) ageGroup = 'young_adult';
            else if (age >= 14) ageGroup = 'teen_15_18';
            else if (age >= 10) ageGroup = 'child_10_15';
            else ageGroup = 'child_6_10';
        }

        await client.query(`INSERT INTO users (name, role, balance, pin_code, birth_year, age_group, weekly_allowance, interest_rate) VALUES ($1, $2, 0, $3, $4, $5, 0, 0)`, [name, role, pin, parseInt(birthYear), ageGroup]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// Fallback
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(port, () => { console.log(`Server running on port ${port}`); });
