# אפיון Onboarding — אשף הרשמת עסק
מסמך אפיון · OneFlow Life · עודכן 24.08.2026

---

## סקירה כללית

`biz-onboarding.html` — ויזארד הרשמה/כניסה לעסק. מטפל ב-2 מסלולים: **הרשמה חדשה** (OTP + wizard 4 שלבים) ו-**כניסה קיימת**. בסיום נשמר `ofl_session` ב-localStorage ומנווט ל-`business.html`.

---

## ארכיטקטורה

- **API:** `/api/biz/*`
- **Session Storage:** `localStorage.ofl_session` = `{user, group, token}`
- **Geocoding:** Nominatim (OpenStreetMap) לחיפוש עיר/רחוב
- **עיצוב:** Heebo, סגול `#5B46E5`, כחול כהה `#1B2440`

---

## State Object

```javascript
_state = {
  tab,                    // 'new' / 'login'
  phone,                  // טלפון המשתמש
  businessName,           // שם העסק
  password,               // סיסמה
  verifiedToken,          // token לאחר OTP
  selectedBizType,        // סוג העסק שנבחר
  selectedManageKeys: [], // מה לנהל (מערך keys)
  staffRoles: [],         // [{role, count}]
  storeEnabled: null,     // האם לפתוח חנות
  storeOnly: false,       // מסלול חנות בלבד
  accountDetails: {}      // פרטי החשבון הסופיים
}
```

---

## מפת מסכים (Sections)

| Section ID | תוכן |
|---|---|
| `sec-tabs` | כניסה / הרשמה (tabs) |
| `sec-otp` | אימות OTP |
| `sec-welcome` | מסך ברוכים הבאים |
| `sec-biz-type` | בחירת סוג עסק |
| `sec-setup-path` | מסלול הקמה |
| `sec-store-only-path` | חנות בלבד |
| `sec-manage` | מה לנהל |
| `sec-staff` | ניהול צוות |
| `sec-store` | חנות מקוונת |
| `sec-account-details` | פרטי חשבון |
| `sec-summary` | סיכום |
| `sec-finishing` | שמירה + spinner |

ניווט: `showSection(id)` מסתיר את כולם ומציג רק את הנבחר.

---

## טאב "חדש כאן" (הרשמה)

| שדה | תיאור | validation |
|---|---|---|
| `#reg-biz-name` | שם העסק | חובה |
| `#reg-phone` | טלפון ישראלי | maxlength=10, numeric |
| `#reg-pass` | סיסמה | מינימום 6 תווים |
| `#reg-pass2` | אימות סיסמה | חייב להתאים |

**פעולה:** `regSendOtp()` → `POST /api/biz/send-otp`

---

## טאב "כבר רשום" (כניסה)

| שדה | תיאור |
|---|---|
| `#login-phone` | טלפון |
| `#login-pass` | סיסמה |

**פעולה:** `doLogin()` → `POST /api/biz/login`
- `wizard_completed=true` → redirect ל-`business.html`
- `wizard_completed=false` → `sec-welcome`

---

## OTP (`sec-otp`)

- 6 תיבות נפרדות: `#otp-0` עד `#otp-5`
- auto-focus לתיבה הבאה בהקלדה
- תמיכה ב-paste (מחלק אוטומטית)
- backspace חכם (חוזר לתיבה הקודמת)
- `verifyOtp()` → `POST /api/biz/verify-otp` + `POST /api/biz/register`
- `resendOtp()` — cooldown 30 שניות

---

## Wizard שלב 1 — סוג עסק (`sec-biz-type`)

כרטיסיות `choice-card` עם `data-biz`:

| סוג | תיאור |
|---|---|
| `restaurant` | מסעדנות ומזון |
| `beauty` | יופי ואסתטיקה |
| `professional` | ייעוץ ושירותי מומחים |
| `sport` | ספורט ואימונים |
| `logistics` | שילוח ולוגיסטיקה |
| `maintenance_repair` | תיקונים ושירותים |

**פונקציות:** `selectBizType(type)`, `goToSetupPath()`

---

## Wizard 1b — מסלול הקמה (`sec-setup-path`)

| אפשרות | פונקציה |
|---|---|
| הקמה מלאה | `goToManage()` |
| חנות בלבד | `goToStoreOnly()` |

---

## Wizard 1c — חנות בלבד (`sec-store-only-path`)

| אפשרות | פונקציה | תוצאה |
|---|---|---|
| בנה חנות עכשיו | `submitStoreOnlyNow()` | storeEnabled=true, modules=['sell'] |
| דלג | `submitStoreOnlyLater()` | storeEnabled=false |

---

## Wizard שלב 2 — מה לנהל (`sec-manage`)

| key | modules | תיאור |
|---|---|---|
| `sell` | pos, sales, shop | למכור מוצרים ושירותים |
| `quotes` | sales, cases, leads, calendar | הצעות מחיר ופרויקטים |
| `team` | members, shifts, timeclock, tasks | ניהול צוות ולוגיסטיקה |
| `analytics` | cashflow, budget, reports | מעקב וניתוח בלבד |

**פונקציות:** `toggleManage(key)` (multi-select), `goToStaff()`

---

## Wizard שלב 3 — צוות (`sec-staff`)

תפקידים לפי סוג עסק (`BIZ_STAFF_ROLES`):

| סוג עסק | תפקידים |
|---|---|
| restaurant | מנהל/ת, מלצר/ית, טבח/ית, קופאי/ת, שליח/ה |
| beauty | מטפל/ת, ספר/ית, נציג/ת שירות, קבלן/ית |
| professional | יועץ/ת, מנהל/ת פרויקט, נציג/ת שירות, אנליסט/ית |
| sport | מאמן/ת, מנהל/ת, נציג/ת שירות |
| logistics | נהג/ת, מנהל/ת לוגיסטיקה, מחסנאי/ת, נציג/ת שירות |
| maintenance_repair | טכנאי/ת, מנהל/ת, נציג/ת שירות |

**פונקציות:** `toggleStaffRole(role)`, `changeCount(role, delta)` (כמות min=1)

---

## Wizard שלב 4 — חנות מקוונת (`sec-store`)

- כן → `setStore(true)` → `sec-account-details`
- לא → `setStore(false)` → `sec-account-details`

---

## פרטי חשבון (`sec-account-details`)

### שדות חובה

| שדה | תיאור |
|---|---|
| `#acc-email` | מייל העסק |
| `#acc-first` / `#acc-last` | שם פרטי / משפחה |
| `#acc-city` | עיר (עם Nominatim autocomplete) |
| `#acc-birth` | שנת לידה (1940–2010) |
| `#acc-terms` | תנאי שימוש (חובה, checkbox) |

### שדות אופציונליים

| שדה | תיאור |
|---|---|
| ימי פעילות | 7 כפתורים א-ש (`.day-btn-wiz`, data-day 0-6) |
| `#acc-open` / `#acc-close` | שעות פעילות (time input) |
| `#acc-street` + `#acc-street-num` | כתובת עם autocomplete |

**פונקציות:** `toggleDay(btn)`, `clearOptional()`, `toggleTermsStyle()`, `submitAccountDetails()`

---

## Nominatim Autocomplete

- debounce: 320ms לעיר, 350ms לרחוב
- API: `https://nominatim.openstreetmap.org/search`
- params: `format=json, limit=6, addressdetails=1, countrycodes=il, accept-language=he`
- שמירת `lat`/`lng` ב-dataset של ה-input

---

## השלמת Wizard (`completeWizard()`)

`PATCH /api/biz/wizard/complete` עם Bearer token:

```json
{
  "business_type": "beauty",
  "managed_modules": ["sell", "team"],
  "staff_roles": [{"role": "מטפל/ת", "count": 3}],
  "admin_email": "owner@example.com",
  "first_name": "ישראל",
  "last_name": "ישראלי",
  "city": "תל אביב",
  "birth_year": 1985,
  "terms_accepted": true,
  "opening_hours": {"days": [0,1,2,3,4], "open": "09:00", "close": "18:00"},
  "street_address": "דיזנגוף 100",
  "lat": 32.08,
  "lng": 34.78
}
```

- הצלחה: עדכון localStorage + redirect ל-`business.html`
- שגיאה: כפתור "נסה שוב" ב-`sec-finishing`

---

## Session Management

```javascript
localStorage.setItem('ofl_session', JSON.stringify({
  user: { id, nickname, role: 'ADMIN', first_name, last_name },
  group: { id, type: 'BUSINESS', wizard_completed },
  token
}));
```

בטעינה: אם `wizard_completed=true` → redirect אוטומטי ל-`business.html`.

---

## API Calls

| Method | Endpoint | תפקיד |
|---|---|---|
| POST | `/api/biz/send-otp` | שליחת OTP |
| POST | `/api/biz/verify-otp` | אימות OTP |
| POST | `/api/biz/register` | רישום עסק |
| POST | `/api/biz/login` | כניסה קיימת |
| PATCH | `/api/biz/wizard/complete` | השלמת wizard |
