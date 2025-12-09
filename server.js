/**
 * server.js
 * Oneflow Life - consolidated server for Postgres (DATABASE_URL) 
 * - Creates schema if missing and seeds demo data (products ~920, users, bundles) if tables empty
 * - Exposes /api endpoints for: data envelope, users, shopping, academy, tasks, budget, bank, admin
 *
 * Important: set process.env.DATABASE_URL in your Render service (do NOT hardcode credentials)
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || null;

let pool = null;
let useDb = false;

if (DATABASE_URL) {
  const enableSsl = !/localhost|127\.0\.0\.1/.test(DATABASE_URL);
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: enableSsl ? { rejectUnauthorized: false } : false,
  });
  useDb = true;
  console.log('Using Postgres DB (DATABASE_URL detected). SSL:', enableSsl);
} else {
  console.log('No DATABASE_URL detected — DB required in production. Exiting.');
  process.exit(1);
}

/* Helper: db query */
async function dbQuery(q, params=[]) {
  const res = await pool.query(q, params);
  return res;
}

/* Ensure schema and seed if empty */
async function ensureSchemaAndSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users / groups
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups_tbl (
        id SERIAL PRIMARY KEY,
        name TEXT,
        admin_id INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES groups_tbl(id) ON DELETE SET NULL,
        nickname TEXT,
        email TEXT,
        role TEXT DEFAULT 'USER',
        status TEXT DEFAULT 'ACTIVE',
        birth_year INT,
        balance NUMERIC DEFAULT 0,
        allowance_amount NUMERIC DEFAULT 0,
        interest_rate NUMERIC DEFAULT 0.0,
        xp INT DEFAULT 0
      );
    `);

    // Shopping
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        group_id INT,
        item_name TEXT,
        quantity INT DEFAULT 1,
        requester_id INT,
        requested_by INT,
        requester_name TEXT,
        status TEXT DEFAULT 'pending',
        est_price NUMERIC,
        suggested_price NUMERIC
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_history (
        id SERIAL PRIMARY KEY,
        group_id INT,
        store_name TEXT,
        trip_date TIMESTAMPTZ,
        nickname TEXT,
        total_amount NUMERIC
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_history_items (
        id SERIAL PRIMARY KEY,
        history_id INT REFERENCES shopping_history(id) ON DELETE CASCADE,
        item_name TEXT,
        quantity INT DEFAULT 1,
        price NUMERIC
      );
    `);

    // Products for autocomplete
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT,
        category TEXT
      );
    `);

    // product prices history (crowd wisdom)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id SERIAL PRIMARY KEY,
        item_name TEXT,
        last_price NUMERIC,
        store_name TEXT,
        recorded_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Academy
    await client.query(`
      CREATE TABLE IF NOT EXISTS bundles (
        id SERIAL PRIMARY KEY,
        title TEXT,
        reward NUMERIC,
        threshold INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bundle_questions (
        id SERIAL PRIMARY KEY,
        bundle_id INT REFERENCES bundles(id) ON DELETE CASCADE,
        q TEXT,
        options TEXT[],
        correct INT
      );
    `);

    // Tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        group_id INT,
        title TEXT,
        assigned_to INT,
        reward NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Budgets
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        group_id INT,
        user_id INT,
        category TEXT,
        limit_amount NUMERIC DEFAULT 0
      );
    `);

    // Transactions (simple ledger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INT,
        amount NUMERIC,
        description TEXT,
        category TEXT,
        type TEXT,
        date TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Loans / goals / other
    await client.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        group_id INT,
        user_id INT,
        amount NUMERIC,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action TEXT,
        icon TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Seeds: groups/users
    const ucount = (await client.query('SELECT COUNT(*)::int AS c FROM users')).rows[0].c;
    if (parseInt(ucount,10) === 0) {
      await client.query(`INSERT INTO groups_tbl (name, admin_id) VALUES ('משפחת דמו', NULL) RETURNING id`);
      const g = (await client.query('SELECT id FROM groups_tbl LIMIT 1')).rows[0];
      await client.query(`
        INSERT INTO users (group_id, nickname, email, role, balance, allowance_amount, interest_rate, birth_year)
        VALUES 
          ($1,'אבא','dad@example.com','ADMIN',5000,20,0.01,1980),
          ($1,'אמא','mom@example.com','ADMIN',4200,20,0.01,1982),
          ($1,'דני','kid1@example.com','USER',45,10,0.01,2012)
      `, [g.id]);
      // set admin_id on group
      const adminId = (await client.query(`SELECT id FROM users WHERE role='ADMIN' ORDER BY id ASC LIMIT 1`)).rows[0].id;
      await client.query('UPDATE groups_tbl SET admin_id = $1 WHERE id = $2', [adminId, g.id]);
    }

    // Seed bundles if empty
    const bcnt = (await client.query('SELECT COUNT(*)::int AS c FROM bundles')).rows[0].c;
    if (parseInt(bcnt,10) === 0) {
      const res1 = await client.query(`INSERT INTO bundles (title, reward, threshold) VALUES ($1,$2,$3) RETURNING id`, ['יסודות הכסף - גיל 6-10', 5, 80]);
      const bid1 = res1.rows[0].id;
      await client.query(`INSERT INTO bundle_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bid1, 'מהו חיסכון?', ['לשמור כסף','לבזבז הכל','להשקיע בבורסה'], 0]);
      const res2 = await client.query(`INSERT INTO bundles (title, reward, threshold) VALUES ($1,$2,$3) RETURNING id`, ['ניהול תקציב - גיל 11-16', 10, 80]);
      const bid2 = res2.rows[0].id;
      await client.query(`INSERT INTO bundle_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bid2, 'מהי ריבית?', ['תשלום על הלוואה','סוג דיווח','מס פרטי'], 0]);
    }

    // Seed products table if not enough rows (~920)
    const prodCount = (await client.query('SELECT COUNT(*)::int AS c FROM products')).rows[0].c;
    if (parseInt(prodCount,10) < 900) {
      const PRODUCT_CATS = {
        "ירקות ופירות 🍎": ["עגבניה","מלפפון","גזר","בצל","תפוח","בננה","מנדרינה","תפוז","חסה"],
        "מעדניות": ["גבינה צהובה","גבינת מוצרלה","יוגורט","חמאה"],
        "מזון בסיסי": ["קמח","סוכר","אורז","פסטה","קטניות"],
        "משקאות": ["מיץ תפוזים","מים מינרליים","קפה","תה"],
        "ניקיון": ["סבון כלים","נוזל כביסה","מגבונים","נוזל רחצה"],
        "חטיפים": ["עוגיות","שוקולד","חטיפי אנרגיה"],
        "מאפים": ["לחם","בייגל","קרואסון"]
      };
      const base = [];
      Object.entries(PRODUCT_CATS).forEach(([cat, items]) => items.forEach(it => base.push({ name: it, category: cat })));
      let k = 0;
      const toInsert = [];
      while (prodCount + toInsert.length < 920) {
        const pick = base[k % base.length];
        const suffix = Math.floor(k / base.length) + 1;
        toInsert.push([`${pick.name} ${suffix}`, pick.category]);
        k++;
      }
      const batchSize = 200;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const slice = toInsert.slice(i, i + batchSize);
        const values = [];
        const params = [];
        slice.forEach((r, idx) => { values.push(`($${idx*2+1}, $${idx*2+2})`); params.push(r[0], r[1]); });
        const q = `INSERT INTO products (name, category) VALUES ${values.join(',')}`;
        await client.query(q, params);
      }
      console.log('Seeded products table with demo items (~920 entries).');
    }

    await client.query('COMMIT');
  } catch (err) {
    console.error('Schema/seed error:', err);
    await client.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {
    client.release();
  }
}

/* Initialize */
(async () => {
  try {
    await ensureSchemaAndSeed();
    app.listen(PORT, () => console.log(`Oneflow Life API listening on port ${PORT}`));
  } catch (e) {
    console.error('Failed to init:', e);
    process.exit(1);
  }
})();

/* -------------------------
   API Endpoints (kept paths compatible)
   ------------------------- */

/* Ping */
app.get('/api/ping', (req, res) => res.json({ ok: true }));

/* Users */
app.get('/api/users/:id', async (req, res) => {
  try {
    const r = await dbQuery('SELECT * FROM users WHERE id = $1', [Number(req.params.id)]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

/* Data envelope for dashboard */
app.get('/api/data/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const ru = await dbQuery('SELECT * FROM users WHERE id = $1', [userId]);
    if (ru.rowCount === 0) return res.status(404).json({ error: 'user not found' });
    const user = ru.rows[0];
    // tasks for group
    const groupId = user.group_id || (await dbQuery('SELECT id FROM groups_tbl LIMIT 1')).rows[0].id;
    const tasks = (await dbQuery('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 ORDER BY t.created_at DESC', [groupId])).rows;
    // shopping list not bought
    const shop = (await dbQuery('SELECT s.* FROM shopping_list s WHERE s.group_id = $1 AND s.status != $2 ORDER BY s.id DESC', [groupId, 'bought'])).rows;
    // bundles
    const bRes = await dbQuery('SELECT id, title, reward, threshold FROM bundles ORDER BY id ASC');
    const bundles = [];
    for (const b of bRes.rows) {
      const qRes = await dbQuery('SELECT q, options, correct FROM bundle_questions WHERE bundle_id = $1', [b.id]);
      bundles.push(Object.assign({}, b, { questions: qRes.rows }));
    }
    // budget status (simple)
    const budgets = (await dbQuery('SELECT category, limit_amount FROM budgets WHERE group_id = $1 AND user_id IS NULL ORDER BY category', [groupId])).rows;
    // weekly stats (demo)
    const weekly_stats = { spent: 0, limit: 0 };
    res.json({ user, tasks, shopping_list: shop, quiz_bundles: bundles, weekly_stats, budget_status: budgets });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

/* -------------------------
   SHOPPING endpoints
   ------------------------- */

/* Add item */
app.post('/api/shopping/add', async (req, res) => {
  const { itemName, quantity = 1, userId, estPrice = null } = req.body;
  if (!itemName || !userId) return res.status(400).json({ success: false, msg: 'missing' });
  try {
    const ru = await dbQuery('SELECT nickname, group_id FROM users WHERE id = $1', [Number(userId)]);
    const nick = ru.rowCount ? ru.rows[0].nickname : 'מישהו';
    const gid = ru.rowCount ? ru.rows[0].group_id : (await dbQuery('SELECT id FROM groups_tbl LIMIT 1')).rows[0].id;
    const r = await dbQuery('INSERT INTO shopping_list (group_id, item_name, quantity, requester_id, requester_name, status, est_price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [gid, itemName, Number(quantity), Number(userId), nick, 'pending', estPrice]);
    res.json({ success: true, item: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ success: false, msg: 'error' }); }
});

/* Update status or delete */
app.post('/api/shopping/update', async (req, res) => {
  const { itemId, status } = req.body;
  if (!itemId) return res.status(400).json({ success: false });
  try {
    if (status === 'deleted') {
      await dbQuery('DELETE FROM shopping_list WHERE id = $1', [Number(itemId)]);
    } else {
      await dbQuery('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, Number(itemId)]);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* Checkout: record trip, insert prices, remove bought items, adjust user balance */
app.post(['/api/shopping/checkout','/api/payday/checkout'], async (req, res) => {
  const { totalAmount = 0, userId, storeName = 'סופר', boughtItems = [], missingItems = [] } = req.body;
  try {
    await dbQuery('BEGIN');
    const insertTrip = await dbQuery('INSERT INTO shopping_history (group_id, store_name, trip_date, nickname, total_amount) VALUES ($1,$2,$3,$4,$5) RETURNING id', [1, storeName, new Date().toISOString(), 'מישהו', Number(totalAmount)]);
    const tripId = insertTrip.rows[0].id;
    for (const b of boughtItems) {
      await dbQuery('INSERT INTO shopping_history_items (history_id, item_name, quantity, price) VALUES ($1,$2,$3,$4)', [tripId, b.name, b.quantity || 1, b.price || 0]);
      // record product price for crowd wisdom
      if (b.price) await dbQuery('INSERT INTO product_prices (item_name, last_price, store_name) VALUES ($1,$2,$3)', [b.name, b.price, storeName]);
    }
    // delete bought
    const boughtIds = boughtItems.map(b => Number(b.id)).filter(Boolean);
    if (boughtIds.length) {
      const placeholders = boughtIds.map((_,i)=>`$${i+1}`).join(',');
      await dbQuery(`DELETE FROM shopping_list WHERE id IN (${placeholders})`, boughtIds);
    }
    // update missing to pending
    for (const m of missingItems) {
      await dbQuery('UPDATE shopping_list SET status = $1 WHERE id = $2', ['pending', Number(m.id)]);
    }
    if (userId) {
      await dbQuery('UPDATE users SET balance = balance - $1 WHERE id = $2', [Number(totalAmount || 0), Number(userId)]);
      // ledger
      await dbQuery('INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1,$2,$3,$4,$5)', [Number(userId), Number(totalAmount || 0), `קנייה ב-${storeName}`, 'groceries', 'expense']);
    }
    await dbQuery('COMMIT');
    res.json({ success: true, tripId });
  } catch (e) {
    console.error(e);
    await dbQuery('ROLLBACK').catch(()=>{});
    res.status(500).json({ success: false, msg: 'server' });
  }
});

/* History */
app.get('/api/shopping/history', async (req, res) => {
  try {
    const groupId = Number(req.query.groupId || 1);
    const trips = await dbQuery('SELECT * FROM shopping_history WHERE group_id = $1 ORDER BY trip_date DESC', [groupId]);
    const out = [];
    for (const t of trips.rows) {
      const items = (await dbQuery('SELECT item_name, quantity, price FROM shopping_history_items WHERE history_id = $1', [t.id])).rows;
      out.push(Object.assign({}, t, { items }));
    }
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

/* Copy trip to shopping_list */
app.post('/api/shopping/copy', async (req, res) => {
  const { tripId, userId } = req.body;
  try {
    const items = (await dbQuery('SELECT item_name, quantity FROM shopping_history_items WHERE history_id = $1', [Number(tripId)])).rows;
    const ru = await dbQuery('SELECT nickname, group_id FROM users WHERE id = $1', [Number(userId)]);
    const nick = ru.rowCount ? ru.rows[0].nickname : 'מישהו';
    const gid = ru.rowCount ? ru.rows[0].group_id : 1;
    for (const it of items) {
      await dbQuery('INSERT INTO shopping_list (group_id, item_name, quantity, requester_id, requester_name, status) VALUES ($1,$2,$3,$4,$5,$6)', [gid, it.item_name, it.quantity || 1, Number(userId), nick, 'pending']);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* Products search for autocomplete */
app.get('/api/products/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    const r = await dbQuery('SELECT name, category FROM products WHERE LOWER(name) LIKE $1 LIMIT 30', [`%${q}%`]);
    res.json(r.rows.map(rw => ({ name: rw.name, category: rw.category })));
  } catch (e) { console.error(e); res.status(500).json([]); }
});

/* -------------------------
   ACADEMY
   ------------------------- */
app.get('/api/academy/bundles', async (req, res) => {
  try {
    const bRes = await dbQuery('SELECT id, title, reward, threshold FROM bundles ORDER BY id ASC');
    const bundles = [];
    for (const b of bRes.rows) {
      const qRes = await dbQuery('SELECT q, options, correct FROM bundle_questions WHERE bundle_id = $1', [b.id]);
      bundles.push(Object.assign({}, b, { questions: qRes.rows }));
    }
    res.json(bundles);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

app.post('/api/academy/submit', async (req, res) => {
  const { userId, bundleId, score, reward } = req.body;
  try {
    if (!userId) return res.status(400).json({ success: false });
    if (score >= 0 && reward) {
      await dbQuery('UPDATE users SET balance = balance + $1 WHERE id = $2', [Number(reward || 0), Number(userId)]);
      await dbQuery('INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1,$2,$3,$4,$5)', [Number(userId), Number(reward || 0), 'בונוס אקדמיה', 'education', 'income']);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* -------------------------
   TASKS
   ------------------------- */
app.get('/api/tasks', async (req, res) => {
  try {
    const groupId = Number(req.query.groupId || 1);
    const rows = (await dbQuery('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 ORDER BY created_at DESC', [groupId])).rows;
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

app.post('/api/tasks', async (req, res) => {
  const { title, reward = 0, assignedTo, groupId } = req.body;
  try {
    await dbQuery('INSERT INTO tasks (group_id, title, assigned_to, reward) VALUES ($1,$2,$3,$4)', [groupId || 1, title, assignedTo || null, reward]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

app.post('/api/tasks/update', async (req, res) => {
  const { taskId, status } = req.body;
  try {
    await dbQuery('UPDATE tasks SET status = $1 WHERE id = $2', [status, Number(taskId)]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* -------------------------
   BUDGET
   ------------------------- */
app.get('/api/budget/filter', async (req, res) => {
  try {
    const groupId = Number(req.query.groupId || 1);
    const targetUserId = req.query.targetUserId || 'all';
    if (targetUserId === 'all') {
      const budgets = (await dbQuery('SELECT category, limit_amount FROM budgets WHERE group_id = $1 AND user_id IS NULL ORDER BY category', [groupId])).rows;
      res.json(budgets);
      return;
    }
    const budgets = (await dbQuery('SELECT category, limit_amount FROM budgets WHERE group_id = $1 AND user_id = $2 ORDER BY category', [groupId, Number(targetUserId)])).rows;
    res.json(budgets);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

app.post('/api/budget/update', async (req, res) => {
  try {
    const { groupId, category, limit, targetUserId } = req.body;
    if (targetUserId && targetUserId !== 'all') {
      await dbQuery('INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1,$2,$3,$4) ON CONFLICT (group_id, user_id, category) DO UPDATE SET limit_amount = EXCLUDED.limit_amount', [groupId, Number(targetUserId), category, Number(limit)]);
    } else {
      await dbQuery('INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1,NULL,$2,$3) ON CONFLICT (group_id, user_id, category) DO UPDATE SET limit_amount = EXCLUDED.limit_amount', [groupId, category, Number(limit)]);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* -------------------------
   BANK / PAYDAY
   - PayDay: distribute allowance_amount to every non-admin user
   - Additionally add interest on 80% of their balance (if interest_rate set)
   ------------------------- */
app.post(['/api/bank/payday','/api/payday'], async (req, res) => {
  try {
    await dbQuery('BEGIN');
    const users = (await dbQuery('SELECT id, nickname, role, balance, allowance_amount, interest_rate FROM users WHERE role != $1', ['ADMIN'])).rows;
    for (const u of users) {
      const allowance = Number(u.allowance_amount || 0);
      // Add allowance
      if (allowance > 0) {
        await dbQuery('UPDATE users SET balance = balance + $1 WHERE id = $2', [allowance, u.id]);
        await dbQuery('INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1,$2,$3,$4,$5)', [u.id, allowance, 'דמי כיס', 'allowance', 'income']);
      }
      // Interest on 80% of balance after allowance
      const ru = (await dbQuery('SELECT balance, interest_rate FROM users WHERE id = $1', [u.id])).rows[0];
      const balanceNow = Number(ru.balance || 0);
      const interestRate = Number(ru.interest_rate || 0);
      const baseForInterest = balanceNow * 0.8;
      const interest = +(baseForInterest * interestRate).toFixed(2);
      if (interest > 0) {
        await dbQuery('UPDATE users SET balance = balance + $1 WHERE id = $2', [interest, u.id]);
        await dbQuery('INSERT INTO transactions (user_id, amount, description, category, type) VALUES ($1,$2,$3,$4,$5)', [u.id, interest, 'ריבית על חסכון (80%)', 'interest', 'income']);
      }
      // activity
      await dbQuery('INSERT INTO activity_log (user_id, action, icon) VALUES ($1,$2,$3)', [u.id, `PayDay - קיבל דמי כיס וריבית ₪${allowance + interest}`, 'coins']);
    }
    await dbQuery('COMMIT');
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    await dbQuery('ROLLBACK').catch(()=>{});
    res.status(500).json({ success: false, error: e.message });
  }
});

/* Bank settings update */
app.post('/api/bank/settings', async (req, res) => {
  try {
    const { userId, allowance, interest } = req.body;
    await dbQuery('UPDATE users SET allowance_amount = $1, interest_rate = $2 WHERE id = $3', [Number(allowance||0), Number(interest||0), Number(userId)]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* -------------------------
   ADMIN: pending users & approve
   ------------------------- */
app.get('/api/admin/pending-users', async (req, res) => {
  try {
    // for demo: no pending table, return empty
    res.json([]);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

app.post('/api/admin/approve-user', async (req, res) => {
  try {
    const { userId } = req.body;
    await dbQuery('UPDATE users SET status = $1 WHERE id = $2', ['ACTIVE', Number(userId)]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* Fallback: serve index.html for SPA */
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not Found');
});
