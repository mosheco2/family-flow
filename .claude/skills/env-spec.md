# skill: env-spec
# סקיל לתיעוד סביבה טכנית — Oneflow Life
# גרסה: 1.0 | אוקטובר 2026

## מטרת הסקיל

יצירת קובץ MD טכני עמוק לכל אחת מ-4 סביבות המערכת:
- **FAMILY** → `docs/FAMILY_ENV_SPEC.md` ✅ (הושלם)
- **BIZ** → `docs/BIZ_ENV_SPEC.md`
- **SA (Super-Admin)** → `docs/SA_ENV_SPEC.md`
- **ZM (Zone-Manager)** → `docs/ZM_ENV_SPEC.md`

---

## תהליך עבודה — 5 שלבים

### שלב 1: קריאת קבצי המקור

**לכל סביבה, קרא:**

| סביבה | JS ראשי | HTML |
|---|---|---|
| FAMILY | `public/app.js` | `public/index.html` |
| BIZ | `public/business-app.js` | `public/business.html` |
| SA | `public/sa-app.js` | `public/sa.html` |
| ZM | `public/zm-app.js` | `public/zm.html` |

**ב-server.js:** חפש את ה-middleware הרלוונטי ואת ה-routes. דוגמאות:
- `verifyFamily` / `verifyBiz` / `verifySA` / `verifyZoneManager`
- Routes מקובצים לפי prefix: `/api/family/`, `/api/biz/`, `/api/sa/`, `/api/zm/`

**קריאה יעילה של קבצים ארוכים:**
```
Read(file, limit=300)              # מבנה כללי + imports
Read(file, offset=X, limit=500)    # קטע ספציפי לפי שם פונקציה
Grep("functionName", file)         # מציאת מיקום פונקציה
```

### שלב 2: מיפוי מלא לפני כתיבה

לפני כתיבת שורה אחת בקובץ הפלט, בנה רשימה פנימית:

```
□ כל ה-tabs / views בסביבה (שמות + order)
□ כל ה-globals / state variables
□ כל הפונקציות הראשיות (render* / fetch* / open* / submit*)
□ כל ה-API endpoints בשימוש (GET/POST/PUT/DELETE)
□ טבלות DB מעורבות
□ הבדלי תפקידים (Role-based behavior)
□ מנגנונים מיוחדים (polling, AI, PWA, etc.)
□ אינטגרציות חיצוניות (Twilio, Cloudinary, WhatsApp, Gemini)
```

### שלב 3: מבנה קובץ הפלט

**תמיד פתח עם:**
```markdown
# סביבת [NAME] — מפרט טכני מלא
**Oneflow Life · מנתח מערכות · עומק מקסימלי**
גרסה: [חודש שנה]

---
## תוכן עניינים
[numbered anchors]
```

**סעיפי חובה (בסדר הזה):**

1. **זהות הסביבה** — טבלה: URL, JS ראשי, מטרה, קהל יעד, API constant
2. **כניסה ואוטנטיקציה** — כל שיטות הכניסה, JWT storage, failsafes
3. **תפקידי משתמש** — כל תפקיד + טבלת הבדלים ויזואליים
4. **מבנה הניווט** — tabs/views מלאים + לוגיקת switchTab/switchView
5. **[Tab/View 1]** — תיאור מלא כולל פעולות + API endpoints
6. **[Tab/View 2..N]** — אחד לכל tab/view
7. **ארנקות / מטבעות** — אם רלוונטי
8. **AI Features** — כל ה-AI endpoints + הקשר
9. **PWA ונגישות** — אם רלוונטי
10. **מנגנונים טכניים רוחביים** — polling, toast, loader, sanitize, Cloudinary utils

**סיים תמיד עם:**
```markdown
*מסמך זה מתאר את סביבת [NAME] בלבד. מסמכים מקבילים: ...*
```

### שלב 4: עומק הכתיבה לכל סעיף

לכל **Tab / View** כתוב:
- **תיאור** — שורה אחת מה התפקיד
- **נתונים** — מה נטען ומאיפה (API endpoint + response structure)
- **פעולות** — טבלה: שם פעולה | API endpoint | שדות שנשלחים
- **מחזור חיים** — status flow (אם קיים)
- **Role differences** — מה כל תפקיד רואה / יכול לעשות
- **מנגנונים מיוחדים** — polling, AI, uploads, modals, accordions
- **קטעי קוד** — רק כשמדגימים לוגיקה שאינה מובנת מהשם

**פורמט API endpoint:**
```markdown
```javascript
submitXYZ()   // POST /api/path/endpoint { field1, field2 }
fetchXYZ()    // GET /api/path/endpoint?param=X
```
```

**פורמט פעולות (טבלה):**
```markdown
| פעולה | API | שדות |
|---|---|---|
| שם פעולה | POST /api/... | field1, field2 |
```

**פורמט Status Flow:**
```markdown
`draft` → `pending` → `active` → `completed`
```

### שלב 5: לאחר כתיבת הקובץ

1. **commit + push לפי כללי CLAUDE.md:**
   ```bash
   git add docs/[ENV]_ENV_SPEC.md
   git commit -m "docs: add [ENV] environment technical spec"
   git push -u github main
   ```

2. **עדכן את הרשימה** בתחילת הסקיל (✅ שהושלם)

---

## כללים איכותיים

### מה לכלול תמיד:
- מספרי שורות בקוד המקור (כשניתן) — `renderXYZ (line 1234)`
- שמות משתנים גלובליים + טיפוס משוער
- הבדלי תפקידים גם כשנראים קטנים
- מנגנוני שגיאה וedge cases

### מה לא לכלול:
- קוד CSS / styling (אינו רלוונטי לניתוח מערכות)
- תוכן דמה / Lorem ipsum
- ניחושים — רק מה שנראה ישירות בקוד
- הסברים מיותרים של JS בסיסי

### טון:
- עברית תקנית
- מינוח טכני מדויק
- שמות פונקציות ב-code format: `functionName()`
- שמות endpoint בקוד: `/api/path/endpoint`
- שמות טבלה ב-code: `table_name`

---

## מצב עכשווי

| סביבה | קובץ | סטטוס |
|---|---|---|
| FAMILY | `docs/FAMILY_ENV_SPEC.md` | ✅ הושלם |
| BIZ | `docs/BIZ_ENV_SPEC.md` | ⏳ ממתין |
| SA | `docs/SA_ENV_SPEC.md` | ⏳ ממתין |
| ZM | `docs/ZM_ENV_SPEC.md` | ⏳ ממתין |

---

## נקודות עיון לפני תחילת כל סביבה

**BIZ — שאלות ייחודיות:**
- `GNAV_GROUPS` (5 קבוצות) ← כיצד מגדירים tabs לפי קבוצה
- `ALL_TABS` (50 tabs) ← מיפוי לפי תפקיד (`ROLE_DEFAULTS`)
- `BUSINESS_TYPES` (15 סוגים) ← כיצד משפיע על הממשק
- `isFeatureLicensed()` ← מנגנון נעילת מודולים
- `checkImpersonationMode()` ← SA מתחזה לעסק

**SA — שאלות ייחודיות:**
- `applyUserPermissions()` ← RBAC array עם 9 הרשאות
- `tabRequirements` ← מה נדרש לכל tab
- `renderSAInsights()` ← KPIs + clickable chips
- `renderLivePulse()` ← live activity feed

**ZM — שאלות ייחודיות:**
- `verifyZoneManager` ← הגדרת middleware (line 6495)
- יחסי ZM ↔ communities ↔ businesses
- zone_managers table structure
- `manager_password` plaintext issue
