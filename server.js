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
const calculateAge = (birthYear) => new Date().getFullYear() - birthYear;

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
        if (ageGroup === '6-8') {
            const n1 = Math.floor(Math.random() * 10) + 1; const n2 = Math.floor(Math.random() * 10) + 1;
            q = `${n1} + ${n2} = ?`; a = n1 + n2;
        } else if (ageGroup === '8-10') {
            const n1 = Math.floor(Math.random() * 20) + 5; const n2 = Math.floor(Math.random() * 15) + 5;
            q = `${n1} x ${n2} = ?`; a = n1 * n2;
        } else if (ageGroup === '10-13') {
            const n1 = Math.floor(Math.random() * 50) + 10; const n2 = Math.floor(Math.random() * 10) + 2;
            const op = Math.random() > 0.5 ? '+' : '-';
            q = `${n1} x ${n2} ${op} 7 = ?`; a = op==='+' ? (n1*n2)+7 : (n1*n2)-7;
        } else {
            const n1 = Math.floor(Math.random() * 20) + 2;
            q = `${n1} בריבוע פחות 5 = ?`; a = (n1 * n1) - 5;
        }
        const opts = [a, a+Math.floor(Math.random()*5)+1, a-Math.floor(Math.random()*5)-1, a+10].sort(() => Math.random() - 0.5);
        questions.push({ q, options: opts.map(String), correct: opts.indexOf(a) });
    }
    return questions;
};

const generateEnglish = (ageGroup) => {
    const questions = [];
    const vocab = {
        '6-8': [['Dog', 'כלב'], ['Cat', 'חתול'], ['Red', 'אדום'], ['Blue', 'כחול'], ['Apple', 'תפוח'], ['Sun', 'שמש']],
        '8-10': [['House', 'בית'], ['School', 'בית ספר'], ['Friend', 'חבר'], ['Happy', 'שמח'], ['Water', 'מים'], ['Chair', 'כיסא']],
        '10-13': [['Tomorrow', 'מחר'], ['Because', 'בגלל'], ['Always', 'תמיד'], ['Sometimes', 'לפעמים'], ['Question', 'שאלה']],
        '13-15': [['Environment', 'סביבה'], ['Development', 'התפתחות'], ['Responsibility', 'אחריות'], ['Government', 'ממשלה']],
        '15-18': [['Investment', 'השקעה'], ['Economy', 'כלכלה'], ['Opportunity', 'הזדמנות'], ['Challenge', 'אתגר']]
    };
    const pool = vocab[ageGroup] || vocab['15-18']; 
    for (let i = 0; i < 15; i++) {
        const pair = pool[Math.floor(Math.random() * pool.length)];
        const isEngToHeb = Math.random() > 0.5;
        const q = isEngToHeb ? `מה הפירוש של "${pair[0]}"?` : `איך אומרים "${pair[1]}" באנגלית?`;
        const correct = isEngToHeb ? pair[1] : pair[0];
        const wrong = [];
        while(wrong.length < 3) {
            const randomPair = pool[Math.floor(Math.random() * pool.length)];
            const wrongAns = isEngToHeb ? randomPair[1] : randomPair[0];
            if(wrongAns !== correct && !wrong.includes(wrongAns)) wrong.push(wrongAns);
        }
        const opts = [correct, ...wrong].sort(() => Math.random() - 0.5);
        questions.push({ q, options: opts, correct: opts.indexOf(correct) });
    }
    return questions;
};

const getTextContent = (type, age, variant) => {
    if (type === 'reading') {
        const topics = ['החלל', 'הים', 'היער', 'בית הספר', 'המשפחה'];
        const topic = topics[variant % topics.length];
        return {
            title: `הבנת הנקרא: ${topic} (מספר ${variant})`,
            text: `זהו סיפור על ${topic}. ${topic} הוא מקום מאוד מעניין. הרבה אנשים אוהבים את ${topic}. בסיפור שלנו, דני הלך ל${topic} וראה שם דברים נפלאים. חשוב לשמור על ${topic} כדי שכולם יוכלו ליהנות ממנו.`,
            questions: [
                {q: `על מה הסיפור?`, options: [topic, 'כדורגל', 'פיצה', 'שינה'], correct: 0},
                {q: `מי הלך ל${topic}?`, options: ['יוסי', 'דני', 'אמא', 'המורה'], correct: 1},
                {q: `האם ${topic} מעניין?`, options: ['כן', 'לא', 'אולי', 'לא יודע'], correct: 0},
                {q: `מה דני ראה?`, options: ['כלום', 'דברים נפלאים', 'חושך', 'טלוויזיה'], correct: 1},
                {q: `למה חשוב לשמור על ${topic}?`, options: ['כדי ליהנות ממנו', 'כי זה יקר', 'לא חשוב', 'כדי ללכת הביתה'], correct: 0}
            ]
        };
    } else { 
        const concepts = ['חיסכון', 'ריבית', 'תקציב', 'מניות', 'הלוואות'];
        const concept = concepts[variant % concepts.length];
        return {
            title: `מושגים בכסף: ${concept} (חלק ${variant})`,
            text: `${concept} הוא חלק חשוב מהחיים הפיננסיים. כאשר אנו משתמשים ב${concept}, אנחנו צריכים להיות חכמים. ${concept} יכול לעזור לנו להשיג מטרות. הבנק בדרך כלל קשור ל${concept}. אם נבין את ה${concept}, יהיה לנו יותר כסף בעתיד.`,
            questions: [
                {q: `על איזה מושג מדובר?`, options: [concept, 'ספורט', 'בישול', 'מוזיקה'], correct: 0},
                {q: `האם ${concept} חשוב?`, options: ['כן מאוד', 'לא בכלל', 'רק למבוגרים', 'רק לילדים'], correct: 0},
                {q: `מה קורה אם מבינים את ה${concept}?`, options: ['מפסידים', 'יש יותר כסף בעתיד', 'נהיים עייפים', 'כלום'], correct: 1},
                {q: `מי קשור ל${concept}?`, options: ['הבנק', 'המכולת', 'הפארק', 'הים'], correct: 0},
                {q: `מה צריך להיות כשמשתמשים ב${concept}?`, options: ['מהירים', 'חכמים', 'גבוהים', 'מצחיקים'], correct: 1}
            ]
        };
    }
};

const seedQuizzes = async () => {
    try {
        console.log('🔄 Checking Content Pool...');
        const check = await client.query('SELECT count(*) FROM quiz_bundles');
        if (parseInt(check.rows[0].count) > 400) return; 

        console.log('🚀 Generating Massive Content (20 items per category per age)...');
        await client.query('TRUNCATE TABLE quiz_bundles CASCADE');

        const ages = ['6-8', '8-10', '10-13', '13-15', '15-18', '18+'];
        const categories = ['math', 'english', 'reading', 'financial'];

        for (const age of ages) {
            for (const cat of categories) {
                for (let i = 1; i <= 20; i++) {
                    let title, questions, textContent, threshold, reward;
                    if (cat === 'math') {
                        title = `חשבון (${age}) - אתגר ${i}`;
                        questions = JSON.stringify(generateMath(age));
                        threshold = 85; reward = 0.5; textContent = null;
                    } else if (cat === 'english') {
                        title = `אנגלית (${age}) - מילים ${i}`;
                        questions = JSON.stringify(generateEnglish(age));
                        threshold = 85; reward = 0.5; textContent = null;
                    } else { 
                        const content = getTextContent(cat, age, i);
                        title = content.title;
                        questions = JSON.stringify(content.questions);
                        textContent = content.text;
                        threshold = 95; reward = 1.0;
                    }
                    await client.query(`INSERT INTO quiz_bundles (title, type, age_group, reward, threshold, text_content, questions, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SYSTEM')`, [title, cat, age, reward, threshold, textContent, questions]);
                }
            }
        }
        console.log('✅ Mega-Seeding Complete!');
    } catch(e) { console.error('❌ Seed Error:', e); }
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
    res.send('<h1>Oneflow Life System Ready 🚀</h1><a href="/">Go Home</a>');
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

const initBudgets = async (groupId, userId = null) => {
  const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
  for (const c of cats) {
    const check = await client.query(`SELECT id FROM budgets WHERE group_id=$1 AND category=$2 AND (user_id=$3 OR ($3::int IS NULL AND user_id IS NULL))`, [groupId, c, userId]);
    if (check.rows.length === 0) { await client.query(`INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1, $2, $3, 0)`, [groupId, userId, c]); }
  }
};

// --- AUTH ---
app.post('/api/groups', async (req, res) => {
  let { groupName, adminEmail, type, adminNickname, password, birthYear } = req.body;
  if(adminEmail) adminEmail = adminEmail.trim().toLowerCase();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Email exists' }); }
    const g = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id', [groupName, adminEmail, type]);
    const u = await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING *`, [g.rows[0].id, adminNickname, password, parseInt(birthYear)||0]);
    await initBudgets(g.rows[0].id, null);
    await client.query('COMMIT');
    res.json({ success: true, user: u.rows[0], group: { id: g.rows[0].id, name: groupName, type, adminEmail } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/join', async (req, res) => {
  let { groupEmail, nickname, password, birthYear } = req.body;
  try {
    const g = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname.trim()]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Nickname taken' });
    await client.query(`INSERT INTO users (group_id, nickname, password, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, [g.rows[0].id, nickname, password, parseInt(birthYear)||0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  let { groupEmail, nickname, password } = req.body;
  try {
    const g = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(401).json({ error: 'Group not found' });
    const u = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname.trim()]);
    if (u.rows.length === 0 || u.rows[0].password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    if (u.rows[0].status !== 'ACTIVE') return res.status(403).json({ error: 'Account pending' });
    res.json({ success: true, user: u.rows[0], group: g.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => { try { const r = await client.query('SELECT * FROM users WHERE id=$1', [req.params.id]); res.json(r.rows[0]); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/admin/pending-users', async (req, res) => { try { const r = await client.query("SELECT id, nickname, birth_year FROM users WHERE group_id = $1 AND status = 'PENDING'", [req.query.groupId]); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); } });
app.post('/api/admin/approve-user', async (req, res) => { try { await client.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [req.body.userId]); const u = await client.query("SELECT group_id FROM users WHERE id=$1", [req.body.userId]); await initBudgets(u.rows[0].group_id, req.body.userId); res.json({success:true}); } catch (e) { res.status(500).json({error:e.message}); } });
app.get('/api/group/members', async (req, res) => { const { groupId, requesterId } = req.query; try { const u = await client.query('SELECT role FROM users WHERE id = $1', [requesterId]); const isAdmin = u.rows.length > 0 && u.rows[0].role === 'ADMIN'; const r = await client.query("SELECT id, nickname, role, balance, birth_year, allowance_amount, interest_rate FROM users WHERE group_id = $1 AND status = 'ACTIVE' ORDER BY role, nickname", [groupId]); const members = r.rows.map(m => ({ ...m, balance: (isAdmin || m.id == requesterId) ? m.balance : null, allowance_amount: (isAdmin || m.id == requesterId) ? m.allowance_amount : null, interest_rate: (isAdmin || m.id == requesterId) ? m.interest_rate : null })); res.json(members); } catch (e) { res.status(500).json({error:e.message}); } });

// --- SHOPPING ---
app.post('/api/shopping/add', async (req, res) => { try { const uRes = await client.query('SELECT group_id, role FROM users WHERE id=$1', [req.body.userId]); const user = uRes.rows[0]; const status = user.role === 'ADMIN' ? 'pending' : 'requested'; const r = await client.query(`INSERT INTO shopping_list (item_name, quantity, estimated_price, requested_by, group_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [req.body.itemName, req.body.quantity, req.body.estimatedPrice||0, req.body.userId, user.group_id, status]); let alert = null; if(req.body.estimatedPrice > 0) { const h = await client.query(`SELECT price, store_name, date FROM product_prices WHERE LOWER(TRIM(item_name))=LOWER(TRIM($1)) AND price<$2 ORDER BY price ASC LIMIT 1`, [req.body.itemName, parseFloat(req.body.estimatedPrice)]); if(h.rows.length) { const d = new Date(h.rows[0].date).toLocaleDateString('he-IL'); alert = { msg: `נמצא זול יותר: ₪${h.rows[0].price} ב-${h.rows[0].store_name} (${d})`, price: h.rows[0].price }; } } res.json({ success: true, alert, id: r.rows[0].id, status }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/shopping/delete/:id', async (req, res) => { try { await client.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/update', async (req, res) => { try { if(req.body.status) await client.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [req.body.status, req.body.itemId]); if(req.body.quantity) await client.query('UPDATE shopping_list SET quantity=$1 WHERE id=$2', [req.body.quantity, req.body.itemId]); let alert = null; if(req.body.estimatedPrice !== undefined) { await client.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [req.body.estimatedPrice, req.body.itemId]); const i = await client.query('SELECT item_name FROM shopping_list WHERE id=$1', [req.body.itemId]); if(i.rows.length && req.body.estimatedPrice > 0) { const h = await client.query(`SELECT price, store_name, date FROM product_prices WHERE LOWER(TRIM(item_name))=LOWER(TRIM($1)) AND price<$2 ORDER BY price ASC LIMIT 1`, [i.rows[0].item_name, req.body.estimatedPrice]); if(h.rows.length) { const d = new Date(h.rows[0].date).toLocaleDateString('he-IL'); alert = { msg: `נמצא זול יותר: ₪${h.rows[0].price} ב-${h.rows[0].store_name} (${d})`, price: h.rows[0].price }; } } } res.json({ success: true, alert }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/checkout', async (req, res) => { try { await client.query('BEGIN'); const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]); const trip = await client.query(`INSERT INTO shopping_trips (group_id, user_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [u.rows[0].group_id, req.body.userId, req.body.storeName, req.body.branchName, req.body.totalAmount]); for(const i of req.body.boughtItems) { await client.query("UPDATE shopping_list SET status='bought' WHERE id=$1", [i.id]); await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [trip.rows[0].id, i.name, i.quantity, i.price]); if(i.price > 0) await client.query(`INSERT INTO product_prices (group_id, item_name, store_name, price) VALUES ($1, $2, $3, $4)`, [u.rows[0].group_id, i.name, req.body.storeName, i.price]); } for(const i of req.body.missingItems) await client.query("UPDATE shopping_list SET status='pending' WHERE id=$1", [i.id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'groceries', 'expense', TRUE)`, [req.body.userId, req.body.totalAmount, `קניות: ${req.body.storeName}`]); await client.query(`UPDATE users SET balance = balance - $1 WHERE id=$2`, [req.body.totalAmount, req.body.userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.get('/api/shopping/history', async (req, res) => { try { const trips = await client.query(`SELECT st.*, u.nickname FROM shopping_trips st JOIN users u ON st.user_id=u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC LIMIT 20`, [req.query.groupId]); const data = []; for(const t of trips.rows) { const items = await client.query(`SELECT * FROM shopping_trip_items WHERE trip_id=$1`, [t.id]); data.push({ ...t, items: items.rows }); } res.json(data); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/shopping/copy', async (req, res) => { try { const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]); const items = await client.query('SELECT item_name, quantity, price_per_unit FROM shopping_trip_items WHERE trip_id=$1', [req.body.tripId]); for(const i of items.rows) await client.query(`INSERT INTO shopping_list (item_name, quantity, estimated_price, requested_by, group_id, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [i.item_name, i.quantity, i.price_per_unit, req.body.userId, u.rows[0].group_id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// --- TRANSACTIONS & DATA ---
app.get('/api/transactions', async (req, res) => {
    // FIX: Show All for Admin or filtered, Show Only Self for Child
    try {
        const { groupId, userId, targetUserId } = req.query;
        let query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE u.group_id=$1`;
        const params = [groupId];
        
        // If specific target user is requested (for filtering)
        if (targetUserId && targetUserId !== 'all') {
            query += ` AND t.user_id = $2`;
            params.push(targetUserId);
        } else if (userId) {
            // Check role
            const u = await client.query('SELECT role FROM users WHERE id=$1', [userId]);
            if (u.rows[0] && u.rows[0].role !== 'ADMIN') {
                 // If not admin, FORCE filter by their own ID
                 query += ` AND t.user_id = $${params.length + 1}`;
                 params.push(userId);
            }
        }
        
        query += ` ORDER BY t.date DESC LIMIT 50`;
        const r = await client.query(query, params);
        res.json(r.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/data/:userId', async (req, res) => {
    try {
        const user = (await client.query('SELECT * FROM users WHERE id=$1', [req.params.userId])).rows[0];
        if (!user) return res.status(404).json({error:'User not found'});
        const gid = user.group_id;
        const [tasks, shop, loans, goals, myAssignments] = await Promise.all([
            client.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id=$1 ORDER BY t.created_at DESC`, [gid]),
            client.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.group_id=$1 AND s.status != 'bought' ORDER BY s.status DESC, s.created_at DESC`, [gid]),
            client.query(`SELECT * FROM loans WHERE group_id=$1`, [gid]),
            client.query(`SELECT g.*, u.nickname as owner_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.group_id=$1`, [gid]),
            client.query(`SELECT ua.*, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content, qb.questions FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id WHERE ua.user_id=$1 AND ua.status='assigned'`, [user.id])
        ]);
        
        // Calculate weekly stats separately
        const trans = await client.query(`SELECT SUM(amount) as total FROM transactions WHERE user_id=$1 AND type='expense' AND date > NOW() - INTERVAL '7 days'`, [user.id]);
        
        // Return ALL bundles for Library View
        const allBundles = await client.query('SELECT id, title, type, age_group, reward, threshold, created_by FROM quiz_bundles ORDER BY age_group, type, title');

        res.json({
            user, tasks: tasks.rows, shopping_list: shop.rows, loans: loans.rows, goals: goals.rows,
            quiz_bundles: myAssignments.rows,
            all_bundles: allBundles.rows,
            weekly_stats: { spent: trans.rows[0].total || 0, limit: (parseFloat(user.balance) * 0.2) }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ACADEMY ENDPOINTS ---
app.get('/api/academy/bundle/:id', async (req, res) => {
    try {
        const r = await client.query('SELECT * FROM quiz_bundles WHERE id=$1', [req.params.id]);
        if(r.rows.length === 0) return res.status(404).json({error: 'Not found'});
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/academy/bundles', async (req, res) => { try { const r = await client.query('SELECT id, title, type, age_group, reward FROM quiz_bundles ORDER BY age_group, title'); res.json(r.rows); } catch (e) { res.status(500).json({error:e.message}); } });

app.post('/api/academy/create-bundle', async (req, res) => {
    try {
        const { title, type, ageGroup, reward, threshold, textContent, questions, creatorName } = req.body;
        await client.query(
            `INSERT INTO quiz_bundles (title, type, age_group, reward, threshold, text_content, questions, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [title, type, ageGroup, reward, threshold, textContent, JSON.stringify(questions), creatorName || 'ADMIN']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/assign', async (req, res) => {
    try {
        const { userId, bundleId, reward, days } = req.body;
        const deadline = days ? new Date(Date.now() + days * 86400000) : null;
        await client.query(`INSERT INTO user_assignments (user_id, bundle_id, status, custom_reward, deadline) VALUES ($1, $2, 'assigned', $3, $4)`, 
        [userId, bundleId, reward || null, deadline]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/request-challenge', async (req, res) => { 
    try { 
        const count = await client.query(`SELECT count(*) FROM user_assignments WHERE user_id=$1 AND created_at > CURRENT_DATE`, [req.body.userId]); 
        if(parseInt(count.rows[0].count) >= 3) return res.json({ success: false, error: 'הגעת למגבלה היומית (3 אתגרים)' }); 
        
        let bundleId = req.body.bundleId;

        if (!bundleId) {
            const user = (await client.query('SELECT birth_year FROM users WHERE id=$1', [req.body.userId])).rows[0]; 
            const age = calculateAge(user.birth_year); 
            const ageGroup = getAgeGroup(age); 
            const available = await client.query(`SELECT id FROM quiz_bundles WHERE age_group=$1 AND id NOT IN (SELECT bundle_id FROM user_assignments WHERE user_id=$2) ORDER BY RANDOM() LIMIT 1`, [ageGroup, req.body.userId]); 
            if (available.rows.length === 0) return res.json({ success: false, error: 'אין אתגרים אקראיים זמינים לגילך' }); 
            bundleId = available.rows[0].id;
        }

        const exists = await client.query('SELECT id FROM user_assignments WHERE user_id=$1 AND bundle_id=$2', [req.body.userId, bundleId]);
        if (exists.rows.length > 0) return res.json({ success: false, error: 'כבר ביצעת או שהוקצה לך מבחן זה' });

        await client.query(`INSERT INTO user_assignments (user_id, bundle_id, status) VALUES ($1, $2, 'assigned')`, [req.body.userId, bundleId]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/academy/submit', async (req, res) => { 
    try { 
        await client.query('BEGIN');
        const ua = (await client.query(`SELECT ua.*, qb.threshold, qb.reward as default_reward, qb.title FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id WHERE ua.user_id=$1 AND ua.bundle_id=$2 AND ua.status='assigned'`, [req.body.userId, req.body.bundleId])).rows[0];
        if(!ua) throw new Error('Assignment not found');

        if (ua.deadline && new Date() > new Date(ua.deadline)) {
            await client.query(`UPDATE user_assignments SET status='expired', date_completed=NOW() WHERE id=$1`, [ua.id]);
            await client.query('COMMIT');
            return res.json({ success: true, passed: false, expired: true });
        }

        const passed = req.body.score >= ua.threshold;
        const reward = passed ? (ua.custom_reward !== null ? parseFloat(ua.custom_reward) : parseFloat(ua.default_reward)) : 0;
        const status = passed ? 'completed' : 'failed'; 

        await client.query(`UPDATE user_assignments SET status=$1, score=$2, date_completed=NOW() WHERE id=$3`, [status, req.body.score, ua.id]);
        
        if(passed) { 
            await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [reward, req.body.userId]); 
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'salary', 'income', FALSE)`, [req.body.userId, reward, `בונוס אקדמיה: ${ua.title}`]); 
        } 
        
        if(!passed) { await client.query(`DELETE FROM user_assignments WHERE id=$1`, [ua.id]); } 
        await client.query('COMMIT'); 
        res.json({ success: true, passed, reward }); 
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } 
});

app.post('/api/tasks', async (req, res) => { try { const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.assignedTo]); await client.query(`INSERT INTO tasks (title, reward, assigned_to, group_id, status) VALUES ($1, $2, $3, $4, 'pending')`, [req.body.title, req.body.reward, req.body.assignedTo, u.rows[0].group_id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/tasks/update', async (req, res) => { try { await client.query('BEGIN'); let final = req.body.status; const t = (await client.query('SELECT * FROM tasks WHERE id=$1', [req.body.taskId])).rows[0]; if(req.body.status==='done' && (t.reward==0 || t.reward==null)) final='approved'; else if(req.body.status==='completed_self') final='approved'; await client.query('UPDATE tasks SET status=$1 WHERE id=$2', [final, req.body.taskId]); if(final==='approved' && t.reward>0 && t.status!=='approved') { await client.query(`UPDATE users SET balance=balance+$1 WHERE id=$2`, [t.reward, t.assigned_to]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'salary', 'income', FALSE)`, [t.assigned_to, t.reward, `בוצע: ${t.title}`]); } await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/transaction', async (req, res) => { try { await client.query('BEGIN'); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [req.body.userId, req.body.amount, req.body.description, req.body.category, req.body.type]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [req.body.type==='income'?req.body.amount:-req.body.amount, req.body.userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.get('/api/budget/filter', async (req, res) => { try { const budgets = await client.query(`SELECT * FROM budgets WHERE group_id=$1 AND ${req.query.targetUserId==='all' ? 'user_id IS NULL' : 'user_id='+req.query.targetUserId}`, [req.query.groupId]); const data = []; if(req.query.targetUserId === 'all') { const alloc = await client.query(`SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id=u.id WHERE u.group_id=$1 AND u.role!='ADMIN' AND t.type='income' AND t.category IN ('allowance','salary','bonus') AND date_trunc('month', t.date)=date_trunc('month', CURRENT_DATE)`, [req.query.groupId]); data.push({category: 'allocations', limit: 0, spent: alloc.rows[0].total||0}); } for(const b of budgets.rows) { const s = await client.query(`SELECT SUM(amount) as total FROM transactions t JOIN users u ON t.user_id=u.id WHERE u.group_id=$1 AND t.category=$2 AND t.type='expense' ${req.query.targetUserId!=='all'?'AND t.user_id='+req.query.targetUserId:''} AND date_trunc('month', t.date)=date_trunc('month', CURRENT_DATE)`, [req.query.groupId, b.category]); data.push({category: b.category, limit: b.limit_amount, spent: s.rows[0].total||0}); } res.json(data); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/budget/update', async (req, res) => { await client.query(`UPDATE budgets SET limit_amount=$1 WHERE group_id=$2 AND category=$3 AND ${req.body.targetUserId==='all'?'user_id IS NULL':'user_id='+req.body.targetUserId}`, [req.body.limit, req.body.groupId, req.body.category]); res.json({ success: true }); });
app.post('/api/admin/payday', async (req, res) => { try { await client.query('BEGIN'); const members = await client.query(`SELECT * FROM users WHERE group_id=$1 AND role='MEMBER' AND status='ACTIVE'`, [req.body.groupId]); for (const user of members.rows) { if (user.allowance_amount > 0) { await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'allowance', 'income', FALSE)`, [user.id, user.allowance_amount, 'דמי כיס שבועיים']); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [user.allowance_amount, user.id]); } } await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/goals', async (req, res) => { try { const u = await client.query('SELECT group_id FROM users WHERE id = $1', [req.body.userId]); await client.query(`INSERT INTO goals (user_id, group_id, title, target_amount, current_amount, status) VALUES ($1, $2, $3, $4, 0, 'active')`, [req.body.targetUserId || req.body.userId, u.rows[0].group_id, req.body.title, req.body.target]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/goals/deposit', async (req, res) => { try { await client.query('BEGIN'); await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [req.body.amount, req.body.userId]); await client.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [req.body.amount, req.body.goalId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'savings', 'transfer_out', FALSE)`, [req.body.userId, req.body.amount, 'הפקדה לחיסכון']); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });
app.post('/api/admin/update-settings', async (req, res) => { try { await client.query(`UPDATE users SET allowance_amount = $1, interest_rate = $2 WHERE id = $3`, [req.body.allowance, req.body.interest, req.body.userId]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/loans/request', async (req, res) => { try { const u = await client.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]); await client.query(`INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $3, $3, $4, 'pending')`, [req.body.userId, u.rows[0].group_id, req.body.amount, req.body.reason]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/loans/handle', async (req, res) => { try { await client.query('BEGIN'); const l = (await client.query('SELECT * FROM loans WHERE id=$1', [req.body.loanId])).rows[0]; if(req.body.status === 'active') { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [l.original_amount, l.user_id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, 'loans', 'income', FALSE)`, [l.user_id, l.original_amount, `הלוואה אושרה: ${l.reason}`]); } await client.query('UPDATE loans SET status = $1 WHERE id = $2', [req.body.status, req.body.loanId]); await client.query('COMMIT'); res.json({ success: true }); } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`Server running on port ${port}`));
