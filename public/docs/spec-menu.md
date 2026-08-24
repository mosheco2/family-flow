# אפיון תפריט דיגיטלי — Menu Builder
מסמך אפיון · OneFlow Life · עודכן 24.08.2026

---

## סקירה כללית

`menu.html` — דף ציבורי להרכבת תפריט אירוע/חתונה/קייטרינג. תומך ב-2 מצבים: **wizard תבנית** (הרכבה שלב אחר שלב) ו-**קטלוג חופשי** (בחירה חופשית + עגלה). בסיום הלקוח ממלא פרטים ומגיש פנייה לעסק.

---

## ארכיטקטורה

- **API:** `/api/menu/public/<slug>`
- **גופנים:** Frank Ruhl Libre (serif), Assistant
- **פלטת צבעים:** בורדו `#6B2434`, חול `#FBF7EF`, חום כהה `#241E19`
- **Routing:** client-side, ללא URL changes

---

## State Variables

```javascript
let _d = null;         // template data מה-API
let _mode = null;      // null=landing | 'template' | 'catalog'
let _step = 0;         // שלב נוכחי בwizard
let _sel = {};         // { sectionId: [itemId, ...] } — בחירות
let _form = {};        // ערכי טופס יצירת קשר
let _catItems = [];    // פריטי קטלוג
let _cart = {};        // catalogItemId → qty
let _catFilter = '';   // חיפוש טקסטואלי
let _catCategory = ''; // פילטר קטגוריה
let _catView = 'browse' | 'form' | 'done'
```

---

## Boot / טעינה

1. slug מה-URL path: `/menu/<slug>`
2. `GET /api/menu/public/<slug>` — נתוני התפריט
3. אם `?from=<slug>` → שם תפריט קודם לכפתור "חזרה"
4. אם `?pdf=1` → `exportMenuPDF()` אוטומטי
5. אם `?wa=1` → `exportAndShareWa()` אוטומטי

---

## Router (`render()`)

| `_mode` | פעולה |
|---|---|
| `null` | `renderLanding()` |
| `'catalog'` | `renderCatalogFlow()` |
| `'template'` + שלב רגיל | `renderStep(N)` |
| `'template'` + סיכום | `renderSummary()` |
| `'template'` + טופס | `renderForm()` |
| `'template'` + סיום | `renderDone()` |

---

## Landing (`renderLanding()`)

- `GET /api/menu/public/<slug>/related` — תפריטים קשורים של אותו עסק
- כרטיסיות: תפריטים קשורים + "בנה תפריט חופשי מהקטלוג"
- אם `!show_related_options` → skip landing, קפיצה ישירה

---

## Template Wizard — `renderStep(idx)`

### מבנה שלב

| אלמנט | תפקיד |
|---|---|
| שם קטגוריה | כותרת השלב |
| תיאור | הסבר |
| badge | חובה/אופציונלי, כמה לבחור |
| כרטיסיות מנות | תמונה, שם, תיאור, אלרגנים, מחיר |

### פונקציות

| פונקציה | תיאור |
|---|---|
| `toggleItem(secId, itemId, isMulti, maxChoices)` | בחירה/ביטול פריט (single/multi) |
| `nextStep(secId, minChoices, maxChoices, isRequired)` | ולידציה + מעבר קדימה |
| `goToStep(idx)` | קפיצה לשלב ספציפי |
| `goBack()` | חזרה לשלב קודם |
| `progressHtml(activeIdx)` | progress bar עם dots |

---

## Template Wizard — `renderSummary()`

- טבלת כל הבחירות לפי קטגוריה
- כפתורי "שינוי" לכל קטגוריה
- חישוב סה"כ (`calcTotal()`)
- כפתור "המשך למילוי פרטים" → `renderForm()`

---

## Template Wizard — `renderForm()`

| שדה | חובה | תיאור |
|---|---|---|
| `#f-name` | ✅ | שם מלא |
| `#f-phone` | ✅ | טלפון |
| `#f-email` | ❌ | אימייל |
| `#f-date` | ❌ | תאריך האירוע |
| `#f-guests` | ❌ | מספר מוזמנים |
| `#f-notes` | ❌ | הערות חופשיות |

**שליחה:** `submitForm()` → `POST /api/menu/public/<slug>/request`

---

## Template Wizard — `renderDone()`

- אישור עם מספר פנייה
- כפתור "הורד PDF"

---

## Catalog Builder — `startCatalogMode()`

`GET /api/menu/public/<slug>/catalog`

### `renderCatalogBrowse()`

| אלמנט | תפקיד |
|---|---|
| input חיפוש | סינון לפי שם/תיאור (`_catFilter`) |
| chips קטגוריות | `_catCategory` |
| כרטיסיות פריטים | תמונה, שם, מחיר, + / − כמות |
| `catChangeQty(id, delta)` | עדכון עגלה |
| cart footer | count + מחיר + "המשך לפרטים" |

### `renderCatalogForm()`

אותם שדות כמו `renderForm()` + סיכום עגלה

**שליחה:** `submitCatalogForm()` → `POST /api/menu/public/<slug>/catalog-request`

```json
{
  "customer_name": "ישראל ישראלי",
  "customer_phone": "0501234567",
  "customer_email": "email@example.com",
  "event_date": "2026-12-25",
  "guest_count": 150,
  "custom_notes": "ללא גלוטן",
  "cart_items": [
    {"catalog_item_id": "item_1", "name": "סלט ירקות", "price": 25, "qty": 10}
  ]
}
```

### `renderCatalogDone()`

- מספר פנייה
- פרטי יצירת קשר

---

## חישוב מחירים (`calcTotal()`)

| `pricing_mode` | לוגיקה |
|---|---|
| `per_person` | base_price + תוספות לפי בחירה |
| `per_item` | sum של מחירי כל הפריטים × כמות |

---

## PDF Export

14 פלטות צבע זמינות:
`bordeaux`, `olive`, `charcoal`, `indigo`, `rose`, `forest`, `saffron`, `slate`, `terracotta`, `plum`, `teal`, `noir`, `copper`, `sage`

3 הגדרות עיצוב:
- `plating`: `square` / `circle` / `large` / `none`
- `airiness`: `1` / `2` / `3`

URL params: `?palette=bordeaux&plating=circle&air=2`

**פונקציות:**
- `exportMenuPDF()` → `window.print()`
- `exportAndShareWa()` → `navigator.share` / wa.me link

---

## API Calls

| Method | Endpoint | תפקיד |
|---|---|---|
| GET | `/api/menu/public/<slug>` | נתוני תפריט |
| GET | `/api/menu/public/<slug>/related` | תפריטים קשורים |
| GET | `/api/menu/public/<slug>/catalog` | פריטי קטלוג |
| POST | `/api/menu/public/<slug>/request` | שליחת פנייה מwizard |
| POST | `/api/menu/public/<slug>/catalog-request` | שליחת פנייה מקטלוג |

---

## פונקציות עזר

| פונקציה | תפקיד |
|---|---|
| `esc(s)` | HTML escaping |
| `num(n)` | פורמט מספר עברי (`he-IL`) |
| `goToForm()` | מעבר לטופס פרטים |
| `startCatalogMode()` | הפעלת מצב קטלוג |
| `startTemplateMode()` | הפעלת מצב תבנית |
| `goToStep(idx)` | ניווט ישיר לשלב |
| `goBack()` | חזרה |
| `nextStep(...)` | קדימה עם ולידציה |
