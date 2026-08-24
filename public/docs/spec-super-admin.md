# מפרט טכני מקיף — סביבת Super Admin (SA) — Oneflow Life

> מסמך זה מתאר את מלוא הפונקציונליות של סביבת ה-Super Admin במערכת Oneflow Life.  
> נכתב לשימוש כמקור ידע ב-NotebookLM ולצרכי פיתוח.  
> תאריך: 2026-06-20

---

## 1. ארכיטקטורה ואימות

### 1.1 מיקום וקבצים

| רכיב | פרטים |
|------|--------|
| URL | `/sa.html` |
| קובץ HTML | `sa.html` (שלד HTML) |
| קובץ JS ראשי | `sa-app.js` (~6000+ שורות) |
| Backend | `server1.js` (Node.js / Express) |
| מסד נתונים | PostgreSQL |
| Frontend | Vanilla JS + TailwindCSS (ללא framework) |

סביבת SA היא אחת מ-4 סביבות מופרדות במערכת:
- **FAMILY** — `/` (ניהול משפחה)
- **BIZ** — `/business.html` (ניהול עסקי)
- **SUPER-ADMIN** — `/sa.html` (ניהול כלל המערכת)
- **ZONE-MANAGER** — ניהול אזורי

### 1.2 שיטות אימות

ישנן שתי שיטות כניסה לסביבת Super Admin:

#### שיטה 1: SMS OTP (Master)
1. המאסטר מזין מספר טלפון
2. מערכת שולחת SMS עם OTP בן 6 ספרות (Twilio)
3. `POST /api/superadmin/send-otp` — שליחת קוד לטלפון `SUPERADMIN_PHONE`
4. `POST /api/superadmin/verify-otp` — אימות הקוד (תוקף 5 דקות)
5. מוחזר token: `[TOKEN — ראה משתנה סביבה, לא לתעד ערך בפועל כאן]`
6. משתמש עם `permissions: ['all']` — גישה מלאה לכל המודולים

**פרטי OTP:**
- 6 ספרות אקראיות
- פגיעות זמן: 5 דקות
- שמור ב-Map זיכרון: `otpCache` (לא במסד נתונים)
- רק `SUPERADMIN_PHONE` (משתנה סביבה) מאושר לקבלה

#### שיטה 2: Staff Login (צוות)
1. עובד SA מזין אימייל + סיסמה
2. `POST /api/superadmin/login` — בדיקה מול טבלת `sa_users` + JOIN לטבלת `sa_teams`
3. הרשאות RBAC לפי שדה permissions בטבלת `sa_teams`

### 1.3 אחסון Session

```js
// Token
localStorage.setItem('ofl_sa_token', token);

// User object
window.currentSAUser = {
  id,
  name,
  email,
  team,
  permissions: []  // ['all'] למאסטר, או ['support', 'biz', ...] לצוות
};
localStorage.setItem('ofl_sa_user', JSON.stringify(currentSAUser));
```

**טעינת דף:**
- אם `ofl_sa_token` ו-`ofl_sa_user` קיימים ב-localStorage → כניסה אוטומטית
- `loadSAData()` → `POST /api/superadmin/data` → `switchSATab('pulse')`

---

## 2. ניווט ו-SA_GROUPS

### 2.1 מבנה הניווט

הניווט מורכב מ-7 קבוצות ראשיות (SA_GROUPS), כל אחת עם טאב ברירת מחדל:

```js
const SA_GROUPS = {
    home:       { tabs: ['pulse', 'stats'],             labels: ['דופק מערכת', 'דוחות'],           default: 'pulse' },
    customers:  { tabs: ['comm', 'biz', 'clients'],     labels: ['קהילות', 'עסקים', 'קבוצות'],      default: 'comm' },
    finance:    { tabs: ['finance'],                    labels: [],                                  default: 'finance' },
    supportdev: { tabs: ['support', 'devops'],          labels: ['קריאות שירות', 'פיתוח ומוצר'],    default: 'support' },
    contentmkt: { tabs: ['content', 'inbox', 'legal'],  labels: ['מיתוג ותוכן', 'שיווק', 'משפטי'], default: 'content' },
    partners:   { tabs: ['partners'],                   labels: [],                                  default: 'partners' },
    system:     { tabs: ['hr', 'sysmap'],               labels: ['צוות ונציגים', 'מפת המערכת'],     default: 'hr' },
};
```

### 2.2 15 הטאבים המלאים

| טאב | קבוצה | תיאור |
|-----|-------|--------|
| `pulse` | home | דופק מערכת — KPIs בזמן אמת |
| `stats` | home | דוחות — סטטיסטיקות מורחבות |
| `comm` | customers | קהילות — ניהול קהילות |
| `biz` | customers | עסקים — ניהול עסקים |
| `clients` | customers | קבוצות — כל הקבוצות במערכת |
| `finance` | finance | פיננסים — עמלות ופינוי |
| `support` | supportdev | קריאות שירות — tickets |
| `devops` | supportdev | פיתוח ומוצר — Kanban + QA |
| `content` | contentmkt | מיתוג ותוכן — ניהול תוכן |
| `inbox` | contentmkt | שיווק — שידורים ועדכוני גרסאות |
| `legal` | contentmkt | מסמכים משפטיים |
| `partners` | partners | שותפים — מנהלי אזורים |
| `hr` | system | צוות ונציגים — ניהול SA staff |
| `sysmap` | system | מפת המערכת |
| `dashboard` | — | (legacy, open access) |

### 2.3 Sub-Nav Bar

כאשר קבוצה מכילה יותר מטאב אחד — מוצגת שורת ניווט משנה עם כפתורי pill עבור כל טאב בתוך הקבוצה.

---

## 3. הרשאות (checkTabAccess)

### 3.1 מיפוי טאב → הרשאה נדרשת

```js
const tabRequirements = {
    'pulse':     'open',
    'dashboard': 'open',
    'clients':   'open',
    'sysmap':    'open',
    'legal':     'open',
    'support':   'support',
    'devops':    'devops',
    'stats':     'stats',
    'comm':      'comm',
    'biz':       'biz',
    'content':   'content',
    'hr':        'users',
    'inbox':     'marketing',
    'partners':  'all',
    'finance':   'all',
};
```

### 3.2 כללי גישה

| רמה | תנאי |
|-----|------|
| גישה מלאה | `permissions.includes('all')` (מאסטר SA) |
| גישה לטאב ספציפי | `permissions.includes(tabRequirements[tab])` |
| גישה פתוחה | טאבים עם ערך `'open'` — נגישים לכל משתמש SA |
| חסום | אין הרשאה מתאימה → הטאב מוסתר/חסום |

### 3.3 הרשאות RBAC אפשריות

`support` | `devops` | `marketing` | `stats` | `biz` | `comm` | `users` | `content` | `all`

---

## 4. דופק מערכת (pulse)

### 4.1 כרטיסי KPI

הטאב מציג 10 כרטיסי KPI דו-ערכיים (ערך 24 שעות + ערך כולל/מצב):

| KPI | ערך שמאל (24h) | ערך ימין (סה"כ/מצב) |
|-----|----------------|---------------------|
| עסקים | חדשים ב-24h | סה"כ עסקים |
| עסקים פעילים | פעילים | ממתינים לאישור |
| הכנסות | ב-24h | סה"כ כולל |
| משפחות | חדשות ב-24h | סה"כ משפחות |
| משתמשים | חדשים ב-24h | סה"כ משתמשים |
| קהילות | חדשות ב-24h | עם הנחות |
| AI | שימוש ב-24h | tokens שנוצלו |
| תמיכה | פתיחות ב-24h | סגורות (+ SLA) |
| בריאות מערכת | שגיאות | QA% |
| פיתוח | משימות | Releases |

### 4.2 לוגיקות מיוחדות

**SLA Breach:**
- Ticket פתוח מעל 24 שעות → border אדום + אנימציית pulse על כרטיס התמיכה

**Anomaly Alert:**
- אם `errorCount >= 3` → banner אדום: "זוהתה אנומליה"

**Fullscreen Mode:**
- `togglePulseFullscreen()` → מפעיל overlay מלא מסך
- רענון אוטומטי כל 30 שניות
- שימוש ב-browser Fullscreen API האמיתי

### 4.3 Activity Stream

- מציג 20 האירועים האחרונים
- אירועים פיננסיים מסומנים בצבע שונה
- טעינה דרך: `loadSAData()` → `POST /api/superadmin/data` → `renderLivePulse(activityData, stats)`

---

## 5. קריאות שירות (support)

### 5.1 ניהול Tickets

**פילטרים:**
- חיפוש חופשי
- סטטוס: open / in_progress / resolved
- עדיפות: critical / high / normal / low
- תקופה: 1m / 3m / 6m / תאריכים מותאמים

**סטטוסים וצבעים:**

| סטטוס | צבע |
|-------|-----|
| open | אדום |
| in_progress | כתום |
| resolved | ירוק |

**רמות עדיפות:**

| עדיפות | סמל |
|--------|-----|
| critical | 🚨 |
| high | 🔴 |
| normal | 🟡 |
| low | 🔵 |

### 5.2 מודל Ticket (חלון פרטים)

- היסטוריית שיחה בסגנון צ'אט
- ציר זמן (milestone timeline)
- פרטי קשר: אימייל / טלפון / WhatsApp

**פעולות זמינות:**
- תגובה (ציבורית או הערה פנימית)
- שינוי סטטוס
- שיוך לצוות
- קביעת עדיפות ו-ticket_type

### 5.3 SLA Matrix

- ניתן להגדיר SLA (בשעות) לכל שילוב של `ticket_type × priority`
- `GET /api/sa/sla-matrix` — קריאה
- `POST /api/sa/sla-matrix` — שמירה

### 5.4 AI Triage

- `POST /api/superadmin/tickets/:id/ai-triage`
- קורא את תיאור הבקשה → AI מסווג אוטומטית: עדיפות + ticket_type
- מעדכן את הטיקט + מוסיף רשומת audit log

### 5.5 המרה למשימת פיתוח

1. בדיקת כפילויות: `POST /api/sa/dev/check-duplicates` (AI)
2. אם לא כפול — יצירת כרטיס Kanban
3. מוחזר: `{ isDuplicate, explanation, matchedTaskId, confidence }`

### 5.6 Feedback Loop

- סגירת ticket עם הודעה ללקוח + סיכום ציר זמן
- `POST /api/sa/tickets/:id/feedback-loop`

### 5.7 יצירת Ticket ידנית

`POST /api/superadmin/tickets` — SA יוצר ticket מטעם עצמו

---

## 6. פיתוח ומוצר (devops)

### 6.1 5 תת-טאבים

| תת-טאב | שם | תיאור |
|---------|-----|--------|
| `matrix` | Product Matrix | ספר QA — תרחישי בדיקה |
| `kanban` | Kanban | לוח משימות גרירה |
| `alm` | ALM Hub | תצוגת שורות קריאה-בלבד |
| `qa` | QA Staging | טבלת טסטים מאוחדת |
| `release` | Release Notes | בניית עדכוני גרסאות |

### 6.2 Product Matrix (matrix)

- טבלת תרחישי בדיקה: `scenario_name`, `module_name`, `environment`, `expected_result`, `status`
- סטטוסים: `passed` / `failed` / `in_dev` / `untested`
- Pagination: 15 רשומות לעמוד
- APIs: `GET/POST /api/sa/matrix`, `PUT /api/sa/matrix/:id/status`, `DELETE /api/sa/matrix/:id`

### 6.3 Kanban

- 4 עמודות: `backlog` → `in_progress` → `qa` → `done`
- Drag & Drop בין עמודות
- **הגבלה:** לא ניתן להעביר ישירות `in_progress` → `done` (חייב לעבור QA)
- פילטרים: גרסה / חיפוש חופשי

**סוגי משימות:**
| סוג | סמל |
|-----|-----|
| feature | ✨ |
| bug | 🐞 |
| ui | 🎨 |
| tech | 🔧 |

- כל משימה יכולה להיות מקושרת לטיקט מקורי
- כפתור Feedback Loop כאשר משימה ב-done

**APIs:** `GET/POST/PUT/DELETE /api/sa/dev/tasks`, `PUT /api/sa/dev/tasks/:id/status`

**Sub-tasks:** `GET/POST /api/sa/dev/subtasks`, `PUT /api/sa/dev/subtasks/:id/toggle`, `DELETE /api/sa/dev/subtasks/:id`

### 6.4 ALM Hub (alm)

- תצוגת שורות קריאה-בלבד עם ספירות
- קישורים לטיקטים קשורים

### 6.5 QA Staging (qa)

- טבלת טסטים מאוחדת: DB tests + Kanban tasks במצב qa/done
- פילטרים: pass / fail / pending
- APIs: `GET /api/sa/qa/tests`, `POST /api/sa/qa/runs`
- AI לייצור QA אוטומטי: `POST /api/sa/ai/generate-qa`

### 6.6 Release Notes (release)

- בניית newsletter / release notes עם FamilAI
- זרימה: משימות Kanban done → AI כותב טקסט → תבנית HTML
- תבנית HTML: header gradient, לוגו, טקסט מעוצב
- `POST /api/sa/ai-generate`
- שידור ל: כולם / עסקים / משפחות דרך inbox
- ייצוא ל-PDF

### 6.7 זרימת סטטוס Kanban

```
backlog → in_progress → qa → done
                         ↑
           (חייב לעבור QA לפני done)
```

**Notifications (פנימיות SA):**
- נשמר ב: `localStorage('sa_notifs_' + userId)`
- סוגים: `info` / `success` / `warning`
- טריגרים: משימה עוברת qa→done, in_progress→qa, קבלת גרסה
- פעמון עם badge count ב-topbar

---

## 7. לקוחות ועסקים (comm / biz / clients)

### 7.1 קהילות (comm)

**טבלת קהילות:**
- שם, קוד, אימייל/סיסמה מנהל, מספר משפחות, מספר עסקים

**יצירת קהילה:**
- שם, תגי ערים (autocomplete מרובה), קוד, credentials מנהל
- העלאת תמונה: canvas resize → 600px JPEG 0.8 → Base64

**עריכת קהילה:**
- אותם שדות + הגדרת / הסרת מנהל קהילה

**חיבור עסק לקהילה:**
- `POST /api/sa/community-business` + הגדרת % הנחה

**בקשות הצטרפות ממתינות:**
- אישור / דחייה: `POST /api/sa/community-business/approve`

**שיוך לאזור:**
- שיוך קהילה לזון מנג'ר: `PUT /api/sa/communities/:id/assign-zone`

### 7.2 עסקים (biz)

- טבלת כל העסקים: `GET /api/sa/businesses`
- חיפוש לפי שם / קוד
- לכל עסק: ניהול חיבורי קהילה (הוספה / הסרה / סטטוס)

### 7.3 קבוצות (clients)

**תצוגה:**
- כל הקבוצות (משפחות + עסקים + ONEFLOW members)
- כרטיסים מתרחבים: שם, קוד, AI tokens (10 ברירת מחדל / ∞ ל-PRO), תאריך יצירה, badge סוג, badge PRO

**פעולות לכל קבוצה:**
| פעולה | תיאור |
|-------|--------|
| Impersonate | כניסה לסביבה של הקבוצה כמנהל |
| Edit | עריכת שם / אימייל / features |
| PRO toggle | הפעלה/כיבוי מנוי PRO |
| Delete | מחיקת קבוצה |
| Upgrade member→family | שדרוג סוג קבוצה |

**ניהול משתמשים:**
- רשימת משתמשים לכל קבוצה עם עריכה / מחיקה

**ניהול מודולים (member-type):**
- 17 checkboxes מודולים
- שמירה: `PATCH /api/sa/groups/:id/modules`

**Feature flags לעסקים:**

`store` | `b2b` | `academy` | `calendar` | `finance` | `inventory` | `crm` | `deliveries` | `foodcost` | `ai` | `timeclock` | `cashflow` | `budget` | `forecast` | `tasks` | `community` | `members` | `shifts`

---

## 8. שיווק ותוכן (inbox / content)

### 8.1 שיווק (inbox)

**שידור הודעה:**
- בחירת יעד: כולם / עסקים / משפחות / ספציפי לפי ID
- נושא + תוכן HTML
- `POST /api/sa/inbox/broadcast`

**בנאי Release Notes:**
- זהה לטאב `release` ב-devops
- FamilAI מייצר תוכן HTML
- שידור לכלל המשתמשים

### 8.2 מיתוג ותוכן (content)

**לוגו AI גלובלי:**
- העלאת תמונה → canvas resize → 512px PNG → Base64
- שמירה ב: `system_settings.global_ai_logo`
- מוצג כ-favicon/og:image דרך `GET /api/system/public-config`

**Login Slides:**
- העלאת תמונות → carousel במסך כניסה
- toggle פעיל/לא פעיל לכל שקופית

**Banners (משפחות):**
- Banner עליון: טקסט + קישור + תמונה Base64
- Banner תחתון: אותה מבנה
- `POST /api/superadmin/banners`

**Banners (עסקים):**
- אותה מבנה, keys עם prefix `business_`

**Welcome Banner (חברים):**
- toggle on/off
- טקסט + תמונה

**Module Popup Settings:**
- לכל אחד מ-17 המודולים: title / marketing text / promotional image / enabled toggle
- מוצג כאשר משתמש לוחץ על מודול נעול

**הודעות ברוכים הבאים:**
- נפרד למשפחה (`welcome_msg`) ולעסק (`business_welcome_msg`)
- `POST /api/superadmin/settings`

---

## 9. פיננסים (finance)

### 9.1 שיעורי פלטפורמה

- % עמלה + % cashback עם מחשבון דוגמה חי
- `GET /api/sa/settings/rates` — קריאה
- `PUT /api/sa/settings/rates` — עדכון

### 9.2 חובות עסקים

**טבלה לכל עסק:**
- סה"כ מכירות, עמלה חייבת, cashback, ממתין, % גבייה, כפתור גבייה

**חלון גבייה:**
- תיעוד תשלום: סכום / תאריך / אמצעי תשלום / הערות
- היסטוריית גביות

### 9.3 ארנקי קהילות

- לכל קהילה: משפחות, סה"כ cashback שנצבר, יתרה נוכחית

### 9.4 APIs פיננסיים

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/finance-summary` | סיכום פיננסי כולל |
| GET | `/api/sa/settings/rates` | שיעורי עמלה/cashback |
| PUT | `/api/sa/settings/rates` | עדכון שיעורים |
| GET | `/api/sa/business-dues` | חובות עסקים |
| GET | `/api/sa/business-collections/:bizId` | היסטוריית גביות לעסק |
| POST | `/api/sa/business-collections` | רישום גבייה |
| GET | `/api/sa/community-wallets` | ארנקי קהילות |

---

## 10. שותפים (partners)

### 10.1 מנהלי אזורים (Zone Managers)

**טבלה ראשית:**
- שם, אימייל, מספר אזורים, מספר קהילות, % עמלה, סטטוס

**חלון פרטי ZM:**
- אזורים + קהילות תחתיו
- עמלות שהצטברו
- היסטוריית תשלומים

**פעולות:**
- הוספת אזור ל-ZM: `POST /api/sa/zone-managers/:id/zones`
- שיוך קהילה לאזור: `PUT /api/sa/communities/:id/assign-zone`
- העברת קהילה למנהל אחר
- רישום תשלום: `POST /api/sa/zone-manager-payments`

### 10.2 הגדרות אזור

- מינימום משפחות
- מינימום עסקים
- % עמלה ברירת מחדל
- `GET/PUT /api/sa/zone-settings`

### 10.3 KPI פיננסי שותפים

- סה"כ שהרוויח (earned)
- סה"כ שולם (paid)
- חוב (debt)
- ערכי חודש נוכחי

### 10.4 רישומים ממתינים

- רישום ZM חדש: אישור / דחייה
- `GET /api/sa/zone-managers/pending`

---

## 11. צוות ונציגים (hr)

### 11.1 SA Teams

- יצירה / מחיקה של צוותים עם הרשאות RBAC
- הרשאות אפשריות: `support` / `devops` / `marketing` / `stats` / `biz` / `comm` / `users` / `content`
- APIs: `GET/POST /api/sa/teams`, `PUT/DELETE /api/sa/teams/:id`

### 11.2 SA Staff

- רשימת כל עובדי SA: שיוך לצוות, סטטוס (active / blocked)
- הוספה / עריכה / מחיקה: `POST/PUT/DELETE /api/sa/staff`

### 11.3 Internal Chat (Whispers)

- צ'אט בזמן אמת בין עובדי SA
- חדרים: general + חדרי צוות + DMs
- Polling כל 10 שניות
- `GET /api/sa/chat/:room` — קריאת הודעות
- `POST /api/sa/chat` — שליחת הודעה

---

## 12. מסמכים משפטיים (legal)

### 12.1 4 מסמכים מנוהלים

| מפתח | שם המסמך |
|------|-----------|
| `legal_tos_family` | תקנון משפחה |
| `legal_tos_business` | תקנון עסקים |
| `legal_privacy` | מדיניות פרטיות |
| `legal_accessibility` | הצהרת נגישות |

### 12.2 עורך טקסט עשיר

- `contenteditable div` עם toolbar
- כלי עיצוב: bold / italic / underline / h2 / h3 / רשימת נקודות / רשימה ממוספרת
- `GET /api/sa/legal` — טעינת כל המסמכים
- `PUT /api/sa/legal/:key` — שמירת מסמך
- **גישה:** פתוחה לכל משתמש SA (permission: `'open'`)

---

## 13. Impersonation Mode

### 13.1 תהליך ה-Impersonation

```
SA לוחץ "Impersonate" על קבוצה
     ↓
impersonateGroup(groupId, userId)
     ↓
חיפוש קבוצה + משתמש מנהל
     ↓
שמירת SA token: localStorage('ofl_sa_return_token')
     ↓
הסרת 'ofl_sa_token' מ-localStorage
     ↓
יצירת session: { user: targetUser, group: targetGroup, isImpersonating: true }
     ↓
localStorage('ofl_session') ← session חדש
     ↓
פתיחה בטאב חדש: /business.html (עסק) או / (משפחה)
     ↓
אחרי 2 שניות: שחזור SA token → 'ofl_sa_token'
```

### 13.2 הערות חשובות

- פס אדום של הודעת "השתלטות" מוצג בסביבת BIZ/FAMILY (לא ב-SA)
- סביבות BIZ ו-FAMILY בודקות `ofl_session.isImpersonating`
- יציאה: סגירת הטאב או ניווט רגיל — ה-SA session שוחזר אחרי 2 שניות

---

## 14. AI ולוגיקות מיוחדות

### 14.1 4 יכולות AI ב-SA

| יכולת | Endpoint | תיאור |
|-------|----------|--------|
| FamilAI Triage | `POST /api/superadmin/tickets/:id/ai-triage` | סיווג אוטומטי של ticket: עדיפות + סוג |
| AI Dedup | `POST /api/sa/dev/check-duplicates` | בדיקת כפילות משימה חדשה |
| Release Generator | `POST /api/sa/ai-generate` | יצירת release notes בפורמט HTML |
| QA Generator | `POST /api/sa/ai/generate-qa` | יצירת תרחישי בדיקה אוטומטיים |

### 14.2 AI Dedup — פורמט תגובה

```json
{
  "isDuplicate": true/false,
  "explanation": "...",
  "matchedTaskId": 42,
  "confidence": 0.87
}
```

### 14.3 Versions Management

ניהול גרסאות מלא:
- `GET/POST /api/sa/versions`
- `PUT /api/sa/versions/:id`
- `PUT /api/sa/versions/name/:name`
- `DELETE /api/sa/versions/:id`
- `DELETE /api/sa/versions/name/:name`

---

## 15. API Endpoints — רשימה מלאה

### 15.1 אימות

| Method | Endpoint | תיאור |
|--------|----------|--------|
| POST | `/api/superadmin/send-otp` | שליחת SMS OTP |
| POST | `/api/superadmin/verify-otp` | אימות OTP + החזרת token |
| POST | `/api/superadmin/login` | כניסת צוות (email+password) |

### 15.2 Data ראשי

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/superadmin/data` | כל נתוני SA (groups, users, activity, stats, settings) |
| GET | `/api/superadmin/group-360/:id` | 360° view לקבוצה (users, transactions 30d, tasks) |
| GET | `/api/superadmin/pulse` | נתוני pulse בזמן אמת |

### 15.3 קבוצות ומשתמשים

| Method | Endpoint | תיאור |
|--------|----------|--------|
| DELETE | `/api/superadmin/groups/:id` | מחיקת קבוצה |
| PUT | `/api/sa/groups/:id` | עריכת קבוצה |
| PATCH | `/api/sa/groups/:id/modules` | עדכון unlocked_modules |
| PATCH | `/api/sa/groups/:id/upgrade-member` | שדרוג member → family |
| POST | `/api/superadmin/groups/:id/premium` | toggle PRO |
| DELETE | `/api/superadmin/users/:id` | מחיקת משתמש |
| PUT | `/api/sa/users/:id` | עריכת nickname/password |
| PATCH | `/api/superadmin/users/:id` | עריכה מלאה (phone, email, role, status) |

### 15.4 Tickets ו-SLA

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/superadmin/tickets` | כל הטיקטים |
| POST | `/api/superadmin/tickets` | יצירת ticket חדש |
| DELETE | `/api/superadmin/tickets/:id` | מחיקת ticket |
| POST | `/api/superadmin/tickets/:id/reply` | תגובה לטיקט |
| POST | `/api/superadmin/tickets/:id/assign_and_classify` | שיוך + סיווג |
| POST | `/api/superadmin/tickets/:id/ai-triage` | AI triage |
| PUT | `/api/superadmin/tickets/:id/status` | שינוי סטטוס |
| GET | `/api/sa/sla-matrix` | קריאת SLA matrix |
| POST | `/api/sa/sla-matrix` | עדכון SLA matrix |

### 15.5 Dev/Kanban

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/dev/tasks` | כל המשימות |
| POST | `/api/sa/dev/tasks` | משימה חדשה |
| PUT | `/api/sa/dev/tasks/:id` | עריכת משימה |
| PUT | `/api/sa/dev/tasks/:id/status` | שינוי סטטוס |
| DELETE | `/api/sa/dev/tasks/:id` | מחיקת משימה |
| POST | `/api/sa/dev/check-duplicates` | AI בדיקת כפילות |
| GET/POST | `/api/sa/dev/subtasks` | sub-tasks |
| PUT | `/api/sa/dev/subtasks/:id/toggle` | toggle sub-task |
| DELETE | `/api/sa/dev/subtasks/:id` | מחיקת sub-task |

### 15.6 גרסאות

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/versions` | כל הגרסאות |
| POST | `/api/sa/versions` | גרסה חדשה |
| PUT | `/api/sa/versions/:id` | עריכת גרסה |
| PUT | `/api/sa/versions/name/:name` | עריכה לפי שם |
| DELETE | `/api/sa/versions/:id` | מחיקה לפי ID |
| DELETE | `/api/sa/versions/name/:name` | מחיקה לפי שם |

### 15.7 Product Matrix ו-QA

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/matrix` | כל תרחישי הבדיקה |
| POST | `/api/sa/matrix` | תרחיש חדש |
| PUT | `/api/sa/matrix/:id/status` | עדכון סטטוס |
| DELETE | `/api/sa/matrix/:id` | מחיקת תרחיש |
| GET | `/api/sa/qa/tests` | כל הטסטים |
| POST | `/api/sa/qa/tests` | טסט חדש |
| POST | `/api/sa/qa/tests/bulk` | import מרובה |
| DELETE | `/api/sa/qa/tests` | מחיקת כל הטסטים |
| DELETE | `/api/sa/qa/tests/:id` | מחיקת טסט |
| GET | `/api/sa/qa/results` | תוצאות QA |
| POST | `/api/sa/qa/results/bulk` | שמירת תוצאות בכמות |
| DELETE | `/api/sa/qa/results` | ניקוי תוצאות |
| POST | `/api/sa/qa/runs` | הרצת QA run |
| POST | `/api/sa/ai/generate-qa` | AI ייצור תרחישים |
| POST | `/api/sa/tickets/:id/feedback-loop` | סגירת ticket + feedback |

### 15.8 קהילות

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/communities` | כל הקהילות |
| POST | `/api/sa/communities` | קהילה חדשה |
| PUT | `/api/sa/communities/:id` | עריכת קהילה |
| DELETE | `/api/sa/communities/:id` | מחיקת קהילה |
| GET | `/api/sa/communities/:id/details` | פרטי קהילה |
| GET | `/api/sa/communities/pending-businesses` | בקשות ממתינות |
| PUT | `/api/sa/communities/:id/assign-zone` | שיוך לאזור |
| PUT | `/api/sa/communities/:id/set-manager` | הגדרת מנהל |
| POST | `/api/sa/community-business` | חיבור עסק לקהילה |
| GET | `/api/sa/community-business/:commId` | עסקים של קהילה |
| DELETE | `/api/sa/community-business/:commId/:bizId` | ניתוק עסק |
| POST | `/api/sa/community-business/approve` | אישור בקשה |
| POST | `/api/sa/community-business/reject` | דחיית בקשה |

### 15.9 HR / Whispers

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/sa/teams` | כל הצוותים |
| POST | `/api/sa/teams` | צוות חדש |
| PUT | `/api/sa/teams/:id` | עריכת צוות |
| DELETE | `/api/sa/teams/:id` | מחיקת צוות |
| GET | `/api/sa/staff` | כל עובדי SA |
| POST | `/api/sa/staff` | הוספת עובד |
| PUT | `/api/sa/staff/:id` | עריכת עובד |
| DELETE | `/api/sa/staff/:id` | הסרת עובד |
| GET | `/api/sa/chat/:room` | הודעות צ'אט |
| POST | `/api/sa/chat` | שליחת הודעה |

### 15.10 Inbox / Finance / Partners / Content

| Method | Endpoint | תיאור |
|--------|----------|--------|
| POST | `/api/sa/inbox/broadcast` | שידור הודעה |
| GET | `/api/sa/finance-summary` | סיכום פיננסי |
| GET/PUT | `/api/sa/settings/rates` | שיעורי פלטפורמה |
| GET | `/api/sa/business-dues` | חובות עסקים |
| GET | `/api/sa/business-collections/:bizId` | גביות לעסק |
| POST | `/api/sa/business-collections` | רישום גבייה |
| GET | `/api/sa/community-wallets` | ארנקי קהילות |
| GET | `/api/sa/zone-managers` | מנהלי אזורים |
| POST | `/api/sa/zone-managers` | ZM חדש |
| PUT | `/api/sa/zone-managers/:id` | עריכת ZM |
| DELETE | `/api/sa/zone-managers/:id` | מחיקת ZM |
| GET | `/api/sa/zone-managers/pending` | ZM ממתינים |
| GET | `/api/sa/zone-managers/:id/details` | פרטי ZM |
| POST | `/api/sa/zone-managers/:id/zones` | הוספת אזור |
| GET | `/api/sa/zone-managers/finance-summary` | סיכום כספי ZM |
| GET | `/api/sa/all-zones` | כל האזורים |
| GET/PUT | `/api/sa/zone-settings` | הגדרות אזור |
| GET | `/api/sa/zone-manager-payments/:id` | תשלומים ל-ZM |
| POST | `/api/sa/zone-manager-payments` | רישום תשלום |
| GET | `/api/sa/campaigns/stats` | נתוני קמפיינים |
| GET | `/api/sa/leads/stats` | נתוני לידים |
| POST | `/api/superadmin/banners` | עדכון banners |
| POST | `/api/superadmin/settings` | עדכון הגדרות |
| POST | `/api/superadmin/credentials` | עדכון credentials |
| POST | `/api/sa/ai-generate` | AI יצירת תוכן |
| GET | `/api/system/public-config` | הגדרות ציבוריות |
| GET | `/api/sa/legal` | כל המסמכים המשפטיים |
| PUT | `/api/sa/legal/:key` | שמירת מסמך משפטי |
| GET | `/api/sa/businesses` | כל העסקים |

---

---

## 11. SA_GROUPS — מבנה ניווט עדכני

**גרסה: 2026-06-28** — מבנה ה-`SA_GROUPS` כפי שנוגדר בקוד:

```js
const SA_GROUPS = {
  home:       { tabs: ['pulse', 'stats'],             default: 'pulse' },
  customers:  { tabs: ['comm', 'biz', 'clients'],     default: 'comm' },
  finance:    { tabs: ['finance'],                    default: 'finance' },
  supportdev: { tabs: ['support', 'devops'],          default: 'support' },
  contentmkt: { tabs: ['content', 'inbox', 'legal'],  default: 'content' },
  partners:   { tabs: ['partners'],                   default: 'partners' },
  system:     { tabs: ['hr', 'sysmap'],               default: 'hr' },
  templates:  { tabs: ['templates'],                  default: 'templates' },
};
```

**תרגום לטאבים:**

| Group | Tab | תווית |
|-------|-----|-------|
| home | pulse | דופק מערכת |
| home | stats | דוחות |
| customers | comm | קהילות |
| customers | biz | עסקים |
| customers | clients | קבוצות |
| finance | finance | פיננסים |
| supportdev | support | קריאות שירות |
| supportdev | devops | פיתוח ומוצר |
| contentmkt | content | מיתוג ותוכן |
| contentmkt | inbox | שיווק |
| contentmkt | legal | משפטי |
| partners | partners | שותפים |
| system | hr | צוות ונציגים |
| system | sysmap | מפת המערכת |
| templates | templates | תבניות עסקים |

---

## 12. מערכת עזרה (SA Help System)

**גרסה: 2026-06-28**

### 12.1 כפתור "?"

כפתור "?" בסרגל העליון של SA קורא ל-`showSAHelp()` (מ-`community-help.js`).

### 12.2 showSAHelp

```js
function showSAHelp() {
  const tab = window._currentSATab || 'pulse';
  const guide = SA_HELP[tab];
  if (!guide) { showCommunityHelp('sa-' + tab); return; }
  // מציג overlay מעוצב עם sections
}
```

- **`window._currentSATab`** מעודכן ב-`switchSATab(tabId)` לכל מעבר טאב
- אם טאב לא קיים ב-SA_HELP → fallback ל-`showCommunityHelp('sa-' + tab)`

### 12.3 SA_HELP — תוכן קיים

מפתחות בעלי תוכן: `pulse`, `stats`, `dashboard`, `biz`, `clients`, `finance`, `support`, `devops`, `content`, `inbox`, `legal`, `hr`, `sysmap`, `partners`, `templates`

לכל מפתח: `{ title, color, sections: [{ icon, title, text?, steps? }] }`

---

## 13. Plan Selector — תוכנית לפי קבוצה

**גרסה: 2026-06-28**

### 13.1 שלוש תוכניות

| תוכנית | תג | AI tokens/יום |
|--------|-----|-------------|
| `standard` | Standard — 10/יום | 10 |
| `premium` | ⭐ Premium — 50/יום | 50 |
| `enterprise` | ♾️ Enterprise — ללא הגבלה | ∞ |

### 13.2 ממשק

בכרטיס כל קבוצה (משפחה/עסק): `<select>` לשינוי תוכנית + badge צבעוני:
- Standard = אפור
- Premium = ענבר (🟡)
- Enterprise = gradient אינדיגו-סגול (🔵🟣)

### 13.3 שינוי תוכנית

- `saPlanChange(groupId, plan)` → `POST /api/superadmin/groups/:id/plan`
- `saTogglePremium(id, enable)` — toggle בין Standard ↔ Enterprise (legacy)

### 13.4 ONEFLOW Membership

- `g.member_type === 'member'` → תג "חבר ONEFLOW" (סגול)
- יכול להשתנות: `saDemoteOneflow(id)` — "שדרג לסביבה רגילה"

---

## 14. לוח בקרה FLOW (SA FLOW Dashboard)

**גרסה: 2026-06-28**

### 14.1 פתיחת הפאנל

כפתור "⚡ ניהול FLOW" ב-toolbar → `openFlowStatsPanel()` → Panel `sa-flow-stats-panel` (מסך מלא)

### 14.2 4 טאבים

#### 🏆 מובילים (overview)
- **KPI 3 כרטיסים**: סך הונפק Flw / ממומש Flw + % / במחזור Flw
- **גרף בר 30 יום** (ציר X = ימים, גובה = Flw שהונפקו)
- **3 עמודות top-5**: משפחות | עסקים | קהילות (לפי balance)
- מספר ארנקות + סכום כולל לכל קטגוריה

#### 🗺️ מפת Flw (map)
- **פילטר**: הכל / משפחות / עסקים / קהילות
- לכל ישות: אמוג'י סוג, שם, progress bar יחסי, יתרה Flw, כפתור "הענק"
- **`filterFlowMap(type)`** — מסנן `flow-map-row` לפי `data-type`

#### 📋 פעילות (log)
- 30 עסקאות אחרונות מ-`GET /api/sa/flow/transactions?limit=30`
- select filter לפי סוג ישות
- כל שורה: תאריך, שם ישות, תיאור, כמות Flw (±), יתרה אחרי

#### 🎁 הענקה (grant)
- select: סוג ישות (family / business / community)
- חיפוש ישות לפי שם
- שדה כמות (חיובי = הוסף, שלילי = הפחת)
- שדה סיבה (חובה)
- `submitFlowGrant()` → `POST /api/sa/flow/grant`

### 14.3 Data Loading

```js
window.refreshFlowDashboard = async function(tab) {
  const [stats, leaderboard, txs] = await Promise.all([
    fetch('/api/sa/flow/stats'),
    fetch('/api/sa/flow/leaderboard?entityType=all&limit=100'),
    fetch('/api/sa/flow/transactions?limit=30')
  ]);
};
```

### 14.4 הגדרות FLOW (`openFlowConfigPanel`)

- טוען `GET /api/sa/flow/config` → טבלת הגדרות
- ערכים ניתנים לעריכה: נקודות לפי trigger, שיעור המרה Flw→₪
- "שמור הכל" → לכל שורה ששינויה `PUT /api/sa/flow/config`

**מפתחות הגדרה (`FLOW_CONFIG_LABELS`):**

| מפתח | תיאור |
|------|-------|
| `join_community` | הצטרפות לקהילה — משפחה |
| `referral` | הפניית חבר — Flw לממליץ |
| `promo_redemption` | פדיית מבצע |
| `profile_complete` | השלמת פרופיל |
| `review_business` | ביקורת על עסק |
| `bundle_purchase` | רכישת חבילה |
| `daily_login` | כניסה יומית |
| `ambassador_approved` | שגריר אושר |
| `biz_join_approved` | עסק הצטרף לקהילה |
| `biz_promo_approved` | מבצע אושר |
| `biz_promo_redeemed` | מבצע מומש |
| `biz_bundle_sold` | חבילה נמכרה |
| `biz_review_received` | ביקורת התקבלה |
| `biz_lead_received` | ליד התקבל |
| `promo_community` | Flw לקהילה ממבצע |
| `bundle_community` | Flw לקהילה מחבילה |
| `flow_to_ils_rate` | שיעור המרה Flw→₪ |

### 14.5 API Endpoints FLOW

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/sa/flow/stats` | סטטיסטיקות מלאות |
| GET | `/api/sa/flow/leaderboard` | מובילים לפי entity_type |
| GET | `/api/sa/flow/transactions` | פעילות אחרונה |
| POST | `/api/sa/flow/grant` | הענקה/הפחתה ידנית |
| GET | `/api/sa/flow/config` | הגדרות |
| PUT | `/api/sa/flow/config` | שמירת הגדרה |

---

## 15. מפת קהילות SA (`openCommunitiesMap`)

**גרסה: 2026-06-28**

Panel מסך מלא `sa-comm-map-panel`:
- `GET /api/sa/communities/map-data` → `{ communities: [...] }`
- **KPI 3 כרטיסים** (מחושב client-side): סך קהילות / משפחות / עסקים
- **קיבוץ לפי עיר** — לכל עיר: רשימת קהילות
- לכל קהילה:
  - Badge סטטוס: 🟢 פעילה / 🔴 לא פעילה
  - Badge סוג: "עניין" / גיאוגרפי
  - Chips תגיות עניין (`interest_tags`)
  - family_count, biz_count, pending_biz (עסקים ממתינים)

כפתור "מפת קהילות" זמין ב-toolbar של טאב `comm`.

---

## 16. פאנל % התאמה עסקי (SA)

**גרסה: 2026-06-28**

`openBusinessMatchStandalonePanel()` (sa-app.js) — Panel מסך מלא:
- חיפוש עסק בשדה טקסט → dropdown
- בחירת עסק → `GET /api/biz/communities/match/:bizId`
- מציג ציוני % התאמה לכל קהילה זמינה
- צבעים: ירוק (70%+), צהוב (40-69%), אפור (<40%)

---

*עודכן: 2026-06-28 | Oneflow Life BIZ*
