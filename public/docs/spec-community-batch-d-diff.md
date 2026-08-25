# Batch D — diff לאישור — 12 endpoints "בדיקת הרשאה"
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

12 endpoints שנותרו מתוך ה-19 "בדיקת הרשאה" המקוריים.  
7 כבר טופלו (bid/message לפני Batch A, manager endpoints ב-Batch C).

**עיקרון:** verifyFamily מבטיח שיש טוקן תקין. בדיקת ה-IDOR (groupId בבקשה = groupId בטוקן) מונעת זיוף זהות.  
הלוגיקה הקיימת (isInitiator, isManager, created_by_family_id) נשארת בעינה.

---

## קבוצה 1 — GET /info/:groupId (נמוכה)

### GET /api/community/info/:groupId (~12596)
כל חבר קהילה רשאי לצפות — אין בדיקת תפקיד. רק מונע גישה ללא טוקן + IDOR.
```diff
- app.get('/api/community/info/:groupId', async (req, res) => {
+ app.get('/api/community/info/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const commsRes = await pool.query(`...`, [req.params.groupId]);
```

---

## קבוצה 2 — 8 pool actions (viewerId/initiatorId = שלי)

Pattern אחיד: verifyFamily + בדיקת viewerId/initiatorId מול טוקן.  
הלוגיקה הקיימת (isInitiator, isManager) נשארת — הבדיקה החדשה רק מאמתת שה-viewerId שנשלח הוא אכן המשתמש המחובר.

### POST /api/community/pool/:id/remove-member (~23701)
שדה: `initiatorId` (המבקש לסלק חבר חייב להיות יוזם הפול).
```diff
- app.post('/api/community/pool/:id/remove-member', async (req, res) => {
+ app.post('/api/community/pool/:id/remove-member', verifyFamily, async (req, res) => {
      try {
          const { groupId, initiatorId } = req.body;
+         if (parseInt(initiatorId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const check = await pool.query(...)  // בדיקת initiator_id ב-DB — נשארת
```

### GET /api/community/pool/:id/bids (~23756)
שדה: `viewerId` (מ-query). יכול להיות initiator או manager — הלוגיקה הקיימת בודקת את זה.
```diff
- app.get('/api/community/pool/:id/bids', async (req, res) => {
+ app.get('/api/community/pool/:id/bids', verifyFamily, async (req, res) => {
      try {
          const { viewerId, viewerType } = req.query;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const pRes = await pool.query(...)  // isInitiator / isManager check — נשאר
```

### POST /api/community/pool/:id/select-bid (~23778)
שדה: `viewerId` (מ-body).
```diff
- app.post('/api/community/pool/:id/select-bid', async (req, res) => {
+ app.post('/api/community/pool/:id/select-bid', verifyFamily, async (req, res) => {
      try {
          const { bidId, viewerId } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const pRes = await pool.query(...)  // isInitiator check — נשאר
```

### POST /api/community/pool/:id/open-round2 (~23799)
שדה: `viewerId` (מ-body). יש בדיקת isInitiator || isManager קיימת.
```diff
- app.post('/api/community/pool/:id/open-round2', async (req, res) => {
+ app.post('/api/community/pool/:id/open-round2', verifyFamily, async (req, res) => {
      try {
          const { viewerId } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const pRes = await pool.query(...)  // isInitiator || isManager check — נשאר
```

### POST /api/community/pool/:id/archive (~23815)
שדה: `viewerId` (מ-body). ⚠️ יש גם `bizArchive` flag — אם `bizArchive=true` זה ארכיב אישי של עסק. כיוון ש-verifyFamily נוסף, עסקים לא יוכלו לקרוא לנתיב זה עם bizArchive. **אם זה בכוונה — אין בעיה. אם עסקים צריכים bizArchive — צריך verifyFamilyOrBiz. לפי ניתוח: bizArchive הוא פיצ'ר family בלבד, לא בדוק.**
```diff
- app.post('/api/community/pool/:id/archive', async (req, res) => {
+ app.post('/api/community/pool/:id/archive', verifyFamily, async (req, res) => {
      try {
          const { viewerId, bizArchive } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### POST /api/community/pool/:id/renew (~23838)
שדה: `viewerId` (מ-body). בדיקה קיימת: `parseInt(viewerId) !== fp.initiator_id`.
```diff
- app.post('/api/community/pool/:id/renew', async (req, res) => {
+ app.post('/api/community/pool/:id/renew', verifyFamily, async (req, res) => {
      try {
          const { viewerId, days } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת initiator_id קיימת — נשארת
```

### POST /api/community/pool/:id/edit (~23855)
שדה: `viewerId` (מ-body). בדיקה קיימת: `initiator_group_id != viewerId`.
```diff
- app.post('/api/community/pool/:id/edit', async (req, res) => {
+ app.post('/api/community/pool/:id/edit', verifyFamily, async (req, res) => {
      try {
          const { viewerId, title, description, maxPrice } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת initiator_group_id קיימת — נשארת
```

### POST /api/community/pool/:id/restore (~23871)
שדה: `viewerId` (מ-body). בדיקה קיימת: `parseInt(viewerId) !== fp.initiator_id`.
```diff
- app.post('/api/community/pool/:id/restore', async (req, res) => {
+ app.post('/api/community/pool/:id/restore', verifyFamily, async (req, res) => {
      try {
          const { viewerId } = req.body;
+         if (parseInt(viewerId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת initiator_id קיימת — נשארת
```

---

## קבוצה 3 — POST /inbox/new (שולח = מנהל קהילה)

### POST /api/community/inbox/new (~13986)
שדה: `groupId` (מ-body) = המנהל השולח. הלוגיקה הקיימת (manager check) נשארת.
```diff
- app.post('/api/community/inbox/new', async (req, res) => {
+ app.post('/api/community/inbox/new', verifyFamily, async (req, res) => {
      try {
          const { groupId, communityId, subject, content } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## קבוצה 4 — add-family / remove-family (familyId=שלי, targetFamilyId=אחר)

בשניהם: `familyId` = היוצר/המנהל (שלי), `targetFamilyId` = המשפחה המושפעת.  
יש בדיקה קיימת: `created_by_family_id !== parseInt(familyId)` — נשארת.

### POST /api/community/groups/:id/add-family (~26072)
```diff
- app.post('/api/community/groups/:id/add-family', async (req, res) => {
+ app.post('/api/community/groups/:id/add-family', verifyFamily, async (req, res) => {
    try {
      const { familyId, targetFamilyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
      const grp = await pool.query(...)  // בדיקת created_by_family_id קיימת — נשארת
```

### DELETE /api/community/groups/:id/remove-family (~26097)
```diff
- app.delete('/api/community/groups/:id/remove-family', async (req, res) => {
+ app.delete('/api/community/groups/:id/remove-family', verifyFamily, async (req, res) => {
    try {
      const { familyId, targetFamilyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
      const grp = await pool.query(...)  // בדיקת created_by_family_id קיימת — נשארת
```

---

## שאלה פתוחה — pool/archive עם bizArchive

`bizArchive=true` נראה כמו פיצ'ר שמאפשר לעסק לארכב את הפול אצלו בלי לשנות סטטוס גלובלי.  
אם עסקים אכן קוראים לנתיב זה עם `bizArchive=true` — צריך `verifyFamilyOrBiz` במקום `verifyFamily`.  
אם זה פיצ'ר family בלבד — `verifyFamily` נכון.

**בקש הבהרה: האם עסקים משתמשים ב-bizArchive דרך נתיב זה?**

---

## לאישור

לאחר קבלת "מאושר" (כולל הבהרה על bizArchive) — ביצוע כל 12 השינויים + commit + push.
