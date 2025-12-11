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
  .then(() => console.log('✅ Connected to DB'))
  .catch(err => console.error('Connection Error', err.stack));

// --- HELPERS ---
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

// --- CONTENT GENERATORS ---
const generateMath = (ageGroup) => {
    const questions = [];
    for (let i = 0; i < 15; i++) { 
        let q, a;
        if (ageGroup === '6-8') { const n1 = Math.floor(Math.random()*10)+1; const n2 = Math.floor(Math.random()*10)+1; q = `${n1} + ${n2} = ?`; a = n1+n2; } 
        else if (ageGroup === '8-10') { const n1 = Math.floor(Math.random()*20)+5; const n2 = Math.floor(Math.random()*15)+5; q = `${n1} x ${n2} = ?`; a = n1*n2; } 
        else if (ageGroup === '10-13') { const n1 = Math.floor(Math.random()*50)+10; const n2 = Math.floor(Math.random()*10)+2; const op = Math.random()>0.5?'+':'-'; q = `${n1} x ${n2} ${op} 7 = ?`; a = op==='+'?(n1*n2)+7:(n1*n2)-7; } 
        else { const n1 = Math.floor(Math.random()*20)+2; q = `${n1} בריבוע פחות 5 = ?`; a = (n1*n1)-5; }
        const opts = [a, a+Math.floor(Math.random()*5)+1, a-Math.floor(Math.random()*5)-1, a+10].sort(() => Math.random()-0.5);
        questions.push({ q, options: opts.map(String), correct: opts.indexOf(a) });
    }
    return questions;
};

const generateEnglish = (ageGroup) => {
    const questions = [];
    const vocab = { '6-8': [['Dog','כלב'],['Cat','חתול'],['Red','אדום']], '8-10': [['House','בית'],['School','בית ספר']], '10-13': [['Tomorrow','מחר'],['Because','בגלל']], '13-15': [['Environment','סביבה']], '15-18': [['Investment','השקעה']] };
    const pool = vocab[ageGroup] || [['Sun','שמש'],['Moon','ירח']]; 
    for (let i = 0; i < 15; i++) {
        const pair = pool[Math.floor(Math.random()*pool.length)];
        const isEng = Math.random()>0.5;
        const q = isEng ? `פירוש המילה "${pair[0]}"?` : `איך אומרים "${pair[1]}"?`;
        const correct = isEng ? pair[1] : pair[0];
        questions.push({ q, options: [correct, 'לא נכון', 'אולי', 'אחר'].sort(()=>Math.random()-0.5), correct: 0 }); 
    }
    return questions;
};

const getTextContent = (type, age, variant) => {
    return {
        title: type === 'reading' ? `הבנת הנקרא (${age}) - ${variant}` : `חינוך פיננסי (${age}) - ${variant}`,
        text: `טקסט דוגמה עבור ${type} לגיל ${age}. זהו טקסט ארוך שמסביר נושא מסוים...`,
        questions: Array(5).fill(0).map((_,i) => ({q: `שאלה מספר ${i+1}?`, options: ['תשובה נכונה', 'לא', 'אולי', 'טעות'], correct: 0}))
    };
};

const seedQuizzes = async () => {
    try {
        const check = await client.query('SELECT count(*) FROM quiz_bundles');
        if (parseInt(check.rows[0].count) > 100) return;
        await client.query('TRUNCATE TABLE quiz_bundles CASCADE');
        const ages = ['6-8', '8-10', '10-13', '13-15', '15-18', '18+'];
        const categories = ['math', 'english', 'reading', 'financial'];
        for (const age of ages) {
            for (const cat of categories) {
                for (let i = 1; i <= 20; i++) { 
                    let title, questions, textContent, threshold, reward;
                    if (cat === 'math') { title = `חשבון (${age}) - ${i}`; questions = JSON.stringify(generateMath(age)); threshold = 85; reward = 0.5; } 
                    else if (cat === 'english') { title = `אנגלית (${age}) - ${i}`; questions = JSON.stringify(generateEnglish(age)); threshold = 85; reward = 0.5; } 
                    else { const c = getTextContent(cat, age, i); title = c.title; questions = JSON.stringify(c.questions); textContent = c.text; threshold = 95; reward = 1.0; }
                    await client.query(`INSERT INTO quiz_bundles (title, type, age_group, reward, threshold, text_content, questions, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'SYSTEM')`, [title, cat, age, reward, threshold, textContent, questions]);
                }
            }
        }
        console.log('✅ Seeding Complete');
    } catch(e) { console.log('Seed Error (Ignored):', e.message); }
};

// --- SETUP ---
app.get('/setup-db', async (req, res) => {
    try {
        const tables = ['user_assignments', 'quiz_bundles', 'shopping_trip_items', 'shopping_trips', 'product_prices', 'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
        for (const t of tables) { try { await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`); } catch(e){} }

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
        await client.query(`CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, title VARCHAR(150), type VARCHAR(50), age_group VARCHAR(50), reward DECIMAL(10,2), threshold INTEGER, text_content TEXT, questions JSONB, created_by VARCHAR(50) DEFAULT 'SYSTEM', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await client.query(`CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, bundle_id INTEGER REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INTEGER, custom_reward DECIMAL(10,2), deadline TIMESTAMP, date_completed TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

        await seedQuizzes();
        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>Database Reset & Full Content Seeded!</p><a href="/">Go Home</a>');
    } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});


// --- UTILS ---
const initBudgets = async (groupId, userId = null) => {
    const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
    for (const c of cats) {
        try {
            let query = `SELECT id FROM budgets WHERE group_id=$1 AND category=$2`;
            let params = [groupId, c];
            
            if (userId) { 
                query += ` AND user_id=$3`; 
                params.push(userId); 
            } else { 
                query += ` AND user_id IS NULL`; 
            }
            
            const check = await client.query(query, params);
            if (check.rows.length === 0) {
                await client.query(`INSERT INTO budgets (group_id, category, limit_amount, user_id) VALUES ($1, $2, 0, $3)`, [groupId, c, userId]);
            }
        } catch(e) { console.error(`Budget init skipped for ${c}`); }
    }
};

// --- AUTH ---
app.post('/api/groups', async (req, res) => {
    try { 
        await client.query('BEGIN');
        const { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
        
        if (!groupName || !adminEmail || !adminNickname || !password) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'חסרים פרטים' });
        }

        const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail.toLowerCase()]);
        if (check.rows.length > 0) { 
            await client.query('ROLLBACK'); 
            return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' }); 
        }

        const g = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail.toLowerCase(), type]);
        const bYear = parseInt(birthYear) || 1980; // Default for admin
        
        const u = await client.query(
            `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, 
            [g.rows[0].id, adminNickname, password, bYear]
        );
        
        await initBudgets(g.rows[0].id, null); 
        await client.query('COMMIT');
        res.json({ success: true, user: u.rows[0], group: { id: g.rows[0].id, name: groupName } }); 
    } catch(e) { 
        await client.query('ROLLBACK'); 
        console.error("Create Group Error:", e);
        res.status(500).json({error: "שגיאה ביצירת משפחה: " + e.message}); 
    }
});

app.post('/api/join', async (req, res) => {
    try { 
        const { groupEmail, nickname, password, birthYear } = req.body;
        const g = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail.toLowerCase()]);
        if (!g.rows.length) return res.status(404).json({error: 'קבוצה לא נמצאה. בדוק את המייל.'});
        
        const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND nickname = $2', [g.rows[0].id, nickname]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'שם המשתמש תפוס בקבוצה זו' });

        const bYear = parseInt(birthYear) || 2015; // Default for child

        await client.query(
            `INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, 
            [g.rows[0].id, nickname, password, bYear]
        );
        res.json({ success: true }); 
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/login', async (req, res) => {
    try { 
        const { groupEmail, nickname, password } = req.body;
        const g = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail.toLowerCase()]);
        if (!g.rows.length) return res.status(401).json({ error: 'קבוצה לא נמצאה' });
        
        const u = await client.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2', [g.rows[0].id, nickname]);
        if (!u.rows.length || u.rows[0].password !== password) return res.status(401).json({ error: 'סיסמה שגויה או משתמש לא קיים' });
        
        if (u.rows[0].status !== 'ACTIVE') return res.status(403).json({ error: 'המשתמש ממתין לאישור מנהל' });
        
        res.json({ success: true, user: u.rows[0], group: g.rows[0] }); 
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- ADMIN & USERS ---
app.get('/api/users/:id', async (req, res) => { try { const r = await client.query('SELECT * FROM users WHERE id=$1', [req.params.id]); res.json(r.rows[0]); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/group/members', async (req, res) => { try { const r = await client.query("SELECT id, nickname, role, balance, birth_year, allowance_amount, interest_rate FROM users WHERE group_id = $1 AND status = 'ACTIVE' ORDER BY role, nickname", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); } }
