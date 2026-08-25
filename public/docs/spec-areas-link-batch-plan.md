# Areas & Link Batch — תוכנית אבטחה — 14 endpoints
מסמך תכנון · OneFlow Life · 25.08.2026

---

## תשובות ל-3 שאלות

### שאלה 1: סיווג verifyFamily / verifyBiz

**verifyFamily — 7 endpoints:**
| # | שורה | method | path |
|---|---|---|---|
| 1 | 1964 | POST | /api/family/link-request |
| 2 | 1995 | GET | /api/family/link-requests/:groupId |
| 3 | 2011 | POST | /api/family/link-request/:id/respond |
| 4 | 5280 | GET | /api/family/preferred-areas/:groupId |
| 5 | 5287 | POST | /api/family/preferred-areas/:groupId |
| 6 | 5305 | DELETE | /api/family/preferred-areas/:groupId/:areaId |
| 7 | 21957 | GET | /api/family/linked-businesses/:groupId |

**verifyBiz — 7 endpoints:**
| # | שורה | method | path |
|---|---|---|---|
| 8 | 5207 | GET | /api/biz/service-areas/:groupId |
|  9 | 5214 | POST | /api/biz/service-areas/:groupId |
| 10 | 5231 | DELETE | /api/biz/service-areas/:groupId/:areaId |
| 11 | 5239 | POST | /api/biz/location/:groupId |
| 12 | 5252 | GET | /api/biz/radius-zones/:groupId |
| 13 | 5259 | POST | /api/biz/radius-zones/:groupId |
| 14 | 5272 | DELETE | /api/biz/radius-zones/:groupId/:zoneId |

---

### שאלה 2: family_link_requests — מורכבות respond

**שלושת endpoints ה-link-request:**

**#1 — POST /link-request (שולח בקשה):**
- body: `{ requesterGroupId, targetPhone, role }`
- IDOR: `parseInt(requesterGroupId) !== familyAuth.groupId`
- המשפחה ששולחת הבקשה חייבת להיות מחוברת בטוקן שלה

**#2 — GET /link-requests/:groupId (מביא בקשות ממתינות):**
- query: `WHERE target_group_id=$groupId AND status='pending'`
- אלה בקשות שמיועדות ל-groupId — **רק הנמען רואה את הבקשות שלו**
- IDOR: `parseInt(groupId) !== familyAuth.groupId`

**#3 — POST /link-request/:id/respond (אישור/דחייה):**
- body: `{ decision, targetGroupId }`
- השאלה: מי מורשה לענות? — **רק הנמען (target), לא השולח**
- הקוד כבר מאמת ב-SQL: `WHERE id=$1 AND target_group_id=$2`
- כלומר: אם targetGroupId ≠ target_group_id שב-DB — הבקשה לא נמצאת (404)
- מה שצריך להוסיף: verifyFamily + `parseInt(targetGroupId) !== familyAuth.groupId`
- כך: טוקן של המשתמש חייב להתאים ל-targetGroupId שנשלח ב-body,
  וה-SQL מאמת שהבקשה אכן מיועדת אליו — **כפל הגנה**

---

### שאלה 3: GET /linked-businesses/:groupId — מה זה?

**שני מנגנונים שונים לחלוטין:**

| מנגנון | טבלה | בין מי לבין מי | endpoint |
|---|---|---|---|
| family_link_requests | family_link_requests | family ↔ family | /link-request |
| linked-businesses | beauty_client_records + member_business_links | family ↔ business | /linked-businesses |

**linked-businesses אינו קשור ל-link-request כלל.**
הוא מאחד שתי טבלות:
1. `beauty_client_records` — לקוח שמשפחה נרשמה לעסק יופי
2. `member_business_links` — חברות: ספורט, מסעדה, תיקון וכד'

השם "linked-businesses" תקין — משפחה רואה את **העסקים שהיא מחוברת אליהם**.

---

## מיפוי IDOR לפי endpoint

### קבוצה F (verifyFamily) — פרוט בדיקות

| # | path | groupId נמצא ב | בדיקת IDOR |
|---|---|---|---|
| 1 | POST /link-request | `req.body.requesterGroupId` | `parseInt(requesterGroupId) !== familyAuth.groupId` |
| 2 | GET /link-requests/:groupId | `req.params.groupId` | `parseInt(groupId) !== familyAuth.groupId` |
| 3 | POST /link-request/:id/respond | `req.body.targetGroupId` | `parseInt(targetGroupId) !== familyAuth.groupId` |
| 4 | GET /preferred-areas/:groupId | `req.params.groupId` | `parseInt(groupId) !== familyAuth.groupId` |
| 5 | POST /preferred-areas/:groupId | `req.params.groupId` | `parseInt(groupId) !== familyAuth.groupId` |
| 6 | DELETE /preferred-areas/:groupId/:areaId | `req.params.groupId` | `parseInt(groupId) !== familyAuth.groupId` |
| 7 | GET /linked-businesses/:groupId | `req.params.groupId` | `parseInt(groupId) !== familyAuth.groupId` |

**הערה #6:** ה-SQL כבר מסנן `AND family_group_id=$groupId` — בדיקת groupId מספיקה, אין צורך ב-areaId ownership נפרד.

**הערה #3:** ה-SQL כבר בודק `AND target_group_id=$targetGroupId` — כפל הגנה.

### קבוצה B (verifyBiz) — פרוט בדיקות

| # | path | groupId נמצא ב | הערה |
|---|---|---|---|
| 8 | GET /service-areas/:groupId | `req.params.groupId` | IDOR param |
| 9 | POST /service-areas/:groupId | `req.params.groupId` | IDOR param |
| 10 | DELETE /service-areas/:groupId/:areaId | `req.params.groupId` | SQL כבר מסנן areaId |
| 11 | POST /location/:groupId | `req.params.groupId` | IDOR param |
| 12 | GET /radius-zones/:groupId | `req.params.groupId` | IDOR param |
| 13 | POST /radius-zones/:groupId | `req.params.groupId` | IDOR param |
| 14 | DELETE /radius-zones/:groupId/:zoneId | `req.params.groupId` | SQL כבר מסנן zoneId |

---

## חלוקה ל-batches

**Batch 1 (7):** כל verifyFamily (#1-#7)
**Batch 2 (7):** כל verifyBiz (#8-#14)
