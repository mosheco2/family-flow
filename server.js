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

// --- פונקציית עזר לתיעוד בפיד ---
async function logActivity(userId, action, icon = 'bell') {
    try {
        await client.query(`INSERT INTO activity_log (user_id, action, icon) VALUES ($1, $2, $3)`, [userId, action, icon]);
    } catch (e) { console.error('Activity Log Error:', e); }
}

// --- הקמת מסד הנתונים ---
app.get('/setup-db', async (req, res) => {
  try {
    // טבלאות בסיס
    await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL, balance DECIMAL(10, 2) DEFAULT 0, pin_code VARCHAR(10), age_group VARCHAR(20) DEFAULT 'adult', weekly_allowance DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, xp INTEGER DEFAULT 0);`);
    await client.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), amount DECIMAL(10, 2) NOT NULL, description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    await client.query(`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, reward DECIMAL(10, 2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id));`);
    await client.query(`CREATE TABLE IF NOT EXISTS shopping_list (id SERIAL PRIMARY KEY, item_name VARCHAR(255) NOT NULL, requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    await client.query(`CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(100) NOT NULL, target_amount DECIMAL(10, 2) NOT NULL, current_amount DECIMAL(10, 2) DEFAULT 0, icon VARCHAR(50) DEFAULT 'star', status VARCHAR(20) DEFAULT 'active', target_date TIMESTAMP);`);
    await client.query(`CREATE TABLE IF NOT EXISTS loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), original_amount DECIMAL(10, 2) NOT NULL, remaining_amount DECIMAL(10, 2) NOT NULL, reason VARCHAR(255), interest_rate DECIMAL(5, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    await client.query(`CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, category VARCHAR(50) NOT NULL UNIQUE, limit_amount DECIMAL(10, 2) NOT NULL);`);

    // --- חדש: טבלאות פיד ואקדמיה ---
    await client.query(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            action VARCHAR(255) NOT NULL,
            icon VARCHAR(50) DEFAULT 'bell',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id SERIAL PRIMARY KEY,
            question VARCHAR(255) NOT NULL,
            options JSONB NOT NULL, -- מערך של תשובות
            correct_index INTEGER NOT NULL,
            reward DECIMAL(10, 2) DEFAULT 5,
            explanation VARCHAR(500)
        );
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_quiz_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            quiz_id INTEGER REFERENCES quizzes(id),
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // יצירת תוכן ראשוני לאקדמיה (אם אין)
    const quizzesCheck = await client.query('SELECT * FROM quizzes');
    if (quizzesCheck.rows.length === 0) {
        await client.query(`
            INSERT INTO quizzes (question, options, correct_index, reward, explanation) VALUES 
            ('מה זו "ריבית"?', '["כסף שאני משלם סתם", "תשלום על השימוש בכסף לאורך זמן", "סוג של מס הכנסה", "הנחה בחנות"]', 1, 10, 'ריבית היא המחיר של הכסף. כשאתה חוסך, הבנק משלם לך על הזכות להשתמש בכסף שלך!'),
            ('מה עדיף לעשות עם דמי הכיס?', '["לבזבז הכל מיד", "לשמור מתחת למזרן", "לחלק: קצת לבזבוזים, קצת לחיסכון", "לתת הכל לחברים"]', 2, 10, 'הנוסחה המנצחת: תהנו מהכסף, אבל שימרו חלק לעתיד.'),
            ('איך נקרא מצב שבו ההוצאות גדולות מההכנסות?', '["רווח נקי", "איזון תקציבי", "גירעון (מינוס)", "השקעה נבונה"]', 2, 15, 'גירעון הוא מצב מסוכן שבו אנחנו מבזבזים כסף שאין לנו. זה מוביל לחובות.'),
            ('מה זה "תקציב"?', '["רשימת חלומות", "תוכנית לניהול הכסף", "שם של בנק", "דף עם מספרים"]', 1, 5, 'תקציב הוא כלי שעוזר לנו לתכנן לאן הכסף ילך לפני שאנחנו מוציאים אותו.')
        `);
    }

    // הורה דיפולטיבי
    const userCheck = await client.query('SELECT * FROM users');
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group) VALUES ('Admin Parent', 'parent', 0, '1234', 'adult')`);
    }

    res.send(`<h2 style="color: green;">System Updated! Academy & Feed modules installed. 🎓📢</h2>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- API Endpoints ---

// Data (הוספת פיד ואקדמיה)
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    
    // נתונים קיימים...
    let familyMembers = [];
    if (user.role === 'parent' || user.role === 'child') {
        familyMembers = (await client.query('SELECT id, name, balance, role, age_group, weekly_allowance, interest_rate, xp FROM users ORDER BY id')).rows;
    }
    
    // --- חדש: שליפת הפיד (20 אחרונים) ---
    const feedRes = await client.query(`
        SELECT a.*, u.name as user_name 
        FROM activity_log a 
        LEFT JOIN users u ON a.user_id = u.id 
        ORDER BY a.created_at DESC LIMIT 20
    `);

    // --- חדש: שליפת חידונים זמינים (שטרם נענו ע"י המשתמש) ---
    let quizzes = [];
    if (user.role === 'child') {
        const quizzesRes = await client.query(`
            SELECT q.* FROM quizzes q
            WHERE NOT EXISTS (
                SELECT 1 FROM user_quiz_history h 
                WHERE h.quiz_id = q.id AND h.user_id = $1
            )
        `, [userId]);
        quizzes = quizzesRes.rows;
    }

    // שאילתות קודמות (תנועות, משימות וכו')
    let transQuery = `SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`;
    if (user.role === 'child') transQuery += ` WHERE t.user_id = ${userId}`;
    transQuery += ` ORDER BY t.date DESC LIMIT 50`;
    const transRes = await client.query(transQuery);
    
    let tasksQuery = `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id `;
    if (user.role === 'child') tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`;
    else tasksQuery += ` WHERE t.status != 'approved'`;
    tasksQuery += ` ORDER BY t.id DESC`;
    const tasksRes = await client.query(tasksQuery);

    const shopRes = await client.query(`SELECT s.*, u.name as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.status != 'bought' ORDER BY s.id DESC`);
    const goalsRes = await client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [userId]);
    
    let loansQuery = `SELECT l.*, u.name as user_name FROM loans l LEFT JOIN users u ON l.user_id = u.id`;
    if (user.role === 'child') loansQuery += ` WHERE l.user_id = ${userId}`;
    else loansQuery += ` WHERE l.status != 'paid'`; 
    loansQuery += ` ORDER BY l.created_at DESC`;
    const loansRes = await client.query(loansQuery);

    // Leaderboard
    const lbQuery = await client.query(`
        SELECT u.name, u.role, 
               COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) - 
               COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as monthly_savings
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id 
        AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
        WHERE u.role = 'child'
        GROUP BY u.id
        ORDER BY monthly_savings DESC
    `);

    res.json({ 
        user, 
        transactions: transRes.rows, 
        family: familyMembers, 
        tasks: tasksRes.rows, 
        shopping_list: shopRes.rows, 
        goals: goalsRes.rows,
        loans: loansRes.rows,
        leaderboard: lbQuery.rows,
        feed: feedRes.rows, // הפיד
        quizzes: quizzes // החידונים
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API לאקדמיה ---
app.post('/api/academy/answer', async (req, res) => {
    const { userId, quizId, answerIndex } = req.body;
    try {
        await client.query('BEGIN');
        
        // בדיקת התשובה
        const quizRes = await client.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
        const quiz = quizRes.rows[0];
        
        if (answerIndex === quiz.correct_index) {
            const reward = parseFloat(quiz.reward);
            // 1. הוספת כסף
            await client.query('UPDATE users SET balance = balance + $1, xp = xp + 20 WHERE id = $2', [reward, userId]);
            // 2. רישום תנועה
            await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'education', 'income')`, [userId, reward, `בונוס ידע: ${quiz.question.substring(0, 15)}...`]);
            // 3. סימון שהחידון בוצע
            await client.query('INSERT INTO user_quiz_history (user_id, quiz_id) VALUES ($1, $2)', [userId, quizId]);
            // 4. לוג לפיד
            await logActivity(userId, `פתר חידון והרוויח ₪${reward}`, 'graduation-cap');
            
            await client.query('COMMIT');
            res.json({ success: true, correct: true, reward: reward, message: quiz.explanation });
        } else {
            await client.query('ROLLBACK');
            res.json({ success: true, correct: false, message: 'לא נורא, נסה שוב בפעם הבאה!' });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// --- עדכון פונקציות קיימות עם logActivity ---
// הוספתי logActivity לכל הפעולות החשובות

app.post('/api/create-user', async (req, res) => { const { name, pin, role, initialBalance, ageGroup } = req.body; try { await client.query(`INSERT INTO users (name, role, balance, pin_code, age_group, weekly_allowance, interest_rate) VALUES ($1, $2, $3, $4, $5, 0, 0)`, [name, role, parseFloat(initialBalance)||0, pin, ageGroup || 'adult']); await logActivity(null, `משתמש חדש הצטרף: ${name}`, 'user-plus'); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/bank/payday', async (req, res) => { const { userId } = req.body; try { const requesterRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]); if (requesterRes.rows.length === 0 || requesterRes.rows[0].role !== 'parent') { return res.status(403).json({ success: false }); } await client.query('BEGIN'); const children = (await client.query("SELECT * FROM users WHERE role = 'child'")).rows; let report = []; for (const child of children) { if (child.weekly_allowance > 0) { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [child.weekly_allowance, child.id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'דמי כיס', 'income', 'income')`, [child.id, child.weekly_allowance]); report.push(`${child.name}`); } } await logActivity(userId, 'הפעיל יום תשלום לכולם! 💸', 'money-bill-wave'); await client.query('COMMIT'); res.json({ success: true, report }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

app.post('/api/goals', async (req, res) => { const { userId, title, targetAmount, targetDate } = req.body; try { const target = parseFloat(targetAmount); if (isNaN(target) || target <= 0) return res.status(400).json({ error: "Invalid" }); await client.query(`INSERT INTO goals (user_id, title, target_amount, current_amount, target_date) VALUES ($1, $2, $3, 0, $4)`, [userId, title, target, targetDate || null]); await logActivity(userId, `יצר יעד חדש: ${title}`, 'bullseye'); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/goals/deposit', async (req, res) => { const { goalId, amount, userId } = req.body; try { await client.query('BEGIN'); const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]); if (parseFloat(userRes.rows[0].balance) < parseFloat(amount)) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'אין יתרה' }); } await client.query('UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2', [amount, goalId]); await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'הפקדה לחיסכון', 'savings', 'expense')`, [userId, amount]); await client.query('UPDATE users SET xp = xp + 10 WHERE id = $1', [userId]); await logActivity(userId, `הפקיד ₪${amount} לחיסכון`, 'piggy-bank'); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

app.post('/api/tasks/update', async (req, res) => { const { taskId, status } = req.body; try { await client.query('BEGIN'); if (status === 'approved') { const task = (await client.query('SELECT * FROM tasks WHERE id = $1', [taskId])).rows[0]; if (task && task.status !== 'approved') { await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [task.reward, task.assigned_to]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'tasks', 'income')`, [task.assigned_to, task.reward, `בוצע: ${task.title}`]); await logActivity(task.assigned_to, `הרוויח ₪${task.reward} על משימה: ${task.title}`, 'check-circle'); } } await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

app.post('/api/loans/handle', async (req, res) => { const { loanId, status, interestRate } = req.body; try { await client.query('BEGIN'); if (status === 'active') { const loan = (await client.query('SELECT * FROM loans WHERE id = $1', [loanId])).rows[0]; const total = parseFloat(loan.original_amount) * (1 + (parseFloat(interestRate)||0)/100); await client.query(`UPDATE loans SET status = 'active', interest_rate = $1, remaining_amount = $2 WHERE id = $3`, [interestRate, total, loanId]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [loan.original_amount, loan.user_id]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'loans', 'income')`, [loan.user_id, loan.original_amount, `קבלת הלוואה: ${loan.reason}`]); await logActivity(loan.user_id, `קיבל הלוואה על סך ₪${loan.original_amount}`, 'hand-holding-dollar'); } else { await client.query(`UPDATE loans SET status = 'rejected' WHERE id = $1`, [loanId]); } await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

// --- שאר ה-API (ללא שינוי) ---
app.get('/api/public-users', async (req, res) => { try { const result = await client.query('SELECT id, name, role, age_group FROM users ORDER BY role DESC, id ASC'); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/login', async (req, res) => { const { userId, pin } = req.body; try { if (!userId && pin) { const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]); if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] }); return res.status(401).json({ success: false, message: 'קוד שגוי' }); } const result = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]); if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] }); else res.status(401).json({ success: false, message: 'קוד שגוי' }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/bank/settings', async (req, res) => { const { userId, allowance, interest } = req.body; try { await client.query(`UPDATE users SET weekly_allowance = $1, interest_rate = $2 WHERE id = $3`, [allowance, interest, userId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/add', async (req, res) => { const { itemName, userId } = req.body; try { const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]); const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending'; await client.query(`INSERT INTO shopping_list (item_name, requested_by, status) VALUES ($1, $2, $3)`, [itemName, userId, status]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/update', async (req, res) => { const { itemId, status } = req.body; try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/shopping/checkout', async (req, res) => { const { totalAmount, userId } = req.body; try { await client.query('BEGIN'); await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'"); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'קניות בסופר', 'groceries', 'expense')`, [userId, parseFloat(totalAmount)]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.post('/api/tasks', async (req, res) => { const { title, reward, assignedTo } = req.body; try { await client.query(`INSERT INTO tasks (title, reward, status, assigned_to) VALUES ($1, $2, 'pending', $3)`, [title, reward, assignedTo]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/transaction', async (req, res) => { const { userId, amount, description, category, type, date } = req.body; try { const cleanAmount = parseFloat(amount); const factor = type === 'income' ? 1 : -1; const tDate = date ? new Date(date) : new Date(); await client.query('BEGIN'); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type, date) VALUES ($1, $2, $3, $4, $5, $6)`, [userId, cleanAmount, description, category, type, tDate]); await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [cleanAmount * factor, userId]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });
app.get('/api/budget/status', async (req, res) => { try { const budgets = (await client.query('SELECT * FROM budgets')).rows; const spending = (await client.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE type = 'expense' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE) GROUP BY category`)).rows; const result = budgets.map(b => { const s = spending.find(x => x.category === b.category); return { category: b.category, limit: parseFloat(b.limit_amount), spent: s ? parseFloat(s.spent) : 0 }; }); res.json(result); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/budget/set', async (req, res) => { const { category, limit } = req.body; try { await client.query(`INSERT INTO budgets (category, limit_amount) VALUES ($1, $2) ON CONFLICT (category) DO UPDATE SET limit_amount = $2`, [category, limit]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/loans/request', async (req, res) => { const { userId, amount, reason } = req.body; try { await client.query(`INSERT INTO loans (user_id, original_amount, remaining_amount, reason, status) VALUES ($1, $2, $2, $3, 'pending')`, [userId, amount, reason]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/loans/repay', async (req, res) => { const { loanId, amount, userId } = req.body; try { await client.query('BEGIN'); const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]); if (userRes.rows[0].balance < amount) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'אין מספיק יתרה' }); } await client.query(`UPDATE loans SET remaining_amount = remaining_amount - $1 WHERE id = $2`, [amount, loanId]); const loanRes = await client.query('SELECT remaining_amount FROM loans WHERE id = $1', [loanId]); if (loanRes.rows[0].remaining_amount <= 0) { await client.query(`UPDATE loans SET status = 'paid', remaining_amount = 0 WHERE id = $1`, [loanId]); } await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]); await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'החזר הלוואה', 'loans', 'expense')`, [userId, amount]); await client.query('COMMIT'); res.json({ success: true }); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } });

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(port, () => { console.log(`Server running on port ${port}`); });
