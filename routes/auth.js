const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const rateLimit = require('express-rate-limit');
const { hashPassword, comparePassword, issueAccessToken, issueRefreshToken, verifyRefreshToken } = require('../services/authService');

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, message: { error: 'Too many login attempts, try later' } });

function createClient() {
  return new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

function parseExpiryToMs(ex) {
  if (!ex) return 7 * 24 * 3600 * 1000;
  if (typeof ex === 'string' && ex.endsWith('m')) return parseInt(ex.slice(0, -1), 10) * 60 * 1000;
  if (typeof ex === 'string' && ex.endsWith('d')) return parseInt(ex.slice(0, -1), 10) * 24 * 3600 * 1000;
  return 7 * 24 * 3600 * 1000;
}

// POST /api/groups
router.post('/groups', async (req, res) => {
  const { groupName, adminEmail, adminNickname, password, type, birthYear } = req.body || {};
  if (!groupName || !adminEmail || !adminNickname || !password) return res.status(400).json({ error: 'Missing fields' });
  const client = createClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM groups WHERE admin_email = $1', [adminEmail.trim().toLowerCase()]);
    if (check.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Email exists' }); }
    const g = await client.query('INSERT INTO groups (name, admin_email, type) VALUES ($1, $2, $3) RETURNING id, name, admin_email', [groupName, adminEmail.trim().toLowerCase(), type || 'FAMILY']);
    const hashed = await hashPassword(password);
    const u = await client.query(`INSERT INTO users (group_id, nickname, password_hash, role, status, birth_year, balance) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4, 0) RETURNING id, nickname, role, status, birth_year, balance`, [g.rows[0].id, adminNickname, hashed, birthYear || null]);
    const cats = ['food', 'groceries', 'transport', 'bills', 'fun', 'clothes', 'health', 'education', 'other'];
    for (const c of cats) {
      await client.query(`INSERT INTO budgets (group_id, user_id, category, limit_amount) VALUES ($1, NULL, $2, 0) ON CONFLICT DO NOTHING`, [g.rows[0].id, c]);
    }
    await client.query('COMMIT');
    const payload = { id: u.rows[0].id, role: u.rows[0].role, group_id: g.rows[0].id };
    const accessToken = issueAccessToken(payload);
    const refreshToken = issueRefreshToken(payload);
    const maxAge = parseExpiryToMs(process.env.REFRESH_TOKEN_EXPIRES || '7d');
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge });
    res.json({ success: true, user: u.rows[0], group: g.rows[0], accessToken });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.end();
  }
});

// POST /api/join
router.post('/join', async (req, res) => {
  const { groupEmail, nickname, password, birthYear } = req.body || {};
  if (!groupEmail || !nickname || !password) return res.status(400).json({ error: 'Missing fields' });
  const client = createClient(); await client.connect();
  try {
    const g = await client.query('SELECT id FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const check = await client.query('SELECT id FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Nickname taken' });
    const hashed = await hashPassword(password);
    await client.query(`INSERT INTO users (group_id, nickname, password_hash, role, status, birth_year, balance) VALUES ($1, $2, $3, 'MEMBER', 'PENDING', $4, 0)`, [g.rows[0].id, nickname, hashed, birthYear || null]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.end(); }
});

// POST /api/login
router.post('/login', loginLimiter, async (req, res) => {
  const { groupEmail, nickname, password } = req.body || {};
  if (!groupEmail || !nickname || !password) return res.status(400).json({ error: 'Missing credentials' });
  const client = createClient(); await client.connect();
  try {
    const g = await client.query('SELECT * FROM groups WHERE admin_email = $1', [groupEmail.trim().toLowerCase()]);
    if (g.rows.length === 0) return res.status(401).json({ error: 'Group not found' });
    const ures = await client.query('SELECT * FROM users WHERE group_id = $1 AND LOWER(nickname) = LOWER($2)', [g.rows[0].id, nickname]);
    if (ures.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = ures.rows[0];
    let valid = false;
    if (user.password_hash) {
      valid = await comparePassword(password, user.password_hash);
    } else if (user.password) {
      valid = (password === user.password);
      if (valid) {
        const h = await hashPassword(password);
        await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [h, user.id]);
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'Account pending' });
    await client.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const payload = { id: user.id, role: user.role, group_id: user.group_id };
    const accessToken = issueAccessToken(payload);
    const refreshToken = issueRefreshToken(payload);
    const maxAge = parseExpiryToMs(process.env.REFRESH_TOKEN_EXPIRES || '7d');
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge });
    res.json({ success: true, user: { id: user.id, nickname: user.nickname, role: user.role, status: user.status, balance: user.balance }, group: g.rows[0], accessToken });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.end(); }
});

// POST /api/auth/refresh
router.post('/auth/refresh', async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  const payload = verifyRefreshToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid refresh token' });
  const accessToken = issueAccessToken({ id: payload.id, role: payload.role, group_id: payload.group_id });
  res.json({ accessToken });
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res) => {
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ success: true });
});

module.exports = router;