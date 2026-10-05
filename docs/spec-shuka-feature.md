# מסמך אפיון — "שוקה" (קמפייני שוק קהילתיים) | WEFLOWZ

> גרסה: 2026-10-05 | מבוסס על קוד: `server.js`, `public/app.js`, `public/business-app.js`, `public/zone-manager-app.js`, `public/sa-app.js`, `public/sa.html`, `public/community-store-app.js`

---

## 1. רקע ומטרת הפיצ'ר

**שוקה** הוא שוק קהילתי דיגיטלי: עמוד ציבורי אחד (`/campaign/:code`) שמרכז מוצרים ממספר עסקים ששייכים לאותה קהילה, ומאפשר ללקוחות הקהילה להזמין ישירות מכל עסק בתוכו.

**המטרה העסקית:** לגרום לעסקים לפתוח חנות דיגיטלית עצמאית בתוך הקהילה שלהם (מול קהל צרכנים מרוכז ומקומי), ובמקביל להתחבר באופן יזום לקמפייני "שוק" שנפתחים בקהילה — כדי לשקף שם מוצרים/מנות נבחרות בתנאים ובמחירים שהעסק עצמו קובע, ולקבל הזמנות ישירות לאזור ניהול ההזמנות שלו.

**שני מסלולי הצטרפות לשוק (שניהם מתכנסים לאותה תוצאה):**
1. **העסק יוזם** — מאתר שוק פעיל ב"רדאר השווקים" ומבקש להצטרף.
2. **מנהל הקהילה/אזור יוזם** — מזמין עסק ספציפי (למשל עסק חדש שהצטרף לקהילה) להצטרף לשוק.

**עיקרון מרכזי (שונה מגרסה ראשונית):** העסק בוחר בעצמו אילו מוצרים לשקף בכל שוק, ובאיזה מחיר (יכול להיות שונה ממחיר הקטלוג הרגיל שלו — הנחה ייעודית לשוק). מנהל השוק לא בוחר מוצרים — הוא רק **מאשר או דוחה** את מה שהעסק הקצה.

**חשוב:** זמינות מוצר בחנות הרגילה של העסק (`store_catalog.is_available`) **אינה** קובעת אם הוא יכול להופיע בשוק — עסק יכול לשקף מוצר לשוק גם אם הוא מוסתר כרגע בחנות הרגילה שלו.

---

## 2. מודל נתונים

### 2.1 `community_campaigns` (טבלה קיימת מראש, הורחבה)

| עמודה | טיפוס | הערה |
|---|---|---|
| `id` | SERIAL PK | |
| `community_id` | INT → `communities(id)` | |
| `title`, `code` (UNIQUE), `banner_image_url`, `description`, `status` | | `status`: `'active'` \| `'suspended'` (או כל ערך אחר — מוצג כ"מושבת") |
| `logo_url`, `slogan`, `hide_title`, `share_description`, `ordering_enabled` | | הגדרות תצוגה/שיתוף של עמוד השוק |
| **`start_at`, `end_at`** | TIMESTAMP | **חדש** — טווח "יום שוק" (לא נאכף אוטומטית כרגע, לשימוש עתידי/תצוגתי) |
| **`recurrence`** | VARCHAR(20) DEFAULT `'none'` | **חדש** — `'none'` \| `'weekly'` \| `'monthly'` (שדה תיאורי, אין עדיין לוגיקת תזמון אוטומטית) |
| **`is_open_for_requests`** | BOOLEAN DEFAULT TRUE | **חדש** — האם מנהל השוק סוגר זמנית בקשות הצטרפות חדשות |

### 2.2 `community_campaign_businesses` (קיימת, ללא שינוי)

קשר Many-to-Many סופי: אילו עסקים כבר **חברים בפועל** בשוק. `PRIMARY KEY (campaign_id, business_group_id)`.

### 2.3 `community_campaign_products` (הורחבה משמעותית)

| עמודה | טיפוס | הערה |
|---|---|---|
| `campaign_id`, `business_group_id`, `catalog_id` | | `PRIMARY KEY (campaign_id, catalog_id)` |
| `added_at` | TIMESTAMP | |
| **`price_override`** | DECIMAL(10,2) | **חדש** — מחיר ייעודי לשוק זה; `NULL` = משתמשים במחיר הקטלוג הרגיל |
| **`approval_status`** | VARCHAR(20) DEFAULT `'pending'` | **חדש** — `'pending'` \| `'approved'` \| `'rejected'` |
| **`submitted_by_user_id`** | INT | **חדש** — מי מהעסק הגיש |
| **`reviewed_at`** | TIMESTAMP | **חדש** — מתי מנהל השוק סקר |

### 2.4 `community_campaign_requests` (טבלה חדשה לגמרי)

```sql
CREATE TABLE community_campaign_requests (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES community_campaigns(id) ON DELETE CASCADE,
    business_group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL,        -- 'business_request' | 'manager_invite'
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    requested_by_user_id INT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_campaign_requests_open
    ON community_campaign_requests (campaign_id, business_group_id)
    WHERE status='pending';
```
האינדקס החלקי מונע **בקשה פתוחה כפולה** לאותו שוק (בלי לחסום היסטוריה — אפשר לבקש שוב אחרי דחייה).

### 2.5 `store_orders.campaign_id` (עמודה חדשה)

```sql
ALTER TABLE store_orders ADD COLUMN campaign_id INT REFERENCES community_campaigns(id) ON DELETE SET NULL;
```
מקושר אוטומטית בכל הזמנה שמגיעה מעמוד שוק (`order_source='community_campaign'`), לתיוג וסינון בדשבורד ההזמנות של העסק.

---

## 3. זרימת-על (End-to-End)

```
מנהל קהילה/אזור פותח קמפיין "שוקה"
        │
        ├─► מזמין עסק ספציפי ──► community_campaign_requests(direction='manager_invite') ──► עסק מאשר/דוחה
        │
        └─► עסק סורק ברדאר ──► מבקש להצטרף ──► community_campaign_requests(direction='business_request') ──► מנהל מאשר/דוחה
                                                                      │
                                                     (אישור) → community_campaign_businesses
                                                                      │
                                   עסק בוחר מוצרים מהקטלוג שלו + קובע מחיר לשוק (אופציונלי)
                                                                      │
                                           community_campaign_products(approval_status='pending')
                                                                      │
                                              מנהל השוק סוקר ומאשר/דוחה כל מוצר בנפרד
                                                                      │
                                         (approved) → מוצג בעמוד השוק הציבורי /campaign/:code
                                                                      │
                                              לקוח בקהילה מזמין (רק מעסק אחד בהזמנה)
                                                                      │
                            store_orders (campaign_id, order_source='community_campaign', status='pending_approval')
                                                                      │
                            מוצג בדשבורד ההזמנות של העסק מתויג "🛒 שוקה" (לא "🌐 אתר" גנרי)
```

---

## 4. API — צד העסק (`verifyBiz`)

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/biz/market-radar` | סריקת כל השווקים הפעילים בכל הקהילות, **גם ללא חברות קהילתית קיימת**. פילטרים (query): `city`, `interest`, `dateFrom`, `dateTo`, `search`. לכל שוק: `is_community_member`, `already_joined`, `pending_request_status` |
| GET | `/api/biz/market-campaigns/mine` | כל הבקשות/הזמנות (`requests`) + השווקים הפעילים (`activeCampaigns`) של העסק |
| POST | `/api/biz/market-campaigns/:campaignId/request` | בקשת הצטרפות. **אוכף חברות קהילתית מאושרת כתנאי-סף** — אם לא, מחזיר `409` עם `{code:'COMMUNITY_MEMBERSHIP_REQUIRED', communityId}` |
| POST | `/api/biz/market-campaigns/requests/:requestId/respond` | תגובה (`action: 'approve'\|'reject'`) להזמנה שהתקבלה מהקהילה |
| POST | `/api/biz/market-campaigns/:campaignId/leave` | עזיבת שוק — מסיר גם את כל המוצרים של העסק מהקמפיין |
| GET | `/api/biz/market-campaigns/:campaignId/products` | קטלוג העסק המלא, מתוייג `selected`/`price_override`/`approval_status` לכל פריט |
| POST | `/api/biz/market-campaigns/:campaignId/products` | `{catalogId, action:'add'\|'remove', price?}` — בחירת/הסרת מוצר + מחיר לשוק. כל `add` נכנס תמיד כ-`approval_status='pending'` (גם עדכון מחיר על מוצר קיים מאפס את האישור לממתין) |

---

## 5. API — צד מנהל קהילה/אזור

קיימים **שני מסלולים מקבילים וזהים בלוגיקה**, עם הרשאה שונה:
- `/api/zone-manager/community-campaigns/...` — `verifyZoneManager` (לוח מנהל אזור העצמאי, `zone-manager.html`)
- `/api/community/manager/campaigns/...` — `verifyFamily` + בדיקת `family_communities.is_community_manager=TRUE` (מתוך אפליקציית המשפחה, `public/app.js`)

| Method | Path (שני המסלולים, אותו Suffix) | תיאור |
|---|---|---|
| GET | `.../:id/requests` | כל הבקשות/הזמנות לשוק זה |
| POST | `.../:id/requests/:requestId/respond` | אישור/דחיית בקשת הצטרפות מעסק (`direction='business_request'`) |
| POST | `.../:id/invite` | הזמנת עסק יזומה (דורש `community_businesses.status='approved'`) |
| GET | `.../:id/products-review` | **כל** המוצרים שעסקים הקצו לשוק (אופציונלי `?status=pending`) |
| POST | `.../:id/products/review` | `{businessGroupId, catalogId, action:'approve'\|'reject'}` |
| POST | `.../:id/products` | **הוגבל** — כעת מקבל רק `{catalogId, action:'remove'}` (הסרה/takedown בלבד; הוספת מוצר חדש אסורה למנהל — זה תפקיד העסק) |
| GET/POST | `.../:id/businesses`, `.../:id/detail` | ללא שינוי — הוספה/הסרה ישירה של עסק לשוק (מנגנון "אדמין" שנשאר כגיבוי/קיצור-דרך, בנוסף למסלול הבקשות) |

---

## 6. API — Super Admin (`verifySA`)

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/sa/shuka/campaigns` | טבלה גלובלית **חוצה-קהילות/אזורים** של כל השווקים. פילטרים: `search`, `status`, `communityId`. מדדים לכל שוק: `business_count`, `product_count` (approved), `pending_product_count`, `pending_request_count`, `order_count`, `gmv` (סכום `total_amount` מהזמנות לא-quote) |
| POST | `/api/sa/shuka/campaigns/:id/status` | `{status:'active'\|'suspended'}` — השעיה/הפעלה ישירה, ללא תלות במנהל האזור/קהילה |

---

## 7. API — ציבורי (עמוד השוק, ללא התחברות עד הזמנה)

| Method | Path | תיאור |
|---|---|---|
| GET | `/campaign/:code` | עמוד HTML (`community-store.html`) עם og:tags דינמיים |
| GET | `/api/campaign/:code` | קמפיין + עסקים משתתפים + **מוצרים מאושרים בלבד** (`approval_status='approved'`), מחיר = `COALESCE(price_override, sc.price)` |
| POST | `/api/campaign/:code/order` | הזמנה. אוכף: כל הפריטים מעסק אחד בלבד; העסק חבר בקמפיין; **המוצר אושר** (`approval_status='approved'`); מחיר תואם ל-`price_override`/קטלוג (± טולרנס לתוספות) |
| GET | `/api/campaign/:code/my-orders` | היסטוריית הזמנות הלקוח חוצה-עסקים בתוך הקמפיין הזה |

---

## 8. UI — צד העסק (`public/business.html` + `public/business-app.js`)

טאב **"שוקה"** חדש תחת "חנות ומכירות" (ליד "גלריה"), עם שני תתי-מסכים:

**א. רדאר שווקים** (`switchShukaTab('radar')`) — סינון עיר/תחום-עניין/חיפוש, כרטיס לכל שוק עם כפתור דינמי: "בקש להצטרף" / "בקשה ממתינה לאישור" / "✓ אתם כבר בשוק הזה".

**ב. השווקים שלי** (`switchShukaTab('mine')`) —
- בקשות/הזמנות: הזמנות שהתקבלו ממנהל קהילה מוצגות עם כפתורי אשר/דחה; בקשות שהעסק עצמו שלח מוצגות עם תג סטטוס.
- שווקים פעילים: לכל שוק — כפתור **"מוצרים"** (פותח מודל בחירת מוצרים + מחיר) וכפתור **"עזוב"**.

**מודל בחירת מוצרים** (`shukaOpenProducts`): צ'קבוקס לכל פריט קטלוג (ללא תלות ב-`is_available`), שדה מחיר-לשוק (`shukaSetPrice`), ותג סטטוס (ממתין לאישור/אושר/נדחה).

**תיוג הזמנות**: בדשבורד ההזמנות הרגיל, הזמנה עם `order_source='community_campaign'` מתויגת **"🛒 שוקה"** (3 מקומות נפרדים בקוד שתויגו בעבר כ"🌐 אתר" גנרי).

---

## 9. UI — צד מנהל קהילה/אזור

זהה בשני הקבצים (`public/app.js` פונקציות `cm*`, `public/zone-manager-app.js` פונקציות `zm*`), בתוך מסך ניהול הקמפיין הקיים:

- **"בקשות הצטרפות ממתינות"** — בראש המסך, עם אשר/דחה לכל בקשה.
- **כפתור "הזמן"** ליד כל עסק-קהילה שעדיין לא בשוק (הזמנה יזומה).
- **"סקירת מוצרים"** — מסך נפרד שמציג את כל המוצרים שהוקצו (מכל העסקים), עם מחיר-לשוק מול מחיר-קטלוג, וכפתורי אשר/דחה (או "הסר מהשוק" למוצרים כבר מאושרים).

---

## 10. UI — Super Admin (`public/sa.html` + `public/sa-app.js`)

טאב **"שוקה"** בקבוצת הניווט "לקוחות" (ליד קהילות/עסקים/סביבות/פיד), משולב בתשתית `SA_GROUPS` הדינמית הקיימת. מציג כרטיסי סיכום (שווקים פעילים, עסקים משתתפים, הזמנות+מחזור, ממתינים לטיפול) וטבלה מלאה עם סינון (חיפוש/סטטוס) וכפתור השעה/הפעל לכל שוק.

---

## 11. UI — עמוד השוק הציבורי (`public/community-store-app.js`)

הושוותה מול חנות ציבורית רגילה (`storefront.html`/`storefront-restaurant.html`) ותוקנו 3 פערים:

1. **תגית הנחה** — קו חוצה על המחיר המקורי (`original_price`) + תג "מחיר שוק ✨" כש-`price_override` נמוך מהקטלוג.
2. **טקסט כפתור לפי `product_type`** — "הרכב פיצה" / "📅 הזמן שירות" / "📦 בחר חבילה" / "📋 צפייה במפרט" (היה "הוספה" גנרי לכולם).
3. **תמיכה מלאה ב-`complex_builder`** (מנה מורכבת/קומבו/ארוחה) — מודל רב-שלבי שנבנה דינמית ב-DOM, פורטינג של `openComplexProductModal`/`renderComplexStepsSelectionUI`/`calculateComplexTotal`/`submitComplexProduct` מ-`storefront.html`, כולל חישוב מחיר לפי `priceMode` (`per_guest` — מוכפל בכמות / `per_total` — מחיר חד-פעמי), ולידציית מינימום-נבחרים לכל שלב.

**קיבוץ מוצרים**: לפי עסק בלבד (פילטר "צ'יפים"), ללא קיבוץ-משנה לפי קטגוריה — **החלטה מכוונת**, לא פער (המטרה: אפשר לצפות בכל המוצרים של כל העסקים יחד, או לסנן למוצרים של עסק אחד בלבד; לא נדרשים מסננים נוספים).

**כלל קבוע (לא השתנה)**: לא ניתן לערבב מוצרים מכמה עסקים באותה הזמנה — נאכף גם בצד הלקוח וגם בצד השרת.

---

## 12. מגבלות ידועות / לא מיושם (נכון לגרסה זו)

- `start_at`/`end_at`/`recurrence` הם שדות **תיאוריים בלבד** — אין עדיין לוגיקה שחוסמת הזמנות אוטומטית מחוץ לטווח התאריכים, ואין job שמפעיל/מכבה שוק לפי `recurrence`.
- אין בדיקת "רדיוס גיאוגרפי" אמיתית ברדאר השווקים — הסינון לפי `city` הוא התאמת-טקסט (`ILIKE`) על שדה `communities.city`, לא חישוב מרחק (ל-`communities` אין שדות lat/lng).
- מנגנון ה"הוספה ישירה" של עסק לקמפיין (`.../:id/businesses`, ללא בקשה) נשאר זמין למנהל כקיצור-דרך — לא הוסר, כדי לא לשבור זרימת-אדמין קיימת.
- אין התראות Push/In-app אוטומטיות על אירועי שוקה (בקשה חדשה, אישור, הזמנה) — טעינת הנתונים היא על-פי דרישה (ידני/בכניסה למסך) בלבד.
- בדיקת קוד זו **לא נבדקה בדפדפן בפועל מול סביבה חיה** — ראו `docs/test-checklist-shuka.md` לבדיקה ידנית מומלצת.
