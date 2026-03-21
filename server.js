const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(express.static('public'));

// --- AI Setup ---
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Database Setup ---
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
        // Table creation/updates
        await client.query(`
            CREATE TABLE IF NOT EXISTS family_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                group_code VARCHAR(20) UNIQUE,
                type VARCHAR(20) DEFAULT 'FAMILY',
                ai_tokens INT DEFAULT 10,
                is_premium BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                nickname VARCHAR(50),
                password VARCHAR(100),
                role VARCHAR(20),
                birth_year INT,
                balance DECIMAL DEFAULT 0,
                allowance_amount DECIMAL DEFAULT 0,
                interest_rate DECIMAL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL,
                description TEXT,
                category VARCHAR(50),
                type VARCHAR(20),
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_recurring BOOLEAN DEFAULT FALSE,
                end_month VARCHAR(10)
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                title VARCHAR(200),
                reward DECIMAL,
                assigned_to INT REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deadline TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS shopping_list (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                item_name VARCHAR(100),
                quantity DECIMAL DEFAULT 1,
                unit VARCHAR(20) DEFAULT 'יח''',
                estimated_price DECIMAL DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                user_id INT REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS pantry (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                item_name VARCHAR(100),
                quantity DECIMAL DEFAULT 0,
                unit VARCHAR(20) DEFAULT 'יח''',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS time_clock (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                punch_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                punch_out TIMESTAMP,
                total_minutes INT
            );
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL,
                reason TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS budget_allocations (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                category VARCHAR(50),
                limit_amount DECIMAL,
                target_user_id VARCHAR(20) DEFAULT 'all'
            );
            CREATE TABLE IF NOT EXISTS quiz_assignments (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                bundle_id INT,
                status VARCHAR(20) DEFAULT 'assigned',
                score INT,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch(e) {
        console.error('DB Init Error:', e);
    } finally {
        client.release();
    }
}).catch(err => console.error('DB Connection Error:', err));

// ==========================================
// Authentication & Users
// ==========================================

app.post('/api/groups', async (req, res) => {
    const { type, groupName, adminEmail, adminNickname, birthYear, password } = req.body;
    try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const gRes = await pool.query(
            'INSERT INTO family_groups (name, group_code, type) VALUES ($1, $2, $3) RETURNING *',
            [groupName, code, type || 'FAMILY']
        );
        const group = gRes.rows[0];
        const uRes = await pool.query(
            'INSERT INTO users (group_id, nickname, password, role, birth_year) VALUES ($1, $2, $3, $4, $5) RETURNING id, nickname, role, balance',
            [group.id, adminNickname, password, 'ADMIN', birthYear]
        );
        res.json({ success: true, group, user: uRes.rows[0] });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    const { groupCode, nickname, password } = req.body;
    try {
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [groupCode]);
        if (gRes.rows.length === 0) return res.status(404).json({ success: false, error: 'קוד סביבה לא נמצא' });
        const group = gRes.rows[0];
        
        const uRes = await pool.query('SELECT id, nickname, role, balance, birth_year FROM users WHERE group_id = $1 AND nickname = $2 AND password = $3', [group.id, nickname, password]);
        if (uRes.rows.length === 0) return res.status(401).json({ success: false, error: 'שם משתמש או סיסמה שגויים' });
        
        res.json({ success: true, group, user: uRes.rows[0] });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/group/members', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT id, nickname, role, balance, allowance_amount, interest_rate, birth_year FROM users WHERE group_id = $1 ORDER BY role, nickname', [groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/join', async (req, res) => {
    // הפשטנו לטובת דוגמה - רושם משתמש ישירות
    const { groupCode, role, nickname, birthYear, password } = req.body;
    try {
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode]);
        if(gRes.rows.length === 0) return res.status(404).json({ success: false, error: 'קוד סביבה לא קיים' });
        await pool.query('INSERT INTO users (group_id, nickname, password, role, birth_year) VALUES ($1, $2, $3, $4, $5)', [gRes.rows[0].id, nickname, password, role || 'MEMBER', birthYear]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ==========================================
// Timeclock (Business B2B)
// ==========================================

app.get('/api/timeclock', async (req, res) => {
    const { groupId, userId } = req.query;
    try {
        let query = 'SELECT t.*, u.nickname FROM time_clock t JOIN users u ON t.user_id = u.id WHERE t.group_id = $1';
        let params = [groupId];
        if (userId && userId !== 'all') {
            query += ' AND t.user_id = $2'; params.push(userId);
        }
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
            await pool.query(`
                UPDATE time_clock 
                SET punch_out = CURRENT_TIMESTAMP, 
                    total_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - punch_in)) / 60 
                WHERE user_id = $1 AND punch_out IS NULL
            `, [userId]);
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Central Data Fetch (Dashboard)
// ==========================================

app.get('/api/data/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if(uRes.rows.length === 0) return res.status(404).json({error: 'User not found'});
        const user = uRes.rows[0];
        const groupId = user.group_id;
        
        const gRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [groupId]);
        const group = gRes.rows[0];

        const tasks = await pool.query('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1', [groupId]);
        const shopping = await pool.query('SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.user_id = u.id WHERE s.group_id = $1', [groupId]);
        const pantry = await pool.query('SELECT * FROM pantry WHERE group_id = $1', [groupId]);
        const goals = await pool.query('SELECT * FROM goals WHERE group_id = $1', [groupId]);
        const quizAssignments = await pool.query('SELECT qa.*, u.nickname as assignee_name FROM quiz_assignments qa LEFT JOIN users u ON qa.user_id = u.id WHERE qa.group_id = $1', [groupId]);

        res.json({
            user: { id: user.id, role: user.role, nickname: user.nickname, balance: user.balance },
            group: { id: group.id, type: group.type, ai_tokens: group.ai_tokens, is_premium: group.is_premium },
            tasks: tasks.rows,
            shopping_list: shopping.rows,
            pantry: pantry.rows,
            goals: goals.rows,
            quiz_bundles: quizAssignments.rows
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Transactions & Budget
// ==========================================

app.get('/api/transactions', async (req, res) => {
    const { groupId, userId, limit } = req.query;
    try {
        let query = 'SELECT t.*, u.nickname as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = $1';
        let params = [groupId];
        if (userId && userId !== 'all') { query += ' AND t.user_id = $2'; params.push(userId); }
        query += ' ORDER BY t.date DESC LIMIT $3'; params.push(limit || 100);
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transaction', async (req, res) => {
    const { userId, amount, description, category, type, date, isRecurring, endMonth } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const groupId = uRes.rows[0].group_id;
        await pool.query(
            'INSERT INTO transactions (group_id, user_id, amount, description, category, type, date, is_recurring, end_month) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [groupId, userId, amount, description, category, type, date, isRecurring, endMonth]
        );
        // Update balance logic here if needed
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    const { groupId, category, limit, targetUserId } = req.body;
    try {
        const exist = await pool.query('SELECT id FROM budget_allocations WHERE group_id = $1 AND category = $2 AND target_user_id = $3', [groupId, category, targetUserId || 'all']);
        if (exist.rows.length > 0) {
            await pool.query('UPDATE budget_allocations SET limit_amount = $1 WHERE id = $2', [limit, exist.rows[0].id]);
        } else {
            await pool.query('INSERT INTO budget_allocations (group_id, category, limit_amount, target_user_id) VALUES ($1, $2, $3, $4)', [groupId, category, limit, targetUserId || 'all']);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Tasks & Shopping
// ==========================================

app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo, status } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [assignedTo]);
        const groupId = uRes.rows[0].group_id;
        await pool.query(
            'INSERT INTO tasks (group_id, title, reward, assigned_to, status) VALUES ($1, $2, $3, $4, $5)',
            [groupId, title, reward, assignedTo, status || 'pending']
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
    const { taskId, status, finalReward } = req.body;
    try {
        await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);
        if (status === 'approved' && finalReward > 0) {
            // Give reward logic
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
        await pool.query(
            'INSERT INTO shopping_list (group_id, item_name, quantity, unit, estimated_price, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [uRes.rows[0].group_id, itemName, quantity, unit, estimatedPrice || 0, status || 'pending', userId]
        );
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
    try { await pool.query('DELETE FROM shopping_list WHERE id = $1', [req.params.id]); res.json({success: true}); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Pantry (Inventory)
// ==========================================

app.post('/api/pantry/add', async (req, res) => {
    const { groupId, itemName, quantity, unit } = req.body;
    try {
        const exist = await pool.query('SELECT id, quantity FROM pantry WHERE group_id = $1 AND item_name = $2', [groupId, itemName]);
        if (exist.rows.length > 0) {
            await pool.query('UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [quantity, exist.rows[0].id]);
        } else {
            await pool.query('INSERT INTO pantry (group_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4)', [groupId, itemName, quantity, unit]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pantry/use', async (req, res) => {
    const { groupId, itemName, usedQuantity } = req.body;
    try {
        const exist = await pool.query('SELECT id, quantity FROM pantry WHERE group_id=$1 AND item_name=$2', [groupId, itemName]);
        if (exist.rows.length > 0) {
            const newQty = parseFloat(exist.rows[0].quantity) - parseFloat(usedQuantity);
            if (newQty <= 0) await pool.query('DELETE FROM pantry WHERE id=$1', [exist.rows[0].id]);
            else await pool.query('UPDATE pantry SET quantity = $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [newQty, exist.rows[0].id]);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'המוצר לא נמצא במלאי' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pantry/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM pantry WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// AI Routes (Gemini Integration)
// ==========================================

// פונקציית עזר לחיוב טוקנים של AI
async function decrementAITokens(groupId) {
    const gRes = await pool.query('SELECT ai_tokens, is_premium FROM family_groups WHERE id = $1', [groupId]);
    if (!gRes.rows[0].is_premium) {
        if (gRes.rows[0].ai_tokens <= 0) throw new Error('BATTERY_EMPTY');
        await pool.query('UPDATE family_groups SET ai_tokens = ai_tokens - 1 WHERE id = $1', [groupId]);
    }
}

app.post('/api/shopping/scan-receipt', async (req, res) => {
    const { userId, imageBase64, mimeType, isBusiness } = req.body;
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const groupId = uRes.rows[0].group_id;
        
        await decrementAITokens(groupId);
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = isBusiness 
            ? "אתה מנהל רכש ארגוני. סרוק את חשבונית הספק הזו וחלץ ממנה את המוצרים שנרכשו, הכמויות והמחירים (התעלם ממע\"מ וסיכומים). החזר פלט כ-JSON בלבד במבנה: { \"items\": [ { \"name\": \"שם המוצר\", \"quantity\": כמות, \"price\": מחיר יחידה } ] }"
            : "אתה קופאית אוטומטית למשפחה. סרוק את קבלת הסופרמקרט וחלץ ממנה מוצרים שנקנו. החזר פלט כ-JSON בלבד במבנה: { \"items\": [ { \"name\": \"שם המוצר\", \"quantity\": כמות, \"price\": מחיר } ] }";
            
        const imageParts = [{ inlineData: { data: imageBase64, mimeType } }];
        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            let count = 0;
            // הוספת הפריטים חזרה למערכת הרכש/עגלה
            for (const item of data.items) {
                if (item.name && item.quantity) {
                    await pool.query(
                        'INSERT INTO shopping_list (group_id, item_name, quantity, estimated_price, user_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [groupId, item.name, item.quantity, item.price || 0, userId, isBusiness ? 'in_cart' : 'pending']
                    );
                    count++;
                }
            }
            res.json({ success: true, count });
        } else {
            res.json({ success: false, error: "לא נמצאו נתונים קריאים בתמונה" });
        }
    } catch(e) {
        if (e.message === 'BATTERY_EMPTY') res.json({ error: 'BATTERY_EMPTY' });
        else res.status(500).json({ error: e.message });
    }
});

app.post('/api/pantry/familai-insight', async (req, res) => {
    const { groupId, isBusiness } = req.body;
    try {
        await decrementAITokens(groupId);
        const pRes = await pool.query('SELECT item_name, quantity FROM pantry WHERE group_id = $1', [groupId]);
        const items = pRes.rows.map(r => `${r.item_name}: ${r.quantity}`).join(', ');
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = isBusiness
            ? `אתה מנהל רכש ויועץ תפעולי של ארגון. הנה המלאי כרגע בחברה: ${items}. כתוב פסקת תובנות ארגונית קצרה על מצב המלאי ומה כדאי להזמין בקרוב.`
            : `אתה יועצת ניהול בית. הנה המזווה המשפחתי: ${items}. כתבי פסקה קצרה, נעימה וחכמה על המלאי ומה חסר.`;
            
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text() });
    } catch(e) { 
        if (e.message === 'BATTERY_EMPTY') res.json({ error: 'BATTERY_EMPTY' });
        else res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/budget/familai-insight', async (req, res) => {
    const { groupId, isBusiness } = req.body;
    try {
        await decrementAITokens(groupId);
        const tRes = await pool.query('SELECT amount, category, type FROM transactions WHERE group_id = $1 ORDER BY date DESC LIMIT 30', [groupId]);
        const txs = tRes.rows.map(t => `${t.type === 'income' ? '+' : '-'}${t.amount} (${t.category})`).join(', ');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = isBusiness
            ? `אתה רואה חשבון ויועץ ארגוני. אלה הפעולות האחרונות בעסק: ${txs}. כתוב פסקת ניתוח קצרה למנכ"ל על קצב שריפת המזומנים (Burn Rate) ותובנות על הוצאות המחלקות.`
            : `אתה יועץ כלכלת משפחה חכם. אלה ההוצאות וההכנסות האחרונות: ${txs}. תן טיפ חיסכון מותאם אישית בשפה קלילה ומעודדת למשפחה.`;
            
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text() });
    } catch(e) {
        if (e.message === 'BATTERY_EMPTY') res.json({ error: 'BATTERY_EMPTY' });
        else res.status(500).json({ error: e.message });
    }
});

// Fallback לחזית
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
