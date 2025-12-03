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

// --- הקמת מסד הנתונים (כולל טבלת הקניות החדשה) ---
app.get('/setup-db', async (req, res) => {
  try {
    // טבלאות קיימות
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

    // --- חדש: טבלת רשימת קניות ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        requested_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending', -- pending (ילד ביקש), approved (ברשימה), in_cart (בעגלה), bought (נקנה)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // יצירת הורה ברירת מחדל אם לא קיים
    const userCheck = await client.query('SELECT * FROM users WHERE role = $1', ['parent']);
    if (userCheck.rows.length === 0) {
        await client.query(`INSERT INTO users (name, role, balance, pin_code) VALUES ('Admin Parent', 'parent', 0, '1234')`);
    }

    res.send(`<h2 style="color: green;">Database Updated! Shopping List table created.</h2>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// --- API: כניסה למערכת ---
app.post('/api/login', async (req, res) => {
  const { pin } = req.body;
  try {
    const result = await client.query('SELECT * FROM users WHERE pin_code = $1', [pin]);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'קוד שגוי' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: נתונים לדשבורד (כולל תיקון פרטיות) ---
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // 1. משפחה
    let familyMembers = [];
    if (user.role === 'parent') {
        const familyRes = await client.query('SELECT id, name, balance, role FROM users ORDER BY id');
        familyMembers = familyRes.rows;
    }

    // 2. תנועות - תיקון פרטיות!
    let transQuery = `
      SELECT t.*, u.name as user_name 
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
    `;
    
    // אם זה ילד - מראה רק את שלו. אם הורה - מראה הכל.
    if (user.role === 'child') {
        transQuery += ` WHERE t.user_id = ${userId}`;
    }
    transQuery += ` ORDER BY t.date DESC LIMIT 20`;
    
    const transRes = await client.query(transQuery);

    // 3. משימות
    let tasksQuery = `
      SELECT t.*, u.name as assignee_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_to = u.id 
    `;
    if (user.role === 'child') {
      tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`;
    } else {
      tasksQuery += ` WHERE t.status != 'approved'`;
    }
    tasksQuery += ` ORDER BY t.id DESC`;
    const tasksRes = await client.query(tasksQuery);

    // 4. רשימת קניות (חדש!)
    // מביאים רק פריטים פעילים (לא מה שכבר נקנה בעבר)
    const shopRes = await client.query(`
        SELECT s.*, u.name as requester_name 
        FROM shopping_list s
        LEFT JOIN users u ON s.requested_by = u.id
        WHERE s.status != 'bought'
        ORDER BY s.id DESC
    `);

    res.json({ 
      user, 
      transactions: transRes.rows, 
      family: familyMembers,
      tasks: tasksRes.rows,
      shopping_list: shopRes.rows // שולחים את הרשימה לקליינט
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: ניהול רשימת קניות (חדש!) ---

// הוספת פריט
app.post('/api/shopping/add', async (req, res) => {
    const { itemName, userId } = req.body;
    try {
        // אם הורה מוסיף - זה ישר מאושר. אם ילד - זה ממתין.
        const userRes = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
        const status = userRes.rows[0].role === 'parent' ? 'approved' : 'pending';

        await client.query(`
            INSERT INTO shopping_list (item_name, requested_by, status)
            VALUES ($1, $2, $3)
        `, [itemName, userId, status]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// שינוי סטטוס פריט (אישור בקשה / הכנסה לעגלה)
app.post('/api/shopping/update', async (req, res) => {
    const { itemId, status } = req.body;
    try {
        await client.query('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, itemId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// סיום קנייה (Checkout) - הופך פריטים להוצאה
app.post('/api/shopping/checkout', async (req, res) => {
    const { totalAmount, userId } = req.body; // userId של ההורה המשלם
    try {
        await client.query('BEGIN');

        // 1. העברת כל הפריטים שהיו בעגלה לסטטוס 'bought'
        await client.query("UPDATE shopping_list SET status = 'bought' WHERE status = 'in_cart'");

        // 2. יצירת הוצאה כספית
        const amount = parseFloat(totalAmount);
        await client.query(`
            INSERT INTO transactions (user_id, amount, description, category, type)
            VALUES ($1, $2, 'קניות בסופר', 'groceries', 'expense')
        `, [userId, amount]);

        // הורדה מהיתרה (אופציונלי, תלוי אם מנהלים יתרה להורים. נניח שכן לטובת המעקב)
        // await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});


// --- שאר ה-API הקודמים (משימות, תנועות, יוזרים) ---
app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo } = req.body;
    try {
        await client.query(`INSERT INTO tasks (title, reward, status, assigned_to) VALUES ($1, $2, 'pending', $3)`, [title, reward, assignedTo]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    const cleanAmount = parseFloat(amount);
    const factor = type === 'income' ? 1 : -1;
    await client.query('BEGIN');
    await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5)`, [userId, cleanAmount, description, category, type]);
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [cleanAmount * factor, userId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/create-user', async (req, res) => {
    const { name, pin, role, initialBalance } = req.body;
    try {
        await client.query(`INSERT INTO users (name, role, balance, pin_code) VALUES ($1, $2, $3, $4)`, [name, role, parseFloat(initialBalance)||0, pin]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
