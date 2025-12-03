const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // מאפשר הגשת קבצי HTML עתידיים

// הגדרת חיבור למסד הנתונים
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect();

// --- דף הבית ---
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>FamilyFlow Server is Running! 🚀</h1>
      <p>System Status: Online</p>
      <p>To initialize the database, go to: <a href="/setup-db">/setup-db</a></p>
    </div>
  `);
});

// --- פקודה חד-פעמית להקמת הטבלאות ---
app.get('/setup-db', async (req, res) => {
  try {
    // 1. טבלת משתמשים (הורים וילדים)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL, -- 'parent' or 'child'
        balance DECIMAL(10, 2) DEFAULT 0, -- יתרה נוכחית (לילדים)
        pin_code VARCHAR(10) -- קוד גישה פשוט
      );
    `);

    // 2. טבלת תנועות (הכנסות והוצאות)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        description VARCHAR(255),
        category VARCHAR(50), -- אוכל, צעצועים, דמי כיס
        type VARCHAR(20), -- 'income' or 'expense'
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. טבלת משימות (דרכה ילדים מרוויחים כסף)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        reward DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- pending, done, approved
        assigned_to INTEGER REFERENCES users(id)
      );
    `);

    // יצירת משתמש "אבא/אמא" ראשוני אם לא קיים עדיין
    const userCheck = await client.query('SELECT * FROM users WHERE role = $1', ['parent']);
    let message = "Tables created successfully! ";
    
    if (userCheck.rows.length === 0) {
        await client.query(`
            INSERT INTO users (name, role, balance, pin_code) 
            VALUES ('Admin Parent', 'parent', 0, '1234')
        `);
        message += "Default Parent user created (Pin: 1234).";
    }

    res.send(`<h2 style="color: green;">${message}</h2><p>You can now start using the API.</p>`);

  } catch (err) {
    res.status(500).send(`<h2 style="color: red;">Error: ${err.message}</h2>`);
  }
});

// --- API: קבלת כל המשתמשים (לבדיקה) ---
app.get('/users', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
