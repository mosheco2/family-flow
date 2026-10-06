# סביבת BIZ — מפרט טכני מלא
**Oneflow Life · מנתח מערכות · עומק מקסימלי**
גרסה: אוקטובר 2026

---

## תוכן עניינים

1. [זהות הסביבה](#1-זהות-הסביבה)
2. [כניסה ואוטנטיקציה](#2-כניסה-ואוטנטיקציה)
3. [תפקידי משתמש](#3-תפקידי-משתמש)
4. [ניווט — GNAV + ALL_TABS](#4-ניווט--gnav--all_tabs)
5. [מנגנון מנעולים ורישוי מודולים](#5-מנגנון-מנעולים-ורישוי-מודולים)
6. [סוגי עסקים — BUSINESS_TYPES](#6-סוגי-עסקים--business_types)
7. [דשבורד ראשי — feed](#7-דשבורד-ראשי--feed)
8. [לוחות בקרה לפי תפקיד — Role Dashboards](#8-לוחות-בקרה-לפי-תפקיד--role-dashboards)
9. [קופה — pos](#9-קופה--pos)
10. [מכירות וחנות — sales](#10-מכירות-וחנות--sales)
11. [לקוחות / CRM — customers](#11-לקוחות--crm--customers)
12. [יומן ותורים — calendar](#12-יומן-ותורים--calendar)
13. [משמרות — shifts](#13-משמרות--shifts)
14. [נוכחות — timeclock](#14-נוכחות--timeclock)
15. [רכש ארגוני — shop](#15-רכש-ארגוני--shop)
16. [ניהול מלאי — pantry](#16-ניהול-מלאי--pantry)
17. [תחזוקת ציוד — equipment](#17-תחזוקת-ציוד--equipment)
18. [כספים — bank](#18-כספים--bank)
19. [תזרים — cashflow](#19-תזרים--cashflow)
20. [תקציבים — budget](#20-תקציבים--budget)
21. [תשקיף — forecast](#21-תשקיף--forecast)
22. [משימות ופרויקטים — tasks](#22-משימות-ופרויקטים--tasks)
23. [מרכז הכשרות — academy](#23-מרכז-הכשרות--academy)
24. [קהילות מחוברות — community](#24-קהילות-מחוברות--community)
25. [תקשורת ועדכונים — surveys](#25-תקשורת-ועדכונים--surveys)
26. [ניהול צוות — members](#26-ניהול-צוות--members)
27. [שליחויות — deliveries](#27-שליחויות--deliveries)
28. [דוחות — reports](#28-דוחות--reports)
29. [מודולי יופי (BEAUTY) — 8 טאבים](#29-מודולי-יופי-beauty--8-טאבים)
30. [מודולי מסעדה (RESTAURANT) — ייחודיים](#30-מודולי-מסעדה-restaurant--ייחודיים)
31. [מודולי מומחים (PROFESSIONAL) — ייחודיים](#31-מודולי-מומחים-professional--ייחודיים)
32. [מודולי ספורט (SPORT) — ייחודיים](#32-מודולי-ספורט-sport--ייחודיים)
33. [מודולי תיקונים (MAINTENANCE_REPAIR) — ייחודיים](#33-מודולי-תיקונים-maintenance_repair--ייחודיים)
34. [מודולי קמעונאות (RETAIL) — ייחודיים](#34-מודולי-קמעונאות-retail--ייחודיים)
35. [פרסום FLOW — biz-ads](#35-פרסום-flow--biz-ads)
36. [הגדרות — settings](#36-הגדרות--settings)
37. [AI Features](#37-ai-features)
38. [SA Impersonation Mode](#38-sa-impersonation-mode)
39. [Onboarding Wizard](#39-onboarding-wizard)
40. [מנגנונים טכניים רוחביים](#40-מנגנונים-טכניים-רוחביים)

---

## 1. זהות הסביבה

| פרמטר | ערך |
|---|---|
| **שם** | BIZ |
| **URL** | `/business.html` |
| **JS ראשי** | `public/business-app.js` (~62,500 שורות) |
| **מטרה** | ניהול עסק מלא — צוות, מכירות, מלאי, כספים, לקוחות |
| **קהל יעד** | בעלי עסקים (ADMIN), מנהלים (MANAGER), עובדים (MEMBER/SENIOR) |
| **API constant** | `const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api'` |
| **Auth token key** | `window._bizToken` |

### קבועים גלובליים

```javascript
let currentUser = null;               // אובייקט המשתמש הנוכחי
let currentGroup = null;              // אובייקט הקבוצה / העסק
let pollInterval = null;              // interval של fetchData
let saToken = null;                   // SA token (לפעולות admin מטעם SA)
let membersCache = [];                // עובדים
let allTasks = [];                    // משימות
let allTransactions = [];             // פעולות פיננסיות
let bundlesCache = [];                // quiz bundles
let pantryCache = [];                 // מלאי
let shoppingListCache = [];           // רכש
let calEventsCache = [];              // אירועי יומן
let calServicesCache = [];            // שירותי יומן
let calSettingsCache = {};            // הגדרות יומן
let storeOrdersCache = [];            // הזמנות חנות
let storeCatalogCache = [];           // קטלוג מוצרים
let storePromotionsCache = [];        // מבצעים
let storeCustomersCache = [];         // לקוחות CRM
let storeQuotesCache = [];            // הצעות מחיר
let suppliersList = [];               // ספקים (B2B)
let b2bCatalogCache = [];             // קטלוג B2B
let b2bCart = {};                     // עגלת B2B
let b2bOrdersHistory = [];            // היסטוריית B2B
var foodCostData = [];                // נתוני food cost
var forecastCache = { startingBalance:0, items:[] };
let isPunchedIn = false;              // האם העובד בפאנץ' כרגע
window._currentBizTab = '';           // tab פעיל
```

---

## 2. כניסה ואוטנטיקציה

### שיטות כניסה

#### א. מייל + סיסמה
```javascript
handleBizLogin(e)
  ↓ POST /api/auth/login { email, password }
  ↓ res.group.type === 'BUSINESS' → _saveSession + loadDashboard
  ↓ res.group.type !== 'BUSINESS' → ← redirect ל-index.html
```

#### ב. SMS OTP
```javascript
bizSendOTP()   → POST /api/auth/send-otp { phone }
bizVerifyOTP() → POST /api/auth/verify-otp { phone, code }
  ↓ options[] — רשימת חשבונות בטלפון
  ↓ בחירת חשבון + סיסמה → loadDashboard
```

#### ג. SSO מחנות FAMILY
```javascript
URL: /business.html?sso_token=X
  ↓ GET /api/biz/sso-login?token=X
  ↓ _saveSession(user, group, token)
  ↓ loadDashboard()
```

### שמירת Session

```javascript
function _saveSession(user, group, token) {
    currentUser = user; currentGroup = group;
    window._bizToken = token || window._bizToken;
    const slim = { user, group, token: window._bizToken };
    localStorage.setItem('ofl_session', JSON.stringify(slim));
}
```

### API Calls — Auth Header

```javascript
fetch(url, { headers: { Authorization: `Bearer ${window._bizToken}` } })
```

---

## 3. תפקידי משתמש

### תפקידים בסיסיים

| תפקיד | גישה | הגבלות |
|---|---|---|
| `ADMIN` | כל ה-tabs | ללא |
| `MANAGER` | feed, timeclock, shifts, calendar, shop, pantry, equipment, tasks, academy, sales, pos, customers | ללא finance בברירת מחדל |
| `SENIOR` | feed, timeclock, shifts, pantry, tasks, academy, pos | ממוקד בעבודה שוטפת |
| `MEMBER` | feed, timeclock, shifts, tasks, academy | מינימלי |

### תפקידים מקצועיים — `employee_role_type`

20 תפקידים נוספים, כל אחד עם tabs ייעודיים (`ROLE_TYPE_TABS`) ולוח בקרה ייעודי:

| תפקיד | id | Tabs אוטומטיים | לוח בקרה |
|---|---|---|---|
| איש מכירות | `salesperson` | pos, sales, customers, tasks, calendar, timeclock, shifts | `renderSalespersonDashboard` |
| טכנאי שטח | `field_tech` | tasks, equipment, calendar, timeclock, shifts | `renderFieldTechDashboard` |
| מדריך | `instructor` | tasks, equipment, calendar, timeclock, shifts | ← sport בלבד |
| שליח / נהג | `delivery` | deliveries, tasks, timeclock, shifts | `renderDeliveryDashboard` |
| מחסנאי | `warehouse` | pantry, shop, tasks, timeclock, shifts | `renderWarehouseDashboard` |
| מנקה / אחזקה | `cleaner` | tasks, timeclock, shifts | `renderCleanerDashboard` |
| נציג שירות | `support` | customers, tasks, calendar, timeclock | `renderSupportDashboard` |
| קופאי | `cashier` | pos, sales, tasks, timeclock, shifts | `renderCashierDashboard` |
| מנהל משמרת | `shift_manager` | pos, sales, tasks, members, timeclock, shifts, customers, cashflow, reviews | `renderShiftManagerDashboard` |
| מנהל סניף | `branch_manager` | + pantry, budget, equipment, reports | `renderBranchManagerDashboard` |
| מלצר | `waiter` | pos, sales, tasks, calendar, members, shifts, timeclock | `renderWaiterDashboard` |
| טבח | `cook` | pantry, tasks, shifts, foodcost, timeclock | `renderCookDashboard` |
| מטפלת | `therapist` / `nail_tech` / `makeup_artist` / `reception` | beauty_calendar, beauty_clients, tasks, timeclock | `renderBeautyStaffDashboard` |
| מטפלת בכירה | `senior_therapist` | + beauty_practitioners, beauty_commissions | `renderBeautyStaffDashboard` |

---

## 4. ניווט — GNAV + ALL_TABS

### ALL_TABS — 50 טאבים

```javascript
const ALL_TABS = [
// קבוצת צוות:
  feed, timeclock, shifts, calendar, tasks, academy, members,
  beauty_calendar, beauty_practitioners, routines,
// קבוצת מכירות:
  pos, sales, customers, cases, leads, deliveries, reviews,
  menu_templates, beauty_services, beauty_subscriptions,
  beauty_clients, beauty_rfq,
// קבוצת מלאי:
  shop, pantry, equipment, foodcost, beauty_inventory,
// קבוצת כספים:
  bank, cashflow, budget, timelog, forecast,
  beauty_commissions, reports,
// קבוצת עוד:
  community, surveys, content, documents,
  biz-ads, whatsapp-alerts, settings,
// לוגיסטיקה (12 טאבים):
  logistics_orders, logistics_drivers, logistics_vehicles,
  logistics_pricing, logistics_cod, logistics_rfq,
  logistics_routes, logistics_tracking, logistics_reports,
  logistics_customers, logistics_invoices
]
```

### GNAV_GROUPS — 5 קבוצות ניווט

```javascript
const GNAV_GROUPS = {
    team:      ['timeclock','shifts','calendar','tasks','academy','members',
                'beauty_calendar','beauty_practitioners','routines'],
    sales:     ['pos','sales','customers','cases','leads','deliveries','reviews',
                'menu_templates','beauty_services','beauty_subscriptions',
                'beauty_clients','beauty_rfq'],
    inventory: ['shop','pantry','equipment','foodcost','beauty_inventory'],
    finance:   ['bank','cashflow','budget','timelog','forecast',
                'beauty_commissions','reports'],
    more:      ['community','surveys','content','documents',
                'biz-ads','whatsapp-alerts','settings']
};
```

**כפתור FEED** — נפרד מהקבוצות, תמיד גלוי.

### `switchTab(t)` — לוגיקת מעבר

1. `window._sportScreenActive = false` — אפוס מצב ספורט
2. redirect: `customers` → `beauty_clients` אם עסק יופי
3. חסימה: `routines` — רק `restaurant` / `maintenance_repair`
4. בדיקת `billing_config` → אם tab לא בתשלום: `openModuleUnlockModal(t)`
5. הסתרת כל ה-content-X divs
6. הצגת `content-{t}` + אנימציה
7. עדכון `updateGroupNavActiveState` + badges
8. הפעלת פונקציה ייעודית לכל tab (ראה סעיף 7-36)

### Tab Rename לפי סוג עסק

| סוג עסק | tab → שם חדש |
|---|---|
| restaurant | customers → 'אורחים', calendar → 'ניהול יומן' |
| healthcare | customers → 'מטופלים', calendar → 'יומן תורים', members → 'צוות רפואי' |
| beauty | customers → 'לקוחות', calendar → 'יומן תורים' |
| sport | customers → 'חברים', members → 'חברי מועדון', calendar → 'לוח אימונים' |
| professional | sales → 'לידים ומכירות', cases → 'תיקים', timelog → 'שעות עבודה', content → 'אתר תדמית', leads → 'פניות נכנסות', documents → 'מסמכים' |

### Badges על הניווט

```javascript
updateGroupNavBadges()
// team:     allTasks.filter(t => t.status === 'pending').length
// sales:    storeOrdersCache.filter(o => o.status === 'new').length
// inventory: pantryCache.filter(p => p.quantity <= p.min_threshold).length
```

---

## 5. מנגנון מנעולים ורישוי מודולים

### שכבת גישה 1 — Role Permissions

`ROLE_DEFAULTS[role]` → רשימת tabs מותרים לפי תפקיד.

### שכבת גישה 2 — Feature Flags

`currentGroup.features` → אובייקט עם flags:
```javascript
{ store:true, b2b:true, academy:true, calendar:true, finance:true,
  inventory:true, crm:true, deliveries:true, foodcost:true, ai:true,
  timeclock:true, cashflow:true, budget:true, forecast:true,
  tasks:true, community:true, members:true, shifts:true }
```
`enforceModule(flag, tabId, moduleName)` — מוסיף/מסיר מנעול ויזואלי.

### שכבת גישה 3 — Billing Config

`currentGroup.billing_config` → `{ bundle_id, modules: [{id, open, billing, custom_price}] }`
- `bundle_id` → טעינת קטלוג ממחשב: `GET /api/biz/pricing-catalog`
- `modules[].open === true` → tab פתוח; אחרת → נעול

`applyBusinessTypeFilter()` → מחשב `openIds` ומעדכן את כל ה-DOM.

### `openModuleUnlockModal(tabId)`

כשמנסים לפתוח tab נעול:
- מציג modal עם: שם, תיאור, מחיר
- כפתור "שלח בקשה": `POST /api/biz/module-request`

---

## 6. סוגי עסקים — BUSINESS_TYPES

15 סוגי עסקים. כל אחד מגדיר:
- `modules[]` — tabs שמופעלים כברירת מחדל
- `BUSINESS_CONFIG` — מינוח מותאם (customer, product, appointment, etc.)

### טבלת סוגי עסקים מלאה

| id | שם | מינוח לקוח | מינוח מוצר | מינוח תור |
|---|---|---|---|---|
| `restaurant` | מסעדה / בית קפה 🍕 | אורח | מנה | שולחן |
| `retail` | חנות קמעונאית 🛍️ | לקוח | מוצר | ביקור |
| `services` | שירותים מקצועיים 💼 | לקוח | שירות | פגישה |
| `construction` | בנייה / קבלנות 🏗️ | מזמין | חומר | פגישת אתר |
| `maintenance_repair` | תחזוקה ותיקונים 🔧 | לקוח | שירות/חלק | קריאת שירות |
| `logistics` | לוגיסטיקה / הפצה 🚚 | לקוח B2B | פריט | חלון מסירה |
| `healthcare` | בריאות / קליניקה 🏥 | מטופל | טיפול | תור |
| `beauty` | יופי / קוסמטיקה 💅 | לקוחה | טיפול/מוצר | תור |
| `education` | חינוך / הדרכה 🎓 | תלמיד | שיעור/קורס | שיעור |
| `sport` | ספורט / כושר 🏋️ | חבר | מנוי/אימון | אימון |
| `events` | אירועים / הפקות 🎉 | מזמין | שירות הפקה | אירוע |
| `food_production` | ייצור מזון 🏭 | לקוח B2B | מוצר | הזמנת ייצור |
| `professional` | מקצועי / ייעוץ 👔 | לקוח | שירות | פגישה |
| `store_only` | חנות בלבד 🏪 | לקוח | מוצר/שירות | — |
| `other` | אחר / כללי 🏢 | לקוח | מוצר/שירות | תור/פגישה |

### `getBizTerm(key)`

```javascript
const term = getBizTerm('customer');
// 'restaurant' → 'אורח'
// 'beauty'    → 'לקוחה'
// 'sport'     → 'חבר'
```

---

## 7. דשבורד ראשי — `feed`

### `renderDashboard()`

**ADMIN רואה:**
- יתרת חשבון עסקי (`admin_total_balance`)
- כרטיסי KPI: הכנסות היום / חודש, הזמנות פתוחות, עובדים פעילים
- `renderFLWSection()` — ארנק FLW עסקי (ענבר)
- `renderGoalsSection()` — יעדים עסקיים
- `renderAdminAcademy()` — סקירת הכשרות

**עובד עם `employee_role_type`:**
- `showRoleDashboard(roleType)` — לוח בקרה ייעודי לתפקיד (ראה סעיף 8)

**עובד ללא role type:**
- `renderMemberBizDashboard()` — דשבורד ממברים בסיסי

### `fetchData()` — Master Loader

```
GET /api/data/:userId?groupId=X
// מחזיר: tasks, quiz_bundles, pantry, shopping_list,
//         goals, group_config, user, all_bundles
```

לאחר קבלה:
- מסנכרן `currentGroup.features`, `billing_config`, `licensed_features`
- `enforcePermissions()` + `applyBusinessTypeFilter()`
- `renderAdminAcademy()` / `renderMyAssignments()`
- `renderTasks()` + `renderPantry()` + `renderShopList()` + `renderShifts()`
- `fetchBudget()` + `renderForecast()`

**Polling:** interval כל 30 שניות.

---

## 8. לוחות בקרה לפי תפקיד — Role Dashboards

### `showRoleDashboard(roleType)`

כאשר `currentUser.employee_role_type` מוגדר ועובד נמצא ב-`feed`:
- מציג `content-role-dashboard` במקום הדשבורד הכללי
- מנפה לפי `roleType` → `renderXDashboard(el)`

### לוחות ייחודיים לסוגי עסקים

| תפקיד | סוג עסק | תוכן לוח הבקרה |
|---|---|---|
| `waiter` | restaurant | פקודות פעילות, שולחן שלי, כפתור POS ייעודי |
| `cook` | restaurant | תורי בישול, מלאי חומרי גלם, food cost |
| `therapist` | beauty | יומן תורים אישי, לקוחות היום, עמלות |
| `field_tech` | maintenance_repair | קריאות שירות שהוקצו, ציוד, מיקום |
| `delivery` | restaurant/retail | משלוחים פעילים, מסלול, סטטוס |
| `cashier` | retail/restaurant | קופה מהירה, מכירות היום |

---

## 9. קופה — `pos`

### תיאור
מערכת קופה דיגיטלית עם קטלוג, עגלה, תשלום ומעקב הזמנות.

### `renderPOSCatalog(categoryId)`

```
GET /api/store/catalog/:groupId?category=X
// מחזיר מוצרים לפי קטגוריה
```

- הצגת כרטיסי מוצר: תמונה + שם + מחיר + כפתור הוסף
- `addToCart(productId)` — הוספה לעגלה בזיכרון
- `currentModifiersUI` — תוספות/גרסאות למוצר

### עגלת קופה

```javascript
renderCart()          // מציג פריטים, כמות, subtotal
removeFromCart(idx)   // הסרת פריט
clearCart()           // ניקוי
applyCartPromotion()  // בדיקת מבצע
```

### גמר עסקה — `submitPOSOrder()`

```
POST /api/store/orders {
  groupId, items:[{productId, qty, price, modifiers}],
  total, paymentMethod, customerId, note
}
```

**paymentMethod:** `cash` / `credit` / `bit` / `check` / `flw`

### KDS — Kitchen Display System

```javascript
openAdminKDSPanel()    // GET /api/store/kds/:groupId
renderKDSPanel(items)  // הצגת תורי בישול
updateKDSItem(id, status) // PATCH /api/store/kds/:id
```

**מצב מסעדה בלבד** — כפתור "מסך מטבח" בתוך feed.

### Waiter POS

```javascript
window.showWaiterPOS()  // ממשק מלצר פשוט
// בוחר שולחן → מזין הזמנה → שולח למטבח
```

---

## 10. מכירות וחנות — `sales`

### Sub-Tabs

| Sub-Tab | תיאור |
|---|---|
| `orders` | הזמנות נכנסות מהחנות הציבורית |
| `quotes` | הצעות מחיר |
| `work-orders` / `אירועים` | פקודות עבודה (חנות/מסעדה) |
| `catalog` | ניהול קטלוג מוצרים |
| `complex` | הזמנות מורכבות (כמויות / B2B) |
| `menutpl` | תפריטים (מסעדה/הפקות בלבד) |

### הסתגלות לסוג עסק (בתוך `switchTab('sales')`)

- **professional:** `switchSalesTab('quotes')` + כותרות מותאמות
- **restaurant:** כותרת "אירועים", כפתור "אירוע חדש" גלוי
- **sport/retail/beauty:** "פקודות עבודה" מוסתרות
- **restaurant/events/food_production:** "תפריטים" גלוי; אחרים — מוסתר

### הזמנות — `switchSalesTab('orders')`

```javascript
fetchStoreOrders()  // GET /api/store/orders/:groupId
renderStoreOrders(orders)
updateOrderStatus(orderId, status)  // PUT /api/store/orders/:id/status
```

**Status Flow:**
`new` → `processing` → `ready` → `shipped`/`delivering` → `completed` / `cancelled`

### הצעות מחיר — `switchSalesTab('quotes')`

```javascript
loadStoreQuotes()  // GET /api/store/quotes/:groupId
renderQuoteCard(q)
createQuote()      // POST /api/store/quotes
sendQuote(id)      // POST /api/store/quotes/:id/send
approveQuote(id)   // PUT /api/store/quotes/:id/approve → יוצר הזמנה
```

### קטלוג מוצרים — `switchSalesTab('catalog')`

```javascript
fetchStoreCatalog()           // GET /api/store/catalog/:groupId
openAddProductModal()
submitProduct()               // POST /api/store/products
toggleProductAvailability()   // PATCH /api/store/products/:id/availability
uploadProductImage()          // Cloudinary
```

שדות מוצר: שם, מחיר, קטגוריה, תיאור, תמונה, `max_qty`, `min_qty`, is_available

### מבצעים

```javascript
loadStorePromotions()         // GET /api/store/promotions/:groupId
openAddPromotionModal()
submitPromotion()             // POST /api/store/promotions
```

סוגי מבצעים: `percent_off`, `fixed_off`, `buy_x_get_y`, `free_shipping`

---

## 11. לקוחות / CRM — `customers`

*ב-beauty מוחלף ל-`beauty_clients`*

### `fetchStoreCustomers()`

```
GET /api/store/customers/:groupId
// מחזיר לקוחות עם: id, name, phone, email, tags, total_spent, last_order
```

### `renderCustomerCard(c)`

- שם + טלפון + תגיות
- סטטיסטיקות: ₪ כולל / מספר הזמנות
- כפתורי: "פרופיל" / "שלח הודעה" / "הוסף תג"

### פרופיל לקוח

```javascript
openCustomerProfile(customerId)
// GET /api/store/customers/:id
// מציג: היסטוריית הזמנות, עמלות, תגים, הערות
addCustomerNote(customerId, text)  // POST /api/store/customers/:id/notes
tagCustomer(customerId, tag)       // POST /api/store/customers/:id/tags
```

### WhatsApp / שליחת הודעה

```javascript
openBizMessageModal(customerId, phone, name)
// deep link wa.me → לא API
```

---

## 12. יומן ותורים — `calendar`

### `window.switchCalendarTab('main')`

Sub-tabs: `main` (יומן), `services` (שירותים), `settings` (הגדרות), `requests` (בקשות תורים)

### `calSettingsCache`

```javascript
{
    is_active: bool,      // האם תורים פתוחים לציבור
    open_time: '09:00',
    close_time: '18:00',
    interval_mins: 30,    // אורך תור
    buffer_mins: 5,       // זמן מאגר
    max_advance_days: 30  // כמה ימים מראש ניתן לקבוע
}
```

### `loadCalendarData(date)`

```
GET /api/calendar/events/:groupId?date=YYYY-MM-DD
// מחזיר אירועים + תורים לתאריך
```

### הוספת אירוע / תור

```javascript
openCalendarEventModal(date, time)
submitCalendarEvent()  // POST /api/calendar/events {
                       //   groupId, title, start, end,
                       //   customerId, serviceId, notes, isPublic
                       // }
```

### שירותים ביומן

```javascript
loadCalendarServices()         // GET /api/calendar/services/:groupId
addCalendarService()           // POST /api/calendar/services
toggleServiceAvailability()   // PATCH /api/calendar/services/:id/toggle
```

### בקשות תורים מלקוחות

```javascript
loadCalendarRequests()           // GET /api/calendar/requests/:groupId
approveCalendarRequest(reqId)    // POST /api/calendar/requests/:id/approve
declineCalendarRequest(reqId)    // POST /api/calendar/requests/:id/decline
```

**תזכורות אוטומטיות**: Twilio SMS שעתיים לפני תור.

---

## 13. משמרות — `shifts`

### `setShiftView(view)` — מצבי תצוגה

- `list` — רשימת משמרות
- `week` — תצוגה שבועית
- `grid` — grid עם כל עובד ← → ימים

### `renderShifts()`

```
GET /api/shifts/:groupId
// מחזיר: shifts[], employees[]
```

### פעולות

```javascript
openShiftModal(date, userId)
submitShift()         // POST /api/shifts {
                      //   userId, groupId, start, end, role, note }
deleteShift(id)       // DELETE /api/shifts/:id
copyShiftWeek()       // POST /api/shifts/copy-week
exportShiftsCSV()     // GET /api/shifts/export?groupId=X
```

### הגנה על פרטיות

עובד רואה **רק את המשמרות שלו**. MANAGER/ADMIN רואים הכל.

---

## 14. נוכחות — `timeclock`

### `checkTimeclockStatus()`

```
GET /api/timeclock/status/:userId
// מחזיר: { isPunchedIn, lastPunchIn, totalToday }
```

### Punch In / Out

```javascript
punchIn()   // POST /api/timeclock/punch-in  { userId, groupId }
punchOut()  // POST /api/timeclock/punch-out { userId, groupId }
```

**ADMIN:** `fetchTimeclockReport()`:

```
GET /api/timeclock/report/:groupId?from=X&to=Y
// מחזיר שעות לכל עובד
```

### `renderTimeclockReport(report)`

- טבלת עובדים: שם, שעות, ימים, ממוצע
- ייצוא: `GET /api/timeclock/export?groupId=X&from=Y&to=Z`

### Overtime Alert

כאשר עובד מעל 10 שעות ביום → badge אדום + toast

---

## 15. רכש ארגוני — `shop`

### `switchProcurementTab(tab)`

| Sub-Tab | תיאור |
|---|---|
| `list` | רשימת פריטים לרכש |
| `suppliers` | מאגר ספקים / B2B |
| `history` | היסטוריית הזמנות |
| `requests` | בקשות רכש ממחלקות |

### רשימת פריטים — `renderShopList()`

דומה ל-FAMILY אבל PRODUCT_DB עסקי:
```javascript
const PRODUCT_DB = {
    "ציוד משרדי 📎": ["נייר צילום A4", "עטים", ...],
    "מחשוב וטכנולוגיה 💻": ["עכבר אלחוטי", ...],
    // + 5 קטגוריות נוספות
}
```

**תיקונים:** הכפתור "ספקים" → "מאגר ספקי חלקים"

### B2B ספקים — `switchProcurementTab('suppliers')`

```javascript
loadSuppliers()        // GET /api/b2b/suppliers/:groupId
openSupplierModal()
submitSupplier()       // POST /api/b2b/suppliers
loadSupplierCatalog(supplierId)  // GET /api/b2b/catalog/:supplierId
addToB2BCart(item)
submitB2BOrder()       // POST /api/b2b/orders
```

`b2bCart = {}` — מנוהל בזיכרון, key=productId, value={qty, price}

---

## 16. ניהול מלאי — `pantry`

### `renderPantry()`

- מציג `pantryCache`
- קיבוץ לפי קטגוריה
- אזהרת מלאי נמוך: `quantity <= min_threshold` → אדום + badge

### פעולות

| פעולה | API |
|---|---|
| הוסף פריט | `POST /api/pantry/add` |
| עדכן כמות | `POST /api/pantry/update` |
| שימוש / ניכוי | `POST /api/pantry/use` |
| מחק | `DELETE /api/pantry/delete/:id` |
| הזמן מספק | מעביר ל-B2B cart |

### מחיקה מרובה

```javascript
togglePantryMultiDelete()
deleteSelectedPantryItems()  // DELETE /api/pantry/delete-multiple
```

---

## 17. תחזוקת ציוד — `equipment`

### `loadEquipment()`

```
GET /api/equipment/items/:groupId
GET /api/equipment/maintenance/:groupId
GET /api/equipment/faults/:groupId
```

### Sub-Tabs

| Sub-Tab | תיאור |
|---|---|
| `items` | פריטי ציוד עם תאריך רכישה ואחריות |
| `maintenance` | תחזוקה מתוכננת |
| `faults` | תקלות פתוחות |
| `contacts` | אנשי קשר לשירות |

### Badge

```javascript
updateEquipmentBadge()
// = faults(open) + maintenance(due_soon)
```

### פעולות

```javascript
submitEquipmentItem()       // POST /api/equipment/items
submitEquipmentMaintenance() // POST /api/equipment/maintenance
submitEquipmentFault()      // POST /api/equipment/faults
// (זהה לתחזוקת הבית ב-FAMILY)
```

---

## 18. כספים — `bank`

### קטגוריות הכנסה / הוצאה (עסקי)

```javascript
const CATEGORIES = {
    income:  ['sales','investment','refund','other'],
    expense: ['office','software','marketing','salary',
              'travel','rent','food','other']
}
```

### פעולות

```javascript
submitTransaction()    // POST /api/transactions/add
editTransaction(id)    // PUT /api/transactions/update/:id
deleteTransaction(id)  // DELETE /api/transactions/delete/:id
exportTransactionsCSV() // GET /api/transactions/export?groupId=X
```

### הלוואות עסקיות

```javascript
submitLoan()    // POST /api/loans/request
approveLoan()   // POST /api/loans/approve/:id
fetchLoans()    // GET /api/loans/:groupId
```

### FLW עסקי

```javascript
loadBizFlowWallet()  // GET /api/biz/flow-wallet/:groupId
// מציג chip ענבר #biz-header-flw-chip
// triggerCoinAnimationBiz(newBalance) — אנימציית מטבעות
```

---

## 19. תזרים — `cashflow`

### `window.switchCfSubTab('cashflow')`

Sub-tabs: `cashflow`, `commissions`

```javascript
renderCashflow()           // גרף הכנסות/הוצאות חודשי
fetchCommissionSummary()   // GET /api/biz/commissions/summary/:groupId
```

### נתונים

```
GET /api/transactions/cashflow?groupId=X&months=6
// מחזיר נתונים מקובצים לפי חודש
```

---

## 20. תקציבים — `budget`

### `fetchBudget()`

```
GET /api/budget?groupId=X
```

### `BUDGET_LABELS`

קטגוריות עסקיות + קטגוריות FAMILY (לתאימות):
```javascript
{ office, software, marketing, salary, travel, rent, food, other,
  allowance:'תקציב מחלקות', tasks:'תגמול פרויקטים',
  academy:'הכשרות', savings:'עתודות',
  // FAMILY categories (backward compat):
  groceries, transport, home, bills, fun, clothes,
  health, education, vacation, pets, gifts }
```

---

## 21. תשקיף — `forecast`

```javascript
renderForecast()
// מצבים: 'monthly' / 'yearly' (currentForecastMode)
// גרף: forecastRatioChart
```

---

## 22. משימות ופרויקטים — `tasks`

### `renderTasks(allTasks)`

**isShiftTask(t):** כותרת מתחילה ב-`SHIFT|` → הצגה כ"משמרת"

### פעולות

```javascript
submitTask()         // POST /api/tasks/add
verifyTask(id)       // POST /api/tasks/verify/:id
rejectTask(id)       // POST /api/tasks/reject/:id
addTaskComment(id)   // POST /api/tasks/:id/comments
uploadTaskProof()    // Cloudinary → POST /api/tasks/upload-proof
```

### AI Tasks

```javascript
generateAITasks()  // POST /api/ai/generate-tasks { groupId, bizType }
```

---

## 23. מרכז הכשרות — `academy`

**ADMIN:** `renderAdminAcademy()` — מוקד הכשרות:
- סקירת הקצאות + ציונים
- `openAssignModal()` → `POST /api/academy/assign`
- `openAssignGameModal()` → `POST /api/academy/assign-game`

**עובד:** `renderMyAssignments(bundlesCache)` + `renderLibrary()`:
- משימות שהוקצו
- `startQuizReview(bundleId)` → `startQuiz(bundleId)` → `finishQuiz()`
- FLW reward על מבחנים שעוברים (לעובדים שהוגדרו בהתאם)

---

## 24. קהילות מחוברות — `community`

### `loadBizCommunities()`

```
GET /api/community/my-communities/:groupId
// מחזיר קהילות שהעסק שייך אליהן
```

### `connectBizToCommunity(communityId)`

```javascript
// POST /api/community/biz-connect
// חיבור העסק לקהילה → מאפשר לקוחות לקבל ממנו הזמנות
```

### פרסום בקהילה

```javascript
submitBizCommunityPost()  // POST /api/community/posts { communityId, ... }
```

---

## 25. תקשורת ועדכונים — `surveys`

### SMS / WhatsApp Campaign

```javascript
openSurveysTab()
loadSurveyRecipients()    // GET /api/biz/survey-recipients/:groupId
sendMassSMS(message)      // POST /api/biz/sms-blast { groupId, message, filter }
sendBulkWhatsApp(message) // deep link (batch)
```

### עדכון צוות פנימי

```javascript
sendTeamUpdate(message, urgency)
// POST /api/biz/team-update { groupId, message, urgency:'low'|'medium'|'high' }
```

---

## 26. ניהול צוות — `members`

### `fetchMembers()`

```
GET /api/members/:groupId
```

### הזמנת עובד

```javascript
openInviteMemberModal()
// מציג group_code + בחירת תפקיד
sendWhatsAppInvite(role)   // wa.me deep link
```

### עריכת עובד — `openEditMemberModal(memberId)`

```javascript
submitEditMember()  // PUT /api/admin/update-member {
                    //   userId, role, permissions: { tabs: [...] },
                    //   employee_role_type, salary
                    // }
```

**`employee_role_type`** — בחירת תפקיד מקצועי מ-`EMPLOYEE_ROLE_TYPES`:
- הגדרה רק ב-ADMIN → מפעיל Role Dashboard לעובד
- רק תפקידים עם `isFeatureLicensed()` זמינים

### מחיקת עובד

```javascript
deleteMember(userId)  // DELETE /api/admin/delete-member/:userId
```

---

## 27. שליחויות — `deliveries`

### `switchDeliveryTab(tab)`

Sub-tabs: `active` / `pending` / `history`

### `fetchDeliveries()`

```
GET /api/deliveries/:groupId?status=active
```

### Courier Polling

```javascript
startCourierPolling()   // polling כל 5 שניות כשב-tab
stopCourierPolling()    // עצירה ביציאה מהtab
```

### Live Map

```javascript
openDeliveryMap(deliveryId)
// הפנייה ל-Waze / Google Maps עם כתובת משלוח
```

### פעולות

```javascript
assignDelivery(orderId, courierId)  // POST /api/deliveries/assign
updateDeliveryStatus(id, status)    // PUT /api/deliveries/:id/status
```

---

## 28. דוחות — `reports`

### `renderUnifiedReportsTab()`

Sub-tabs: `sales`, `employees`, `finance`, `inventory`, `clients`

```javascript
fetchSalesReport(from, to)    // GET /api/reports/sales?groupId=X&from=Y&to=Z
fetchEmployeesReport(from, to) // GET /api/reports/employees?...
fetchFinanceReport(from, to)   // GET /api/reports/finance?...
fetchInventoryReport()         // GET /api/reports/inventory?...
fetchClientsReport()           // GET /api/reports/clients?...
```

**ייצוא:** CSV + PDF (דרך `window.print()`)

---

## 29. מודולי יופי (BEAUTY) — 8 טאבים

### `beauty_calendar` — יומן מטפלות

```javascript
loadBeautyCalendar()   // GET /api/beauty/calendar/:groupId?date=X
```

**Sub-tabs:** `calendar` (תצוגה גרפית), `list` (רשימה), `settings`

```javascript
openBeautyBookingModal(date, time, practitionerId)
submitBeautyBooking()  // POST /api/beauty/bookings {
                       //   clientId, serviceId, practitionerId,
                       //   startTime, endTime, notes, depositAmount }
cancelBeautyBooking(id, reason)  // DELETE /api/beauty/bookings/:id
sendBeautyReminder(bookingId)    // POST /api/beauty/bookings/:id/remind
```

**תצוגת יומן:** תאי 30 דקות לכל מטפלת, drag-and-drop תורים

### `beauty_clients` — תיקי לקוחות (CRM יופי)

```javascript
loadBeautyClients()    // GET /api/beauty/clients/:groupId
openBeautyClientCard(clientId)
// מציג: היסטוריית טיפולים, אלרגיות, העדפות, מנויים פעילים
```

```javascript
submitBeautyClientNotes(clientId, notes)  // POST /api/beauty/clients/:id/notes
addBeautyClientAllergy(clientId, allergy) // POST /api/beauty/clients/:id/allergy
uploadBeautyClientPhoto(clientId)         // Cloudinary
```

**מידע רפואי:** אלרגיות + גרסאות עור — מוצפנות בשרת

### `beauty_inventory` — מלאי מקצועי

```javascript
loadBeautyInventory()  // GET /api/beauty/inventory/:groupId
// פריטי טיפוח: שם, כמות, min_threshold, ספק
```

```javascript
useBeautyProduct(productId, qty, treatmentId)  // POST /api/beauty/inventory/use
orderBeautyProduct(productId)                  // מעביר לB2B cart
```

### `beauty_services` — שירותים וטיפולים

```javascript
loadBeautyServices()   // GET /api/beauty/services/:groupId
// כל שירות: שם, מחיר, משך, קטגוריה, מטפלות מורשות
```

```javascript
addBeautyService()     // POST /api/beauty/services {
                       //   name, price, duration_mins,
                       //   category, allowedPractitioners:[] }
editBeautyService(id)  // PUT /api/beauty/services/:id
```

### `beauty_subscriptions` — מנויים וחבילות

```javascript
loadBeautySubscriptions()  // GET /api/beauty/subscriptions/:groupId
// מנוי = חבילת שירותים ל-X ביקורים / X חודשים
```

```javascript
addBeautySubscription()    // POST /api/beauty/subscriptions
redeemSubscriptionVisit(subId, clientId)  // POST /api/beauty/subscriptions/:id/redeem
cancelSubscription(subId)  // DELETE /api/beauty/subscriptions/:id
```

### `beauty_commissions` — עמלות ושכר

```javascript
loadBeautyCommissions()  // GET /api/beauty/commissions/:groupId?month=X
// מחזיר: לכל מטפלת → רשימת טיפולים + עמלה + סה"כ
```

```javascript
setCommissionRate(practitionerId, rate, type)
// POST /api/beauty/commissions/rates { practitionerId, rate, type:'percent'|'fixed' }
approveMonthlyPayout(practitionerId, month, amount)
// POST /api/beauty/commissions/payout
```

### `beauty_rfq` — ייעוץ ובקשות

```javascript
loadBeautyRfq()        // GET /api/beauty/rfq/:groupId
// פניות לקוחות להצעת מחיר לטיפולים מיוחדים
```

```javascript
respondToRfq(rfqId, proposal)  // POST /api/beauty/rfq/:id/respond
```

### `beauty_practitioners` — ניהול מטפלות

```javascript
loadBeautyPractitioners()  // GET /api/beauty/practitioners/:groupId
// מחזיר מטפלות + לוחות זמנים + התמחויות
```

```javascript
addPractitioner(userId)      // POST /api/beauty/practitioners { userId, specializations:[] }
setPractitionerSchedule(id)  // POST /api/beauty/practitioners/:id/schedule
```

---

## 30. מודולי מסעדה (RESTAURANT) — ייחודיים

### מודולים בלעדיים ל-restaurant

| מודול | תיאור |
|---|---|
| `kds` | Kitchen Display System — תורי בישול במטבח |
| `menu_templates` | ניהול תפריטים דיגיטליים |
| `routines` | שגרות (משותף עם תיקונים) |
| **"אירועים"** | שם מותאם לפקודות עבודה — קייטרינג/אירועים |

### `renderKDSPanel(items)` (line ~9908)

```
GET /api/store/kds/:groupId
// מחזיר הזמנות פתוחות לפי שולחן/תור
```

- כרטיסי הזמנה עם timer (זמן מאז הגיע)
- צבע לפי דחיפות: ירוק (<5 דק) → צהוב (<10 דק) → אדום (>10 דק)
- `markKDSItemReady(itemId)` → PATCH סטטוס

### `loadMenuTemplates()`

```
GET /api/menu-templates/:groupId
// תפריטים דיגיטליים: שם, סוג (QR/PDF/Web), אלמנטים
```

```javascript
createMenuTemplate()      // POST /api/menu-templates
publishMenuTemplate(id)   // POST /api/menu-templates/:id/publish → URL ציבורי
```

---

## 31. מודולי מומחים (PROFESSIONAL) — ייחודיים

### מודולים בלעדיים

| Tab | תיאור |
|---|---|
| `cases` | ניהול תיקי לקוחות |
| `leads` | פניות נכנסות |
| `timelog` | שעות עבודה לחיוב |
| `documents` | מסמכים עסקיים |
| `content` | אתר תדמית |

### `renderCasesTab()`

```
GET /api/professional/cases/:groupId
// תיק = לקוח + סטטוס + ציר זמן + מסמכים
```

```javascript
createCase(clientId, title, description)   // POST /api/professional/cases
updateCaseStatus(caseId, status)           // PUT /api/professional/cases/:id
addCaseNote(caseId, note)                  // POST /api/professional/cases/:id/notes
attachDocumentToCase(caseId, fileUrl)      // POST /api/professional/cases/:id/attach
```

**Status Flow:** `lead` → `proposal` → `active` → `closed` / `won` / `lost`

### `renderProfessionalLeadsTab()`

```
GET /api/professional/leads/:groupId
// פנייה נכנסת = שם + טלפון + מקור + תיאור צורך
```

```javascript
convertLeadToCase(leadId)   // POST /api/professional/leads/:id/convert
assignLead(leadId, userId)  // POST /api/professional/leads/:id/assign
```

### `renderTimelogTab()`

```
GET /api/professional/timelog/:groupId
// שעות מדווחות לפי עובד ופרויקט
```

```javascript
logHours(caseId, hours, description, date)
// POST /api/professional/timelog
generateInvoiceFromTimelog(caseId, from, to)
// POST /api/professional/timelog/invoice → PDF
```

### `renderDocumentsTab()`

```
GET /api/professional/documents/:groupId
// מסמכים: חוזים, הצעות, דוחות
```

```javascript
uploadDocument(file)         // Cloudinary → POST /api/professional/documents
shareDocument(docId, email)  // POST /api/professional/documents/:id/share
```

### `renderProfessionalContentTab()`

עמוד נחיתה עסקי:
```javascript
loadContentPageData()  // GET /api/professional/content/:groupId
saveContentSection()   // PUT /api/professional/content/:groupId { sections:[] }
publishContentPage()   // POST /api/professional/content/:groupId/publish → URL ציבורי
```

---

## 32. מודולי ספורט (SPORT) — ייחודיים

### `window._sportScreenActive`

דגל המונע `renderDashboard` מלרנדר מחדש כשנמצאים בתוך "מסך ספורט" מוטמע ב-feed.

### דשבורד ספורט

```javascript
renderSportDashboard()
// KPIs: מנויים פעילים, אימונים היום, הכנסה חודשית
// כפתורי פעולה מהירה: "רשם חבר", "שבץ אימון", "עדכן מנוי"
```

### מנויים (כחברים)

```javascript
fetchSportMembers()    // GET /api/sport/members/:groupId
openMemberModal()
submitSportMember()    // POST /api/sport/members {
                       //   name, phone, membershipType, startDate, endDate, photo }
renewMembership(id)    // POST /api/sport/members/:id/renew
freezeMembership(id)   // POST /api/sport/members/:id/freeze
```

### לוח אימונים (Calendar)

- `TAB_RENAME.sport.calendar` → "לוח אימונים"
- `calServicesCache` — סוגי אימונים: יוגה / כוח / ריצה / אישי
- בקשת תור → שיבוץ ב-`calendar` הרגיל

### הכנסות מנויים

- `pos` — גבייה מנוי חדש
- `sales` — "הרשמות" ו"מנויים" (לא "הזמנות")

---

## 33. מודולי תיקונים (MAINTENANCE_REPAIR) — ייחודיים

### קריאות שירות — מרכז המודול

```javascript
loadServiceCalls()    // GET /api/service-calls/:groupId
renderServiceCallCard(call)
openServiceCallModal(callId)
// סטטוס: open → assigned → in_progress → resolved → closed
```

### הקצאת טכנאי

```javascript
assignTechnician(callId, techId)  // POST /api/service-calls/:id/assign
```

### שגרות — `renderRoutinesTab()`

*משותף עם restaurant*:

```
GET /api/routines/:groupId
// שגרה = כותרת + תדירות (יומי/שבועי/חודשי) + עובד + checklist
```

```javascript
submitRoutine()           // POST /api/routines
completeRoutineItem(id)   // POST /api/routines/:id/complete
```

### מינוח

- tab `shop` → **"מאגר ספקי חלקים"**
- `getBizTerm('customer')` → 'לקוח'
- `getBizTerm('appointment')` → 'קריאת שירות'

### timelog

- מופעל ל-maintenance_repair (ראה `BUSINESS_TYPES.modules`)
- חיוב שעות לכל קריאת שירות

---

## 34. מודולי קמעונאות (RETAIL) — ייחודיים

### מאפיינים ייחודיים

- `pos` + `sales` + `pantry` + `customers` — ליבה
- `bank` — ניהול כספים מלא (כולל ב-modules בניגוד לחלק מסוגי העסקים)
- אין `calendar` — אין תורים/פגישות
- אין `foodcost` — לא עסק מזון

### מדיניות Stock

```javascript
lowStockAlert(productId)  // badge אדום כשstock < min_qty
autoReorderAlert()        // ADMIN מקבל התראה
```

### לקוחות (CRM)

```javascript
fetchStoreCustomers()  // GET /api/store/customers/:groupId
// tab מוצג כ-"לקוחות 🤝" (ללא rename)
```

### דוחות מכירות

```javascript
fetchSalesReport()  // דוח מכירות + מוצרים נמכרים ביותר
```

---

## 35. פרסום FLOW — `biz-ads`

### `renderBizAdsTab()`

```
GET /api/biz/ads/:groupId
// מחזיר: ad slots שרכש העסק + ביצועים
```

```javascript
purchaseAdSlot(slotType, duration)   // POST /api/biz/ads/purchase
editAdCreative(adId, content, image) // PUT /api/biz/ads/:id
pauseAd(adId) / resumeAd(adId)      // PATCH /api/biz/ads/:id/status
```

**סלוטים:** `home_banner`, `feed_inline`, `community_sidebar`, `kol_haam_banner`

**KPIs:** חשיפות, קליקים, CTR, המרות

---

## 36. הגדרות — `settings`

### `renderSettingsHub()`

hub מרכזי עם קטגוריות:

```javascript
// קטגוריות:
openBizProfileSection()     // שם, לוגו, תיאור, כתובת
openBizTypeSection()        // שינוי סוג עסק (ADMIN בלבד!)
openPaymentSection()        // הגדרת אמצעי תשלום
openStoreSettingsSection()  // הגדרות חנות: משלוח, שעות, מדיניות
openNotificationsSection()  // הגדרת התראות
openIntegrationsSection()   // חיבורים: Twilio, Cloudinary, WhatsApp
openMyPlanSection()         // `renderMyPlanSection()`
openPWASection()            // `setupPwaInstallSection()`
```

**שינוי סוג עסק:**
```javascript
updateBizType(typeId)   // PUT /api/biz/update-type
// CLAUDE.md כלל 5: רק כאן + בויזארד הראשוני / SA
```

### `renderMyPlanSection()`

```javascript
// מציג billing_config הנוכחי
// כרטיסי bundle זמינים מ-/api/biz/pricing-catalog
// כפתורי "שדרג" → openModuleUnlockModal
```

---

## 37. AI Features

| פונקציה | Endpoint | תיאור |
|---|---|---|
| `getBusinessAIAdvice(childId, goalId)` | `POST /api/ai/biz-advice` | המלצות לעסק |
| `generateAITasks()` | `POST /api/ai/generate-tasks` | הצעות משימות |
| `getAIForecast()` | `POST /api/ai/forecast` | תחזית תזרים |
| `getAIBudgetInsight()` | `POST /api/ai/budget-insight` | ניתוח תקציב |
| `generateAIQuiz()` | `POST /api/ai/quiz` | שאלון הכשרה |
| `askBizTutor()` | `POST /api/ai/biz-tutor` | עוזר עסקי |
| `analyzeProductCost()` | `POST /api/ai/food-cost` | ניתוח עלויות מנה |

### AI Battery

```javascript
updateBatteryUI()
// is_premium → "⚡ ∞ (Pro)"
// standard → "⚡ X/10"
// empty → openAIBatteryModal()
```

---

## 38. SA Impersonation Mode

### `checkImpersonationMode()`

```javascript
// בדיקת session.isImpersonating === true
// אם עסק — redirect ל-/business.html
// הצגת #impersonation-warning-bar (אדום, top:0, fixed)
```

**Warning Bar מציג:**
- שם העסק שצופים בו
- כפתור "רענן נתונים" → `refreshImpersonatedBusiness()`
- כפתור "מזער" → pill צף אדום
- כפתור "התנתקות" → `exitImpersonationMode()`

**`window._parentPreviewMode`:** כאשר SA מציג אקדמיה — מדלג על שליחת תוצאות ו-FLW.

---

## 39. Onboarding Wizard

### `showOnboardingWizard()` (line 19726)

ויזארד הקמה ראשוני — 5 שלבים:

1. **סוג עסק** — בחירה מ-BUSINESS_TYPES (היחיד המקום!)
2. **פרטי עסק** — שם, לוגו, כתובת, טלפון
3. **הגדרות ראשוניות** — שעות, שפה, מטבע
4. **הזמנת עובד ראשון** — קוד הצטרפות
5. **סיום** — tour + קישורים לדוקומנטציה

**שמירה לשרת:**
```javascript
// כל שלב: PUT /api/biz/onboarding-step { step, data }
// סיום: POST /api/biz/onboarding-complete { groupId }
// → currentGroup.is_onboarded = true
```

**כפתור "פתח אשף הקמה"** (לאחר onboarding):
מוצג בפרופיל ADMIN דרך `fetchData()`:
```javascript
// `#btn-reopen-wizard-biz` → showOnboardingWizard()
```

---

## 40. מנגנונים טכניים רוחביים

### Token זיהוי

```javascript
window._bizToken   // JWT נשמר ב-localStorage ב-ofl_session
```

### `_saveSession(user, group, token)` (BIZ)

```javascript
localStorage.setItem('ofl_session', JSON.stringify({ user, group, token }));
```

### `communityFetch(url, opts)`

```javascript
// מוסיף Authorization header אוטומטית — same as FAMILY
```

### Toast / Loader / Sanitize

```javascript
showToast(type, message)      // 'success'|'error'|'info'
toggleLoader(action, show)    // כפתורי אקשן
escHtml(str)                  // XSS protection
safeStr(str)                  // HTML attributes
jsAttrStr(str)                // onclick="" — בריחה עם \' ולא &#39;
```

### `formatTimeAgo(dateStr)` / `cldOptimize(url, opts)`

זהה ל-FAMILY (פונקציות משותפות).

### PWA

```javascript
setupPwaInstallSection()
// iOS: הוראות שיתוף
// Android: deferredPrompt.prompt()
```

### Polling

```javascript
pollInterval = setInterval(fetchData, 30000)  // 30 שניות
// + courier polling: כל 5 שניות כש-tab deliveries פעיל
// + KDS auto-refresh: כל 15 שניות כש-panel פתוח
```

---

*מסמך זה מתאר את סביבת BIZ בלבד, כולל כל 6 סוגי העסקים שביקשת: מסעדה, תיקונים, יופי, ספורט, מומחים, קמעונאות.*
*מסמכים מקבילים: FAMILY_ENV_SPEC.md · SA_ENV_SPEC.md · ZM_ENV_SPEC.md*
