const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// שורה קריטית: אומרת לשרת להגיש את הקבצים מתיקיית public
app.use(express.static('public'));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect();

// --- הקמת מסד הנתונים ---
app.get('/setup-db', async (req, res) => {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0,
        pin_code VARCHAR(10)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        description VARCHAR(255),
        category VARCHAR(50),
        type VARCHAR(20),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        reward DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES users(id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        requested_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(100) NOT NULL,
        target_amount DECIMAL(10, 2) NOT NULL,
        current_amount DECIMAL(10, 2) DEFAULT 0,
        icon VARCHAR(50) DEFAULT 'star',
        status VARCHAR(20) DEFAULT 'active'
      );
    `);

    // יצירת הורה ברירת מחדל
    const userCheck = await client.query('SELECT * FROM users WHERE role = $1', ['parent']);
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code) VALUES ('Admin Parent', 'parent', 0, '1234')`);
    }

    res.send(`<h2 style="color: green;">Database Updated Successfully! All tables ready.</h2>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- API Endpoints ---

app.get('/api/public-users', async (req, res) => {
    try {
        const result = await client.query('SELECT id, name, role FROM users ORDER BY role DESC, id ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  const { userId, pin } = req.body;
  try {
    // תמיכה בגרסאות ישנות של הקליינט ששולחות רק PIN
    if (!userId && pin) {
         const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]);
         if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] });
         return res.status(401).json({ success: false, message: 'קוד שגוי' });
    }
    const result = await client.query('SELECT * FROM users WHERE id = $1 AND pin_code = $2', [userId, pin]);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'קוד שגוי' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    let familyMembers = [];
    if (user.role === 'parent') {
        const familyRes = await client.query('SELECT id, name, balance, role FROM users ORDER BY id');
        familyMembers = familyRes.rows;
    }

    let transQuery = `SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id`;
    if (user.role === 'child') transQuery += ` WHERE t.user_id = ${userId}`;
    transQuery += ` ORDER BY t.date DESC LIMIT 20`;
    const transRes = await client.query(transQuery);

    let tasksQuery = `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id `;
    if (user.role === 'child') tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`;
    else tasksQuery += ` WHERE t.status != 'approved'`;
    tasksQuery += ` ORDER BY t.id DESC`;
    const tasksRes = await client.query(tasksQuery);

    const shopRes = await client.query(`SELECT s.*, u.name as requester_name FROM shopping_list s LEFT JOIN users u ON s.requested_by = u.id WHERE s.status != 'bought' ORDER BY s.id DESC`);
    const goalsRes = await client.query(`SELECT * FROM goals WHERE user_id = $1 AND status = 'active'`, [userId]);

    res.json({ user, transactions: transRes.rows, family: familyMembers, tasks: tasksRes.rows, shopping_list: shopRes.rows, goals: goalsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/goals', async (req, res) => {
    const { userId, title, targetAmount } = req.body;
    try { await client.query(`INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3)`, [userId, title, targetAmount]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/goals/deposit', async (req, res) => {
    const { goalId, amount, userId } = req.body;
    try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows[0].balance < amount) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'אין מספיק יתרה' }); }
        await client.query('UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2', [amount, goalId]);
        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'הפקדה לחיסכון', 'savings', 'expense')`, [userId, amount]);
        await client.query('COMMIT'); res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/add', async (req, res) => {
    const { itemName, userId } = req.body;
    try {
        const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
        const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending';
        await client.query(`INSERT INTO shopping_list (item_name, requested_by, status) VALUES ($1, $2, $3)`, [itemName, userId, status]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    const { itemId, status } = req.body;
    try { await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const { totalAmount, userId } = req.body;
    try {
        await client.query('BEGIN');
        await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'");
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, 'קניות בסופר', 'groceries', 'expense')`, [userId, parseFloat(totalAmount)]);
        await client.query('COMMIT'); res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo } = req.body;
    try { await client.query(`INSERT INTO tasks (title, reward, status, assigned_to) VALUES ($1, $2, 'pending', $3)`, [title, reward, assignedTo]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
    const { taskId, status } = req.body;
    try {
        await client.query('BEGIN');
        if (status === 'approved') {
            const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
            const task = taskRes.rows[0];
            if (task && task.status !== 'approved') {
                const reward = parseFloat(task.reward);
                await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [reward, task.assigned_to]);
                await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'tasks', 'income')`, [task.assigned_to, reward, `בוצע: ${task.title}`]);
            }
        }
        await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);
        await client.query('COMMIT'); res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    const cleanAmount = parseFloat(amount); const factor = type === 'income' ? 1 : -1;
    await client.query('BEGIN');
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, cleanAmount, description, category, type]);
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [cleanAmount * factor, userId]);
    await client.query('COMMIT'); res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/create-user', async (req, res) => {
    const { name, pin, role, initialBalance } = req.body;
    try { await client.query(`INSERT INTO users (name, role, balance, pin_code) VALUES ($1, $2, $3, $4)`, [name, role, parseFloat(initialBalance)||0, pin]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ברירת מחדל: שליחת קובץ ה-HTML הראשי
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
