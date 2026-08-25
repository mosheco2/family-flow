# Beauty Batch — תוכנית אבטחה — 47 endpoints
מסמך תכנון · OneFlow Life · 25.08.2026

---

## תשובות ל-4 שאלות

### שאלה 1: מי המשתמשים?

**דו-כיווני — אך עם הפרדה ברורה:**

- **עסק (verifyBiz):** ניהול פנימי — practitioners, resources, inventory, dashboard, commissions, services, subscriptions, appointments (פתיחה ועדכון מנהל)
- **לקוח/family (verifyFamily):** RFQ — לקוח שולח/עונה/מקבל תכנית; לקוח רואה את ה-RFQ שלו
- **Public לגיטימי:** הצגת עסקי יופי לרשימה, availability לבדיקת זמינות, check-oneflow לחיפוש משתמש
- **booking_source נקבע בקוד:** `src === 'biz'` → status=`pending_client` (לקוח צריך לאשר). `src === 'family'` → `confirmed`. כלומר POST appointments יכול להגיע **גם מהלקוח** (booking_source='family') וגם מהעסק — זה endpoint **כפול-מקור** שדורש טיפול מיוחד.

### שאלה 2: סיווג 47 endpoints

ראה טבלה מלאה למטה.

### שאלה 3: beauty_client_records — ownership

```
beauty_client_records:
  business_group_id  → העסק (owner, חובה)
  client_family_id   → nullable, הלקוח המקושר (אופציונלי — לקוח walk-in אין)
```

**ownership כפול:** הטבלה שייכת **לעסק** (business_group_id). הלקוח מופיע כ-FK אופציונלי.
- ניגשים ל-clients endpoints רק כ-verifyBiz.
- אין endpoint שמאפשר ל-family לגשת לrec שלהם ישירות.

### שאלה 4: beauty_appointments — ownership כפול

```
beauty_appointments:
  business_group_id  → העסק (owner)
  client_family_id   → הלקוח (nullable)
  booking_source     → 'biz' | 'family'
```

- **POST appointments (21671):** יכול להגיע **מעסק** (booking_source='biz') **או מלקוח** (booking_source='family').
- **⚠️ מסקנה:** POST /appointments הוא endpoint כפול-מקור. פתרון נכון:
  - אם booking_source='family' → verifyFamily + `parseInt(client_family_id) !== familyAuth.groupId`
  - אם booking_source='biz' → verifyBiz + `parseInt(bizId) !== bizAuth.groupId`
  - **פתרון מעשי:** `verifyFamilyOrBiz` (כמו שכבר קיים למקומות אחרים) — middleware שמנסה את שניהם + בדיקה לפי booking_source

---

## ⚠️ 5 הבחנות קריטיות

### א. POST /appointments — כפול-מקור
לפי `booking_source` בbody:
- `'family'` → verifyFamily, IDOR על `client_family_id`
- `'biz'` → verifyBiz, IDOR על `bizId` בparams
- **פתרון:** endpoint אחד עם בדיקה לפי booking_source, ללא שינוי לוגיקה.

### ב. RFQ endpoints (/beauty/rfq/*) — ללא :bizId בpath
- POST /beauty/rfq — לקוח פותח בקשה → verifyFamily, IDOR על `client_family_id` בbody
- PATCH /rfq/:id/questionnaire — עסק שולח שאלון → verifyBiz, ownership דרך beauty_rfq.business_group_id
- POST /rfq/:id/client-response — לקוח עונה → verifyFamily, ownership דרך beauty_rfq.client_family_id
- POST /rfq/:id/plan — עסק שולח תכנית → verifyBiz, ownership
- POST /rfq/:id/accept — **לקוח מקבל** → verifyFamily, ownership
- POST /rfq/:id/message — **שניהם** → verifyFamilyOrBiz, ownership דו-צדדי

### ג. GET /beauty/businesses — public לגיטימי
רשימת עסקי יופי — לקוח מחפש עסק לפני חיבור. **אין מידע רגיש.** נשאר ללא middleware.

### ד. GET /beauty/:bizId/availability — public לגיטימי
בדיקת זמינות לפני הזמנת תור. מידע לא-אישי. **נשאר ללא middleware.**

### ה. GET /beauty/:bizId/check-oneflow — verifyBiz
חיפוש לקוח לפי טלפון/שם ברשומות הפנימיות. כלי ניהולי — **verifyBiz בלבד.**

### ו. GET /beauty/rfq/family/:familyId — verifyFamily
לקוח רואה את הRFQ שלו. IDOR על familyId.

---

## מיפוי 47 endpoints

### קבוצה BIZ_A — verifyBiz + bizId ישיר (25 endpoints)

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 1 | 21582 | GET | /beauty/:bizId/practitioners | |
| 2 | 21592 | POST | /beauty/:bizId/practitioners | |
| 3 | 21606 | PATCH | /beauty/:bizId/practitioners/:id | SQL: `AND business_group_id=$bizId` |
| 4 | 21619 | GET | /beauty/:bizId/resources | |
| 5 | 21626 | POST | /beauty/:bizId/resources | |
| 6 | 21637 | PATCH | /beauty/:bizId/resources/:id | SQL: `AND business_group_id=$bizId` |
| 7 | 21649 | GET | /beauty/:bizId/appointments | |
| 8 | 21797 | PATCH | /beauty/:bizId/appointments/:id | SQL: `AND business_group_id=$bizId` |
| 9 | 21852 | POST | /beauty/:bizId/appointments/:id/complete | SQL: `AND business_group_id=$bizId` |
| 10 | 21932 | POST | /beauty/:bizId/appointments/:id/no-show | SQL: `AND business_group_id=$bizId` |
| 11 | 21967 | GET | /beauty/:bizId/clients | |
| 12 | 21979 | GET | /beauty/:bizId/clients/:id | SQL: `AND business_group_id=$bizId` |
| 13 | 21998 | GET | /beauty/:bizId/check-oneflow | |
| 14 | 22258 | POST | /beauty/:bizId/clients | |
| 15 | 22272 | PATCH | /beauty/:bizId/clients/:id | SQL: `AND business_group_id=$bizId` |
| 16 | 22286 | POST | /beauty/:bizId/clients/:id/formulas | ⚠️ client_record_id=:id, לא business_group_id |
| 17 | 22299 | GET | /beauty/:bizId/clients/:id/formulas | ⚠️ client_record_id=:id |
| 18 | 22307 | POST | /beauty/:bizId/clients/:id/photos | ⚠️ client_record_id=:id |
| 19 | 22320 | GET | /beauty/:bizId/clients/:id/photos | ⚠️ client_record_id=:id |
| 20 | 22328 | GET | /beauty/:bizId/inventory | |
| 21 | 22340 | POST | /beauty/:bizId/inventory | |
| 22 | 22353 | PATCH | /beauty/:bizId/inventory/:id | SQL: `AND business_group_id=$bizId` |
| 23 | 22365 | POST | /beauty/:bizId/inventory/:id/adjust | SQL: `AND business_group_id=$bizId` |
| 24 | 22376 | GET | /beauty/:bizId/dashboard | |
| 25 | 22443 | GET | /beauty/:bizId/inventory/alerts | |
| 26 | 22454 | GET | /beauty/:bizId/commissions | |
| 27 | 22473 | POST | /beauty/:bizId/commissions/pay | SQL: `AND business_group_id=$bizId` |
| 28 | 22485 | GET | /beauty/:bizId/rfq | |
| 29 | 22589 | GET | /beauty/:bizId/services | |
| 30 | 22599 | POST | /beauty/:bizId/services | |
| 31 | 22615 | PATCH | /beauty/:bizId/services/:id | SQL: `AND business_group_id=$bizId` |
| 32 | 22628 | GET | /beauty/:bizId/subscription-types | |
| 33 | 22638 | POST | /beauty/:bizId/subscription-types | |
| 34 | 22652 | PATCH | /beauty/:bizId/subscription-types/:id | SQL: `AND business_group_id=$bizId` |
| 35 | 22665 | GET | /beauty/:bizId/client-subscriptions/:clientId | SQL: `AND business_group_id=$bizId` |
| 36 | 22679 | POST | /beauty/:bizId/client-subscriptions | |
| 37 | 22695 | PATCH | /beauty/:bizId/client-subscriptions/:id/use | SQL: `AND business_group_id=$bizId` |

### קבוצה RFQ_BIZ — verifyBiz + ownership דרך beauty_rfq (3 endpoints)

| # | שורה | method | path | ownership |
|---|---|---|---|---|
| 38 | 22508 | PATCH | /beauty/rfq/:id/questionnaire | beauty_rfq.business_group_id |
| 39 | 22533 | POST | /beauty/rfq/:id/plan | beauty_rfq.business_group_id |
| 40 | 22554 | POST | /beauty/rfq/:id/message | ⚠️ גם family — verifyFamilyOrBiz |

### קבוצה RFQ_FAMILY — verifyFamily (3 endpoints)

| # | שורה | method | path | ownership |
|---|---|---|---|---|
| 41 | 22497 | POST | /beauty/rfq | body.client_family_id |
| 42 | 22519 | POST | /beauty/rfq/:id/client-response | beauty_rfq.client_family_id |
| 43 | 22544 | POST | /beauty/rfq/:id/accept | beauty_rfq.client_family_id |

### קבוצה FAMILY — verifyFamily (1 endpoint)

| # | שורה | method | path | ownership |
|---|---|---|---|---|
| 44 | 22576 | GET | /beauty/rfq/family/:familyId | params.familyId |

### קבוצה DUAL — appointments POST כפול-מקור (1 endpoint)

| # | שורה | method | path | הערה |
|---|---|---|---|---|
| 45 | 21671 | POST | /beauty/:bizId/appointments | booking_source='biz'→verifyBiz / 'family'→verifyFamily |

### קבוצה PUBLIC — ללא middleware (2 endpoints)

| # | שורה | method | path | נימוק |
|---|---|---|---|---|
| 46 | 21943 | GET | /beauty/:bizId/availability | מידע לא-אישי, נדרש לפני login |
| 47 | 22566 | GET | /beauty/businesses | רשימת עסקים ציבורית |

---

## ⚠️ 4 הבחנות לimplementation

### א. formulas ו-photos (#16-#19) — :id הוא client_record_id
```sql
-- ownership check: client_record_id שייך ל-bizId?
SELECT 1 FROM beauty_client_records WHERE id=$clientRecordId AND business_group_id=$bizId
```

### ב. POST /appointments (#45) — כפול-מקור
```js
if (req.body.booking_source === 'family') {
    // verifyFamily כבר רץ, בדוק client_family_id
    if (parseInt(req.body.client_family_id) !== req.familyAuth.groupId) ...
} else {
    // verifyBiz כבר רץ, בדוק bizId
    if (parseInt(req.params.bizId) !== req.bizAuth.groupId) ...
}
```

### ג. POST /rfq/:id/message (#40) — שניהם יכולים לשלוח
ownership: `beauty_rfq.business_group_id === bizAuth.groupId` OR `beauty_rfq.client_family_id === familyAuth.groupId`

### ד. בדיקת :id ב-PATCH/GET clients/:id — ownership בSQL
רוב ה-PATCH/GET כבר מסננים `AND business_group_id=$bizId` — bizId check מספיק.

---

## חלוקה מוצעת ל-5 batches (10+10+10+10+7)

**Batch 1 (10):** BIZ_A #1-#10 (practitioners, resources, appointments GET/PATCH/complete/no-show)
**Batch 2 (10):** BIZ_A #11-#20 (clients, check-oneflow, formulas, photos, inventory)
**Batch 3 (10):** BIZ_A #21-#30 (inventory adjust/dashboard/alerts, commissions, rfq GET, services)
**Batch 4 (7):** BIZ_A #31-#37 (services PATCH, subscription-types, client-subscriptions)
**Batch 5 (10):** RFQ_BIZ + RFQ_FAMILY + FAMILY + DUAL (endpoints #38-#47)

---

## שאלה פתוחה לאישורך

**POST /beauty/:bizId/appointments (#45)** — כפול-מקור:

**אפשרות א (מומלצת):** לוגיקת if/else בתוך ה-endpoint — verifyFamilyOrBiz + בדיקה לפי booking_source.

**אפשרות ב:** להשאיר public (המידע הרגיש ממילא מוגן ע"י bizId בSQL). פחות טוב — כל אחד יכול לפתוח תורים לכל עסק.

המלצה: **אפשרות א.**
