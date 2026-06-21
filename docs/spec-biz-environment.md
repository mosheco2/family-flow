# מפרט טכני מקיף — סביבת BIZ (Oneflow Life BIZ)

> מסמך זה מתאר את מלוא הפונקציונליות של סביבת BIZ במערכת Oneflow Life.  
> נכתב לשימוש כמקור ידע ב-NotebookLM ולצרכי פיתוח.  
> תאריך: 2026-06-20

---

## 1. ארכיטקטורה וכניסה

### 1.1 מיקום וקבצים

| רכיב | פרטים |
|------|--------|
| URL | `/business.html` |
| קובץ HTML | `public/business.html` (~500KB) |
| קובץ JS ראשי | `public/business-app.js` (~2.6MB) |
| Backend | `server1.js` (Node.js / Express) |
| מסד נתונים | PostgreSQL |
| Frontend | Vanilla JS + TailwindCSS (ללא framework) |

סביבת BIZ היא אחת מ-4 סביבות מופרדות במערכת:
- **FAMILY** — `/` (ניהול משפחה)
- **BIZ** — `/business.html` (ניהול עסקי)
- **SUPER-ADMIN** — ניהול כלל המערכת
- **ZONE-MANAGER** — ניהול אזורי

### 1.2 קביעת כתובת API

```js
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';
```

בסביבת פיתוח מקומי משתמשים ב-`localhost:3000`, בפרודקשן (Render) ב-`/api`.

### 1.3 תהליך Login ו-Authentication

**זרימת הכניסה:**

1. **טעינת הדף** — `window.onload` מתחיל. מוצג preloader מונפש.
2. **בדיקת Impersonation** — `checkImpersonationMode()` בודק אם Super Admin נכנס במצב "השתלטות" (Impersonation). אם כן — מציג פס אדום עם אזהרה.
3. **בדיקת Super Admin** — אם `ofl_sa_token` קיים ב-localStorage — עובר ישר לדשבורד SA.
4. **בדיקת Session קיים** — אם `ofl_session` ב-localStorage מכיל `user` ו`group` מסוג `BUSINESS` — טוען ישר `loadDashboard()`.
5. **אם אין session** — מציג מסך Login.
6. **קוד הצטרפות** — אם URL מכיל `?code=XXX` — מציג טופס הצטרפות ממלא את הקוד אוטומטית.

**Endpoints כניסה:**
- `POST /api/login` — כניסה רגילה (שם משתמש + סיסמה)
- `POST /api/join` — הצטרפות עם קוד הזמנה
- `POST /api/groups` — יצירת עסק חדש
- `POST /api/forgot-code` — שחזור קוד ארגון

**Session Storage:**
```js
// localStorage key: 'ofl_session'
{
  user: { id, nickname, role, balance, permissions, employee_role_type, ... },
  group: { id, name, group_code, type: 'BUSINESS', business_type, is_premium, features, ... }
}
```

אם `group.type !== 'BUSINESS'` — המערכת מפנה אוטומטית ל-`/` (סביבת משפחה).

### 1.4 מבנה `currentUser`

| שדה | תיאור |
|-----|--------|
| `id` | מזהה ייחודי |
| `nickname` | שם תצוגה |
| `role` | `ADMIN` / `MANAGER` / `SENIOR` / `MEMBER` |
| `balance` | יתרה אישית |
| `permissions` | JSON עם `tabs: [...]` — רשימת טאבים מורשים |
| `employee_role_type` | תפקיד עובד מיוחד (waiter, delivery, field_tech, וכו') |
| `allowance_amount` | תקרת הוצאה שבועית |
| `interest_rate` | אחוז ריבית |
| `phone` | טלפון |
| `email` | אימייל |
| `birth_year` | שנת לידה |
| `id_number` | תעודת זהות |
| `status` | `active` / `pending` / `inactive` |

### 1.5 מבנה `currentGroup`

| שדה | תיאור |
|-----|--------|
| `id` | מזהה ייחודי |
| `name` | שם העסק |
| `group_code` | קוד ארגון (לשיתוף עם עובדים) |
| `type` | תמיד `BUSINESS` בסביבה זו |
| `business_type` | סוג העסק (restaurant, retail, beauty, logistics, וכו') |
| `is_premium` | האם מנוי PRO פעיל |
| `ai_tokens` | מכסת שימוש ב-AI (10 לחינמי, ∞ לPRO) |
| `features` | JSON של feature flags (store, b2b, academy, וכו') |
| `licensed_features` | JSON של תפקידי עובד מורשים |
| `is_onboarded` | האם עבר אשף הקמה |
| `location_lat` / `location_lng` | מיקום העסק GPS (לנוכחות) |

---

## 2. ניווט — Group Navigation (GNAV)

### 2.1 מבנה GNAV_GROUPS

הניווט הראשי בנוי מ-5 קבוצות + כפתור ראשי:

```js
const GNAV_GROUPS = {
  team:      ['timeclock','shifts','calendar','tasks','academy','members',
              'beauty_calendar','beauty_practitioners'],
  sales:     ['pos','sales','customers','deliveries','reviews',
              'beauty_services','beauty_subscriptions','beauty_clients','beauty_rfq'],
  inventory: ['shop','pantry','equipment','foodcost','beauty_inventory'],
  finance:   ['bank','cashflow','budget','forecast','beauty_commissions'],
  more:      ['community','surveys','settings']
};
```

| קבוצה | שם עברי | כלול בה |
|-------|---------|---------|
| `team` | צוות | נוכחות, משמרות, יומן, משימות, הכשרות, חברי צוות |
| `sales` | מכירות | POS, חנות, לקוחות, שליחויות, דירוגים, (יופי) |
| `inventory` | מלאי | רכש ארגוני, מלאי, ציוד, תמחור, (מלאי יופי) |
| `finance` | כספים | כספים, תזרים, תקציב, תשקיף, (עמלות יופי) |
| `more` | עוד | קהילות, תקשורת, הגדרות |

בנוסף ישנו כפתור **ראשי (🏠)** לחזרה לדשבורד.

### 2.2 ALL_TABS — כל הטאבים

```
feed            ראשי 🏠
timeclock       נוכחות ⏱️
shifts          משמרות 🗓️
calendar        יומן ציבורי 🌐
shop            רכש ארגוני 🛒
pantry          ניהול מלאי 📦
sales           מכירות / חנות 🛍️
pos             קופה (POS) 💰
customers       לקוחות 🤝
deliveries      שליחויות 🛵
reviews         דירוגים וביקורות ⭐
foodcost        תמחור ורווחיות 🍽️
bank            כספים 💳
cashflow        תזרים מזומנים 💸
budget          תקציבים 📊
forecast        תשקיף 📅
tasks           פרויקטים ומשימות ✅
equipment       תחזוקת ציוד 🔧
academy         מרכז הכשרות 🎓
community       קהילות מחוברות 🏘️
surveys         תקשורת ועדכונים 📣
members         ניהול צוות 👥
settings        הגדרות ⚙️

--- טאבים ייחודיים ליופי ---
beauty_calendar       יומן מטפלות 💆
beauty_clients        תיקי לקוחות 📋
beauty_inventory      מלאי מקצועי 🧴
beauty_services       שירותים וטיפולים 💎
beauty_subscriptions  מנויים וחבילות 🎁
beauty_commissions    עמלות ושכר 💰
beauty_rfq            ייעוץ ובקשות 💬
beauty_practitioners  מטפלות 💆

--- טאבים ייחודיים ללוגיסטיקה ---
logistics_orders      קנבן משלוחים 📦
logistics_drivers     נהגים 🚗
logistics_vehicles    צי רכבים 🚚
logistics_pricing     מחירון 💰
logistics_cod         גבייה COD 💵
logistics_rfq         הצעות מחיר 📋
logistics_routes      מסלולי חלוקה 🗺️
logistics_tracking    לינקי מעקב 🔗
logistics_reports     דוחות לוגיסטיקה 📊
logistics_customers   מזמינים ונמענים 🤝
logistics_invoices    חשבוניות 🧾
```

### 2.3 פונקציית switchTab

```js
function switchTab(t) {
  // הפניה אוטומטית: customers → beauty_clients (לסוג יופי)
  if (t === 'customers' && currentGroup?.business_type === 'beauty')
    t = 'beauty_clients';

  // הסתרת כל הטאבים
  // הצגת הטאב הנבחר
  // הפעלת לוגיקה ספציפית לטאב
  if (t === 'feed')          renderDashboard();
  if (t === 'sales')         switchSalesTab('orders');
  if (t === 'pos')           window.renderPOSCatalog('all');
  if (t === 'timeclock')     fetchTimeclockReport(); checkTimeclockStatus();
  if (t === 'shifts')        renderShifts();
  // ... וכן הלאה לכל טאב
}
```

### 2.4 תצוגה לפי תפקיד

- **עובד (MEMBER/SENIOR)** שנמצא בקבוצות `finance` או `inventory` — הקבוצות מוסתרות אלא אם יש לו הרשאה מפורשת
- **כפתור הגדרות** (`gnav-btn-settings`) מוצג רק לADMIN
- טאבים נעולים מוצגים עם אייקון מנעול ואופסיטי 40%

### 2.5 Polling ועדכונים אוטומטיים

```js
// polling interval 30 שניות
pollInterval = setInterval(() => {
  fetchData();          // נתוני עובד (tasks, pantry, shopping, וכו')
  fetchLoans();         // הלוואות/בקשות
  fetchPendingUsers();  // (admin בלבד) בקשות הצטרפות ממתינות
}, 30000);

// bell badge
setInterval(refreshBellBadge, 30000);
```

---

## 3. Dashboard — לוח הבקרה הראשי

### 3.1 דשבורד מנהל (ADMIN)

**KPI Cards — כרטיסי מדדים:**

| מזהה | תוכן |
|------|------|
| `kpi-sales-today` | מכירות יום זה (₪) — הזמנות completed/shipped בלבד |
| `kpi-orders-today` | מספר הזמנות היום |
| `kpi-active-staff` | מספר עובדים שהחתימו כניסה היום |
| `kpi-open-orders` | הזמנות פתוחות (לא completed/cancelled) |
| `kpi-open-tasks` | משימות בסטטוס pending |
| `kpi-revenue-month` | הכנסות החודש (₪) |
| `user-balance` | יתרת תזרים נטו (הכנסות פחות הוצאות) |

**KPIs ייחודיים למסעדה:**

| מזהה | תוכן |
|------|------|
| `kpi-deliveries-transit` | משלוחים בדרך (shipped) |
| `kpi-avg-per-order` | ממוצע הזמנה (₪) |
| `kpi-avg-rating` | ממוצע דירוג לקוחות |
| `kpi-pending-reservations` | הזמנות שולחן ממתינות |
| `kpi-low-stock-count` | פריטי מלאי נמוך (כמות ≤ 2) |
| `kpi-food-cost-pct` | ממוצע Food Cost % |

**אזורים נוספים בדשבורד מנהל:**
- כרטיס מאזן/תזרים עם יתרה נטו
- כרטיסי "פעולות מהירות" (Quick Tiles) — קישורים ישירים לפעולות נפוצות
- התראות: מלאי נמוך, עובדים שלא החתימו, משימות מאוחרות
- היסטוריית פעילות (Feed)

### 3.2 דשבורד עובד (MEMBER/SENIOR)

מוצגים רכיבים אחרים לחלוטין:
- ברכה אישית עם תאריך
- סטטוס החתמה (נכנס/יצא/לא החתים)
- משימות אישיות להיום
- פאנל "מה מחכה לך" — פריטים דחופים

### 3.3 דשבורד ייחודי לפי סוג עסק

| סוג עסק | פונקציית דשבורד |
|---------|----------------|
| `beauty` | `renderBeautyAdminDashboard()` — תצוגת תורים ומטפלות |
| `logistics` | `renderLogisticsAdminDashboard()` — לוח קנבן משלוחים |
| `logistics` (עובד) | `renderLogisticsDriverDashboard()` — ממשק נהג |
| `sport` | `renderSportDashboard()` |
| `maintenance_repair` | `renderBranchManagerMaintenanceDashboard()` |

כל דשבורד מותאם מרענן כל 30 שניות דרך `_roleDashInterval`.

### 3.4 אשף הקמה (Onboarding Wizard)

בכניסה הראשונה של מנהל (`is_onboarded === false`):
1. אם `business_type` לא הוגדר — מציג `showBusinessTypeWizard()` לבחירת סוג עסק
2. לאחר בחירת סוג — מציג `showOnboardingWizard()` — אשף הגדרות ראשוניות

---

## 4. סוגי עסקים (BUSINESS_TYPES)

### 4.1 רשימת סוגי עסקים

| id | שם | אייקון | מודולים עיקריים |
|----|-----|--------|----------------|
| `restaurant` | מסעדה / בית קפה | 🍕 | pos, sales, pantry, shop, customers, shifts, timeclock, tasks, cashflow, budget, members, calendar, deliveries, foodcost, reviews |
| `retail` | חנות קמעונאית | 🛍️ | pos, sales, pantry, shop, customers, cashflow, budget, members, timeclock, tasks, bank |
| `services` | שירותים מקצועיים | 💼 | calendar, tasks, customers, cashflow, budget, members, timeclock, bank, pos, sales |
| `construction` | בנייה / קבלנות | 🏗️ | equipment, tasks, shifts, timeclock, members, cashflow, customers, bank, shop, pantry, budget |
| `maintenance_repair` | תחזוקה ותיקונים | 🔧 | calendar, tasks, customers, members, timeclock, cashflow, pantry, shop |
| `logistics` | לוגיסטיקה / הפצה | 🚚 | logistics_orders, logistics_drivers, logistics_vehicles, logistics_pricing, logistics_cod, logistics_rfq, logistics_routes, logistics_tracking, logistics_reports, logistics_customers, logistics_invoices, members, timeclock, cashflow, tasks |
| `healthcare` | בריאות / קליניקה | 🏥 | calendar, customers, tasks, members, timeclock, cashflow, bank, pos, pantry |
| `beauty` | יופי / קוסמטיקה | 💅 | beauty_calendar, beauty_practitioners, beauty_services, beauty_subscriptions, pos, beauty_clients, beauty_inventory, beauty_commissions, beauty_rfq, timeclock, cashflow, tasks, shop |
| `education` | חינוך / הדרכה | 🎓 | calendar, academy, tasks, members, timeclock, cashflow, customers, pos |
| `sport` | ספורט / כושר | 🏋️ | calendar, pos, sales, customers, members, timeclock, cashflow, tasks, equipment, shifts |
| `events` | אירועים / הפקות | 🎉 | calendar, tasks, customers, members, timeclock, cashflow, budget, equipment, shifts, shop |
| `food_production` | ייצור מזון | 🏭 | pantry, shop, sales, customers, tasks, members, shifts, timeclock, cashflow, equipment, deliveries, foodcost |
| `other` | אחר / כללי | 🏢 | כל הטאבים (modules: null) |

### 4.2 מינוח מותאם לסוג עסק (BUSINESS_CONFIG)

הפונקציה `getBizTerm(key)` מחזירה מינוח מותאם לסוג העסק:

| סוג | customer | product | appointment | order |
|-----|----------|---------|-------------|-------|
| restaurant | אורח | מנה | שולחן | הזמנה |
| retail | לקוח | מוצר | ביקור | הזמנה |
| services | לקוח | שירות | פגישה | פרויקט |
| construction | מזמין | חומר | פגישת אתר | פרויקט |
| healthcare | מטופל | טיפול | תור | הפניה |
| beauty | לקוחה | טיפול/מוצר | תור | הזמנה |

### 4.3 שינוי שמות טאבים לפי סוג עסק

```js
const TAB_RENAME = {
  restaurant:   { customers: 'אורחים 🤝', calendar: 'הזמנות שולחנות 📅' },
  healthcare:   { customers: 'מטופלים 🤝', calendar: 'יומן תורים 📅', members: 'צוות רפואי 👥' },
  beauty:       { customers: 'לקוחות 🤝', calendar: 'יומן תורים 📅' },
  sport:        { customers: 'חברים 🤝', members: 'חברי מועדון 👥', calendar: 'לוח אימונים 📅' },
  construction: { customers: 'לקוחות 🤝', calendar: 'לוח פרויקטים 📅' },
  events:       { customers: 'לקוחות 🤝', calendar: 'יומן אירועים 📅', sales: 'מכירות אירועים 🛍️' },
};
```

---

## 5. משתמשים ותפקידים

### 5.1 תפקידים ראשיים (Role)

| תפקיד | גישה |
|-------|------|
| `ADMIN` | גישה מלאה לכל הטאבים. מקבל כלי ניהול (admin-panel, btn-add-task, bank-admin-view, וכו'). רואה דשבורד מנהל. |
| `MANAGER` | גישה: feed, timeclock, shifts, calendar, shop, pantry, equipment, tasks, academy, sales, pos, customers. רואה כלי ניהול חלקיים. |
| `SENIOR` | גישה: feed, timeclock, shifts, pantry, tasks, academy, pos |
| `MEMBER` | גישה: feed, timeclock, shifts, tasks, academy |

### 5.2 תפקידי עובד מיוחדים (EMPLOYEE_ROLE_TYPES)

כאשר עובד מוגדר עם `employee_role_type` — הוא מקבל ממשק ייחודי ומודולים נוספים:

| תפקיד | מודולים אוטומטיים | סוגי עסק רלוונטיים |
|-------|------------------|-------------------|
| `salesperson` — איש מכירות | pos, sales, customers, tasks, calendar, timeclock, shifts | retail, services, construction |
| `field_tech` — טכנאי שטח | tasks, equipment, calendar, timeclock, shifts | maintenance_repair, construction, logistics |
| `delivery` — שליח/נהג | deliveries, tasks, timeclock, shifts | restaurant, retail, logistics |
| `warehouse` — מחסנאי | pantry, shop, tasks, timeclock, shifts | restaurant, retail, logistics |
| `cleaner` — מנקה/אחזקה | tasks, timeclock, shifts | restaurant, retail, beauty, sport |
| `support` — נציג שירות | customers, tasks, calendar, timeclock | services, healthcare, sport |
| `cashier` — קופאי | pos, sales, tasks, timeclock, shifts | restaurant, retail, beauty |
| `shift_manager` — מנהל משמרת | pos, sales, tasks, members, timeclock, shifts, customers, cashflow, reviews | restaurant, retail |
| `branch_manager` — מנהל סניף | pos, sales, tasks, members, timeclock, shifts, customers, cashflow, budget, pantry, reviews | כל הסוגים |
| `waiter` — מלצר/ית | pos, sales, tasks, calendar, members, shifts, timeclock | restaurant |
| `cook` — טבח/ית | pantry, tasks, shifts, foodcost, timeclock | restaurant, food_production |
| `therapist` — מטפלת | beauty tabs | beauty |
| `senior_therapist` — מטפלת בכירה | beauty tabs | beauty |
| `nail_tech` — טכנאית ציפורניים | beauty tabs | beauty |
| `makeup_artist` — איפורנית | beauty tabs | beauty |
| `reception` — קבלנית | beauty tabs | beauty |

### 5.3 Feature Flags (הרשאות מודולים)

```js
// features מגיע מה-group מהשרת
features = {
  store, b2b, academy, calendar, finance, inventory, crm,
  deliveries, foodcost, ai, timeclock, cashflow, budget,
  forecast, tasks, community, members, shifts
}
```

מנהל יכול לנעול מודולים אפילו ממנהלים אחרים. מפעיל `enforceModule()` שמוסיף מנעול ויזואלי.

### 5.4 ניהול הרשאות

**הגדרת הרשאות עובד:**
- נפתח מ-`members` (ניהול צוות)
- בחירת תפקיד: ADMIN / MANAGER / SENIOR / MEMBER
- בחירה ידנית של טאבים מורשים
- בחירת `employee_role_type` (אם מורשה בlicensed_features)
- `PUT /api/users/:id/permissions` — שמירת הרשאות
- `PATCH /api/users/:id/role-type` — שמירת תפקיד מיוחד

### 5.5 סוגי לקוחות חיצוניים (Customer Types)

#### **משפחה מחוברת ל-ONEFLOW LIFE** (ONEFLOW Customer)

לקוח שמחובר דרך אפליקציית ONEFLOW LIFE — מספר הטלפון שלו תואם לאחד בעסק.

**יכולות:**
- 🛒 הזמנת מנות/מוצרים: בחירה מתפריט דיגיטלי, הוספת הערות, בחירת משלוח/איסוף/הזמנה בשולחן
- 📅 הזמנת שולחן: בחירת תאריך/שעה/מספר סועדים, הערות (אלרגיות, אירוע)
- ✉️ הודעות: שליחה ישירה למסעדה, קבלת תשובות
- 📱 עדכונים בזמן אמת: סטטוס הזמנה live, התראות על אישור
- 📋 היסטוריה: כל ההזמנות הקודמות, מספרי הזמנה, תשלומים
- 🎁 מבצעים: קבלה אוטומטית של מבצעים ש-ONEFLOW או העסק שולח לקהילה

**מבנה:**
```js
// customer מחובר שמופיע ב-CRM עם סטטוס "connected_oneflow": true
{
  phone, name, email, 
  connected_oneflow: true,
  order_history: [...],
  total_orders, total_spent
}
```

---

#### **לקוח ציבורי (Public/Guest Customer)**

אדם שלא רשום, סרק QR או קלק על קישור חנה ציבורית. קנייה חד-פעמית ללא חשבון.

**יכולות:**
- 👁️ צפייה בתפריט מלא של המסעדה
- 🛒 הזמנה חד-פעמית: בחירת מנות, משלוח/איסוף, הוספת כתובת, שם וטלפון
- 🍽️ הזמנת שולחן: בקשה (תחת אישור המסעדה)
- 📞 שליחת שאלה: טופס יצירת קשר חד-כיווני
- ❌ **ללא חשבון**: לא נשמרה היסטוריה
- ❌ **ללא עדכונים**: אין סטטוס לייב, אין התראות
- ❌ **ללא מעקב**: לאחר סיום ההזמנה — אין דרך לדעת איפה היא

**מבנה:**
```js
// לקוח ציבורי — מידע זמני בלבד
{
  name, phone, email // זמני
}
// יוצר הזמנה אחת בלי חשבון בSystem:
{
  order_status: 'pending_approval', // בקשה לאישור
  customer_details: { name, phone },
  created_at: timestamp
  // לא יהיה חיבור קבוע בין הזמנות או לקוח קבוע
}
```

---

#### **תרחישי סיווג לקוח:**

| מצב | סוג לקוח | הערה |
|------|---------|------|
| סרק QR בשולחן | ציבורי | אורח אחד שעבר פנים |
| קלק על קישור חנה | ציבורי | כל אחד מהאינטרנט |
| יש חשבון ONEFLOW תואם | ONEFLOW | משפחה, חבר משפחתי, או ידיד מחובר |
| מופיע בעסק לראשונה | ציבורי (עד שיירשם) | אחרי רישום → יכול להיות ONEFLOW |
| הקדים ביקור או הזמנה קודמת | ONEFLOW אם מחובר, אחרת ציבורי | מעקב אחורי בCRM |

---



## 6. מודולים — תיאור מלא

### 6.1 מכירות / חנות (sales)

#### מבנה הטאב

הטאב `sales` כולל מספר תת-טאבים (`switchSalesTab`):
- **orders** — הזמנות חנות
- **quotes** — הצעות מחיר
- **catalog** — קטלוג מוצרים
- **work-orders** — פקודות עבודה (לסוגי עסק: services, construction, maintenance_repair, events, healthcare)
- **analytics** — אנליטיקס מכירות

#### 6.1.1 הזמנות חנות

**סטטוסי הזמנה — Flow:**

```
new → processing → ready → shipped/delivering → completed
                                               ↓
                                           cancelled
```

| סטטוס | משמעות |
|-------|--------|
| `new` | הזמנה חדשה שהתקבלה — ממתינה לאישור |
| `processing` | בטיפול / בהכנה |
| `ready` | מוכנה — לאיסוף עצמי או לשליח |
| `shipped` / `delivering` | יצאה למשלוח |
| `completed` | סופקה/הושלמה |
| `cancelled` | בוטלה |

**ציר זמן הזמנה (Order Log):**
מוצגות 5 תחנות עם סימון ✓ ירוק כשכל שלב עבר:
1. הזמנה התקבלה במערכת
2. בטיפול במטבח/הכנה
3. מוכנה לאיסוף (עצמי / שליח)
4. יצאה למשלוח / נאספה
5. סופקה ללקוח / הזמנה הושלמה

**UI רכיבים:**
- פילטר סטטוס (all / new / processing / ready / shipped / completed / cancelled / rated)
- פילטר סוג (הזמנה/שליחות)
- חיפוש לפי מספר, שם לקוח, טלפון
- כרטיסי הזמנה מתמוטטים (accordion)
- כפתורי שינוי סטטוס מהיר

**API:**
- `GET /api/store/orders/:groupId` — טעינת כל ההזמנות
- `POST /api/store/orders` — יצירת הזמנה חדשה
- `POST /api/store/orders/status` — עדכון סטטוס הזמנה
- `PATCH /api/store/orders/:id/target-date` — עדכון תאריך יעד
- `GET /api/store/orders/my/:userId` — הזמנות של משתמש ספציפי

**מבנה הזמנה:**
```js
{
  id, created_at, total_amount, total,
  customer_name, customer_phone,
  status, order_type,
  items: [...],  // JSON
  notes,
  customer_rating,  // דירוג לקוח (1-5)
  quote_status
}
```

#### 6.1.2 הצעות מחיר (Quotes)

**סטטוסי הצעת מחיר:**

| סטטוס | תצוגה |
|-------|--------|
| `draft` / `new` | טיוטה |
| `sent` / `waiting_customer` | נשלחה ללקוח |
| `customer_approved` | לקוח אישר — ממתינה לאישור עסק |
| `approved` | אושרה — הפכה להזמנה |
| `frozen` | הוקפאה |
| `cancelled` | בוטלה |

**תגובות לקוח אפשריות:**
- `approved` — אישר
- `rejected` — סירב
- `discount_request` — ביקש הנחה
- `items_request` — ביקש שינויים
- `message` — הודעה כללית

**פעולות על הצעת מחיר:**
- שינוי סטטוס ידני
- "אישור והעברה להזמנות" — `POST /api/store/quotes/:id/approve`
- "המר לפקודת עבודה" — לסוגי עסק services/construction/maintenance/events/healthcare
- ייצוא PDF

**API:**
- `POST /api/store/quotes` — יצירת הצעת מחיר
- `GET /api/store/quotes/:groupId` — טעינת הצעות
- `PUT /api/store/quotes/:id` — עדכון הצעה
- `PATCH /api/store/quotes/:id/status` — עדכון סטטוס
- `POST /api/store/quotes/:id/approve` — אישור והמרה להזמנה

#### 6.1.3 קטלוג מוצרים

**UI:**
- הוספת מוצר: שם, קטגוריה, מחיר, תיאור, תמונה, יחידת מידה
- עריכת מוצר קיים
- הצגה/הסתרה (toggle active)
- Modifiers — תוספות ומשתנים למנה (לפי presets)
- תיאור אוטומטי ב-AI: `POST /api/store/ai-desc`
- ייצוא/ייבוא קטלוג מ-Excel (XLSX)
- יצירת קטלוג שלם ב-AI: `POST /api/ai/generate-catalog`

**API:**
- `GET /api/store/catalog/:groupId` — טעינת הקטלוג
- `POST /api/store/catalog` — הוספת מוצר
- `PUT /api/store/catalog/:id` — עדכון מוצר
- `POST /api/store/catalog/toggle` — הצגה/הסתרה
- `DELETE /api/store/catalog/:id` — מחיקת מוצר

#### 6.1.4 קופונים ומבצעים

- `GET /api/store/coupons/:groupId` — טעינת קופונים
- `POST /api/store/coupons` — יצירת קופון
- `DELETE /api/store/coupons/:id` — מחיקת קופון
- `GET /api/store/promotions/:groupId` — טעינת מבצעים
- `POST /api/store/promotions` — יצירת מבצע
- `PUT /api/store/promotions/toggle/:id` — הפעלה/כיבוי מבצע

### 6.2 קופה (POS)

**תכונות:**
- קטגוריות מוצרים עם טאבים (tabs)
- חיפוש מנה/מוצר
- סל קנייה עם כמויות
- Modifiers (תוספות) לכל מוצר
- זיהוי לקוח לפי טלפון
- הנחה: אחוזית (%) ו/או קבועה (₪)
- מצב מסך מלא (`togglePOSFullscreen`)
- ניתן להפעיל מקלדת ← סריקת ברקוד
- שיטות תשלום: מזומן, אשראי, ספליט

**API:**
- `POST /api/store/orders` — שמירת הזמנה מהקופה (order_type: 'pos')

**מצב מסך מלא:**
- מנגנון `window._isInFullscreenPOS` 
- ביטול עם `Escape`
- הקופה עובדת ישירות בלי עמוד נפרד

### 6.3 לקוחות (customers / CRM)

**תת-טאבים:**
- **רשימה** — פרטים מזהים של כל הלקוחות
- **היסטוריה** — כלל ההזמנות והצעות המחיר

**UI:**
- חיפוש לפי שם / טלפון
- פילטר: כל הלקוחות / לקוחות עם הזמנה / לקוחות עם הצעת מחיר
- כרטיס לקוח עם היסטוריה מלאה

**API:**
- `GET /api/store/customers/:groupId` — טעינת לקוחות
- `POST /api/store/customers` — הוספת לקוח
- `PUT /api/store/customers/:id` — עדכון לקוח
- `DELETE /api/store/customers/:id` — מחיקת לקוח

**מבנה לקוח:**
```js
{
  id, name, phone, email, address,
  notes, created_at,
  // מחושב: מספר הזמנות, סה"כ רכישות
}
```

### 6.4 שליחויות (deliveries)

**תת-טאבים:**
- **active** — שליחויות פעילות
- **history** — היסטוריה

**תכונות:**
- ניהול שליחים (courier)
- שיוך הזמנות לשליח
- מעקב בזמן אמת (polling)
- ניווט מובנה (Waze)
- סטטוסי שליחות: new, assigned, picked_up, in_transit, delivered, failed

**API:**
- polling ייחודי לשליחויות עם `startCourierPolling()` / `stopCourierPolling()`

### 6.5 שעון נוכחות (timeclock)

**תכונות מנהל:**
- דוח נוכחות חודשי לכל העובדים
- פילטר לפי חודש
- ייצוא PDF
- דיווח נוכחות ידני
- הגדרת מיקום GPS לעסק (רדיוס 150 מטר)

**תכונות עובד:**
- כפתור "כניסה" / "יציאה" עם ripple animation
- הצגת שעות מצטברות
- ייצוא דוח חודשי אישי ל-PDF

**API:**
- `POST /api/timeclock/set-location` — שמירת מיקום GPS
- `GET /api/timeclock/status?userId=X` — סטטוס נוכחות עובד
- `POST /api/timeclock/punch` — דיווח כניסה/יציאה
- `GET /api/timeclock/report?groupId=X&userId=all` — דוח נוכחות
- `POST /api/timeclock/manual` — דיווח ידני (admin)

### 6.6 משמרות (shifts)

**תצוגות:**
- **רשימה** — כל המשמרות
- **יומי** — משמרות ליום מסוים
- **שבועי** — תצוגה שבועית

**תכונות:**
- ניווט קדימה/אחורה בתאריכים
- תבניות משמרות (templates)
- שיוך עובדים למשמרות
- סטטוסים: `pending` / `approved`
- Admin יכול לאשר/לדחות

**API:**
- `POST /api/tasks` — יצירת משמרת (שיתוף עם tasks)
- `POST /api/tasks/update` — עדכון

### 6.7 משימות ופרויקטים (tasks)

**סטטוסי משימה:**

| סטטוס | משמעות |
|-------|--------|
| `pending` | פתוח — עובד צריך לבצע |
| `done` | עובד סימן כבוצע — ממתין לאישור מנהל |
| `approved` | אושר ונסגר |
| `cancelled` | בוטל |

**תכונות:**
- יצירת משימה ע"י מנהל ← שיוך לעובד
- עובד יכול ליצור משימה עצמית (self-task)
- אישור הוכחה ויזואלית (צילום תמונה)
- דד-ליין
- AI generate tasks: `POST /api/tasks/ai-generate`
- Vision verify (בדיקת תמונת הוכחה): `POST /api/tasks/vision-verify`

**API:**
- `POST /api/tasks` — יצירת משימה
- `POST /api/tasks/update` — עדכון סטטוס

### 6.8 מרכז הכשרות (academy)

**תכונות מנהל:**
- יצירת "חבילת" לימוד (bundle) עם שאלות/חידונים
- שיוך חבילה לעובד: `POST /api/academy/assign`
- AI generate bundle: `POST /api/academy/ai-generate`
- צפייה בציוני עובדים

**תכונות עובד:**
- "המשימות שלי" — חבילות שהוקצו
- ספריית תוכן
- ענה על חידון → קבל ציון
- "מורה AI" (Tutor): `POST /api/academy/tutor`

**API:**
- `POST /api/academy/assign` — שיוך
- `POST /api/academy/submit` — הגשת תשובות
- `GET /api/academy/bundles/:id` — טעינת חבילה
- `PUT /api/academy/bundles/:id` — עדכון
- `POST /api/academy/bundles` — יצירה

### 6.9 ניהול מלאי (pantry)

**תכונות:**
- רשימת פריטי מלאי עם כמות
- התראת "מלאי נמוך" (כמות ≤ 2 מסומנת ב-dashboard)
- שימוש בפריט (`/api/pantry/use`)
- AI insight על מלאי: `POST /api/pantry/familai-insight`

**API:**
- `POST /api/pantry/add` — הוספת פריט
- `POST /api/pantry/update` — עדכון כמות
- `POST /api/pantry/use` — שימוש בפריט
- `DELETE /api/pantry/delete/:id` — מחיקה

### 6.10 רכש ארגוני / B2B (shop)

**תת-טאבים:**
- **list** — רשימת פריטים לרכש
- **orders** — היסטוריית הזמנות ספקים
- **suppliers** — ניהול ספקים

**תכונות:**
- רשימת רכש עם אוטו-קומפליישן ממוצרי PRODUCT_DB
- הזמנה לספק (B2B order)
- קבלת סחורה: `POST /api/b2b/orders/receive`
- ייצוא רשימת קנייה

**API:**
- `GET /api/suppliers/:groupId` — ספקים
- `POST /api/suppliers` — הוספת ספק
- `GET /api/b2b/catalog/:groupId` — קטלוג B2B
- `POST /api/b2b/orders` — הזמנה לספק
- `GET /api/b2b/orders/:groupId` — היסטוריית הזמנות
- `POST /api/b2b/orders/receive` — קבלת סחורה
- `POST /api/shopping/scan-receipt` — סריקת קבלה ע"י AI

### 6.11 כספים (bank)

**תכונות:**
- הוספת עסקה (הכנסה/הוצאה)
- קטגוריות: מכירות, השקעות, ציוד משרדי, תוכנה, שיווק, שכר, נסיעות, שכירות, מטבחון, שונות
- ניהול הלוואות (loans) — בקשה, אישור, דחייה
- יעדים (goals) — חסכון לצורך ספציפי
- AI insight: `POST /api/budget/familai-insight`

**API:**
- `GET /api/transactions?groupId=X` — כל העסקות
- `POST /api/transaction` — הוספת עסקה
- `PUT /api/transaction/:id` — עדכון
- `DELETE /api/transaction/:id` — מחיקה
- `GET /api/loans?groupId=X` — הלוואות
- `POST /api/loans/request` — בקשת הלוואה
- `POST /api/loans/approve` — אישור
- `POST /api/loans/reject` — דחייה

### 6.12 תזרים מזומנים (cashflow)

**תכונות:**
- תצוגת כל ההכנסות וההוצאות
- גרף תזרים
- חישוב יתרה נטו
- AI insight: `POST /api/forecast/familai-insight`

### 6.13 תקציבים (budget)

**תכונות:**
- הגדרת קטגוריות תקציב עם תקרה חודשית
- מעקב ביצוע מול תקציב
- AI insight: `POST /api/budget/familai-insight`

**API:**
- `GET /api/budget/filter?groupId=X` — נתוני תקציב
- `POST /api/budget/update` — עדכון קטגוריה

### 6.14 תשקיף (forecast)

**תכונות:**
- תחזית הכנסות/הוצאות
- מצב: חודשי / שנתי (`toggleForecastMode`)
- AI insight

### 6.15 תחזוקת ציוד (equipment)

**תת-טאבים:**
- items — פריטי ציוד
- maintenance — תחזוקה מתוזמנת
- faults — תקלות ותיקונים
- technicians — טכנאים

**תכונות:**
- מעקב ציוד עם קטגוריות וסטטוסים
- תאריך אחריות עם התראה בזמן
- תכניות תחזוקה תקופתיות
- דיווח תקלות עם רמת חומרה
- Badge count על הטאב (תחזוקה ב-7 ימים + תקלות פתוחות)

**API:**
- `GET /api/equipment/items/:groupId`
- `GET /api/equipment/maintenance/:groupId`
- `GET /api/equipment/faults/:groupId`
- `POST /api/equipment/notifications/check/:groupId`

### 6.16 תמחור ורווחיות (foodcost)

**תכונות:**
- עץ מוצר — הרכב מנה מחומרי גלם
- חישוב עלות מנה (Food Cost %)
- ממשק הוספת מרכיבים ועלויות
- ייצוא דוח עלויות

**API:**
- `GET /api/food-cost/:groupId` — נתוני תמחור
- `POST /api/food-cost/recipe/:catalogId` — שמירת מתכון

### 6.17 יומן ציבורי (calendar)

**תכונות:**
- יומן תורים/פגישות
- הגדרות זמינות: שעות פתיחה, סגירה, מרווח בין תורים
- שירותים שניתן לתזמן
- אישור/דחיית בקשות
- שולחנות (למסעדה): `call_type: 'table_reservation'`

**API:**
- `GET /api/calendar/:groupId` — טעינת יומן
- `POST /api/calendar/settings` — הגדרות
- `POST /api/calendar/services` — שירותים
- `POST /api/calendar/events` — אירוע חדש
- `PUT /api/calendar/events/:id/status` — עדכון סטטוס
- `DELETE /api/calendar/events/:id` — מחיקה

### 6.18 ניהול צוות (members)

**תכונות:**
- רשימת עובדים עם תפקיד ורמה
- הזמנת עובד חדש (קוד + link)
- עריכת הרשאות (פותח modal הרשאות)
- אישור/דחייה של בקשות הצטרפות ממתינות
- ניהול סיסמה
- מחיקת עובד

**API:**
- `GET /api/group/members?groupId=X` — כל חברי הצוות
- `PUT /api/users/:id/permissions` — הרשאות
- `PATCH /api/users/:id/role-type` — תפקיד מיוחד
- `GET /api/admin/pending-users?groupId=X` — בקשות ממתינות
- `POST /api/admin/approve-user` — אישור
- `DELETE /api/users/:id` — מחיקה
- `POST /api/users/:id/password` — שינוי סיסמה

### 6.19 קהילות (community)

**תכונות:**
- חיבור עסק לקהילה מחוברת
- קניה/מכירה B2B בין עסקים בקהילה
- יוזמות קהילתיות

**API:**
- `GET /api/biz/communities/my/:bizId`
- `GET /api/biz/communities/available/:bizId`
- `POST /api/biz/communities/join`
- `DELETE /api/biz/communities/leave/:communityId/:bizId`

### 6.20 תקשורת ועדכונים (surveys)

**תכונות:**
- שליחת הודעות/עדכונים לצוות
- מסרים ממנהל לעובדים
- Inbox מסרים: `GET /api/inbox/:groupId`
- `PUT /api/inbox/:id/read` — סימון כנקרא

### 6.21 דירוגים וביקורות (reviews)

- טעינת דירוגי לקוחות על הזמנות
- ניתוח ביקורות

### 6.22 הגדרות (settings)

**תכונות:**
- פרטי עסק (שם, לוגו, כתובת, טלפון, אתר)
- הגדרות חנות (`POST /api/store/settings`)
- Presets modifiers: `POST /api/store/settings/presets`
- שינוי סוג עסק (רק Admin + SA)
- מידע על תוכנית PRO
- אביזרי נגישות
- סיור מוצר (onboarding tour)
- PWA installation

**API:**
- `GET /api/store/settings/:groupId`
- `POST /api/store/settings`
- `POST /api/groups/:id/logo` — העלאת לוגו

---

## 7. מודולי יופי (Beauty Modules)

מופעלים אך ורק לסוג עסק `beauty`.

### 7.1 יומן מטפלות (beauty_calendar)

- תצוגה: יומי / שבועי / חודשי
- עמודה לכל מטפלת עם תורים ויזואליים
- תורים מקודדי צבע לפי שירות
- בקשות ממתינות מהחנות הציבורית
- הוספת תור ידני

**API:**
- `GET /api/beauty/:bizId/practitioners`
- `GET /api/beauty/:bizId/appointments?from=&to=`
- `POST /api/beauty/:bizId/appointments`

### 7.2 תיקי לקוחות (beauty_clients)

- כרטיס לקוחה מפורט
- היסטוריית טיפולים
- Patch Test status
- העדפות ואלרגיות

**API:** `GET /api/beauty/:bizId/clients`

### 7.3 מלאי מקצועי (beauty_inventory)

- מוצרים קוסמטיים
- כמויות ורמת מינימום
- התראות חוסר

### 7.4 שירותים וטיפולים (beauty_services)

- קטגוריות שירות עם צבע ייחודי
- BEAUTY_CATEGORIES מוגדרות בקוד
- כל שירות: שם, קטגוריה, מחיר, משך (דקות), מטפלת מוקצית
- דגל `requires_patch_test`

**API:** `GET /api/beauty/:bizId/services`

### 7.5 מנויים וחבילות (beauty_subscriptions)

- חבילות טיפולים (X טיפולים בX מחיר)
- מעקב ניצול
- חידוש מנוי

### 7.6 עמלות ושכר (beauty_commissions)

- חישוב עמלות מטפלת לפי שירות
- דוח שכר חודשי

### 7.7 ייעוץ ובקשות (beauty_rfq)

- בקשות ייעוץ מלקוחות (צ'אט)
- תמונות לצורך ייעוץ מרחוק

### 7.8 מטפלות (beauty_practitioners)

- ניהול רשימת מטפלות
- קישור לתפקיד `employee_role_type`

---

## 8. מודולי לוגיסטיקה (Logistics Modules)

מופעלים אך ורק לסוג עסק `logistics`.

### 8.1 קנבן משלוחים (logistics_orders)

**13 עמודות סטטוס:**

| סטטוס | עברית |
|-------|-------|
| `new` | חדש |
| `pending_quote` | ממתין הצעה |
| `quote_sent` | הצעה נשלחה |
| `confirmed` | אושר |
| `assigned` | שויך |
| `picked_up` | נאסף |
| `in_transit` | בדרך |
| `arrived` | הגיע |
| `delivered` | נמסר |
| `partial` | חלקי |
| `failed_attempt` | לא ענה |
| `returned` | הוחזר |
| `cancelled` | בוטל |

**תצוגה:**
- Kanban board עם עמודות קופסאות גוררות
- פילטר לפי נהג ותאריך
- מצב "פעיל בלבד" / "הכל"
- כרטיס משלוח: מספר הזמנה, שם לקוח, כתובת, COD, ניווט Waze

**API:**
- `GET /api/logistics/orders/:groupId`
- `POST /api/logistics/orders` — משלוח חדש

### 8.2 נהגים (logistics_drivers)

- רשימת נהגים עם נתוני ביצוע
- שיוך משלוחים לנהג

### 8.3 צי רכבים (logistics_vehicles)

- ניהול כלי רכב
- תאריכי ביטוח וטסט

### 8.4 מחירון (logistics_pricing)

- מחירון לפי אזור/משקל/מסלול

### 8.5 גבייה COD (logistics_cod)

- גבייה בשטח (Cash on Delivery)
- מעקב גבייות לפי נהג
- סיכום יומי

### 8.6 הצעות מחיר (logistics_rfq)

- בקשות הצעת מחיר מלקוחות
- צ'אט + תמונות

### 8.7 מסלולי חלוקה (logistics_routes)

- תכנון מסלולים יומיים

### 8.8 לינקי מעקב (logistics_tracking)

- יצירת לינק מעקב ייחודי ללקוח

### 8.9 דוחות לוגיסטיקה (logistics_reports)

- SLA — אחוז הגעה בזמן
- COD — גבייה vs. ממתין
- דוח צי — ק"מ לרכב

---

## 9. API Endpoints — רשימה מלאה

### 9.1 Authentication & Groups

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/login` | כניסה |
| POST | `/api/join` | הצטרפות עם קוד |
| POST | `/api/groups` | יצירת עסק חדש |
| POST | `/api/groups/onboard` | סיום onboarding |
| POST | `/api/forgot-code` | שחזור קוד ארגון |
| POST | `/api/groups/:id/logo` | העלאת לוגו |

### 9.2 Data & Members

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/data/:userId?groupId=X` | נתוני עובד (tasks, pantry, shopping, quiz, goals, shifts) |
| GET | `/api/group/members?groupId=X` | רשימת עובדים |
| PUT | `/api/users/:id/permissions` | עדכון הרשאות |
| PATCH | `/api/users/:id/role-type` | עדכון תפקיד |
| GET | `/api/admin/pending-users?groupId=X` | ממתינים לאישור |
| POST | `/api/admin/approve-user` | אישור עובד |
| DELETE | `/api/users/:id` | מחיקת עובד |
| POST | `/api/users/:id/password` | שינוי סיסמה |
| POST | `/api/admin/update-settings` | עדכון הגדרות ארגון |
| POST | `/api/admin/send-credentials` | שליחת פרטי כניסה במייל |

### 9.3 Store (חנות)

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/store/settings/:groupId` | הגדרות חנות |
| POST | `/api/store/settings` | עדכון הגדרות |
| GET | `/api/store/catalog/:groupId` | קטלוג |
| POST | `/api/store/catalog` | הוספת מוצר |
| PUT | `/api/store/catalog/:id` | עדכון מוצר |
| POST | `/api/store/catalog/toggle` | הצגה/הסתרה |
| DELETE | `/api/store/catalog/:id` | מחיקה |
| GET | `/api/store/orders/:groupId` | כל ההזמנות |
| POST | `/api/store/orders` | יצירת הזמנה |
| POST | `/api/store/orders/status` | עדכון סטטוס |
| PATCH | `/api/store/orders/:id/target-date` | תאריך יעד |
| GET | `/api/store/quotes/:groupId` | הצעות מחיר |
| POST | `/api/store/quotes` | הצעת מחיר חדשה |
| PUT | `/api/store/quotes/:id` | עדכון הצעה |
| PATCH | `/api/store/quotes/:id/status` | עדכון סטטוס |
| POST | `/api/store/quotes/:id/approve` | אישור → הזמנה |
| GET | `/api/store/customers/:groupId` | לקוחות |
| POST | `/api/store/customers` | לקוח חדש |
| PUT | `/api/store/customers/:id` | עדכון |
| DELETE | `/api/store/customers/:id` | מחיקה |
| GET | `/api/storefront/:code` | חנות ציבורית (לקוח) |
| GET | `/api/store/coupons/:groupId` | קופונים |
| POST | `/api/store/coupons` | קופון חדש |
| GET | `/api/store/promotions/:groupId` | מבצעים |
| POST | `/api/store/promotions` | מבצע חדש |
| PUT | `/api/store/promotions/toggle/:id` | הפעלה/כיבוי |

### 9.4 Timeclock

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/timeclock/set-location` | מיקום GPS |
| GET | `/api/timeclock/status?userId=X` | סטטוס נוכחות |
| POST | `/api/timeclock/punch` | החתמה |
| GET | `/api/timeclock/report?groupId=X&userId=all` | דוח |
| POST | `/api/timeclock/manual` | דיווח ידני |

### 9.5 Tasks & Academy

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/tasks` | יצירת משימה/משמרת |
| POST | `/api/tasks/update` | עדכון |
| POST | `/api/tasks/ai-generate` | יצירת משימות ע"י AI |
| POST | `/api/tasks/vision-verify` | בדיקת תמונת הוכחה |
| POST | `/api/academy/assign` | שיוך חבילה |
| POST | `/api/academy/submit` | הגשת תשובות |
| GET | `/api/academy/bundles/:id` | טעינת חבילה |
| PUT | `/api/academy/bundles/:id` | עדכון |
| POST | `/api/academy/ai-generate` | יצירת חבילה ע"י AI |
| POST | `/api/academy/tutor` | מורה AI |

### 9.6 Finance

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/transactions?groupId=X` | עסקות |
| POST | `/api/transaction` | עסקה חדשה |
| PUT | `/api/transaction/:id` | עדכון |
| DELETE | `/api/transaction/:id` | מחיקה |
| GET | `/api/loans?groupId=X` | הלוואות |
| POST | `/api/loans/request` | בקשת הלוואה |
| POST | `/api/loans/approve` | אישור |
| POST | `/api/loans/reject` | דחייה |
| GET | `/api/budget/filter?groupId=X` | תקציב |
| POST | `/api/budget/update` | עדכון |

### 9.7 Pantry & Procurement

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/pantry/add` | הוספת פריט |
| POST | `/api/pantry/update` | עדכון |
| POST | `/api/pantry/use` | שימוש |
| DELETE | `/api/pantry/delete/:id` | מחיקה |
| GET | `/api/suppliers/:groupId` | ספקים |
| POST | `/api/suppliers` | ספק חדש |
| DELETE | `/api/suppliers/:id` | מחיקה |
| GET | `/api/b2b/catalog/:groupId` | קטלוג B2B |
| POST | `/api/b2b/orders` | הזמנה לספק |
| GET | `/api/b2b/orders/:groupId` | היסטוריה |
| POST | `/api/b2b/orders/receive` | קבלת סחורה |

### 9.8 Calendar & Community

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/calendar/:groupId` | יומן |
| POST | `/api/calendar/settings` | הגדרות |
| POST | `/api/calendar/services` | שירות |
| POST | `/api/calendar/events` | אירוע |
| PUT | `/api/calendar/events/:id/status` | סטטוס |
| GET | `/api/biz/communities/my/:bizId` | קהילות מחוברות |
| GET | `/api/biz/communities/available/:bizId` | זמינות |
| POST | `/api/biz/communities/join` | הצטרפות |

### 9.9 AI

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/biz/chat-assistant` | עוזר AI עסקי (FamlAI) |
| POST | `/api/store/ai-desc` | תיאור מוצר |
| POST | `/api/ai/generate-catalog` | קטלוג שלם |
| POST | `/api/tasks/ai-generate` | משימות |
| POST | `/api/academy/ai-generate` | חבילת לימוד |
| POST | `/api/budget/familai-insight` | תקציב |
| POST | `/api/pantry/familai-insight` | מלאי |
| POST | `/api/forecast/familai-insight` | תשקיף |
| POST | `/api/tasks/vision-verify` | בדיקת תמונה |
| POST | `/api/shopping/scan-receipt` | סריקת קבלה |
| POST | `/api/guide/chat` | מדריך AI |
| POST | `/api/recipes/generate` | מתכונים |

### 9.10 Equipment & Food Cost

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/equipment/items/:groupId` | ציוד |
| GET | `/api/equipment/maintenance/:groupId` | תחזוקה |
| GET | `/api/equipment/faults/:groupId` | תקלות |
| POST | `/api/equipment/notifications/check/:groupId` | בדיקת התראות |
| GET | `/api/food-cost/:groupId` | תמחור |
| POST | `/api/food-cost/recipe/:catalogId` | מתכון עלות |

### 9.11 Inbox & Tickets

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/inbox/:groupId` | הודעות |
| PUT | `/api/inbox/:id/read` | סימון נקרא |
| DELETE | `/api/inbox/:id` | מחיקה |
| POST | `/api/inbox/customer` | הודעת לקוח |
| POST | `/api/tickets` | פתיחת כרטיסית |
| GET | `/api/tickets/:groupId` | כרטיסיות |

---

## 10. לוגיקות מיוחדות

### 10.1 fetchData — נתונים מרכזיים

`GET /api/data/:userId?groupId=X` מחזיר:
- `user` — נתוני עובד מעודכנים (balance, role, permissions, employee_role_type)
- `group` — נתוני ארגון (ai_tokens, is_premium, features, business_type, licensed_features)
- `tasks` — כל המשימות
- `quiz_bundles` — חבילות הכשרה מוקצות
- `pantry` — מלאי
- `all_bundles` — ספריית הכשרות
- `goals` — יעדים
- `shopping_list` — רשימת רכש
- `weekly_stats` — סטטיסטיקת שבועית (spent, limit)

### 10.2 Polling Intervals

| מקום | תדירות |
|------|--------|
| `pollInterval` (fetchData) | כל 30 שניות |
| Bell badge (`refreshBellBadge`) | כל 30 שניות |
| דשבורד ייחודי (beauty/logistics/sport) | כל 30 שניות |
| דשבורד נהגים (logistics) | כל 60 שניות |
| Courier polling (deliveries) | ייחודי לטאב |

### 10.3 AI Battery System

- חינמי: 10 tokens לחיים
- PRO: ∞ tokens
- UI: `ai-battery-indicator` — מוצג בראש הדף
- כשנגמר: modal `ai-battery-modal`
- אזהרה לפני שימוש (ניתן לכבות): `ofl_hide_ai_warning` ב-localStorage

### 10.4 Impersonation Mode

Super Admin יכול להשתלט (impersonate) על חשבון עסק:
- `ofl_session` מסומן עם `isImpersonating: true`
- פס אדום בראש המסך עם שם הלקוח
- כפתור "התנתקות" מסגיר את הטאב

### 10.5 PWA Support

- `manifest-business.json` — manifest ייחודי לBIZ
- Service Worker: `/sw.js` נרשם בטעינה
- `beforeinstallprompt` נתפס לכפתור התקנה
- תמיכה ב-iOS וב-Android (הנחיות נפרדות)

### 10.6 Accessibility

```js
accState = {
  'text-lg': false,      // טקסט גדול (110%)
  'grayscale': false,    // גווני אפור
  'contrast': false,     // ניגודיות גבוהה
  'readable-font': false, // פונט קריא (Arial)
  'highlight-links': false // הדגשת קישורים
}
```

### 10.7 תצוגת Desktop/Mobile

כפתור `btn-toggle-desktop` מחליף בין:
- `max-w-lg` — תצוגה ממוקדת (מובייל)
- `max-w-7xl w-full` — תצוגה מרחבת (מחשב)

### 10.8 Banners

Super Admin יכול להגדיר:
- באנר עליון + תחתון לסביבת BIZ (נפרד מ-FAMILY)
- תמכה בטקסט, קישור ותמונה (URL / Base64)
- `GET /api/banners?type=BUSINESS`
- נשמר ב-`ofl_banners` ב-localStorage לניהול קאש

### 10.9 Tour System

- סיור מוצר (intro.js) בכניסה הראשונה
- שקופיות מותאמות לפי `business_type` ו-`role`
- נשמר ב-`ofl_tour_day_X_CODE` ב-localStorage (מוצג פעם אחת ביום)
- מסלולי מדריך: `sport-guide.html`, `beauty-guide.html`, `restaurant-guide.html`, `retail-guide.html`, `services-guide.html`, `maintenance-guide.html`, `logistics-guide.html`, `biz-guide.html`

---

## 11. כרטיסיות תמיכה (Tickets)

- `POST /api/tickets` — פתיחת כרטיסית תמיכה
- `GET /api/tickets/:groupId` — כרטיסיות של ארגון
- כרטיסיות עוברות לSuper Admin לטיפול
- `POST /api/support/ticket` — שליחה (ציבורי)

---

## 12. הגדרות מערכת

### 12.1 Welcome Message

- Super Admin מגדיר הודעת פתיחה לסביבת BIZ
- מוצגת פעם אחת למשתמש: `ofl_welcome_X_CODE` ב-localStorage
- `GET /api/settings/welcome?type=BUSINESS`

### 12.2 Feature Flags שניתן לנהל ב-SA

```
store, b2b, academy, calendar, finance, inventory, crm,
deliveries, foodcost, ai, timeclock, cashflow, budget,
forecast, tasks, community, members, shifts
```

### 12.3 תפקידי עובד מורשים (Licensed Features)

תפקידים כגון `role_waiter`, `role_delivery`, `role_therapist` וכו' מוגדרים ב-`group.licensed_features` ומאפשרים הקצאת `employee_role_type` לעובדים.

---

*מסמך זה נוצר אוטומטית בהתבסס על קריאת קוד המקור. גרסה: 2026-06-20.*
