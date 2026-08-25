# Professional Batch — תוכנית אבטחה — 22 endpoints
מסמך תכנון · OneFlow Life · 25.08.2026

---

## תשובות ל-4 שאלות הבסיס

### שאלה 1: מי המשתמש?
**עסק בלבד** — verifyBiz לכל פעולת כתיבה/קריאה פרטית.

לקוחות העסק הם **חיצוניים לאפליקציה** — אין להם user/group בטבלת users.
- אין `client_group_id` בטבלת `professional_documents`
- הלקוח מזוהה רק לפי שדות: `customer_name`, `customer_email`, `customer_phone`

### שאלה 2: סיווג 22 endpoints
ראה טבלה מלאה למטה.

### שאלה 3: signing link — מקרה מיוחד?
**לא — אין API ציבורי לחתימה.**

- send-email (שורה 19574) שולח את תוכן המסמך כ-HTML email ללקוח
- אם יש `signature_data` — היא כבר נשמרת ומוצגת ב-email
- **לא קיים link נפרד לחתימה ציבורית**
- `PATCH /professional-documents/:id` נקרא רק מה-dashboard של העסק (business-app.js שורות 51933, 52281)
- **מסקנה:** PATCH + verifyBiz + record ownership — מספיק. אין מקרה מיוחד.

### שאלה 4: DB schema + ownership
| טבלה | עמודת ownership | lookup |
|---|---|---|
| `professional_content` | `group_id` | `WHERE group_id=$bizAuth.groupId` |
| `professional_expertise` | `group_id` | `WHERE id=$1 AND group_id=$2` |
| `professional_articles` | `group_id` | `WHERE id=$1 AND group_id=$2` |
| `professional_leads` | `group_id` | `WHERE id=$1 AND group_id=$2` |
| `professional_documents` | `group_id` | `WHERE id=$1 AND group_id=$2` |
| `professional_document_versions` | ❌ אין group_id | JOIN: `WHERE pv.id=$1 AND pd.group_id=$2` |
| `professional_doc_types` | `group_id` | `WHERE id=$1 AND group_id=$2` |

---

## מיפוי 22 endpoints לפי קבוצות

### קבוצה P — ציבורי (4 endpoints)
*תוכן של אתר פרופשיונלי — גלוי לכל גולש*

| # | שורה | method | path |
|---|---|---|---|
| 1 | 19394 | GET | /api/professional-content/:groupId |
| 2 | 19414 | GET | /api/professional-expertise/:groupId |
| 3 | 19446 | GET | /api/professional-articles/:groupId |
| 4 | 19485 | POST | /api/professional-leads/:groupId |

**הסבר:**
- GET endpoints — אתר האינטרנט של העסק קורא אותם (לא רק ה-dashboard)
- POST /professional-leads — טופס "צור קשר" מהאתר, כל גולש יכול לשלוח
- אין שינוי middleware — נשארים ציבוריים

---

### קבוצה A — verifyBiz + groupId ownership (9 endpoints)
*groupId נשלח ב-params → בדיקה: `parseInt(req.params.groupId) !== req.bizAuth.groupId`*

| # | שורה | method | path |
|---|---|---|---|
| 5 | 19400 | POST | /api/professional-content/:groupId |
| 6 | 19420 | POST | /api/professional-expertise/:groupId |
| 7 | 19456 | POST | /api/professional-articles/:groupId |
| 8 | 19479 | GET | /api/professional-leads/:groupId |
| 9 | 19506 | GET | /api/professional-documents/:groupId |
| 10 | 19520 | POST | /api/professional-documents/:groupId |
| 11 | 19608 | GET | /api/professional-doc-types/:groupId |
| 12 | 19614 | POST | /api/professional-doc-types/:groupId |
| 13 | 19632 | GET | /api/professional/dashboard/:groupId |

**pattern לכל אחד:**
```diff
-app.METHOD('/api/professional-X/:groupId', async (req, res) => {
+app.METHOD('/api/professional-X/:groupId', verifyBiz, async (req, res) => {
+    if (parseInt(req.params.groupId) !== req.bizAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

### קבוצה B — verifyBiz + record ownership DB (9 endpoints)
*record_id ב-params → SELECT ... WHERE id=$1 AND group_id=$2*

| # | שורה | method | path | טבלת ownership |
|---|---|---|---|---|
| 14 | 19430 | PATCH | /api/professional-expertise/:id | professional_expertise |
| 15 | 19440 | DELETE | /api/professional-expertise/:id | professional_expertise |
| 16 | 19466 | PATCH | /api/professional-articles/:id | professional_articles |
| 17 | 19473 | DELETE | /api/professional-articles/:id | professional_articles |
| 18 | 19496 | PATCH | /api/professional-leads/:id | professional_leads |
| 19 | 19531 | PATCH | /api/professional-documents/:id | professional_documents |
| 20 | 19567 | GET | /api/professional-documents/:id/versions | ⚠️ JOIN |
| 21 | 19574 | POST | /api/professional-documents/:id/send-email | professional_documents |
| 22 | 19600 | DELETE | /api/professional-documents/:id | professional_documents |
| 23 | 19625 | DELETE | /api/professional-doc-types/:id | professional_doc_types |

**pattern רגיל (endpoints 14–19, 21–23):**
```diff
-app.METHOD('/api/professional-X/:id', async (req, res) => {
+app.METHOD('/api/professional-X/:id', verifyBiz, async (req, res) => {
+    const _chk = await pool.query('SELECT 1 FROM professional_X WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+    if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

**⚠️ endpoint 20 — GET /versions — אין group_id בטבלת versions:**
```diff
-app.get('/api/professional-documents/:id/versions', async (req, res) => {
+app.get('/api/professional-documents/:id/versions', verifyBiz, async (req, res) => {
+    const _chk = await pool.query('SELECT 1 FROM professional_documents WHERE id=$1 AND group_id=$2', [req.params.id, req.bizAuth.groupId]);
+    if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```
*(מאמתים שה-document_id שייך לעסק, לא צריך JOIN — verifyBiz.groupId מגן)*

---

## סיכום לפי מספרים

| קבוצה | תיאור | כמות |
|---|---|---|
| P | ציבורי — ללא שינוי | 4 |
| A | verifyBiz + groupId param | 9 |
| B | verifyBiz + DB ownership | 10 |
| **סה"כ** | | **23** |

*(הספירה 22/23 — כי /dashboard נספר לפעמים נפרד; סה"כ 23 routes)*

---

## להמשך

לאחר קבלת "מאושר" — חלוקה ל-batches (9+9+5 / 12+11 / לפי קבוצות A+B).
