# Kids Batch 1 — diff לאישור — 10 endpoints ראשונים
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

20 endpoints /api/kids/* — 0 middleware כרגע.
Batch 1: endpoints 1–10 (parent-overview → redeem-request).
Pattern: verifyFamily לכולם + בדיקת IDOR לפי קבוצה.

ילדים מתחברים בדיוק כמו הורים ← verifyFamily עובד לשניהם.

---

## #1 — GET /api/kids/parent-overview/:groupId (~24712)
**קבוצה A** — groupId ישיר.
```diff
-app.get('/api/kids/parent-overview/:groupId', async (req, res) => {
+app.get('/api/kids/parent-overview/:groupId', verifyFamily, async (req, res) => {
   try {
     const gid = req.params.groupId;
+    if (parseInt(gid) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #2 — POST /api/kids/profile-image/:userId (~24832)
**קבוצה B** — child ownership (userId = ילד שמעדכנים את תמונתו).
לא בעיה עם `<img>` — זו קריאת POST לשמירה, לא טעינת תמונה.
```diff
-app.post('/api/kids/profile-image/:userId', async (req, res) => {
+app.post('/api/kids/profile-image/:userId', verifyFamily, async (req, res) => {
   try {
+    const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [req.params.userId, req.familyAuth.groupId]);
+    if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
     let { imageUrl, dataUrl } = req.body;
```

---

## #3 — GET /api/kids/games (~24853)
**קבוצה C** — userId עצמי (ילד טוען משחקים לפי גיל שלו).
```diff
-app.get('/api/kids/games', async (req, res) => {
+app.get('/api/kids/games', verifyFamily, async (req, res) => {
     try {
         const { userId } = req.query;
+        if (parseInt(userId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
         const userRes = await pool.query('SELECT birth_year FROM users WHERE id=$1', [userId]);
```

---

## #4 — GET /api/kids/wallet/:userId (~24879)
**קבוצה C** — userId עצמי (ילד טוען ארנק FLW שלו).
```diff
-app.get('/api/kids/wallet/:userId', async (req, res) => {
+app.get('/api/kids/wallet/:userId', verifyFamily, async (req, res) => {
     try {
         const { userId } = req.params;
+        if (parseInt(userId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #5 — GET /api/kids/free-play-check (~24910)
**קבוצה C** — childUserId עצמי.
```diff
-app.get('/api/kids/free-play-check', async (req, res) => {
+app.get('/api/kids/free-play-check', verifyFamily, async (req, res) => {
     try {
         const { childUserId, gameId } = req.query;
         if (!childUserId || !gameId) return res.json({ canPlay: true });
+        if (parseInt(childUserId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #6 — POST /api/kids/award-flw (~24922)
**קבוצה C** — userId עצמי + TODO comment (כפי שהתבקש).
```diff
-app.post('/api/kids/award-flw', async (req, res) => {
+app.post('/api/kids/award-flw', verifyFamily, async (req, res) => {
     try {
         const { userId, gameId, score, flwEarned, durationSeconds } = req.body;
+        if (parseInt(userId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
+        // TODO: flwEarned value מהלקוח, לא מאומת מול לוגיקת משחק אמיתית — cap יומי מגן בגדול אך לא מונע ניצול קטן. לבדוק בעתיד.
         if (!userId || !flwEarned) return res.status(400).json({ error: 'חסרים פרטים' });
```

---

## #7 — GET /api/kids/config/:childId (~24978)
**קבוצה B** — child ownership (הורה מביא config של ילד).
```diff
-app.get('/api/kids/config/:childId', async (req, res) => {
+app.get('/api/kids/config/:childId', verifyFamily, async (req, res) => {
     try {
+        const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [req.params.childId, req.familyAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const config = await pool.query('SELECT * FROM flw_kid_config WHERE child_user_id=$1', [req.params.childId]);
```

---

## #8 — POST /api/kids/config (~24986)
**קבוצה A** — familyGroupId ישיר (הורה מגדיר config עבור ילד).
```diff
-app.post('/api/kids/config', async (req, res) => {
+app.post('/api/kids/config', verifyFamily, async (req, res) => {
     try {
         const { familyGroupId, childUserId, flwValueIls, maxDailyFlw, autoApprove } = req.body;
+        if (parseInt(familyGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## #9 — POST /api/kids/redeem (~25000)
**קבוצה B** — child ownership (הורה מממש FLW של ילד).
```diff
-app.post('/api/kids/redeem', async (req, res) => {
+app.post('/api/kids/redeem', verifyFamily, async (req, res) => {
     try {
         const { childUserId, flwAmount, parentUserId } = req.body;
+        const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [childUserId, req.familyAuth.groupId]);
+        if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
         const wallet = await pool.query('SELECT * FROM flw_kid_wallets WHERE child_user_id=$1', [childUserId]);
```

---

## #10 — POST /api/kids/redeem-request (~25043)
**קבוצה C** — childUserId עצמי (ילד שולח בקשת מימוש עבור עצמו).
```diff
-app.post('/api/kids/redeem-request', async (req, res) => {
+app.post('/api/kids/redeem-request', verifyFamily, async (req, res) => {
     try {
         const { childUserId, flwAmount, groupId } = req.body;
+        if (parseInt(childUserId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
         const wallet = await pool.query('SELECT balance_flw FROM flw_kid_wallets WHERE child_user_id=$1', [childUserId]);
```

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 10 השינויים + commit + push.
Batch 2 (endpoints 11–20) יוצג אחר כך.
