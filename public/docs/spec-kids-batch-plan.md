# Kids API — תכנית אבטחה (תכנון בלבד, ללא קוד)
מסמך עבודה · OneFlow Life · 25.08.2026

---

## ממצא מרכזי — מודל הזהות

**ילדים מתחברים בדיוק כמו הורים** — אותו `/api/login`, אותו family_session token (session_type='family').
`currentUser.role` קובע ADMIN/CHILD בלבד — לא את סוג ה-auth.

מסקנה: **verifyFamily עובד לכולם** (הורה + ילד). אין צורך ב-middleware נפרד.

---

## מודל שייכות ילד לקהילה

```sql
users WHERE id=$childId AND group_id=$familyAuth.groupId AND role='CHILD'
```

שורה אחת — ילד שייך למשפחה אם `group_id` שלו = groupId מהטוקן.

---

## סיווג 20 ה-endpoints

### קבוצה A — groupId ישיר (כמו community, פשוט)
בדיקה: `parseInt(groupId) !== req.familyAuth.groupId → 403`

| # | Endpoint | שדה |
|---|---|---|
| 1 | GET /parent-overview/:groupId | params.groupId |
| 8 | POST /config | body.familyGroupId |
| 11 | GET /redeem-requests | query.groupId (+ childId כבר מסונן ב-SQL) |
| 12 | POST /assign-game | body.familyGroupId |
| 16 | POST /quests | body.familyGroupId |

---

### קבוצה B — childId ownership (בדיקה דרך DB)
בדיקה:
```js
const child = await pool.query(
  'SELECT 1 FROM users WHERE id=$1 AND group_id=$2 AND role=\'CHILD\'',
  [childId, req.familyAuth.groupId]
);
if (!child.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

| # | Endpoint | שדה |
|---|---|---|
| 2 | POST /profile-image/:userId | params.userId |
| 7 | GET /config/:childId | params.childId |
| 9 | POST /redeem | body.childUserId |
| 13 | GET /assignments/:childId | params.childId |
| 17 | GET /quests/:childId | params.childId |

---

### קבוצה C — userId עצמי (הילד פועל על עצמו)
בדיקה: `parseInt(userId) !== req.familyAuth.userId → 403`

| # | Endpoint | שדה | הערה |
|---|---|---|---|
| 3 | GET /games | query.userId | ילד טוען משחקים לפי גיל עצמו |
| 4 | GET /wallet/:userId | params.userId | ילד טוען ארנק שלו |
| 5 | GET /free-play-check | query.childUserId | בדיקת זכאות עצמית |
| 6 | POST /award-flw | body.userId | זיכוי FLW לאחר משחק |
| 14 | POST /use-round | body.childUserId | ניצול סיבוב |
| 19 | POST /quests/:questId/submit | body.childUserId | הגשת קווסט |

---

### קבוצה D — parentId עצמי (הורה פועל כיוצר)
בדיקה: `parseInt(parentId) !== req.familyAuth.userId → 403`

| # | Endpoint | שדה |
|---|---|---|
| 20 | GET /parent-quests/:parentId | params.parentId (= created_by userId של ההורה) |

---

### קבוצה E — ownership דרך DB על record
בדיקה דרך join/lookup שמאמת ש-record שייך למשפחה מהטוקן.

| # | Endpoint | שדה | לוגיקת בדיקה |
|---|---|---|---|
| 15 | POST /renew-assignment/:id | params.id | `game_assignments WHERE id=$id AND family_group_id=$familyAuth.groupId` |
| 18 | GET /quests/:questId/questions | params.questId | `kid_quests WHERE id=$questId AND family_group_id=$familyAuth.groupId` |

---

## שאלה 4 — profile-image ב-`<img>` tag?

**לא בעיה.** קריאת profile-image ב-app.js היא **POST** (שמירת תמונה):
```js
fetch(`${API}/kids/profile-image/${kidId}`, { method:'POST', ... })
```
תמונה עצמה נטענת ב-`<img src="/uploads/avatars/avatar_X.jpg">` — קובץ סטטי, לא endpoint.
לכן: verifyFamily רגיל — אין בעיה.

---

## סיכום middleware לכל 20

| # | Endpoint | Middleware | בדיקת IDOR |
|---|---|---|---|
| 1 | GET /parent-overview/:groupId | verifyFamily | A — groupId |
| 2 | POST /profile-image/:userId | verifyFamily | B — child ownership |
| 3 | GET /games | verifyFamily | C — userId עצמי |
| 4 | GET /wallet/:userId | verifyFamily | C — userId עצמי |
| 5 | GET /free-play-check | verifyFamily | C — childUserId עצמי |
| 6 | POST /award-flw | verifyFamily | C — userId עצמי |
| 7 | GET /config/:childId | verifyFamily | B — child ownership |
| 8 | POST /config | verifyFamily | A — familyGroupId |
| 9 | POST /redeem | verifyFamily | B — child ownership |
| 10 | POST /redeem-request | verifyFamily | C — childUserId עצמי |
| 11 | GET /redeem-requests | verifyFamily | A — groupId |
| 12 | POST /assign-game | verifyFamily | A — familyGroupId |
| 13 | GET /assignments/:childId | verifyFamily | B — child ownership |
| 14 | POST /use-round | verifyFamily | C — childUserId עצמי |
| 15 | POST /renew-assignment/:id | verifyFamily | E — assignment ownership |
| 16 | POST /quests | verifyFamily | A — familyGroupId |
| 17 | GET /quests/:childId | verifyFamily | B — child ownership |
| 18 | GET /quests/:questId/questions | verifyFamily | E — quest ownership |
| 19 | POST /quests/:questId/submit | verifyFamily | C — childUserId עצמי |
| 20 | GET /parent-quests/:parentId | verifyFamily | D — parentId עצמי |

---

## 3 patterns של קוד (להכנה לbatch)

**Pattern A (groupId ישיר):**
```js
app.get('/api/kids/parent-overview/:groupId', verifyFamily, async (req, res) => {
    try {
        const gid = req.params.groupId;
+       if (parseInt(gid) !== req.familyAuth.groupId) return res.status(403).json({ error: 'אין הרשאה' });
```

**Pattern B (child ownership):**
```js
app.post('/api/kids/redeem', verifyFamily, async (req, res) => {
    try {
        const { childUserId, ... } = req.body;
+       const _chk = await pool.query('SELECT 1 FROM users WHERE id=$1 AND group_id=$2', [childUserId, req.familyAuth.groupId]);
+       if (!_chk.rows.length) return res.status(403).json({ error: 'אין הרשאה' });
```

**Pattern C (userId עצמי):**
```js
app.get('/api/kids/wallet/:userId', verifyFamily, async (req, res) => {
    try {
        const { userId } = req.params;
+       if (parseInt(userId) !== req.familyAuth.userId) return res.status(403).json({ error: 'אין הרשאה' });
```

---

## הערה על award-flw ו-use-round

שני endpoints אלה זוכים FLW לאחר משחק. הלקוח שולח את `flwEarned` — ניתן למניפולציה.
**לא נוגעים בלוגיקה הקיימת** — יש כבר `maxDaily` cap שמגן בצד שרת.
verifyFamily + userId עצמי מספיק לשלב זה.

---

## לאישור

לאחר קבלת "מאושר" — ביצוע כל 20 השינויים + commit + push.
