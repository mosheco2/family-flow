require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => {
        console.log("✅ חיבור הצליח! מסד הנתונים נגיש.");
        process.exit();
    })
    .catch(err => {
        console.error("❌ שגיאת חיבור:", err.message);
        process.exit(1);
    });