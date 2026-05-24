require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then((client) => {
        console.log("✅ חיבור הצליח! מסד הנתונים נגיש לחלוטין מ-Render.");
        client.release();
        process.exit();
    })
    .catch(err => {
        console.error("❌ שגיאת חיבור:", err.message);
        process.exit(1);
    });