# Work Orders Batch — תוכנית אבטחה — 30 endpoints
מסמך תכנון · OneFlow Life · 25.08.2026

---

## תשובות ל-4 שאלות

### שאלה 1: מי המשתמש?

**עסק בלבד — verifyBiz לכולם.**

- לקוחות הם חיצוניים (`customer_name`, `customer_phone` בלבד)
- `family_group_id` ב-store_orders משמש רק ל-notifications (push ל-family app) — אין גישה ישירה ל-API
- אין track/:token, אין endpoints ציבוריים

### שאלה 2: סיווג 30 endpoints

ראה טבלה מלאה למטה — 3 קבוצות:
- **A:** groupId ישיר ב-params (9 endpoints)
- **B:** work order ownership דרך store_orders (19 endpoints)
- **C:** payment ownership דרך work_order_payments (2 endpoints)

### שאלה 3: קשר work_orders ↔ professional_documents

`professional_documents.work_order_id` = `store_orders.id`

- שניהם שייכים לאותו `group_id` (העסק)
- professional_documents כבר מאובטח (batch2 commit 1c3072b) — ownership check ב-PATCH/DELETE
- אין cross-ownership בעיה: אי אפשר לגשת למסמך של עסק אחר דרך work_order_id

### שאלה 4: מבנה store_orders (= work_orders)

store_orders משמש כטבלת work_orders עם `call_type='work_order'`:

| עמודה | תפקיד |
|---|---|
| `group_id` | **owner** — העסק |
| `customer_name`, `customer_phone` | לקוח חיצוני |
| `family_group_id` | אופציונלי — לnotifications בלבד |
| `call_type='work_order'` | מבדיל מ-orders רגילים |

---

## ⚠️ 4 הבחנות קריטיות לbatches

### א. endpoint 10545 — מושך service_calls (לא store_orders)
```
GET /api/work-orders/:businessGroupId (שורה 10545)
```
זה endpoint ישן מסקציית service_calls שמשמש גם לwork_orders.
מסנן לפי `sc.business_group_id=$businessGroupId` (לא `group_id`).
ownership check: `parseInt(req.params.businessGroupId) !== req.bizAuth.groupId`

### ב. POST /convert/:quoteId — quoteId הוא store_orders.id
ownership check: `SELECT 1 FROM store_orders WHERE id=$quoteId AND group_id=$2`

### ג. calendar + purchase-orders POST — groupId בbody (לא params)
שני endpoints עם groupId ב-body:
- POST /:id/calendar — `{ groupId, ... }`
- POST /:id/purchase-orders — `{ groupId, ... }`

צריך **שני אימותים**: work order ownership (דרך :id) + `parseInt(groupId) !== bizAuth.groupId`

### ד. payments ownership — אין group_id ישיר ב-work_order_payments
payment יכול להיות של work_order **OR** service_call:
- work_order: `JOIN store_orders WHERE so.group_id = $bizAuth.groupId`
- service_call: `JOIN service_calls WHERE sc.business_group_id = $bizAuth.groupId`

ownership check לpayments:
```js
const pr = await pool.query('SELECT wop.work_order_id, wop.service_call_id, so.group_id as wo_group, sc.business_group_id as sc_group FROM work_order_payments wop LEFT JOIN store_orders so ON so.id=wop.work_order_id LEFT JOIN service_calls sc ON sc.id=wop.service_call_id WHERE wop.id=$1', [paymentId]);
const p = pr.rows[0];
const ownerGroupId = p.wo_group || p.sc_group;
if (ownerGroupId !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## מיפוי 30 endpoints

### קבוצה A — verifyBiz + groupId ישיר ב-params (9 endpoints)

| # | שורה | method | path | ownership field |
|---|---|---|---|---|
| 1 | 10545 | GET | /work-orders/:businessGroupId | `params.businessGroupId` |
| 2 | 18793 | GET | /work-orders/list/:groupId | `params.groupId` |
| 3 | 18809 | GET | /work-orders/profitability/:groupId | `params.groupId` |
| 4 | 18828 | POST | /work-orders/new/:groupId | `params.groupId` |
| 5 | 18896 | GET | /work-orders/users/:groupId | `params.groupId` |
| 6 | 18939 | GET | /work-orders/catalog/:groupId | `params.groupId` |
| 7 | 19226 | GET | /work-orders/purchase-orders/group/:groupId | `params.groupId` |
| 8 | 19753 | GET | /work-orders/collection/:groupId | `params.groupId` |
| 9 | 19788 | GET | /work-orders/collection-alerts/:groupId | `params.groupId` |

### קבוצה B — verifyBiz + work order ownership (19 endpoints)
*pattern: `SELECT 1 FROM store_orders WHERE id=$1 AND group_id=$2` על :id/:woId/:quoteId*

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 10 | 18763 | POST | /work-orders/convert/:quoteId | quoteId = store_orders.id |
| 11 | 18839 | GET | /work-orders/detail/:id | |
| 12 | 18861 | PUT | /work-orders/:id/status | |
| 13 | 11871 | PUT | /work-orders/:woId/assignees/:userId/cost | woId = store_orders.id |
| 14 | 18903 | POST | /work-orders/:id/assignees | |
| 15 | 18930 | DELETE | /work-orders/:id/assignees/:userId | SQL מסנן userId |
| 16 | 18982 | POST | /work-orders/:id/inventory | |
| 17 | 19044 | POST | /work-orders/:id/inventory/:resId/use | SQL: `AND work_order_id=$id` |
| 18 | 19062 | DELETE | /work-orders/:id/inventory/:resId | SQL: `AND work_order_id=$id` |
| 19 | 19078 | GET | /work-orders/:id/messages | |
| 20 | 19085 | POST | /work-orders/:id/messages | |
| 21 | 19096 | PUT | /work-orders/:id/notes | |
| 22 | 19106 | GET | /work-orders/:id/timeline | |
| 23 | 19113 | POST | /work-orders/:id/calendar | ⚠️ groupId גם בbody |
| 24 | 19127 | GET | /work-orders/:id/purchase-orders | |
| 25 | 19140 | POST | /work-orders/:id/purchase-orders | ⚠️ groupId גם בbody |
| 26 | 19172 | PATCH | /work-orders/:id/purchase-orders/:poId/status | SQL: `AND work_order_id=$id` |
| 27 | 19246 | GET | /work-orders/:id/payments | |
| 28 | 19256 | POST | /work-orders/:id/payments | |

### קבוצה C — verifyBiz + payment ownership (2 endpoints)
*pattern: JOIN דרך work_order_payments→store_orders/service_calls*

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 29 | 19283 | PATCH | /work-orders/payments/:paymentId/receive | work_order OR service_call |
| 30 | 19337 | DELETE | /work-orders/payments/:paymentId | work_order OR service_call |

---

## חלוקה מוצעת ל-batches

**Batch 1 (9):** קבוצה A (groupId ישיר)
**Batch 2 (10):** קבוצה B — endpoints #10-#19
**Batch 3 (9):** קבוצה B #20-#28 + קבוצה C #29-#30

---

## לאישורך לפני diff

שאלה אחת פתוחה: האם לאמת `parseInt(groupId) !== bizAuth.groupId` ב-#23 ו-#25 בנוסף לwork order ownership, או שלדלג על בדיקת ה-body.groupId (כי work order ownership מספיק — אם :id שייך לעסק, ה-groupId בbody הוא redundant)?

המלצה: **כן לאמת גם את body.groupId** — עקביות עם שאר הcodebase, קוד שולח לעצמו groupId ומצפה שיאמת.
