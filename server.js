/**
 * Oneflow Life - server.js (Postgres-capable)
 *
 * - Reads DATABASE_URL from env (Render provides this when you attach a Postgres DB).
 * - If no DATABASE_URL provided, falls back to in-memory (safe for quick tests).
 * - On startup ensures DB tables exist and seeds demo data (users/groups/products/bundles) if empty.
 * - Serves static files from ./public and exposes API under /api.
 *
 * Deploy on Render:
 * - Add DATABASE_URL env var (from Render Database).
 * - Start command: npm start
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

// Helper: simple in-memory fallback if no DB URL is provided
let fallback = {
  nextId: 100000,
  users: [],
  groups: [],
  shoppingList: [],
  shoppingHistory: [],
  bundles: []
};
function fallbackId() { return ++fallback.nextId; }

/* -------------------------
   DB Pool (Postgres) setup
   ------------------------- */
let pool = null;
let useDb = false;

if (DATABASE_URL) {
  // Render often requires SSL; enable unless DATABASE_URL explicitly points to localhost
  const enableSsl = !/localhost|127\.0\.0\.1/.test(DATABASE_URL);
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: enableSsl ? { rejectUnauthorized: false } : false,
    // optionally set idleTimeoutMillis/connectionTimeoutMillis here
  });
  useDb = true;
  console.log('Using Postgres DB (DATABASE_URL detected). SSL:', enableSsl);
} else {
  console.log('No DATABASE_URL detected — using in-memory fallback DB (not persistent).');
}

/* -------------------------
   DB schema & seed helpers
   ------------------------- */

async function ensureSchemaAndSeed() {
  if (!useDb) {
    // seed fallback with minimal demo data
    if (fallback.users.length === 0) {
      fallback.users.push({ id: 1, nickname: 'אבא', email: 'dad@example.com', role: 'ADMIN', balance: 5000, allowance_amount: 20, interest_rate: 0.01, birth_year: 1980 });
      fallback.users.push({ id: 2, nickname: 'אמא', email: 'mom@example.com', role: 'ADMIN', balance: 4200, allowance_amount: 20, interest_rate: 0.01, birth_year: 1982 });
      fallback.users.push({ id: 3, nickname: 'דני', email: 'kid1@example.com', role: 'USER', balance: 45, allowance_amount: 0, interest_rate: 0, birth_year: 2012 });
    }
    if (fallback.groups.length === 0) fallback.groups.push({ id: 1, name: 'משפחת כהן', admin_id: 1 });
    if (fallback.bundles.length === 0) {
      fallback.bundles.push({ id: 1, title: 'יסודות הכסף - גיל 6-10', reward: 5, threshold: 80, questions: [{ q: 'מהו חיסכון?', options: ['לשמור כסף','לבזבז הכל','להשקיע בבורסה'], correct: 0 }]});
      fallback.bundles.push({ id: 2, title: 'ניהול תקציב - גיל 11-16', reward: 10, threshold: 80, questions: [{ q: 'מהי ריבית?', options:['תשלום על הלוואה','סוג דיווח','מס פרטי'], correct: 0 }]});
    }
    return;
  }

  // Create tables if not exists
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname TEXT,
        email TEXT,
        role TEXT,
        balance NUMERIC DEFAULT 0,
        allowance_amount NUMERIC DEFAULT 0,
        interest_rate NUMERIC DEFAULT 0,
        birth_year INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS groups_tbl (
        id SERIAL PRIMARY KEY,
        name TEXT,
        admin_id INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        item_name TEXT,
        quantity INT DEFAULT 1,
        requester_id INT,
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
        options TEXT[],   -- Postgres array of options
        correct INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT,
        category TEXT
      );
    `);

    // seed minimal demo users/groups if empty
    const { rows: userCountRows } = await client.query(`SELECT count(*)::int AS c FROM users`);
    if (parseInt(userCountRows[0].c, 10) === 0) {
      await client.query(`INSERT INTO users (nickname, email, role, balance, allowance_amount, interest_rate, birth_year) VALUES
        ('אבא','dad@example.com','ADMIN',5000,20,0.01,1980),
        ('אמא','mom@example.com','ADMIN',4200,20,0.01,1982),
        ('דני','kid1@example.com','USER',45,0,0,2012)
      `);
    }

    const { rows: groupCount } = await client.query(`SELECT count(*)::int AS c FROM groups_tbl`);
    if (parseInt(groupCount[0].c, 10) === 0) {
      await client.query(`INSERT INTO groups_tbl (name, admin_id) VALUES ('משפחת כהן', 1)`);
    }

    // seed bundles if empty
    const { rows: bundleCountRows } = await client.query(`SELECT count(*)::int AS c FROM bundles`);
    if (parseInt(bundleCountRows[0].c, 10) === 0) {
      const res1 = await client.query(`INSERT INTO bundles (title, reward, threshold) VALUES ($1,$2,$3) RETURNING id`, ['יסודות הכסף - גיל 6-10', 5, 80]);
      const bid1 = res1.rows[0].id;
      await client.query(`INSERT INTO bundle_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bid1, 'מהו חיסכון?', ['לשמור כסף','לבזבז הכל','להשקיע בבורסה'], 0]);
      const res2 = await client.query(`INSERT INTO bundles (title, reward, threshold) VALUES ($1,$2,$3) RETURNING id`, ['ניהול תקציב - גיל 11-16', 10, 80]);
      const bid2 = res2.rows[0].id;
      await client.query(`INSERT INTO bundle_questions (bundle_id, q, options, correct) VALUES ($1,$2,$3,$4)`, [bid2, 'מהי ריבית?', ['תשלום על הלוואה','סוג דיווח','מס פרטי'], 0]);
    }

    // seed products table if empty — create >900 entries
    const { rows: prodCountRows } = await client.query(`SELECT count(*)::int AS c FROM products`);
    const prodCount = parseInt(prodCountRows[0].c, 10);
    if (prodCount < 900) {
      // base categories and items (same as demo)
      const PRODUCT_CATS = {
        "ירקות ופירות 🍎": ["עגבניה","מלפפון","גזר","בצל","תפוח","בננה","מנדרינה","תפוז","חסה"],
        "מעדניות": ["גבינה צהובה","גבינת מוצרלה","יוגורט","חמאה"],
        "מזון בסיסי": ["קמח","סוכר","אורז","פסטה","קטניות"],
        "משקאות": ["מיץ תפוזים","מים מינרליים","קפה","תה"],
        "ניקיון": ["סבון כלים","נוזל כביסה","מגבונים","נוזל רחצה"],
        "חטיפים": ["עוגיות","שוקולד","חטיפי אנרגיה"],
        "מאפים": ["לחם","בייגל","קרואסון"]
      };
      // insert programmatically until we have ~920 items
      const base = [];
      Object.entries(PRODUCT_CATS).forEach(([cat, items]) => {
        items.forEach(it => base.push({ name: it, category: cat }));
      });
      let k = 0;
      const toInsert = [];
      while (prodCount + toInsert.length < 920) {
        const pick = base[k % base.length];
        const suffix = Math.floor(k / base.length) + 1;
        toInsert.push([`${pick.name} ${suffix}`, pick.category]);
        k++;
      }
      // bulk insert in batches
      const batchSize = 200;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const slice = toInsert.slice(i, i + batchSize);
        const values = [];
        const params = [];
        slice.forEach((r, idx) => {
          values.push(`($${idx*2+1}, $${idx*2+2})`);
          params.push(r[0], r[1]);
        });
        const q = `INSERT INTO products (name, category) VALUES ${values.join(',')}`;
        await client.query(q, params);
      }
      console.log('Seeded products table with demo items (~920 entries).');
    }

    await client.query('COMMIT');
  } catch (err) {
    console.error('Error ensuring schema/seed:', err);
    await client.query('ROLLBACK').catch(()=>{});
  } finally {
    client.release();
  }
}

/* Initialize DB/schema */
(async () => {
  try {
    await ensureSchemaAndSeed();
    app.listen(PORT, () => {
      console.log(`Oneflow Life API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize DB or start server', err);
    process.exit(1);
  }
})();

/* -------------------------
   Helper DB wrappers (use pool when possible)
   ------------------------- */

async function dbQuery(q, params=[]) {
  if (!useDb) throw new Error('DB not available');
  const res = await pool.query(q, params);
  return res;
}

/* -------------------------
   API Endpoints
   ------------------------- */

/* Minimal user lookup */
app.get('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!useDb) {
      const u = fallback.users.find(x => x.id === id);
      if (!u) return res.status(404).json({ error: 'not found' });
      return res.json(u);
    }
    const r = await dbQuery('SELECT * FROM users WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

/* Data envelope for dashboard */
app.get('/api/data/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  try {
    if (!useDb) {
      const user = fallback.users.find(u => u.id === userId);
      return res.json({ user, shopping_list: fallback.shoppingList, tasks: [], weekly_stats: { spent: 0, limit: 0 }, quiz_bundles: fallback.bundles });
    }

    // user
    const ru = await dbQuery('SELECT * FROM users WHERE id = $1', [userId]);
    if (ru.rowCount === 0) return res.status(404).json({ error: 'user not found' });
    const user = ru.rows[0];

    // shopping list
    const sl = await dbQuery('SELECT * FROM shopping_list ORDER BY id DESC', []);
    const shopping_list = sl.rows;

    // bundles with questions
    const bRes = await dbQuery('SELECT id, title, reward, threshold FROM bundles ORDER BY id ASC');
    const bundles = [];
    for (const b of bRes.rows) {
      const qRes = await dbQuery('SELECT q, options, correct FROM bundle_questions WHERE bundle_id = $1', [b.id]);
      bundles.push(Object.assign({}, b, { questions: qRes.rows }));
    }

    res.json({
      user,
      shopping_list,
      tasks: [],
      weekly_stats: { spent: 0, limit: 0 },
      quiz_bundles: bundles
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

/* SHOPPING: add item */
app.post('/api/shopping/add', async (req, res) => {
  const { itemName, quantity = 1, userId, estPrice = null } = req.body;
  if (!itemName || !userId) return res.status(400).json({ success: false, msg: 'missing' });
  try {
    if (!useDb) {
      const requester = fallback.users.find(u => u.id === Number(userId)) || { id: userId, nickname: 'מישהו' };
      const newItem = { id: fallbackId(), item_name: itemName, quantity: Number(quantity), requester_id: requester.id, requester_name: requester.nickname, status: 'pending', est_price: estPrice };
      fallback.shoppingList.push(newItem);
      return res.json({ success: true, item: newItem, alert: null });
    }
    // Get requester nickname if possible
    const ru = await dbQuery('SELECT nickname FROM users WHERE id = $1', [userId]);
    const nick = ru.rowCount ? ru.rows[0].nickname : 'מישהו';
    const q = `INSERT INTO shopping_list (item_name, quantity, requester_id, requester_name, status, est_price) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    const r = await dbQuery(q, [itemName, Number(quantity), Number(userId), nick, 'pending', estPrice]);
    res.json({ success: true, item: r.rows[0], alert: null });
  } catch (e) { console.error(e); res.status(500).json({ success: false, msg: 'error' }); }
});

/* SHOPPING: update status or delete */
app.post('/api/shopping/update', async (req, res) => {
  const { itemId, status } = req.body;
  if (!itemId) return res.status(400).json({ success: false });
  try {
    if (!useDb) {
      if (status === 'deleted') fallback.shoppingList = fallback.shoppingList.filter(x => x.id !== Number(itemId));
      else {
        const it = fallback.shoppingList.find(x => x.id === Number(itemId));
        if (it) it.status = status;
      }
      return res.json({ success: true });
    }
    if (status === 'deleted') {
      await dbQuery('DELETE FROM shopping_list WHERE id = $1', [Number(itemId)]);
    } else {
      await dbQuery('UPDATE shopping_list SET status = $1 WHERE id = $2', [status, Number(itemId)]);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* SHOPPING: checkout */
app.post('/api/shopping/checkout', async (req, res) => {
  const { totalAmount = 0, userId, storeName = 'סופר', boughtItems = [], missingItems = [] } = req.body;
  try {
    if (!useDb) {
      // fallback: create history object
      const user = fallback.users.find(u => u.id === Number(userId)) || { id: userId, nickname: 'מישהו', balance: 0 };
      const trip = { id: fallbackId(), groupId: fallback.groups[0]?.id || 1, store_name: storeName, trip_date: new Date().toISOString(), nickname: user.nickname, total_amount: Number(totalAmount || 0), items: boughtItems.map(b => ({ item_name: b.name, quantity: b.quantity, price: b.price })) };
      fallback.shoppingHistory.unshift(trip);
      const boughtIds = new Set(boughtItems.map(b => Number(b.id)));
      fallback.shoppingList = fallback.shoppingList.filter(it => !boughtIds.has(it.id));
      missingItems.forEach(m => { const itm = fallback.shoppingList.find(x => x.id === Number(m.id)); if (itm) itm.status = 'pending'; });
      if (user) user.balance = Number(user.balance || 0) - Number(trip.total_amount || 0);
      return res.json({ success: true, trip });
    }

    // Insert into shopping_history
    const insertTrip = await dbQuery('INSERT INTO shopping_history (group_id, store_name, trip_date, nickname, total_amount) VALUES ($1,$2,$3,$4,$5) RETURNING id', [1, storeName, new Date().toISOString(), 'מישהו', Number(totalAmount)]);
    const tripId = insertTrip.rows[0].id;
    for (const b of boughtItems) {
      await dbQuery('INSERT INTO shopping_history_items (history_id, item_name, quantity, price) VALUES ($1,$2,$3,$4)', [tripId, b.name, b.quantity || 1, b.price || 0]);
    }
    // Remove bought items from shopping_list
    const boughtIds = boughtItems.map(b => Number(b.id));
    if (boughtIds.length > 0) {
      const placeholders = boughtIds.map((_,i)=>`$${i+1}`).join(',');
      await dbQuery(`DELETE FROM shopping_list WHERE id IN (${placeholders})`, boughtIds);
    }
    // Update missing items to pending
    for (const m of missingItems) {
      await dbQuery('UPDATE shopping_list SET status = $1 WHERE id = $2', ['pending', Number(m.id)]);
    }
    // adjust user balance (simple)
    if (userId) {
      await dbQuery('UPDATE users SET balance = balance - $1 WHERE id = $2', [Number(totalAmount || 0), Number(userId)]);
    }
    res.json({ success: true, trip: { id: tripId } });
  } catch (e) { console.error(e); res.status(500).json({ success: false, msg: 'server' }); }
});

/* SHOPPING: history */
app.get('/api/shopping/history', async (req, res) => {
  const groupId = Number(req.query.groupId || 1);
  try {
    if (!useDb) {
      return res.json(fallback.shoppingHistory);
    }
    const trips = await dbQuery('SELECT * FROM shopping_history WHERE group_id = $1 ORDER BY trip_date DESC', [groupId]);
    const out = [];
    for (const t of trips.rows) {
      const items = (await dbQuery('SELECT item_name, quantity, price FROM shopping_history_items WHERE history_id = $1', [t.id])).rows;
      out.push(Object.assign({}, t, { items }));
    }
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

/* SHOPPING: copy trip into shopping list */
app.post('/api/shopping/copy', async (req, res) => {
  const { tripId, userId } = req.body;
  try {
    if (!useDb) {
      const trip = fallback.shoppingHistory.find(t => t.id === Number(tripId));
      const user = fallback.users.find(u => u.id === Number(userId)) || { id: userId, nickname: 'מישהו' };
      if (!trip) return res.status(404).json({ success: false });
      trip.items.forEach(it => fallback.shoppingList.push({ id: fallbackId(), item_name: it.item_name, quantity: it.quantity || 1, requester_id: user.id, requester_name: user.nickname, status: 'pending' }));
      return res.json({ success: true });
    }
    // fetch trip items
    const items = (await dbQuery('SELECT item_name, quantity FROM shopping_history_items WHERE history_id = $1', [Number(tripId)])).rows;
    // find user's nickname
    const ru = await dbQuery('SELECT nickname FROM users WHERE id = $1', [Number(userId)]);
    const nick = ru.rowCount ? ru.rows[0].nickname : 'מישהו';
    for (const it of items) {
      await dbQuery('INSERT INTO shopping_list (item_name, quantity, requester_id, requester_name, status) VALUES ($1,$2,$3,$4,$5)', [it.item_name, it.quantity || 1, Number(userId), nick, 'pending']);
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* ACADEMY endpoints */
app.get('/api/academy/bundles', async (req, res) => {
  try {
    if (!useDb) return res.json(fallback.bundles || []);
    const bRes = await dbQuery('SELECT id, title, reward, threshold FROM bundles ORDER BY id ASC');
    const bundlesOut = [];
    for (const b of bRes.rows) {
      const qRes = await dbQuery('SELECT q, options, correct FROM bundle_questions WHERE bundle_id = $1', [b.id]);
      bundlesOut.push(Object.assign({}, b, { questions: qRes.rows }));
    }
    res.json(bundlesOut);
  } catch (e) { console.error(e); res.status(500).json([]); }
});

app.post('/api/academy/submit', async (req, res) => {
  const { userId, bundleId, score, reward } = req.body;
  try {
    if (!useDb) {
      const u = fallback.users.find(x => x.id === Number(userId));
      if (!u) return res.status(404).json({ success: false });
      u.balance = Number(u.balance || 0) + Number(reward || 0);
      return res.json({ success: true, newBalance: u.balance });
    }
    await dbQuery('UPDATE users SET balance = balance + $1 WHERE id = $2', [Number(reward || 0), Number(userId)]);
    const nr = (await dbQuery('SELECT balance FROM users WHERE id = $1', [Number(userId)])).rows[0];
    res.json({ success: true, newBalance: nr.balance });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

/* PRODUCTS (autocomplete/search) */
app.get('/api/products/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  try {
    if (!q) return res.json([]);
    if (!useDb) {
      // fallback search in generated list (we didn't generate full list here for fallback)
      return res.json([]);
    }
    const r = await dbQuery(`SELECT name, category FROM products WHERE LOWER(name) LIKE $1 LIMIT 30`, [`%${q}%`]);
    res.json(r.rows.map(rw => ({ name: rw.name, category: rw.category })));
  } catch (e) { console.error(e); res.status(500).json([]); }
});

/* Root */
app.get('/api/ping', (req, res) => res.json({ ok: true }));

/* Fallback static route (for browser refreshes - serve index.html) */
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not Found');
});
