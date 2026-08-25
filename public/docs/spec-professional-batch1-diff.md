# Professional Batch 1 — diff לאישור — endpoints 5–12
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

8 endpoints ראשונים מקבוצה A — כולם עם groupId ב-params.
Pattern אחיד: `verifyBiz` + בדיקת IDOR `parseInt(req.params.groupId) !== req.bizAuth.groupId`.

endpoints #1-#4 (קבוצה P — ציבורי) — ללא שינוי.

---

## #5 — POST /api/professional-content/:groupId (~19400)
קבוצה A — עסק מעדכן את תוכן האתר שלו.
```diff
-app.post('/api/professional-content/:groupId', async (req, res) => {
+app.post('/api/professional-content/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const fields = ['hero_title_he','hero_title_en','hero_subtitle_he','hero_subtitle_en','cta_text_he','cta_text_en','about_text_he','about_text_en'];
```

---

## #6 — POST /api/professional-expertise/:groupId (~19420)
קבוצה A — עסק מוסיף תחום מומחיות.
```diff
-app.post('/api/professional-expertise/:groupId', async (req, res) => {
+app.post('/api/professional-expertise/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { icon, title_he, title_en, description_he, description_en } = req.body;
```

---

## #7 — POST /api/professional-articles/:groupId (~19456)
קבוצה A — עסק מפרסם מאמר.
```diff
-app.post('/api/professional-articles/:groupId', async (req, res) => {
+app.post('/api/professional-articles/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { title_he, title_en, content_he, content_en, tags, is_published } = req.body;
```

---

## #8 — GET /api/professional-leads/:groupId (~19479)
קבוצה A — עסק מושך פניות שהתקבלו מהאתר.
```diff
-app.get('/api/professional-leads/:groupId', async (req, res) => {
+app.get('/api/professional-leads/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM professional_leads WHERE group_id=$1 ORDER BY created_at DESC LIMIT 200', [req.params.groupId]);
```

---

## #9 — GET /api/professional-documents/:groupId (~19506)
קבוצה A — עסק מושך רשימת מסמכים/תבניות שלו.
```diff
-app.get('/api/professional-documents/:groupId', async (req, res) => {
+app.get('/api/professional-documents/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { is_template, customer_name, customer_phone } = req.query;
```

---

## #10 — POST /api/professional-documents/:groupId (~19520)
קבוצה A — עסק יוצר מסמך / תבנית חדשה.
```diff
-app.post('/api/professional-documents/:groupId', async (req, res) => {
+app.post('/api/professional-documents/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { customer_name, customer_last_name, customer_phone, customer_email, customer_id_number, customer_address, title, content, doc_type, status, is_template, notes, work_order_id } = req.body;
```

---

## #11 — GET /api/professional-doc-types/:groupId (~19608)
קבוצה A — עסק מושך סוגי מסמכים מותאמים שלו.
```diff
-app.get('/api/professional-doc-types/:groupId', async (req, res) => {
+app.get('/api/professional-doc-types/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM professional_doc_types WHERE group_id=$1 ORDER BY id', [req.params.groupId]);
```

---

## #12 — POST /api/professional-doc-types/:groupId (~19614)
קבוצה A — עסק מוסיף סוג מסמך מותאם.
```diff
-app.post('/api/professional-doc-types/:groupId', async (req, res) => {
+app.post('/api/professional-doc-types/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { name, icon } = req.body;
```

---

## סיכום Batch 1

| # | שורה | method | path | שינוי |
|---|---|---|---|---|
| 5 | 19400 | POST | /professional-content/:groupId | +verifyBiz +IDOR |
| 6 | 19420 | POST | /professional-expertise/:groupId | +verifyBiz +IDOR |
| 7 | 19456 | POST | /professional-articles/:groupId | +verifyBiz +IDOR |
| 8 | 19479 | GET | /professional-leads/:groupId | +verifyBiz +IDOR |
| 9 | 19506 | GET | /professional-documents/:groupId | +verifyBiz +IDOR |
| 10 | 19520 | POST | /professional-documents/:groupId | +verifyBiz +IDOR |
| 11 | 19608 | GET | /professional-doc-types/:groupId | +verifyBiz +IDOR |
| 12 | 19614 | POST | /professional-doc-types/:groupId | +verifyBiz +IDOR |

**שינוי לכל endpoint: 2 שורות בלבד (middleware + IDOR check). ללא שינוי לוגיקה.**

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 8 השינויים + commit + push.
Batch 2 (endpoints #13-#19) יוצג אחר כך.
