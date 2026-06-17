# מיפוי פעולות ניהול העסק (Business Management)

## 📊 טבלה מלאה: כל פעולות ניהול בעסק

| # | קטגוריה | פעולה | מיקום כרגע | הערות |
|---|---------|-------|----------|--------|
| **פרטי משתמש ופרופיל** ||||
| 1 | פרופיל | שם תצוגה (Nickname) | Profile Modal | שמור בלחיצה |
| 2 | פרופיל | שינוי סיסמה | Profile Modal | זקוק ל-סיסמה ישנה |
| 3 | פרופיל | מדריך למערכת | Profile Modal | לינק לקובץ HTML |
| 4 | פרופיל | הדרכה וסיור | Profile Modal | Onboarding tour |
| 5 | פרופיל | קריאת שירות | Profile Modal | טופס תמיכה |
| 6 | פרופיל | התנתקות | Profile Modal | Logout |
| 7 | פרופיל | שדרוג ל-PRO | Profile Modal | ADMIN בלבד |
| **מידע מסמכים והנכסים** ||||
| 8 | מסמכים | ח.פ / עוסק מורשה | Profile Modal | בתוך doc-settings-section |
| 9 | מסמכים | איש קשר לרכש | Profile Modal | בתוך doc-settings-section |
| **חנות ומכירות** ||||
| 10 | חנות | הפעלה/ביטול חנות | Sales Tab → Settings | Toggle checkbox |
| 11 | חנות | הודעת קבלה (Welcome msg) | Sales Tab → Settings | Textarea |
| 12 | חנות | סוג חנות | Sales Tab → Settings | Select dropdown |
| 13 | חנות | מינימום הזמנה | Sales Tab → Settings | input number |
| 14 | חנות | Slogan / תיאור | Sales Tab → Settings | text input |
| 15 | חנות | טלפון העסק | Sales Tab → Settings | tel input |
| 16 | חנות | וואטסאפ להזמנות | Sales Tab → Settings | tel input |
| 17 | חנות | שעת פתיחה | Sales Tab → Settings | time input |
| 18 | חנות | שעת סגירה | Sales Tab → Settings | time input |
| 19 | חנות | לוגו | Sales Tab → Settings | Image upload |
| 20 | חנות | רקע (Banner) | Sales Tab → Settings | Image upload |
| 21 | חנות | שמור הגדרות | Sales Tab → Settings | כפתור shades-800 |
| **קטלוג ומוצרים** ||||
| 22 | מוצרים | הוספת מוצר | Sales Tab → Catalog | ADMIN |
| 23 | מוצרים | עריכת מוצר | Sales Tab → Catalog | ADMIN |
| 24 | מוצרים | מחיקת מוצר | Sales Tab → Catalog | ADMIN |
| 25 | מוצרים | קופונים | Sales Tab → Coupons | ADMIN |
| 26 | מוצרים | מבצעים | Sales Tab → Promotions | ADMIN |
| **יומן ושולחנות (Restaurant)** ||||
| 27 | יומן | שירותים זמינים | Calendar Tab → Settings | Checkboxes |
| 28 | יומן | שדות מותאמים | Calendar Tab → Settings | Editable fields |
| 29 | יומן | שמור הגדרות | Calendar Tab → Settings | כפתור slate-800 |
| 30 | שולחנות | רשימת שולחנות | Admin Tables Panel | Tile `__tables__` ב-Feed |
| 31 | שולחנות | הזמנה לשולחן | Admin Tables Panel | Button בתוך Panel |
| 32 | שולחנות | קופה | Admin Tables Panel | Button לעבור ל-POS |
| **צוות וניהול** ||||
| 33 | צוות | הוספת עובד | Members Tab | ADMIN |
| 34 | צוות | עריכת נתוני עובד | Members Tab | ADMIN |
| 35 | צוות | שינוי תפקיד | Members Tab | openPermissionsModal |
| 36 | צוות | הגדרות שכר | Members Tab | openBankSettings |
| 37 | צוות | מחיקת עובד | Members Tab | ADMIN |
| 38 | צוות | שליחת credentials | Members Tab | "שלח פרטי כניסה" |
| 39 | צוות | אישור משתמש ממתין | Pending Users Panel | ADMIN |
| **הרשאות וסיווגים** ||||
| 40 | הרשאות | סיווג עובד | openPermissionsModal | ADMIN בלבד |
| 41 | הרשאות | הרשאות פונקציה | openPermissionsModal | ADMIN בלבד |
| **משמרות ונוכחות** ||||
| 42 | משמרות | יצירת משמרה | Shifts Tab | ADMIN |
| 43 | משמרות | עריכת משמרה | Shifts Tab | ADMIN |
| 44 | משמרות | דוח נוכחות | Timeclock Tab | Report |
| **כספים וביקורת** ||||
| 45 | כסף | שכר וסקור | Bank Tab | Monthly |
| 46 | כסף | הגדרות שכר עובד | openBankSettings | ADMIN |
| 47 | כסף | Payroll / Payday | Bank Tab | ADMIN |
| 48 | כסף | הלוואות | Bank Tab | ADMIN approval |
| 49 | כסף | יעדים וניהול | Bank Tab | בטיימינג |
| **ניהול טכני עסק** ||||
| 50 | טכני | Wizard (הקמה מחדש) | Profile Modal | "פתיחת אשף הקמה" |
| 51 | טכני | הגדרות עסק עמוק | Business Settings Modal | `openBusinessSettingsModal()` |
| 52 | טכני | מחיקת חשבון עסק | Business Settings Modal | Dangerous |

---

## 🔴 בעיות UX שמובחנות:

### **הבעיות הראשיות:**

1. **Profile Modal מעומעם מדי:**
   - 11 פעולות שונות בחלון אחד (שם, סיסמה, מדריך, תמיכה, מסמכים, שדרוג)
   - אין היררכיה ברורה
   - משתמש צריך לגלול הרבה

2. **Sales Settings (חנות):**
   - 12 setting כאן (טלפון, וואטסאפ, לוגו, שעות, וכו')
   - צריך scroll הרבה כדי להגיע ל"שמור"
   - כל שינוי דורש שמירה ידנית

3. **Calendar Settings (יומן):**
   - הגדרות שירות וקבוצות מותאמות באותו מקום
   - לא ברור איזה הגדרות משפיעות על מה

4. **Admin Tables Panel:**
   - בודד מהיתר (floating panel)
   - מעבר ל-POS דורש סגירת ה-panel

5. **Business Settings Modal:**
   - מופיע בפרופיל (וקשה לגישה)
   - לא ברור מה בתוכו

6. **צוות וניהול:**
   - הגדרות שכר בהרשאות
   - הרשאות בצוות
   - הודעה בדוקים פזורה

---

## 🎯 הצעה לסדר חדש:

### **דשבורד ניהול (Admin Dashboard):**
```
ניווט ראשי:
├── 🏠 ראשי (הקיים)
├── ⚙️ ניהול טכני
│   ├── 👤 פרטי משתמש
│   ├── 🏢 הגדרות עסק
│   ├── 👥 צוות וצוות הרשאות
│   └── 📄 מידע מסמכים
├── 🛍️ מכירות וחנות (הקיים)
│   ├── הזמנות
│   ├── הגדרות חנות
│   └── קטלוג
├── 📅 יומן וטבלאות (הקיים)
│   ├── יומן ציבורי
│   ├── הגדרות יומן
│   └── [Restaurant] שולחנות
└── ... (שאר התבים)
```

### **מה צריך להיות בכל סעיף:**

**⚙️ ניהול טכני** (New organized place):
- **👤 פרטי משתמש:** שם, סיסמה, תוכן (מדריך, תמיכה, תור)
- **🏢 הגדרות עסק:** Wizard, עמוקים (dangerous)
- **👥 צוות:** רשימה, הוספה, הרשאות, שכר (כל משהו בצוות)
- **📄 מסמכים:** ח.פ, איש קשר (יחד בסעיף)

**🛍️ מכירות וחנות** (Reorganize):
- הזמנות (קיים)
- **הגדרות חנות:** כל 12 settings + save ממוסד
- קטלוג (קיים)
- קופונים (קיים)
- מבצעים (קיים)

**📅 יומן וטבלאות** (Organize):
- יומן ציבורי (קיים)
- **הגדרות יומן:** שירותים + תנאים מותאמים בנפרד
- **[Restaurant] שולחנות:** לא floating, אלא Tab רגיל

---

## 📋 סיכום המלצות:

| סעיף | בעיה | פתרון |
|------|------|--------|
| Profile Modal | יותר מדי פעולות | פצל ל- "טכני" בניווט |
| Sales Settings | יותר מדי scrolling | Form ברור עם Save בקצה |
| Calendar Settings | מבולבל | חלק ל-2 חלקים: שירותים / תנאים |
| Permissions | מפוזרות | כל הרשאות בעמוד צוות |
| Bank Settings | בתוך Modal כקטן | Panel ברור כמו sales settings |

---

## 🎨 ממשק מוצע - Navigation:

```
[🏠 HOME] [👨‍💼 STAFF] [🛍️ SALES] [📅 CALENDAR] [💰 FINANCE] [⚙️ ADMIN]

ADMIN (dropdown):
├── 👤 Profile & User Settings
│   ├── Nickname
│   ├── Password
│   └── Guide & Support
├── 🏢 Business Setup
│   ├── Business Info
│   ├── Wizard
│   └── Danger Zone
├── 👥 Team Management
│   ├── Staff List
│   ├── Roles & Permissions
│   └── Salary Settings
└── 📄 Company Info
    ├── VAT / ID
    └── Documents
```

---

## ✅ קבוצות המשתמשים:

| Role | מה רואה? |
|------|----------|
| **ADMIN** | הכל |
| **Shift Manager** | צוות בירי, הזמנות (לא הגדרות) |
| **Cashier** | קופה בלבד |
| **Waiter** | שולחנות, הזמנות |
| **Regular User** | פיד, משימות, דוחות (קריאה בלבד) |
