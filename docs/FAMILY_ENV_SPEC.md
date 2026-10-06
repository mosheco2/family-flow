# סביבת FAMILY — מפרט טכני מלא
**Oneflow Life · מנתח מערכות · עומק מקסימלי**
גרסה: אוקטובר 2026

---

## תוכן עניינים

1. [זהות הסביבה](#1-זהות-הסביבה)
2. [כניסה ואוטנטיקציה](#2-כניסה-ואוטנטיקציה)
3. [תפקידי משתמש](#3-תפקידי-משתמש)
4. [מבנה הניווט — Tabs](#4-מבנה-הניווט--tabs)
5. [פיד ראשי — feed](#5-פיד-ראשי--feed)
6. [רשימת קניות — shop](#6-רשימת-קניות--shop)
7. [מזווה — pantry](#7-מזווה--pantry)
8. [כספים — bank](#8-כספים--bank)
9. [תזרים — cashflow](#9-תזרים--cashflow)
10. [תקציבים — budget](#10-תקציבים--budget)
11. [תשקיף — forecast](#11-תשקיף--forecast)
12. [משימות — tasks](#12-משימות--tasks)
13. [אקדמיה — academy](#13-אקדמיה--academy)
14. [מתכונים — recipes](#14-מתכונים--recipes)
15. [חברי קבוצה — members](#15-חברי-קבוצה--members)
16. [קהילה — community](#16-קהילה--community)
17. [הזמנות שלי — myorders](#17-הזמנות-שלי--myorders)
18. [תחזוקת הבית — home-maintenance](#18-תחזוקת-הבית--home-maintenance)
19. [כול-העם — kol-haam](#19-כול-העם--kol-haam)
20. [מרקטפלייס — marketplace](#20-מרקטפלייס--marketplace)
21. [ארנקות FLW](#21-ארנקות-flw)
22. [AI Features](#22-ai-features)
23. [PWA ונגישות](#23-pwa-ונגישות)
24. [מצב SOLO](#24-מצב-solo)
25. [מנגנונים טכניים רוחביים](#25-מנגנונים-טכניים-רוחביים)

---

## 1. זהות הסביבה

| פרמטר | ערך |
|---|---|
| **שם** | FAMILY |
| **URL** | `/` → `index.html` |
| **JS הראשי** | `public/app.js` (~18,750 שורות) |
| **מטרה** | ניהול חיי המשפחה — כספים, קניות, משימות, חינוך ילדים, קהילה |
| **קהל יעד** | הורים (ADMIN), ילדים (CHILD), וחברי בית (MEMBER) |
| **קבוע גלובלי API** | `const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api'` |

### קבועים גלובליים (State)

```javascript
let currentUser = null;          // אובייקט המשתמש המחובר
let currentGroup = null;         // אובייקט הקבוצה (family_groups row)
let pollInterval = null;         // interval ל-fetchData כל 30 שניות
let membersCache = [];           // כל חברי הקבוצה
let shoppingListCache = [];      // רשימת קניות
let pantryCache = [];            // מחסן
let bundlesCache = [];           // quiz bundles (metadata בלבד — ללא שאלות)
let allBundles = [];
let allTasks = [];               // משימות
let allTransactions = [];        // פעולות בנקאיות
let feedCache = [];              // פוסטים בפיד קהילה
let forecastCache = { startingBalance:0, items:[] };
let kidFlwBalance = 0;           // יתרת FLW ילד (לא ADMIN)
let familyFlowBalance;           // יתרת FLW משפחה (ADMIN בלבד)
window._currentFamilyTab = '';   // ה-tab הפעיל כרגע
```

### טבלות DB עיקריות לסביבה

`family_groups`, `users`, `transactions`, `budget_allocations`, `loans`, `tasks`, `shopping_list`, `shopping_trips`, `pantry`, `quiz_bundles`, `quiz_questions`, `user_assignments`, `flow_wallets`, `flw_kid_wallets`, `game_sessions`, `community_posts`, `family_communities`, `store_orders`, `time_clock`, `goals`

---

## 2. כניסה ואוטנטיקציה

### שיטת אחסון

**JWT** נשמר ב-localStorage:
- `ofl_family_token` — הטוקן לשימוש ב-API calls
- `ofl_session` — אובייקט מלא: `{ user, group, token }`
- `ofl_logo_{group.id}` — לוגו קבוצה (נפרד כדי לא לנפח את ה-session)

### שיטות כניסה

#### א. SMS OTP
```
loginPhoneSendOtp()
  ↓ POST /api/auth/send-otp { phone }
  ↓ Twilio שולח SMS
  ↓ loginPhoneVerifyOtp()
  ↓ POST /api/auth/verify-otp { phone, code }
  ↓ תשובה: { options: [...accounts] } — כמה חשבונות לאותו טלפון
  ↓ _loginPhoneSelectOption(opt) — בחירת חשבון
  ↓ loginPhoneSubmitPassword()
  ↓ saveSession(user, group, token)
  ↓ loadDashboard()
```

#### ב. מייל + סיסמה
```
handleLogin(e)
  ↓ POST /api/auth/login { email, password }
  ↓ saveSession(user, group, token)
  ↓ redirect: BUSINESS → /business.html | FAMILY → loadDashboard()
```

#### ג. SSO Token (מחנות עסק)
```
URL: /?sso_token=xxx
  ↓ GET /api/family/sso-login?token=xxx
  ↓ בדיקת ביטחון: group.type !== 'BUSINESS' (חסימה)
  ↓ שמירת session + loadDashboard()
```

#### ד. קישור הזמנה
```
URL: /?code=XXXX&role=CHILD
  ↓ auto-fill בטופס הצטרפות
  ↓ switchView('join')
```

#### ה. קישור רפרל
```
URL: /?ref=CODE
  ↓ localStorage.setItem('ofl_referral_code', CODE)
  ↓ ישמש ביצירת חשבון חדש
```

### Failsafe Timer
אם הטעינה נכשלת — timeout של 7 שניות מציג את מסך הכניסה.

### saveSession()
```javascript
function saveSession(u, g, token) {
    currentUser = u; currentGroup = g;
    localStorage.setItem('ofl_family_token', token);
    const slim = { user: u, group: g, token };
    localStorage.setItem('ofl_session', JSON.stringify(slim));
}
```

### getFamilyToken() / communityFetch()
```javascript
// כל קריאת API עוברת דרך communityFetch שמוסיפה Authorization header
function communityFetch(url, opts = {}) {
    const token = getFamilyToken();
    if (token) opts.headers = { ...(opts.headers||{}), 'Authorization': `Bearer ${token}` };
    return fetch(url, opts);
}
```

### מצבי חשבון מיוחדים
| `account_status` | טיפול |
|---|---|
| `pending_activation` | ADMIN רואה `showSoloActivationModal()` — הגדרת סיסמה ראשונה |
| `frozen` | `showFrozenAccountScreen(daysLeft)` — מסך נעילה עם ספירה לאחור |
| `archived` | מסך "החשבון בארכיון" |

---

## 3. תפקידי משתמש

| תפקיד | תיאור | הגבלות |
|---|---|---|
| `ADMIN` | הורה / מנהל הקבוצה | גישה לכל הטאבים, כל הפעולות |
| `MEMBER` | חבר בית בוגר | ללא members, ללא פעולות ניהוליות |
| `CHILD` | ילד/ה | ממשק ילד מותאם, ארנק FLW אישי |

### הבדלים ויזואליים לפי תפקיד

**ADMIN בלבד:**
- ארנק FLW משפחתי (ענבר)
- לשונית `members`
- כפתורי `payday` לחלוקת דמי כיס
- ספריית quiz bundles (renderLibrary)
- `loadFlwKidParentPanel()` בטאב `bank`
- `renderAdminAcademy()` — סקירת כל ילדי הקבוצה
- `loadKidsOverview()` — נתוני כל ילד
- פעולות הלוואות (approveLoan)
- אפשרות "ייצא CSV"

**CHILD בלבד:**
- `renderKidGames()` במקום ספרייה
- `renderChildTodo()` — רשימת to-do פשוטה
- `renderChildDashboard()` — דשבורד ילד
- ארנק FLW אישי (סגול)
- `loadChildFlwWallet()` בטאב `bank`
- קנייה בחנות אסורה (חסומה)

**MEMBER:**
- `renderMemberDashboard()` — דשבורד עובד/חבר
- גישה מוגבלת לפי `applyMemberLocks()`
- `loadMemberSettings()` — טעינת הגדרות חבר

---

## 4. מבנה הניווט — Tabs

### רשימת Tabs (**בסדר הופעה**)

```javascript
['feed','tasks','shop','myorders','bank','cashflow','community',
 'marketplace','academy','members','budget','pantry','recipes',
 'forecast','home-maintenance','kol-haam']
```

### `switchTab(t)` — לוגיקת המעבר

כל מעבר:
1. מסתיר את כל ה-content divs
2. מסיר `tab-active` מכל הכפתורים
3. מוסיף `tab-anim` לתוכן החדש (אנימציית כניסה)
4. מפעיל פונקציה ייעודית לפי tab:

| Tab | פעולה בכניסה |
|---|---|
| `shop` | `renderShopList()` |
| `pantry` | `renderPantry()` |
| `recipes` | `renderRecipePantrySelection()` |
| `forecast` | `renderForecast()` |
| `cashflow` | `renderCashflow()` + `fetchCashflowData()` |
| `budget` | `fetchBudget()` |
| `community` | `fetchCommunityData()` |
| `marketplace` | `loadMarketplaceTab()` |
| `myorders` | `switchMyOrdersTab()` + `fetchMyOrders()` + `loadFamilyServiceCalls()` + `startMyOrdersAutoRefresh()` |
| `home-maintenance` | `loadHomeMaintenance()` |
| `members` | `renderSoloFamilyLinkSection()` |
| `academy` | ADMIN → `renderLibrary()` / אחר → `renderKidGames()` |
| `bank` | CHILD → `loadChildFlwWallet()` / ADMIN → `loadFlwKidParentPanel()` |
| `kol-haam` | `openKolHaamOverlay()` (iframe) |

### Polling — רענון אוטומטי

```javascript
// loadDashboard() מפעיל interval של 30 שניות:
pollInterval = setInterval(() => {
    fetchData();      // כל הנתונים הראשיים
    fetchLoans();     // הלוואות
    if (isAdmin) fetchPendingUsers(); // בקשות הצטרפות ממתינות
}, 30000);
```

---

## 5. פיד ראשי — `feed`

### תיאור
מסך הבית — מציג תמונת מצב של כל הפעילות הקבוצתית.

### תוכן הפיד (`buildAndRenderFeed` / `renderUnifiedFeed`)

**ADMIN רואה:**
- יתרת חשבון משפחתי
- קופות ילדים (יתרת כל ילד)
- משימות פתוחות לאישור
- סיכום קניות אחרון
- יעדי חיסכון
- הלוואות פנדינג
- FLW balance (ענבר)

**CHILD רואה:**
- `renderChildDashboard()`:
  - יתרת הכיס האישית
  - משימות שהוקצו לו/ה
  - `renderChildTodo()` — to-do list פשוטה
  - ארנק FLW אישי (סגול)
  - כפתורי משחק מהאקדמיה

**MEMBER רואה:**
- `renderMemberDashboard()` — ממשק מינימלי

### Ads Slots בפיד

```javascript
fetchAds()           // GET /api/ads/all
applyAdsToDOM()      // מפיץ את הפרסומות לסלוטים
```
סלוטים: `home_banner`, `home_splash`, `feed_inline`

Splash: מוצג פעם ב-session לכל משתמש כולל אנונימי.

### Banner

```javascript
fetchBanners()       // GET /api/banners
applyBannersToDOM()  // מציב בנרים בפיד ראשי
```

### Welcome Modal

`checkGlobalWelcome()` — בדיקה אחת-לפר-session:
- `localStorage.getItem('ofl_welcome_{userId}_{groupCode}')` — אם לא נראה → מציג modal
- טקסט welcome מותאם אישית שה-SA מגדיר

### Tour הדרכה — Intro.js

`checkAndStartTour()` → `showFamilyTour()` / `startAdminTour()` / `startChildTour()`
- טור שלב-אחר-שלב עם הדגשת אלמנטים
- מפנה לטאב הרלוונטי בכל שלב
- `forceTourStart = true` → מפעיל גם ללא גישה ראשונה

---

## 6. רשימת קניות — `shop`

### תיאור
ניהול רשימת קניות שיתופית של הקבוצה.

### מצב נורמלי — "בית"

**הוספת פריט (`submitShopItem`):**
```
POST /api/shopping/add { itemName, quantity, unit, estimatedPrice, userId, groupId }
```
- בחירת יחידות: יח' / ק"ג / ל' / ג' / מ"ל / קרטון
- `units_per_package` — כמה יחידות באריזה (לחישוב עלות)
- זיהוי אוטומטי קטגוריה דרך `getCatScore()` + `PRODUCT_DB`

**ספר מוצרים מוגדר מראש (`PRODUCT_DB`):**
7 קטגוריות, ~50 מוצרים נפוצים:
- ירקות ופירות, חלב וביצים, לחם, מזווה, בשר ודגים, ניקיון, חטיפים

**renderShopList():**
- קיבוץ פריטים לפי קטגוריה
- סימון "קנינו" / "חסר בספק"
- `calcRunningTotal()` — חישוב סה"כ רץ בזמן אמת
- Footer סטיקי עם סכום + "לקופה"

**מחיקה מרובה:**
```javascript
toggleShopMultiDelete()   // מצב בחירה
deleteSelectedShopItems() // DELETE /api/shopping/delete-multiple
```

**העתקת רשימה קיימת:**
```javascript
openSavedListsModal() → loadSavedLists()    // GET /api/shopping/saved-lists
saveCurrentList()                           // POST /api/shopping/save-list
copyList(tripId)                            // POST /api/shopping/copy
```

**הדבקת רשימה (AI Parse):**
`submitPastedList()` — מדביק טקסט חופשי, AI מנתח לפריטים

**ייצוא לוואטסאפ:**
`exportShopToWhatsApp()` — מייצר טקסט מפורמט לשיתוף

### מצב AI קניות

```javascript
openAiShoppingModal() → POST /api/ai/shopping-list
renderAiShopList(categories)
confirmAiShoppingList() // מוסיף את כולם
```

### מצב סופרמרקט — Real-Time Shopping

**הפעלה:** `openSupermarketMode()` / `openSupermarketModeWithAd()`

**מצב מיוחד** — ממשק מינימלי מותאם לשימוש בסופרמרקט:
- `renderSupermarketList()` — רשימה לפי קטגוריות, כל פריט עם checkbox
- `smToggleItem(id)` — סימון קניה, מציג שדה מחיר
- `smConfirmPrice(id)` / `smSkipPrice(id)` — אישור / דילוג על מחיר
- `smCalcTotal()` — חישוב סה"כ
- `smQuickAdd()` — הוספה מהירה של פריט חדש
- `smToggleMissing(id)` — סימון "לא היה"
- `startSmFastPoll()` — polling כל 5 שניות כדי לקבל תוספות של חברי בית

**Supermarket Banner:** `renderSmBanner(groupData)` — מציג לוגו ומידע של הסופרמרקט

### Checkout (`submitFinalCheckout`)

```
POST /api/shopping/checkout {
  items: [{id, price, inCart}],
  storeName, totalAmount,
  groupId, userId
}
```

**מה קורה בשרת:**
1. יוצר `shopping_trips` record
2. מעדכן כל `shopping_list` item ל-`status=done`
3. יוצר `transaction` (הוצאה בקטגוריה `groceries`)
4. מעביר פריטים שסומנו ל-`pantry`

### סריקת קבלה (OCR)

`handleReceiptUpload(event)`:
- תמונת קבלה → `POST /api/ai/scan-receipt`
- Gemini מנתח את הקבלה → מחזיר פריטים + מחירים
- `showReceiptReviewModal(items, storeName)` — אישור המשתמש
- `confirmReceiptItems()` → מוסיף ל-shopping list

---

## 7. מזווה — `pantry`

### תיאור
מעקב אחר מלאי הבית. מוזן ידנית או ב-checkout אוטומטי.

### `renderPantry()`

- מציג רשימה מ-`pantryCache`
- קיבוץ לפי קטגוריה (אותה לוגיקה כמו shop)
- לחיצה → `openPantryUseModal()` — "השתמשתי בX יחידות"

### פעולות

| פעולה | API |
|---|---|
| הוסף פריט | `POST /api/pantry/add` |
| עדכן כמות | `POST /api/pantry/update` |
| גרע שימוש | `POST /api/pantry/use` → מעדכן `quantity - used` |
| מחק | `DELETE /api/pantry/delete/:id` |
| העבר לרשימת קניות | `movePantryToCart()` → `POST /api/shopping/add` + `DELETE /api/pantry/delete` |

### מחיקה מרובה

```javascript
togglePantryMultiDelete()
deleteSelectedPantryItems() // DELETE /api/pantry/delete-multiple
```

---

## 8. כספים — `bank`

### תיאור
ניהול פיננסי: הכנסות, הוצאות, הלוואות, יעדי חיסכון, דמי כיס.

### נתונים נטענים ב-fetchData()

```javascript
GET /api/transactions?groupId=X&userId=Y&limit=200
// מחזיר: transactions[], weekly_stats, loans[], goals[]
```

### קטגוריות הכנסות (6)
`salary, allowance, bonus, gift, business, other`

### קטגוריות הוצאות (13)
`food, groceries, transport, home, bills, fun, clothes, health, education, vacation, pets, gifts, other`

### `BUDGET_LABELS` — מיפוי קטגוריה → תווית עברית
גם קטגוריות מיוחדות: `allocations, allowance, tasks, academy, savings`

### פעולות

| פעולה | API |
|---|---|
| הוספת פעולה | `POST /api/transactions/add { userId, groupId, amount, description, category, type, date }` |
| עריכת פעולה | `PUT /api/transactions/update/:id` |
| מחיקת פעולה | `DELETE /api/transactions/delete/:id` |
| ייצוא CSV | `GET /api/transactions/export?groupId=X` |

### הלוואות

```javascript
submitLoan()      // POST /api/loans/request { lenderId, borrowerId, amount, reason }
approveLoan()     // POST /api/loans/approve/:id
rejectLoan()      // POST /api/loans/reject/:id
fetchLoans()      // GET /api/loans/:groupId
```

**מחזור חיים:** `pending` → `active` → `paid`

### יעדי חיסכון (Goals)

```javascript
submitGoal()      // POST /api/goals { userId, targetUserId, title, target }
submitDeposit()   // POST /api/goals/deposit { goalId, amount }
```

- ADMIN יכול להגדיר יעד עבור ילד (`targetUserId`)
- `getFamilAIAdvice(childId, goalId)` — ייעוץ AI לגבי יעד ספציפי

### דמי כיס (Allowance) — ADMIN בלבד

```javascript
openBankSettings(userId)  // הגדרת allowance + ריבית
submitBankSettings()      // POST /api/admin/update-settings
triggerPayday()           // POST /api/admin/payday — חלוקה מיידית לכולם
openAdjustBalanceModal()  // ניכוי / הוספה ידנית
submitBalanceAdjustment() // POST /api/admin/adjust-balance
```

### פאנל FLW בטאב bank

**ADMIN:** `loadFlwKidParentPanel()`:
- רואה יתרת FLW של כל ילד
- `openFlwKidConfig(childId)` — הגדרת ערך ₪ לFLW + מקסימום יומי
- `openApproveKidRedeem(childId)` — אישור בקשת פדיון

**CHILD:** `loadChildFlwWallet()`:
- מציג יתרת FLW אישית
- `openKidRedeemModal()` — בקשת פדיון ל-₪
- `updateKidRedeemPreview(val)` — חישוב ערך בזמן אמת

---

## 9. תזרים — `cashflow`

### תיאור
תצוגת הכנסות מול הוצאות על ציר זמן.

### `fetchCashflowData()`

```
GET /api/transactions/cashflow?groupId=X&months=6
// מחזיר נתונים מקובצים לפי חודש
```

### `renderCashflow()`

- גרף קו חודשי / שנתי
- מציג: הכנסות (ירוק), הוצאות (אדום), יתרה (כחול)
- חשוב: `forecastCache.startingBalance` — נקודת התחלה לחישוב יתרה

---

## 10. תקציבים — `budget`

### תיאור
הגדרת מגבלה תקציבית לכל קטגוריה + מעקב ביצוע.

### `fetchBudget()`

```
GET /api/budget?groupId=X
// מחזיר: allocations[], spending_by_category[]
```

### רכיבי ממשק

- כל קטגוריה: שם + שורת progress bar (הוצאה / מגבלה)
- צבע: ירוק (< 70%) → צהוב (70%-90%) → אדום (> 90%)
- לחיצה → `openBudgetModal(catId, catName, currentLimit)`
- `submitBudgetUpdate()` → `PUT /api/budget/update/:id`

### הוספת קטגוריה חדשה

```javascript
openAddBudgetCategoryModal()
submitNewBudgetCat() // POST /api/budget/add
```

### קטגוריות מיוחדות (לא הוצאות רגילות)

`allocations` — הפרשות כלליות
`allowance` — דמי כיס לילדים
`tasks` — תגמול על משימות
`academy` — אתגרי אקדמיה
`savings` — הפקדות לחיסכון

---

## 11. תשקיף — `forecast`

### תיאור
תחזית פיננסית חודשית / שנתית.

### מצבים

```javascript
window._forecastMode = 'monthly' | 'yearly'
toggleForecastMode(mode)
```

### `renderForecast()`

משתמש ב-`forecastCache`:
- `startingBalance` — יתרה נוכחית
- `items` — כל הפעולות החוזרות העתידיות

מחשב: יתרה צפויה לכל חודש/שנה, כולל הכנסות + הוצאות חוזרות.

**גרף יחס:** `forecastRatioChart` — חישוב הכנסות:הוצאות.

---

## 12. משימות — `tasks`

### תיאור
מערכת משימות ותגמול לכל חברי הקבוצה.

### סוגי משימות

| סוג | תיאור |
|---|---|
| **רגילה** | הקצאה ל-user + תגמול כספי + deadline + עדיפות |
| **"מעשה טוב"** | ללא תגמול, ממתין לאישור הורה |
| **AI מוצעת** | Gemini מציע משימות לפי גיל/מטרה |
| **Self** | יצירת משימה לעצמי (isSelf=true) |

### `openTaskModal(isSelf = false)`

שדות: כותרת, תגמול (₪), עדיפות (low/medium/high/critical), deadline, assigned_to, תיאור, AI check.

**עדיפות:** `setFamilyTaskPriority(p)` → צבע ויזואלי + ערך

**AI Check:** `toggleAiCheck()` — האם Gemini יבדוק הוכחת ביצוע בתמונה

### `submitTask()`

```
POST /api/tasks/add {
  createdBy, assignedTo, title, reward, priority,
  deadline, description, aiCheck, groupId
}
```

### `renderTasks(tasks)`

**ADMIN רואה:**
- כל המשימות
- משימות ממתינות לאישור (פס כתום)
- כפתורי "אשר" / "דחה" / "ערוך"

**CHILD רואה:**
- משימות שהוקצו לו/ה
- `renderChildTodo()` — רשימת to-do פשוטה
- כפתורי "סיימתי" / "שלח הוכחה"

### מחזור חיים

```
pending → done (ע"י המבצע) → verified (ADMIN אישר + תגמול) → rejected
```

**תגמול בשלב verified:**
```
POST /api/tasks/update { taskId, status:'verified' }
```
השרת: UPDATE tasks + INSERT transaction (income + category='tasks')

### הוכחת ביצוע — Cloudinary

```javascript
clickFamilyTaskProofCloudinary(taskId)
handleFamilyTaskProofCloudinaryUpload(event)
// POST /api/tasks/upload-proof { taskId, imageUrl }
```

### AI Verification

אם `aiCheck = true`:
```
POST /api/ai/verify-task { imageUrl, taskTitle }
// Gemini אומר אם התמונה מוכיחה את ביצוע המשימה
```

### הערות על משימה

```javascript
openFamilyTaskComments(taskId)
loadFamilyTaskComments(taskId)  // GET /api/tasks/:id/comments
addFamilyTaskComment()          // POST /api/tasks/:id/comments
```

### AI Tasks

```javascript
generateAITasks() → POST /api/ai/generate-tasks { groupId, childAge, goals }
// Gemini מחזיר 3-5 הצעות משימות
selectAITask(title, reward) // ממלא את הטופס
```

---

## 13. אקדמיה — `academy`

### תיאור
מערכת חינוכית: שאלונים, משחקים ואתגרים לילדים.

### הבדל ADMIN / ילד

| תפקיד | תצוגה |
|---|---|
| ADMIN | `renderLibrary()` + `renderAdminAcademy()` + `loadKidsOverview()` |
| CHILD / MEMBER | `renderKidGames()` + `loadKidAcademy()` + `renderMyAssignments()` |

### ניהול ADMIN

#### `renderAdminAcademy()`
- סטטוס כל ילד: מוקצים / הושלמו / הושלמו לאחרונה
- כפתור "הקצה שאלון"
- דוח שבועי (`openWeeklyReport()`)

#### `loadKidsOverview()`
```
GET /api/academy/kids-overview/:groupId
// מחזיר לכל ילד: assignments, scores, FLW earned
```

#### `openKidDetailModal(kidId)`
- פרטי ילד מלאים
- כל הקצאות + ציונים + יתרות
- תמונת פרופיל (`uploadKidProfileImage`)

#### הקצאת שאלון

```javascript
openAssignModal()
// טופס: bundleId, userId, deadline, customReward
submitAssignQuiz() // POST /api/academy/assign
```

#### `openAssignGameModal()`
- בחירת משחק + רמה + מספר סיבובים
- `selectGameForAssign()`, `selectLevelForAssign()`, `setRounds()`
- `submitGameAssignment()` → POST /api/academy/assign-game

#### Quest Wizard (`openQuestWizard()`)
יצירת שאלון מותאם אישית בצעדים:
1. בחירת נושא
2. יצירת שאלות
3. תצוגה מקדימה
4. הקצאה

#### ספריית Quests ציבורית

```javascript
openQuestLibrary()           // GET /api/quest-library
filterQLib()                 // GET /api/quest-library?topic=X&age=Y
useLibQuest(questId)         // POST /api/quest-library/:id/use → יוצר bundle מקומי
```

### ממשק ילד — `renderKidGames(assignments)`

מציג כרטיסי "משימה" לכל assignment פעיל:
- כותרת + FLW reward + deadline
- כפתור "פתח" → `startQuizReview(bundleId)`

#### `loadKidAcademy()`

```
GET /api/academy/my-assignments/:userId
// מחזיר assignments עם bundle metadata (ללא שאלות)
```

### תהליך מבחן — שלב 1: ביקורת

```javascript
async function startQuizReview(bundleId) {
    // שלב 1: שולף שאלות מה-API (לא מהcache)
    GET /api/academy/bundles/:id
    // מוציא זוגות מילה ← תרגום מהשאלות
    // מציג כרטיסיות flash-card
    // כפתורי: → (הבא) / ← (קודם) / "התחל מבחן"
}
```

**אנטומיה של כרטיסייה:**
```
[הבא ←] [כרטיסייה: מילה בעברית | תרגום] [→ קודם]
[התחל מבחן]
```

### תהליך מבחן — שלב 2: חידון

```javascript
async function startQuiz(bundleId) {
    // שולף שאלות מ-API שוב (fresh)
    currentQuizData = { ...bundleMeta, questions }
    // מסתיר text_content, מציג quiz-runner-modal
    renderQuestion()
}
```

#### `renderQuestion()`
- שאלה + 4 אפשרויות
- `submitAnswer(selectedIdx)` → שמירת התשובה + renderQuestion הבאה

#### `finishQuiz()`

```javascript
// חישוב ציון
const finalScore = (correct / total) * 100;
const passed = finalScore >= currentQuizData.threshold;

if (!window._parentPreviewMode) {
    // שליחה לשרת
    POST /api/academy/submit { userId, bundleId, score, passed }

    // FLW לילדים בלבד
    if (passed && currentUser.role !== 'ADMIN') {
        const flwReward = Math.max(5, Math.min(20,
            Math.round((customReward || defaultReward || 10) * 1.5)));
        POST /api/kids/award-flw {
            userId, gameId: null, score, flwEarned: flwReward, durationSeconds: 0
        }
        // אנימציית מטבעות + עדכון header
    }
    fetchData();
}
```

**`_parentPreviewMode`:** כשה-SA מציג מבחן כ"הדגמה" — מדלגת על שליחה ופרסים.

### משחקים בסביבת ילדים

```javascript
openGame(assignmentId, gameFilePath, childName, flwPerRound, gameId, startLevel, financeAge, roundsTotal)
// פותח iframe מלא-מסך עם המשחק
// postMessage בין iframe לחלון האב
closeGame()
// showGameCompleteMessage(gameData, roundResult)
// playCoinAnimation(flwEarned, callback)
previewGameAsParent(gameFilePath, gameId, gameTitle, financeAge) // הורה רואה בלי לשחק
```

---

## 14. מתכונים — `recipes`

### תיאור
Gemini מציע מתכון לפי מה שיש במזווה.

### `renderRecipePantrySelection()`
- מציג checkboxes של כל פריטי המזווה
- `selectAllRecipePantry()` — בחרל הכל
- `toggleRecipeCustomInput()` — הוספת מרכיב חופשי

### `generateRecipe()`

```
POST /api/ai/recipe {
    ingredients: [...selectedItems, ...customItems],
    portions: X
}
// Gemini מחזיר מתכון מפורט
```

### `copyRecipe()`
מעתיק את המתכון ל-clipboard.

---

## 15. חברי קבוצה — `members`

### תיאור
ניהול חברות, הזמנות, קישור SOLO.

### `renderSoloFamilyLinkSection()`

כשהקבוצה היא SOLO (חשבון יחיד):
- מציג אפשרות חיפוש + שליחת "בקשת קישור" למשפחה
- `_soloLinkSearch(query)` → `GET /api/family/search-by-phone?phone=X`
- `_sendLinkRequest(targetGroupId)` → `POST /api/family/link-request`
- `checkIncomingLinkRequests()` → `GET /api/family/link-requests/:groupId`
- `showLinkRequestPopup(req)` — popup לאישור/דחייה
- `_respondLinkRequest(reqId, 'accept'/'decline')`

### הזמנת חבר (`openInviteModal`)

- מציג `group_code` של הקבוצה
- `sendWhatsAppInvite(role)` → קישור wa.me עם הקוד וה-role
- `shareReferralLink()` → קישור רפרל ייחודי

### `fetchMembers()`

```
GET /api/members/:groupId
// מחזיר כל חברי הקבוצה עם פרטים + יתרות
```

---

## 16. קהילה — `community`

### תיאור
פיד חברתי-קהילתי — פוסטים, אינטראקציות, קבוצות עניין.

### `fetchCommunityData()` — טעינת נתונים

```
GET /api/community/data/:groupId
// מחזיר: communities[], unread counts
```

### פיד פוסטים

```javascript
fetchFeedPosts(reset = false)   // GET /api/community/feed?communityId=X&before=Y
loadFeedUnreadCounts()          // GET /api/community/unread-counts
markFeedRead(communityId)       // POST /api/community/mark-read
```

### `renderPostCard(post)`

פוסט מציג:
- שם המפרסם + avatar + תאריך
- תוכן טקסטואלי + תמונה (אופציונלי)
- כפתורי: ❤️ לייק / 💬 הערות / 📤 שיתוף

### אינטראקציות

```javascript
toggleFeedLike(postId)    // POST /api/community/like/:postId
openFeedComments(postId)  // GET /api/community/comments/:postId
submitComment(postId)     // POST /api/community/comments/:postId
showLikersList(postId)    // GET /api/community/likers/:postId
shareToWhatsApp(postId)   // deep link wa.me
reportFeedPost(postId)    // POST /api/community/report/:postId
```

### פרסום פוסט חדש

```javascript
openNewPostModal()
selectPostType(btn, type)   // text / image / link / event / promo
previewPostImage(input)     // Cloudinary
submitNewPost()             // POST /api/community/posts { communityId, type, content, imageUrl }
```

### קבוצות עניין

```javascript
openInterestGroupsPanel()
loadInterestGroupsForComm(communityId)  // GET /api/community/interest-groups/:commId
joinInterestGroup(groupId, commId)      // POST /api/community/interest-groups/join
leaveInterestGroup(groupId, commId)     // POST /api/community/interest-groups/leave
openCreateGroupModal()
submitCreateGroup()                     // POST /api/community/interest-groups
openGroupMembersModal(groupId)
addFamilyToGroup / removeFamilyFromGroup
```

### חיפוש בפיד

```javascript
runFeedSearch()   // GET /api/community/feed?search=X
clearFeedSearch()
```

### פילטרים

```javascript
renderFeedCommunityFilters()  // פילטר לפי קהילה
loadGroupFilters(communityId) // פילטר לפי קבוצת עניין
setFeedFilter(type, id)
```

### Deep Link לפוסט

```javascript
checkPostDeepLink()  // ?post=X → פותח ישירות את הפוסט
highlightFeedPost(postId)
```

### Load More

```javascript
loadMoreFeedPosts()  // fetchFeedPosts(false) — append
```

---

## 17. הזמנות שלי — `myorders`

### תיאור
ניהול כל ההזמנות שהמשפחה ביצעה מחנויות עסקים + קריאות שירות.

### Sub-Tabs

| Sub-Tab | תיאור |
|---|---|
| `orders` | הזמנות מחנויות |
| `activities` | פעילויות מעסקים מחוברים |
| `faults` | קריאות שירות פתוחות |
| `quotes` | בקשות הצעת מחיר |

### `fetchMyOrders()`

```
GET /api/store/orders/my/:userId
// מחזיר הזמנות לפי userId
```

### `renderMyOrders()`

- `applyOrdersFilter()` — פילטר: חיפוש / תקופה / מיון
- `_renderOrderItems(items)` — פרטי מוצרים בהזמנה
- כרטיס הזמנה: מספר + שם עסק + סטטוס + סכום + כפתורי פעולה

### Status Flow (עם תרגום)

```javascript
const statusMap = {
    pending_approval: 'ממתין לאישור',
    new:              'התקבל בעסק ✅',
    processing:       'בהכנה 🍳',
    ready:            isDelivery ? 'מוכן לשליחה 📦' : 'מוכן לאיסוף 🏃',
    shipped:          isDelivery ? 'בדרך אליך 🛵' : 'מוכן לאיסוף ✅',
    delivering:       isDelivery ? 'בדרך אליך 🛵' : 'מוכן לאיסוף ✅',
    completed:        'הושלם ✅',
    cancelled:        'בוטל ❌'
}
```

### Auto-Refresh

`startMyOrdersAutoRefresh()` — interval כל 3 שניות (כשהטאב פעיל):
- משווה status עם `_previousOrdersCache`
- אם השתנה → `showOrderStatusToast()` + badge counter
- `bell-badge` — counter קריאות שלא נקראו

### אישור קבלה

```javascript
confirmOrderReceipt(orderId, received)
// POST /api/store/orders/:id/confirm-receipt { received: true/false }
```

### `_toggleBizAccordion(btn, bizGroupId, bizType)`

Accordion לפי עסק → `_renderBizAccordion()`:
- מציג היסטוריית הזמנות
- `_switchBizTab()` — tabs בתוך הaccordion: הזמנות / פגישות / שירות
- `_memberLoadOrders()`, `_memberLoadQuotes()`, `_memberLoadNotifications()`

### `_bizQuickActions(bizGroupId, bizType, bizName, groupCode)`

כפתורי פעולה מהירה לפי סוג עסק:
- מסעדה: "הזמן שולחן" → `_tableReservationModal()`
- יופי: "קביעת תור" → ממשק יופי
- תיקונים: "פתח קריאת שירות" → `openServiceCallWizard()`
- כללי: "שלח הודעה" → `_bizMessageModal()`

### תורים ושולחנות

```javascript
_tableReservationModal(bizGroupId, bizName)
_loadTableAvailabilityForModal(bizGroupId, date, preSelectedTime)
    // GET /api/calendar/availability/:groupId?date=X
_submitTableReservation(bizGroupId, bizName, btn)
    // POST /api/calendar/events { ... }
```

### הצעות מחיר (`quotes`)

```javascript
loadFamilyQuotes()            // GET /api/store/quotes/family/:groupId
renderFamilyQuotesTab()
openFamilyQuoteView(quoteId)  // מציג פרטי ציטוט מלאים
_fqvOpenRequest / _fqvSubmitRequest / _fqvRespond
```

### ביקורות

```javascript
_orderRatingModal(orderId, bizGroupId)
_setRatingStar(val)
_submitOrderRating(orderId, bizGroupId) // POST /api/store/orders/:id/rate
```

### פעילויות (`activities`)

```javascript
loadMyActivities()  // GET /api/family/my-activities/:groupId
_actFilter(btn)     // סינון לפי סוג
_actSearch(q)       // חיפוש
_actRender()        // עדכון ה-DOM
_actRespond(linkId, 'accept'/'decline')
```

---

## 18. תחזוקת הבית — `home-maintenance`

### תיאור
מעקב אחר ציוד בית, תקלות, איש קשר לתחזוקה.

### Sub-Tabs

| Sub-Tab | תיאור |
|---|---|
| `items` | פריטי ציוד וריהוט |
| `maintenance` | תיזמון תחזוקה מתוכננת |
| `faults` | תקלות ובעיות |
| `contacts` | אנשי קשר לשירות |

### `loadHomeMaintenance()`

```javascript
fetchHMMaintenance()  // GET /api/equipment/maintenance/:groupId
fetchHMFaults()       // GET /api/equipment/faults/:groupId
fetchHMContacts()     // GET /api/equipment/contacts/:groupId
updateHMBadge()       // badge counter בtab
```

### Badge

`updateHMBadge()` — ספירת תקלות פתוחות + תחזוקה שהגיע זמנה → `tab-home-maintenance-badge`

### פריטי ציוד (`items`)

```javascript
openHMItemModal(id = null)  // טופס חדש/עריכה
submitHMItem()              // POST /api/equipment/items
deleteHMItem(id)            // DELETE /api/equipment/items/:id
filterHMMaintenance(f)
openHMHistory(itemId)       // GET /api/equipment/history/:itemId
```

### תחזוקה מתוכננת (`maintenance`)

```javascript
openHMMaintenanceModal(id = null)
submitHMMaintenance()       // POST /api/equipment/maintenance
completeHMMaintenance(id)   // POST /api/equipment/maintenance/:id/complete
deleteHMMaintenance(id)     // DELETE /api/equipment/maintenance/:id
```

### תקלות (`faults`)

```javascript
openHMFaultModal(id = null)
handleHMFaultImage(input)   // Cloudinary
submitHMFault()             // POST /api/equipment/faults
openHMFaultStatusPopup(faultId)
submitHMFaultStatus()       // PATCH /api/equipment/faults/:id/status
openHMAddNote(faultId)
submitHMNote()              // POST /api/equipment/faults/:id/notes
```

**חומרה:** `low / medium / high / critical`
**סטטוס:** `open / in_progress / resolved`

### קריאות שירות עסקיות (`renderBusinessServiceCallsTab`)

מציג קריאות שירות שנפתחו מול עסקים:
```javascript
loadFamilyServiceCalls()  // GET /api/family/service-calls/:groupId
openFamilyCallModal(callId)
sendFamilyScMessage(callId)   // POST /api/service-calls/:id/message
cancelFamilyServiceCall(callId)
rateFamilyServiceCall(callId, rating)
openServiceCallWizard(technicianId)  // ויזארד פתיחת קריאה חדשה
submitServiceCallWizard()  // POST /api/service-calls
```

### אנשי קשר (`contacts`)

```javascript
openHMContactModal(id = null)
submitHMContact()   // POST /api/equipment/contacts
deleteHMContact(id)
```

---

## 19. כול-העם — `kol-haam`

### תיאור
פלטפורמת קריאה ופרסום תוכן קהילתי. נטען כ-**iframe** בתוך overlay מלא-מסך.

### `openKolHaamOverlay()`

```javascript
// יוצר div overlay + iframe
src = `/kol-haam?userId=X&groupId=Y&communityId=Z&role=admin|member&communityName=NAME`
// postMessage API:
// KH_CLOSE → closeKolHaamOverlay()
// OPEN_URL → window.open()
```

### `closeKolHaamOverlay()`

```javascript
ov.style.display = 'none';  // לא מוחק — שומר state
switchTab('feed');
```

---

## 20. מרקטפלייס — `marketplace`

### תיאור
גלישה בחנויות עסקים מהקהילה.

### `loadMarketplaceTab()`

```
GET /api/community/businesses/:communityId
// מחזיר עסקים פעילים בקהילה עם קטגוריה ותמונה
```

### `openMarketplaceHistory(groupId, token)`

```
GET /api/marketplace/history/:groupId?token=X
// היסטוריית הזמנות מעסק ספציפי
```

---

## 21. ארנקות FLW

### שני מנגנונים נפרדים לחלוטין

#### ארנק משפחתי (ADMIN)

| פרמטר | ערך |
|---|---|
| מסד | `flow_wallets (entity_type='family', entity_id=group.id)` |
| טעינה | `loadFamilyFlowWallet()` |
| מציג | chip ענבר `#header-flw-chip` |
| מוגן | `if (currentUser.role !== 'ADMIN') return` |
| מזין | רכישות מחנויות עסקים |

#### ארנק ילד (CHILD)

| פרמטר | ערך |
|---|---|
| מסד | `flw_kid_wallets (child_user_id=user.id)` |
| טעינה | `loadKidFLWWallet()` |
| מציג | widget סגול `#kid-flw-widget` + chip `#header-flw-chip` |
| מזין | מבחנים שעוברים + משחקים |
| פדיון | `openKidRedeemModal()` → בקשה לADMIN → `approveKidRedeem()` |

#### אנימציית מטבעות

```javascript
function triggerCoinAnimation(newBalance) {
    // 7 מטבעות 🪙 עפים ל-header chip
    // transition: 0.7s cubic-bezier
    // סיום: עדכון מספר + scale animation
}
```

---

## 22. AI Features

### `familAI` — יועצת AI

```javascript
showFamilAIModal(title, text)  // modal עם תשובה
openAIModal()                  // בחירת סוג שאילה
openContentPicker()            // בחירת נושא
```

**כל ה-endpoints:**

| פונקציה | Endpoint | תיאור |
|---|---|---|
| `getBudgetInsight()` | `POST /api/ai/budget-insight` | ניתוח הוצאות + המלצות |
| `getPantryInsight()` | `POST /api/ai/pantry-insight` | מה לבשל |
| `generateAITasks()` | `POST /api/ai/generate-tasks` | הצעות משימות |
| `generateRecipe()` | `POST /api/ai/recipe` | מתכון ממרכיבים |
| `generateAIQuiz()` | `POST /api/ai/quiz` | שאלון אנגלית |
| `getFamilAIAdvice(childId, goalId)` | `POST /api/ai/advice` | ייעוץ לגבי ילד ויעד |
| `getBudgetInsight()` | `POST /api/ai/budget-insight` | תקציב |
| `askTutor()` | `POST /api/ai/tutor` | עוזר שיעורים |

### AI Battery

```javascript
updateBatteryUI()          // מציג כמה שאילות נותרו
handleAIResponseCheck()    // בדיקה אם הbattery אפסה
closeAiBatteryModal()
upgradeToPremium()
```

---

## 23. PWA ונגישות

### PWA

```javascript
setupPwaInstallSection()
// iOS: מציג הוראות Share + Add to Home Screen
// Android: deferredPrompt.prompt() → התקנה ישירה
```

### Service Worker

`sw.js` — cache strategy:
- Cache-first לresources סטטיים
- Network-first לAPI calls

### נגישות (`initAccessibility()`)

```javascript
accState = {
    'text-lg': false,        // טקסט מוגדל
    'grayscale': false,      // גווני אפור
    'contrast': false,       // ניגודיות גבוהה
    'readable-font': false,  // גופן קריא
    'highlight-links': false // הדגשת קישורים
}
// שמור ב-localStorage ומשוחזר בטעינה
```

---

## 24. מצב SOLO

### מהו SOLO?
חשבון יחיד שנוצר ע"י עסק עבור לקוח — ממתין לאישור.

```javascript
// בloadDashboard():
if (currentGroup?.account_status === 'pending_activation' && currentUser?.role === 'ADMIN') {
    showSoloActivationModal();
    return;
}
if (currentGroup?.plan === 'solo' && currentUser?.role === 'ADMIN') {
    // מציג אפשרות קישור למשפחה
}
```

### `showSoloActivationModal()`
- Overlay עם בחירת סיסמה ראשונה
- `POST /api/solo/activate { groupId, password }`
- לאחר אקטיבציה: `account_status = 'active'`

### `renderSoloFamilyLinkSection()`

```javascript
_soloLinkSearch(query)    // GET /api/solo/search-by-phone?phone=X
_sendLinkRequest(targetGroupId)  // POST /api/family/link-request
```

---

## 25. מנגנונים טכניים רוחביים

### `fetchData()` — הפונקציה המרכזית

```
GET /api/dashboard/family/:groupId
// מחזיר הכל בקריאה אחת:
{
  transactions, tasks, shopping_list, pantry,
  members, goals, loans, budget, bundles,
  weekly_stats, family_flow_wallet
}
```

לאחר קבלה מריצה:
```javascript
renderTasks(allTasks)
renderPantry()
renderShopList()
renderForecast()
renderAdminAcademy() // אם ADMIN
buildAndRenderFeed()
```

### Toast Notifications

```javascript
showToast(type, message)
// type: 'success' | 'error' | 'info'
// מוצג 3.5 שניות
```

### Loader Buttons

```javascript
toggleLoader(actionName, show)
// מסתיר/מציג btn-{actionName}-text / btn-{actionName}-loader
```

### escHtml / safeStr / jsAttrStr

```javascript
function escHtml(str)       // לתוכן HTML — מנטרל XSS
function safeStr(str)       // לתוכן HTML attributes
function jsAttrStr(str)     // ל-onclick="" attributes — בורח עם \' לא &#39;
```

### `formatTimeAgo(dateStr)`

```javascript
// מחזיר "לפני X דקות" / "לפני X שעות" / "לפני X ימים"
```

### `cldOptimize(url, { w, q })`

```javascript
// מוסיף Cloudinary transformations ל-URL
// w: 800 (ברירת מחדל), q: 'auto:best'
```

---

*מסמך זה מתאר את סביבת FAMILY בלבד. מסמכים מקבילים: BIZ_ENV_SPEC.md · SA_ENV_SPEC.md · ZM_ENV_SPEC.md*
