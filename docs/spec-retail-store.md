# מסמך אפיון — חנות קמעונאית מלאה (Retail) | WEFLOWZ

> גרסה: 2026-10-06 | מסמך אפיון בלבד — טרם אושר ליישום | מבוסס על סקירת קוד קיים: `server.js`, `public/business-app.js`, `public/storefront*.html`

---

## 1. רקע ומטרה

המערכת תומכת כיום בעסקים מבוססי-הזמנה/הכנה (מסעדה, בית קפה, יופי, שירותים). המטרה: לאפשר **לכל סוג חנות קמעונאית** — מזון ארוז, מכולת, ביגוד והנעלה, טקסטיל, צעצועים, אלקטרוניקה, ספרים, מתנות וכו' — לנהל את העסק שלה במערכת ברמת עומק מלאה: קטלוג עשיר עם וריאציות, מלאי מדויק, קופה (POS) מותאמת, ברקודים, ספקים והזמנות רכש, דוחות, החזרות/החלפות, ומבצעים.

**ממצא מפתח מהסקירה:** יש כבר תשתית בסיס עובדת — סוגי עסק `retail`/`store_only` מוגדרים, `store_catalog` עם `stock_quantity`/`reserved_qty`/`sku`, וקיזוז מלאי אוטומטי בהזמנה. **זהו אפיון להרחבה על גבי קיים, לא בנייה מאפס.**

**עיקרון מנחה (CLAUDE.md):** לא פוגעים בקיים — restaurant/cafe/beauty וכו' ממשיכים לעבוד בדיוק כפי שהם; כל שדה/טבלה חדשים הם תוספתיים (nullable / ברירת מחדל שקופה) ולא דורשים מהעסקים האחרים לשנות התנהגות.

---

## 2. מיפוי פערים מול המצב הקיים (תקציר)

| תחום | קיים היום | חסר |
|---|---|---|
| סוג עסק | `retail`, `store_only` מוגדרים ב-BUSINESS_TYPES | חיבור ל-storefront ייעודי, מודולי מלאי עשירים |
| קטלוג מוצר | `store_catalog`: name, price, category, stock_quantity, reserved_qty, sku, options_text | וריאציות (מידה/צבע) עם SKU+מלאי נפרד, ברקוד, יחידת מידה/משקל, מק"ט ספק |
| מלאי | קיזוז/החזרה אוטומטיים ברמת שורת-קטלוג | ניהול ברמת וריאציה, רף מלאי נמוך+התראות, ספירת מלאי (inventory count), תנועות מלאי (log) |
| קנייה/POS | pos/sales/shop מודולים קיימים (לא נבדק עומק UI קמעונאי) | סריקת ברקוד, החזרות/זיכויים, מכירה לפי משקל |
| ספקים | — | טבלת ספקים, הזמנות רכש, קבלת סחורה שמעדכנת מלאי |
| מבצעים | `original_price` בודד לכל מוצר | מבצעי כמות (2 ב-X), קופוני הנחה כלל-חנותיים, הנחות לפי קטגוריה |
| דוחות | reports module כללי | דוח מלאי/תנועות, דוח מוצרים חמים/קרים, רווחיות למוצר (עלות מול מכירה) |
| storefront | `storefront-market.html` קרוב אך לא מחובר | סינון לפי מידה/צבע, בורר וריאציה בכרטיס מוצר |

---

## 3. מודל נתונים מוצע

### 3.1 `store_catalog` — הרחבות (תוספתי, ללא שינוי התנהגות קיימת)

| עמודה חדשה | טיפוס | הערה |
|---|---|---|
| `barcode` | VARCHAR(50) | ברקוד (EAN-13/UPC/פנימי); אינדקס ייחודי per group_id |
| `unit_type` | VARCHAR(20) DEFAULT `'piece'` | `'piece'` \| `'weight_kg'` \| `'weight_gram'` \| `'volume_liter'` \| `'length_meter'` — קובע אם המכירה היא ביחידות שלמות או כמות משתנה |
| `cost_price` | DECIMAL(10,2) | מחיר עלות (לצורך חישוב רווחיות ודוחות — לא מוצג ללקוח) |
| `low_stock_threshold` | INT | סף להתראת "מלאי נמוך"; `NULL` = לא עוקבים |
| `supplier_id` | INT → `suppliers(id)` **(טבלה קיימת! לא חדשה — ראו תיקון 3.3)** | ספק ברירת מחדל למוצר |
| `supplier_sku` | VARCHAR(100) | מק"ט אצל הספק (להזמנת רכש) |
| `has_variants` | BOOLEAN DEFAULT FALSE | TRUE ⇒ המלאי/מחיר מנוהלים ברמת `store_product_variants`, לא בשורת הקטלוג עצמה |
| `track_inventory` | BOOLEAN DEFAULT TRUE | אפשרות לכבות מעקב מלאי למוצר ספציפי (למשל שירות נלווה) |

> **הערה עיצובית:** `stock_quantity`/`reserved_qty` הקיימים נשארים כפי שהם ומשמשים למוצר **ללא** וריאציות. כש-`has_variants=TRUE`, הם מוקפאים (לא בשימוש) והמלאי האמיתי נמצא בטבלת הווריאציות — כך אין צורך לגעת בלוגיקת הקיזוז הקיימת עבור עסקים שלא זקוקים לווריאציות (מסעדות, שירותים).

### 3.2 `store_product_variants` (טבלה חדשה)

```sql
CREATE TABLE store_product_variants (
    id SERIAL PRIMARY KEY,
    catalog_id INT REFERENCES store_catalog(id) ON DELETE CASCADE,
    group_id INT REFERENCES family_groups(id),
    variant_name VARCHAR(150),          -- תצוגה: "אדום / L"
    attributes JSONB,                   -- {"color":"אדום","size":"L"} - גמיש לכל סוג מאפיין
    sku VARCHAR(100),
    barcode VARCHAR(50),
    price_override DECIMAL(10,2),       -- NULL = מחיר הבסיס מה-catalog
    stock_quantity INT DEFAULT 0,
    reserved_qty DECIMAL DEFAULT 0,
    image_url TEXT,                     -- תמונה ספציפית לצבע, אם שונה מהמוצר הראשי
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_variants_catalog ON store_product_variants(catalog_id);
```

**מבנה בחירת מאפיינים** (ל-UI בעריכת קטלוג): `store_catalog.variant_attributes_schema JSONB` — לדוגמה `[{"name":"צבע","values":["שחור","לבן","אדום"]},{"name":"מידה","values":["S","M","L","XL"]}]`. המערכת בונה אוטומטית את כל צירופי הווריאציות (מטריצה) בעת שמירת הסכמה, והעסק ממלא מלאי/מחיר/ברקוד לכל שורה שנוצרה (או מוחק צירופים לא רלוונטיים).

### 3.3 ספקים והזמנות רכש — **תיקון: שימוש בתשתית קיימת, לא טבלאות חדשות**

> ⚠️ **תיקון לאחר סקירה (2026-10-06):** בניסיון ראשון נבנו בטעות טבלאות מקבילות (`store_suppliers`, `store_purchase_orders`, `store_purchase_order_items`) מבלי לבדוק קודם אם קיימת תשתית דומה. התברר שכן — `suppliers` + `supplier_products` + `purchase_orders` (server.js ~16940 ואילך) הן תשתית B2B קיימת, גנרית (לא תלויית `business_type`), כבר בשימוש בזרימת פקודות עבודה (construction/maintenance), עם `GET/POST/DELETE /api/suppliers*`. הטבלאות הכפולות ושימושיהן **הוסרו** מהקוד. ההמשך לחנות קמעונאית ישתמש **בתשתית הקיימת**:
> - `suppliers` (`id, group_id, name, contact_person, phone, email, category, min_order, delivery_days, cutoff_time`)
> - `supplier_products` (`id, group_id, supplier_id, name, description, price, unit_type, units_per_package, properties`)
> - `purchase_orders` (`id, group_id, created_by, supplier_id, items JSONB, total_amount, status, expected_delivery, notes`) — `items` הוא JSON גמיש שכבר כולל `catalog_id` לקישור לקטלוג, וסטטוס `'delivered'` כבר מפעיל לוגיקת עדכון `stock_quantity` קיימת בקוד.
>
> **מה עוד צריך**, בלי טבלאות נוספות: UI צד עסק לחנות קמעונאית שמשתמש ב-endpoints הקיימים (`/api/suppliers`, `/api/suppliers/:id/products`, זרימת purchase_orders הקיימת) — ולא endpoints חדשים תחת `/api/biz/retail/...`. ייתכן שיידרשו שדות נוספים קטנים בטבלאות הקיימות (לבדוק בפועל מול הקוד לפני הוספה, לא להניח).

### 3.5 `store_inventory_movements` (יומן תנועות מלאי — טבלה חדשה)

```sql
CREATE TABLE store_inventory_movements (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES family_groups(id),
    catalog_id INT REFERENCES store_catalog(id),
    variant_id INT REFERENCES store_product_variants(id),
    change_qty INT NOT NULL,             -- חיובי = כניסה, שלילי = יציאה
    reason VARCHAR(30) NOT NULL,         -- 'sale' | 'return' | 'purchase_receipt' | 'manual_adjustment' | 'stock_count' | 'cancelled_order'
    reference_id INT,                    -- order_id / purchase_order_id / stock_count_id לפי reason
    note TEXT,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

כל שינוי מלאי (מכירה, החזרה, קבלת רכש, ספירה ידנית, תיקון) **חייב** לעבור דרך פונקציית שרת מרכזית אחת שגם מעדכנת `stock_quantity` וגם רושמת שורה כאן — זה הבסיס לדוחות מלאי ול"מי שינה מה ומתי" (ביקורת).

### 3.6 `store_stock_counts` + `store_stock_count_items` (ספירת מלאי תקופתית)

```sql
CREATE TABLE store_stock_counts (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES family_groups(id),
    status VARCHAR(20) DEFAULT 'in_progress',  -- in_progress | completed
    started_by_user_id INT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE TABLE store_stock_count_items (
    id SERIAL PRIMARY KEY,
    stock_count_id INT REFERENCES store_stock_counts(id) ON DELETE CASCADE,
    catalog_id INT REFERENCES store_catalog(id),
    variant_id INT REFERENCES store_product_variants(id),
    expected_qty INT,     -- מה שהמערכת חשבה שיש
    counted_qty INT,      -- מה שנספר בפועל
    diff_qty INT GENERATED ALWAYS AS (counted_qty - expected_qty) STORED
);
```

בסיום ספירה, המערכת מציעה "ליישר" את המלאי לפי הנספר בפועל — כל פער יוצר רשומה ב-`store_inventory_movements` עם `reason='stock_count'`.

### 3.7 הנחות ומבצעים — `store_retail_promotions` (טבלה חדשה)

> ⚠️ **תיקון:** השם המקורי שתוכנן (`store_promotions`) כבר תפוס ע"י טבלה קיימת ופעילה (server.js ~1006/16683, מנוהלת דרך `/api/store/promotions*`, בשימוש כבר היום לבאנרים/טאב מבצעים בחנות) עם סכמה שונה. שונה השם ל-`store_retail_promotions` כדי לא להתנגש. יש לשקול בעתיד אם לאחד את שתי המערכות (שתיהן "מבצעים לחנות") או להשאירן נפרדות במכוון (הישנה כללית לכל סוגי העסק, זו ייעודית ל-retail עם buy_x_get_y/scope מתקדם).

```sql
CREATE TABLE store_retail_promotions (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES family_groups(id),
    title VARCHAR(150),
    promo_type VARCHAR(30),      -- 'percent_off' | 'amount_off' | 'buy_x_get_y' | 'bundle_price'
    scope VARCHAR(20),           -- 'all' | 'category' | 'products'
    scope_value JSONB,           -- קטגוריה ספציפית, או מערך catalog_id-ים
    value DECIMAL(10,2),         -- אחוז/סכום, לפי promo_type
    buy_qty INT, get_qty INT,    -- רלוונטי רק ל-buy_x_get_y
    coupon_code VARCHAR(30),     -- NULL = מבצע אוטומטי בלי קוד; אחרת קוד שהלקוח מזין
    starts_at TIMESTAMP, ends_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

מחיר סופי בעגלה מחושב בשרת (לא בקליינט) לפי המבצעים הפעילים הרלוונטיים — מניעת מניפולציית מחיר מהצד הציבורי (כמו שכבר נעשה לדיוק ב-store checkout הקיים).

### 3.8 החזרות/זיכויים — `store_returns` (טבלה חדשה)

```sql
CREATE TABLE store_returns (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES family_groups(id),
    original_order_id INT REFERENCES store_orders(id),
    status VARCHAR(20) DEFAULT 'pending',   -- pending | approved | rejected | completed
    refund_method VARCHAR(20),              -- 'cash' | 'store_credit' | 'original_payment'
    total_refund DECIMAL(10,2),
    reason TEXT,
    restock BOOLEAN DEFAULT TRUE,           -- האם להחזיר לפריטים למלאי
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE TABLE store_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT REFERENCES store_returns(id) ON DELETE CASCADE,
    catalog_id INT, variant_id INT,
    qty INT, unit_price DECIMAL(10,2)
);
```

כשהחזר מאושר ו-`restock=TRUE`, נוצרת תנועת מלאי חיובית (`reason='return'`) שמעלה את `stock_quantity` בחזרה.

---

## 4. ניהול קטלוג — UI (צד עסק, `business-app.js`)

### 4.1 מסך עריכת מוצר — הרחבה

לשדות הקיימים (שם, תיאור, מחיר, קטגוריה, תמונה) נוספים:
- **מתג "יש וריאציות"** — מפעיל בניית מאפיינים (צבע/מידה/כל מאפיין מותאם אישית) → יצירת מטריצת וריאציות אוטומטית, טבלת עריכה מהירה (מלאי + מחיר + ברקוד + תמונה לכל שורה, inline).
- **יחידת מידה** — בורר `יחידה בודדת / משקל (ק"ג) / משקל (גרם) / נפח (ליטר) / אורך (מטר)`; כשנבחר משקל/נפח/אורך — שדה המחיר משתנה ל"מחיר ל-ק"ג/ליטר/מטר" וב-POS/storefront מוצג שדה הזנת כמות (0.250 ק"ג וכו').
- **ברקוד** — שדה טקסט + כפתור "סרוק" (ראו 6.1).
- **מלאי נמוך** — שדה סף + toggle התראות.
- **ספק ועלות** — בורר ספק (מתוך `suppliers` הקיימת, עם אפשרות "ספק חדש" inline) + מחיר עלות (לדוחות רווחיות, לא גלוי ללקוח).

### 4.2 מסך "מלאי" חדש (טאב עצמאי בתוך "מכירות"/`shop`, בדומה למבנה שוקה)

תתי-טאבים:
1. **סקירה** — טבלת כל המוצרים עם עמודות: מלאי נוכחי, סף נמוך, סטטוס (תקין/נמוך/אזל), שווי מלאי (`stock_qty * cost_price`), פילטר "הצג רק מלאי נמוך/אזל".
2. **תנועות מלאי** — יומן מסונן לפי מוצר/תאריך/סיבה (מתוך `store_inventory_movements`).
3. **ספירת מלאי** — התחלת ספירה חדשה (רשימת מוצרים להזנת כמות בפועל, תמיכה בסריקת ברקוד לאימות מהיר), השוואה אוטומטית, אישור יישור.
4. **ספקים והזמנות רכש** — ניהול רשימת ספקים; יצירת הזמנת רכש (בחירת ספק → הוספת מוצרים מהקטלוג עם כמות → שליחה כקובץ/וואטסאפ); מסך "קבלת סחורה" מול הזמנה פתוחה.

### 4.3 מבצעים — טאב "מבצעים" (בתוך `sales`/`shop`)

טבלת מבצעים פעילים/עתידיים/שפגו, יצירה/עריכה לפי הטיפוסים ב-3.7, תצוגה מקדימה של "על אילו מוצרים זה חל עכשיו".

---

## 5. Storefront (חנות ציבורית ללקוח)

### 5.1 חיבור תבנית
`retail`/`store_only` ימופו כברירת מחדל ל-`storefront-market.html` (התבנית הקיימת הקרובה ביותר, ללא זיקה למזון) — עם שם קובץ חדש `storefront-retail.html` **אם** יידרשו התאמות ייחודיות (ראו 5.2) שלא מתאימות ל"שוק" הקהילתי המקורי. ההחלטה הסופית (לשכפל/להתאים) תתקבל בשלב התכנון המפורט לאחר סקירה ויזואלית.

### 5.2 כרטיס מוצר עם וריאציות
- אם `has_variants=TRUE`: כרטיס המוצר מציג בוררי מאפיין (צבע כעיגולי צבע / מידה ככפתורים) — לפני הוספה לעגלה הלקוח חייב לבחור וריאציה תקפה (מלאי > 0).
- וריאציה שאזל מלאי שלה מוצגת אך מושבתת ("אזל במידה זו"), לא נעלמת לגמרי מהתצוגה — כדי לא "להעלים" מוצר שקיים בצבעים אחרים.
- מוצר ביחידת משקל: שדה "כמות (גרם/ק"ג)" עם קפיצות (לדוגמה 100 גרם) במקום סלקטור כמות שלם.

### 5.3 סינון וחיפוש
הרחבת הסינון הקיים (לפי עסק/קטגוריה/חיפוש טקסט — כבר קיים מעבודת "שוקה") בסינון לפי מאפייני וריאציה (צבע/מידה) כשהקמפיין/החנות כוללת מוצרים עם וריאציות.

### 5.4 החזרות ללקוח
ממסך "ההזמנות שלי" (קיים) — כפתור "בקש החזרה/החלפה" להזמנה שהושלמה, פותח טופס בחירת פריטים+סיבה, יוצר רשומה ב-`store_returns` בסטטוס `pending` לאישור העסק.

---

## 6. POS (קופה) — הרחבות

### 6.1 סריקת ברקוד
תמיכה בסורק USB/בלוטות' בלבד (פועל כמקלדת, Enter בסוף סריקה — אין צורך ב-SDK מיוחד). סריקה בקופה מוסיפה את המוצר/וריאציה התואמת לעגלת המכירה ישירות. **הוחלט: אין צורך בסריקה דרך מצלמת מובייל בשלב זה** — לא רלוונטי כרגע.

### 6.2 מכירה לפי משקל
כפתור "הזן משקל" לפריטי `unit_type != 'piece'` — מחשבון מהיר (משקל × מחיר ליחידה).

### 6.3 החזרים/זיכויים בקופה
פעולת "החזרה" בקופה: חיפוש הזמנה מקורית (לפי מספר/טלפון) → בחירת פריטים להחזרה → בחירת אופן זיכוי (מזומן/זיכוי בחנות/חיוב מקורי) → יצירת `store_returns` מאושר ישירות + עדכון מלאי מיידי.

### 6.4 שורת "שווי עגלה בזמן אמת + מבצעים שחלים"
תצוגת badge בקופה כשמבצע רלוונטי מתחיל לחול (שקיפות לקופאי לפני סגירת המכירה).

---

## 7. דוחות (`reports` module — הרחבה)

- **דוח מלאי נוכחי** — שווי מלאי כולל, לפי קטגוריה, התראות מלאי נמוך/אזל.
- **דוח תנועות מלאי** — טווח תאריכים, סינון לפי סיבה.
- **דוח מוצרים חמים/קרים** — top-sellers / מוצרים שלא זזו X ימים (מועמדים למבצע/חיסול).
- **דוח רווחיות** — (`price - cost_price) * qty_sold` לכל מוצר/קטגוריה/טווח תאריכים.
- **דוח ספקים** — סה"כ רכש לפי ספק, זמן אספקה ממוצע (`received_at - created_at`).
- **דוח מבצעים** — תרומת כל מבצע למכירות (כמה הזמנות/הכנסה נבעו ממנו, לפי `coupon_code`/promotion_id שנשמר על ההזמנה).

---

## 8. נקודות אינטגרציה עם מודולים קיימים (לא לפגוע!)

| מודול קיים | השפעה |
|---|---|
| `store_orders` / checkout flow | חייב להתחשב במבצעים (3.7) בחישוב המחיר השרתי, ובווריאציה הנבחרת (variant_id בפריט העגלה) — **תוספתי בלבד**, לא משנה את מבנה ה-items הקיים למוצרים ללא וריאציות |
| שוקה (community_campaigns) | חנות עם וריאציות צריכה לעבוד גם כש"משתקפת" לשוק קהילתי — `price_override` בטבלת `community_campaign_products` צריך להתייחס לרמת variant (הרחבה עתידית, לא בשלב ראשון — בשלב א' מוצרי וריאציה לא יהיו זמינים לשיקוף לשוקה, רק מוצרים רגילים) |
| `pantry` module | נשאר נפרד — pantry הוא חומרי גלם/ציוד פנימי, לא קטלוג מכירה ללקוח. אין איחוד בין שתי המערכות בשלב זה |
| הרשאות עובדים (`EMPLOYEE_ROLE_TYPES`) | תפקיד "מחסנאי" (כבר קיים ל-retail) מקבל הרשאת גישה לטאב המלאי/קבלת סחורה; "קופאי" מקבל גישה ל-POS+סריקה+החזרות, לא לעריכת קטלוג/ספקים |

---

## 9. שלבי יישום מוצעים (לדיון בתכנית עבודה, לא לביצוע עדיין)

**שלב א' — יסודות מלאי אמיתיים + וריאציות (מאוחד, לפי החלטה):**
ברקוד (סורק USB/בלוטות' בלבד — ללא סריקת מצלמה בשלב זה), יחידת מידה/משקל, cost_price, סף מלאי נמוך + התראה בדשבורד, יומן תנועות מלאי, חיבור storefront, **ו-`store_product_variants` + UI מטריצת וריאציות + תמיכה ב-storefront/POS/עגלה** (וריאציות נדרשות כבר בגל הראשון).

**שלב ב' — ספקים ורכש: ✅ גמור, אין צורך בפיתוח כלל.** בדיקה (2026-10-06) מצאה שטאב "shop" הקיים (`public/business-app.js:18065-18897`, מול `/api/suppliers`/`/api/b2b/orders/create`) כבר כולל מאגר ספקים, קטלוג מוצרי ספקים, עגלת רכש ו-checkout — **וכבר כלול ברשימת המודולים של `retail` ו-`store_only`**, בלי תלות ב-work_order. אין פה שום פער לסגור.

**שלב ג' — מבצעים (כולל "קנה X קבל Y"):**
`store_promotions` + מנוע חישוב מחיר שרתי + UI ניהול — **ניהול/אישור מבצעים מוגבל לבעל העסק (Admin) בלבד, לא לעובדים**, גם עם הרשאה.

**שלב ד' — החזרות/זיכויים + ספירת מלאי תקופתית.**

**שלב ה' — דוחות מתקדמים** (רווחיות, top-sellers, ספקים, מבצעים).

כל שלב עצמאי לפריסה (ניתן לעצור אחרי כל שלב ולקבל ערך מיידי), ואף שלב לא דורש שינוי בהתנהגות הקיימת של מסעדה/יופי/שירותים.

---

## 10. החלטות (לאחר סבב הבהרות)

1. **וריאציות (מידה/צבע)** — נדרשות כבר בגל הראשון; אוחדו לשלב א'.
2. **מרובת סניפים** — לא כרגע. לא נכלל בתכנית העבודה; אם יידרש בעתיד זו תוספת ארכיטקטונית נפרדת (`location_id`).
3. **סריקת ברקוד** — לא רלוונטי כרגע סריקה דרך מצלמת מובייל; מספיק סורק USB/בלוטות' חיצוני בקופה הפיזית (סעיף 6.1 מצומצם בהתאם — אין צורך בספריית סריקת-מצלמה בשלב זה).
4. **מבצעי "קנה X קבל Y"** — נדרשים (לא רק הנחת אחוז/סכום פשוטה).
5. **הרשאת ניהול מבצעים** — בעל העסק (מנהל) בלבד.
