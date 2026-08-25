# Areas & Link Batch 2 — diff לאישור — 7 verifyBiz endpoints
מסמך עבודה · OneFlow Life · 25.08.2026

---

## רקע

7 endpoints עסק: service-areas (3), location (1), radius-zones (3).
Pattern אחיד: `verifyBiz` + `parseInt(req.params.groupId) !== req.bizAuth.groupId`.
DELETE עם areaId/zoneId — ה-SQL כבר מסנן את ה-id המשני, groupId check מספיק.

---

## #8 — GET /api/biz/service-areas/:groupId (~5207)
עסק מביא את אזורי השירות שלו.
```diff
-app.get('/api/biz/service-areas/:groupId', async (req, res) => {
+app.get('/api/biz/service-areas/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM biz_service_areas WHERE business_group_id=$1 ORDER BY created_at', [req.params.groupId]);
```

---

## #9 — POST /api/biz/service-areas/:groupId (~5214)
עסק מוסיף/מעדכן אזור שירות.
```diff
-app.post('/api/biz/service-areas/:groupId', async (req, res) => {
+app.post('/api/biz/service-areas/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { city, radius_km = 10, lat: clientLat, lng: clientLng } = req.body;
```

---

## #10 — DELETE /api/biz/service-areas/:groupId/:areaId (~5231)
עסק מוחק אזור שירות.
ה-SQL כבר מסנן: `WHERE id=$areaId AND business_group_id=$groupId` — groupId check מגן על areaId.
```diff
-app.delete('/api/biz/service-areas/:groupId/:areaId', async (req, res) => {
+app.delete('/api/biz/service-areas/:groupId/:areaId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('DELETE FROM biz_service_areas WHERE id=$1 AND business_group_id=$2', [req.params.areaId, req.params.groupId]);
```

---

## #11 — POST /api/biz/location/:groupId (~5239)
עסק שומר מיקום גיאוגרפי (lat/lng/address) ב-store_settings.
```diff
-app.post('/api/biz/location/:groupId', async (req, res) => {
+app.post('/api/biz/location/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { lat, lng, address } = req.body;
```

---

## #12 — GET /api/biz/radius-zones/:groupId (~5252)
עסק מביא מעגלי משלוח שלו.
```diff
-app.get('/api/biz/radius-zones/:groupId', async (req, res) => {
+app.get('/api/biz/radius-zones/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const r = await pool.query('SELECT * FROM biz_radius_delivery_zones WHERE group_id=$1 ORDER BY radius_km ASC', [req.params.groupId]);
```

---

## #13 — POST /api/biz/radius-zones/:groupId (~5259)
עסק מוסיף/מעדכן מעגל משלוח.
```diff
-app.post('/api/biz/radius-zones/:groupId', async (req, res) => {
+app.post('/api/biz/radius-zones/:groupId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         const { radius_km, delivery_fee } = req.body;
```

---

## #14 — DELETE /api/biz/radius-zones/:groupId/:zoneId (~5272)
עסק מוחק מעגל משלוח.
ה-SQL כבר מסנן: `WHERE id=$zoneId AND group_id=$groupId` — groupId check מגן על zoneId.
```diff
-app.delete('/api/biz/radius-zones/:groupId/:zoneId', async (req, res) => {
+app.delete('/api/biz/radius-zones/:groupId/:zoneId', verifyBiz, async (req, res) => {
     try {
+        if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
         await pool.query('DELETE FROM biz_radius_delivery_zones WHERE id=$1 AND group_id=$2', [req.params.zoneId, req.params.groupId]);
```

---

## סיכום Batch 2

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 8 | 5207 | GET | /biz/service-areas/:groupId | |
| 9 | 5214 | POST | /biz/service-areas/:groupId | |
| 10 | 5231 | DELETE | /biz/service-areas/:groupId/:areaId | SQL מסנן areaId |
| 11 | 5239 | POST | /biz/location/:groupId | |
| 12 | 5252 | GET | /biz/radius-zones/:groupId | |
| 13 | 5259 | POST | /biz/radius-zones/:groupId | |
| 14 | 5272 | DELETE | /biz/radius-zones/:groupId/:zoneId | SQL מסנן zoneId |

**שינוי לכל endpoint: 2 שורות בלבד. ללא שינוי לוגיקה.**

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 7 השינויים + commit + push.
סיום קבוצת areas & link — 14 endpoints מאובטחים.
