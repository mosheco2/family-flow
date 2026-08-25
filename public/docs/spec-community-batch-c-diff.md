# Batch C — diff לאישור — קטגוריה ג' + cleanup
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

6 endpoints: 5 מנהל קהילה (verifyFamily + groupId match) + 1 ניהולי (verifySA).  
הבדיקות הקיימות (is_community_manager) נשארות בעינן — מוסיפים רק verifyFamily + groupId לפניהן.

---

## הערה חשובה — invite-business

`POST /invite-business` — הקוד הנוכחי בודק רק `approved` membership, **לא** `is_community_manager` (בניגוד לתיאור במסמך האבטחה המקורי).  
הדיף מוסיף רק verifyFamily + groupId, **לא** משנה את לוגיקת ההרשאה הקיימת.  
אם רוצים להוסיף בדיקת manager — זה שינוי לוגי נפרד שדורש אישור בנפרד.

---

## Diff — 6 endpoints

### 1. POST /api/community/manager/articles (~10830)
שדה: `group_id` (underscore). הבדיקה הקיימת (is_community_manager) נשארת — מוסיפים verifyFamily לפניה.
```diff
- app.post('/api/community/manager/articles', async (req, res) => {
+ app.post('/api/community/manager/articles', verifyFamily, async (req, res) => {
      try {
          const { community_id, group_id, title, body, image_url } = req.body;
+         if (parseInt(group_id) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          if (!title || !body || !community_id) return res.status(400).json({ error: 'missing fields' });
          // בדיקת is_community_manager קיימת — לא נוגעים
          const check = await pool.query(
              `SELECT 1 FROM family_communities WHERE group_id=$1 AND community_id=$2 AND is_community_manager=TRUE`,
              [group_id, community_id]
          );
          if (!check.rows.length) return res.status(403).json({ error: 'Not a community manager' });
```

---

### 2. POST /api/community/invite-business (~11517)
⚠️ הקוד הנוכחי בודק רק approved membership — לא is_community_manager.
```diff
- app.post('/api/community/invite-business', async (req, res) => {
+ app.post('/api/community/invite-business', verifyFamily, async (req, res) => {
      try {
          const { groupId, communityId, businessId } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת approved membership קיימת — לא נוגעים
          const check = await pool.query(
              `SELECT 1 FROM family_communities WHERE group_id=$1 AND community_id=$2 AND status='approved'`,
              [groupId, communityId]
          );
          if (!check.rows.length) return res.status(403).json({ error: 'אינך חבר מאושר בקהילה זו' });
```

---

### 3. POST /api/community/manager/family/approve (~14055)
```diff
- app.post('/api/community/manager/family/approve', async (req, res) => {
+ app.post('/api/community/manager/family/approve', verifyFamily, async (req, res) => {
      try {
          const { groupId, communityId, targetGroupId } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת is_community_manager קיימת — לא נוגעים
          const check = await pool.query(
              `SELECT 1 FROM family_communities WHERE group_id=$1 AND community_id=$2 AND is_community_manager=TRUE`,
              [groupId, communityId]
          );
          if (!check.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

---

### 4. POST /api/community/manager/family/reject (~14066)
```diff
- app.post('/api/community/manager/family/reject', async (req, res) => {
+ app.post('/api/community/manager/family/reject', verifyFamily, async (req, res) => {
      try {
          const { groupId, communityId, targetGroupId } = req.body;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // בדיקת is_community_manager קיימת — לא נוגעים
          const check = await pool.query(
              `SELECT 1 FROM family_communities WHERE group_id=$1 AND community_id=$2 AND is_community_manager=TRUE`,
              [groupId, communityId]
          );
          if (!check.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

---

### 5. GET /api/community/manager-data/:groupId (~14077)
הבדיקה הקיימת היא implicit בתוך ה-query (מחזיר [] אם אין manager role).
```diff
- app.get('/api/community/manager-data/:groupId', async (req, res) => {
+ app.get('/api/community/manager-data/:groupId', verifyFamily, async (req, res) => {
      try {
          const { groupId } = req.params;
+         if (parseInt(groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
          // סינון is_community_manager בתוך ה-query — לא נוגעים
          const mgrRes = await pool.query(
              `SELECT fc.community_id, c.name as community_name FROM family_communities fc
               JOIN communities c ON c.id=fc.community_id
               WHERE fc.group_id=$1 AND fc.is_community_manager=TRUE`, [groupId]
          );
```

---

### 6. POST /api/community/pool/cleanup (~23923)
endpoint ניהולי טהור — verifySA בלבד.
```diff
- app.post('/api/community/pool/cleanup', async (req, res) => {
+ app.post('/api/community/pool/cleanup', verifySA, async (req, res) => {
      try {
          const expired = await pool.query(
              `UPDATE flow_pools SET status='expired' WHERE status IN ('open_r1','open_r2') AND expires_at<=NOW() RETURNING id`
          );
```

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 6 השינויים + commit + push.
