# Beauty Batch 1 — diff לאישור — 10 endpoints (BIZ_A #1-#10)
מסמך עבודה · OneFlow Life · 25.08.2026

---

## pattern אחיד לBatch 1

```js
// שורה 1 — middleware:
app.METHOD('/api/beauty/:bizId/...', verifyBiz, async (req, res) => {
// שורה 2 — IDOR check:
    if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

PATCH/POST עם :id משני — ה-SQL הקיים כבר מסנן `AND business_group_id=$bizId`, ownership על bizId מגן על :id.

---

## #1 — GET /api/beauty/:bizId/practitioners (שורה 21582)

```diff
-app.get('/api/beauty/:bizId/practitioners', async (req, res) => {
+app.get('/api/beauty/:bizId/practitioners', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
             'SELECT * FROM beauty_practitioners WHERE business_group_id=$1 AND is_active=TRUE ORDER BY display_name',
```

---

## #2 — POST /api/beauty/:bizId/practitioners (שורה 21592)

```diff
-app.post('/api/beauty/:bizId/practitioners', async (req, res) => {
+app.post('/api/beauty/:bizId/practitioners', verifyBiz, async (req, res) => {
     try {
         const { display_name, tier, color_hex, specializations, schedule_override, commission_rate_svc, commission_rate_retail } = req.body;
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #3 — PATCH /api/beauty/:bizId/practitioners/:id (שורה 21606)

SQL קיים: `WHERE id=$id AND business_group_id=$bizId` — bizId check מגן על :id.

```diff
-app.patch('/api/beauty/:bizId/practitioners/:id', async (req, res) => {
+app.patch('/api/beauty/:bizId/practitioners/:id', verifyBiz, async (req, res) => {
     try {
         const fields = ['display_name','tier','color_hex','specializations','schedule_override','commission_rate_svc','commission_rate_retail','is_active'];
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const sets = []; const vals = [];
```

---

## #4 — GET /api/beauty/:bizId/resources (שורה 21619)

```diff
-app.get('/api/beauty/:bizId/resources', async (req, res) => {
+app.get('/api/beauty/:bizId/resources', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM beauty_resources WHERE business_group_id=$1 AND is_active=TRUE ORDER BY name', [req.params.bizId]);
```

---

## #5 — POST /api/beauty/:bizId/resources (שורה 21626)

```diff
-app.post('/api/beauty/:bizId/resources', async (req, res) => {
+app.post('/api/beauty/:bizId/resources', verifyBiz, async (req, res) => {
     try {
         const { name, resource_type, color_hex } = req.body;
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
```

---

## #6 — PATCH /api/beauty/:bizId/resources/:id (שורה 21637)

SQL קיים: `WHERE id=$id AND business_group_id=$bizId`.

```diff
-app.patch('/api/beauty/:bizId/resources/:id', async (req, res) => {
+app.patch('/api/beauty/:bizId/resources/:id', verifyBiz, async (req, res) => {
     try {
         const { name, resource_type, color_hex, is_active } = req.body;
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(
```

---

## #7 — GET /api/beauty/:bizId/appointments (שורה 21649)

```diff
-app.get('/api/beauty/:bizId/appointments', async (req, res) => {
+app.get('/api/beauty/:bizId/appointments', verifyBiz, async (req, res) => {
     try {
         const { from, to, practitioner_id, resource_id, status } = req.query;
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         let where = 'ba.business_group_id=$1';
```

---

## #8 — PATCH /api/beauty/:bizId/appointments/:id (שורה 21797)

SQL קיים: `WHERE id=$id AND business_group_id=$bizId`.

```diff
-app.patch('/api/beauty/:bizId/appointments/:id', async (req, res) => {
+app.patch('/api/beauty/:bizId/appointments/:id', verifyBiz, async (req, res) => {
     try {
         const { status, notes, internal_notes, deposit_paid, date, time, duration_minutes, service_name } = req.body;
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const hasPracKey = Object.prototype.hasOwnProperty.call(req.body, 'practitioner_id');
```

---

## #9 — POST /api/beauty/:bizId/appointments/:id/complete (שורה 21852)

SQL קיים: `WHERE id=$id AND business_group_id=$bizId`.

```diff
-app.post('/api/beauty/:bizId/appointments/:id/complete', async (req, res) => {
+app.post('/api/beauty/:bizId/appointments/:id/complete', verifyBiz, async (req, res) => {
     const client = await pool.connect();
     try {
         await client.query('BEGIN');
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) { client.release(); return res.status(403).json({ error: 'אין הרשאה' }); }
         await client.query(
             'UPDATE beauty_appointments SET status=$1, updated_at=NOW() WHERE id=$2 AND business_group_id=$3',
```

הערה: pool.connect() כבר קרה לפני ה-try. מוסיפים `client.release()` לפני ה-return של 403 כדי לא להדליף connection.

---

## #10 — POST /api/beauty/:bizId/appointments/:id/no-show (שורה 21932)

SQL קיים: `WHERE id=$id AND business_group_id=$bizId`.

```diff
-app.post('/api/beauty/:bizId/appointments/:id/no-show', async (req, res) => {
+app.post('/api/beauty/:bizId/appointments/:id/no-show', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.bizId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query(
             'UPDATE beauty_appointments SET status=$1, updated_at=NOW() WHERE id=$2 AND business_group_id=$3',
```

---

## סיכום Batch 1

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 1 | 21582 | GET | /beauty/:bizId/practitioners | |
| 2 | 21592 | POST | /beauty/:bizId/practitioners | |
| 3 | 21606 | PATCH | /beauty/:bizId/practitioners/:id | SQL מסנן :id |
| 4 | 21619 | GET | /beauty/:bizId/resources | |
| 5 | 21626 | POST | /beauty/:bizId/resources | |
| 6 | 21637 | PATCH | /beauty/:bizId/resources/:id | SQL מסנן :id |
| 7 | 21649 | GET | /beauty/:bizId/appointments | |
| 8 | 21797 | PATCH | /beauty/:bizId/appointments/:id | SQL מסנן :id |
| 9 | 21852 | POST | /beauty/:bizId/appointments/:id/complete | pool.connect לפני try — client.release() ב-403 |
| 10 | 21932 | POST | /beauty/:bizId/appointments/:id/no-show | SQL מסנן :id |

**#1-#8, #10:** כל אחד +2 שורות. ללא שינוי לוגיקה.
**#9:** +2 שורות, עם `client.release()` מפורש ב-403 (connection leak prevention).

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
