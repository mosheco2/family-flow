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

// --- API: נתונים לדשבורד ---
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

    const transRes = await client.query(`
      SELECT t.*, u.name as user_name 
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.date DESC LIMIT 20
    `);

    // שליפת משימות
    let tasksQuery = `
      SELECT t.*, u.name as assignee_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_to = u.id 
    `;
    
    // לוגיקת סינון משימות
    if (user.role === 'child') {
      tasksQuery += ` WHERE t.assigned_to = ${userId} AND t.status != 'approved'`;
    } else {
      tasksQuery += ` WHERE t.status != 'approved'`;
    }
    tasksQuery += ` ORDER BY t.id DESC`;
    
    const tasksRes = await client.query(tasksQuery);

    res.json({ 
      user, 
      transactions: transRes.rows, 
      family: familyMembers,
      tasks: tasksRes.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: ניהול משימות (התיקון נמצא כאן) ---

// 1. יצירת משימה
app.post('/api/tasks', async (req, res) => {
    const { title, reward, assignedTo } = req.body;
    try {
        await client.query(`
            INSERT INTO tasks (title, reward, status, assigned_to)
            VALUES ($1, $2, 'pending', $3)
        `, [title, reward, assignedTo]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. עדכון סטטוס וביצוע תשלום
app.post('/api/tasks/update', async (req, res) => {
    const { taskId, status } = req.body;
    console.log(`Update Task Request: ID ${taskId} -> Status ${status}`); // לוג לבדיקה
    
    try {
        await client.query('BEGIN');

        if (status === 'approved') {
            // שליפת המשימה לוודא קיום ושהיא לא שולמה כבר
            const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
            const task = taskRes.rows[0];

            if (task) {
                console.log(`Found task: ${task.title}, Current Status: ${task.status}, Reward: ${task.reward}`);

                if (task.status !== 'approved') {
                    const rewardAmount = parseFloat(task.reward); // המרה בטוחה למספר
                    const childId = task.assigned_to;

                    console.log(`Paying ${rewardAmount} to user ${childId}`);

                    // 1. עדכון יתרה
                    await client.query(`
                        UPDATE users SET balance = balance + $1 WHERE id = $2
                    `, [rewardAmount, childId]);

                    // 2. תיעוד בתנועות
                    await client.query(`
                        INSERT INTO transactions (user_id, amount, description, category, type)
                        VALUES ($1, $2, $3, 'tasks', 'income')
                    `, [childId, rewardAmount, `בוצע: ${task.title}`]);
                    
                    console.log('Payment successful');
                } else {
                    console.log('Task already approved, skipping payment');
                }
            }
        }

        // עדכון סטטוס המשימה
        await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Task update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- API: טרנזקציות ---
app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  try {
    await client.query('BEGIN');
    
    const cleanAmount = parseFloat(amount); // המרה בטוחה
    
    await client.query(`
      INSERT INTO transactions (user_id, amount, description, category, type)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, cleanAmount, description, category, type]);

    const factor = type === 'income' ? 1 : -1;
    await client.query(`
      UPDATE users SET balance = balance + $1 
      WHERE id = $2
    `, [cleanAmount * factor, userId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// --- API: יצירת משתמש ---
app.post('/api/create-user', async (req, res) => {
    const { name, pin, role, initialBalance } = req.body;
    const startAmount = parseFloat(initialBalance) || 0;
    try {
        await client.query(`
            INSERT INTO users (name, role, balance, pin_code)
            VALUES ($1, $2, $3, $4)
        `, [name, role, startAmount, pin]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
