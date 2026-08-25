# Kids Batch 2 — diff לאישור — endpoints 11–20
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

המשך ישיר ל-Batch 1. אותם patterns A/B/C/D/E שהוגדרו בתוכנית.
Batch 2: endpoints 11–20 (redeem-requests → parent-quests).

---

## #11 — GET /api/kids/redeem-requests (~25072)
**קבוצה A** — groupId ישיר (הורה מביא בקשות מימוש של ילד).
groupId כבר מסנן ב-SQL — בדיקת IDOR מבטיחה שה-groupId שנשלח = המשפחה האמיתית.
```diff
-app.get('/api/kids/redeem-requests', async (req, res) => {
+app.get('/api/kids/redeem-requests', verifyFamily, async (req, res) => {
     try {
         const { childId, groupId } = req.query;
+        if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const rows = await pool.query(
```

---

## #12 — POST /api/kids/assign-game (~25188)
**קבוצה A** — familyGroupId ישיר (הורה מקצה משחק לילד).
```diff
-app.post('/api/kids/assign-game', async (req, res) => {
+app.post('/api/kids/assign-game', verifyFamily, async (req, res) => {
   try {
     const { familyGroupId, childUserId, gameId,
             roundsTotal, flwPerRound, expiresAt, startLevel } = req.body;
+    if (parseInt(familyGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #13 — GET /api/kids/assignments/:childId (~25231)
**קבוצה B** — child ownership (ילד טוען הקצאות שלו; הורה יכול לבדוק ילד שלו).
```diff
-app.get('/api/kids/assignments/:childId', async (req, res) => {
+app.get('/api/kids/assignments/:childId', verifyFamily, async (req, res) => {
   try {
+    const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [req.params.childId, req.familyAuth.groupId]);
+    if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
     const assignments = await pool.query(`
```

---

## #14 — POST /api/kids/use-round (~25249)
**קבוצה C** — childUserId עצמי (ילד מסיים סיבוב משחק).
כולל TODO comment (כמו award-flw ב-Batch 1).
```diff
-app.post('/api/kids/use-round', async (req, res) => {
+app.post('/api/kids/use-round', verifyFamily, async (req, res) => {
   try {
     const { assignmentId, childUserId, score, flwEarned, levelIdx } = req.body;
+    if (parseInt(childUserId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
+    // TODO: rounds_used/score values מהלקוח, לא מאומתים מול לוגיקת משחק אמיתית — cap יומי מגן בגדול אך לא מונע ניצול קטן. לבדוק בעתיד.
     const scorePercent = Math.min(100, Math.max(0, score || 0));
```

---

## #15 — POST /api/kids/renew-assignment/:id (~25325)
**קבוצה E** — assignment ownership (הורה מחדש הקצאה — חייב להיות של המשפחה שלו).
```diff
-app.post('/api/kids/renew-assignment/:id', async (req, res) => {
+app.post('/api/kids/renew-assignment/:id', verifyFamily, async (req, res) => {
   try {
     const { roundsTotal } = req.body;
+    const _asgn = await pool.query('SELECT 1 FROM game_assignments WHERE id=$1 AND family_group_id=$2', [req.params.id, req.familyAuth.groupId]);
+    if (!_asgn.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #16 — POST /api/kids/quests (~25346)
**קבוצה A** — familyGroupId ישיר (הורה יוצר קווסט).
```diff
-app.post('/api/kids/quests', async (req, res) => {
+app.post('/api/kids/quests', verifyFamily, async (req, res) => {
   try {
     const { familyGroupId, childUserId, title, subject,
             description, flwReward, passScore,
             dueDate, questions, createdBy } = req.body;
+    if (parseInt(familyGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #17 — GET /api/kids/quests/:childId (~25392)
**קבוצה B** — child ownership (ילד טוען קווסטים שלו; הורה יכול לבדוק ילד שלו).
```diff
-app.get('/api/kids/quests/:childId', async (req, res) => {
+app.get('/api/kids/quests/:childId', verifyFamily, async (req, res) => {
   try {
+    const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [req.params.childId, req.familyAuth.groupId]);
+    if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
     const quests = await pool.query(`
```

---

## #18 — GET /api/kids/quests/:questId/questions (~25409)
**קבוצה E** — quest ownership (ילד/הורה מביא שאלות — חייב להיות קווסט של המשפחה).
```diff
-app.get('/api/kids/quests/:questId/questions', async (req, res) => {
+app.get('/api/kids/quests/:questId/questions', verifyFamily, async (req, res) => {
   try {
+    const _q = await pool.query('SELECT 1 FROM kid_quests WHERE id=$1 AND family_group_id=$2', [req.params.questId, req.familyAuth.groupId]);
+    if (!_q.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
     const questions = await pool.query(`
```

---

## #19 — POST /api/kids/quests/:questId/submit (~25422)
**קבוצה C** — childUserId עצמי (ילד מגיש תשובות לקווסט שלו).
```diff
-app.post('/api/kids/quests/:questId/submit', async (req, res) => {
+app.post('/api/kids/quests/:questId/submit', verifyFamily, async (req, res) => {
   try {
     const { childUserId, answers } = req.body;
+    if (parseInt(childUserId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
     const questId = req.params.questId;
```

---

## #20 — GET /api/kids/parent-quests/:parentId (~25492)
**קבוצה D** — parentId עצמי (הורה רואה קווסטים שהוא עצמו יצר).
parentId = created_by = userId של ההורה בטבלת kid_quests.
```diff
-app.get('/api/kids/parent-quests/:parentId', async (req, res) => {
+app.get('/api/kids/parent-quests/:parentId', verifyFamily, async (req, res) => {
   try {
+    if (parseInt(req.params.parentId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
     const quests = await pool.query(`
```

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
סיום: כל 20 endpoints של /api/kids/* מאובטחים.
