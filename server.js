const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// שימוש בהגדרות אבטחה בסיסיות
app.use(cors());
app.use(express.json());

// הגדרת החיבור למסד הנתונים
// Render מספק את הכתובת הזו אוטומטית דרך משתני סביבה
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // נדרש עבור חיבור ב-Render
  }
});

// ניסיון התחברות למסד הנתונים
client.connect()
  .then(() => console.log('Connected to PostgreSQL database successfully!'))
  .catch(err => console.error('Connection error', err.stack));

// נתיב ראשי לבדיקה שהשרת עובד
app.get('/', (req, res) => {
  res.send('FamilyFlow Server is Running & Connected to DB!');
});

// נתיב לבדיקת זמן המסד (מוודא שהחיבור באמת תקין)
app.get('/db-test', async (req, res) => {
  try {
    const result = await client.query('SELECT NOW()');
    res.json({ message: 'Database connection verified', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
