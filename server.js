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

client.connect()
  .then(() => console.log('Connected to DB'))
  .catch(err => console.error('Connection Error', err.stack));

// --- SETUP DB ---
app.get('/setup-db', async (req, res) => {
  try {
    const tables = ['user_assignments', 'quiz_bundles', 'shopping_trip_items', 'shopping_trips', 'product_prices', 'transactions', 'tasks', 'shopping_list', 'goals', 'loans', 'budgets', 'users', 'groups'];
    for (const t of tables) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);

    await client.query(`CREATE TABLE groups (id SERIAL PRIMARY KEY, name VARCHAR(100), admin_email VARCHAR(255) UNIQUE, type VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, nickname VARCHAR(50), password VARCHAR(255), role VARCHAR(20), status VARCHAR(20) DEFAULT 'PENDING', birth_year INTEGER, balance DECIMAL(10, 2) DEFAULT 0, allowance_amount DECIMAL(10, 2) DEFAULT 0, interest_rate DECIMAL(5, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, nickname))`);
    await client.query(`CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, amount DECIMAL(10, 2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(100), target_amount DECIMAL(10, 2), current_amount DECIMAL(10, 2) DEFAULT 0, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE budgets (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, category VARCHAR(50), limit_amount DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, title VARCHAR(255), reward DECIMAL(10, 2), status VARCHAR(20) DEFAULT 'pending', assigned_to INTEGER REFERENCES users(id))`);
    await client.query(`CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), quantity INTEGER DEFAULT 1, estimated_price DECIMAL(10, 2), requested_by INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), store_name VARCHAR(100), total_amount DECIMAL(10, 2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INTEGER REFERENCES shopping_trips(id) ON DELETE CASCADE, item_name VARCHAR(255), quantity INTEGER, price_per_unit DECIMAL(10, 2))`);
    await client.query(`CREATE TABLE product_prices (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, item_name VARCHAR(255), store_name VARCHAR(100), price DECIMAL(10, 2), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, original_amount DECIMAL(10, 2), status VARCHAR(20) DEFAULT 'pending')`);
    await client.query(`CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, title VARCHAR(150), type VARCHAR(50), reward DECIMAL(10,2), questions JSONB)`);
    await client.query(`CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, bundle_id INTEGER REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned')`);

    res.send(`<h1 style="color:blue">Oneflow life System Ready with History Tracking 🚀</h1>`);
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// --- SHOPPING & CROWD WISDOM ---
app.post('/api/shopping/add', async (req, res) => {
    const { itemName, quantity, price, userId } = req.body;
    try {
        const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const gid = u.rows[0].group_id;
        await client.query(`INSERT INTO shopping_list (item_name, quantity, estimated_price, requested_by, group_id) VALUES ($1, $2, $3, $4, $5)`, [itemName, quantity || 1, price, userId, gid]);
        
        let alert = null;
        if (price > 0) {
            const history = await client.query(`SELECT price, store_name, date FROM product_prices WHERE item_name = $1 AND price < $2 ORDER BY price ASC LIMIT 1`, [itemName, price]);
            if (history.rows.length > 0) {
                const best = history.rows[0];
                alert = { msg: `💡 חכמת המונים: מוצר זה נרכש במחיר טוב יותר של ₪${best.price} ב-${best.store_name} (בתאריך ${new Date(best.date).toLocaleDateString('he-IL')})` };
            }
        }
        res.json({ success: true, alert });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const { boughtItems, missingItems, totalAmount, userId, storeName } = req.body;
    try {
        await client.query('BEGIN');
        const u = await client.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        const gid = u.rows[0].group_id;
        const trip = await client.query(`INSERT INTO shopping_trips (group_id, user_id, store_name, total_amount) VALUES ($1, $2, $3, $4) RETURNING id`, [gid, userId, storeName, totalAmount]);
        const tripId = trip.rows[0].id;

        const savingsReport = [];
        for (const item of boughtItems) {
            await client.query("UPDATE shopping_list SET status = 'bought' WHERE id = $1", [item.id]);
            await client.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [tripId, item.name, item.quantity, item.price]);
            await client.query(`INSERT INTO product_prices (group_id, item_name, store_name, price) VALUES ($1, $2, $3, $4)`, [gid, item.name, storeName, item.price]);
            
            const better = await client.query(`SELECT price, store_name, date FROM product_prices WHERE item_name = $1 AND price < $2 ORDER BY price ASC LIMIT 1`, [item.name, item.price]);
            if (better.rows.length > 0) {
                const b = better.rows[0];
                savingsReport.push({ name: item.name, paid: item.price, best: b.price, date: b.date });
            }
        }
        for (const m of missingItems) { await client.query("UPDATE shopping_list SET status = 'pending' WHERE id = $1", [m.id]); }
        
        await client.query(`INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1, $2, $3, 'groceries', 'expense')`, [userId, totalAmount, `קניות ב-${storeName}`]);
        await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
        await client.query('COMMIT');
        res.json({ success: true, savingsReport });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

// (המשך ראוטים של בנק, יעדים ומשתמשים ללא שינוי...)
app.post('/api/login', async (req, res) => { /* ... לוגיקת לוגין קיימת ... */ });
app.get('/api/data/:userId', async (req, res) => { /* ... לוגיקת שליפת דאטה קיימת ... */ });

app.listen(port, () => console.log(`Server running on port ${port}`));
