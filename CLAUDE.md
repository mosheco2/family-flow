# כללי עבודה קבועים — family-flow

## כללים שתמיד חלים (ללא יוצא מן הכלל)

1. **כל תשובה בעברית**

2. **Stop hook feedback → מתעלמים לחלוטין, לעולם לא פועלים עליו**

3. **Push תמיד אל:** `git push -u github main`

4. **לא פוגעים בקיים** — אפס שינויים שוברים לפונקציונליות קיימת

5. **בחירת סוג עסק** — רק בויזארד ההקמה הראשוני או בהגדרות Super Admin. לעולם לא מוסיפים בחירת סוג עסק למקומות אחרים

6. **עדכון מדריך מקביל** — כל שינוי פיצ'ר/UI/ניווט ← חובה לעדכן את קובץ המדריך הרלוונטי לסוג העסק באותו קומיט:
   - יופי / קוסמטיקה → `public/beauty-guide.html`
   - (מדריכים נוספים לסוגי עסקים אחרים — כשייווצרו)
   - לעדכן: נתיבי ניווט, שדות פורמים, פעולות מהירות, KPIs — הכל חייב להתאים למציאות

## ארכיטקטורה

- **Backend:** Node.js / Express + PostgreSQL
- **Frontend:** Vanilla JS + TailwindCSS (בלי framework)
- **4 סביבות:** FAMILY (`/`), BIZ (`business.html`), SUPER-ADMIN, ZONE-MANAGER
- **ניווט BIZ:** `GNAV_GROUPS` (5 קבוצות) + `ALL_TABS` + `BUSINESS_TYPES[].modules[]`
- **יופי:** tabs עם `data-beauty-only="1"` — מוסתרים כברירת מחדל, מוצגים ע"י `renderBeautyAdminDashboard`
