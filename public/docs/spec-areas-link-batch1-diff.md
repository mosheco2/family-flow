# Areas & Link Batch 1 — diff לאישור — 7 verifyFamily endpoints
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

7 endpoints משפחה: link-request (3), preferred-areas (3), linked-businesses (1).
Pattern אחיד: `verifyFamily` + IDOR על groupId.

---

## בדיקת linked-businesses — האם groupId מספיק?

שאלה: האם member_business_links דורש בדיקה נוספת ברמת קישור ספציפי?

**מסקנה: לא.** הסיבה:
- ה-endpoint הוא GET בלבד — קריאת רשימה
- `beauty_client_records`: מסונן `WHERE client_family_id = $groupId`
- `member_business_links`: מסונן `WHERE member_group_id = $groupId AND is_active = true`
- שני ה-queries מסוננים לפי groupId — IDOR על groupId מגן על הכל
- אין endpoint נפרד ל-PATCH/DELETE של member_business_link ספציפי בסבב זה
- `link_id` מוחזר כנתון אינפורמטיבי בלבד, לא ניתן לפעול עליו כאן

**groupId check מספיק לחלוטין.**

---

## #1 — POST /api/family/link-request (~1964)
משפחה שולחת בקשת חיבור למשפחה אחרת לפי טלפון.
IDOR: `requesterGroupId` בבקשה חייב להתאים לטוקן.
```diff
-app.post('/api/family/link-request', async (req, res) => {
+app.post('/api/family/link-request', verifyFamily, async (req, res) => {
     const { requesterGroupId, targetPhone, role } = req.body;
     if (!requesterGroupId || !targetPhone || !['parent','child','partner'].includes(role))
         return res.status(400).json({ error: 'נתונים חסרים' });
+    if (parseInt(requesterGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
     try {
```

---

## #2 — GET /api/family/link-requests/:groupId (~1995)
משפחה מביאה בקשות ממתינות שמיועדות **אליה** (target).
```diff
-app.get('/api/family/link-requests/:groupId', async (req, res) => {
+app.get('/api/family/link-requests/:groupId', verifyFamily, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query(
             `SELECT flr.id, flr.role, flr.created_at,
```

---

## #3 — POST /api/family/link-request/:id/respond (~2011)
משפחה מאשרת/דוחה בקשה שמיועדת **אליה**.
IDOR: `targetGroupId` בבקשה חייב להתאים לטוקן.
הקוד כבר מאמת ב-SQL `AND target_group_id=$targetGroupId` — **כפל הגנה**.
```diff
-app.post('/api/family/link-request/:id/respond', async (req, res) => {
+app.post('/api/family/link-request/:id/respond', verifyFamily, async (req, res) => {
     const decision = req.body.decision || req.body.action;
     const targetGroupId = req.body.targetGroupId || req.body.respondingGroupId;
     if (!['approve','reject'].includes(decision)) return res.status(400).json({ error: 'פעולה לא תקינה' });
+    if (parseInt(targetGroupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
     const client = await pool.connect();
```

---

## #4 — GET /api/family/preferred-areas/:groupId (~5280)
משפחה מביאה אזורי העדפה שלה.
```diff
-app.get('/api/family/preferred-areas/:groupId', async (req, res) => {
+app.get('/api/family/preferred-areas/:groupId', verifyFamily, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM family_preferred_areas WHERE family_group_id=$1 ORDER BY is_primary DESC, created_at', [req.params.groupId]);
```

---

## #5 — POST /api/family/preferred-areas/:groupId (~5287)
משפחה מוסיפה/מעדכנת אזור עניין.
```diff
-app.post('/api/family/preferred-areas/:groupId', async (req, res) => {
+app.post('/api/family/preferred-areas/:groupId', verifyFamily, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { city, radius_km = 15, is_primary = false, lat: clientLat, lng: clientLng } = req.body;
```

---

## #6 — DELETE /api/family/preferred-areas/:groupId/:areaId (~5305)
משפחה מוחקת אזור עניין.
ה-SQL כבר מסנן `AND family_group_id=$groupId` — groupId check מגן גם על areaId.
```diff
-app.delete('/api/family/preferred-areas/:groupId/:areaId', async (req, res) => {
+app.delete('/api/family/preferred-areas/:groupId/:areaId', verifyFamily, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('DELETE FROM family_preferred_areas WHERE id=$1 AND family_group_id=$2', [req.params.areaId, req.params.groupId]);
```

---

## #7 — GET /api/family/linked-businesses/:groupId (~21957)
משפחה רואה את העסקים שהיא מחוברת אליהם.
groupId מסנן שני queries: beauty_client_records + member_business_links.
```diff
-app.get('/api/family/linked-businesses/:groupId', async (req, res) => {
+app.get('/api/family/linked-businesses/:groupId', verifyFamily, async (req, res) => {
     try {
         const groupId = parseInt(req.params.groupId);
+        if (groupId !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         // beauty client links
```
הערה: groupId כבר עובר `parseInt` בשורה הבאה — אז הבדיקה `groupId !== req.familyAuth.groupId` (ללא parseInt נוסף) מספיקה ונקייה.

---

## סיכום Batch 1

| # | שורה | method | path | IDOR field |
|---|---|---|---|---|
| 1 | 1964 | POST | /family/link-request | `body.requesterGroupId` |
| 2 | 1995 | GET | /family/link-requests/:groupId | `params.groupId` |
| 3 | 2011 | POST | /family/link-request/:id/respond | `body.targetGroupId` |
| 4 | 5280 | GET | /family/preferred-areas/:groupId | `params.groupId` |
| 5 | 5287 | POST | /family/preferred-areas/:groupId | `params.groupId` |
| 6 | 5305 | DELETE | /family/preferred-areas/:groupId/:areaId | `params.groupId` |
| 7 | 21957 | GET | /family/linked-businesses/:groupId | `params.groupId` (parseInt כבר בקוד) |

**שינוי לכל endpoint: 2 שורות בלבד. ללא שינוי לוגיקה.**

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 7 השינויים + commit + push.
Batch 2 (7 × verifyBiz) יוצג אחר כך.
