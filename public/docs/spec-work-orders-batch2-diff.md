# Work Orders Batch 2 — diff לאישור — 10 endpoints
מסמך עבודה · OneFlow Life · 25.08.2026

---

## pattern אחיד לקבוצה B

ownership check דרך store_orders:
```js
const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

**הערה על /:id/inventory ו-/:id/inventory/:resId/*** — ה-SQL הקיים כבר מסנן `AND work_order_id=$id`, כך שמספיק לאמת ownership על :id.

**הערה על #13 (woId/cost)** — ownership על :woId (store_orders.id), אין group_id ישיר ב-work_order_assignees.

---

## #11 — GET /api/work-orders/detail/:id (שורה 18839)

```diff
-app.get('/api/work-orders/detail/:id', async (req, res) => {
+app.get('/api/work-orders/detail/:id', verifyBiz, async (req, res) => {
     try {
         const id = req.params.id;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const [woRes, assigneesRes, inventoryRes, messagesRes, timelineRes, calendarRes] = await Promise.all([
```

---

## #12 — PUT /api/work-orders/:id/status (שורה 18861)

```diff
-app.put('/api/work-orders/:id/status', async (req, res) => {
+app.put('/api/work-orders/:id/status', verifyBiz, async (req, res) => {
     try {
         const { status, userName } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(`UPDATE store_orders SET status=$1 WHERE id=$2 AND call_type='work_order'`, [status, req.params.id]);
```

---

## #13 — PUT /api/work-orders/:woId/assignees/:userId/cost (שורה 11872)

ownership על :woId (store_orders.id).

```diff
-app.put('/api/work-orders/:woId/assignees/:userId/cost', async (req, res) => {
+app.put('/api/work-orders/:woId/assignees/:userId/cost', verifyBiz, async (req, res) => {
     try {
         const { hourlyRate, hoursWorked } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2', [req.params.woId, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(
             'UPDATE work_order_assignees SET hourly_rate=$1, hours_worked=$2 WHERE work_order_id=$3 AND user_id=$4',
```

---

## #14 — POST /api/work-orders/:id/assignees (שורה 18903)

```diff
-app.post('/api/work-orders/:id/assignees', async (req, res) => {
+app.post('/api/work-orders/:id/assignees', verifyBiz, async (req, res) => {
     try {
         const { userId, userName, assignedBy } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(
             'INSERT INTO work_order_assignees (work_order_id, user_id, user_name, assigned_by) VALUES ($1,$2,$3,$4) ON CONFLICT (work_order_id, user_id) DO NOTHING',
```

---

## #15 — DELETE /api/work-orders/:id/assignees/:userId (שורה 18930)

ה-SQL קיים כבר מסנן `AND user_id=$userId` — ownership על :id מספיק.

```diff
-app.delete('/api/work-orders/:id/assignees/:userId', async (req, res) => {
+app.delete('/api/work-orders/:id/assignees/:userId', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const aRes = await pool.query('SELECT user_name FROM work_order_assignees WHERE work_order_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
```

---

## #16 — POST /api/work-orders/:id/inventory (שורה 18990)

```diff
-app.post('/api/work-orders/:id/inventory', async (req, res) => {
+app.post('/api/work-orders/:id/inventory', verifyBiz, async (req, res) => {
     try {
         const { pantryId, catalogId, itemName, neededQty, qty, reservedBy, unitPrice } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const needed = parseFloat(neededQty || qty || 1);
```

---

## #17 — POST /api/work-orders/:id/inventory/:resId/use (שורה 19052)

ה-SQL קיים: `WHERE id=$resId AND work_order_id=$id` — ownership על :id מגן על :resId.

```diff
-app.post('/api/work-orders/:id/inventory/:resId/use', async (req, res) => {
+app.post('/api/work-orders/:id/inventory/:resId/use', verifyBiz, async (req, res) => {
     try {
         const { usedQty, userName } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const resRes = await pool.query('SELECT * FROM work_order_inventory WHERE id=$1 AND work_order_id=$2', [req.params.resId, req.params.id]);
```

---

## #18 — DELETE /api/work-orders/:id/inventory/:resId (שורה 19070)

ה-SQL קיים: `WHERE id=$resId AND work_order_id=$id` — ownership על :id מגן על :resId.

```diff
-app.delete('/api/work-orders/:id/inventory/:resId', async (req, res) => {
+app.delete('/api/work-orders/:id/inventory/:resId', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const resRes = await pool.query(`SELECT * FROM work_order_inventory WHERE id=$1 AND work_order_id=$2 AND status='reserved'`, [req.params.resId, req.params.id]);
```

---

## #19 — GET /api/work-orders/:id/messages (שורה 19086)

```diff
-app.get('/api/work-orders/:id/messages', async (req, res) => {
+app.get('/api/work-orders/:id/messages', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM work_order_messages WHERE work_order_id=$1 ORDER BY created_at', [req.params.id]);
```

---

## #20 — POST /api/work-orders/:id/messages (שורה 19093)

```diff
-app.post('/api/work-orders/:id/messages', async (req, res) => {
+app.post('/api/work-orders/:id/messages', verifyBiz, async (req, res) => {
     try {
         const { userId, userName, message } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## סיכום Batch 2

| # | שורה | method | path | ownership |
|---|---|---|---|---|
| 11 | 18839 | GET | /work-orders/detail/:id | store_orders.id + group_id |
| 12 | 18861 | PUT | /work-orders/:id/status | store_orders.id + group_id |
| 13 | 11872 | PUT | /work-orders/:woId/assignees/:userId/cost | store_orders.woId + group_id |
| 14 | 18903 | POST | /work-orders/:id/assignees | store_orders.id + group_id |
| 15 | 18930 | DELETE | /work-orders/:id/assignees/:userId | store_orders.id + group_id |
| 16 | 18990 | POST | /work-orders/:id/inventory | store_orders.id + group_id |
| 17 | 19052 | POST | /work-orders/:id/inventory/:resId/use | store_orders.id + group_id |
| 18 | 19070 | DELETE | /work-orders/:id/inventory/:resId | store_orders.id + group_id |
| 19 | 19086 | GET | /work-orders/:id/messages | store_orders.id + group_id |
| 20 | 19093 | POST | /work-orders/:id/messages | store_orders.id + group_id |

**כל endpoint: +2 שורות ownership check. ללא שינוי לוגיקה.**

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
