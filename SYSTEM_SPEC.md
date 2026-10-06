# Oneflow Life — מפרט מערכת טכני מלא
**מסמך לשימוש פנימי · רמת מנתח מערכות**
גרסה: אוקטובר 2026

---

## תוכן עניינים

1. [ארכיטקטורה כללית](#1-ארכיטקטורה-כללית)
2. [שכבת הנתונים — מסד הנתונים](#2-שכבת-הנתונים--מסד-הנתונים)
3. [שכבת ה-API — Backend](#3-שכבת-ה-api--backend)
4. [סביבה 1: FAMILY](#4-סביבה-1-family)
5. [סביבה 2: BIZ](#5-סביבה-2-biz)
6. [סביבה 3: SUPER-ADMIN (SA)](#6-סביבה-3-super-admin-sa)
7. [סביבה 4: ZONE-MANAGER (ZM)](#7-סביבה-4-zone-manager-zm)
8. [מערכות רוחביות](#8-מערכות-רוחביות)
9. [זרימות קריטיות (Flows)](#9-זרימות-קריטיות-flows)
10. [אינטגרציות חיצוניות](#10-אינטגרציות-חיצוניות)

---

## 1. ארכיטקטורה כללית

### טופולוגיה

```
Browser (Vanilla JS + TailwindCSS)
         │
    HTTP / HTTPS
         │
  Express.js Server (Node.js)  ←→  PostgreSQL (pg-pool)
         │
   External APIs:
     Gemini AI · Twilio SMS · Nodemailer · Cloudinary
```

### קבצים עיקריים

| קובץ | תפקיד | גודל |
|---|---|---|
| `server.js` | כל ה-API + DB migrations + auth middleware | ~46,000 שורות |
| `public/app.js` | סביבת FAMILY (frontend) | ~18,750 שורות |
| `public/business-app.js` | סביבת BIZ (frontend) | ~62,500 שורות |
| `public/sa-app.js` | סביבת SUPER-ADMIN (frontend) | ~16,400 שורות |
| `public/index.html` | מעטפת HTML לסביבת FAMILY | — |
| `public/business.html` | מעטפת HTML לסביבת BIZ | — |
| `public/sw.js` | Service Worker — PWA offline caching | — |

### כתובות URL לפי סביבה

| סביבה | URL | גישה |
|---|---|---|
| FAMILY | `/` (index.html) | משפחות רשומות + אנונימי לחנות |
| BIZ | `/business.html` | עסקים רשומים |
| SUPER-ADMIN | `/sa.html` (או סביבה ייעודית) | צוות Oneflow בלבד |
| ZONE-MANAGER | `/zm.html` | מנהלי אזור מאושרים |
| חנות עסק | `/:alias` או `/store/:code` | ציבורי |
| כול-העם | `/kol-haam` | ציבורי |

### הפעלת אפליקציה (PWA)

הסביבות FAMILY ו-BIZ תומכות ב-PWA מלא:
- `beforeinstallprompt` — התקנה על מכשיר iOS / Android
- Service Worker עם cache strategy לטעינה offline
- הוראות התקנה נפרדות לiOS (Share+Add to Home) ולאנדרואיד (כפתור ישיר)

---

## 2. שכבת הנתונים — מסד הנתונים

### מנגנון migrations

אין כלי migrations חיצוני (Flyway/Liquibase). כל ה-migrations מופעלות ב-`initDB()` שנקראת ב-startup, באמצעות:
```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
```
כך שהשרת תמיד "מבצע upgrade" על עצמו בהפעלה.

### טבלאות ליבה

#### ישויות ראשיות

| טבלה | תיאור |
|---|---|
| `family_groups` | ישות-על: כל קבוצה (FAMILY / BUSINESS / SOLO). כולל `type`, `plan`, `account_status`, `is_deleted`, `business_type` |
| `users` | כל המשתמשים בכל הסביבות. שייכים ל-`family_groups` דרך `group_id`. `role`: ADMIN / MEMBER / CHILD |
| `communities` | קהילה גאוגרפית. קודד ב-`code`. מנוהלת ע"י מנהל אזור או SA |
| `family_communities` | יחס M:M — קבוצה שייכת לקהילות |
| `zone_managers` | מנהלי אזור עם `status` (pending/active) |
| `sa_users` / `sa_teams` | משתמשי Super-Admin עם הרשאות RBAC |

#### פיננסים

| טבלה | תיאור |
|---|---|
| `transactions` | כל פעולה פיננסית. `type`: income/expense. `category`, `is_recurring`, `is_manual` |
| `budget_allocations` | תקציב לקטגוריה+משתמש. מאגר UNIQUE(group_id, category, target_user_id) |
| `loans` | הלוואות בין חברי קבוצה. `status`: pending/active/paid |
| `flow_wallets` | ארנק FLW. `entity_type`: family / business / community. UPSERT על כל העברה |
| `flw_kid_wallets` | ארנק FLW ייעודי לילדים (פר-user, לא פר-group). UPSERT, עם `balance_flw` ו-`total_earned` |

#### מבנה flow_wallets

```
entity_type VARCHAR(20)  -- 'family' | 'business' | 'community'
entity_id   INT          -- group_id או community_id
balance     DECIMAL(12,4)
updated_at  TIMESTAMP
UNIQUE(entity_type, entity_id)
```

**הבחנה חשובה:** `flow_wallets` הוא קבוצתי (ה-ADMIN רואה). `flw_kid_wallets` הוא אישי לכל ילד. שני מנגנונים נפרדים.

#### חנות (Store)

| טבלה | תיאור |
|---|---|
| `store_settings` | הגדרות חנות פר-עסק. `store_alias` UNIQUE. `is_active`, `modifier_presets` (JSONB), `kiosk_password` |
| `store_catalog` | פריטי קטלוג. `options_text` (JSONB) — מודיפיירים פר-מוצר |
| `store_orders` | הזמנות. `status`: new/confirmed/ready/delivered/cancelled |
| `store_order_items` | שורות הזמנה. FK ל-`store_catalog` (ON DELETE SET NULL — שומר היסטוריה) |
| `delivery_zones` | אזורי משלוח לפי שם + מינימום הזמנה + עלות |
| `biz_radius_delivery_zones` | אזורי משלוח לפי רדיוס גאוגרפי בקמ |

#### יומן ותורים

| טבלה | תיאור |
|---|---|
| `calendar_settings` | הגדרות יומן: שעות פעילות, אינטרוול, שעות ביטול |
| `calendar_services` | שירותים שהעסק מציע (שם, משך, מחיר) |
| `calendar_events` | תורים/אירועים. `status`: pending/confirmed/cancelled/done |

#### משימות ואקדמיה

| טבלה | תיאור |
|---|---|
| `tasks` | משימות. `assigned_to`, `reward`, `status`: pending/done/rejected/verified |
| `task_comments` | הערות על משימה |
| `task_set_templates` | תבניות סטים של משימות (JSONB) |
| `quiz_bundles` | מאגר שאלונים. `type`: english / math / general. `threshold` אחוז מעבר |
| `quiz_questions` | שאלות. `options` JSONB, `correct` INT (אינדקס) |
| `user_assignments` | הקצאת שאלון למשתמש. `status`: assigned/passed/failed |
| `game_sessions` | רישום סשן משחק/חידון. `game_id` nullable. מזין `flw_kid_wallets` |

#### נוכחות ועובדים

| טבלה | תיאור |
|---|---|
| `time_clock` | שעוני נוכחות. `punch_in`, `punch_out`, `total_minutes` |
| `time_log_entries` | רישום שעות ידני/פרויקטלי |
| `shifts` | משמרות מתוכננות |
| `payroll_runs` | ריצות שכר |

#### רשימת קניות ומחסן

| טבלה | תיאור |
|---|---|
| `shopping_list` | פריטי קנייה. `normalized_name` לקיבוץ חכם |
| `shopping_trips` | טיולי קניות שהושלמו |
| `pantry` | מלאי בית/עסק |
| `product_category_map` | מיפוי שם מוצר → קטגוריה (למידת מכונה בסיסית) |

#### קהילה ו-FlowPool

| טבלה | תיאור |
|---|---|
| `community_posts` | פוסטים בפיד קהילה. `post_type`, `media_url` |
| `flow_pools` | קרן FLW משותפת לקהילה |
| `flow_pool_members` | חברות בקרן |
| `flow_pool_bids` | הצעות שימוש בקרן |

#### כול-העם (פרסום תוכן)

| טבלה | תיאור |
|---|---|
| `kh_articles` / `kh_content` | תוכן כתוב. `status`: draft/submitted/approved/rejected |
| `kh_categories` | קטגוריות עם `is_public` |

#### תשתית SA

| טבלה | תיאור |
|---|---|
| `support_tickets` | קריאות תמיכה |
| `ticket_replies` | תשובות לקריאה |
| `sla_configs` | הגדרות SLA לפי מודול+סטטוס |
| `alert_rules` / `alert_notifications` | כללי התראה אוטומטיים |
| `audit_log` | לוג ביקורת |
| `sent_newsletters` | דיוורים שנשלחו |
| `branding_content` | תוכן אתר/עמוד נחיתה לפי עסק (JSONB) |

---

## 3. שכבת ה-API — Backend

### Middleware אימות

המערכת מגדירה 7 middleware functions שמגנות על routes:

| Middleware | מגן על | מנגנון |
|---|---|---|
| `verifyFamily` | `/api/family/*`, `/api/kids/*`, `/api/academy/*` ועוד | JWT בheader `Authorization` |
| `verifyBiz` | `/api/biz/*`, `/api/store/*`, `/api/calendar/*` ועוד | JWT בsession עם `type === 'BUSINESS'` |
| `verifyBizAdminOnly` | פעולות מנהל בלבד בתוך BIZ | בנוסף ל-verifyBiz: בודק `role === 'ADMIN'` |
| `verifySA` | `/api/sa/*`, `/api/superadmin/*` | JWT ייעודי של SA |
| `verifyZoneManager` | `/api/kol-haam/zm/*`, `/api/zm/*` | JWT של ZM |
| `verifyBizOrLegacy` | routes ישנות | תומך בשני סוגי tokens |
| `verifyFamilyOrBiz` | routes משותפות | מקבל כל אחד מהשניים |

### קבוצות API מרכזיות

| קידומת | כמות routes משוערת | תיאור |
|---|---|---|
| `/api/family/*` | ~30 | ניהול קבוצה משפחתית, קישורים, הגדרות |
| `/api/transactions/*` | ~15 | הכנסות/הוצאות, ייצוא |
| `/api/tasks/*` | ~20 | משימות, אישורים, תגמול |
| `/api/shopping/*` | ~15 | רשימת קניות, checkout, סופרמרקט |
| `/api/pantry/*` | ~10 | מלאי בית/עסק |
| `/api/academy/*` | ~15 | שאלונים, הקצאות, ציונים |
| `/api/kids/*` | ~10 | ארנק ילדים, פרופיל ילד |
| `/api/store/*` | ~30 | חנות עסק: קטלוג, הזמנות, מודיפיירים, presets |
| `/api/calendar/*` | ~15 | יומן, תורים, שירותים |
| `/api/biz/*` | ~50 | ניהול עסק: עובדים, שכר, נוכחות, לקוחות |
| `/api/community/*` | ~20 | קהילות, פיד, הצטרפויות |
| `/api/flow/*` | ~15 | ארנקות FLW, העברות |
| `/api/kol-haam/*` | ~20 | תוכן, קטגוריות, ניהול ZM |
| `/api/sa/*` | ~60 | כל פעולות SA |
| `/api/zm/*` | ~15 | פעולות Zone Manager |
| `/api/ai/*` | ~10 | ממשק ל-Gemini |

### פורמט תגובה סטנדרטי

```json
{ "success": true, "data": {...} }
{ "error": "הודעת שגיאה בעברית" }
```

---

## 4. סביבה 1: FAMILY

**מטרה:** פלטפורמה לניהול חיי המשפחה — כספים, משימות, קניות, חינוך, קהילה.

**URL:** `/` (index.html + app.js)

**אימות:** JWT בלוקל-סטורג' (`ofl_family_token`, `ofl_session`)

### תפקידי משתמש

| תפקיד | גישה |
|---|---|
| `ADMIN` | כל הטאבים, כל הפעולות, ניהול חשבון, ארנק FLW משפחתי |
| `MEMBER` | טאבים מרבית (ללא members ועוד), ללא ניהול |
| `CHILD` | טאבים מוגבלים, ארנק FLW אישי, אקדמיה, אפליקציית ילדים |

### מבנה הניווט — Tabs

| Tab | שם | תיאור |
|---|---|---|
| `feed` | פיד ראשי | כרטיסי מידע, פעילות אחרונה, ברכות |
| `shop` | רשימת קניות | ניהול רשימה משותפת, קיבוץ לפי קטגוריות, checkout |
| `pantry` | מזווה | מלאי בית, כמויות, עריכה |
| `bank` | כספים | הכנסות/הוצאות, גרפים, ייצוא CSV |
| `cashflow` | תזרים | צפי מאוזן מול גירעון |
| `budget` | תקציבים | תקציב לקטגוריה, מעקב בזמן אמת |
| `forecast` | תשקיף | תחזית חודשית/שנתית |
| `tasks` | משימות | יצירה, הקצאה, אישור, תגמול |
| `academy` | אקדמיה | שאלונים לילדים, ביקורת ומבחן |
| `recipes` | מתכונים | AI ממיר מצרכי מזווה למתכון |
| `members` | חברים | ניהול חברי קבוצה, הזמנות |
| `community` | קהילה | פיד קהילה, הצעות עסקים |
| `myorders` | הזמנות שלי | מעקב הזמנות מחנויות עסקים |
| `home-maintenance` | תחזוקת הבית | רישום תקלות, קריאות שירות |

### פיצ'רים עיקריים

#### 💰 ניהול פיננסי משפחתי

**תעודת זהות:** הטאב `bank`.

**מה כולל:**
- רישום הכנסות/הוצאות ידנית או מיובא
- קטגוריות מוגדרות מראש (13 קטגוריות הוצאה, 6 הכנסה)
- רשומות חוזרות (`is_recurring`) — מחויב אוטומטי
- יצוא CSV לאקסל
- גרף עוגה של הוצאות לפי קטגוריה
- מעקב הלוואות בין חברי קבוצה

**מה לא כולל:** קישור אוטומטי לחשבון בנק (אין Open Banking). רישום ידני בלבד.

**תקציבים (`budget`):**
- הגדרת מגבלה לקטגוריה + משתמש
- מעקב בזמן אמת vs. תקציב
- הפרשות מיוחדות: דמי כיס לילדים, תגמול משימות, אקדמיה, חיסכון

**תשקיף (`forecast`):**
- שתי תצוגות: חודשי / שנתי
- מחשב יתרה התחלתית + כל ההכנסות/הוצאות הצפויות
- גרף יחס הכנסות:הוצאות (`forecastRatioChart`)

#### 🛒 רשימת קניות

**מנגנון:**
1. הוספת פריטים עם כמות + יחידה (ידנית / מהגלריה המוגדרת מראש)
2. `normalized_name` — נרמול שם לזיהוי כפילויות
3. קיבוץ אוטומטי לקטגוריות לפי `PRODUCT_DB` + `getCatScore()`
4. `product_category_map` — למידה: המערכת "זוכרת" מיפויים שהמשתמש תיקן
5. **Checkout:** כל הפריטים המסומנים מועברים לטבלת `transactions` כהוצאה, ומועברים ל-`pantry`
6. מצב מחיקה מרובה (`shopMultiDeleteMode`)

**ספרי מוצרים מוגדרים מראש (`PRODUCT_DB`):**
ירקות/פירות, חלב/ביצים, לחם, מזווה, בשר/דגים, ניקיון, חטיפים — ~50 מוצרים נפוצים.

#### 📦 מחסן (Pantry)

- מלאי נוכחי עם כמויות
- הוספה ידנית / דרך checkout מרשימת קניות
- מצב מחיקה מרובה
- **AI insight:** Gemini מנתח את המלאי ומציע מתכון מהמצרכים הקיימים

#### ✅ משימות משפחתיות

**סוגי משימות:**
- משימה רגילה: כותרת, תגמול כספי, תאריך יעד, הקצאה לחבר
- "מעשה טוב" — ללא תגמול כספי, עם אישור הורה
- AI tasks: Gemini מייצר הצעות משימות בהתאם לגיל ולמטרות הקבוצה

**מחזור חיים:**
`pending` → `done` (ע"י המבצע) → `verified` (ע"י ADMIN, כולל תגמול בארנק) → `rejected`

**הוכחת ביצוע:**
- העלאת תמונה (Cloudinary)
- AI אוטומטי — בדיקת תמונה דרך Gemini

#### 🎓 אקדמיה — חידונים לילדים

**תהליך מלא:**
1. ADMIN מקצה `quiz_bundle` לילד דרך `user_assignments`
2. הילד רואה את המשימה בטאב `academy` → לחיצה על "פתח"
3. **שלב ביקורת** (`startQuizReview`): כרטיסיות flash-card — מילה בעברית ותרגום באנגלית, ניווט קדימה/אחורה
4. **שלב מבחן** (`startQuiz`): שאלות בחירה מרובה (4 אפשרויות, 1 נכונה). רישום תשובות
5. **סיום** (`finishQuiz`): חישוב ציון vs. `threshold` → עובר/לא עובר
6. **פרס FLW** (לילדים בלבד): `POST /api/kids/award-flw` → `flw_kid_wallets` UPSERT + `game_sessions`
7. אנימציית מטבעות (`triggerCoinAnimation`) + עדכון ה-header

**שמירת מצב הורה (`_parentPreviewMode`):**
כאשר SA מציג מבחן כ"צפייה", הגישה הזו מדלגת על שליחה ועל פרסים.

#### 🪙 ארנקות FLW

**ארנק משפחתי (ADMIN):**
- מוצג כ-chip ענבר בheader
- טעון ב-`loadFamilyFlowWallet()`
- מסד: `flow_wallets` עם `entity_type='family'`

**ארנק ילד (CHILD):**
- ويدجт סגול נפרד בעמוד הבית
- טעון ב-`loadKidFLWWallet()`
- מסד: `flw_kid_wallets` — ייחודי לחלוטין, לא קשור ל-`flow_wallets`
- גדל עם כל מבחן שהילד עובר + משחקים

#### 🏘️ קהילה

- פיד פוסטים קהילתיים
- עסקים מחוברים לקהילה
- הצעות ייחודיות מעסקים לחברי הקהילה
- FlowPool: קרן משותפת עם הגשת הצעות

#### 📦 הזמנות מחנויות (`myorders`)

- מעקב אחר הזמנות שנשלחו לחנויות עסקים
- סינון לפי סטטוס / תקופה / חיפוש
- אישור קבלה (`confirmOrderReceipt`)
- טאב מיוחד לבקשות הצעת מחיר (`quotes`)

#### 🔑 כניסה ואוטנטיקציה

**שיטות כניסה:**
1. **SMS OTP:** הזנת טלפון → קוד OTP ב-SMS (Twilio) → בחירת חשבון (אם יש כמה)
2. **סיסמה:** כניסה עם מייל + סיסמה
3. **SSO Token:** כניסה אוטומטית דרך קישור מחנות העסק (one-time token)

**הצטרפות:**
- קוד הזמנה — לחיצה על קישור / הזנה ידנית
- ויזארד יצירת חשבון חדש

**רפרל:**
- `?ref=CODE` בURL שומר קוד רפרל ב-localStorage

---

## 5. סביבה 2: BIZ

**מטרה:** ניהול עסק מלא — צוות, מכירות, מלאי, לקוחות, כספים, שיווק.

**URL:** `/business.html` + `business-app.js`

**אימות:** JWT עם `type === 'BUSINESS'`

### סוגי עסקים נתמכים (15 סוגים)

| מזהה | שם | מודולים ייחודיים |
|---|---|---|
| `restaurant` | מסעדה / בית קפה | KDS, menu_templates, foodcost, routines, deliveries |
| `retail` | חנות קמעונאית | POS, מלאי, deliveries |
| `services` | שירותים מקצועיים | יומן, לקוחות, POS |
| `construction` | בנייה / קבלנות | ציוד, משמרות, לקוחות |
| `maintenance_repair` | תחזוקה ותיקונים | יומן, timelog, routines |
| `logistics` | לוגיסטיקה / הפצה | מודול לוגיסטיקה ייעודי (12 sub-tabs) |
| `healthcare` | בריאות / קליניקה | יומן, מטופלים |
| `beauty` | יופי / קוסמטיקה | מודול beauty ייעודי (7 sub-tabs) |
| `education` | חינוך / הדרכה | יומן, אקדמיה |
| `sport` | ספורט / כושר | יומן, מנויים, POS |
| `events` | אירועים / הפקות | יומן, משמרות, ציוד |
| `food_production` | ייצור מזון | foodcost, deliveries, menu_templates |
| `professional` | מקצועי / ייעוץ | תיקים, לידים, מסמכים, timelog |
| `store_only` | חנות בלבד | POS, מלאי, חנות |
| `other` | אחר / כללי | כל המודולים |

**מינוח דינמי (`BUSINESS_CONFIG`):**
המערכת מתאימה טרמינולוגיה לסוג העסק. לדוגמה: מסעדה → "אורח", "מנה", "שולחן"; בריאות → "מטופל", "טיפול", "תור".

### מבנה הניווט — GNAV (5 קבוצות)

הניווט הוא רשת-עליונה (horizontal) עם dropdown לכל קבוצה:

| קבוצה | Tabs כלולים |
|---|---|
| **צוות** | נוכחות, משמרות, יומן ציבורי, משימות, אקדמיה, צוות, יומן מטפלות, שגרות |
| **מכירות** | קופה POS, מכירות/חנות, לקוחות, תיקים, לידים, שליחויות, ביקורות, תפריטים, שירותי יופי, מנויים, לקוחות יופי |
| **מלאי** | רכש ארגוני, ניהול מלאי, תחזוקת ציוד, תמחור ורווחיות, מלאי קוסמטיקה |
| **כספים** | כספים, תזרים, תקציבים, שעות עבודה, תשקיף, עמלות, דוחות |
| **עוד** | קהילות, תקשורת ועדכונים, תוכן אתר, מסמכים, פרסום FLOW, WhatsApp, הגדרות |

### פיצ'רים עיקריים

#### ⏱️ נוכחות ושכר (`timeclock`)

**Punch In/Out:**
- כפתור ניתן ל-PWA מהמסך הראשי
- בדיקת סטטוס (`checkTimeclockStatus`) — האם עובד פנוי/בשמרה
- תמיכה ב-punch ידני (`openManualPunchModal`) עבור ADMIN

**דוח נוכחות (`fetchTimeclockReport`):**
- סינון לפי עובד + תאריכים
- PDF export
- תשלום שכר לפי שעות (`openPayrollModal` → `submitPayrollRun`)

**איזוני שעות (`openBalanceAdjustmentModal`):**
- הוספה/קיזוז של שעות ידנית עם סיבה

#### 🗓️ משמרות (`shifts`)

- יצירת משמרות לעובדים לפי תאריך/שעות
- תצוגה: לוח שבועי
- `isShiftTask()` — פונקציה מיוחדת שמזהה משימה שהיא בעצם משמרת (prefix `SHIFT|`)

#### 💰 קופה (POS) — `pos`

- ממשק touchscreen מלא
- מוצרים מהקטלוג, כמויות, מודיפיירים
- **Fullscreen mode** (`togglePOSFullscreen`) — לשימוש ב-tablet/kiosk
- קיצורי ניווט מהיר (`posQuickNavigate`)
- מצב kiosk עם סיסמה
- תשלום: מזומן / אשראי / FLW

#### 🛍️ חנות ומכירות (`sales`)

**ויזארד יצירת מוצר (Product Wizard):**

4 שלבים:
1. **בחירת סוג**: מוצר / שירות / טפסים / עם אפשרויות / פשוט / **תבנית** (חדש)
2. **פרטי מוצר**: שם, תיאור, מחיר, קטגוריה, תמונה (Cloudinary)
3. **מודיפיירים**: קבוצות תוספות (לדוגמה: "בחרו רוטב" עם 3 אפשרויות)
4. **תצוגה מקדימה**: סקירה לפני שמירה

**תבניות מודיפיירים (Modifier Presets):**
- שמורות ב-`store_settings.modifier_presets` כ-JSON array
- ניהול דרך `openModifierTemplatesModal()`: צפייה, עריכה, מחיקה
- גישה מהירה: כפתור "תבניות" בסרגל הקטלוג

**קטלוג:**
- עריכה מהירה בלחיצה
- מסנן לפי קטגוריה
- ניהול מלאי: `in_stock` / `out_of_stock` / `limited`

**הזמנות נכנסות:**
- תצוגת כרטיסיות לפי סטטוס (חדש/אושר/מוכן/נמסר/בוטל)
- עדכון סטטוס + שליחת SMS/WhatsApp ללקוח
- ניהול שליחויות

#### 🤝 לקוחות (`customers`)

- CRM בסיסי: שם, טלפון, מייל, היסטוריית הזמנות
- הערות אישיות
- תווית "לקוח חוזר" / "חדש"

#### 💸 כספים ותזרים

**זהה לסביבת FAMILY, אבל עם:**
- קטגוריות עסקיות (ציוד, שיווק, שכר, שכירות)
- דוחות מאוחדים (`renderUnifiedReportsTab`)
- ייצוא CSV + PDF
- תמחור ורווחיות (`foodcost`): מחיר עלות לעומת מחיר מכירה, % רווח

#### 👥 ניהול צוות (`members`)

**תפקידי עובד:**
- `ADMIN`, `MANAGER`, `SENIOR`, `MEMBER` — גישה לטאבים לפי `ROLE_DEFAULTS`
- תפקידים מיוחדים עם דשבורד ייעודי:
  - מלצר/ית, טבח/ית (מסעדה)
  - מטפלת, טכנאית ציפורניים, איפורנית, קבלה (יופי)
  - שליח/נהג, מחסנאי (לוגיסטיקה)
  - ועוד ~20 תפקידים

**הרשאות מפורטות (`openPermissionsModal`):**
- בחירה ידנית של מודולים לכל עובד
- ברירות מחדל לפי תפקיד (`ROLE_DEFAULTS`)
- `applyRoleDefaults()` — איפוס לברירת מחדל

**דשבורד לפי תפקיד:**
כל תפקיד מציג ממשק שונה בהתחברות:
- קופאי: מסך POS ישיר
- שליח: רשימת משלוחים
- מחסנאי: בדיקות מלאי
- מטפלת: יומן תורים אישי
- וכולי

#### 🌐 תוכן אתר (`content`)

**בניית עמוד נחיתה לעסק:**
- סוגי בלוקים: שירות, המלצה, "עלינו", חבר צוות, FAQ, גלריה
- עריכה חזותית WYSIWYG בסיסית
- שמירה ב-`branding_content` (JSONB)

#### 🏘️ קהילות מחוברות (`community`)

- העסק יכול להצטרף לקהילות
- שיתוף מבצעים לחברי קהילה
- קבלת לידים ממשתמשי הקהילה

#### 💅 מודול יופי (Beauty-only)

מופעל רק לסוג עסק `beauty`:

| Tab | תיאור |
|---|---|
| `beauty_calendar` | יומן תורים לפי מטפלת ויום |
| `beauty_practitioners` | ניהול מטפלות: שם, תפקיד, זמינות |
| `beauty_services` | שירותים: שם, משך, מחיר, קטגוריה |
| `beauty_subscriptions` | מנויים וחבילות לקוחות |
| `beauty_clients` | תיקי לקוחות: היסטוריה, העדפות, הערות |
| `beauty_inventory` | מלאי מוצרים מקצועיים |
| `beauty_commissions` | חישוב עמלות ושכר מטפלות |
| `beauty_rfq` | בקשות ייעוץ/הצעות מחיר |

#### 🚚 מודול לוגיסטיקה (Logistics-only)

מופעל רק לסוג עסק `logistics`:

| Tab | תיאור |
|---|---|
| `logistics_orders` | קנבן משלוחים (חדש/נאסף/בדרך/נמסר) |
| `logistics_drivers` | נהגים, רכבים, הקצאת משלוחים |
| `logistics_vehicles` | צי רכבים |
| `logistics_pricing` | מחירון לפי משקל/אזור |
| `logistics_cod` | גבייה במשלוח (Cash on Delivery) |
| `logistics_rfq` | הצעות מחיר |
| `logistics_routes` | מסלולי חלוקה יומיים |
| `logistics_tracking` | לינקי מעקב ללקוחות |
| `logistics_reports` | דוחות: איחורים, נהגים, רווחיות |
| `logistics_customers` | מזמינים ונמענים |
| `logistics_invoices` | חשבוניות |

#### 📢 פרסום FLOW (`biz-ads`)

- הזמנת מיקום פרסומי בפיד הקהילה
- תשלום מארנק FLW של העסק
- מעקב חשיפות + קליקים

#### 📱 WhatsApp Alerts (`whatsapp-alerts`)

- הגדרת התראות WhatsApp אוטומטיות לאירועים (הזמנה חדשה, ביטול תור, וכד')
- אינטגרציה דרך קישורי wa.me

#### 🔄 שגרות (`routines`)

- אוטומציה של תהליכים חוזרים (דוגמה: הזמנת חומרי גלם שבועית)
- זמין כרגע רק ל: `restaurant`, `maintenance_repair`

#### 🔒 מנעול מודולים

מודולים שלא כלולים בסוג העסק מוצגים עם "מנעול":
- `openLockedModuleModal()` — הסבר + כפתור בקשה
- `requestModuleUnlock()` — שליחת בקשה ל-SA לפתיחה ידנית

#### 🎯 SA Impersonation Mode

כאשר SA מתחבר כ"עסק" לצרכי תמיכה:
- סרגל אזהרה אדום בחלק העליון: "מצב תמיכה והשתלטות"
- כפתורי: רענן / מזער / יציאה
- `exitImpersonationMode()` — חזרה לממשק SA

---

## 6. סביבה 3: SUPER-ADMIN (SA)

**מטרה:** ניהול פנימי מלא של הפלטפורמה — משתמשים, עסקים, תמיכה, מוניטיזציה.

**אימות:** מייל + סיסמה ייעודית לצוות. JWT נפרד לחלוטין מ-FAMILY/BIZ.

**RBAC:** permissions array לפי קבוצות: `all`, `support`, `devops`, `stats`, `comm`, `biz`, `content`, `users`, `marketing`.

### Tabs של SA

| Tab | תיאור |
|---|---|
| `pulse` | מרכז בקרה: KPIs, צ'יפס התראות, לייב פעילות |
| `clients` | ניהול כל הסביבות (FAMILY + BIZ + SOLO) |
| `families` | ניהול ספציפי של קבוצות משפחה |
| `biz` | ניהול עסקים: אישורים, בקשות, freeze/unfreeze |
| `comm` | ניהול קהילות + עסקים בקהילה + מבצעים ממתינים |
| `support` | מערכת תמיכה: קריאות, תגובות, SLA |
| `finance` | חיוב, חשבוניות, תשלומים |
| `partners` | מנהלי אזור: בקשות, אישורים, ניהול |
| `adslots` | ניהול מיקומי פרסום + הזמנות |
| `hr` | ניהול משתמשי SA (צוות פנימי) |
| `content` | תוכן מערכת: בנרים, splash, הודעות ברוכים הבאים |
| `marketing` | שיווק: דיוורים, קמפיינים |
| `devops` | כלי תפעול: מיזוג קבוצות/משתמשים, audit log |
| `shuka` | ניהול "שוק" — B2B ספקים |
| `masterconfig` | הגדרות מתקדמות (Super-Admin בלבד) |

### פיצ'רים עיקריים

#### 📊 Pulse — לוח בקרה

**KPIs בזמן אמת:**
- קבוצות פעילות / חדשות / ארכיון
- עסקים ממתינים לאישור
- קריאות תמיכה פתוחות / דחופות
- הזמנות פרסום ממתינות
- מנהלי אזור ממתינים לאישור
- חשבוניות לא שולמו
- פרומו קהילה ממתינים

**Live Pulse (`renderLivePulse`):**
- אנימציה של פעילות בזמן אמת (כניסות, הזמנות, רישומים)

**צ'יפס חכמים:**
כל KPI יוצר צ'יפ לחיץ שמנווט ישיר לטאב הרלוונטי + גלילה לאלמנט הספציפי.

#### 🏢 ניהול עסקים (`biz`)

**פעולות לעסק:**
- הצגת כל פרטי העסק
- Freeze / Unfreeze
- סימון כ-Demo / Test
- **Impersonation** — כניסה לממשק העסק כ-SA לצרכי תמיכה
- מחיקה (רכה ← ארכיון, קשה ← מחיקה לצמיתות)
- איפוס סיסמה
- פתיחת מודולים נעולים בידנית
- עדכון סוג עסק

**ניהול ויזארד:**
- רשימת עסקים שלא סיימו wizard ההקמה
- `mark-wizard-completed` — סימון ידני

#### 👥 ניהול משתמשים

- חיפוש לפי טלפון / שם / מייל
- עריכת פרטים, שינוי תפקיד
- מיזוג משתמשים כפולים (`/api/sa/users/merge`)
- מיזוג קבוצות כפולות (`/api/sa/groups/merge-duplicate`)
- audit log של כל פעולות SA

#### 🎫 תמיכה (`support`)

**Ticket system:**
- קריאות עם עדיפות, סטטוס, SLA
- תגובות SA ← לקוח דרך המערכת
- תצוגת SLA: ירוק/צהוב/אדום לפי זמן שחלף

**SLA Configuration:**
- הגדרת מקסימום שעות לכל מודול + סטטוס
- `sla_configs` + `alert_rules` לשליחת התראה בחריגה

#### 🗺️ ניהול מנהלי אזור (`partners`)

- רשימת בקשות ZM ממתינות
- אישור / דחייה
- הקצאת קהילות לזון מנג'ר
- העברת קהילות בין ZMs

#### 📢 מיקומי פרסום (`adslots`)

- הגדרת סלוטים (banner / splash / feed)
- קבלת הזמנות פרסום מעסקים
- אישור / דחייה
- ניהול billing פרסום

#### 🏘️ ניהול קהילות (`comm`)

- רשימת קהילות + פילטורים
- אישור קהילות חדשות
- ניהול פרסומות קהילה ממתינות
- ניהול הצטרפות עסקים לקהילות

#### 🤖 AI Business Builder

כלי SA ליצירת תוכן שיווקי אוטומטי לעסקים:
- טיוטת תיאור עסק (Gemini)
- הצעות למבצעים
- תוכן לקטלוג
- גנרציית תמונות (Gemini Vision)
- Branding: לוגו, צבעים, סלוגן

#### 📋 Quest Library

- ספריית שאלונים ציבורית
- הוספת quiz bundle לספרייה ציבורית
- דירוג, שימוש, דיווח על תוכן לא ראוי

#### 🗺️ System Map (`sysmap`)

מפה ויזואלית של כל הרכיבים, טבלאות, זרימות — לצרכי תיעוד פנימי.

---

## 7. סביבה 4: ZONE-MANAGER (ZM)

**מטרה:** ניהול קהילה גאוגרפית + תוכן "כול-העם" ב-zone.

**אימות:** JWT ייעודי (`verifyZoneManager`). כניסה דרך ממשק ZM ייעודי.

### יכולות

#### ניהול קהילה

- **ניהול חברים:** אישור/דחיית בקשות הצטרפות לקהילה
- **ניהול עסקים:** אישור עסקים שמבקשים להצטרף לקהילה
- **Inbox ZM:** `zm_inbox_messages` — הודעות ישירות מחברי הקהילה
- **דוחות קהילה:** סטטיסטיקות פעילות

#### ניהול "כול-העם" — פלטפורמת תוכן

**תהליך אישור תוכן:**
1. כותב (משתמש FAMILY/BIZ) יוצר תוכן וממלא טפסים
2. שולח לאישור ZM (`/api/kol-haam/zm/pending`)
3. ZM בוחן → מאשר / דוחה עם הסבר
4. תוכן מאושר ZM עובר לאישור SA (global)
5. SA מאשר → פורסם ציבורית

**קטגוריות:**
- ZM מנהל קטגוריות לאזור שלו (`verifyZoneManager`)
- קטגוריות עם `is_public` flag

---

## 8. מערכות רוחביות

### 🔔 מערכת התראות ו-Polling

**Frontend Polling:**
- `pollInterval` — interval כל 30 שניות שמביא עדכונים
- `startMyOrdersAutoRefresh()` — ריענון מהיר לעדכוני הזמנות (כל 15 שניות כשהטאב פעיל)
- `showOrderStatusToast()` — notification בתוך האפליקציה על שינוי סטטוס

**Alert Rules:**
- ADMIN מגדיר כללים: "אם הוצאה בקטגוריה X עברה Y → שלח התראה"
- `alert_rules` + `alert_notifications`

### 📢 מערכת פרסום (Ads)

שלוש רמות:
1. **Splash:** מסך פתיחה (תמונה + קישור). מוצג לכל משתמש כולל אנונימי.
2. **Banner:** באנר בתוך הממשק לפי `slot_key`
3. **Feed:** פרסומת בתוך פיד הקהילה

`fetchAds()` → `applyAdsToDOM()` → Cloudinary לאופטימיזציה של תמונות.

### 🤖 AI Integration (Gemini)

| פעולה | API | תיאור |
|---|---|---|
| `getBudgetInsight()` | `POST /api/ai/budget-insight` | ניתוח הוצאות + המלצות |
| `getPantryInsight()` | `POST /api/ai/pantry-insight` | הצעות בישול ממלאי |
| `generateAITasks()` | `POST /api/ai/generate-tasks` | הצעות משימות לפי גיל/מטרה |
| `generateRecipe()` | `POST /api/ai/recipe` | מתכון ממרכיבים שנבחרו |
| `generateAIQuiz()` | `POST /api/ai/quiz` | יצירת שאלון אנגלית אוטומטי |
| `getFamilAIAdvice()` | `POST /api/ai/advice` | ייעוץ התנהגותי לגבי ילד |
| `askTutor()` | `POST /api/ai/tutor` | עוזר שיעורי בית |
| `getBusinessAIAdvice()` | `POST /api/ai/business-advice` | ייעוץ עסקי לפי נתוני העסק |

**AI Battery:**
- כל שאילתת AI מנוכית מ"battery" (מספר קריאות)
- `updateBatteryUI()` — ספירה ויזואלית
- כניסה לפרימיום אם נגמרה הbattery

### ♿ נגישות

`accState` + `initAccessibility()`:
- טקסט גדול (`text-lg`)
- גווני אפור (`grayscale`)
- ניגוד גבוה (`contrast`)
- גופן קריא (`readable-font`)
- הדגשת קישורים (`highlight-links`)

### 📱 PWA

- `sw.js` — Service Worker עם cache strategy
- `setupPwaInstallSection()` — הוראות התקנה (iOS שונה מאנדרואיד)
- `beforeinstallprompt` — prompt אינסטול אנדרואיד
- `manifest.json` — מטאדאטה אפליקציה

### 🔐 SSO (Single Sign-On)

מנגנון כניסה חלקה מחנות עסק לממשק משפחה:
1. משתמש לוחץ "כניסה" בחנות הציבורית
2. השרת יוצר `sso_token` one-time
3. Redirect ל-`/?sso_token=xxx`
4. app.js מאמת → מכניס לממשק FAMILY
5. **Security guard:** SSO לעולם לא מאפשר כניסה ל-BUSINESS group

---

## 9. זרימות קריטיות (Flows)

### זרימה 1: רכישה מחנות עסק

```
לקוח (Browser/Mobile)
  ↓ נכנס ל /:alias
  ↓ טוען את storefront-btype.js
  ↓ מוסיף מוצרים לעגלה (+ מודיפיירים)
  ↓ POST /api/store/orders
  ↓ SMS ללקוח (Twilio) + WhatsApp לבעל עסק
  ↓ בעל עסק מעדכן סטטוס בממשק BIZ
  ↓ לקוח מקבל push/SMS על כל שינוי סטטוס
  ↓ "נמסר" → אישור קבלה מהלקוח
```

### זרימה 2: העברת FLW

```
משפחה A קונה מעסק B
  ↓ POST /api/flow/spend
  ↓ בדיקת יתרה: flow_wallets (family)
  ↓ UPDATE flow_wallets: balance -= amount (family A)
  ↓ INSERT/UPDATE flow_wallets: balance += bizEarn (business B)
  ↓ INSERT transactions (הוצאה אצל A)
  ↓ triggerCoinAnimation() בclient
```

### זרימה 3: ילד עובר מבחן

```
ילד לוחץ "פתח" על מטלה
  ↓ startQuizReview(bundleId) — מביא שאלות מ-API
  ↓ מוצגות כרטיסיות flash-card
  ↓ לחיצה "התחל מבחן" → startQuiz(bundleId)
  ↓ 4 אפשרויות בחירה לכל שאלה
  ↓ finishQuiz() — חישוב ציון
  ↓ אם עובר (ציון >= threshold):
      ↓ POST /api/academy/submit
      ↓ POST /api/kids/award-flw { flwEarned: X }
          ↓ INSERT game_sessions
          ↓ UPSERT flw_kid_wallets
      ↓ אנימציית מטבעות
      ↓ עדכון header chip
```

### זרימה 4: יצירת עסק חדש

```
SA / בעל עסק
  ↓ POST /api/sa/create-business (SA) או ויזארד ב-BIZ
  ↓ INSERT family_groups (type=BUSINESS)
  ↓ INSERT users (role=ADMIN, password_hash=bcrypt)
  ↓ INSERT store_settings (is_active=false)
  ↓ INSERT flow_wallets (entity_type='business', balance=0)
  ↓ SMS עם פרטי כניסה לבעל העסק (Twilio)
  ↓ בעל עסק מתחבר ל-/business.html
  ↓ ויזארד הקמה: שם, לוגו, סוג עסק, store_alias
  ↓ SA מאשר (אם נדרש) → account_status='active'
```

---

## 10. אינטגרציות חיצוניות

| שירות | שימוש | אימות |
|---|---|---|
| **PostgreSQL** | מסד נתונים ראשי | `DATABASE_URL` env |
| **Gemini AI** (Google) | AI features — ייעוץ, יצירת שאלונים, מתכונים | `GEMINI_API_KEY` env |
| **Twilio** | SMS: OTP, אישור הזמנה, איפוס סיסמה | `TWILIO_*` env |
| **Nodemailer** | מייל: איפוס סיסמה, אישורים, דיוורים | `SMTP_*` env |
| **Cloudinary** | אחסון תמונות: לוגו עסק, תמונות מוצר, הוכחות משימה | `CLOUDINARY_*` env |
| **WhatsApp (wa.me)** | קישורי WhatsApp לשליחת הודעות — לא API רשמי | ללא auth (קישורי deep-link) |

---

*עדכון אחרון: אוקטובר 2026*
