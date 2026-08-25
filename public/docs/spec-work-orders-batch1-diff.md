# Work Orders Batch 1 — diff לאישור — 10 endpoints
מסמך עבודה · OneFlow Life · 25.08.2026

---

## חלוקת 30 endpoints ל-3 batches (10+10+10)

**Batch 1 (10):** קבוצה A שלמה (9 × groupId ישיר) + convert/:quoteId
**Batch 2 (10):** קבוצה B #11-#20 (work order ownership, חלק א')
**Batch 3 (10):** קבוצה B #21-#28 + קבוצה C #29-#30 (ownership + payments)

---

## pattern אחיד ל-9 endpoints של קבוצה A

```js
// שורה 1 — middleware:
app.METHOD('/api/work-orders/.../:groupId', verifyBiz, async (req, res) => {
// שורה 2 — IDOR check (ראשונה בתוך try):
    if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #1 — GET /api/work-orders/:businessGroupId (שורה 10545)

```diff
-app.get('/api/work-orders/:businessGroupId', async (req, res) => {
+app.get('/api/work-orders/:businessGroupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.businessGroupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(`SELECT sc.*, fg.name as family_name
```

---

## #2 — GET /api/work-orders/list/:groupId (שורה 18793)

```diff
-app.get('/api/work-orders/list/:groupId', async (req, res) => {
+app.get('/api/work-orders/list/:groupId', verifyBiz, async (req, res) => {
     try {
         const { status } = req.query;
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         let q = `SELECT so.*,
```

---

## #3 — GET /api/work-orders/profitability/:groupId (שורה 18809)

```diff
-app.get('/api/work-orders/profitability/:groupId', async (req, res) => {
+app.get('/api/work-orders/profitability/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(`
```

---

## #4 — POST /api/work-orders/new/:groupId (שורה 18828)

```diff
-app.post('/api/work-orders/new/:groupId', async (req, res) => {
+app.post('/api/work-orders/new/:groupId', verifyBiz, async (req, res) => {
     try {
         const { customer_name, customer_phone, title, notes } = req.body;
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #5 — GET /api/work-orders/users/:groupId (שורה 18896)

```diff
-app.get('/api/work-orders/users/:groupId', async (req, res) => {
+app.get('/api/work-orders/users/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(`SELECT id, nickname as name, employee_role_type, role FROM users WHERE group_id=$1 ORDER BY nickname`, [req.params.groupId]);
```

---

## #6 — GET /api/work-orders/catalog/:groupId (שורה 18939)

```diff
-app.get('/api/work-orders/catalog/:groupId', async (req, res) => {
+app.get('/api/work-orders/catalog/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #7 — GET /api/work-orders/purchase-orders/group/:groupId (שורה 19226)

```diff
-app.get('/api/work-orders/purchase-orders/group/:groupId', async (req, res) => {
+app.get('/api/work-orders/purchase-orders/group/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #8 — GET /api/work-orders/collection/:groupId (שורה 19753)

```diff
-app.get('/api/work-orders/collection/:groupId', async (req, res) => {
+app.get('/api/work-orders/collection/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #9 — GET /api/work-orders/collection-alerts/:groupId (שורה 19788)

```diff
-app.get('/api/work-orders/collection-alerts/:groupId', async (req, res) => {
+app.get('/api/work-orders/collection-alerts/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #10 — POST /api/work-orders/convert/:quoteId (שורה 18763)

⚠️ **מיוחד:** quoteId הוא store_orders.id. אין groupId ב-params.
ownership check: `SELECT 1 FROM store_orders WHERE id=$quoteId AND group_id=$2`

```diff
-app.post('/api/work-orders/convert/:quoteId', async (req, res) => {
+app.post('/api/work-orders/convert/:quoteId', verifyBiz, async (req, res) => {
     try {
         const { userName } = req.body;
         const quoteId = req.params.quoteId;
+        const _chk = await pool.query('SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2', [quoteId, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
             `UPDATE store_orders SET call_type='work_order', status='processing', quote_status='approved'
```

---

## סיכום Batch 1

| # | שורה | method | path | שינוי |
|---|---|---|---|---|
| 1 | 10545 | GET | /work-orders/:businessGroupId | middleware + IDOR param |
| 2 | 18793 | GET | /work-orders/list/:groupId | middleware + IDOR param |
| 3 | 18809 | GET | /work-orders/profitability/:groupId | middleware + IDOR param |
| 4 | 18828 | POST | /work-orders/new/:groupId | middleware + IDOR param |
| 5 | 18896 | GET | /work-orders/users/:groupId | middleware + IDOR param |
| 6 | 18939 | GET | /work-orders/catalog/:groupId | middleware + IDOR param |
| 7 | 19226 | GET | /work-orders/purchase-orders/group/:groupId | middleware + IDOR param |
| 8 | 19753 | GET | /work-orders/collection/:groupId | middleware + IDOR param |
| 9 | 19788 | GET | /work-orders/collection-alerts/:groupId | middleware + IDOR param |
| 10 | 18763 | POST | /work-orders/convert/:quoteId | middleware + SQL ownership |

**#1-#9:** כל אחד +2 שורות. ללא שינוי לוגיקה.
**#10:** middleware + 2 שורות SQL ownership. הUPDATE הקיים נשמר ללא שינוי.

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
