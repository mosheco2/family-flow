# Professional Batch 3 — diff לאישור — endpoints 20–23
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

Batch אחרון — 4 endpoints, כולם קבוצה B (record ownership).
הערה מיוחדת ל-#20: professional_document_versions אין בה group_id,
לכן ownership מאומת דרך professional_documents האב.

---

## #20 — GET /api/professional-documents/:id/versions (~19567)
קבוצה B — עסק מביא היסטוריית גרסאות של מסמך שלו.
⚠️ versions אין group_id → SELECT על professional_documents (האב).
```diff
-app.get('/api/professional-documents/:id/versions', async (req, res) => {
+app.get('/api/professional-documents/:id/versions', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_documents WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM professional_document_versions WHERE document_id=$1 ORDER BY changed_at DESC LIMIT 20', [req.params.id]);
```

---

## #21 — POST /api/professional-documents/:id/send-email (~19574)
קבוצה B — עסק שולח מסמך ללקוח במייל.
```diff
-app.post('/api/professional-documents/:id/send-email', async (req, res) => {
+app.post('/api/professional-documents/:id/send-email', verifyBiz, async (req, res) => {
     try {
         const { to_email } = req.body;
         if (!to_email) return res.status(400).json({ error: 'חסרה כתובת מייל' });
         const r = await pool.query('SELECT * FROM professional_documents WHERE id=$1', [req.params.id]);
-        if (!r.rows.length) return res.status(404).json({ error: 'מסמך לא נמצא' });
+        if (!r.rows.length || r.rows[0].group_id !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```
הערה: כאן ה-SELECT כבר מושך את המסמך לשימוש בהמשך — לכן בודקים `group_id` על התוצאה ישירות, ללא SELECT נפרד.

---

## #22 — DELETE /api/professional-documents/:id (~19600)
קבוצה B — עסק מוחק מסמך שלו (+ כל הגרסאות שלו).
```diff
-app.delete('/api/professional-documents/:id', async (req, res) => {
+app.delete('/api/professional-documents/:id', verifyBiz, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM professional_documents WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('DELETE FROM professional_document_versions WHERE document_id=$1', [req.params.id]);
```

---

## #23 — DELETE /api/professional-doc-types/:id (~19633)
קבוצה B — עסק מוחק סוג מסמך מותאם שלו.
```diff
-app.delete('/api/professional-doc-types/:id', async (req, res) => {
-    try { await pool.query('DELETE FROM professional_doc_types WHERE id=$1', [req.params.id]); res.json({ success: true }); }
+app.delete('/api/professional-doc-types/:id', verifyBiz, async (req, res) => {
+    try {
+        const _chk = await pool.query('SELECT 1 FROM professional_doc_types WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
+        await pool.query('DELETE FROM professional_doc_types WHERE id=$1', [req.params.id]); res.json({ success: true });
+    }
     catch(e) { res.status(500).json({ error: e.message }); }
 });
```

---

## סיכום Batch 3

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 20 | 19567 | GET | /professional-documents/:id/versions | ownership דרך documents האב |
| 21 | 19574 | POST | /professional-documents/:id/send-email | group_id מהשורה שנמשכת ממילא |
| 22 | 19600 | DELETE | /professional-documents/:id | מוחק גם versions |
| 23 | 19633 | DELETE | /professional-doc-types/:id | הורחב מחד-שורתי |

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 4 השינויים + commit + push.
סיום: כל 23 endpoints של /api/professional-* מאובטחים.

סיכום כולל אחרי Batch 3:
- /api/community/*   → 59 endpoints (Batch A–D, סשן קודם)
- /api/kids/*        → 20 endpoints (Batch 1–2)
- /api/professional-* → 19 endpoints (Batch 1–3, ללא 4 ציבוריים)
- סה"כ: 98 endpoints מאובטחים
