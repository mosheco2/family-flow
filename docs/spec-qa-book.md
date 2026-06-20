# ספר QA — OneFlow Life / Family-Flow
**גרסה:** 2026-06-20 | **מחבר:** צוות פיתוח OneFlow  
**מכסה:** 4 סביבות — FAMILY · BIZ · SUPER-ADMIN · ZONE-MANAGER

---

## תוכן עניינים

1. [עקרונות בדיקה](#1-עקרונות-בדיקה)
2. [סביבת FAMILY](#2-סביבת-family)
3. [סביבת BIZ](#3-סביבת-biz)
4. [סביבת SUPER-ADMIN](#4-סביבת-super-admin)
5. [סביבת ZONE-MANAGER](#5-סביבת-zone-manager)
6. [Edge Cases ידועים](#6-edge-cases-ידועים)
7. [API Smoke Tests](#7-api-smoke-tests)
8. [Regression Checklist](#8-regression-checklist)

---

## 1. עקרונות בדיקה

### 1.1 ארכיטקטורה — רקע

| שכבה | טכנולוגיה |
|------|-----------|
| Backend | Node.js / Express |
| מסד נתונים | PostgreSQL |
| Frontend | Vanilla JS + TailwindCSS (ללא framework) |
| AI | Google Gemini 1.5 Flash / 2.5 Flash |
| SMS OTP | Twilio |
| אימייל | Gmail SMTP (nodemailer) |
| PWA | Service Worker + manifest |

### 1.2 ארבע הסביבות

| סביבה | URL | קובץ Frontend | מי נכנס |
|-------|-----|----------------|---------|
| FAMILY | `/` | `index.html` + `app.js` | משפחה / ילדים |
| BIZ | `/business.html` | `business.html` + `business-app.js` | מנהלי עסק + עובדים |
| SUPER-ADMIN | `/sa.html` | `sa.html` + `business-app.js` (SA panel) | מנהל-על |
| ZONE-MANAGER | `/zone-manager.html` | `zone-manager.html` | מנהל אזורים |

### 1.3 סוגי בדיקות

- **Functional Testing** — בדיקה שכל Feature עובד לפי הדרישות
- **Regression Testing** — ודא שפיצ'רים ישנים לא נשברו לאחר עדכון
- **UX / UI Testing** — RTL, גלישה במובייל, כפתורים נגישים, toast messages
- **API Testing** — בדיקת endpoints ישירות ב-curl / Postman
- **Boundary Testing** — ערכי קצה: שדות ריקים, מחרוזות ארוכות, מספרים שליליים
- **Permission Testing** — עובד ללא הרשאה מנסה לגשת לטאב מוגבל

### 1.4 סביבות הרצה

| סביבה | URL | הערות |
|-------|-----|--------|
| DEV | `http://localhost:3000` | API = `http://localhost:3000/api` |
| PROD | `https://family-flow.onrender.com` | API = `/api` |

**חוק מספר אחד:** לעולם לא לבדוק על נתוני ייצור מבלי לגבות את המסד תחילה.

---

## 2. סביבת FAMILY

### 2.1 הרשמה וכניסה

#### 2.1.1 יצירת קבוצה חדשה

- [ ] מילוי כל שדות החובה (שם, אימייל, סיסמה, שנת לידה) → לחיצה על "צור קבוצה" → מקבלים מסך Dashboard
- [ ] בדיקה שנוצר `group_code` ייחודי בן 6 תווים (אותיות + ספרות)
- [ ] ניסיון ליצור קבוצה ללא אישור תקנון (checkbox) → שגיאה "יש לאשר את התקנון"
- [ ] ניסיון ליצור קבוצה ללא אימייל → שגיאת validation
- [ ] ילד מגיל 10+ חייב למלא מספר טלפון → ניסיון בלי טלפון → שגיאה
- [ ] לאחר יצירה: redirect אוטומטי ל-BIZ אם סוג = BUSINESS, ל-FAMILY אם סוג = FAMILY
- [ ] `ofl_session` נשמר ב-localStorage
- [ ] Failsafe timer: אם preloader נתקע מעל 7 שניות → מציג מסך login

#### 2.1.2 Login קיים

- [ ] הכנסת קוד קבוצה + שם כינוי + סיסמה → login מוצלח → dashboard נטען
- [ ] קוד שגוי → toast שגיאה אדומה
- [ ] סיסמה שגויה → toast שגיאה
- [ ] עסק נכנס דרך index.html → redirect ל-`business.html`
- [ ] משפחה נכנסת דרך business.html → redirect ל-`/`
- [ ] סשן שמור (localStorage) → כניסה אוטומטית בלי login מחדש

#### 2.1.3 הצטרפות לקבוצה קיימת (Join)

- [ ] כניסה עם קישור הזמנה `?code=XXXXXX&role=CHILD` → מסך Join נטען עם קוד ותפקיד ממולאים
- [ ] לאחר הגשת טופס Join → toast "בקשתך נשלחה! יש להמתין לאישור" → redirect ל-login
- [ ] Admin רואה את הבקשה בטאב Members ומאשר
- [ ] קוד קבוצה לא קיים → שגיאת API

---

### 2.2 בנק משפחתי

- [ ] פתיחת tab "bank" → רשימת עסקאות נטענת
- [ ] לחיצה על כפתור FAB (+) → פתיחת modal הוספת עסקה
- [ ] הוספת הכנסה (כגון: משכורת, ₪5000) → עסקה מופיעה ברשימה, יתרה מתעדכנת
- [ ] הוספת הוצאה (כגון: מסעדות, ₪150) → יתרה יורדת
- [ ] הוספת הלוואה בין חברי משפחה → הלוואה מופיעה בטאב "הלוואות"
- [ ] קביעת יעד חיסכון ("ק)ופת חיסכון") → יעד מופיע עם progress bar
- [ ] הגדרת דמי כיס שבועיים לילד → דמי כיס מחושבים ומופיעים ביתרת הילד
- [ ] עסקה חוזרת (is_recurring=TRUE) → מחושבת בתחזית
- [ ] תצוגה חודשית / שנתית של תחזית (forecast) → מתחלפת בלחיצה על כפתורי "חודשי/שנתי"
- [ ] גרף יחס הוצאות (pie chart) → מוצג עם קטגוריות צבעוניות

---

### 2.3 רשימת קנייה וCheckout

- [ ] הוספת פריט לרשימה (הקלדה ידנית) → פריט מופיע ברשימה עם קטגוריה אוטומטית
- [ ] הוספת פריט דרך סריקת ברקוד (`scan-receipt`) → AI ממלא פריטים
- [ ] סימון פריט כ"נקנה" (checkbox) → פריט נסרק מהרשימה
- [ ] מחיקת פריט בודד → פריט נעלם
- [ ] מחיקה מרובה (multi-delete mode) → בחירת כמה פריטים → "מחק" → כולם נעלמים
- [ ] Checkout מלא → cart_footer מוסתר → עסקה נוצרת אוטומטית
- [ ] לחיצה על "היסטוריית קניות" → רשימת טיולים קנייה עם תאריכים
- [ ] העתקת רשימה מטיול קנייה קודם → פריטים חוזרים לרשימה הנוכחית

---

### 2.4 מזווה (Pantry)

- [ ] כניסה לטאב "pantry" → רשימת פריטים נטענת
- [ ] הוספת פריט חדש (שם, כמות, יחידות) → פריט מופיע
- [ ] עדכון כמות (use) → כמות יורדת
- [ ] מחיקת פריט → פריט נעלם
- [ ] פריט בכמות 0 → הצעה להעביר לרשימת קנייה
- [ ] לחיצה על "familAI Insight" → AI מנתח את המזווה ומציג המלצות (מוריד token אחד)
- [ ] multi-delete mode → בחירה ומחיקה מרובה

---

### 2.5 שף AI (מתכונים)

- [ ] כניסה לטאב "recipes" → מוצגת רשימת פריטי מזווה לבחירה
- [ ] בחירת 3 פריטים → לחיצה "בקש מתכון" → AI מחזיר מתכון (צריך token)
- [ ] כאשר AI tokens = 0 → הודעת שגיאה "הסוללה ריקה" / 429 response
- [ ] Premium account → tokens אינסופיים לשף AI

---

### 2.6 משימות (Tasks)

- [ ] Admin יוצר משימה עם תיאור, תגמול, תאריך יעד
- [ ] ילד רואה משימה בטאב "tasks" → לוחץ "קבל משימה"
- [ ] ילד מבצע → לוחץ "סיימתי" → mission מסתיימת ומחכה לאישור
- [ ] Admin מאשר → תגמול (₪) עובר ליתרת הילד → confetti 🎊
- [ ] Admin דוחה → הודעת דחייה לילד
- [ ] task עם vision-verify → ילד מצלם תמונה → AI מאמת שהמשימה בוצעה
- [ ] AI יוצר משימות חינוכיות אוטומטית (`tasks/ai-generate`)

---

### 2.7 הזמנות שלי (My Orders)

- [ ] כניסה לטאב "myorders" → רשימת הזמנות מהעסקים נטענת
- [ ] הזמנה חדשה מוצגת עם סטטוס "ממתין לאישור"
- [ ] סטטוסים: new → processing → ready → shipped → delivering → completed
- [ ] כל 20 שניות auto-refresh מתרחש אוטומטית
- [ ] pagination: לחיצה על "טען עוד" → הזמנות נוספות נטענות
- [ ] תצוגת "הצעות מחיר" (sub-tab) → הצעות מחיר מהעסקים מוצגות
- [ ] Timeout: אם שרת לא עונה תוך זמן סביר → הודעה "לא הצלחנו לטעון"

---

### 2.8 קהילה (Community)

- [ ] כניסה לטאב "community" → feed פוסטים נטען
- [ ] הצטרפות לקהילה → לחיצה "הצטרף" → אישור
- [ ] עזיבת קהילה → לחיצה "עזוב" → הסרה
- [ ] שיתוף קהילה בוואטסאפ → קישור נוצר עם קוד הקהילה
- [ ] מיזמים (Initiatives) → רשימת מיזמים קהילתיים נטענת

---

### 2.9 נוכחות (Time Clock — FAMILY)

- [ ] כניסה לטאב "attendance" (במידה וקיים) → לחיצה "כניסה" → punch_in נרשם
- [ ] לחיצה "יציאה" → punch_out נרשם, total_minutes מחושב
- [ ] דוח נוכחות: רשימת punch-in/out עם סה"כ שעות

---

### 2.10 אקדמיה פיננסית

- [ ] כניסה לטאב "academy" → אתגרים חינוכיים מוצגים
- [ ] ענייה על שאלה נכונה → תגמול ₪ לילד + confetti
- [ ] ענייה שגויה → הצגת תשובה נכונה
- [ ] AI מייצר אתגר לפי גיל הילד

---

## 3. סביבת BIZ

### 3.1 Login + Onboarding Wizard

- [ ] כניסה ל-`/business.html` → מסך login מוצג
- [ ] קוד עסק + שם עובד + סיסמה → login מוצלח → dashboard עסקי נטען
- [ ] קוד שגוי → toast שגיאה
- [ ] `is_onboarded = FALSE` → wizard onboarding נפתח
- [ ] Wizard: שלב 1 שם עסק, שלב 2 סוג עסק, שלב 3 כתובת → "סיים הקמה" → `is_onboarded = TRUE`
- [ ] Super Admin במצב impersonation → כפתור "התנתקות" אדום בראש המסך

---

### 3.2 הזמנות חנות — כל מחזור הסטטוסים

- [ ] לחיצה על "מכירות" → טאב "הזמנות" מוצג
- [ ] הזמנה חדשה (new) מוצגת עם badge ירוק "חדשה"
- [ ] לחיצה "אשר הזמנה" → סטטוס משתנה ל-`processing` → toast success
- [ ] לחיצה "מוכן לאיסוף" → סטטוס משתנה ל-`ready`
- [ ] לחיצה "נשלח" → סטטוס משתנה ל-`shipped`
- [ ] הזמנת delivery → לחיצה "בדרך" → סטטוס `delivering`
- [ ] לחיצה "הושלם" → סטטוס `completed`
- [ ] סינון לפי סטטוס (dropdown) → מסנן הזמנות בהתאם
- [ ] בדיקת כל סטטוס: הצבע הנכון, הטקסט הנכון, הכפתורים הנכונים
- [ ] לחיצה על הזמנה → modal מפורט עם פרטי הלקוח, פריטים, סכום

---

### 3.3 POS (קופה)

- [ ] כניסה לטאב "POS" → קטלוג מוצרים נטען
- [ ] לחיצה על מוצר → מוסף לעגלה עם כמות 1
- [ ] לחיצה פעם שנייה → כמות מוגדלת
- [ ] מחיקת פריט מהעגלה → פריט נמחק
- [ ] הנחה ידנית (%) → מחיר מחושב מחדש
- [ ] הנחה ידנית (₪ קבוע) → מחיר מחושב מחדש
- [ ] ביטול הנחה (כפתור ✕) → מחיר חוזר לרגיל
- [ ] חיפוש מוצר (search input) → תוצאות מסוננות בזמן אמת
- [ ] סינון לפי קטגוריה → מוצגים רק מוצרים מהקטגוריה
- [ ] לחיצה "תשלום" → modal תשלום נפתח → בחירת אמצעי תשלום → אישור → הזמנה נשמרת
- [ ] Kiosk mode → fullscreen display ללקוח
- [ ] מע"מ (VAT) מוצג אם `include_vat = TRUE`
- [ ] זיהוי לקוח לפי טלפון (`pos-customer-phone`) → לקוח קיים מוצג

---

### 3.4 שליח (Delivery Flow)

- [ ] בדיקה שהזמנה עם `is_delivery = TRUE` מוצגת בטאב שליחים
- [ ] שליח לוחץ "איסוף" → סטטוס משתנה ל-`picked_up`
- [ ] שליח לוחץ "נמסר" → סטטוס משתנה ל-`delivered`
- [ ] ניסיון שליח לסמן הזמנה שאינה delivery → לא אמור להצליח
- [ ] מפה עם נקודת יעד מוצגת (אם `delivery_details` כולל כתובת)

---

### 3.5 קטלוג מוצרים

- [ ] כניסה לטאב "catalog" → רשימת מוצרים נטענת
- [ ] הוספת מוצר חדש (שם, תיאור, מחיר, קטגוריה, תמונה) → מוצר מופיע ברשימה
- [ ] עריכת מוצר קיים → שינויים נשמרים
- [ ] הסתרת מוצר (toggle is_available) → המוצר נעלם מהחנות הפרונטית
- [ ] הצגת מוצר מוסתר → מוצר חוזר לחנות
- [ ] מחיקת מוצר → אישור confirm → מוצר נמחק לצמיתות
- [ ] AI תיאור מוצר (`/api/store/ai-desc`) → מוריד token אחד → תיאור נוצר ומולא בשדה
- [ ] הוספת badge למוצר (טקסט + צבע) → badge מוצג בכרטיס המוצר
- [ ] העלאת תמונה → תמונה נשמרת ומוצגת

---

### 3.6 קופונים

- [ ] כניסה לטאב "marketing" → לשונית "קופונים"
- [ ] יצירת קופון (קוד, הנחה %, תאריך תפוגה) → קופון מופיע ברשימה
- [ ] מחיקת קופון → קופון נמחק
- [ ] שימוש בקופון בחנות הפרונטית → הנחה מוחלת על ההזמנה
- [ ] קופון שפג → הודעת שגיאה "הקופון פג תוקפו"
- [ ] קופון עם שימוש מינימלי → ניסיון שימוש בהזמנה קטנה → שגיאה

---

### 3.7 נוכחות עובדים (Time Clock)

- [ ] עובד לוחץ "כניסה" → `punch_in` נרשם ב-DB
- [ ] עובד לוחץ "יציאה" → `punch_out` נרשם, `total_minutes` מחושב
- [ ] עובד כבר "punch-in" → כפתור "כניסה" מוחלף ב"יציאה"
- [ ] מנהל רואה דוח נוכחות לכל העובדים
- [ ] הכנסת נוכחות ידנית (manual) על ידי מנהל
- [ ] הגדרת מיקום עבודה (geolocation) → עובד שאינו במיקום → אזהרה
- [ ] תצוגת ה-Timer בזמן אמת בעת כניסה

---

### 3.8 משמרות (Shifts)

- [ ] פתיחת modal "משמרת חדשה" → מילוי פרטים → שמירה → משמרת מופיעה ברשימה
- [ ] תצוגת רשימה / יומי / שבועי → מתחלפות בלחיצה
- [ ] ניווט תאריכים (חיצי ניווט) → תאריך משתנה
- [ ] עריכת משמרת → שינויים נשמרים
- [ ] מחיקת משמרת → משמרת נעלמת

---

### 3.9 משימות (BIZ — Tasks)

- [ ] מנהל יוצר משימה עם כותרת, תיאור, תגמול, תאריך
- [ ] עובד רואה משימה ברשימה → לוחץ "קח משימה"
- [ ] עובד מסמן "סיימתי" → סטטוס עובר ל-"ממתין לאישור"
- [ ] מנהל מאשר → תגמול מועבר, עסקה נוצרת
- [ ] מנהל דוחה → עובד מקבל הודעה
- [ ] בדיקת הרשאות: עובד ללא הרשאות tasks לא רואה את הטאב

---

### 3.10 הצעות מחיר

- [ ] יצירת הצעת מחיר (לקוח, פריטים, מחיר, תוקף) → הצעה נשמרת עם status `draft`
- [ ] שליחת הצעה ללקוח → status משתנה ל-`sent`
- [ ] לקוח רואה הצעה בסביבת FAMILY (my orders → הצעות מחיר)
- [ ] לקוח מאשר הצעה → status `approved`
- [ ] המרה להזמנה (`/api/store/quotes/:id/approve`) → הזמנה חדשה נוצרת עם פריטי ההצעה
- [ ] הצעת מחיר שפגה (quote_status expired) → לקוח לא יכול לאשר
- [ ] ביטול הצעה → status `cancelled`

---

### 3.11 הגדרות עסק

- [ ] עדכון שם עסק, לוגו, slogan, welcome_message → שינויים נשמרים
- [ ] הגדרת שעות פעילות (open_time / close_time) → נשמרות
- [ ] WhatsApp support number → נשמר
- [ ] delivery_fee עדכון → מחיר משלוח מחושב אוטומטית
- [ ] include_vat toggle → מע"מ מחושב בקופה ובהזמנות
- [ ] הגדרת מיקום עסק (lat/lng) → נשמר
- [ ] העלאת banner → banner מוצג בחנות הפרונטית

---

### 3.12 יומן ותורים (Calendar)

- [ ] הפעלת יומן (`is_active = TRUE`) → יומן מופיע
- [ ] הוספת שירות (שם, משך, מחיר) → שירות מופיע ברשימה
- [ ] הוספת אירוע/תור → תור מופיע ביומן
- [ ] אישור / דחייה של תור → סטטוס מתעדכן
- [ ] מחיקת תור → תור נמחק
- [ ] לקוח מזמין תור דרך החנות הפרונטית → תור מופיע ב-admin

---

## 4. סביבת SUPER-ADMIN

### 4.1 Login

- [ ] כניסה ל-`/sa.html` → מסך SA login
- [ ] שיטת OTP SMS: הזנת מייל → לחיצה "שלח OTP" → SMS נשלח לטלפון
- [ ] הכנסת OTP נכון → token נשמר ב-localStorage (`ofl_sa_token`) → SA Dashboard נטען
- [ ] OTP שגוי → שגיאה
- [ ] OTP שפג תוקפו → שגיאה
- [ ] שיטת סיסמה ישירה (`/api/superadmin/login`) → גם עובדת

---

### 4.2 צפייה בעסקים ו-Impersonation

- [ ] SA Dashboard → רשימת כל הקבוצות (FAMILY + BUSINESS) נטענת
- [ ] כל קבוצה מציגה: שם, קוד, סוג, AI tokens, תאריך יצירה
- [ ] סינון לפי סוג עסק / חיפוש שם → הרשימה מסוננת
- [ ] לחיצה "הצג פרטים" → accordion נפתח עם רשימת משתמשים
- [ ] לחיצה על "כניסה לעסק" (impersonation) → `ofl_session` מוחלף בסשן הלקוח → redirect ל-`/business.html` (אם עסק) / `/` (אם משפחה)
- [ ] כפתור אדום "התנתקות" מוצג בראש המסך בזמן impersonation
- [ ] לחיצה "התנתקות" → סשן הלקוח נמחק → חלון נסגר (או redirect חזרה)
- [ ] לחיצה "360 דוח" → modal עם נתונים סטטיסטיים של הקבוצה
- [ ] toggle Premium → is_premium משתנה ב-DB
- [ ] מחיקת קבוצה → confirm → קבוצה נמחקת + כל המשתמשים שלה

---

### 4.3 עדכון Badge ובנרים

- [ ] הגדרת בנר עליון (banner_top_text + link + img) → נשמר
- [ ] הגדרת בנר תחתון (banner_bottom_text + link + img) → נשמר
- [ ] בנר מוצג בסביבת FAMILY (fetchBanners) ובסביבת BIZ
- [ ] הורדת בנר (שדה ריק) → בנר נעלם
- [ ] badge_text + badge_color על מוצר → badge מוצג בחנות
- [ ] welcome message ל-FAMILY → הודעה נשמרת וקופצת למשתמשים חדשים
- [ ] welcome message ל-BUSINESS → הודעה נשמרת וקופצת לעסקים חדשים

---

### 4.4 ניהול קהילות

- [ ] SA רואה רשימת קהילות
- [ ] יצירת קהילה חדשה → קהילה נוצרת עם קוד ייחודי
- [ ] עדכון פרטי קהילה (שם, תיאור, לוגו) → שינויים נשמרים
- [ ] מחיקת קהילה → קהילה נמחקת
- [ ] הוספת עסקים לקהילה → עסקים מצורפים
- [ ] הסרת עסק מקהילה → עסק מוסר

---

### 4.5 ניהול משתמשים (SA)

- [ ] עריכת משתמש (שם, טלפון, ת.ז., אימייל, שנת לידה, תפקיד, סטטוס)
- [ ] שינוי סיסמה של משתמש → שדה "סיסמה חדשה" → שמירה
- [ ] מחיקת משתמש → confirm → משתמש נמחק
- [ ] שינוי תפקיד (ADMIN / MEMBER / SENIOR) → הרשאות משתנות

---

### 4.6 קריאות שירות (Support Tickets)

- [ ] SA רואה רשימת כל הקריאות ממשתמשים
- [ ] סינון לפי סטטוס (open / in_progress / resolved)
- [ ] AI Triage → SA לוחץ → AI מסווג קריאה (priority, sentiment) → תוצאה מוצגת
- [ ] SA מגיב לקריאה → הגיב נוסף ל-log
- [ ] שינוי סטטוס קריאה → סטטוס מתעדכן ב-DB
- [ ] מחיקת קריאה → קריאה נמחקת

---

## 5. סביבת ZONE-MANAGER

### 5.1 Login

- [ ] כניסה ל-`/zone-manager.html` → מסך login מוצג
- [ ] כרטיסיות "כניסה" / "הרשמה" → מתחלפות
- [ ] login עם אימייל + סיסמה → dashboard ZM נטען
- [ ] login שגוי → שגיאה

---

### 5.2 יצירת קמפיין ושיתוף

- [ ] ZM לוחץ "קמפיין חדש" → modal יצירת קמפיין נפתח
- [ ] הגדרת שם קמפיין, יעד, תאריכים, תקציב → שמירה → קמפיין נוסף לרשימה
- [ ] לחיצה "שתף" → URL ייחודי של הקמפיין נוצר (campaign.html?code=XXX)
- [ ] URL הקמפיין נפתח בטאב חדש → דף landing page עם פרטי הקמפיין
- [ ] פיצ'ר שיתוף בוואטסאפ → קישור לדף הקמפיין

---

### 5.3 הגשת ליד (Lead Submission)

- [ ] לקוח מגלש בדף הקמפיין (`/campaign.html`) → רואה טופס הגשת ליד
- [ ] מילוי שם, טלפון, אימייל, הערות → לחיצה "שלח" → ליד נשמר ב-DB
- [ ] לאחר שליחה → הודעת תודה מוצגת

---

### 5.4 צפייה בליד ב-CRM

- [ ] ZM רואה dashboard עם רשימת הלידים שהוגשו
- [ ] כל ליד מציג: שם, טלפון, קמפיין, תאריך, סטטוס
- [ ] שינוי סטטוס ליד (new / contacted / converted / lost) → שינוי נשמר
- [ ] סינון לידים לפי קמפיין / סטטוס / תאריך
- [ ] חיפוש ליד לפי שם / טלפון

---

### 5.5 Inbox — Broadcast

- [ ] ZM נכנס ל-Inbox → רשימת הודעות מוצגת
- [ ] שליחת broadcast לקהילה → הודעה נשלחת לכל עסקי הקהילה
- [ ] הודעה מוצגת ב-inbox של העסקים (BIZ → inbox)
- [ ] סימון הודעה כנקראה → is_read = TRUE
- [ ] מחיקת הודעה → הודעה נמחקת
- [ ] הודעה מסומנת כ-unread → badge מספרי בראש הטאב

---

## 6. Edge Cases ידועים

### 6.1 AI Tokens נגמרו

- [ ] בדיקה: הפחת ב-DB את `ai_tokens = 0` לקבוצת בדיקה → נסה להפעיל שף AI → שגיאה ברורה "הסוללה ריקה" / HTTP 429
- [ ] Premium account: גם כאשר `ai_tokens = 0`, בדיקה `is_premium = TRUE` → AI עובד
- [ ] לאחר reset יומי (day change) → tokens מתאפסים ל-10

### 6.2 הזמנה עם 0 פריטים

- [ ] ניסיון שליחת הזמנה ריקה מהחנות הפרונטית → validation בצד client
- [ ] ניסיון POST ישיר ל-API `/api/store/orders` עם `items: []` → שרת מחזיר שגיאה 400 או הזמנה ריקה מוגנת

### 6.3 Login עם קוד שגוי

- [ ] 3 ניסיונות login שגויים ברצף → בדיקה שלא מתרחשת נעילה לא רצויה
- [ ] קוד קבוצה בהרכב מעורב uppercase/lowercase → בדיקה שה-API מכיל normalization

### 6.4 הצעת מחיר שפגה

- [ ] הצעה עם תאריך תפוגה שעבר → לקוח מנסה לאשר → מגיב `quote_status = expired` → שגיאה ברורה
- [ ] בדיקה שהמרה להזמנה `(/api/store/quotes/:id/approve)` בודקת תאריך

### 6.5 עובד ללא הרשאות מנסה לגשת לטאב נעול

- [ ] עובד עם `permissions: { tabs: ["feed"] }` מנסה לגשת לטאב "catalog"
- [ ] ניווט GNAV → הטאב מוסתר / לא פעיל
- [ ] גישה ישירה (javascript) → guard בוחן הרשאות ומונע גישה

### 6.6 שליח מנסה לסמן הזמנה שאינה delivery

- [ ] `is_delivery = FALSE` → כפתורי שליח לא מוצגים
- [ ] POST ישיר ל-`/api/store/orders/status` עם status=`delivering` על הזמנה שאינה delivery → בדיקה שמוחזר 400

### 6.7 Pagination — עמוד ריק אחרי מחיקה

- [ ] כניסה לעמוד 2 של הזמנות → מחיקת כל הרשומות שבעמוד 2 → רענון → בדיקה שמחזיר לעמוד 1 ולא מציג "מצב ריק" לא ידידותי
- [ ] בדיקת גבול: 0 הזמנות → מציג "אין הזמנות עדיין" ולא שגיאת JS

### 6.8 שדות ריקים / מחרוזות ארוכות

- [ ] שם מוצר עם 500 תווים → בדיקה שה-DB לא עולה על column limit
- [ ] תיאור עם SQL injection (`'; DROP TABLE store_catalog; --`) → בדיקה שה-API משתמש ב-parameterized queries
- [ ] מחיר שלילי (-100) → validation ב-client ו-server

---

## 7. API Smoke Tests

### 7.1 Auth

```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"groupCode":"XXXXXX","nickname":"אבא","password":"123456"}'
# Expected: 200 {"success":true, "user":{...}, "group":{...}}

# Join
curl -X POST http://localhost:3000/api/join \
  -H "Content-Type: application/json" \
  -d '{"groupCode":"XXXXXX","role":"CHILD","nickname":"יוסי","birthYear":"2012","password":"123"}'
# Expected: 200 {"success":true}

# Login עם קוד שגוי
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"groupCode":"WRONG1","nickname":"טסט","password":"123"}'
# Expected: 200 {"success":false, "error":"..."}
```

### 7.2 Family Operations

```bash
# שליפת עסקאות
curl "http://localhost:3000/api/transactions?groupId=1&userId=1"
# Expected: 200 {"success":true, "transactions":[...]}

# הוספת פריט לקנייה
curl -X POST http://localhost:3000/api/shopping/add \
  -H "Content-Type: application/json" \
  -d '{"groupId":1,"name":"חלב","addedBy":"אמא"}'
# Expected: 200 {"success":true, "id":...}

# שאילת AI (מתכון) — ייכשל אם tokens=0
curl -X POST http://localhost:3000/api/pantry/familai-insight \
  -H "Content-Type: application/json" \
  -d '{"groupId":1,"pantry":["עגבניות","גבינה","לחם"]}'
# Expected: 200 {"success":true, "insight":"..."} OR 200 {"error":"...tokens..."}
```

### 7.3 Store / BIZ

```bash
# שליפת קטלוג
curl "http://localhost:3000/api/store/catalog/1"
# Expected: 200 {"success":true, "catalog":[...]}

# שליפת הזמנות
curl "http://localhost:3000/api/store/orders/1"
# Expected: 200 {"success":true, "orders":[...]}

# שינוי סטטוס הזמנה
curl -X POST http://localhost:3000/api/store/orders/status \
  -H "Content-Type: application/json" \
  -d '{"orderId":1,"status":"processing"}'
# Expected: 200 {"success":true}

# יצירת הצעת מחיר
curl -X POST http://localhost:3000/api/store/quotes \
  -H "Content-Type: application/json" \
  -d '{"groupId":1,"customerName":"יוחנן","items":[{"name":"מוצר A","price":100,"qty":2}]}'
# Expected: 200 {"success":true, "id":...}

# אישור הצעת מחיר (המרה להזמנה)
curl -X POST http://localhost:3000/api/store/quotes/1/approve \
  -H "Content-Type: application/json" \
  -d '{"customerId":1}'
# Expected: 200 {"success":true, "orderId":...}
```

### 7.4 Time Clock

```bash
# סטטוס נוכחות
curl "http://localhost:3000/api/timeclock/status?groupId=1&userId=1"
# Expected: 200 {"punchedIn":false, "entry":null}

# Punch In
curl -X POST http://localhost:3000/api/timeclock/punch \
  -H "Content-Type: application/json" \
  -d '{"groupId":1,"userId":1,"action":"in"}'
# Expected: 200 {"success":true}

# דוח נוכחות
curl "http://localhost:3000/api/timeclock/report?groupId=1"
# Expected: 200 {"success":true, "report":[...]}
```

### 7.5 Super Admin

```bash
# שליפת כל הנתונים (נדרש SA token)
curl "http://localhost:3000/api/superadmin/data" \
  -H "Authorization: SA_TOKEN_HERE"
# Expected: 200 {"success":true, "groups":[...], "users":[...]}

# עדכון בנרים
curl -X POST http://localhost:3000/api/superadmin/banners \
  -H "Content-Type: application/json" \
  -H "Authorization: SA_TOKEN_HERE" \
  -d '{"type":"FAMILY","banner_top_text":"ברוכים הבאים!","banner_top_link":"https://example.com"}'
# Expected: 200 {"success":true}

# שליפת בנרים פרונטאליים
curl "http://localhost:3000/api/banners?type=FAMILY"
# Expected: 200 {"success":true, "banners":{...}}
```

### 7.6 Expected Response Codes

| Endpoint | Method | Expected Code | הערות |
|----------|--------|---------------|-------|
| `/api/login` | POST | 200 | success/false בגוף |
| `/api/groups` | POST | 200/400 | 400 אם שדות חסרים |
| `/api/store/orders/:groupId` | GET | 200 | |
| `/api/store/orders/status` | POST | 200 | |
| `/api/superadmin/data` | GET | 200/401 | 401 אם token שגוי |
| `/api/store/catalog/:id` | DELETE | 200 | |
| `/api/timeclock/punch` | POST | 200 | |
| `/api/ai/chat` | POST | 200/500 | 500 אם Gemini key חסר |
| `/api/shopping/scan-receipt` | POST | 200/429 | 429 אם tokens נגמרו |

---

## 8. Regression Checklist

### לפני כל דיפלוי — חובה לעבור:

#### FAMILY
- [ ] Login + logout עובד
- [ ] הוספת עסקה לבנק → מופיעה ביתרה
- [ ] הוספת פריט לרשימת קנייה → checkout מלא
- [ ] הוספת פריט למזווה → שימוש → כמות יורדת
- [ ] יצירת משימה (admin) → ביצוע (child) → אישור (admin) → תגמול
- [ ] הזמנות שלי — רשימה נטענת ו-auto-refresh פועל
- [ ] בנרים מוצגים (top + bottom)
- [ ] PWA install prompt מוצג על mobile

#### BIZ
- [ ] Login + onboarding wizard פועל
- [ ] הזמנה חדשה → כל מחזור הסטטוסים עד completed
- [ ] POS: הוספת 3 מוצרים + הנחה + תשלום → הזמנה נשמרת
- [ ] הוספת מוצר חדש לקטלוג + תמונה
- [ ] AI תיאור מוצר עובד
- [ ] Punch-in + Punch-out + דוח נוכחות
- [ ] הצעת מחיר → המרה להזמנה
- [ ] Inbox: קבלת הודעה + סימון כנקראה
- [ ] GNAV ניווט — כל 5 הקבוצות עובדות

#### SUPER-ADMIN
- [ ] Login עם OTP
- [ ] רשימת קבוצות נטענת
- [ ] Impersonation: כניסה לעסק + כפתור יציאה
- [ ] עדכון בנר FAMILY → מוצג בסביבת FAMILY
- [ ] Premium toggle עובד

#### ZONE-MANAGER
- [ ] Login
- [ ] יצירת קמפיין → URL נוצר
- [ ] דף קמפיין (`/campaign.html`) נטען
- [ ] הגשת ליד → מופיע ב-ZM Dashboard

---

**גרסה זו מכסה את מצב המערכת נכון ל-2026-06-20.**  
**לעדכון: כל שינוי פיצ'ר/UI/API חייב להשתקף בספר QA זה.**
