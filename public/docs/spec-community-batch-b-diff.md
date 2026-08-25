# Batch B — diff לאישור — /api/community/* verifyFamily
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

20 endpoints "התאמה ישירה" שנותרו לאחר Batch A.  
Pattern זהה: הוספת `verifyFamily` + בדיקת `familyId`/`groupId`/`initiatorId` מול `req.familyAuth.groupId` → 403.

---

## הערות לפני אישור

**#1 — POST /pool:** `initiatorId` הוא group_id של המשפחה כשה-`initiatorType === 'FAMILY'`. הבדיקה תחול על כל הערך — כי עסק לא יכול ליצור פול דרך endpoint זה (יש לו נתיב נפרד). מאשר כך?

**#20 — GET /:id/live-games:** `groupId` אופציונלי בנוכחי (`|| null`). הבדיקה מותנית — רק אם groupId נשלח. אם לא נשלח — endpoint פועל ללא סינון אישי. מאשר כך?

---

## Diff — 20 endpoints

### 1. POST /api/community/pool (~23636)
```diff
- app.post('/api/community/pool', async (req, res) => {
+ app.post('/api/community/pool', verifyFamily, async (req, res) => {
      try {
          const { communityId, initiatorType, initiatorId, title, description, serviceCategory, maxPrice, offerPrice, minFamilies } = req.body;
+         if (parseInt(initiatorId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 2. POST /api/community/pool/:id/join (~23708)
```diff
- app.post('/api/community/pool/:id/join', async (req, res) => {
+ app.post('/api/community/pool/:id/join', verifyFamily, async (req, res) => {
      try {
          const { groupId } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 3. GET /api/community/pool/family-archive/:groupId (~23976)
```diff
- app.get('/api/community/pool/family-archive/:groupId', async (req, res) => {
+ app.get('/api/community/pool/family-archive/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          const r = await pool.query(`
```

### 4. GET /api/community/feed (~25568)
```diff
- app.get('/api/community/feed', async (req, res) => {
+ app.get('/api/community/feed', verifyFamily, async (req, res) => {
    try {
      const { familyId, communityId, groupId, page=1, limit=20 } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 5. POST /api/community/posts (~25627)
```diff
- app.post('/api/community/posts', async (req, res) => {
+ app.post('/api/community/posts', verifyFamily, async (req, res) => {
    try {
      const { familyId, communityId, groupId, postType='general', content, imageUrl, userId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 6. POST /api/community/feed/mark-read (~25661)
```diff
- app.post('/api/community/feed/mark-read', async (req, res) => {
+ app.post('/api/community/feed/mark-read', verifyFamily, async (req, res) => {
    try {
      const { familyId, communityId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 7. GET /api/community/feed/unread-counts (~25691)
```diff
- app.get('/api/community/feed/unread-counts', async (req, res) => {
+ app.get('/api/community/feed/unread-counts', verifyFamily, async (req, res) => {
    try {
      const { familyId } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 8. GET /api/community/notifications (~25721)
```diff
- app.get('/api/community/notifications', async (req, res) => {
+ app.get('/api/community/notifications', verifyFamily, async (req, res) => {
    try {
      const { familyId, limit = 30 } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 9. GET /api/community/notifications/count (~25742)
```diff
- app.get('/api/community/notifications/count', async (req, res) => {
+ app.get('/api/community/notifications/count', verifyFamily, async (req, res) => {
    try {
      const { familyId } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 10. POST /api/community/notifications/mark-read (~25754)
```diff
- app.post('/api/community/notifications/mark-read', async (req, res) => {
+ app.post('/api/community/notifications/mark-read', verifyFamily, async (req, res) => {
    try {
      const { familyId, notificationId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 11. POST /api/community/posts/:id/like (~25773)
```diff
- app.post('/api/community/posts/:id/like', async (req, res) => {
+ app.post('/api/community/posts/:id/like', verifyFamily, async (req, res) => {
    try {
      const { familyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 12. POST /api/community/posts/:id/comments (~25827)
```diff
- app.post('/api/community/posts/:id/comments', async (req, res) => {
+ app.post('/api/community/posts/:id/comments', verifyFamily, async (req, res) => {
    try {
      const { familyId, userId, content, parentCommentId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 13. POST /api/community/posts/:id/report (~25852)
```diff
- app.post('/api/community/posts/:id/report', async (req, res) => {
+ app.post('/api/community/posts/:id/report', verifyFamily, async (req, res) => {
    try {
      const { familyId, reason } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 14. POST /api/community/posts/:id/share (~25868)
```diff
- app.post('/api/community/posts/:id/share', async (req, res) => {
+ app.post('/api/community/posts/:id/share', verifyFamily, async (req, res) => {
    try {
      const { familyId, targetCommunityId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 15. POST /api/community/groups/:id/join (~25972)
```diff
- app.post('/api/community/groups/:id/join', async (req, res) => {
+ app.post('/api/community/groups/:id/join', verifyFamily, async (req, res) => {
    try {
      const { familyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 16. POST /api/community/groups/:id/leave (~25994)
```diff
- app.post('/api/community/groups/:id/leave', async (req, res) => {
+ app.post('/api/community/groups/:id/leave', verifyFamily, async (req, res) => {
    try {
      const { familyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 17. POST /api/community/groups (~26008)
```diff
- app.post('/api/community/groups', async (req, res) => {
+ app.post('/api/community/groups', verifyFamily, async (req, res) => {
    try {
      const { communityId, name, description, iconEmoji, familyId } = req.body;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 18. GET /api/community/feed/search (~26127)
```diff
- app.get('/api/community/feed/search', async (req, res) => {
+ app.get('/api/community/feed/search', verifyFamily, async (req, res) => {
    try {
      const { q, familyId, communityId, groupId, page=1 } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 19. GET /api/community/feed/biz-promos (~26707)
```diff
- app.get('/api/community/feed/biz-promos', async (req, res) => {
+ app.get('/api/community/feed/biz-promos', verifyFamily, async (req, res) => {
    try {
      const { communityId, familyId } = req.query;
+     if (parseInt(familyId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 20. GET /api/community/:id/live-games (~28703)
```diff
- app.get('/api/community/:id/live-games', async (req, res) => {
+ app.get('/api/community/:id/live-games', verifyFamily, async (req, res) => {
    try {
      const communityId = req.params.id;
      const groupId = req.query.groupId || null;
+     if (groupId && parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```
*(groupId אופציונלי — הבדיקה מותנית: רק אם נשלח)*

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 20 השינויים + commit + push.
