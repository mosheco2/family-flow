# אפיון כל העם — פלטפורמת תוכן קהילתית
מסמך אפיון · OneFlow Life · עודכן 24.08.2026

---

## סקירה כללית

`kol-haam.html` + `kol-haam-app.js` — פלטפורמת תוכן קהילתית מובנית כ-iframe בתוך אפליקציית המשפחה. מאפשרת חברי קהילה ליצור, לפרסם ולצרוך תוכן ב-4 פורמטים. יש מנגנון אישורים דו-שלבי (ZM → SA).

---

## ארכיטקטורה

- **Embedding:** iframe בתוך `family.html`
- **API:** `/api/kol-haam`
- **Context:** URL params מה-iframe parent
- **הרשאות:** 3 רמות — member, zm, sa

---

## Context (URL Params)

```javascript
CTX = {
  userId,
  groupId,
  communityId,
  role,           // 'member' | 'zm' | 'sa'
  isZM,
  isSA,
  zmToken,        // token ל-ZM
  communityName
}
```

---

## Token Management

| תפקיד | שיטה |
|---|---|
| member | `localStorage.getItem('ofl_family_token')` |
| ZM | `CTX.zmToken` ב-header |
| SA | `'SA_SECRET_TOKEN_2026'` (header קבוע) |

---

## מסכים (Views)

| View ID | גישה | תפקיד |
|---|---|---|
| `view-feed` | כולם | פיד תוכן ראשי |
| `view-content` | כולם | צפייה בתוכן בודד |
| `view-editor` | כולם | יצירה/עריכת תוכן |
| `view-my-drafts` | כולם | הטיוטות שלי |
| `view-my-content` | כולם | כל התוכן שלי |
| `view-zm-queue` | zm, sa | תור אישור ZM |
| `view-sa-queue` | sa | תור אישור SA |

---

## State

```javascript
STATE = {
  view,           // view ID נוכחי
  prevView,       // view קודם (לחזרה)
  scope,          // 'local' | 'global'
  categoryId,     // קטגוריה נבחרת
  categories: [], // כל הקטגוריות
  editingItemId,  // ID תוכן בעריכה (null = חדש)
  tags: [],       // תגיות זמינות
  editorDirty,    // האם יש שינויים לא שמורים
  confirmResolve  // callback לדיאלוג אישור
}
```

---

## Header

| אלמנט | תפקיד |
|---|---|
| `.kh-logo` | "קול העם" + שם הקהילה |
| `.kh-btn-icon` | כפתורי פעולה (עריכה, דואר נכנס) |

---

## Scope Bar

| אלמנט | תפקיד |
|---|---|
| `.scope-btn[data-scope="local"]` | תוכן מקומי לקהילה |
| `.scope-btn[data-scope="global"]` | תוכן גלובלי לכל OneFlow |
| `#cat-scroll` | chips קטגוריות (גלילה אופקית) |
| `.cat-chip` | סינון לפי קטגוריה |

---

## סוגי תוכן

| סוג | צבע | תיאור |
|---|---|---|
| `ARTICLE` | כחול | מאמר רגיל |
| `QA_QUESTION` | ענבר | שאלה ותשובה |
| `SUCCESS_STORY` | ירוק | סיפור הצלחה |
| `WIKI_GUIDE` | סגול | מדריך ויקי |

---

## כרטיסיית פיד (Feed Card)

| אלמנט | תפקיד |
|---|---|
| תמונה/אמוג'י | תמונת כיסוי |
| type-badge | סוג התוכן + צבע |
| כותרת | שם התוכן |
| תקציר | תיאור קצר |
| `.pin-badge` | תוכן מוצמד ע"י ZM/SA |
| `.feed-card-footer` | views, likes, answers, timestamp |

---

## תצוגת תוכן בודד (`view-content`)

| אלמנט | תפקיד |
|---|---|
| `.content-back` | חזרה לפיד |
| `.content-cover` | תמונת כיסוי |
| `.content-category-label` | קטגוריה |
| `.content-title` | כותרת |
| `.content-subtitle` | תת-כותרת |
| `.content-byline` | מחבר, תאריך, קהילה |
| `.content-html` | גוף HTML עשיר |
| `.content-tags` | תגיות |
| `.series-nav` | ניווט בין פרקים בסדרה |
| `.engagement-bar` | לייק, share, save, תגובה |

---

## עורך תוכן (`view-editor`)

### שדות

| שדה | תיאור |
|---|---|
| `#ed-title` | כותרת |
| `#rte-body` (contenteditable) | גוף טקסט עשיר |
| `.field-select` | בחירת קטגוריה |
| `.type-cards` (2x2) | בחירת סוג תוכן |
| `.scope-toggle-row` | local / global |
| `.tags-input-wrap` | תגיות עם autocomplete |
| `#ed-cover-img` | העלאת תמונת כיסוי |

### Rich Text Editor Toolbar

כפתורים: **Bold**, *Italic*, H2, H3, רשימה, רשימה ממוספרת, ציטוט, קישור, ביטול, חזרה

### Autosave

- `_khAutoSaveTimer` — interval לשמירה אוטומטית
- `_khContentHash()` — hash של title + body לזיהוי שינויים
- `_khSetAutosaveStatus('saving' | 'saved' | 'unsaved')`
- `_khBeforeUnload` — אזהרה לפני יציאה עם שינויים לא שמורים

---

## סטטוסי תוכן

| סטטוס | צבע | תיאור |
|---|---|---|
| `DRAFT` | אפור | טיוטה פרטית |
| `PENDING_ZM` | ענבר | ממתין לאישור ZM |
| `PENDING_SA` | סגול | ממתין לאישור SA |
| `PUBLISHED_LOCAL` | ירוק | פורסם בקהילה המקומית |
| `PUBLISHED_GLOBAL` | כחול | פורסם בכל OneFlow |
| `REJECTED` | אדום | נדחה + `.rejection-note` |

---

## זרימת אישורים

```
DRAFT → שלח לאישור → PENDING_ZM
PENDING_ZM → ZM אישר → PENDING_SA (לגלובל) / PUBLISHED_LOCAL (למקומי)
PENDING_ZM → ZM דחה → REJECTED
PENDING_SA → SA אישר → PUBLISHED_GLOBAL
PENDING_SA → SA דחה → REJECTED
```

---

## תורי אישור

### ZM Queue (`view-zm-queue`)

| אלמנט | תפקיד |
|---|---|
| `.queue-card` | כרטיסיית פריט לאישור |
| `.queue-card-img` | תמונת כיסוי |
| `.queue-card-title` | כותרת |
| `.queue-card-meta` | מחבר, תאריך, קהילה |
| כפתור "אשר" | שינוי סטטוס → PENDING_SA / PUBLISHED_LOCAL |
| כפתור "דחה" | פתיחת `.reject-form` |
| `.reject-textarea` | הסבר הדחייה (חובה) |

### SA Queue (`view-sa-queue`)

זהה ל-ZM Queue אבל מאשר לPUBLISHED_GLOBAL.

---

## כותב מקצועי (`kol-haam-author.html`)

ממשק נפרד לכותבים מקצועיים — ניהול פרויקטים, עריכת תוכן ברמה מתקדמת.
קובץ נלווה: `kol-haam-author-app.js`

---

## API Calls

| Method | Endpoint | תפקיד |
|---|---|---|
| GET | `/api/kol-haam/feed` | פיד תוכן |
| GET | `/api/kol-haam/content/:id` | תוכן בודד |
| POST | `/api/kol-haam/content` | יצירת תוכן |
| PATCH | `/api/kol-haam/content/:id` | עריכת תוכן |
| POST | `/api/kol-haam/content/:id/submit` | שליחה לאישור |
| POST | `/api/kol-haam/content/:id/like` | לייק |
| GET | `/api/kol-haam/zm/queue` | תור ZM |
| POST | `/api/kol-haam/zm/approve/:id` | אישור ZM |
| POST | `/api/kol-haam/zm/reject/:id` | דחיית ZM |
| GET | `/api/kol-haam/sa/queue` | תור SA |
| POST | `/api/kol-haam/sa/approve/:id` | אישור SA |
| POST | `/api/kol-haam/sa/reject/:id` | דחיית SA |
| GET | `/api/kol-haam/categories` | קטגוריות |
| GET | `/api/kol-haam/tags` | תגיות |
