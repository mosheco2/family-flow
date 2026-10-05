# מסמך אפיון — סביבת FAMILY | Oneflow Life

> גרסה: 2026-06-20 | מבוסס על קוד: `public/app.js`, `public/index.html`, `server1.js`

---

## 1. ארכיטקטורה וכניסה

### 1.1 זהות הסביבה

| פרמטר | ערך |
|---|---|
| URL | `/` (root) — `index.html` |
| קובץ HTML | `public/index.html` |
| קובץ JS ראשי | `public/app.js` |
| סוג קבוצה (DB) | `type = 'FAMILY'` |
| שם מוצר | Oneflow Life |
| כתובת ייצור | `https://www.oneflowlife.co.il` |

**4 סביבות במערכת:**
- `FAMILY` (`/`) — האפליקציה למשפחות (מסמך זה)
- `BUSINESS` (`/business.html`) — לעסקים
- `SUPER-ADMIN` — פאנל ניהול מערכת
- `ZONE-MANAGER` — מנהל קהילה / אזור

**ניתוב אוטומטי:** בעת login, אם `currentGroup.type === 'BUSINESS'` → המערכת מנתבת לאוטומטית ל-`/business.html`.

### 1.2 תהליך כניסה (Login Flow)

**שלב 1 — Preloader:** מציג ספינר עם לוגו בעת טעינה. timeout failsafe של 7 שניות.

**שלב 2 — בדיקת session קיים:**
```
localStorage.getItem('ofl_session')
→ JSON.parse → אם קיים ותקף → loadDashboard()
→ אחרת → hidePreloaderAndShowAuth('login')
```

**3 מסכי Auth:**

| מסך | תיאור |
|---|---|
| `view-login` | כניסה עם קוד סביבה + כינוי + סיסמה |
| `view-create` | הקמת סביבה חדשה (משפחה או עסק) |
| `view-join` | הצטרפות לסביבה קיימת עם קוד |

**טופס Login (POST /api/login):**
- `groupCode` — קוד הסביבה (6 תווים, אותיות+ספרות, UPPERCASE)
- `nickname` — כינוי המשתמש
- `password` — סיסמה

**טופס Create (POST /api/groups):**
- סוג: FAMILY / BUSINESS
- שם המשפחה / העסק
- מייל מנהל
- שם פרטי + שם משפחה
- כינוי משפחה (אופציונלי)
- שנת לידה
- מספר טלפון (חובה מגיל 10)
- סיסמה
- אישור תקנון (חובה)
- הסכמת שיווק (רשות)

**טופס Join (POST /api/join):**
- קוד כניסה
- שם
- שנת לידה
- טלפון (חובה מגיל 10)
- סיסמה
- אישור תקנון

לאחר Join — נשלחת בקשה לאישור מנהל. המשתמש נכנס למצב `status: 'pending'`.

**URL Invite:** `/?code=XXXXX&role=MEMBER` — ממלא אוטומטית את הטופס.

**OTP:** מיושם עבור Super Admin בלבד (Twilio SMS). לא בשימוש בסביבת FAMILY.

### 1.3 אחרי Login — loadDashboard()

1. מסתיר `auth-container`, מציג `dashboard-container`
2. שולף session מ-localStorage
3. מציג שם הקבוצה + קוד + שם המשתמש
4. מגדיר הרשאות לפי role (ADMIN / MEMBER/CHILD)
5. מפעיל polling כל 30 שניות (`fetchData`, `fetchLoans`, אם ADMIN → `fetchPendingUsers`)
6. מפעיל `refreshBellBadge` כל 30 שניות
7. מפעיל `startMyOrdersAutoRefresh` (כל 20 שניות, רק כשב-myorders tab)
8. קורא `fetchBanners`, `fetchMembers`, `fetchData`, `fetchLoans`
9. בדיקת `must_change_password` → הצגת דף שינוי סיסמה
10. בדיקת הודעת welcome גלובלית (`checkGlobalWelcome`)
11. הפעלת Tour `checkAndStartTour(forceTourStart)`

### 1.4 מבנה currentUser ו-currentGroup

```javascript
currentUser = {
  id: INT,
  nickname: STRING,
  first_name: STRING,
  last_name: STRING,
  birth_year: INT,
  role: 'ADMIN' | 'MEMBER',          // MEMBER = ילד/ה
  balance: DECIMAL,
  allowance_amount: DECIMAL,
  interest_rate: DECIMAL,
  permissions: { tabs: ['feed', ...] },
  email: STRING,
  id_number: STRING,
  must_change_password: BOOLEAN,
  status: 'approved' | 'pending'
}

currentGroup = {
  id: INT,
  name: STRING,
  family_nickname: STRING,
  group_code: STRING,              // 6 תווים
  type: 'FAMILY',
  admin_email: STRING,
  ai_tokens: INT,                  // 0-10 (מתאפס יומי)
  is_premium: BOOLEAN,
  community_id: INT | null,
  member_type: 'family' | 'member', // חבר קהילה vs. משפחה מלאה
  unlocked_modules: ARRAY,
  created_at: TIMESTAMP
}
```

### 1.5 תפקידים — ADMIN vs CHILD/MEMBER

| יכולת | ADMIN | CHILD/MEMBER |
|---|---|---|
| ניהול חשבונות ילדים | ✅ | ❌ |
| PayDay (חלוקת דמי כיס) | ✅ | ❌ |
| יצירת משימות | ✅ | ❌ |
| יצירת אתגרי אקדמיה | ✅ | ❌ |
| הגדרת תקציב | ✅ | ❌ (צפייה בלבד) |
| אישור בקשות הצטרפות | ✅ | ❌ |
| עריכת עסקאות | ✅ | ❌ |
| אישור משימות + תגמול | ✅ | ❌ |
| בקשת הלוואה | ❌ | ✅ |
| פתיחת יעד חיסכון | ❌ | ✅ |
| "מעשה טוב" (self task) | ❌ | ✅ |
| בקשת קנייה | ✅ | ✅ |
| צפייה ביתרה אישית | ✅ (יתרת הקבוצה) | ✅ (יתרה אישית) |
| Barcode/סריקת קבלה | ✅ | ❌ |

---

## 2. ניווט וטאבים

### 2.1 Family Group NAV — 4 קבוצות

הניווט הראשי (`#family-group-nav`) ממוקם בראש המסך, רקע כהה (`bg-slate-900`):

| כפתור | קבוצה | תת-טאבים |
|---|---|---|
| **ראשי** | direct | feed (Dashboard) |
| **בית** | dropdown `home` | קניות 🛒, הזמנות שלי 🛍️, מזווה 📦, שף AI 👨‍🍳, ניהול הבית 🔧 |
| **כסף** | dropdown `money` | בנק 🏦, תזרים 💸, תקציב 📊, תשקיף 📅 |
| **משפחה** | dropdown `family` | משימות ✅, אקדמיה 🎓, קהילה 🏘️, ניהול 👥 |

Badges בניווט:
- `fgnav-badge-home` — amber — פריטי קניות ממתינים
- `fgnav-badge-family` — red — משימות/בקשות ממתינות
- `fgnav-bell-badge` — red — התראות פעמון

### 2.2 switchTab(t)

מסתיר את כל ה-`content-*` divs, מציג `content-{t}`:

```javascript
switchTab(t) {
  // מסתיר כל content-X
  // מציג content-{t}
  // מוסיף animation class 'tab-anim'
  // לוגיקה לפי tab:
  //   'shop' → renderShopList()
  //   'pantry' → renderPantry()
  //   'recipes' → renderRecipePantrySelection()
  //   'forecast' → renderForecast()
  //   'cashflow' → renderCashflow()
  //   'community' → fetchCommunityData()
  //   'myorders' → switchMyOrdersTab + fetchMyOrders + loadFamilyServiceCalls
  //   'home-maintenance' → loadHomeMaintenance()
}
```

רשימת כל הטאבים: `feed, tasks, shop, myorders, bank, cashflow, community, academy, members, budget, pantry, recipes, forecast, home-maintenance`

---

## 3. מודולים — פירוט מלא

### 3.1 Dashboard / Feed ראשי (`content-feed`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — זהו המודול החמור ביותר שנמצא בתהליך כולו**: שלושת
> ה-endpoints המרכזיים שמזינים את הפיד (`/api/data/:userId`, `/api/transactions`,
> `/api/transaction`) היו **פתוחים לחלוטין ללא שום אימות**, כאשר האחרון מאפשר **שינוי ישיר
> של יתרות כספיות** של כל משתמש במערכת. כולם תוקנו, מתועד למטה.

**מטרה:** מסך הבית — מציג יתרה, פעילות, משימות ממתינות, ופיד פעולות משפחתי. **אין endpoint
ייעודי ל"פיד"** — הוא קומפוזיציה בצד הלקוח (`buildAndRenderFeed`) מתוך payload שמגיע
מ-`GET /api/data/:userId` (המזין כמעט את כל נתוני המסך: עסקאות\*, משימות, יעדים, מכסת AI,
יתרות, עדכוני קהילה) בשילוב `GET /api/transactions` הנפרד (\*בפועל העסקאות עצמן לא חוזרות
מ-`/api/data`, אלא נטענות בנפרד מ-`/api/transactions`).

**רכיבי UI:**
- **מה מחכה לך עכשיו** (`#family-urgent-section`) — מבוסס על caches קיימים בלבד, לא endpoint נפרד.
- **CHILD HOME HEADER** (מוצג לילדים בלבד) — כרטיס סגול עם יתרה, כפתורי "בקשת קנייה" ו"אתגר אקדמיה".
- **כרטיס יתרה** (`#tour-balance-card`) — ADMIN: `admin_total_balance` (סכום קבוצתי מכל
  העסקאות של משתמשי ADMIN); לא-ADMIN: `computed_balance`/`currentUser.balance` (יתרה אישית).
- **Quick Tiles** (`renderQuickTiles`) — 8 אריחי קיצור דרך; כולם מבצעים אך ורק `switchTab(...)`
  (ניווט client-side) או חסימת מודול ל-member — **אין קריאת API מתוך הקליקים עצמם**.
- **פיד פעילות מאוחד** (`#unified-feed-list`, `buildAndRenderFeed`/`renderUnifiedFeed`) —
  5 סוגי פריטים: (1) הודעת פתיחת סביבה, (2) תנועות עובר ושב, (3) משימות ב-`status='approved'`
  בלבד, (4) אתגרי אקדמיה (`bundlesCache`), (5) עדכוני קהילה/הטבות עסקים — ממוין לפי תאריך
  יורד, חתוך ל-30 פריטים.
- **סקירת ילדים** (`loadKidsOverview`, ADMIN בלבד) — כרטיסי ילדים + היסטוריית אתגרים,
  מבוסס על `GET /api/kids/parent-overview/:groupId` (מוגן כראוי, `verifyFamily`+IDOR).

**פילטרים בפיד:** לפי משתמש (ADMIN בלבד, ברירת מחדל מוסתר), לפי תאריך (הכל/חודש/3 חודשים).
**הבדל הרשאה אמיתי היחיד** בלוגיקת הפיד עצמה: `role==='ADMIN'` רואה הכל, כל תפקיד אחר
(MANAGER/SENIOR/MEMBER/CHILD — ללא הבחנה ביניהם) מסונן לפריטים ששייכים לו בלבד + פריטי
מערכת. **זהו סינון client-side בלבד** — לא גיבוי שרת נפרד (לפני התיקון, זה היה חמור עוד יותר
כי גם ה-API עצמו לא אכף שום הרשאה; כעת לפחות ה-API מאמת זהות וקבוצה, אך לא role).

**Child-specific:** `#child-todo-section` (משימות ממתינות + אתגרי אקדמיה), `#child-home-footer`
(3 כפתורי ניווט: חיסכון, היסטוריה, קהילה).

**Polling:** `pollInterval`, כל **30 שניות** (`setInterval(fetchData, 30000)`), עם guard נגד
כפילות (`if(!pollInterval)`). לא נוקה באופן מפורש (`clearInterval`) באף מקום, אך בפועל אינו
דליפה — `logout()` מבצע ניווט מלא (`location.href='/'`) שמאפס את כל מצב ה-JS, כמו שתועד
כבר במודול "הזמנות שלי".

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/data/:userId` | Payload מרכזי: user/group/tasks/pantry/shopping_list/goals/bundles/game_assignments/weekly_stats/community_updates |
| GET | `/api/transactions` | עסקאות כספיות (`groupId`, `userId`='all'/מזהה, `limit`, `from`, `to`) |
| POST | `/api/transaction` | יצירת עסקה ועדכון יתרה |
| PUT/DELETE | `/api/transaction/:id` | עריכה/מחיקת עסקה (ADMIN בלבד) |
| GET | `/api/kids/parent-overview/:groupId` | סקירת ילדים (ADMIN) |
| POST | `/api/kids/quests` | יצירת אתגר לילד (ADMIN בלבד — תוקן) |

**שימוש כפול (FAMILY+BUSINESS):** `GET /api/data/:userId`, `GET /api/transactions`,
`POST/PUT/DELETE /api/transaction*` משמשים **גם** את סביבת העסק (`business-app.js`, טאב
Feed/תזרים עסקי) — אותם endpoints בדיוק, מוגנים כעת ב-`verifyFamilyOrBiz`/`verifyBiz` לפי
הצורך, כך שגם session עסקי תקף עובד מולם.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **`GET /api/data/:userId` — ללא כל authentication.** החזיר `SELECT *` מטבלת `users` לכל
   `userId` נחוש (אינטגר רציף), **כולל `password_hash`**, טלפון, יתרות, עסקאות, משימות,
   יעדים — לכל גורם לא-מחובר. תוקן: נוספה `verifyFamilyOrBiz` + בדיקת
   `userId===req.callerAuth.userId`, והוסרה החזרת `password_hash` מהתגובה כהגנת-עומק נוספת
   (defense in depth) גם למקרה של תקלת הרשאה עתידית.
2. **`GET /api/transactions` — ללא כל authentication.** `groupId`/`userId` מגיעים חופשי
   מ-query string — IDOR מלא על כל ההיסטוריה הכספית של כל משפחה/עסק במערכת. תוקן: נוספה
   `verifyFamilyOrBiz` + בדיקת `groupId===req.callerAuth.groupId`.
3. **`POST /api/transaction` — ללא כל authentication.** אפשרה לכל גורם ליצור עסקה שרירותית
   **ולשנות ישירות את שדה ה-`balance`** של כל `userId` — לא רק דליפת מידע אלא שינוי מצב כספי
   ממשי (גניבת/הזרמת כסף וירטואלי). תוקן: נוספה `verifyFamilyOrBiz` + בדיקת `groupId`, ואימות
   שה-`userId` הוא המשתמש המחובר עצמו **או** ש-ADMIN יוצר עסקה עבור חבר אחר באותה קבוצה.
   נוספה גם ולידציית `type` (allow-list `income`/`expense`) והגבלת אורך `description`.
4. **Stored XSS בפיד הראשי** — `safeStr` (לא בורח `<`/`>`) הציג `description`/`title` של
   עסקאות/משימות/אתגרים כ-HTML גולמי; בשילוב עם #3 (יצירת עסקה חופשית) זה אפשר הזרקת קוד
   שהוצג לכל בני המשפחה. תוקן ל-`escHtml` בכל רינדור הפיד (`renderUnifiedFeed`).
5. **Stored XSS ללא כל escaping בהיסטוריית אתגרים ("סקירת ילדים")** — `h.title`,
   `h.child_name`, `h.created_by_name`, `k.nickname`, `g.game_name` ו-`src` של תמונת פרופיל
   ילד הוזרקו ל-`innerHTML` ללא שום בריחה (לא `safeStr` ולא `escHtml`). תוקן ל-`escHtml`.
6. **`POST /api/kids/quests` ללא בדיקת role ADMIN** — מוגן רק ב-`verifyFamily`+groupId; כל
   חבר משפחה מחובר, כולל ילד, יכול היה ליצור אתגרים/פרסים לכל ילד בקבוצה (כולל לעצמו).
   תוקן: נוספה בדיקת `role==='ADMIN'`.
7. דליפת `e.message` גולמי בכל ה-endpoints שנסקרו — תוקן להודעות כלליות בעברית.
8. **תיקון נלווה (פונקציונלי, לא אבטחתי)**: עריכה/מחיקת עסקה (`PUT`/`DELETE
   /api/transaction/:id`) כבר הייתה מוגנת `verifyFamily` בשרת, אך כל קריאות ה-client (בשני
   האפליקציות) שלחו `fetch` רגיל **ללא** Authorization header — כך שהעריכה/מחיקה היו
   **שבורות בפועל** (401 שקט) עוד לפני תהליך האפיון הזה. תוקן יחד עם שאר התיקונים.

---

### 3.2 בנק משפחתי (`content-bank`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — 8 מתוך 9 ה-endpoints של המודול (כל חלקי ההלוואות
> והיעדים, update-settings ו-payday) היו ללא כל אימות, כולל אפשרות להזרים כסף שרירותי
> לכל משתמש באמצעות "אישור הלוואה".** כולם תוקנו, מתועד למטה.

**מטרה:** ניהול חשבונות ילדים, דמי כיס, הלוואות ויעדי חיסכון.

**תצוגת ADMIN (`bank-admin-view`):**
- **PayDay Panel** — כפתור "בצע PayDay" לחלוקת דמי כיס + ריבית לכל הילדים בלחיצה אחת
- **רשימת חשבונות ילדים** (`#bank-accounts-list`)
- **בקשות הלוואה ממתינות** (`#admin-loans-panel`) — מוסתר כשאין הלוואות
- **יעדי חיסכון** (`#admin-goals-list`) — עם radial progress + כפתור "טיפ מ-familAI"

**תצוגת CHILD (`bank-child-view`):**
- **כרטיס אשראי** — עיצוב dark, מציג:
  - דמי כיס שבועיים (`card-allowance`)
  - ריבית (`card-interest`)
  - מצב בזבוז השבוע (progress bar, מגבלת 20%)
  - שם בעל החשבון
- **כפתורי פעולה:**
  - "בקש הלוואה" → `openLoanModal()`
  - "יעד חיסכון" → `openGoalModal()`
- **יעדים שלי** (`#my-goals-container`) — radial progress per goal
- **הלוואות שלי** (`#my-loans-list`)

**הרשאות (אומת בפועל לאחר התיקון):** `payday`, `loans/approve`, `loans/reject`,
`admin/update-settings` ו-`admin/adjust-balance` — ADMIN בלבד, נאכף בשרת. בקשת הלוואה
והפקדה ליעד — כל חבר קבוצה מחובר, לגבי עצמו בלבד (`userId` נגזר מהסשן, לא מהבקשה).
יצירת יעד עבור משתמש אחר (`targetUserId`) — ADMIN בלבד.

**API Endpoints:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/admin/payday` | ביצוע PayDay — ADMIN בלבד |
| GET | `/api/loans` | שליפת הלוואות של הקבוצה |
| POST | `/api/loans/request` | בקשת הלוואה (לעצמי) |
| POST | `/api/loans/approve` | אישור הלוואה — ADMIN בלבד, לפי סכום ההלוואה בפועל |
| POST | `/api/loans/reject` | דחיית הלוואה — ADMIN בלבד |
| POST | `/api/goals` | יצירת יעד חיסכון (לעצמי, או לילד — ADMIN בלבד) |
| POST | `/api/goals/deposit` | הפקדה ליעד (מהיתרה של המפקיד) |
| POST | `/api/goals/familai-advice` | ייעוץ AI ליעד |
| POST | `/api/admin/adjust-balance` | התאמת יתרה ידנית — ADMIN בלבד |
| POST | `/api/admin/update-settings` | עדכון הגדרות דמי כיס/ריבית — ADMIN בלבד |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **8 מתוך 9 ה-endpoints — ללא כל middleware אימות** (היחיד שהיה תקין מראש:
   `admin/adjust-balance`, עם `verifyFamily` + בדיקת role + בדיקת שהילד שייך לקבוצה —
   שימש כמודל לתיקון השאר). תוקן: נוספה `verifyFamilyOrBiz` לכל 8 ה-endpoints, עם
   `groupId`/`userId` הנלקחים אך ורק מ-`req.callerAuth`.
2. **`POST /api/loans/approve` — הממצא הקריטי ביותר במודול.** ללא אימות וללא בדיקת role
   כלל, וה-`amount` וה-`userId` שהוזרמו ישירות ל-`balance = balance + amount` הגיעו
   **מגוף הבקשה**, ללא קשר לסכום ההלוואה האמיתי או לזהות הלווה — איפשר לכל תוקף אנונימי
   להזרים כסף שרירותי לכל חשבון, ולהזרים אותו שוב ושוב על ידי קריאה חזרתית לאותו
   `loanId` (ללא בדיקת `status`, היה ניתן "לאשר" הלוואה שאושרה/נדחתה כבר שוב ושוב).
   תוקן: נדרש role=ADMIN, אימות שההלוואה שייכת לקבוצת המתקשר ובמצב `pending`, וה-
   `amount`/`userId` נלקחים כעת מרשומת ההלוואה בפועל (`original_amount`/`user_id`
   מה-DB) ולא מהבקשה.
3. **`POST /api/loans/reject`** — היה ללא אימות כלל, כל תוקף יכול היה לדחות כל הלוואה
   בכל משפחה. תוקן: ADMIN + בדיקת שייכות לקבוצה.
4. **`GET /api/loans`, `POST /api/loans/request`, `POST /api/goals`** — `groupId`/
   `userId` נלקחו מהבקשה, מה שאיפשר קריאת הלוואות של משפחה זרה, ופתיחת בקשת הלוואה/יעד
   חיסכון בשם כל משתמש בכל קבוצה. תוקן: `userId`/`groupId` מה-session בלבד; יצירת יעד
   עם `targetUserId` (עבור ילד) דורשת כעת ADMIN ובדיקה שהילד שייך לקבוצה.
5. **`POST /api/goals/deposit`** — הפחתת היתרה (`balance - amount`) ללא בדיקת יתרה
   מספקת (יתרה יכולה לרדת לשלילי), ו-`userId` שרירותי מהבקשה (ניתן "להפקיד" מהיתרה של
   כל משתמש אחר). תוקן: הפחתה אטומית עם `WHERE balance >= $1` (401/400 אם אין כיסוי),
   `userId` מה-session בלבד, ובדיקה שהיעד שייך לקבוצת המתקשר.
6. **`POST /api/goals/familai-advice`** — `userId`/`groupId` מהבקשה איפשרו דליפת מידע
   אישי (יתרה, דמי כיס, שנת לידה) של משתמש בכל קבוצה דרך תשובת ה-AI, וניצול מכסת
   ה-AI-tokens של משפחה זרה. תוקן: `groupId` מה-session, ו-`userId`/`goalId` מאומתים
   כשייכים לאותה קבוצה לפני שליפת הנתונים.
7. **`POST /api/admin/update-settings`, `POST /api/admin/payday`** — ללא אימות וללא
   בדיקת role, איפשרו לכל תוקף לשנות דמי כיס/ריבית/שכר בסיס של כל משתמש, ולהפעיל חלוקת
   דמי כיס+ריבית לכל ילדי קבוצה כלשהי, ללא הגבלה וללא cooldown. תוקן: ADMIN בלבד,
   `groupId` מה-session, ו-`update-settings` בודק גם ש-`userId` שייך לקבוצת המתקשר.
8. **Stored XSS** — `title`/`reason`/`nickname`/`owner_name` הוצגו עם `safeStr` (מגן רק
   על מרכאות) במקום `escHtml` בתוכן HTML, ב-`fetchGoals`/`fetchLoans` (אזורי ADMIN
   ו-CHILD) ובהודעת האישור של `ADJUST_BALANCE` ב-familAI actions — בשתי הסביבות
   app.js/business-app.js. בשילוב עם סעיפים #2/#4 (לפני התיקון ניתן היה ליצור הלוואה/יעד
   בשם כל משתמש) זה איפשר הזרקת סקריפט. תוקן ל-`escHtml` בכל מקומות התצוגה (השימוש
   היחיד שנשאר ב-`safeStr` הוא ארגומנט מוגן-מרכאות בתוך `onclick`, שם זה השימוש הנכון).
9. דליפת `e.message` גולמי בכל 9 ה-endpoints (מלבד `familai-advice` שהשתמש ב-
   `handleAIError`) — תוקן להודעות עבריות כלליות.
10. אין ולידציה על סכומים שליליים בבקשת הלוואה/יעד — תוקן ל-`Math.max(...)`; אורך
    `reason`/`title` הוגבל (300/150 תווים בהתאמה).
11. **עדכון client נדרש בשתי הסביבות** — כל קריאות ה-`fetch` הרלוונטיות ב-`app.js`
    הומרו ל-`communityFetch`, וב-`business-app.js` נוסף `Authorization` header עם
    `window._bizToken`, כולל ל-`admin/adjust-balance` שלא שלח טוקן כלל קודם (אף שהשרת
    כבר דרש `verifyFamily`) — ייתכן שהקריאה נכשלה בפרקטיקה לפני תיקון זה.

**מגבלות ידועות (לא תוקנו — תועד בלבד)**: אין הגבלת cooldown על `admin/payday` ברמת
ה-DB (רק הרשאת ADMIN) — הפעלה חזרתית על ידי ADMIN עצמו (לא תוקף) תחלק דמי כיס שוב;
החלטה עסקית/UX ולא תיקון אבטחה.

---

### 3.3 תזרים (`content-cashflow`)

> עודכן: 2026-10 | אומת מול קוד בפועל כחלק מתהליך אפיון עומק.
> **ממצא מרכזי: "תזרים" אינו ישות עצמאית** — הוא תצוגת UI בלבד מעל `/api/transactions`/
> `/api/transaction*`, שכבר נבדקו ותוקנו במלואם במודול Feed (ראו סעיף 3.1). אין כאן
> endpoint/טבלה ייעודיים נוספים לתיקון.

**מטרה:** צפייה ועריכה של כל הפעולות הפיננסיות.

**רכיבי UI:**
- הסבר: "כאן ניתן לראות ולערוך את כל הפעולות הפיננסיות מהעבר"
- פילטר לפי משתמש (`#cashflow-user-filter`) — מוצג רק ל-ADMIN
- פילטר לפי תאריך: כל הזמן / חודש אחרון / 3 חודשים
- `#cashflow-list` — רשימת תנועות

**קטגוריות הכנסה:** משכורת, דמי כיס, בונוס, מתנה, עסק, אחר

**קטגוריות הוצאה:** מסעדות, סופר ופארם, תחבורה ודלק, דיור ותחזוקה, חשבונות ותקשורת, פנאי ובילויים, ביגוד, בריאות, חינוך, חופשות, חיות מחמד, מתנות, אחר

**עריכה:** מודל `#edit-transaction-modal` — סכום, תיאור, קטגוריה + אפשרות מחיקה

**API** (מוגן ותקין — תוקן במודול Feed, ר' סעיף 3.1 להרחבה):
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/transactions?groupId=&userId=&limit=200` | שליפת תנועות |
| POST | `/api/transaction` | הוספת תנועה |
| PUT | `/api/transaction/:id` | עריכת תנועה |
| DELETE | `/api/transaction/:id` | מחיקת תנועה |

---

### 3.4 תקציב (`content-budget`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — כל שלושת ה-endpoints של המודול היו ללא כל אימות,
> ושם קטגוריית תקציב הוזרק ל-HTML וגם ל-attribute `onclick` ללא שום escaping** (לא גם
> `safeStr` — אפס הגנה). תוקן במלואו, מתועד למטה.

**מטרה:** הגדרת יעדי הוצאות לפי קטגוריות + מעקב מול הוצאה בפועל (מחושב מול `transactions`).

**רכיבי UI:**
- כפתור "תובנות familAI" (`#btn-budget-insight`) — ADMIN בלבד (ניתוח AI של תנועות החודש).
- הנחיה: "כאן מגדירים יעד הוצאות לכל תחום".
- כפתור הוספת קטגוריה (`#btn-add-budget-cat`) — ADMIN.
- `#budget-list` — רשימת קטגוריות עם progress bars (צבע לפי אחוז ניצול: רגיל/כתום מעל 80%/
  אדום מעל 100%).
- **אין פונקציית מחיקת קטגוריה** — ניתן רק להוסיף/לעדכן מגבלה (upsert), לא קיים DELETE.
- **אין מנגנון התראת חריגה אמיתי** (push/email) — קיים רק אינדיקטור ויזואלי (progress bar),
  מחושב מחדש בכל טעינת הטאב, ללא לוגיקת alert בצד שרת.

**קטגוריות תקציב מורחב (BUDGET_LABELS):**
מסעדות, סופר ופארם, תחבורה, דיור, חשבונות, פנאי, ביגוד, בריאות, חינוך, חופשות, חיות מחמד,
מתנות, אחר, הפרשות כלליות, דמי כיס לילדים, תגמול על משימות, אתגרי אקדמיה, הפקדות לחיסכון —
וקטגוריות מותאמות אישית שמשתמש מוסיף חופשי (`submitNewBudgetCat`).

**הרשאות:** לאחר התיקון, רק `role==='ADMIN'` יכול לקבוע/לעדכן מגבלת תקציב (נאכף בשרת).
צפייה: ADMIN רואה את כל קטגוריות התקציב/הוצאות של המשפחה (או מסונן לפי חבר ספציפי); כל
תפקיד אחר (MEMBER/CHILD) רואה **אך ורק** את הנתונים של עצמו — נאכף כעת בשרת (לא רק UI).

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/budget/filter?groupId=&targetUserId=` | שליפת תקציב/הוצאות (ADMIN: הכל/לפי בחירה; אחר: רק עצמו) |
| POST | `/api/budget/update` | עדכון מגבלת קטגוריה (ADMIN בלבד) |
| POST | `/api/budget/familai-insight` | תובנות AI לתקציב (חודש נוכחי) |

**טבלאות:** `budget_allocations` (`group_id`,`category`,`target_user_id`,`amount_limit`).

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **כל שלושת ה-endpoints — ללא כל middleware אימות.** `GET /api/budget/filter` חשף את כל
   נתוני התקציב הפיננסיים (מגבלות+הוצאות בפועל) של כל קבוצה לכל גולש לא-מחובר, לפי `groupId`
   נחוש. `POST /api/budget/update` אפשר לכל גורם (לא רק ADMIN, לא רק חבר קבוצה) ליצור/לשנות
   מגבלות תקציב של כל קבוצה וכל `target_user_id` שרירותי, כולל משתמש שלא שייך לאותה קבוצה.
   `POST /api/budget/familai-insight` הדליף תנועות פיננסיות מלאות (סכומים, קטגוריות, שמות)
   של קבוצה זרה, **וגם דלדל בפועל את מכסת ה-AI היומית** שלה. תוקן: נוספה `verifyFamilyOrBiz`
   בשלושתם + בדיקת `groupId` מול session + אכיפת role=ADMIN לעדכון + בדיקת שייכות
   `target_user_id` לקבוצה.
2. **Stored XSS/JS-injection חמור במיוחד** — שם קטגוריה (`category`/`catName`, קלט חופשי
   של המשתמש) הוזרק גם ל-`innerHTML` וגם **לתוך attribute `onclick` inline** ללא שום
   escaping (לא `safeStr` ולא `escHtml`) — חמור יותר מדפוס ה-XSS הרגיל שנמצא במודולים אחרים,
   כי זה אפשר גם breakout ישיר מתוך מחרוזת ה-JS של ה-`onclick`. בשילוב עם #1 (היעדר אימות),
   כל גולש לא-מחובר יכול היה להזריק קטגוריה עם payload זדוני שרץ אצל כל בן משפחה שפותח את
   טאב התקציב. תוקן: שם הקטגוריה מוצג כעת דרך `escHtml()`, וארגומנטים ל-`onclick` עוברים
   escaping תקין למחרוזת JS (אותו תיקון בוצע גם בעותק המקביל ב-`business-app.js`).
3. **IDOR נוסף שהתגלה תוך כדי התיקון, בצד העסק**: `GET /api/biz/export-report` (כולל
   `type=cashflow`) מוגן `verifyBiz` אך לא בדק שה-`groupId` בפרמטרי השאילתה תואם
   ל-`req.bizAuth.groupId` — כל עסק מחובר יכול היה לייצא CSV (תזרים/הזמנות/לקוחות/צוות) של
   עסק אחר. תוקן.
4. אין ולידציה על `limit` — התקבל כל ערך כולל שלילי (`parseFloat(limit)||0` בלבד). תוקן:
   מוגבל כעת ל-0 ומעלה (`Math.max(0,...)`).
5. דליפת `e.message` גולמי בשלושת ה-endpoints — תוקן להודעות כלליות בעברית.

**מגבלות ידועות (לא תוקנו — פער פונקציונלי, לא אבטחתי)**: אין מנגנון התראת חריגה מתקציב
אמיתי (push/email) — רק אינדיקטור ויזואלי. אין פונקציית מחיקת קטגוריה.

---

### 3.5 תשקיף (`content-forecast`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> המודול מבוסס כולו על `GET /api/transactions` (שתוקן ואומת כבר במודול תזרים/תקציב) —
> נבדק כאן רק ה-endpoint הייחודי למודול, `/api/forecast/familai-insight`, שהיה ללא
> אימות ואפשר דליפת תנועות קבועות של משתמש/משפחה זרה. תוקן, מתועד למטה.

**מטרה:** ניהול הכנסות/הוצאות עתידיות וקבועות.

**רכיבי UI:**
- כפתור "תובנות עתיד" (AI insight)
- בחירת תצוגה: חודשי / שנתי
- פילטר חודש/שנה
- `#forecast-summary` — יתרה צפויה + שינוי נטו
- `#forecast-charts` — גרף עוגה (Chart.js, `ratioChart`) — הכנסות מול הוצאות
- `#forecast-list` — רשימת פעולות עתידיות

**Recurring transactions:** תמיכה בפעולות קבועות (`is_recurring=true`, `end_month`)

**הרשאות:** ADMIN רואה תחזית לכל המשפחה ("all") או לחבר ספציפי; תפקיד אחר רואה אך ורק
את התחזית של עצמו — נאכף כעת גם בשרת (לא רק UI) ב-`familai-insight`.

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/transactions?is_recurring=true` | תנועות קבועות (מאומת, ראו מודול תזרים/תקציב) |
| POST | `/api/forecast/familai-insight` | תובנות AI לתשקיף |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **`POST /api/forecast/familai-insight` — ללא כל middleware אימות.** `groupId`
   ו-`targetUserId` הגיעו מהבקשה ללא בדיקה: תוקף יכול היה לקבל תובנת AI המבוססת על
   התנועות הקבועות של **כל משתמש בכל קבוצה** (דליפת מידע פיננסי — סכומי הכנסה/הוצאה
   קבועים ותיאורם), וכן לנצל את מכסת ה-AI-tokens של משפחה זרה באמצעות `groupId` שרירותי.
   תוקן: נוספה `verifyFamilyOrBiz`, `groupId` נלקח מהסשן, בקשת `targetUserId==='all'`
   דורשת role=ADMIN, ובקשת משתמש בודד מאומתת ששייך לקבוצת המתקשר (או מוחלפת ב-userId של
   המתקשר עצמו אם הוא אינו ADMIN).
2. **Stored XSS** — `item.description`/`item.user_name` בתצוגת `#forecast-list` הוצגו
   עם `safeStr` (מגן רק על מרכאות) במקום `escHtml`, בשתי הסביבות app.js/business-app.js.
   `description` מקורו בתנועות שנוצרות דרך `/api/transactions` (שעבר כבר sanitization
   במודול התזרים/תקציב), כך שזהו תיקון הגנה-כפולה (defense in depth) ולא היה ניצן בפועל
   ללא פרצה נוספת שמזריקה טקסט לתיאור תנועה — תוקן בכל זאת ל-`escHtml`.

---

### 3.6 רשימת קניות / סופר (`content-shop`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — כל 18 ה-endpoints של המודול היו ללא כל אימות,**
> כולל ה-checkout שיוצר רשומת תנועה כספית (`transactions`) ומעדכן מלאי, ושם פריט הוזרק
> ל-innerHTML עם `safeStr` בלבד (לא `escHtml`) בכמה מקומות תצוגה. כולם תוקנו, מתועד למטה.

**מטרה:** ניהול רשימת קניות משותפת, בקשות רכש לאישור הורה, מצב "אני בסופר", checkout
עם עדכון מלאי אוטומטי ורישום הוצאה בתזרים, רשימות שמורות, וסריקת קבלות/יצירת רשימה ב-AI.
המודול משותף במלואו לסביבת BUSINESS.

**רכיבי UI:**
- כפתורי כותרת: היסטוריה, סרוק קבלה (ADMIN), סרוק מוצר, הוסף
- "שתף בוואטסאפ" + "הדבק רשימה"
- כפתור "אני בסופר! 🛒" → `openSupermarketMode()` (מצב קניות מודרך)
- "רשימות שמורות" — `openSavedListsModal()`
- `#shop-requests-container` — בקשות ממתינות לאישור הורה (CHILD mode)
- `#shop-list` — רשימת הפריטים

**מצבי פריט:** `requested` (בקשת ילד הממתינה לאישור הורה) → `pending` (רגיל, לבן) →
`in-cart` (ירוק, `bg-green-50`) / `missing` (כתום, strike-through).

**Cart Footer (sticky):**
- `#cart-footer` — מציג סה"כ בעגלה + כפתור "סיום ואישור רשימת קניות"
- `openCheckoutSummary()` → מודל checkout

**AI בסופר:**
- סריקת קבלה: `POST /api/shopping/scan-receipt` → `showReceiptReviewModal` → confirmation → שמירה
- יצירת רשימה שבועית: `POST /api/shopping/ai-generate-list`
- זיהוי מוצר מצולום: `POST /api/shopping/identify-product` — **endpoint לא קיים בשרת**
  (נקרא מה-client בשתי הסביבות אך אין לו מימוש ב-`server.js`; הקריאה נכשלת תמיד). לא תוקן
  כחלק ממודול זה — החלטה עסקית האם לממש את הפיצ'ר או להסיר את הקריאה.

**PRODUCT_DB:** מיפוי מוצרים לקטגוריות מובנה בקוד (ירקות, חלב, לחם, מזווה, בשר, ניקיון, חטיפים).

**הרשאות (אומת בפועל לאחר התיקון):**
- הוספת פריט: כל חבר משפחה מחובר. אם המוסיף הוא CHILD, הפריט נכנס כ-`requested` וממתין
  לאישור הורה; ADMIN — נכנס ישירות כ-`pending`. קביעת ה-role כעת מגיעה אך ורק מהסשן
  המאומת (`req.callerAuth.role`), לא מגוף הבקשה.
- אישור בקשת רכש (מעבר מ-`requested` לכל סטטוס אחר) — **ADMIN בלבד**, נאכף כעת בשרת.
- מחיקה/עדכון/checkout/היסטוריה/רשימות שמורות — כל חבר קבוצה מחובר (אין עוד בידול role
  מעבר לאישור בקשות; תואם להתנהגות הקיימת של שאר מודולי המשפחה).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/shopping/add` | הוספת פריט (role קובע requested/pending) |
| POST | `/api/shopping/update` | עדכון פריט (סטטוס/מחיר/שם/כמות/יחידה) — אישור בקשה דורש ADMIN |
| DELETE | `/api/shopping/delete/:id` | מחיקת פריט |
| DELETE | `/api/shopping/clear/:groupId` | ניקוי כל העגלה |
| GET | `/api/shopping/category-map` | שליפת מיפוי קטגוריות לקבוצה |
| POST | `/api/shopping/category-map` | שמירת מיפוי קטגוריה |
| POST | `/api/shopping/checkout` | סיום קניה: רישום trip + הוצאה בתזרים + עדכון מלאי + ניקוי רשימה |
| GET | `/api/shopping/history` | היסטוריית קניות (trips + items) |
| POST | `/api/shopping/copy` | ייבוא מחדש של קניה היסטורית לרשימה |
| GET | `/api/shopping/saved` | רשימת הרשימות השמורות |
| POST | `/api/shopping/save` | שמירת הרשימה הנוכחית בשם |
| POST | `/api/shopping/load-saved` | טעינת רשימה שמורה לעגלה |
| DELETE | `/api/shopping/saved/:id` | מחיקת רשימה שמורה |
| POST | `/api/shopping/scan-receipt` | סריקת קבלה AI (לא שומר, מחזיר פריטים לתצוגה) |
| POST | `/api/shopping/ai-generate-list` | יצירת רשימה שבועית ב-AI (fallback קבוע אם אין AI) |
| POST | `/api/shopping/scan-receipt/save` | שמירת פריטים שאושרו מהקבלה לרשימה |
| POST | `/api/shopping/supermarket/start` | סימון "מישהו בסופר" לקבוצה |
| POST | `/api/shopping/supermarket/end` | סיום מצב "בסופר" |

**טבלאות:** `shopping_list`, `shopping_trips`, `shopping_trip_items`, `saved_shopping_lists`,
`product_category_map`, וכתיבה צולבת ל-`pantry` ול-`transactions` ב-checkout.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **כל 18 ה-endpoints — ללא כל middleware אימות.** כל תוקף אנונימי יכול היה לקרוא/להוסיף/
   לעדכן/למחוק פריטי רשימת קניות, רשימות שמורות והיסטוריית קניות של **כל משפחה/עסק
   במערכת**, וכן לבצע `checkout` בשם קבוצה זרה — כולל **יצירת רשומת הוצאה כספית אמיתית
   בתזרים (`transactions`) ועדכון מלאי (`pantry`) של קבוצה אחרת**. תוקן: נוספה
   `verifyFamilyOrBiz` לכל 18 ה-endpoints, עם `groupId`/`userId` הנלקחים אך ורק
   מ-`req.callerAuth` ולא מגוף/query הבקשה.
2. **`DELETE /api/shopping/delete/:id` ו-`DELETE /api/shopping/saved/:id`** — מחיקה
   לפי `id` בלבד ללא שדה `groupId` כלל בבקשה המקורית. תוקן: נוספה בדיקת בעלות
   (`SELECT ... WHERE id=$1` ואז השוואת `group_id` ל-`req.callerAuth.groupId`, 404/403
   בהתאם) לפני מחיקה, וכן ב-`/api/shopping/update`.
3. **עקיפת אישור הורה (parent-approval bypass) — חמור.** ההגבלה "רק ADMIN יכול לאשר בקשת
   רכש של ילד" הייתה **רק ב-UI** (`currentUser.role === 'ADMIN'` לפני הצגת כפתור "אשר"
   ב-`renderShopList`) — קריאה ישירה ל-`POST /api/shopping/update` עם
   `{itemId, status:'pending'}` איפשרה לכל משתמש, כולל CHILD, לאשר את בקשת הרכש של עצמו
   ללא מעורבות הורה כלל. תוקן: נוספה בדיקת role בשרת — מעבר סטטוס מ-`requested` לכל סטטוס
   אחר דורש כעת `req.callerAuth.role === 'ADMIN'`, אחרת מוחזר 403.
4. **ברירת מחדל מסוכנת ב-`/api/shopping/add`** — כאשר `userId` חסר/שגוי, הקוד קבע
   `userRole = 'ADMIN'` כברירת מחדל, מה שהיה מאפשר לכל בקשה אנונימית להיכנס ישירות
   כפריט `pending` מאושר (ולא כ-`requested` הממתין לאישור). תוקן: ה-role נגזר כעת תמיד
   מהסשן המאומת של הקורא, אין עוד ברירת מחדל.
5. **Stored XSS — `safeStr` שימש להצגת תוכן HTML במקום `escHtml`** עבור `item_name`,
   `requester_name`, `unit`, `best_price.store_name` ב-`renderShopList()`, וכן `item.name`/
   `item.unit` ב-`showReceiptReviewModal()`, ו-`store_name`/`branch_name`/`nickname`/
   `item_name`/`unit` ב-`openHistoryModal()` (בשתי הסביבות app.js/business-app.js).
   `safeStr` מגן רק על ציטוטים בתוך ארגומנט `onclick`, לא על `<`/`>`/`&` בתוכן HTML —
   שילוב עם סעיף #1 (לפני התיקון כל אחד יכול היה להוסיף פריט לכל קבוצה) איפשר הזרקת
   סקריפט שירוץ אצל כל מי שצופה ברשימה/בהיסטוריה. תוקן ל-`escHtml` בכל המקומות הנ"ל.
6. דליפת `e.message` גולמי כמעט בכל ה-endpoints — תוקן להודעות כלליות בעברית (למעט
   `scan-receipt`/`ai-generate-list` שכבר השתמשו בטיפול שגיאות ייעודי ל-AI).
7. אין ולידציה על כמויות/מחירים/סכום checkout שליליים — תוקן: `Math.max(0, ...)` על
   `quantity`, `estimatedPrice`, `totalAmount`, מחירי פריטי קבלה, ועוד. שם פריט/רשימה
   שמורה הוגבל ל-200 תווים.
8. **עדכון client נדרש בשתי הסביבות** — כל קריאות ה-`fetch` הרלוונטיות ב-`app.js`
   (הומרו ל-`communityFetch`) וב-`business-app.js` (נוסף `Authorization` header עם
   `window._bizToken`) עודכנו לשלוח טוקן אימות, עבור כל 18 ה-endpoints (כולל אלו שרק
   *קוראות* נתונים, כמו היסטוריה ומיפוי קטגוריות).

**מגבלות ידועות (לא תוקנו — תועד בלבד)**: `/api/shopping/identify-product` נקרא מה-client
אך אינו קיים בשרת — פיצ'ר שלא מומש מעולם, לא תיקון אבטחה. מידע "חוכמת ההמונים"
(`best_price` מקניות קודמות) ממשיך להיות משותף לפי שם מוצר גלובלי ולא רק בתוך הקבוצה —
עיצוב מכוון של הפיצ'ר (לא נבדק שוב במסגרת מודול זה, מעבר לכך שתצוגתו עברה escaping תקין).

---

### 3.7 מזווה / מלאי ביתי (`content-pantry`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — כל 7 ה-endpoints של המודול היו ללא כל אימות, כולל
> מחיקה לפי `id` גרידא ללא groupId בבקשה כלל, ושם פריט הוזרק ל-innerHTML ללא שום escaping
> (לא גם safeStr).** כולם תוקנו, מתועד למטה.

**מטרה:** מעקב אחרי מוצרים בבית, ניהול כמויות, העברה לרשימת קניות. המודול משותף במלואו
לסביבת BUSINESS (ניהול מלאי עסקי, עם שכבת "שריון לפקודות עבודה"/חציצה (buffer) נוספת שם).

**רכיבי UI:**
- כפתור "דוח מלאי AI" (`#btn-pantry-insight`) — ADMIN.
- הנחיה: "כשמשהו נגמר - כפתור העגלה יעביר אותו ישירות לרשימת הקניות".
- כפתורי: סרוק להוספה, הוספה ידנית, מחיקה מרובה.
- `#pantry-list` — כרטיסי מוצר.

**כרטיס מוצר:**
- שם מוצר + תאריך עדכון + גודל מארז (upp).
- כפתורי +/- לכמות (תומך בשברים: 1/upp).
- יחידות בודדות (`totalSubUnits = qty × upp`).
- "השתמשתי" → `openPantryUseModal` → ניכוי כמות.
- "חסר (לקניות)" → `movePantryToCart` → מחיקה מהמזווה + הוספה לרשימת הקניות (שתי קריאות
  נפרדות, לא בטרנזקציה אחת — אם הראשונה מצליחה והשנייה נכשלת, הפריט עלול "להיעלם" בלי
  שנוסף לרשימה; לא תוקן, חומרה נמוכה).

**Multi-delete mode:** בחירת מספר פריטים למחיקה בבת אחת.

**הרשאות:** אין בידול role בשרת — כל חבר משפחה מחובר (כולל CHILD) יכול להוסיף/לערוך/
למחוק כל פריט מזווה. ה"ADMIN בלבד" בתיעוד ה-UI (כפתור דוח AI) הוא הסתרת UI בלבד, לא אכיפה.

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/pantry/:groupId` | רשימת פריטי המזווה |
| POST | `/api/pantry/add` | הוספת מוצר (upsert לפי שם) |
| POST | `/api/pantry/update` | עדכון כמות פריט בודד |
| POST | `/api/pantry/use` | שימוש במוצר (גריעה, מוחק אם הגיע ל-0) |
| DELETE | `/api/pantry/delete/:id` | מחיקה |
| POST | `/api/pantry/bulk-update` | עדכון המוני (ספירת מלאי) + אפשרות שליחת דוח PDF למייל ה-ADMIN |
| POST | `/api/pantry/familai-insight` | דוח מלאי AI (משווה למלאי+היסטוריית קניות חודש אחרון) |

**טבלאות:** `pantry` (`group_id`,`item_name`,`quantity`,`reserved_qty`,`unit`,`units_per_package`).

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **כל 7 ה-endpoints — ללא כל middleware אימות.** כל תוקף אנונימי יכול היה לקרוא/להוסיף/
   לעדכן/למחוק פריטי מזווה של **כל משפחה/עסק במערכת**, לפי `groupId`/`itemId`/`id` נחושים.
   תוקן: נוספה `verifyFamilyOrBiz` לכולם, עם בדיקת `groupId===req.callerAuth.groupId`
   (וב-`update`/`delete` — בדיקת שהפריט עצמו שייך לקבוצת המתקשר, כי אלו לא קיבלו `groupId`
   בבקשה המקורית כלל).
2. **`DELETE /api/pantry/delete/:id` חמור במיוחד** — מחיקה לפי `id` בלבד, **ללא אף שדה
   `groupId` בבקשה המקורית** — ניחוש/איטרציה על `id` עוקב איפשרו מחיקת פריטי מזווה של כל
   קבוצה. תוקן: נוספה בדיקת בעלות (`SELECT ... WHERE id=$1 AND group_id=$2`) לפני מחיקה.
3. **Stored XSS — שם פריט מוזרק ל-`innerHTML` ללא שום escaping (לא גם `safeStr`)**
   בשתי הסביבות (`renderPantry` ב-`app.js` וב-`business-app.js` כאחד). בשילוב עם #1
   (הוספת פריט פתוחה לכולם), כל תוקף אנונימי יכול היה להזריק קוד שירוץ אצל כל מי שפותח את
   טאב המזווה — הקריטי ביותר במודול. תוקן ל-`escHtml` בשני הקבצים (גם שדה `unit`, שסבל
   מאותה בעיה דרך `safeStr` במקום `escHtml` במספר מקומות תצוגה).
4. דליפת `e.message` גולמי בכל 7 ה-endpoints — תוקן להודעות כלליות בעברית.
5. אין ולידציה על כמויות שליליות (`parseFloat(quantity)||1/0` בלבד ב-`add`/`update`,
   ו-`usedQuantity`/`usedUnits` שליליים ב-`use` שבפועל היו "מגדילים" מלאי במקום לגרוע) —
   תוקן: כל הכמויות עוברות כעת `Math.max(0, ...)`.
6. שם פריט לא הוגבל באורך — נוספה הגבלה ל-100 תווים.
7. **עדכון client נדרש בשתי הסביבות** — כל קריאות ה-`fetch` הרלוונטיות ב-`app.js`
   (`communityFetch`) וב-`business-app.js` (`Authorization` header עם `window._bizToken`)
   עודכנו לשלוח טוקן אימות, כולל שני המקומות שרק *קוראים* מלאי (סיכום דשבורד עסקי).

**מגבלות ידועות (לא תוקנו — חומרה נמוכה, אינטגריטי נתונים לא אבטחה)**: `movePantryToCart`
מבצע שתי קריאות נפרדות ללא טרנזקציה; אין upload תמונה לפריט מזווה ואין סריקת ברקוד/קבלה
ייעודית למזווה (קיימת רק לרשימת הקניות) — פיצ'רים שלא קיימים, לא נדרש תיקון.

---

### 3.8 שף AI / מתכונים (`content-recipes`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> המודול קיים רק ב-FAMILY (לא נמצא שימוש ב-business-app.js).
> **נכון לגרסה שלפני אוקטובר 2026 — ה-endpoint היה ללא כל אימות, וטקסט המתכון שהתקבל
> מה-AI הוזרק ל-innerHTML ללא כל escaping.** תוקן, מתועד למטה.

**מטרה:** יצירת מתכונים אוטומטית מתוך מוצרי המזווה בעזרת AI.

**רכיבי UI:**
- Banner: "השף הפרטי שלכם 👨‍🍳 — familAI תרכיב לכם מתכון מושלם"
- בחירת סוג ארוחה: ארוחת צהריים/ערב/בוקר, קינוח, נשנוש בריא
- מספר סועדים (ברירת מחדל: 4)
- **בחירת מצרכים:**
  - מהמזווה (checkbox לכל מוצר) + "סמן/בטל הכל"
  - או: "התעלם מהמזווה" + textarea להקלדה ידנית
- כפתור "צור מתכון עכשיו" → `generateRecipe()`
- `#recipe-result-container` — תוצאה מפורמטת + כפתור העתקה

**פורמט תוצאה:** Markdown מומר ל-HTML (h2, h3, רשימות, bold).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/recipes/generate` | יצירת מתכון AI |

**Body:** `{ groupId, mealType, diners, ignorePantry, customIngredients, pantryItems }`

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **`POST /api/recipes/generate` — ללא כל middleware אימות.** `groupId` הגיע מהבקשה
   ונעשה בו שימוש רק לניצול מכסת ה-AI-tokens (`handleAITokens`) — אין קריאה/כתיבה של
   מידע אישי, כך שהסיכון המעשי היחיד הוא ניצול מכסת AI של משפחה זרה (DoS על תקציב ה-AI
   שלה), לא דליפת מידע. תוקן: נוספה `verifyFamilyOrBiz`, `groupId` נלקח מהסשן.
2. **הזרקת HTML גולמית מתשובת ה-AI** — טקסט המתכון שהוחזר מ-Gemini הוזרק ל-`innerHTML`
   (`#recipe-result-content`) ללא כל escaping, עם המרת תגיות Markdown בודדות (`##`,
   `**`) בלבד. אם תוכן שהוזן ב"מצרכים חלופיים" (`customIngredients`, חופשי לגמרי) מצליח
   לגרום למודל להחזיר HTML/סקריפט (prompt injection), הוא יוצג/יורץ כפי שהוא. תוקן:
   טקסט התשובה עובר כעת `escHtml` לפני המרת ה-Markdown, כך שתגי HTML בתוכן התשובה
   מוצגים כטקסט בלבד ולא מתבצעים.
3. אין הגבלת אורך על `customIngredients`/`pantryItems` הנשלחים לפרומפט — תוקן ל-500
   תווים כל אחד. `diners` לא היה מוגבל (יכול היה להיות מספר קיצוני/שלילי) — תוקן לטווח
   1–50.
4. דליפת `e.message`: לא רלוונטי — הטיפול בשגיאות כבר עבר דרך `handleAIError`.

---

### 3.9 הזמנות שלי (`content-myorders`)

**מטרה:** מעקב הזמנות מעסקים מקומיים, קריאות שירות, הצעות מחיר.

**4 תת-טאבים:**

| Tab | ID | תיאור |
|---|---|---|
| הזמנות | `myorders-section-orders` | הזמנות מעסקים |
| הפעילות שלי | `myorders-section-activities` | עסקים שחיברו אתכם |
| קריאות | `myorders-section-faults` | קריאות שירות פתוחות |
| הצעות | `myorders-section-quotes` | הצעות מחיר |

**פאנל סינון הזמנות:**
- חיפוש טקסט (שם עסק, לקוח, הערות)
- תקופה: הכל / שבוע / חודש / 3 חודשים
- מיון: חדש→ישן / ישן→חדש

**Pagination:** 15 הזמנות לעמוד (`PAGE_SIZE = 15`), ניווט הקודם/הבא עם מונה "X–Y מתוך Z".

**סטטוסי הזמנה:**

| סטטוס DB | צבע | טקסט |
|---|---|---|
| `pending_approval` | צהוב | ממתין לאישור עסק |
| `new` | כחול | התקבל בעסק |
| `processing` | כתום | באריזה / הכנה |
| `ready` | סגול | מוכן לאיסוף |
| `shipped` | אינדיגו | בדרך אליך! 🛵 |
| `delivering` | אינדיגו | השליח בדרך אליך 🛵 |
| `completed` | ירוק | הושלם ונמסר |

**כרטיס הזמנה — שדות:**
- שם עסק + אייקון חנות
- סטטוס + תאריך/שעה
- מספר הזמנה (#ID)
- סכום כולל
- Toggle לפתיחת פרטים:
  - רשימת פריטים (שם × כמות × מחיר שורה)
  - הערות
  - "הומרה מהצעת מחיר #X" (אם רלוונטי)
  - אישור קבלה + דירוג (1-5 כוכבים) — להזמנות delivery שהושלמו

**קריאות שירות (`myorders-section-faults`):**
- סינון: הכל / מעסק / פנימיות
- כרטיס קריאה: כותרת, חומרה, סטטוס, שם ציוד, טכנאי מוגדר, תאריך מתוכנן
- כפתורי: "חייג", "וואטסאפ"

**הצעות מחיר (`myorders-section-quotes`):**
- סטטוסים: טיוטה, ממתין לתשובתך, ממתין לתגובת העסק, אישרת, אושרה, בוטלה
- כרטיס הצעה: כותרת, שם עסק, תאריך, תוקף, סכום, פריטים
- Timeline: היסטוריית אירועי ההצעה
- תגובה להצעה: אשר / סרב / בקש הנחה / בקש שינויים / הודעה חופשית
- מודל `openFamilyQuoteView` — תצוגה מפורטת עם חישוב מע"מ/הנחה

**Auto-refresh:** `startMyOrdersAutoRefresh()` — כל 20 שניות כשב-myorders tab.

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | שליפת הזמנות |
| GET | `/api/store/quotes/family/:groupId?userId=` | הצעות מחיר |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובה להצעה |
| POST | `/api/store/orders/:id/customer-feedback` | דירוג הזמנה |

---

### 3.10 משימות משפחתיות (`content-tasks`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — `POST /api/tasks/vision-verify` היה ללא כל אימות
> ומבצע זיכוי כסף ישיר + שינוי סטטוס, תוך עקיפה מוחלטת של אישור ADMIN.** זהה במהות לבאג
> שתועד במודול Feed. תוקן, מתועד למטה.

**מטרה:** יצירת משימות (לילדים/לעובדים, גם בסביבת BUSINESS) עם תגמול כספי, בדיקת AI ע"י
צילום, ותגובות/צ'אט לכל משימה.

**רכיבי UI:**
- "עשיתי מעשה טוב" (CHILD — self-report) `#btn-self-task`
- "חדשה" (ADMIN) `#btn-add-task`, יצירה מרובה לכמה עובדים/ילדים בבת אחת (`/bulk`, ADMIN בלבד)
- `#tasks-list` — רשימת משימות
- תגובות/צ'אט לכל משימה (`openFamilyTaskComments`)

**כרטיס משימה לפי סטטוס:**

| סטטוס | צבע | ADMIN | CHILD |
|---|---|---|---|
| `pending` | לבן | "ממתין לילד" badge | כפתור "סיימתי" + מצלמה |
| `done` | צהוב | "אשר ושלם" | "בבדיקה" |
| `approved` | ירוק | "בוצע" ✓ | "בוצע" ✓ |

**יצירת משימה (ADMIN):**
- ידנית: כותרת + תגמול + ילד + ימים לביצוע
- AI: נושא + גיל הילד → familAI מציעה 3 משימות עם תגמולים
- Toggle: אישור AI בתמונה — כן/לא
- משימות חוזרות (`is_recurring`+`recurring_days`, ימים 0-6) — סימון "בוצע" על משימה חוזרת
  מעדכן רק `last_completed_at`, לא משנה סטטוס/לא מזכה תשלום דרך נתיב זה.

**הרשאות בשרת (אומת כאכיפה אמיתית, לא רק UI):**
- יצירת משימה **למישהו אחר**: ADMIN בלבד. יצירה לעצמך (self-task/"מעשה טוב"): כל תפקיד.
- עריכת משימה קיימת: ADMIN בלבד, ורק בסטטוס `pending`.
- אישור תשלום (`status='approved'`): **ADMIN בלבד** — דרך הנתיב התקין (`/api/tasks/update`).
- סימון "בוצע"/מחיקה/דחייה: ADMIN או בעל/ת המשימה עצמה בלבד.
- כל הבדיקות מבוססות על `role` שנשלף מה-DB לפי session (`req.callerAuth.role`), לא ניתן
  לזיוף מצד הלקוח — **למעט `vision-verify`, שלפני התיקון עקף את כל זה לחלוטין** (ר' הערה
  היסטורית). אין הבחנה נוספת בין MANAGER/SENIOR/MEMBER — הבדיקה בינארית ADMIN מול לא-ADMIN.

**אישור קבלה (CHILD) — זרימת AI:**
1. CHILD לוחץ "סיימתי" → מצלמה נפתחת
2. צילום → `handleTaskProofUpload` → `executeWithAIWarning`
3. `POST /api/tasks/vision-verify` (מאומת כעת — ר' הערה היסטורית) → Gemini מנתח את התמונה
   מול **הכותרת האמיתית של המשימה מה-DB** (לא טקסט חופשי מהלקוח)
4. אם `verified:true` → תגמול (+ בונוס 10%) מועבר אוטומטית לארנק, המשימה עוברת ל-`approved`
   **ללא צורך באישור ADMIN נוסף** — זהו עיצוב מכוון (AI כ"שוער" אוטומטי), לא תוקן/שונה,
   רק אובטח כראוי.

**"מעשה טוב" (CHILD self-task):** CHILD מדווח על משימה שביצע מיוזמתו → נשלח לאישור ADMIN
(לא עובר דרך vision-verify אוטומטי).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/tasks` | יצירת משימה (ADMIN למישהו אחר; כל תפקיד לעצמו) |
| POST | `/api/tasks/bulk` | יצירה מרובה (ADMIN בלבד) |
| PATCH | `/api/tasks/:id` | עריכה (ADMIN, סטטוס pending בלבד) |
| POST | `/api/tasks/:id/proof` | שמירת הוכחת תמונה (ADMIN או בעל המשימה) |
| GET/POST | `/api/tasks/:id/comments` | תגובות/צ'אט למשימה |
| POST | `/api/tasks/update` | עדכון סטטוס/אישור תשלום (אכיפת role מלאה) |
| POST | `/api/tasks/ai-generate` | יצירת הצעות משימות AI (מוגן כעת) |
| POST | `/api/tasks/vision-verify` | אימות בתמונה AI + זיכוי אוטומטי (מוגן כעת) |

**שימוש כפול (FAMILY+BUSINESS):** כל 9 ה-endpoints משמשים גם את `business-app.js` (משימות/
טיקטים לעובדים) דרך אותו `verifyFamilyOrBiz`/session עסקי.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **`POST /api/tasks/vision-verify` — ללא כל middleware אימות.** כל גורם יכול היה לשלוח
   `taskId` כלשהו (אפילו של קבוצה אחרת — השאילתה המקורית לא סיננה לפי `group_id`), ואם
   ה-AI "מאשר" (תלוי בתמונה שנשלחת, לא בזהות השולח), השרת מבצע **זיכוי כסף ישיר**
   ל-`users.balance`, רושם `transactions`, ומשנה את סטטוס המשימה ל-`approved` — **תוך עקיפה
   מוחלטת של דרישת אישור ADMIN** הקיימת בנתיב התקין (`/api/tasks/update`). בנוסף, ה-`title`
   שנשלח ל-prompt של ה-AI הגיע מהלקוח בחופשיות, לא מה-DB (אפשרות ל-prompt injection/אי-
   התאמה בין הכותרת שנשלחת למודל לכותרת האמיתית). תוקן: נוספה `verifyFamilyOrBiz`, בדיקת
   שהמשימה שייכת לקבוצת המתקשר, בדיקה שהמתקשר הוא בעל המשימה או ADMIN, חסימת אימות חוזר על
   משימה שכבר אושרה, והחלפת ה-`title` הנשלח ל-AI בכותרת האמיתית מה-DB.
2. **`POST /api/tasks/ai-generate` — ללא middleware אימות.** אפשר לכל גורם לצרוך/לרוקן
   מכסת AI בתשלום ("סוללה") של כל `groupId` נחוש, ללא session תקף (DoS על משאב בתשלום).
   תוקן: נוספה `verifyFamilyOrBiz` + בדיקת groupId.
3. **Stored XSS** — `safeStr` (לא בורח `<`/`>`) שימש להצגת כותרת משימה, שם מבצע, ושם/תוכן
   תגובת משימה כתוכן HTML. כל חבר קבוצה, כולל ילד, יכול היה להזריק קוד שרץ אצל ADMIN שצופה
   ברשימת המשימות/בתגובות. תוקן ל-`escHtml` בכל תצוגות הטקסט (לא בארגומנטים של `onclick`,
   שם `safeStr` נותר מתאים להקשר). תוקנה גם אותה בעיה בתצוגת תגובות המשימה ב-`business-app.js`.
4. דליפת `e.message` גולמי ללקוח בכל 9 ה-endpoints — תוקן להודעות כלליות בעברית.
5. **אין ולידציית טווח על `reward`/`finalReward`** — ניתן היה להזין ערך שלילי/קיצוני.
   תוקן: כל סכום תגמול מוגבל כעת לטווח 0–100,000 ב-`/api/tasks`, `/api/tasks/bulk`,
   `PATCH /api/tasks/:id`, ו-`/api/tasks/update`.
6. אין הגבלת אורך על תגובת משימה — נוספה הגבלה ל-1000 תווים.

**מגבלות ידועות (לא תוקנו — מחוץ לסקופ):** XSS דרך `safeStr` ברינדורי משימות נוספים בתוך
`business-app.js` (מעבר לתגובות שתוקנו) לא נסרק/תוקן במלואו — סביבת העסק עצמה מחוץ לסקופ
תהליך האפיון של סביבת המשפחה. אין מנגנון התראות push/email אמיתי על משימות קרובות/באיחור —
קיים רק חיווי ויזואלי בצד לקוח.

---

### 3.11 אקדמיה פיננסית (`content-academy`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — זהו המודול עם הסיכון הכספי החמור ביותר שנמצא בתהליך
> כולו: שרשרת פרוצה מלאה (ללא כל אימות) שאפשרה יצירת תגמול כספי אינסופי ללא מענה נכון על
> אף שאלה, ובלי הגבלת כפילות.** כולם תוקנו, מתועד למטה. כן תוקן תיקון פונקציונלי — ציון
> החידון מחושב כעת בשרת מתוך התשובות האמיתיות ולא מתקבל כמספר מהקליינט.

**מטרה:** ידע פיננסי לילדים דרך חידונים — עם תגמול כספי (מטבעות Flow) על הצלחה.

**תצוגת ADMIN:**
- הנחיה: "הקצו מבחנים לילדים כדי שירוויחו כסף מלמידה"
- "יצירת אתגר" (AI) + "הקצאה" (ידנית)
- `#academy-pending-container` — בקשות לאישור
- `#admin-assignments-list` — רשימת הקצאות

**תצוגת CHILD:**
- Banner: "האקדמיה הפיננסית — תלמד, תענה נכון - ותרוויח כסף!"
- "הגרל אתגר מהיר" → `requestChallenge()`
- `#my-assignments-list` — מטלות להשלמה
- `#academy-history-container` — היסטוריה
- **ספריית מבחנים** — פילטר לפי גיל (6-8, 8-10, 10-13, 13-15, 15-18, 18+) ונושא (חשבון, אנגלית, קריאה, פיננסי)

**יצירת אתגר AI:**
- גיל + נושא → `POST /api/academy/ai-generate`
- familAI יוצר שאלות + תשובות + threshold (85%)
- לאחר יצירה → `openAssignModalSpecific(bundleId)` → הקצאה לילד

**ביצוע חידון:**
- שאלות רב-ברירה
- דרוג: `quiz-option.selected`, `.correct`, `.wrong`
- "familAI, איפה טעיתי?" → `askTutor()` → הסבר AI

**הרשאות (אומת בפועל לאחר התיקון):** הקצאת אתגר (`assign`), יצירת/עדכון bundle
(`bundles` POST/PUT), ויצירת bundle ב-AI (`ai-generate`) — ADMIN בלבד, נאכף בשרת.
בקשת אתגר עצמית (`request-challenge`) ושליחת תוצאות (`submit`) — כל חבר קבוצה מחובר,
לגבי עצמו בלבד (`userId` נגזר מהסשן).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/academy/request-challenge` | הגרלת/שיוך אתגר לעצמי |
| POST | `/api/academy/assign` | הקצאת אתגר לילד — ADMIN בלבד |
| POST | `/api/academy/submit` | שליחת תשובות + חישוב ציון בשרת |
| POST | `/api/academy/bundles` | יצירת bundle — ADMIN בלבד |
| POST | `/api/academy/ai-generate` | יצירת אתגר AI — ADMIN בלבד |
| POST | `/api/academy/tutor` | הסבר AI על שגיאה |
| GET | `/api/academy/bundles/:id` | שליפת bundle ספציפי (מאומת לפי שייכות) |
| PUT | `/api/academy/bundles/:id` | עדכון bundle — ADMIN בלבד |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **כל 8 ה-endpoints (וכן 4 רישומי route כפולים/מתים שהתגלו באותו אזור בקוד — ראו סעיף
   #6) — ללא כל middleware אימות.** `userId`/`groupId`/`bundleId` הגיעו מהבקשה ללא קשר
   לסשן. תוקן: נוספה `verifyFamilyOrBiz` לכל 8 ה-endpoints החיים, עם `userId`/`groupId`
   הנלקחים אך ורק מ-`req.callerAuth`.
2. **`POST /api/academy/submit` — הממצא הקריטי ביותר בכל תהליך האפיון עד כה.** ה-`score`
   הגיע **כמספר גולמי מהקליינט** ולא חושב/אומת בשרת מול התשובות האמיתיות של החידון —
   ניתן היה לשלוח `score: 100` מבלי לענות על שאלה אחת, ולהזרים כך תגמול כספי (מטבעות
   Flow) לכל ילד. בנוסף, `userId`/`groupId` שרירותיים מהבקשה איפשרו לבצע זאת בשם **כל
   ילד בכל משפחה/עסק במערכת**, ולא הייתה כל הגנה מפני כפילות — ניתן היה ליצור הקצאה
   חדשה (`assign`/`request-challenge`) ולהגיש `submit` עליה שוב ושוב בלופ, ללא הגבלה,
   וליצור כך **כסף אמיתי אינסופי**. תוקן: הציון מחושב כעת בשרת בלבד, מתוך
   `quiz_questions.correct` האמיתי לפי `bundle_id` בהשוואה למערך `answers` שהקליינט
   שולח (צריך להתאים באורכו למספר השאלות); ה-UPDATE שמסמן את ההקצאה כ"הושלמה" הוא כעת
   אטומי עם `WHERE status='assigned'` — הקצאה שכבר טופלה לא תיתן תגמול נוסף, גם אם
   ה-endpoint נקרא עליה שוב.
3. **`POST /api/academy/assign` — ללא בדיקת role, כל אחד (כולל ילד) יכול היה להקצות
   לעצמו/לכל ילד bundle עם `reward` שרירותי** (כולל סכום עצום). תוקן: נדרש ADMIN,
   נבדק שה-`userId` וה-`bundleId` שייכים לאותה קבוצה, ו-`reward` מוגבל ל-`>=0`.
4. **תגמול כפול בפועל (בעיה פונקציונלית, לא רק אבטחה)**: סיום חידון מצליח הפעיל גם את
   `/api/academy/submit` (מזכה ישירות ל-`flw_kid_wallets`) וגם, בנפרד, את
   `/api/kids/award-flw` (מזכה שוב, עם נוסחה אחרת) — כל חידון מוצלח שולם פעמיים ממקור
   כפול. תוקן: הוסרה הקריאה הכפולה מה-client; `academy/submit` הוא כעת מקור התגמול
   היחיד למודול זה, ומחזיר ללקוח `rewardCredited` להצגה.
5. `POST /api/academy/bundles`, `PUT /api/academy/bundles/:id`, `POST
   /api/academy/ai-generate` — ללא בדיקת role/בעלות; כל אחד יכול היה ליצור/לעדכן bundle
   "בשם" כל קבוצה, עם `reward` שלילי/שרירותי. תוקן: ADMIN בלבד, `created_by` נגזר
   מהסשן, בדיקת בעלות לפני עדכון, ו-`reward` מוגבל ל-`>=0`.
6. **כפילות רישום routes** — `POST /api/academy/bundles`, `GET /api/academy/bundles/:id`
   ו-`PUT /api/academy/bundles/:id` היו רשומים פעמיים-שלוש כל אחד באותו קובץ (קוד מת,
   שכן Express מריץ רק את הרישום הראשון של כל צירוף method+path). זוהה וה**קוד המת
   הוסר** — תוקן רק המופע החי, ונמחקו כל הכפילויות, כדי שתיקון עתידי לא "יפספס" בטעות
   עותק מת ששוכפל מהעבר.
7. דליפת `e.message` גולמי בכל ה-endpoints — תוקן להודעות עבריות כלליות.
8. **Stored XSS** — `opt` (טקסט אפשרות תשובה בחידון) הוזרק ל-`innerHTML` ב-`renderQuestion()`
   **ללא כל הגנה** (לא גם `safeStr`), בשתי הסביבות app.js/business-app.js. בשילוב עם סעיף
   #5 (לפני התיקון כל אחד יכול ליצור bundle עם תוכן שרירותי) זה איפשר הזרקת סקריפט
   שירוץ בדפדפן כל ילד שפותח את החידון. תוקן ל-`escHtml`.

**מגבלות ידועות (לא תוקנו — תועד בלבד)**: שדה `correct` (אינדקס התשובה הנכונה) ממשיך
להיות מוחזר ללקוח ב-`GET /api/academy/bundles/:id` **לפני** שהמשתמש עונה, כדי לשמר את
הפיצ'ר הקיים של הדגשת התשובה הנכונה מיידית לאחר כל שאלה שגויה (`submitAnswer`). זה
מאפשר "רמאות ויזואלית" (קריאת הערך בקונסול/DevTools לפני מענה), אך **אינה פרצת תגמול**
— מאז התיקון בסעיף #2, השרת מחשב את הציון באופן עצמאי מהתשובות שנשלחו בפועל, כך שגם
צופה ב-`correct` מראש לא "מרוויח" תגמול בלי לבחור את האפשרויות הנכונות דרך ה-UI. שינוי
התנהגות זה (הסתרת התשובה) ידרוש פיצול ה-endpoint לשני מצבים (הצגה למשתמש מול בדיקה
בשרת) ולכן הוחלט להשאיר כמגבלה ידועה, לא כקוד שבור.

---

### 3.12 קהילה / שכונה (`content-community`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — נמצא XSS מאוחסן במאמרי קהילה (יכול לפגוע בכל חברי
> הקהילה) ו-IDOR שיטתי ב-8+ endpoints עסקיים של קהילה.** כולם תוקנו, מתועד למטה.

**מטרה:** חיבור משפחות ועסקים באותה שכונה/יישוב — הצטרפות לקהילה, הטבות/מבצעים מעסקים
מקומיים, חדשות קהילתיות, ורכישה קבוצתית (FlowPool, ר' סעיף 3.12.1).

#### הקמת קהילה — שני נתיבים
1. **Super-Admin** — `POST /api/sa/communities` (`verifySA`): יוצר ישירות, כולל מנהל קהילה
   (אימייל/סיסמה) אם צוין.
2. **משפחה יוזמת** — `POST /api/community/user-create` (`verifyFamily`): יוצר קהילה
   ב-`status='pending'` (ממתינה לאישור SA), מקצה קוד `C-XXXXXX`, ומצרף את היוזמת אוטומטית
   כחברה — **אך לא כמנהלת קהילה** (`is_community_manager` נשאר `FALSE` כברירת מחדל).
   מינוי מנהל קהילה הוא פעולה נפרדת שדורשת SA או מנהל אזור (ר' למטה).

#### הצטרפות משפחה לקהילה
`POST /api/community/join` — לפי קוד קהילה (6 תווים, UPPERCASE), עם תמיכה בקוד הפניה
(`referralCode`). מגבלה: **עד 5 קהילות מאושרות** במקביל למשפחה. ההצטרפות יוצרת שורה
ב-`status='pending'` — **דורשת אישור מנהל קהילה** (`POST /api/community/manager/family/approve`)
לפני שהחברות הופכת פעילה (לא הצטרפות מיידית).

**יציאה מקהילה** — `DELETE /api/community/leave/:groupId/:communityId`: מוחק את שורת
החברות. **אם המשפחה העוזבת היא מנהלת הקהילה היחידה — הפעולה נחסמת** (תוקן, ר' הערה
היסטורית) כדי שהקהילה לא תישאר ללא מנהל כלל.

#### תפקיד "מנהל קהילה" (`is_community_manager`)
עמודה ברמת **המשפחה (group)**, לא ברמת משתמש בודד — כל מי שמחובר תחת אותה קבוצה נחשב
"מנהל". מוענק ע"י SA (`PUT /api/sa/communities/:commId/set-manager`) או מנהל אזור
(`POST /api/zone-manager/set-community-manager`, עם בדיקת שיוך האזור). ניתן למנות יותר
ממשפחה אחת כמנהלת לאותה קהילה (אין unique constraint). **מנהל אזור לא נגע בתהליך זה —
מנוהל במלואו ע"י הסופר-אדמין/מנהל האזור, כפי שהוחלט, ולא שונה.**

**סמכויות מנהל קהילה:** אישור/דחיית עסקים ומשפחות ממתינות, בקשת הסרת עסק (לא הסרה ישירה —
עובר דרך מנהל אזור/SA), ניהול קמפיינים ("אשכולות" קידום משותף), פרסום מאמרים/חדשות, צפייה
בארנק הקהילה (Flow coins) ותנועותיו.

**הגבלת תפקיד בתוך המשפחה (תוקן):** כל פעולות הניהול הפעילות (אישור/דחיית עסק ומשפחה,
בקשת/ביטול הסרת עסק, פרסום מאמר, יצירה/עריכת קמפיין, הוספת עסק/מוצר לקמפיין) **חסומות כעת
למשתמש מסוג CHILD** בשרת, גם אם המשפחה שלו מוגדרת כמנהלת קהילה — תואם את התיקון המקביל
שבוצע במודול FlowPool. צפייה בנתונים (רשימת קמפיינים, קטלוג עסק) נשארה פתוחה לכל התפקידים.

#### תתי-טאבים ב-UI
| Tab | תיאור |
|---|---|
| חיבור | הצטרפות לקהילה בקוד, רשימת קהילות מחוברות, "התנתק" |
| הטבות | עסקים מקומיים + הנחות בלעדיות (`renderFamilyCommunities`) |
| חדשות | מאמרים שמפרסם מנהל הקהילה |
| FlowPool / ארכיון | ר' סעיף 3.12.1 |

#### אינטגרציית עסקים
- הזמנת עסק ע"י משפחה (`POST /api/community/invite-business`) → עסק מאשר ובוחר הנחה
  (`biz_invited`→`comm_mgr_pending`) → מנהל קהילה מאשר ישירות, **או**
- הצטרפות עצמאית של עסק (`POST /api/biz/communities/join`) → עובר דרך `pending_cm_review`
  → "אור ירוק" ראשוני ממנהל הקהילה (`forward-approve`) → אישור סופי ממנהל אזור/SA.
- פרסום הטבה (`POST /api/biz/community/promotions`, `status='pending'`) דורש אישור SA.
- מימוש הטבה ע"י משפחה (`POST /api/community/promotions/:id/redeem`) — **כעת דורש חברות
  פעילה (`status='approved'`) בקהילה הרלוונטית** (תוקן, ר' הערה היסטורית).
- באנרים: בקשת באנר על הטבה מאושרת (`banner-request`) → אישור SA → מוצג ב-
  `GET /api/community/approved-banners` (ציבורי).

**API עיקרי:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/community/user-create` | יצירת קהילה ע"י משפחה |
| GET | `/api/community/my-initiatives/:groupId` | קהילות שהמשפחה יזמה |
| POST | `/api/community/join` | הצטרפות (ממתין לאישור) |
| DELETE | `/api/community/leave/:groupId/:communityId` | יציאה (חסום אם מנהל יחיד) |
| POST | `/api/community/manager/family/approve\|reject` | אישור/דחיית משפחה ע"י מנהל קהילה |
| POST | `/api/community/manager/community-business/approve\|reject\|forward-approve\|request-removal\|cancel-removal-request` | ניהול עסקים ע"י מנהל קהילה |
| GET | `/api/community/manager-data/:groupId` | ארנק הקהילה + תנועות |
| GET/POST | `/api/community/manager/campaigns*` | קמפיינים |
| POST | `/api/community/manager/articles` | פרסום מאמר/חדשות |
| POST | `/api/biz/communities/join`, `/api/biz/community-invitation/accept\|decline`, `/api/biz/community/promotions*`, `/api/biz/community-discount` | צד עסק — כולן מוגנות כעת בהשוואת זהות מול session (ר' הערה היסטורית) |

**טבלאות:** `communities`, `family_communities` (`is_community_manager`, `status`),
`community_businesses` (`status`: biz_invited/comm_mgr_pending/pending_cm_review/zm_pending/
approved/rejected/removed), `community_promotions`, `community_banner_requests`,
`community_articles`, `community_campaigns` + `community_campaign_businesses/products`.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **XSS מאוחסן במאמרי/חדשות קהילה** — `safeStr` (לא בורח `<`/`>`) הזריק `title`/`body` של
   מאמרים ל-`innerHTML`. מנהל קהילה (כולל ילד/ה, לפני תיקון #3) יכול היה להזריק קוד שירוץ
   אצל **כל** חברי הקהילה שפותחים את טאב החדשות. תוקן ל-`escHtml`.
2. **IDOR שיטתי ב-8 endpoints עסקיים**: `POST /api/biz/communities/join`,
   `GET /api/biz/community-invitations/:bizId`,
   `POST /api/biz/community-invitation/accept|decline`,
   `DELETE /api/biz/communities/leave/:communityId/:bizId`,
   `POST /api/biz/community/promotions`, `GET /api/biz/community/promotions/:bizId`,
   `POST /api/biz/community/promotions/:id/banner-request`, `PUT /api/biz/community-discount`,
   וגם `GET /api/biz/communities/my/:bizId` — כולם קיבלו `businessId`/`bizId` מה-body/URL
   **ללא השוואה** ל-`req.bizAuth.groupId` שה-middleware `verifyBiz` מספק. כל עסק מחובר יכול
   היה לפעול בשם כל עסק אחר (הצטרפות/עזיבת קהילות, קביעת הנחות, פרסום הטבות, בקשת באנרים).
   תוקן בכולם.
3. **ילד (CHILD) קיבל בפועל את כל סמכויות מנהל הקהילה** — כתוצאה משילוב של טאב "קהילה"
   המוחרג לגמרי מהרשאות (`enforcePermissions`) ונכפה על ילדים, עם בדיקות שרת שבדקו רק
   `group_id` ולא `role`. תוקן: נוספה בדיקת `role!=='CHILD'` (`blockIfChildFamilyUser`,
   הפונקציה המשותפת שנוספה כבר במודול FlowPool) בכל פעולת ניהול קהילה פעילה.
4. **מימוש הטבת קהילה (`redeem`) ללא בדיקת חברות בקהילה כלל** — כל משפחה שמכירה
   `promotionId` קיבלה זיכוי Flow, גם ללא חברות פעילה (או לאחר עזיבה). תוקן.
5. **עזיבת קהילה ע"י מנהל יחיד הייתה אפשרית ללא כל התראה**, והייתה משאירה את הקהילה ללא
   מנהל כלל, ללא מנגנון חלופי. תוקן: הפעולה נחסמת כעת (409) במקרה כזה, עם הנחיה לפנות
   ל-SA/מנהל אזור למינוי מנהל חלופי לפני העזיבה.
6. דליפת `e.message` גולמי ברוב ה-endpoints שנסקרו — תוקנו ההודעות שנגעו בממצאים לעיל
   להודעות כלליות בעברית (לא בוצע מעבר גורף על כל קובץ הקהילות, ר' מגבלות).
7. XSS נוסף בשם/עיר קהילה ובתוכן הטבות עסק (אותה בעיית `safeStr`) ברוב מוקדי הרינדור —
   תוקן ל-`escHtml`.

**מגבלות ידועות (לא תוקנו — מחוץ לסקופ הממצאים שתועדו):** לא כל endpoint עם `e.message`
במודול הקהילות נסרק/תוקן (המיקוד היה בממצאים המתועדים); ייתכנו עוד מוקדי `safeStr` לא
קריטיים ברינדור קהילה שלא אותרו בסבב זה.

---

### 3.12.1 FlowPool — רכישה קבוצתית קהילתית (תת-טאב `pool`/`pool-archive` בתוך קהילה)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול סבל ממספר כשלים חמורים**: endpoints ללא אימות
> כלל (כולל צ'אט פרטי), XSS פעיל בכל שדות הטקסט, היעדר מוחלט של בידול הרשאות (ילד=מנהל),
> פיצ'ר "עריכת פול" שבור לחלוטין (שם עמודה שגוי בקוד), ו"סגירה ללא בחירת הצעה" לא ממומשת.
> כולם תוקנו ותועדו למטה.

**מטרה:** מנגנון רכישה קבוצתית/מכרז קהילתי ("FlowPool") — **לא** קופה כספית משותפת. משפחה
פותחת "פול" (בקשה לשירות/מוצר עם תקרת מחיר אופציונלית) בתוך קהילה מחוברת; משפחות נוספות
מצטרפות; עסקי הקהילה (ובסיבוב 2 — גם עסקי "אורח" מחוץ לקהילה) מגישים הצעות מחיר; היוזם/ת
או מנהל/ת הקהילה בוחר/ת הצעה מנצחת. Flow coins (מטבע משחקי פנימי, לא כסף אמיתי) מוענקים
על יצירה/הצטרפות/זכייה.

**מיקום:** תת-טאב בתוך הטאב "קהילה" (`fam-comm-view-pool`), לא טאב עצמאי. קהילה מוחרגת
לחלוטין מ-`enforcePermissions` ונכפית גם לילדים (`app.js:9108-9120`) — כך שבפועל **כל סוג
משתמש משפחתי, כולל CHILD, רואה את תת-הטאב**. לאחר התיקון (ר' למטה), הצגת הכפתורים בצד
הלקוח עדיין זהה לכל התפקידים, אך **פעולות ניהול בפועל נחסמות בשרת** עבור משתמשי CHILD.

**תת-אזורים:**
- **פתיחת פול** (`openCreatePoolModal`/`createFamPool`) — כותרת, תיאור (שדות חובה), קטגוריית
  שירות, תקציב מקס' (אופציונלי), מספר משפחות מינימלי. היוזם מצטרף אוטומטית.
- **רשימת פולים פעילים** (`renderFamPools`) — כרטיס לכל פול: כותרת, קטגוריה, סטטוס (סיבוב 1
  פתוח/סיבוב 2 פתוח/סגור/פג תוקף), מספר משפחות, תקציב, תג "✦ יזמת" אם רלוונטי. בורר קהילה
  אם המשפחה מחוברת ליותר מקהילה אחת.
- **פרטי פול** (`openFamPoolDetail`) — סטטוס, תקציב, תיאור, רשימת חברי הפול וכפתור הסרה
  (ליוזם בלבד), רשימת הצעות עסקים עם קישור לחנות/טלפון ובחירת הצעה מנצחת (ליוזם/מנהל קהילה
  בלבד), צ'אט הודעות פתוח לכל חברי הפול (משפחות+עסקים), פתיחת סיבוב 2 לעסקי חוץ.
- **טיפול בפול שפג תוקפו** (ליוזם): חידוש תוקף ב-7 ימים נוספים, העברה לארכיב, או "סגירה ללא
  בחירת הצעה" (למשל אם העסקה בוצעה ישירות מול עסק מחוץ למערכת).
- **עריכת פול** (`openEditFamPool`/`saveEditFamPool`) — כותרת/תיאור/תקציב, ליוזם בלבד.
- **ארכיון פולים** (`loadFamPoolArchive`) — פולים סגורים/מוארכבים של המשפחה, עם אפשרות
  שחזור לפעילות (7 ימים חדשים).

**הרשאות לפי סוג משתמש (תוקן):** פעולות ניהול — פתיחת פול, הסרת חברה, בחירת הצעה מנצחת,
פתיחת סיבוב 2, עריכה, חידוש תוקף, ארכוב (יוזם), שחזור — **חסומות כעת בשרת למשתמש מסוג
CHILD** (נבדק מול `role` האמיתי של המשתמש שהתחבר, לא רק זהות הקבוצה). הצטרפות לפול קיים
ושליחת הודעות בצ'אט **נשארו פתוחות לכל סוגי המשתמשים** (כולל CHILD) — פעולות שיתופיות
בסיכון נמוך. בחירת הצעה מנצחת/פתיחת סיבוב 2 מוגבלות גם למנהל/ת קהילה (`is_community_manager`)
או ליוזם, ללא קשר לתפקיד המשפחתי הפנימי.

**אינטגרציית עסקים:** עסק מגיש הצעה דרך `/bid` (מוגבל לעסק אחד — הצעה אחת לכל פול, הגשה
חוזרת מחליפה את הקודמת). עסק "אורח" (לא חבר קהילה מאושר) יכול להגיש הצעה **רק בסיבוב 2**
(נאכף כעת בשרת). עסק רואה את כל הפולים הפתוחים בקהילות שהוא חבר בהן, את ההצעות שהגיש,
וארכיון אישי (הסתרת פול מהתצוגה שלו בלבד, ללא שינוי סטטוס גלובלי).

**API** (family-side עיקרי; כל ה-endpoints מוגנים `verifyFamily`/`verifyBiz`/`verifyFamilyOrBiz`
לפי הצורך, עם בדיקת בעלות/חברות קהילה):

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/community/pool` | יצירת פול (חסום ל-CHILD) |
| GET | `/api/community/pool/community/:communityId` | רשימת פולים בקהילה (חברי קהילה בלבד) |
| GET | `/api/community/pool/:id` | פרטי פול מלאים (חברי קהילה/יוזם בלבד) |
| POST | `/api/community/pool/:id/join` | הצטרפות (כל התפקידים) |
| POST | `/api/community/pool/:id/remove-member` | הסרת חברה (יוזם, חסום ל-CHILD) |
| POST | `/api/community/pool/:id/bid` | הגשת הצעה (עסק) |
| GET | `/api/community/pool/:id/bids` | רשימת הצעות (יוזם/מנהל קהילה) |
| POST | `/api/community/pool/:id/select-bid` | בחירת הצעה / סגירה ללא הצעה (`closeOnly`) |
| POST | `/api/community/pool/:id/open-round2` | פתיחת סיבוב 2 |
| POST | `/api/community/pool/:id/archive` | ארכוב (גלובלי ליוזם, אישי לעסק) |
| POST | `/api/community/pool/:id/renew` | חידוש תוקף |
| POST | `/api/community/pool/:id/edit` | עריכה |
| POST | `/api/community/pool/:id/restore` | שחזור מארכיב |
| GET | `/api/community/pool/:id/messages` | הודעות (מאומת, חברי קהילה/עסק משתתף) |
| POST | `/api/community/pool/:id/message` | שליחת הודעה (כל התפקידים) |
| GET | `/api/community/pool/family-archive/:groupId` | ארכיון פולים של המשפחה |
| GET | `/api/biz/pools/:bizGroupId` | פולים פתוחים לעסק |
| GET | `/api/biz/my-pool-bids/:bizGroupId` | הצעות שהעסק הגיש |
| GET | `/api/biz/pool-archive/:bizGroupId` | ארכיון אישי לעסק |
| POST | `/api/community/pool/cleanup` | ניקוי פולים שפג תוקפם (Super-Admin, cron) |

**טבלאות:** `flow_pools`, `flow_pool_members`, `flow_pool_bids`, `flow_pool_messages`,
`biz_pool_hidden`.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. `GET /api/community/pool/:id`, `GET /api/community/pool/community/:communityId`,
   `GET /api/community/pool/:id/messages` — שלושתם **ללא כל middleware אימות**. כל גורם,
   כולל לא-מחובר, יכול היה לקרוא פרטי כל פול (כולל שמות חברים) וצ'אט פרטי מלא, ולהציג רשימת
   כל הפולים בכל קהילה. תוקן: נוספה `verifyFamily`/`verifyFamilyOrBiz` + בדיקת חברות
   בקהילה/השתתפות בפול בפועל.
2. **אין בידול הרשאות role** — טאב "קהילה" מוחרג לחלוטין מהרשאות ומוכרח גם לילדים, ואף
   endpoint לא בדק `role` בתוך המשפחה (רק זהות קבוצה) — כל ילד/ה יכול היה ליצור פולים, להסיר
   חברים, לבחור הצעה מנצחת, לפתוח סיבוב 2, לערוך/לארכב/לשחזר פול. תוקן: נוספה בדיקת
   `role!=='CHILD'` בשרת לכל פעולות הניהול (לא לפעולות שיתופיות כמו הצטרפות/הודעה).
3. **XSS פעיל** — `safeStr` (הפונקציה ששימשה לבריחת טקסט ברוב תצוגות הפול) מבצעת רק escaping
   ל-`'`/`"`, **לא ל-`<`/`>`** — כותרת/תיאור/הודעות/שמות הוזרקו ל-`innerHTML` ללא הגנה מפני
   הזרקת תגיות. תוקן: מעבר ל-`escHtml()` (בריחה מלאה כולל `<`/`>`/`&`) בכל מקום שבו הטקסט
   מוצג כתוכן HTML (לא כארגומנט JS בתוך `onclick`, שם ה-escaping של `safeStr` תקין להקשר הזה).
   כולל תיקון חלון "עריכת פול" (`openEditFamPool`) שהזריק כותרת/תיאור גולמיים (ללא שום
   escaping) ל-`value`/לתוכן textarea.
4. **באג לוגי קריטי ב-`/edit`**: הקוד השווה `fp.rows[0].initiator_group_id` (עמודה שלא
   קיימת בטבלה — שם העמודה האמיתי הוא `initiator_id`) ⇒ ההשוואה תמיד נכשלה ⇒ עריכת פול
   **הייתה שבורה לחלוטין בפועל** עבור כל משתמש, כולל היוזם האמיתי. תוקן.
5. **"סגירה ללא בחירת הצעה" לא הייתה ממומשת בשרת** — הלקוח (`closeFamPool`) שלח
   `closeOnly:true` ל-`/select-bid`, אך השרת התעלם מהפרמטר, חיפש הצעה לפי `bidId:null` (תמיד
   נכשל), ואז קרא ל-`/archive` שמעביר לסטטוס `archived` ולא `closed` כפי שה-UI תיאר. תוקן:
   `/select-bid` מטפל כעת מפורשות ב-`closeOnly` וסוגר את הפול (`status='closed'`) ללא צורך
   בבחירת הצעה.
6. **דליפת `e.message` גולמי** ללקוח בכל ה-endpoints — תוקן להודעות כלליות בעברית.
7. **IDOR בשלושה endpoints עסקיים** (`/api/biz/my-pool-bids/:bizGroupId`,
   `/api/biz/pools/:bizGroupId`, `/api/biz/pool-archive/:bizGroupId`) — `bizGroupId` מה-URL
   לא הושווה ל-`req.bizAuth.groupId`, כך שעסק מחובר יכול היה למשוך נתוני עסק אחר. תוקן.
8. **אכיפת סיבוב 1/2 לעסק אורח לא הייתה קיימת** — עסק "אורח" (לא חבר קהילה מאושר) יכול
   היה להגיש הצעה גם בסיבוב 1, בניגוד לכוונת הפיצ'ר. תוקן: נבדק שהפול בסטטוס `open_r2`.
9. **אין ולידציה על מחיר הצעה** — התקבל כל ערך (כולל שלילי/לא מספרי). תוקן: נדרש מספר חיובי.
10. **באג תקשורת שקט (לא היה בדוח המקורי, התגלה תוך כדי תיקון)**: `sendPoolMessage` בצד
    הלקוח שלח `sender_type`/`sender_id` (snake_case) בעוד השרת ציפה ל-`senderType`/`senderId`
    (camelCase) — כתוצאה מכך **שליחת הודעה בצ'אט נכשלה תמיד** (403 "אין הרשאה לשלוח הודעה
    בשם שולח אחר", כי `senderId` תמיד הגיע `undefined`). תוקן.
11. אין הגבלת אורך תוכן הודעה בצד שרת — נוספה הגבלה ל-1000 תווים.

---

### 3.12.2 Flow Coins — ארנק משפחה (מטבע פנימי, Gamification)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js +
> public/storefront.html + public/storefront-btype.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — רוב ה-endpoints של ליבת מערכת ה-Flow (יתרה, מימוש,
> ניכוי, בונוס יומי) היו ללא כל אימות, כולל שניים שאיפשרו רוקנות/שינוי ישיר של יתרת כל
> משפחה אחרת.** כולם תוקנו, כולל סגירת חלון מרוץ (race condition) אפשרי בין בקשות מקבילות.

**מטרה:** מטבע משחקי פנימי ("Flw") שמוענק על פעילות חיובית במערכת (הצטרפות לקהילה, הפניית
חבר, יצירה/הצטרפות ל-FlowPool, כתיבת ביקורת, מימוש הטבת קהילה ועוד — ר' `flow_config`),
ושניתן למימוש כקוד הנחה אצל עסקים. **Flow אינו מומר ישירות לכסף אמיתי/ליתרת המשפחה הרגילה**
— המרה היחידה שקיימת היא יצירת קוד הנחה (`flow_redemptions`) שעסק מקבל ידנית בקופה/בהזמנה.

**`awardFlow(entityType, entityId, actionKey, communityId, referenceId)`** — פונקציה פנימית
בלבד (**אינה** חשופה כ-endpoint ללקוח, ואומת שאין נתיב שקורא לה ישירות). קוראת `flow_config`
לפי `actionKey`, מזכה `flow_wallets` (UPSERT), ורושמת `flow_transactions`. **אין בה הגנת
dedup גנרית** — מניעת זיכוי כפול תלויה בכל endpoint קורא בנפרד (חלקם כן בודקים, למשל
`daily_login` בודק תאריך; חלקם לא, כמו `pool_join`/`pool_create`/`bundle_purchase`).

**ארנק משפחה — UI:** מודאל ייעודי (`openFlowWalletModal`/`renderFlowWalletContent`) מציג
יתרה, שווי משוער בש"ח, היסטוריית 20 התנועות האחרונות, וכפתורי מימוש (קוד הנחה ידני / מימוש
ישיר בחנות עסק). נגיש גם מתוך דף הבית (widget יתרה) ומה-storefront הציבורי של עסקים (לצורך
החלת הנחת Flow בקופה, דרך `familyGroupId`+`flowRedeem` ב-URL).

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/flow/wallet/family/:groupId` | יתרה + 20 תנועות אחרונות + קונפיג מימוש (ADMIN/כל חבר משפחה) |
| GET | `/api/flow/wallet/business/:groupId` | יתרה+תנועות ארנק עסקי |
| GET | `/api/flow/community-wallet/:communityId` | יתרה+תנועות ארנק קהילה (חברי הקהילה בלבד) |
| POST | `/api/flow/redeem` | מימוש Flw → קוד הנחה (`FLxxxxxx`) לעסק נבחר |
| POST | `/api/flow/redeem/validate` | אימוש קוד הנחה ידני בקופה/בצ'קאאוט |
| POST | `/api/flow/deduct` | ניכוי ישיר לאחר הזמנה בחנות עם הנחת Flow |
| POST | `/api/flow/redemptions/:code/use` | עסק מסמן קוד כ"נוצל" |
| POST | `/api/flow/daily-login` | בונוס התחברות יומי (פעם ביום, נבדק בשרת) |
| GET/PUT/POST | `/api/sa/flow/*` | ניהול/קונפיג/דוחות Flow — Super-Admin בלבד |

**טבלאות:** `flow_config` (מגדיר `personal_amount`/`community_amount` לכל `action_key`),
`flow_wallets` (`entity_type`,`entity_id`,`balance`, UNIQUE לזוג), `flow_transactions`
(לוג היסטוריה), `flow_redemptions` (קודי הנחה: `family_group_id`,`business_group_id`,
`flow_amount`,`discount_ils`,`discount_code`,`status`,`expires_at`).

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **`GET /api/flow/wallet/family/:groupId` — ללא כל אימות.** חשף יתרה+היסטוריית תנועות
   Flow (כולל תיאורים עם שמות עסקים) של כל משפחה במערכת, לכל גולש לא-מחובר לפי `groupId`
   נחוש. תוקן: נוספה `verifyFamily` + בדיקת `groupId` מול session.
2. **`POST /api/flow/redeem` — ללא כל אימות.** `familyGroupId` הגיע מה-body בלבד — כל אחד
   יכול היה לרוקן יתרת Flow של **כל משפחה אחרת** ולקבל בעצמו קוד הנחה לשימוש אישי. תוקן:
   `verifyFamily` + בדיקת `familyGroupId===req.familyAuth.groupId`.
3. **`POST /api/flow/deduct` — ללא כל אימות.** אותה בעיה בדיוק — ניכוי ישיר מיתרת משפחה
   שרירותית, כולל זיכוי Flow לעסק שרירותי על חשבון הקורבן. תוקן באותו אופן.
4. **`POST /api/flow/daily-login` — ללא אימות**, `groupId` חופשי מה-body. תוקן.
5. **`POST /api/flow/redeem/validate` ו-`POST /api/flow/redemptions/:code/use` — ללא אימות
   כלל**, ואף ללא בדיקה שהקוד שייך בכלל למבקש — כל מי שידע/ניחש קוד (`FL`+6 תווים) יכול
   היה לממש/לסמן אותו כנוצל ולקבל את שווי ההנחה, גם אם לא שלו. תוקן: שניהם דורשים כעת
   session (`verifyFamilyOrBiz`/`verifyBiz` בהתאמה) + בדיקה שהקוד שייך בפועל למשפחה/לעסק
   המבקשים (לפי `family_group_id`/`business_group_id` השמורים ב-`flow_redemptions`).
6. **Race condition / double-spend אפשרי** — הבדיקה "האם יש מספיק יתרה" וההפחתה בפועל
   התבצעו כשתי פעולות DB נפרדות (`SELECT` ואז `UPDATE`), ללא טרנזקציה אטומית — שתי בקשות
   `redeem`/`deduct` מקבילות יכלו לעבור את הבדיקה בו-זמנית ולגרום ליתרה שלילית בפועל. תוקן
   בשתי דרכים משלימות: (א) ה-`UPDATE` עצמו הפך לתנאי אטומי יחיד
   (`WHERE balance>=$1 RETURNING balance`, במקום SELECT נפרד ואז UPDATE ללא תנאי) — כך
   שה-DB עצמו, לא האפליקציה, קובע אם הניכוי מתבצע; (ב) נוספה הגנת-עומק ברמת הסכמה:
   `CHECK (balance >= 0)` על `flow_wallets.balance`, כך שגם במקרה קצה בלתי צפוי ה-DB יחסום
   יתרה שלילית.
7. **Stored XSS פוטנציאלי** — תיאור תנועת Flow (יכול לכלול שם עסק/משפחה שהמשתמש קבע בעצמו)
   הוצג דרך `safeStr` (לא בורח `<`/`>`) בתוך `innerHTML` במודאל הארנק (גם בעותק המקביל בצד
   העסק). תוקן ל-`escHtml` בשני המקומות.
8. דליפת `e.message` גולמי בכל endpoints ה-Flow — תוקן להודעות כלליות בעברית.
9. **עדכון קריאות client נדרש בכל מקום שהמודול נגיש**: מלבד `app.js`/`business-app.js`
   (תוקנו דרך `communityFetch`/`Authorization` header רגיל), גם `storefront.html` ו-
   `storefront-btype.js` — דפים ציבוריים שה-family עשוי לגשת אליהם ללא session של האפליקציה
   הראשית פתוחה — עודכנו עם פונקציית `_flowAuthFetch` ייעודית שקוראת את טוקן המשפחה
   מ-`localStorage` (אותו origin) ומצרפת אותו אם קיים, כדי שלא לשבור את זרימת מימוש ה-Flow
   בחנות הציבורית.

**מגבלות ידועות (לא תוקנו — חומרה נמוכה/מידע ציבורי)**: `GET /api/flow/community-wallet/:id`
תוקן לדרוש חברות בקהילה, אך לא נמצא בקוד אף קורא פעיל לו כיום (endpoint לא בשימוש בפועל).
אין rate limiting ייעודי על אף endpoint של Flow (כולל קודי הנחה שניתן לנסות לנחש).

---

### 3.13 ניהול הבית (`content-home-maintenance`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול היה שבור לחלוטין בצד המשפחה** (כל קריאות ה-API
> נדחו עם 401, כי השרת דרש session עסקי בלבד). התיקון תועד למטה ונכלל בקוד הנוכחי.

**מטרה:** ניהול ציוד הבית, לוח תחזוקה, ספר תקלות ואנשי קשר (טכנאים/נותני שירות קבועים).

**ברירת מחדל ותפקידים:** הטאב מופיע כברירת מחדל לתפקיד `MANAGER` בלבד (`ROLE_DEFAULTS`,
`public/app.js:9099`) — לא מופיע אוטומטית ל-ADMIN/MEMBER/CHILD, אלא אם הורחבו הרשאות ה-tabs
ידנית (`PUT /api/users/:id/permissions`).

**כניסה למודול:** `loadHomeMaintenance()` (`app.js:11838`) — טוען קריאות שירות חיצוניות מעסקים
→ מושך במקביל ציוד/תחזוקות/תקלות/אנשי קשר → פותח טאב "ציוד" כברירת מחדל → מריץ בדיקת התראות
(`POST /notifications/check/:groupId`).

**4 תת-טאבים** (`switchHomeMaintenanceTab`, `app.js:11887`):

| Tab | View ID | תיאור |
|---|---|---|
| 🔧 ציוד | `hm-view-items` | מכשירי/ציוד הבית |
| 📋 תחזוקה | `hm-view-maintenance` | לוח תחזוקה תקופתית |
| ⚠️ תקלות | `hm-view-faults` | ספר תקלות (+ קריאות שירות חיצוניות מעסקים) |
| 👤 אנשי קשר | `hm-view-contacts` | טכנאים/נותני שירות קבועים |

#### 🔧 ציוד
כרטיס לכל פריט, ממוין לפי שם: שם, תגית קטגוריה, תגית סטטוס (פעיל/לא פעיל/הושלך), מספר סידורי,
מצב אחריות (אדום אם פגה, צהוב אם &lt;30 יום, אחרת תאריך פקיעה), מונה תחזוקות ממתינות ותקלות
פתוחות. טופס הוספה/עריכה (`openHMItemModal`, `app.js:11940`): שם (חובה), קטגוריה (מקרר/תנור/
מזגן/חשמל/אינסטלציה/רכב/כללי), מספר סידורי/דגם, תאריך רכישה, תאריך פקיעת אחריות, סטטוס, איש
קשר לתיקון (מתוך רשימת אנשי הקשר), הערות. מחיקה עם אישור. **היסטוריה** (`openHMHistory`): ציר
זמן מאוחד של תחזוקות+תקלות לפריט, עם חיפוש וסינון לפי סוג/תקופה.

#### 📋 תחזוקה
כרטיסים לפי תאריך מתוכנן: שם ציוד, סוג (תקופתי/תיקון/בדיקה), סטטוס (ממתין/בוצע/פג תוקף —
"פג תוקף" מחושב בצד הלקוח). סינון: הכל/ממתין/פג תוקף/בוצע. טופס הוספה/עריכה: ציוד (חובה), סוג,
תיאור, תאריך מתוכנן, עלות, "חזרה אוטומטית (ימים)", שם/טלפון איש קשר כטקסט חופשי (לא מקושר
לטאב אנשי הקשר). **"✓ בצע"**: שואל על עלות (אופציונלי) ושולח ל-`PUT /maintenance/:id/complete`
— אם הוגדר מרווח חזרה, השרת יוצר אוטומטית רשומת תחזוקה הבאה באותו מרווח ימים.

#### ⚠️ תקלות
בראש הרשימה — קריאות שירות פעילות שנפתחו מול עסקים ("🏢 קריאת שירות מהעסק"). מתחת — תקלות
ביתיות: תמונה, כותרת, תגית חומרה (נמוכה/בינונית/גבוהה/קריטית), תגית סטטוס (פתוח/בטיפול/טופל),
ציוד קשור, תאריך. שתי לשוניות פנימיות: **פרטים** (מועד מתוזמן, תיאור, הערות פתרון, איש מקצוע
משויך, כפתורי חיוג/WhatsApp/Waze) ו-**הערות** (ציר הערות נפרד). סינון: הכל/פתוח/בטיפול/טופל.
טופס דיווח/עריכה: ציוד (חובה), כותרת (חובה), פירוט, איש קשר (עם הצעת שליחת WhatsApp אוטומטית
בסיום), תאריך/שעה מבוקשים, דחיפות, סטטוס, **תמונה** (מועלית בפועל לשרת ומוחזר URL קבוע — לא
נשמרת כ-base64 ב-DB). שינוי סטטוס יוצר אוטומטית הערת מערכת "סטטוס שונה מ-X ל-Y".

#### 👤 אנשי קשר
כרטיס לכל איש קשר: שם, חברה, התמחות, כפתורי טלפון/WhatsApp. אנשי קשר שמקושרים לעסק אמיתי
ב-WEFLOWZ מקבלים תג "WEFLOWZ" וכפתור "שלח קריאה" (`openServiceCallWizard`) שפותח אשף קריאת
שירות מלא מול העסק. לאחרים — כפתור "קשר ל-WEFLOWZ" לחיפוש וקישור. הוספה/עריכה/מחיקה.

#### התראות (`POST /notifications/check/:groupId`)
לכל תחזוקה ממתינה שמועדה בעוד 2-7 ימים: "🔧 תחזוקה בעוד X ימים". למועד היום/מחר: "🔧 תחזוקה
היום/מחר". לקריאות שירות מתוזמנות למחר (כולל של כל המשפחות באותה קהילה): "📅 קריאת שירות מחר".
נכתב ל-`alert_notifications` עם מפתח ייחודי (מונע כפילויות), מעדכן תג הפעמון.

#### חיבור ל"הזמנות שלי"
תקלות פתוחות מוצגות גם שם: `renderMyFaultsAsServiceCalls` (`app.js:1113`, "🏠 תקלה בבית") עם
כפתורי חיוג/WhatsApp ו"פרטים →" שמעביר ישירות לטאב התקלות.

#### תג המודול
`updateHMBadge` (`app.js:11890`) — מספר תקלות פתוחות + מספר תחזוקות שמועדן בתוך 7 ימים, על
כפתור הטאב עצמו.

**API** — כל ה-endpoints מוגנים ב-`verifyFamilyOrBiz` (מקבל session משפחתי **או** עסקי לפי
טוקן; `groupId` נלקח תמיד מה-session, לא מה-URL/body — פרמטר `:groupId` ב-URL מתעלם בפועל):

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/equipment/items/:groupId` | רשימת ציוד |
| POST | `/api/equipment/items` | הוספה/עריכה (עם `id`) |
| DELETE | `/api/equipment/items/:id` | מחיקה |
| GET | `/api/equipment/items/:id/history` | היסטוריה מאוחדת לפריט |
| GET | `/api/equipment/maintenance/:groupId` | לוח תחזוקה |
| POST | `/api/equipment/maintenance` | הוספה/עריכה |
| PUT | `/api/equipment/maintenance/:id/complete` | סימון בוצע (+ תזמון אוטומטי הבא) |
| DELETE | `/api/equipment/maintenance/:id` | מחיקה |
| GET | `/api/equipment/faults/:groupId` | רשימת תקלות |
| POST | `/api/equipment/faults` | דיווח/עריכת תקלה |
| PATCH | `/api/equipment/faults/:id/status` | שינוי סטטוס (+ הערת מערכת אוטומטית) |
| GET / POST | `/api/equipment/faults/:id/notes` | ציר הערות לתקלה |
| DELETE | `/api/equipment/faults/:id` | מחיקה |
| GET | `/api/equipment/technicians/:groupId` | אנשי קשר |
| POST | `/api/equipment/technicians` | הוספה/עריכה |
| DELETE | `/api/equipment/technicians/:id` | מחיקה |
| POST | `/api/equipment/technicians/:id/link-business` | קישור לעסק אמיתי ב-WEFLOWZ |
| POST | `/api/equipment/notifications/check/:groupId` | הרצת בדיקת התראות |
| — | `/api/upload/product-image` | העלאת תמונת תקלה (multipart, מחזיר URL) |

**טבלאות:** `equipment_items`, `equipment_maintenance`, `equipment_faults`, `equipment_technicians`
(server.js:1093-1199). חולקות קוד/schema עם המודול העסקי המקביל — טוקן ה-session (משפחתי/עסקי)
הוא שקובע לאיזו `group_id` כל בקשה מוגבלת, לא route נפרד.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון, כל ה-endpoints היו מוגנים ב-`verifyBiz`
(דורש session עסקי בלבד) בעוד הקריאות מצד המשפחה נשלחו בלי טוקן בכלל — כל בקשה נדחתה עם 401,
בלי הודעת שגיאה למשתמש (מסכים ריקים "אין רשומות"), ומחיקה הציגה "נמחק" גם כשנכשלה. בנוסף
`link-business` היה פתוח לגמרי בלי הרשאה ובלי סינון `group_id` — כל אחד יכול היה לשייך טכנאי
של קבוצה אחרת לעסק. תוקן: מעבר ל-`verifyFamilyOrBiz` + `communityFetch` בצד הלקוח, הוספת
הרשאה+סינון ל-`link-business`, בדיקת תשובת שרת אמיתית במחיקה/טעינה, ותיקון תמונת תקלה
להעלאה אמיתית במקום base64 ב-DB.

---

### 3.14 ניהול / Members (`content-members`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/business-app.js)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — זהו המודול הקריטי ביותר שנמצא בתהליך כולו: שרשרת
> הסלמת הרשאות אנונימית מלאה אפשרה לכל מי שמכיר קוד קבוצה להפוך את עצמו ל-ADMIN, ללא
> טוקן בכלל.** כל הממצאים תוקנו, מתועד בהרחבה בהערה ההיסטורית למטה.

**מטרה:** ניהול בני המשפחה — רשימת חברים, שינוי תפקידים (ADMIN/CHILD/MEMBER), הרשאות
(אילו טאבים/יכולות לכל משתמש), אישור בקשות הצטרפות, מחיקת משתמש, הזמנת חברים.

**רכיבי UI:**
- `#members-list` — רשימת חברי המשפחה, עם כפתורי ADMIN: עריכת פרטים, שינוי תפקיד
  (`changeUserRole`), הרשאות (`openPermissionsModal`), מחיקה (`deleteUser`).
- כפתורי ADMIN (מוסתרים לחברים רגילים): "הזמן בן משפחה בוואטסאפ", "קבל פרטי גישה למייל"
  (`sendCredentialsEmail` — שולח רשימת שמות+תפקידים בלבד, **לא** סיסמאות, עם הפניה ל"שכחתי
  סיסמה").
- `#admin-panel` — בקשות הצטרפות ממתינות (`pending-list`), עם כפתור "אשר".

**"דוח 360" (`open360Report`) — לא קיים עוד בקוד.** הפיצ'ר הוסר בעבר (הערת קוד נותרה:
"אפשרות הורדת PDF מדוח 360 הוסרה לטובת תצוגת UI נקייה ומהירה יותר"). תיעוד קודם של המסמך
תיאר פיצ'ר שאינו קיים בפועל — תוקן כאן.

**הרשאות בשרת (אומת כאכיפה אמיתית, לאחר התיקון):** כל פעולות הניהול (שינוי role, עריכת
פרטי משתמש אחר, אישור בקשות הצטרפות, צפייה ברשימת ממתינים, שליחת פרטי גישה) דורשות כעת
session תקף (`verifyFamilyOrBiz`) **וגם** `role==='ADMIN'` הנשלף מה-DB לפי הסשן — לא ניתן
עוד לזייף זהות "מנהל" דרך פרמטר בגוף הבקשה. הצטרפות קבוצה חדשה (`/api/join`) לעולם לא
מעניקה ADMIN עצמאית — לכל היותר MEMBER/CHILD; ADMIN ראשון נקבע אך ורק בזרימת הקמת קבוצה
חדשה (wizard), נפרד לגמרי מ-`/api/join`.

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/group/members` | רשימת חברים (מוגן, בדיקת groupId) |
| GET | `/api/admin/pending-users` | בקשות ממתינות (ADMIN בלבד) |
| POST | `/api/admin/approve-user` | אישור בקשה (ADMIN בלבד, בדיקת שייכות קבוצה) |
| POST | `/api/admin/change-role` | שינוי תפקיד (ADMIN בלבד, מבוסס session) |
| GET/PUT | `/api/admin/user-details/:userId` | פרטי משתמש / עריכה (ADMIN בלבד) |
| DELETE | `/api/users/:id` | מחיקת משתמש (ADMIN בלבד; ADMIN יחיד לא יכול למחוק את עצמו) |
| POST | `/api/users/:id/password` | שינוי סיסמה עצמית בלבד |
| PUT | `/api/users/:id/permissions` | עדכון הרשאות/תפקיד (ADMIN בלבד) |
| POST | `/api/admin/send-credentials` | שליחת רשימת שמות+תפקידים למייל ה-ADMIN (ADMIN בלבד) |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **שרשרת הסלמת הרשאות אנונימית מלאה**: `/api/join` קיבל `role` חופשי מהלקוח כולל
   `"ADMIN"` → `/api/admin/pending-users` חשף את ה-ID ללא כל אימות → `/api/admin/approve-user`
   הפעיל כל `userId` ללא כל אימות. כל מי שידע `group_code` (לא סוד מוחלט — משותף עם מוזמנים)
   יכול היה להירשם כ-ADMIN "ממתין", לאתר את עצמו ברשימה, ולאשר את עצמו — **ADMIN מלא בקבוצה
   זרה, ללא טוקן בכלל**. תוקן: `/api/join` לעולם לא מעניק ADMIN; שני ה-endpoints האחרים
   דורשים כעת session + role=ADMIN אמיתיים.
2. **`POST /api/admin/change-role`** — זהות ה"מנהל המבצע" (`adminId`) הגיעה מגוף הבקשה
   (משתנה JS בדף, ניתן לשינוי חופשי בקונסולה/כלי תקיפה), לא מהטוקן — כל MEMBER/CHILD
   שמכיר ID של ADMIN אמיתי בקבוצתו (זמין בקלות דרך `/api/group/members` הפתוח, ר' #4) יכול
   היה להפוך את עצמו ל-ADMIN. תוקן: המזהה נלקח כעת מה-session בלבד.
3. **`GET`/`PUT /api/admin/user-details/:userId`** — אותה בעיה בדיוק: `adminId` מגיע
   מהבקשה. ה-PUT איפשר גם קביעת **סיסמה חדשה לכל משתמש אחר, כולל ADMIN קיים** — דרך נוספת
   להשתלטות מלאה על חשבון. ה-GET חשף `password_hash` גולמי ללא אימות אמיתי. תוקן: session
   + role=ADMIN אמיתיים; `password_hash` הוסר מתשובת ה-GET.
4. **באג נפרד, חמור בפני עצמו, שהתגלה תוך כדי התיקון**: ה-PUT שמר סיסמה חדשה שנקבעה
   ל**משתמש אחר** כ**טקסט גלוי** (`password.trim()`) בעמודת `password_hash`, **ללא הצפנת
   bcrypt כלל** — בניגוד לכל שאר נתיבי שינוי הסיסמה במערכת. תוקן: הסיסמה מוצפנת כעת
   כמו בכל מקום אחר.
5. **`GET /api/group/members` ו-`GET /api/admin/pending-users` ללא כל אימות** — `groupId`
   חופשי ב-URL; חשפו לכל מבקר אנונימי (שמנחש/מאתר `groupId`, מספר רציף) יתרות, הרשאות,
   טלפונים, תאריכי לידה של כל קבוצה במערכת. תוקן: נוספה `verifyFamilyOrBiz` + בדיקת groupId
   (ול-pending-users גם בדיקת role=ADMIN).
6. **Stored XSS ברשימת החברים/ממתינים** — `safeStr` (לא בורח `<`/`>`) הציג `nickname` כתוכן
   HTML בכמה מוקדי תצוגה. בשילוב עם טוקן הסשן ב-`localStorage`, זהו וקטור נוסף לגניבת הרשאות
   ADMIN (לא רק דליפת מידע רגילה). תוקן ל-`escHtml` בכל מקום שבו השם מוצג כתוכן (לא כארגומנט
   JS בתוך `onclick`, שם `safeStr` נותר תקין להקשר).
7. **`POST /api/admin/send-credentials` ללא אימות** — `adminId`/`groupId` מהבקשה. הנזק מוגבל
   (לא נשלחות סיסמאות, רק שמות+תפקידים לכתובת מייל קבועה מראש של הקבוצה) אך עדיין ללא הרשאה
   אמיתית. תוקן: session + role=ADMIN.
8. **באגים נפרדים שהתגלו תוך כדי התיקון — עריכת הרשאות ומחיקת משתמש היו שבורים בפועל בצד
   הלקוח**: שמירת הרשאות (`PUT /api/users/:id/permissions`) שלחה `Authorization` מ-מפתח
   localStorage שגוי (`'ofl_token'` שלא קיים, במקום `'ofl_family_token'`), ומחיקת משתמש
   (`DELETE /api/users/:id`) לא שלחה כלל טוקן — שני הנתיבים, שבשרת כבר היו מוגנים נכון
   (`verifyFamily`), נכשלו תמיד ב-401 בשקט. תוקן יחד עם שאר התיקונים.
9. דליפת `e.message` גולמי בכל ה-endpoints שנסקרו — תוקן להודעות כלליות בעברית.

**מגבלות ידועות (לא תוקנו — סיכון שינוי התנהגות / מחוץ לסקופ הדוח)**:
- `POST /api/users/:id/set-first-password` (הגדרת סיסמה ראשונה למשתמש שנוצר ע"י עסק/הזמנה)
  עדיין פועל ללא session (`must_change_password` flag בלבד כשער) — זהו תהליך "התחברות
  ראשונה" שבו מטבעו אין עדיין טוקן, אך ה-`userId` ב-URL ניתן תיאורטית לניחוש/איטרציה.
  שינוי אמיתי דורש עיצוב מחדש של זרימת ה-onboarding (למשל קוד אימות חד-פעמי), ולא בוצע
  כחלק מהתיקון הנוכחי כדי לא לפגוע בזרימת ההרשמה הקיימת.
- ולידציית סיסמה חלשה (אורך מינימום 4 תווים בלבד, ללא דרישת מורכבות) בכל נתיבי שינוי/קביעת
  סיסמה — לא תוקן, שינוי התנהגות שדורש החלטת מוצר.
- תמיכת legacy בהשוואת סיסמה כטקסט גלוי (`oldPassword === stored` כש-hash לא מתחיל ב-`$2`)
  ב-`/api/users/:id/password` — מצביע על רשומות ישנות לא-מוגנות שעדיין קיימות ב-DB; לא טופל.
- אין Rate Limiting על `/api/join` (ניתן ליצור בקשות הצטרפות רבות ברצף) — לא תוקן.

---

### 3.15 פרופיל והגדרות

**פרופיל אישי** נפתח מ-`openProfileModal()`:
- שינוי כינוי, סיסמה
- מידע אישי: תז, מייל, שנת לידה
- סוללת AI (ADMIN: מציג כמות נותרת + אפשרות Pro)
- כפתור "שדרג ל-Pro"

**Sidebar משפחה:** `openFamilySidebar()`:
- ניווט מהיר
- הגדרות
- התנתקות

---

### 3.16 מרקטפלייס (`content-marketplace`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/marketplace.html)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — ה-endpoint המרכזי של המודול לא היה מוגן אימות בכלל**
> (כל בקשה, אפילו ללא טוקן, קיבלה את כל רשימת העסקים הפעילים). התיקון תועד למטה ונכלל בקוד
> הנוכחי.

**מטרה:** גילוי עסקים (חנות ציבורית) מתוך סביבת המשפחה — חיפוש, סינון לפי קטגוריה/קרבה
גיאוגרפית, "ביקרתי לאחרונה", מבצעי שבוע, אזורים מועדפים, כניסה לחנות הציבורית (storefront)
של כל עסק.

**ארכיטקטורה:** הטאב `loadMarketplaceTab()` (`app.js:~18485`) מטמיע `<iframe>` עצמאי
ל-`public/marketplace.html?groupId=&token=&familyName=` (דף נפרד, same-origin, עם
`<script>` עצמאי). תקשורת הורה↔iframe דרך `postMessage` (למשל `openStorefront` כדי לפתוח
את `storefront.html` של העסק בלשונית/טאב חדש, עם `e.origin` מאומת משני הצדדים).

**גישה לפי סוג משתמש (`ROLE_DEFAULTS`, `app.js:9097`):** הטאב `marketplace` **אינו** ברירת
מחדל לאף תפקיד חוץ מ-`ADMIN` (`ALL_TABS` המלא). `MANAGER`, `SENIOR`, `MEMBER`, `CHILD` לא
רואים את הטאב כברירת מחדל — הוא נחשף להם רק אם ADMIN הרחיב ידנית את הרשאות ה-tabs שלהם
(`PUT /api/users/:id/permissions`, מודול 3.14 "ניהול/Members"). בפועל, המודול מיועד בעיקר
להורה/מנהל המשפחה, אך אינו חסום באופן מהותי לשאר התפקידים ברגע שהוענקה הרשאת tab —
כל ה-endpoints בודקים רק זהות **קבוצה** (`req.familyAuth.groupId`), לא תפקיד בתוך הקבוצה,
כך שכל חבר משפחה עם טוקן תקף וגישה לטאב רואה את **אותם** נתונים (אין הבדלי תוכן בין
ADMIN/MEMBER/CHILD בתוך המודול עצמו — ההבדל היחיד הוא האם הטאב מוצג).

**טוקן:** `marketplace.html` קורא את טוקן המשפחה ישירות מ-`localStorage.getItem('ofl_family_token')`
(אותו מפתח שמשמש את `getFamilyToken()` ב-`app.js`) — פרמטר ה-URL `token`/`familyToken` הוא
רק fallback (כדי לא לחשוף את הטוקן מיותר ב-query string כששומרים אותו ממילא ב-localStorage
של אותו origin). כל קריאות ה-API הפנימיות עוברות דרך עוטפת `apiFetch()` שמוסיפה אוטומטית
`Authorization: Bearer <FAMILY_TOKEN>`.

**טעינת הנתונים — `GET /api/family/marketplace/:groupId`:** endpoint יחיד שמחזיר בבת אחת:
1. **יתרת Flow coins (FLW)** של המשפחה — `SELECT balance FROM flow_wallets WHERE entity_type='family' AND entity_id=groupId` (מוצג בראש הדף, רלוונטי למימוש הטבות/מטבעות מול עסקים).
2. **ביקרתי לאחרונה** — 3 העסקים האחרונים לפי `family_business_visits.last_visited_at`,
   מסונן לעסקים לא-מחוקים/לא-מוקפאים בלבד (`is_deleted`, `account_status`).
3. **מבצעי השבוע** — 2 ה-`community_promotions` עם `discount_pct` הגבוה ביותר שעדיין בתוקף
   (`valid_until > NOW()`), ללא תלות במשפחה הספציפית (רשימה גלובלית לכל המשתמשים).
4. **רשימת כל העסקים** — כל `family_groups` מסוג `BUSINESS` פעילים, עם סינון אופציונלי
   `category` (`business_type ILIKE`) ו-`q` (`name ILIKE`), ועד 500 שורות.
5. **סינון "קרוב אליי"** (כש-`lat`+`lng` מגיעים ב-query) — JOIN עם `biz_service_areas`,
   חישוב מרחק אווירי (Haversine) בין מיקום המשתמש לכל אזור שירות של כל עסק בנפרד, השוואה
   מול רדיוס השירות של אותו אזור (`radius_km`, ברירת מחדל 15 אם לא סופק `radius`), ובחירת
   אזור השירות הקרוב ביותר כ"מרחק האמיתי" של העסק (לא ממוצע/מינימום מלאכותי בין כמה אזורים).
   תוצאה: עד 200 עסקים, ממוינים לפי מרחק עולה.

**תת-אזורים ב-UI (`public/marketplace.html`):**
- **ביקרתי לאחרונה** (`renderRecent`, שורה ~758) — 3 כרטיסים, לוגו/תמונה, שם, קטגוריה.
- **מבצעי השבוע** (`renderWeekly`, שורה ~776) — כרטיס מבצע עם כותרת ההטבה, אחוז הנחה,
  תוקף, ושם/לוגו/קטגוריה (`catLabel()`) של העסק המציע.
- **מומלץ לי** (`renderRecommended`, שורה ~798) — שילוב תצוגתי של מבצעי שבוע + מדגם
  מתוך רשימת העסקים (לא אלגוריתם המלצה אישי — ר' "מגבלות ידועות").
- **רשימת עסקים מלאה** (`_renderBizPage`, שורה ~829) — צ'יפים לסינון קטגוריה: הכל, יופי,
  ספורט, התקנות/שירות (ועוד לפי `catLabel`/`BUSINESS_TYPES`, כולל `services` שנוסף בתיקון
  זה), חיפוש טקסט חופשי (מסונן כרגע **רק בצד הלקוח** על התוצאות שכבר נטענו — הפרמטר `q`
  קיים ונתמך במלואו בשרת, אך הלקוח לא שולח אותו היום — ר' מגבלות), וסינון "קרוב אליי".
  כל כרטיס עסק מציג: לוגו/תמונה, שם, קטגוריה, טלפון (אם קיים ב-`store_settings`), ומרחק
  בק"מ כש"קרוב אליי" פעיל.
- **אזורים מועדפים** (`loadFamilyAreas`/`addFamilyArea`/`delFamilyArea`) — ניהול רשימת
  אזורי מגורים/עניין של המשפחה: הוספת עיר (עם `is_primary` לאזור ראשי), geocoding אוטומטי
  דרך Nominatim (OpenStreetMap, חיצוני) אם לא סופקו קואורדינטות ידנית, מחיקה. משמש כקלט
  לסינון "קרוב אליי" (המשתמש יכול לבחור אזור שמור במקום GPS חי).
- **חיפוש חי** (`showSearchResults`) — תיבת חיפוש עם dropdown עד 8 תוצאות מיידי, סגנון
  זהה (לוגו-עיגול/ראשי-תיבות, שם, קטגוריה), כל שורה פותחת עסק באותה דרך כמו שאר הכרטיסים.

**פתיחת עסק (`openBiz(el)`):** קורא `data-biz-id`/`data-biz-name` מהאלמנט שנלחץ → בונה
`storefront.html?groupId=<biz>&familyGroupId=<family>&flowRedeem=1` → שולח `postMessage`
להורה (`{action:'openStorefront', bizId, bizName, url}`, עם `location.origin` כיעד) כדי
שה-`app.js` ההורה יפתח את ה-storefront בטאב/חלון חדש; אם הדף לא רץ בתוך iframe (למשל
נפתח ישירות), פותח `window.open` בעצמו. במקביל (אם יש טוקן+קבוצה) שולח ברקע
`POST /api/family/visit-business` לרישום הביקור — לא חוסם את הניווט אם הקריאה נכשלת.

**API** (family-side, כולן מוגנות `verifyFamily` + בדיקת `groupId===req.familyAuth.groupId`):

| Method | Path | Query/Body | תיאור |
|---|---|---|---|
| GET | `/api/family/marketplace/:groupId` | `category`, `q`, `lat`, `lng`, `radius` | נתוני המרקטפלייס המלאים: יתרת FLW + recent + weekly + רשימת עסקים (+near אם lat/lng) |
| GET | `/api/family/marketplace-history/:groupId` | — | היסטוריית עסקים שביקרו (כל הרשומות, לא רק 3 אחרונים) |
| POST | `/api/family/visit-business` | `businessGroupId` | רישום/עדכון ביקור (upsert לפי זוג family+business, מולידציה שהעסק קיים ומסוג BUSINESS) |
| GET | `/api/family/preferred-areas/:groupId` | — | רשימת אזורים מועדפים (ראשי קודם) |
| POST | `/api/family/preferred-areas/:groupId` | `city`, `radius_km`, `is_primary`, `lat?`, `lng?` | הוספה/עדכון אזור (upsert לפי עיר, geocoding אוטומטי אם אין קואורדינטות) |
| DELETE | `/api/family/preferred-areas/:groupId/:areaId` | — | מחיקת אזור |

**טבלאות:** `family_business_visits` (ביקורים, `last_visited_at`), `biz_service_areas`
(`lat`/`lng`/`radius_km` לכל אזור שירות של עסק), `family_preferred_areas` (`city`,`lat`,
`lng`,`radius_km`,`is_primary`), `family_groups` (type=`BUSINESS`, `business_type`,
`is_deleted`, `account_status`), `store_settings` (`logo_url`,`phone`), `community_promotions`
(מבצעי שבוע, `discount_pct`,`valid_until`,`biz_code`), `flow_wallets` (יתרת FLW,
`entity_type='family'`).

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. `GET /api/family/marketplace/:groupId` לא היה מוגן ב-`verifyFamily` כלל, וגם לא בדק
   התאמת `groupId` מה-URL לזהות המתקשר (IDOR) — כל גורם ללא טוקן יכול היה למשוך את כל
   רשימת העסקים הפעילים, נתוני "מי ביקר לאחרונה" של כל משפחה, ועסקאות אחרות.
2. `GET /api/family/marketplace-history/:groupId` היה מוגן ב-`verifyFamily` אך ללא בדיקת
   בעלות (IDOR) — אפשר היה למשוך היסטוריית ביקורים של משפחה אחרת לפי שינוי `groupId` ב-URL.
3. `loadMarketplaceTab()` ב-`app.js` קרא את טוקן המשפחה ממפתחות localStorage שגויים
   (`'familyToken'`/`'token'`, שלא היו קיימים בפועל) במקום `'ofl_family_token'` — כך שהטוקן
   שהוזרם בפועל ל-iframe היה תמיד ריק. זה לא גרם לתקלה גלויה כל עוד ה-endpoint לא דרש
   אימות, אבל היה הופך את כל המודול ללא פעיל ברגע שמוסיפים אימות — תוקן לפני שהתיקון האחר
   נכנס לתוקף.
4. חישוב "קרוב אליי" השתמש ב-`MIN(lat), MIN(lng), MIN(radius_km)` בנפרד על פני כל אזורי
   השירות של עסק (GROUP BY), מה שיכול "להמציא" נקודת מיקום לא קיימת לעסק עם כמה אזורי
   שירות — תוקן לחישוב מרחק אמיתי לכל אזור שירות בנפרד ובחירת המרחק המינימלי האמיתי.
5. `POST /api/family/visit-business` לא בדק שה-`businessGroupId` שהתקבל אכן קיים והוא
   מסוג `BUSINESS` — תוקן.
6. כרטיסי עסק ב-`marketplace.html` נבנו עם `onclick="openBiz(' + id + ',\'' + name + '\')"` —
   דפוס XSS: גם אחרי `esc()`, הדפדפן מפענח entities בערכי attribute *לפני* שהתוכן מתפרש כ-JS,
   כך ששם עסק עם `'` יכול לשבור מחוץ למחרוזת ה-JS. גם `src` של לוגו/תמונת עסק לא עבר `esc()`.
   תוקן בכל 5 מוקדי הרינדור: מעבר ל-`data-biz-id`/`data-biz-name` + `onclick="openBiz(this)"`,
   ו-`esc()` על כל `src`.
7. `postMessage(msg, '*')` (3 מוקדים) — הודעות בין ה-iframe להורה נשלחו לכל origin; תוקן
   ל-`postMessage(msg, location.origin)`, וגם ה-listener בצד ההורה (`app.js`) נבדק כעת מול
   `e.origin !== window.location.origin`.
8. שגיאות שרת (`catch`) החזירו `e.message` גולמי ללקוח בחלק מה-endpoints — תוקן להודעות
   כלליות בעברית.
9. `biz_category` הוצג כקוד גולמי (למשל `beauty`) במקום תווית בעברית במבצעי השבוע — תוקן
   ל-`catLabel()`. `distance_km` חושב בשרת אך לא הוצג ללקוח — נוסף לכרטיסי הרשימה.

**מגבלות ידועות (לא תוקנו — החלטות מוצר, לא באגים):**
- "מבצעי השבוע"/"מומלץ לי" אינם מותאמים אישית למשפחה — זו רשימה גלובלית.
- חיפוש הטקסט החופשי מסונן כרגע רק בצד הלקוח; הפרמטר `q` קיים ונתמך בשרת אך לא נשלח.
- טיפול `storefront.html` בפרמטר `familyToken` ב-URL לא נבדק כחלק מהמודול הזה (קובץ נפרד,
  בשימוש רחב ממקומות נוספים — סומן לבדיקה נפרדת).

---

## 4. "הזמנות שלי" — renderMyOrders

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול סבל מהכשל האבטחתי החמור ביותר שנמצא עד כה
> בתהליך האפיון**: חמישה endpoints קריטיים ללא אימות כלל (כולל שניים שאפשרו שינוי/כתיבת
> נתונים), ו-**stored XSS שניתן לניצול ללא חשבון בכלל** דרך שילוב של שניים מהם. כולם תוקנו.

**מטרה:** מרכז את כל האינטראקציה הפיננסית/שירותית של המשפחה מול עסקים: הזמנות ממסעכים/
חנויות, הצעות מחיר (RFQ), קריאות שירות (עם צ'אט פנימי ותחנות תשלום), ופעילות מול כל סוג עסק
(יופי/ספורט/מסעדות/שירותים) ב-accordion מאוחד.

**גישה לפי סוג משתמש:** הטאב `myorders` מוגדר כ-`ALWAYS_OPEN_TABS`/`ALWAYS_OPEN_DROPS`
(`app.js:13130-13134`) — **לכל סוגי המשתמשים, כולל CHILD, יש גישה מלאה וזהה** לכל תתי-הטאבים,
ללא שום סינון תפקיד. גם בצד השרת, לאחר התיקון, כל ה-endpoints בודקים רק **זהות קבוצה**
(session תקף של המשפחה), לא תפקיד בתוכה — כך שכל חבר משפחה מחובר, כולל ילד/ה, יכול לאשר/
לסרב הצעת מחיר פיננסית (כגון עבודת שיפוץ יקרה) ולראות את כל הנתונים הכספיים מול עסקים. זהו
מצב קיים ומכוון (לא תוקן כחלק מהתיקון, בניגוד למודול FlowPool שבו הוגבל CHILD) — ראו הערה
בסוף.

### 4.1 זרימת טעינה

```
switchTab('myorders')
  → switchMyOrdersTab('orders') // last session tab
  → fetchMyOrders()
    → GET /api/store/orders/my/:userId (מאומת — session המשפחה)
    → myOrdersCache = data.orders
    → renderMyOrders()
  → loadFamilyServiceCalls()
  → startMyOrdersAutoRefresh()
```

### 4.2 renderMyOrders — לוגיקה מלאה

```javascript
renderMyOrders() {
  // 1. עדכון פאנל סינון (search, period buttons, sort button)
  // 2. applyOrdersFilter(myOrdersCache):
  //    - סינון quote orders (status !== 'quote')
  //    - סינון לפי חיפוש טקסט
  //    - סינון לפי תקופה (week/month/quarter)
  //    - מיון לפי created_at (asc/desc)
  // 3. Pagination: PAGE_SIZE = 15
  //    totalPages = Math.ceil(length / 15)
  //    page = window._myOrdersPageNum
  // 4. רנדור כרטיסי הזמנה
  // 5. Pagination bar (הקודם/הבא עם מונה)
}
```

### 4.3 כרטיס הזמנה — שדות מלאים

- **שם עסק** + אייקון store
- **סטטוס** (צבע גבול + badge + אייקון)
- **תאריך** + שעה (he-IL format)
- **מספר הזמנה** (#id — font-mono)
- **סכום** (₪ bold)
- **Toggle פרטים** (onclick):
  - **פריטים**: שם × כמות × מחיר שורה
  - **הערות** (אם קיים)
  - **Badge "הומרה מהצעת מחיר #X"** (אם quote_status=approved)
  - **אישור קבלה** (הזמנות is_delivery=true, status=completed):
    - "✅ כן, קיבלתי" → פתיחת מודל דירוג 1-5 (`_orderRatingModal`/`_submitOrderRating`) → POST feedback
    - "❌ לא קיבלתי" → הודעת פנייה לעסק, ללא ביטול בפועל — **אין מנגנון "ביטול הזמנה" צד-לקוח במודול זה**, רק דיווח "לא קיבלתי"

### 4.4 תתי-טאבים נוספים

- **הצעות מחיר** (`renderFamilyQuotesTab`/`openFamilyQuoteView`) — טיימליין אירועי הצעה מלא,
  תצוגת פריטים/הנחה/מע"מ, תגובת לקוח (אישור/סירוב/בקשת הנחה/בקשת שינויים/הודעה חופשית) דרך
  `PATCH /api/store/quotes/:id/customer-response`.
- **קריאות שירות** (`renderBusinessServiceCallsTab`/`openFamilyCallModal`) — תקלות בית
  (`renderMyFaultsAsServiceCalls`, מוצג גם כאן) + קריאות שירות חיצוניות מול עסקים, עם צ'אט
  פנימי (`service_call_messages`) ותחנות תשלום (`work_order_payments`), ו-polling נפרד של
  הצ'אט כל 10 שניות כל עוד המודל פתוח.
- **הפעילות שלי** (`loadMyActivities`/`_renderBizAccordion`) — accordion לכל עסק מקושר, מרונדר
  לפי `bizType`: תורים/RFQ/אישור-דחיית תור ללקוחות יופי, מנויים/צ'ק-אינים לספורט, היסטוריית
  הזמנות למסעדות/שירותים. מקור הנתונים: `GET /api/family/business-activity/:familyGroupId/:bizGroupId`.

### 4.5 Auto-refresh

`startMyOrdersAutoRefresh()` — **רץ כל 3 שניות בפועל** (לא 20 שניות כפי שתועד בעבר — תוקן כאן
לשקף את הקוד האמיתי), ללא קשר לטאב הפעיל: מרענן תמיד את `myOrdersCache` ובודק שינויי סטטוס
(מציג toast + בד bell-badge), אך מעדכן את ה-DOM בפועל רק אם `myorders` הוא הטאב הפעיל. אם טאב
"הצעות" גלוי — שולף גם הצעות מחיר. ה-interval אינו נוקה באופן מפורש (`clearInterval`) באף
מקום, אך בפועל אינו מהווה דליפה — `logout()` מבצע ניווט מלא (`window.location.href='/'`)
שמאפס את כל מצב ה-JS, כולל אינטרוולים, באותו אופן כמו אינטרוולים גלובליים נוספים באפליקציה
(למשל `pollInterval`, רענון bell badge).

**API — כל ה-endpoints הבאים מוגנים כעת `verifyFamily`/`verifyFamilyOrBiz`/`verifyBiz` עם
בדיקת בעלות (לאחר התיקון המתואר למטה):**

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | הזמנות (לא כולל הצעות) — `userId` נבדק מול session |
| GET | `/api/store/quotes/family/:familyGroupId` | הצעות מחיר פעילות למשפחה |
| POST | `/api/store/orders/:id/customer-feedback` | אישור קבלה / "לא קיבלתי" + דירוג (1-5, נאכף) |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובת לקוח להצעה (allow-list לסוגי תגובה) |
| GET | `/api/family/business-activity/:familyGroupId/:bizGroupId` | פעילות accordion לפי סוג עסק |
| PUT | `/api/family/:familyGroupId/beauty/appointments/:id/client-confirm` | אישור/דחיית תור יופי |
| GET/POST | `/api/service-calls/:id/messages` | צ'אט קריאת שירות (משפחה/עסק, לפי שייכות בפועל) |
| GET | `/api/service-calls/:id/payments` | תחנות תשלום לקריאת שירות |
| POST | `/api/service-calls/:id/payments` | הוספת תחנת תשלום (עסק בלבד) |
| GET | `/api/family/linked-businesses/:groupId` | עסקים מקושרים (היה מוגן נכון גם לפני התיקון) |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **5 endpoints ללא אימות כלל**: `GET /api/store/orders/my/:userId`,
   `GET /api/store/quotes/family/:familyGroupId`,
   `GET /api/family/business-activity/:familyGroupId/:bizGroupId`,
   `GET`/`POST /api/service-calls/:id/messages`, `GET`/`POST /api/service-calls/:id/payments`,
   ו-`PUT /api/family/:familyGroupId/beauty/appointments/:id/client-confirm` — כולם קיבלו את
   מזהה המשפחה/המשתמש **מה-URL או מגוף הבקשה בלבד**, ללא session. כל גורם לא-מחובר, בניחוש
   ID רציף, יכול היה לקרוא היסטוריית הזמנות מלאה, הצעות מחיר פיננסיות (כולל הנחות), תורים/
   מנויים/RFQ אישיים, וצ'אט פרטי + תשלומים של כל קריאת שירות — **ואף לכתוב** הודעות מזויפות
   "מהעסק" ולשנות סטטוס תור, ללא שום הרשאה.
2. **Stored XSS הניתן לניצול ללא חשבון כלל**: בשילוב עם #1, `safeStr()` (הפונקציה ששימשה
   כמעט בכל רינדור במודול) מבצעת escaping חלקי בלבד (`'`/`"`, לא `<`/`>`/`&`). תוקף שאינו
   מחובר בכלל יכול היה להזריק הודעת צ'אט זדונית (`POST /api/service-calls/:id/messages` ללא
   אימות) לכל `call_id` נחוש, וכל משתמש משפחה שפותח את אותה קריאת שירות (`openFamilyCallModal`)
   מריץ את הקוד הזדוני בדפדפנו. תוקן: מעבר ל-`escHtml()` (בריחה מלאה) בכל תצוגת טקסט חיצוני
   במודול (הודעות, כותרות, תיאורים, שמות עסק/טכנאי, הערות, תגובות לקוח).
3. **Bypass מובנה בבדיקת ה-IDOR היחידה שהייתה קיימת** ב-`customer-response`: הבדיקה
   `if (familyGroupId && ...)` דילגה על עצמה לחלוטין אם הקורא פשוט לא שלח `familyGroupId`
   בגוף הבקשה. תוקן: המזהה נלקח כעת מה-session בלבד (`req.familyAuth.groupId`), לא מהבקשה.
4. דליפת `e.message` גולמי ללקוח בכל ה-endpoints שנסקרו — תוקן להודעות כלליות בעברית.
5. אין ולידציה על `rating` (נדרש 1-5) — תוקן (ערך מחוץ לטווח נדחה לערך ריק).
6. אין allow-list לסוגי תגובת לקוח (`responseType`) בהצעת מחיר — תוקן.
7. אין הגבלת אורך על טקסט חופשי (הערות/תגובות/הודעות צ'אט) — נוספה הגבלה (1000-2000 תווים
   לפי סוג השדה), בדומה לתיקון המקביל במודול FlowPool.
8. פער תיעוד: Auto-refresh תועד בעבר כ"20 שניות", בפועל 3 שניות — תוקן כאן.

**לא תוקן (סיכון/שינוי התנהגות, הוחלט להשאיר כמגבלה ידועה ולא כקוד שבור):** היעדר בידול
הרשאות role בתוך המודול (CHILD = ADMIN מבחינת יכולת אישור הצעות מחיר וצפייה בנתונים
פיננסיים) — בשונה ממודול FlowPool, כאן לא נחסם CHILD, מכיוון שחסימה גורפת עלולה לפגוע
בתרחישי שימוש לגיטימיים (למשל נער/ה שמנהל/ת בעצמו/ה תיאום מול מורה פרטי). אם רצוי לשנות
זאת, יש להחליט תחילה אילו פעולות ספציפיות (למשל רק אישור הצעת מחיר מעל סכום מסוים) ראוי
להגביל ל-ADMIN, כדי לא לפגוע בפונקציונליות קיימת.

---

## 5. פיצ'רי AI — familAI

### 5.1 AI Battery System

```javascript
// מכסה: 10 פעולות יום לקבוצה (מתאפס בחצות)
ai_tokens INT DEFAULT 10
last_token_reset DATE DEFAULT CURRENT_DATE

// בדיקה לפני כל פעולה AI:
handleAITokens(groupId):
  → אם last_token_reset < TODAY: איפוס ל-10
  → אם is_premium: עוקף מגבלה
  → אם tokens > 0: tokens -= 1, return true
  → אחרת: return false → BATTERY_EMPTY error
```

**UI Battery:**
- `#ai-battery-indicator` — badge בכותרת: "⚡ X/10"
  - > 3 tokens: slate
  - 1-3 tokens: כתום
  - 0 tokens: אדום
  - Pro: gradient indigo-purple + "⚡ ∞ (Pro)"
- `#ai-battery-modal` — "הסוללה שלי התרוקנה" modal
- `#ai-warning-modal` — אזהרה לפני כל פעולה AI (ניתן להשתיק ליום)

### 5.2 פעולות AI

| פעולה | Endpoint | צרכן |
|---|---|---|
| יצירת מתכון | `POST /api/recipes/generate` | token |
| יצירת אתגר אקדמיה | `POST /api/academy/ai-generate` | token |
| ייעוץ ליעד חיסכון | `POST /api/goals/familai-advice` | token |
| תובנות תקציב | `POST /api/budget/familai-insight` | token |
| דוח מלאי מזווה | `POST /api/pantry/familai-insight` | token |
| תובנות תשקיף | `POST /api/forecast/familai-insight` | token |
| אימות משימה בתמונה | `POST /api/tasks/vision-verify` | token |
| סריקת קבלה | `POST /api/shopping/scan-receipt` | token |
| זיהוי מוצר | `POST /api/shopping/identify-product` | token |
| הסבר שגיאה (Tutor) | `POST /api/academy/tutor` | token |
| יצירת משימות AI | `POST /api/tasks/ai-generate` | token |
| צ'אט familAI | `openFamilaiChatModal()` | token |

### 5.3 executeWithAIWarning

```javascript
executeWithAIWarning(actionFn) {
  // אם Pro → מבצע ישירות
  // אם tokens <= 0 → ai-battery-modal
  // אם ofl_hide_ai_warning === today → מבצע ישירות
  // אחרת → ai-warning-modal עם "המשך בפעולה"
}
```

**Model:** Gemini 1.5/2.5 Flash (Google AI) — Auto-Discovery

---

## 6. API Endpoints — Family Environment

### 6.1 Auth

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/login` | כניסה |
| POST | `/api/groups` | יצירת קבוצה חדשה |
| POST | `/api/join` | הצטרפות לקבוצה |
| POST | `/api/forgot-code` | שחזור קוד |
| POST | `/api/groups/onboard` | השלמת הקמה |

### 6.2 Data

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/data/:userId` | שליפת כל הנתונים (main call) |
| GET | `/api/group/members` | חברי קבוצה |
| GET | `/api/transactions` | תנועות |
| POST | `/api/transaction` | הוספת תנועה |
| PUT | `/api/transaction/:id` | עריכה |
| DELETE | `/api/transaction/:id` | מחיקה |

### 6.3 Finance

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/admin/payday` | PayDay |
| POST | `/api/admin/adjust-balance` | התאמת יתרה |
| POST | `/api/admin/update-settings` | הגדרות דמי כיס |
| GET | `/api/loans` | הלוואות |
| POST | `/api/loans/request` | בקשת הלוואה |
| POST | `/api/loans/approve` | אישור הלוואה |
| POST | `/api/loans/reject` | דחיית הלוואה |
| POST | `/api/goals` | יצירת יעד |
| POST | `/api/goals/deposit` | הפקדה ליעד |
| GET | `/api/budget/filter` | תקציב |
| POST | `/api/budget/update` | עדכון תקציב |

### 6.4 Shopping & Pantry

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/shopping/add` | הוספת פריט |
| POST | `/api/shopping/update` | עדכון פריט |
| DELETE | `/api/shopping/delete/:id` | מחיקת פריט |
| DELETE | `/api/shopping/clear/:groupId` | ניקוי עגלה |
| POST | `/api/shopping/checkout` | סיום קנייה |
| GET | `/api/shopping/history` | היסטוריה |
| POST | `/api/pantry/add` | הוספת מוצר |
| POST | `/api/pantry/update` | עדכון כמות |
| POST | `/api/pantry/use` | שימוש במוצר |
| DELETE | `/api/pantry/delete/:id` | מחיקה |

### 6.5 Tasks & Academy

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/tasks` | יצירת משימה |
| POST | `/api/tasks/update` | עדכון/אישור |
| POST | `/api/tasks/ai-generate` | AI משימות |
| POST | `/api/tasks/vision-verify` | אימות תמונה AI |
| POST | `/api/academy/assign` | הקצאת אתגר |
| POST | `/api/academy/submit` | הגשת תוצאות |
| POST | `/api/academy/ai-generate` | יצירת אתגר AI |
| POST | `/api/academy/tutor` | AI tutor |

### 6.6 Orders & Community

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | הזמנות שלי |
| GET | `/api/store/quotes/family/:groupId` | הצעות מחיר |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובה להצעה |
| POST | `/api/store/orders/:id/customer-feedback` | דירוג הזמנה |
| POST | `/api/community/user-create` | הצטרפות לקהילה |

### 6.7 AI Endpoints

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/recipes/generate` | מתכון AI |
| POST | `/api/goals/familai-advice` | ייעוץ יעד |
| POST | `/api/budget/familai-insight` | תובנות תקציב |
| POST | `/api/pantry/familai-insight` | דוח מלאי |
| POST | `/api/forecast/familai-insight` | תובנות תשקיף |
| POST | `/api/shopping/scan-receipt` | סריקת קבלה |
| POST | `/api/shopping/identify-product` | זיהוי מוצר |

### 6.8 Support & Settings

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/support/ticket` | פתיחת קריאה |
| GET | `/api/support/tickets/my/:groupId` | קריאות שלי |
| GET | `/api/banners` | באנרים |
| GET | `/api/settings/welcome` | הודעת ברוכים |
| GET | `/api/public/legal/:key` | תקנון/פרטיות |

---

## 7. לוגיקות מיוחדות

### 7.1 Polling Intervals

| Interval | תיאור |
|---|---|
| 30,000 ms | `fetchData()` + `fetchLoans()` + `fetchPendingUsers()` (ADMIN) |
| 30,000 ms | `refreshBellBadge()` |
| 20,000 ms | `startMyOrdersAutoRefresh()` (רק ב-myorders tab) |

### 7.2 localStorage Keys

| Key | תוכן |
|---|---|
| `ofl_session` | `{user, group}` JSON |
| `ofl_sa_token` | טוקן Super Admin |
| `ofl_banners` | cache של באנרים |
| `ofl_ai_skip_{date}` | מניעת אזהרת AI יומית |
| `ofl_hide_ai_warning` | תאריך השתקת אזהרת AI |
| `tour_done_{userId}` | Tour הושלם |
| `ofl_welcome_{userId}_{code}` | הודעת welcome נצפתה |
| `ofl_upgrade_shown_{groupId}` | modal שדרוג הוצג |
| `acc_*` | הגדרות נגישות |

### 7.3 PWA

- `manifest.json` + Service Worker
- `theme-color: #4f46e5` (indigo)
- אייקונים: 192×192, 152×152
- כותרת PWA: "FamilyFlow" / "Oneflow Life"
- `beforeinstallprompt` → `deferredPrompt` → prompt() ב-Android
- iOS: הוראות ידניות (Share → Add to Home Screen)
- `setupPwaInstallSection()` — מזהה iOS/Android אוטומטית

### 7.4 Tour System

**`checkAndStartTour(force)`:**
- בדיקה: `tour_done_{userId}` ב-localStorage
- אם לא נצפה (או force=true) → הפעלה לפי role

**`triggerManualTour()`** — חשוף כ-`window.triggerManualTour`, ניתן לקריאה מ-Help

**ADMIN Tour (14 שלבים):**
header → AI battery → יתרה → FAB → shop → pantry → bank → tasks → academy → budget → forecast → recipes → members

**CHILD Tour (11 שלבים):**
ברכת ברוכים הבאים → AI battery → ארנק → shop → pantry → bank → tasks → academy → budget → forecast → recipes

**ספריית Tour:** Intro.js v7.2.0, RTL mode, `disableInteraction: true`

### 7.5 Notifications / Bell Badge

- `#bell-badge` (כותרת header) + `#fgnav-bell-badge` (Family Group NAV)
- `refreshBellBadge()` — כל 30 שניות
- `#unread-inbox-badge` — הודעות לא-נקראות ב-inbox

**Inbox (`openInboxModal`):** הודעות נכנסות מעסקים ומהמערכת

### 7.6 Accessibility

```javascript
accState = {
  'text-lg': false,       // הגדלת פונט 110%
  'grayscale': false,     // גוונים אפורים
  'contrast': false,      // ניגודיות מוגברת
  'readable-font': false, // Arial + letter-spacing
  'highlight-links': false // מסגרת סביב קישורים
}
```

פאנל נגישות: `openAccessibilityModal()` — floating pill בתחתית (תמיד גלוי).

### 7.7 באנרים פרסומיים

- `#app-banner-top` — באנר עליון (מתחת לHeader, 96px)
- `#app-banner-bottom` — באנר תחתון (מעל ה-FAB, 96px)
- טעינה: `GET /api/banners?type=FAMILY`
- Cache: localStorage `ofl_banners`

### 7.8 FAB — Floating Action Button

`#fab-container` (fixed bottom-left):
- כפתור ראשי (+) → פותח menu
- כפתורי menu:
  - 🛒 הוספה לקניות
  - ➕ הכנסה חדשה (`openTransactionModal('income')`)
  - ➖ הוצאה חדשה (`openTransactionModal('expense')`)
- כשב-shop tab: FAB מועלה (`fab-lifted`) מעל ה-cart footer

### 7.9 Floating Pill

בתחתית המסך (fixed, center):
- **עוזרת אישית** (familAI chat) — מוצג בתנאים מסוימים
- **מפריד**
- **צ'אט משפחתי** (`openTeamChatModal`) — badge הודעות לא-נקראות
- **מפריד**
- **נגישות** (תמיד גלוי)

### 7.10 support tickets

- `#tickets-modal` — פתיחת קריאת שירות (נושא + תיאור)
- `POST /api/support/ticket` → מייל התראה לסופר-אדמין
- סטטוסים: open / in_progress / resolved

### 7.11 SA Impersonation

אם `localStorage.getItem('ofl_sa_token')`:
- מציג banner אדום עם "מחובר כ-Super Admin (השתלטות)"
- כפתור "התנתק וחזור לניהול" → `exitImpersonation()`

---

## 8. Chart.js — גרף תשקיף

- `ratioChart` — Doughnut/Pie chart ב-`content-forecast`
- Canvas: `#ratioChart` (200×200)
- Script: CDN defer
- נבנה מחדש בכל `renderForecast()`
- מנהל instance: `forecastRatioChart` — destroy לפני יצירה מחדש

---

## 9. מבנה מסד הנתונים (טבלאות רלוונטיות לFamily)

| טבלה | תיאור |
|---|---|
| `family_groups` | קבוצות (משפחות/עסקים) |
| `users` | חברי קבוצה |
| `transactions` | תנועות כספיות |
| `tasks` | משימות |
| `budget_allocations` | הגדרות תקציב |
| `goals` | יעדי חיסכון |
| `loans` | הלוואות |
| `shopping_list` | רשימת קניות |
| `shopping_trips` | סיכומי קניות |
| `shopping_trip_items` | פריטי כל קניה |
| `pantry` | מלאי ביתי |
| `quiz_bundles` | חבילות אתגרי אקדמיה |
| `quiz_questions` | שאלות |
| `user_assignments` | הקצאות אתגרים |
| `communities` | קהילות |
| `community_businesses` | עסקים בקהילה |
| `store_orders` | הזמנות מעסקים |
| `inbox_messages` | הודעות נכנסות |
| `support_tickets` | קריאות שירות |
| `team_chat` | צ'אט משפחתי |
| `global_products` | מסד מוצרים גלובלי (ברקוד) |

---

*נוצר אוטומטית מקוד המקור · Oneflow Life · 2026-06-20*
