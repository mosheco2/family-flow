# Professional Batch 2 — diff לאישור — endpoints 13–19
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

המשך ישיר ל-Batch 1. שני patterns בbatch זה:

- **#13** — קבוצה A (groupId param): `parseInt(req.params.groupId) !== req.bizAuth.groupId`
- **#14–#19** — קבוצה B (record ownership): `SELECT 1 FROM TABLE WHERE id=$1 AND group_id=$2`

---

## #13 — GET /api/professional/dashboard/:groupId (~19640)
קבוצה A — עסק טוען נתוני dashboard שלו.
```diff
-app.get('/api/professional/dashboard/:groupId', async (req, res) => {
+app.get('/api/professional/dashboard/:groupId', verifyBiz, async (req, res) => {
     try {
         const gid = req.params.groupId;
+        if (parseInt(gid) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const safe = async (q, p) => { try { return await pool.query(q, p); } catch(e) { return { rows: [] }; } };
```

---

## #14 — PATCH /api/professional-expertise/:id (~19430)
קבוצה B — עסק עורך תחום מומחיות שלו בלבד.
```diff
-app.patch('/api/professional-expertise/:id', async (req, res) => {
+app.patch('/api/professional-expertise/:id', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_expertise WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const { icon, title_he, title_en, description_he, description_en } = req.body;
```

---

## #15 — DELETE /api/professional-expertise/:id (~19440)
קבוצה B — עסק מסיר תחום מומחיות שלו (soft delete: is_active=FALSE).
```diff
-app.delete('/api/professional-expertise/:id', async (req, res) => {
-    try { await pool.query('UPDATE professional_expertise SET is_active=FALSE WHERE id=$1', [req.params.id]); res.json({ success: true }); }
+app.delete('/api/professional-expertise/:id', verifyBiz, async (req, res) => {
+    try {
+        const _chk = await pool.query('SELECT 1 FROM professional_expertise WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
+        await pool.query('UPDATE professional_expertise SET is_active=FALSE WHERE id=$1', [req.params.id]); res.json({ success: true });
+    }
     catch(e) { res.status(500).json({ error: e.message }); }
 });
```

---

## #16 — PATCH /api/professional-articles/:id (~19466)
קבוצה B — עסק משנה סטטוס פרסום מאמר שלו.
```diff
-app.patch('/api/professional-articles/:id', async (req, res) => {
+app.patch('/api/professional-articles/:id', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_articles WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const { is_published } = req.body;
```

---

## #17 — DELETE /api/professional-articles/:id (~19473)
קבוצה B — עסק מוחק מאמר שלו.
```diff
-app.delete('/api/professional-articles/:id', async (req, res) => {
-    try { await pool.query('DELETE FROM professional_articles WHERE id=$1', [req.params.id]); res.json({ success: true }); }
+app.delete('/api/professional-articles/:id', verifyBiz, async (req, res) => {
+    try {
+        const _chk = await pool.query('SELECT 1 FROM professional_articles WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
+        await pool.query('DELETE FROM professional_articles WHERE id=$1', [req.params.id]); res.json({ success: true });
+    }
     catch(e) { res.status(500).json({ error: e.message }); }
 });
```

---

## #18 — PATCH /api/professional-leads/:id (~19496)
קבוצה B — עסק מעדכן סטטוס פנייה (new/read/handled).
```diff
-app.patch('/api/professional-leads/:id', async (req, res) => {
+app.patch('/api/professional-leads/:id', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_leads WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const { status } = req.body;
```

---

## #19 — PATCH /api/professional-documents/:id (~19531)
קבוצה B — עסק עורך מסמך / שומר חתימה דיגיטלית.
(signature_data נשמרת רק מה-dashboard של העסק — אין API ציבורי לחתימה)
```diff
-app.patch('/api/professional-documents/:id', async (req, res) => {
+app.patch('/api/professional-documents/:id', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_documents WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const { title, content, doc_type, status, notes, customer_name, customer_last_name, customer_phone, customer_email, customer_id_number, customer_address, signature_data, work_order_id } = req.body;
```

---

## סיכום Batch 2

| # | שורה | method | path | pattern | ownership table |
|---|---|---|---|---|---|
| 13 | 19640 | GET | /professional/dashboard/:groupId | A | groupId param |
| 14 | 19430 | PATCH | /professional-expertise/:id | B | professional_expertise |
| 15 | 19440 | DELETE | /professional-expertise/:id | B | professional_expertise |
| 16 | 19466 | PATCH | /professional-articles/:id | B | professional_articles |
| 17 | 19473 | DELETE | /professional-articles/:id | B | professional_articles |
| 18 | 19496 | PATCH | /professional-leads/:id | B | professional_leads |
| 19 | 19531 | PATCH | /professional-documents/:id | B | professional_documents |

**שים לב:** endpoints #15 ו-#17 (DELETE חד-שורתיים) — מורחבים למבנה try/catch מלא כדי לאפשר הוספת ownership check לפני הפעולה.

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 7 השינויים + commit + push.
Batch 3 (endpoints #20–#23) יוצג אחר כך.
