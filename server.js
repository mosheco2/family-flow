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

// --- API: הבאת נתונים מלאים (משתמשים + תנועות) ---
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // אם זה הורה - נביא גם את רשימת כל הילדים כדי שיוכל לנהל אותם
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

    res.json({ user, transactions: transRes.rows, family: familyMembers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: הוספת תנועה ---
app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  
  try {
    await client.query('BEGIN');
    
    // רישום התנועה
    await client.query(`
      INSERT INTO transactions (user_id, amount, description, category, type)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, amount, description, category, type]);

    // עדכון היתרה
    const factor = type === 'income' ? 1 : -1;
    await client.query(`
      UPDATE users SET balance = balance + $1 
      WHERE id = $2
    `, [amount * factor, userId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// --- API: יצירת משתמש חדש (ילד) ---
app.post('/api/create-user', async (req, res) => {
    const { name, pin, role } = req.body;
    try {
        await client.query(`
            INSERT INTO users (name, role, balance, pin_code)
            VALUES ($1, $2, 0, $3)
        `, [name, role, pin]);
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
