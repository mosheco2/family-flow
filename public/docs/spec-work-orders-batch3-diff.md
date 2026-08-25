# Work Orders Batch 3 — diff לאישור — 10 endpoints (האחרון)
מסמך עבודה · OneFlow Life · 25.08.2026

---

## patterns

**קבוצה B (notes, timeline, purchase-orders, payments):**
```js
const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

**#23 ו-#25 (groupId בbody) — שני אימותים:**
```js
if (parseInt(groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
// + ownership על :id
```

**קבוצה C (paymentId) — ownership דרך JOIN:**
```js
const pr = await pool.query(
    `SELECT wop.work_order_id, wop.service_call_id,
            so.group_id as wo_group, sc.business_group_id as sc_group
     FROM work_order_payments wop
     LEFT JOIN store_orders so ON so.id=wop.work_order_id
     LEFT JOIN service_calls sc ON sc.id=wop.service_call_id
     WHERE wop.id=$1`, [req.params.paymentId]);
if (!pr.rows.length) return res.status(404).json({ error: 'תחנת תשלום לא נמצאה' });
const ownerGroup = pr.rows[0].wo_group || pr.rows[0].sc_group;
if (ownerGroup !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #21 — PUT /api/work-orders/:id/notes (שורה 19124)

```diff
-app.put('/api/work-orders/:id/notes', async (req, res) => {
+app.put('/api/work-orders/:id/notes', verifyBiz, async (req, res) => {
     try {
         const { notes, updatedBy } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('UPDATE store_orders SET wo_notes=$1, wo_notes_updated_at=NOW(), wo_notes_updated_by=$2 WHERE id=$3',
```

---

## #22 — GET /api/work-orders/:id/timeline (שורה 19134)

```diff
-app.get('/api/work-orders/:id/timeline', async (req, res) => {
+app.get('/api/work-orders/:id/timeline', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM work_order_timeline WHERE work_order_id=$1 ORDER BY created_at DESC', [req.params.id]);
```

---

## #23 — POST /api/work-orders/:id/calendar (שורה 19141)

⚠️ שני אימותים: body.groupId + work order ownership על :id.

```diff
-app.post('/api/work-orders/:id/calendar', async (req, res) => {
+app.post('/api/work-orders/:id/calendar', verifyBiz, async (req, res) => {
     try {
         const { groupId, title, eventDate, startTime, customerName, address, assigneeIds, notes } = req.body;
+        if (parseInt(groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #24 — GET /api/work-orders/:id/purchase-orders (שורה 19155)

```diff
-app.get('/api/work-orders/:id/purchase-orders', async (req, res) => {
+app.get('/api/work-orders/:id/purchase-orders', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
             `SELECT po.*, s.name as supplier_name
```

---

## #25 — POST /api/work-orders/:id/purchase-orders (שורה 19168)

⚠️ שני אימותים: body.groupId + work order ownership על :id.

```diff
-app.post('/api/work-orders/:id/purchase-orders', async (req, res) => {
+app.post('/api/work-orders/:id/purchase-orders', verifyBiz, async (req, res) => {
     try {
         const { groupId, supplierId, supplierName, items, notes, userName } = req.body;
         if (!items || !items.length) return res.status(400).json({ error: 'נדרשים פריטים להזמנה' });
+        if (parseInt(groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const totalAmount = items.reduce((s, i) => s + (parseFloat(i.unit_price || 0) * parseFloat(i.quantity || 1)), 0);
```

---

## #26 — PATCH /api/work-orders/:id/purchase-orders/:poId/status (שורה 19200)

ה-SQL הקיים: `WHERE id=$poId AND work_order_id=$id` — ownership על :id מגן על :poId.

```diff
-app.patch('/api/work-orders/:id/purchase-orders/:poId/status', async (req, res) => {
+app.patch('/api/work-orders/:id/purchase-orders/:poId/status', verifyBiz, async (req, res) => {
     try {
         const { status, userName } = req.body;
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(`UPDATE purchase_orders SET status=$1 WHERE id=$2 AND work_order_id=$3`, [status, req.params.poId, req.params.id]);
```

---

## #27 — GET /api/work-orders/:id/payments (שורה 19275)

```diff
-app.get('/api/work-orders/:id/payments', async (req, res) => {
+app.get('/api/work-orders/:id/payments', verifyBiz, async (req, res) => {
     try {
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
             `SELECT * FROM work_order_payments WHERE work_order_id=$1 ORDER BY due_date ASC NULLS LAST, created_at ASC`,
```

---

## #28 — POST /api/work-orders/:id/payments (שורה 19285)

```diff
-app.post('/api/work-orders/:id/payments', async (req, res) => {
+app.post('/api/work-orders/:id/payments', verifyBiz, async (req, res) => {
     try {
         const { milestoneName, amount, dueDate, paymentMethod, totalAmount } = req.body;
         if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'סכום נדרש' });
+        const _wo = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2 AND call_type=\'work_order\'', [req.params.id, req.bizAuth.groupId]);
+        if (!_wo.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         // קבע סכום עסקה כוללת
```

---

## #29 — PATCH /api/work-orders/payments/:paymentId/receive (שורה 19312)

⚠️ קבוצה C: ownership דרך JOIN. הקוד הקיים כבר מביא את `pr` — **מוסיפים verifyBiz + ownership check לפני הלוגיקה הקיימת**.

```diff
-app.patch('/api/work-orders/payments/:paymentId/receive', async (req, res) => {
+app.patch('/api/work-orders/payments/:paymentId/receive', verifyBiz, async (req, res) => {
     try {
         const { receivedAmount, receivedAt, userName } = req.body;
-        const pr = await pool.query('SELECT * FROM work_order_payments WHERE id=$1', [req.params.paymentId]);
-        if (!pr.rows.length) return res.status(404).json({ error: 'תחנת תשלום לא נמצאה' });
-        const p = pr.rows[0];
+        const pr = await pool.query(
+            `SELECT wop.*, so.group_id as wo_group, sc.business_group_id as sc_group
+             FROM work_order_payments wop
+             LEFT JOIN store_orders so ON so.id=wop.work_order_id
+             LEFT JOIN service_calls sc ON sc.id=wop.service_call_id
+             WHERE wop.id=$1`, [req.params.paymentId]);
+        if (!pr.rows.length) return res.status(404).json({ error: 'תחנת תשלום לא נמצאה' });
+        const p = pr.rows[0];
+        const ownerGroup = p.wo_group || p.sc_group;
+        if (ownerGroup !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const recAmt = parseFloat(receivedAmount) || parseFloat(p.amount);
```

הערה: השאילתה המורחבת מחזירה את כל עמודות `wop.*` + ownership fields — אין צורך בשאילתה נוספת, כל הלוגיקה הקיימת שמשתמשת ב-`p` עובדת ללא שינוי.

---

## #30 — DELETE /api/work-orders/payments/:paymentId (שורה 19366)

⚠️ קבוצה C: ownership דרך JOIN. הקוד הקיים כבר מביא `pr` בשורה הראשונה — **מרחיבים את ה-query ומוסיפים ownership check**.

```diff
-app.delete('/api/work-orders/payments/:paymentId', async (req, res) => {
+app.delete('/api/work-orders/payments/:paymentId', verifyBiz, async (req, res) => {
     try {
-        const pr = await pool.query('SELECT work_order_id, service_call_id FROM work_order_payments WHERE id=$1', [req.params.paymentId]);
-        if (!pr.rows.length) return res.status(404).json({ error: 'לא נמצא' });
-        const { work_order_id: woId, service_call_id: scId } = pr.rows[0];
+        const pr = await pool.query(
+            `SELECT wop.work_order_id, wop.service_call_id,
+                    so.group_id as wo_group, sc.business_group_id as sc_group
+             FROM work_order_payments wop
+             LEFT JOIN store_orders so ON so.id=wop.work_order_id
+             LEFT JOIN service_calls sc ON sc.id=wop.service_call_id
+             WHERE wop.id=$1`, [req.params.paymentId]);
+        if (!pr.rows.length) return res.status(404).json({ error: 'לא נמצא' });
+        const { work_order_id: woId, service_call_id: scId } = pr.rows[0];
+        const ownerGroup = pr.rows[0].wo_group || pr.rows[0].sc_group;
+        if (ownerGroup !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('DELETE FROM work_order_payments WHERE id=$1', [req.params.paymentId]);
```

הערה: `woId` ו-`scId` ממשיכים לעבוד ללא שינוי — כל הלוגיקה שאחרי DELETE נשמרת.

---

## סיכום Batch 3

| # | שורה | method | path | ownership |
|---|---|---|---|---|
| 21 | 19124 | PUT | /work-orders/:id/notes | store_orders.id + group_id |
| 22 | 19134 | GET | /work-orders/:id/timeline | store_orders.id + group_id |
| 23 | 19141 | POST | /work-orders/:id/calendar | body.groupId + store_orders.id |
| 24 | 19155 | GET | /work-orders/:id/purchase-orders | store_orders.id + group_id |
| 25 | 19168 | POST | /work-orders/:id/purchase-orders | body.groupId + store_orders.id |
| 26 | 19200 | PATCH | /work-orders/:id/purchase-orders/:poId/status | store_orders.id + group_id |
| 27 | 19275 | GET | /work-orders/:id/payments | store_orders.id + group_id |
| 28 | 19285 | POST | /work-orders/:id/payments | store_orders.id + group_id |
| 29 | 19312 | PATCH | /work-orders/payments/:paymentId/receive | JOIN ownership (wo+sc) |
| 30 | 19366 | DELETE | /work-orders/payments/:paymentId | JOIN ownership (wo+sc) |

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
סיום מלא: 142 endpoints מאובטחים.
