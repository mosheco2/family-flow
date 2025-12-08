const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const { authenticateToken, requireOwnerOrAdmin } = require('../middleware/auth');
const { hashPassword } = require('../services/authService');

function createClient() { return new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); }

// GET /api/users/:id
router.get('/users/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  const client = createClient(); await client.connect();
  try {
    const ures = await client.query('SELECT id, nickname, role, status, birth_year, balance, group_id FROM users WHERE id=$1', [id]);
    if (ures.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = ures.rows[0];
    if (req.user.role !== 'ADMIN' && req.user.id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.end(); }
});

// PUT /api/users/:id  (update profile)
router.put('/users/:id', authenticateToken, requireOwnerOrAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { nickname, birth_year, password } = req.body || {};
  if (!nickname && !birth_year && !password) return res.status(400).json({ error: 'Nothing to update' });
  const client = createClient(); await client.connect();
  try {
    if (nickname) await client.query('UPDATE users SET nickname=$1 WHERE id=$2', [nickname, id]);
    if (birth_year !== undefined) await client.query('UPDATE users SET birth_year=$1 WHERE id=$2', [birth_year, id]);
    if (password) {
      const hashed = await hashPassword(password);
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashed, id]);
    }
    const ures = await client.query('SELECT id, nickname, role, status, birth_year, balance FROM users WHERE id=$1', [id]);
    res.json({ success: true, user: ures.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.end(); }
});

// GET /api/group/members?groupId=123
router.get('/group/members', authenticateToken, async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: 'Missing groupId' });
  const client = createClient(); await client.connect();
  try {
    if (req.user.role !== 'ADMIN' && req.user.group_id !== groupId) return res.status(403).json({ error: 'Forbidden' });
    const r = await client.query("SELECT id, nickname, role, balance, allowance_amount, interest_rate FROM users WHERE group_id=$1 AND status='ACTIVE'", [groupId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.end(); }
});

module.exports = router;