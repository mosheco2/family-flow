const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // השרת יחפש קבצי אתר בתיקיית public

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

// --- API: הבאת נתונים לדשבורד ---
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // הבאת פרטי משתמש
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // הבאת 5 תנועות אחרונות
    const transRes = await client.query(`
      SELECT * FROM transactions 
      WHERE user_id = $1 OR (user_id IS NULL AND $2 = 'parent') 
      ORDER BY date DESC LIMIT 5
    `, [userId, user.role]);

    res.json({ user, transactions: transRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: הוספת תנועה (הכנסה/הוצאה) ---
app.post('/api/transaction', async (req, res) => {
  const { userId, amount, description, category, type } = req.body;
  
  try {
    await client.query('BEGIN'); // התחלת טרנזקציה

    // 1. רישום התנועה
    await client.query(`
      INSERT INTO transactions (user_id, amount, description, category, type)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, amount, description, category, type]);

    // 2. עדכון היתרה של המשתמש (אם זה לא מנהל)
    const factor = type === 'income' ? 1 : -1;
    await client.query(`
      UPDATE users SET balance = balance + $1 
      WHERE id = $2
    `, [amount * factor, userId]);

    await client.query('COMMIT'); // סיום ואישור
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK'); // ביטול אם הייתה שגיאה
    res.status(500).json({ error: err.message });
  }
});

// נתיב ברירת מחדל שמחזיר את האפליקציה
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
