# Batch A — diff לאישור — /api/community/* verifyFamily
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

19 endpoints (לא 20 — endpoint #1 /articles/:communityId הוצע להעביר לציבורי, ממתין להחלטה).

Pattern אחיד לכולם:
1. הוספת `verifyFamily` בין ה-path לבין ה-handler
2. בשורה הראשונה בתוך `try {}`: בדיקת `parseInt(fieldName) !== req.familyAuth.groupId` → 403

שם השגיאה: `'אין הרשאה'` — אם מעדיף ניסוח אחר, ציין לפני אישור.

---

## שאלה פתוחה לפני אישור

**endpoint #1 — GET /api/community/articles/:communityId (שורה ~10763)**
- משתמש ב-`communityId`, לא `groupId` — אין כאן "groupId של המשתמש" לאמת
- האם: **א)** מעביר לקטגוריה ציבורית (לא נוגע) | **ב)** מוסיף verifyFamily ללא בדיקת groupId (רק דורש כניסה)

---

## Diff — 19 endpoints

### 2. POST /api/community/user-create (~11295)
```diff
- app.post('/api/community/user-create', async (req, res) => {
+ app.post('/api/community/user-create', verifyFamily, async (req, res) => {
      try {
          const { groupId, ... } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 3. GET /api/community/my-initiatives/:groupId (~11313)
```diff
- app.get('/api/community/my-initiatives/:groupId', async (req, res) => {
+ app.get('/api/community/my-initiatives/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 4. GET /api/community/promos/:groupId (~12373)
```diff
- app.get('/api/community/promos/:groupId', async (req, res) => {
+ app.get('/api/community/promos/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 5. GET /api/community/family-feed/:groupId (~12626)
```diff
- app.get('/api/community/family-feed/:groupId', async (req, res) => {
+ app.get('/api/community/family-feed/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 6. POST /api/community/family-refer (~12684)
```diff
- app.post('/api/community/family-refer', async (req, res) => {
+ app.post('/api/community/family-refer', verifyFamily, async (req, res) => {
      try {
          const { groupId, communityId } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 7. POST /api/community/join (~12713)
```diff
- app.post('/api/community/join', async (req, res) => {
+ app.post('/api/community/join', verifyFamily, async (req, res) => {
      try {
          const { groupId, ... } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 8. DELETE /api/community/leave/:groupId/:communityId (~12749)
```diff
- app.delete('/api/community/leave/:groupId/:communityId', async (req, res) => {
+ app.delete('/api/community/leave/:groupId/:communityId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 9. GET /api/community/inbox/:groupId (~13959)
```diff
- app.get('/api/community/inbox/:groupId', async (req, res) => {
+ app.get('/api/community/inbox/:groupId', verifyFamily, async (req, res) => {
      try {
          const { groupId } = req.params;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 10. GET /api/community/inbox/thread/:threadId/:groupId (~13995)
```diff
- app.get('/api/community/inbox/thread/:threadId/:groupId', async (req, res) => {
+ app.get('/api/community/inbox/thread/:threadId/:groupId', verifyFamily, async (req, res) => {
      try {
          const { threadId, groupId } = req.params;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 11. POST /api/community/inbox/thread/:threadId/reply (~14012)
```diff
- app.post('/api/community/inbox/thread/:threadId/reply', async (req, res) => {
+ app.post('/api/community/inbox/thread/:threadId/reply', verifyFamily, async (req, res) => {
      try {
          const { groupId, ... } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 12. GET /api/community/cashback-info/:groupId (~14027)
```diff
- app.get('/api/community/cashback-info/:groupId', async (req, res) => {
+ app.get('/api/community/cashback-info/:groupId', verifyFamily, async (req, res) => {
      try {
          const { groupId } = req.params;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 13. GET /api/community/my-referral-stats/:groupId (~14195)
```diff
- app.get('/api/community/my-referral-stats/:groupId', async (req, res) => {
+ app.get('/api/community/my-referral-stats/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 14. GET /api/community/my-referral-code/:groupId (~14206)
```diff
- app.get('/api/community/my-referral-code/:groupId', async (req, res) => {
+ app.get('/api/community/my-referral-code/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 15. POST /api/community/refer-business (~14373)
```diff
- app.post('/api/community/refer-business', async (req, res) => {
+ app.post('/api/community/refer-business', verifyFamily, async (req, res) => {
      try {
          const { referrerGroupId, ... } = req.body;
+         if (parseInt(referrerGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 16. GET /api/community/my-referrals/:groupId (~14401)
```diff
- app.get('/api/community/my-referrals/:groupId', async (req, res) => {
+ app.get('/api/community/my-referrals/:groupId', verifyFamily, async (req, res) => {
      try {
+         if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 17. POST /api/community/promotions/:id/redeem (~15240)
```diff
- app.post('/api/community/promotions/:id/redeem', async (req, res) => {
+ app.post('/api/community/promotions/:id/redeem', verifyFamily, async (req, res) => {
      try {
          const { groupId, ... } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 18. POST /api/community/reviews (~15258)
```diff
- app.post('/api/community/reviews', async (req, res) => {
+ app.post('/api/community/reviews', verifyFamily, async (req, res) => {
      try {
          const { familyGroupId, ... } = req.body;
+         if (parseInt(familyGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 19. POST /api/community/biz-contact (~15278)
```diff
- app.post('/api/community/biz-contact', async (req, res) => {
+ app.post('/api/community/biz-contact', verifyFamily, async (req, res) => {
      try {
          const { familyGroupId, ... } = req.body;
+         if (parseInt(familyGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

### 20. POST /api/community/bundles/:id/purchase (~15292)
```diff
- app.post('/api/community/bundles/:id/purchase', async (req, res) => {
+ app.post('/api/community/bundles/:id/purchase', verifyFamily, async (req, res) => {
      try {
          const { groupId, ... } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 19 השינויים + commit + push.
Batch B (20 endpoints נוספים) יוצג בנפרד לאחר אישור Batch A.
