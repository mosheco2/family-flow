# מסמך אפיון — סביבת FAMILY | Oneflow Life

> גרסה: 2026-06-20 | מבוסס על קוד: `public/app.js`, `public/index.html`, `server1.js`

---

## 1. ארכיטקטורה וכניסה

### 1.1 זהות הסביבה

| פרמטר | ערך |
|---|---|
| URL | `/` (root) — `index.html` |
| קובץ HTML | `public/index.html` |
| קובץ JS ראשי | `public/app.js` |
| סוג קבוצה (DB) | `type = 'FAMILY'` |
| שם מוצר | Oneflow Life |
| כתובת ייצור | `https://www.oneflowlife.co.il` |

**4 סביבות במערכת:**
- `FAMILY` (`/`) — האפליקציה למשפחות (מסמך זה)
- `BUSINESS` (`/business.html`) — לעסקים
- `SUPER-ADMIN` — פאנל ניהול מערכת
- `ZONE-MANAGER` — מנהל קהילה / אזור

**ניתוב אוטומטי:** בעת login, אם `currentGroup.type === 'BUSINESS'` → המערכת מנתבת לאוטומטית ל-`/business.html`.

### 1.2 תהליך כניסה (Login Flow)

**שלב 1 — Preloader:** מציג ספינר עם לוגו בעת טעינה. timeout failsafe של 7 שניות.

**שלב 2 — בדיקת session קיים:**
```
localStorage.getItem('ofl_session')
→ JSON.parse → אם קיים ותקף → loadDashboard()
→ אחרת → hidePreloaderAndShowAuth('login')
```

**3 מסכי Auth:**

| מסך | תיאור |
|---|---|
| `view-login` | כניסה עם קוד סביבה + כינוי + סיסמה |
| `view-create` | הקמת סביבה חדשה (משפחה או עסק) |
| `view-join` | הצטרפות לסביבה קיימת עם קוד |

**טופס Login (POST /api/login):**
- `groupCode` — קוד הסביבה (6 תווים, אותיות+ספרות, UPPERCASE)
- `nickname` — כינוי המשתמש
- `password` — סיסמה

**טופס Create (POST /api/groups):**
- סוג: FAMILY / BUSINESS
- שם המשפחה / העסק
- מייל מנהל
- שם פרטי + שם משפחה
- כינוי משפחה (אופציונלי)
- שנת לידה
- מספר טלפון (חובה מגיל 10)
- סיסמה
- אישור תקנון (חובה)
- הסכמת שיווק (רשות)

**טופס Join (POST /api/join):**
- קוד כניסה
- שם
- שנת לידה
- טלפון (חובה מגיל 10)
- סיסמה
- אישור תקנון

לאחר Join — נשלחת בקשה לאישור מנהל. המשתמש נכנס למצב `status: 'pending'`.

**URL Invite:** `/?code=XXXXX&role=MEMBER` — ממלא אוטומטית את הטופס.

**OTP:** מיושם עבור Super Admin בלבד (Twilio SMS). לא בשימוש בסביבת FAMILY.

### 1.3 אחרי Login — loadDashboard()

1. מסתיר `auth-container`, מציג `dashboard-container`
2. שולף session מ-localStorage
3. מציג שם הקבוצה + קוד + שם המשתמש
4. מגדיר הרשאות לפי role (ADMIN / MEMBER/CHILD)
5. מפעיל polling כל 30 שניות (`fetchData`, `fetchLoans`, אם ADMIN → `fetchPendingUsers`)
6. מפעיל `refreshBellBadge` כל 30 שניות
7. מפעיל `startMyOrdersAutoRefresh` (כל 20 שניות, רק כשב-myorders tab)
8. קורא `fetchBanners`, `fetchMembers`, `fetchData`, `fetchLoans`
9. בדיקת `must_change_password` → הצגת דף שינוי סיסמה
10. בדיקת הודעת welcome גלובלית (`checkGlobalWelcome`)
11. הפעלת Tour `checkAndStartTour(forceTourStart)`

### 1.4 מבנה currentUser ו-currentGroup

```javascript
currentUser = {
  id: INT,
  nickname: STRING,
  first_name: STRING,
  last_name: STRING,
  birth_year: INT,
  role: 'ADMIN' | 'MEMBER',          // MEMBER = ילד/ה
  balance: DECIMAL,
  allowance_amount: DECIMAL,
  interest_rate: DECIMAL,
  permissions: { tabs: ['feed', ...] },
  email: STRING,
  id_number: STRING,
  must_change_password: BOOLEAN,
  status: 'approved' | 'pending'
}

currentGroup = {
  id: INT,
  name: STRING,
  family_nickname: STRING,
  group_code: STRING,              // 6 תווים
  type: 'FAMILY',
  admin_email: STRING,
  ai_tokens: INT,                  // 0-10 (מתאפס יומי)
  is_premium: BOOLEAN,
  community_id: INT | null,
  member_type: 'family' | 'member', // חבר קהילה vs. משפחה מלאה
  unlocked_modules: ARRAY,
  created_at: TIMESTAMP
}
```

### 1.5 תפקידים — ADMIN vs CHILD/MEMBER

| יכולת | ADMIN | CHILD/MEMBER |
|---|---|---|
| ניהול חשבונות ילדים | ✅ | ❌ |
| PayDay (חלוקת דמי כיס) | ✅ | ❌ |
| יצירת משימות | ✅ | ❌ |
| יצירת אתגרי אקדמיה | ✅ | ❌ |
| הגדרת תקציב | ✅ | ❌ (צפייה בלבד) |
| אישור בקשות הצטרפות | ✅ | ❌ |
| עריכת עסקאות | ✅ | ❌ |
| אישור משימות + תגמול | ✅ | ❌ |
| בקשת הלוואה | ❌ | ✅ |
| פתיחת יעד חיסכון | ❌ | ✅ |
| "מעשה טוב" (self task) | ❌ | ✅ |
| בקשת קנייה | ✅ | ✅ |
| צפייה ביתרה אישית | ✅ (יתרת הקבוצה) | ✅ (יתרה אישית) |
| Barcode/סריקת קבלה | ✅ | ❌ |

---

## 2. ניווט וטאבים

### 2.1 Family Group NAV — 4 קבוצות

הניווט הראשי (`#family-group-nav`) ממוקם בראש המסך, רקע כהה (`bg-slate-900`):

| כפתור | קבוצה | תת-טאבים |
|---|---|---|
| **ראשי** | direct | feed (Dashboard) |
| **בית** | dropdown `home` | קניות 🛒, הזמנות שלי 🛍️, מזווה 📦, שף AI 👨‍🍳, ניהול הבית 🔧 |
| **כסף** | dropdown `money` | בנק 🏦, תזרים 💸, תקציב 📊, תשקיף 📅 |
| **משפחה** | dropdown `family` | משימות ✅, אקדמיה 🎓, קהילה 🏘️, ניהול 👥 |

Badges בניווט:
- `fgnav-badge-home` — amber — פריטי קניות ממתינים
- `fgnav-badge-family` — red — משימות/בקשות ממתינות
- `fgnav-bell-badge` — red — התראות פעמון

### 2.2 switchTab(t)

מסתיר את כל ה-`content-*` divs, מציג `content-{t}`:

```javascript
switchTab(t) {
  // מסתיר כל content-X
  // מציג content-{t}
  // מוסיף animation class 'tab-anim'
  // לוגיקה לפי tab:
  //   'shop' → renderShopList()
  //   'pantry' → renderPantry()
  //   'recipes' → renderRecipePantrySelection()
  //   'forecast' → renderForecast()
  //   'cashflow' → renderCashflow()
  //   'community' → fetchCommunityData()
  //   'myorders' → switchMyOrdersTab + fetchMyOrders + loadFamilyServiceCalls
  //   'home-maintenance' → loadHomeMaintenance()
}
```

רשימת כל הטאבים: `feed, tasks, shop, myorders, bank, cashflow, community, academy, members, budget, pantry, recipes, forecast, home-maintenance`

---

## 3. מודולים — פירוט מלא

### 3.1 Dashboard / Feed ראשי (`content-feed`)

**מטרה:** מסך הבית — מציג יתרה, פעילות, משימות ממתינות, ופיד פעולות משפחתי.

**רכיבי UI:**
- **מה מחכה לך עכשיו** (`#family-urgent-section`) — badge עם ספירה, רשימת פריטים דחופים
- **CHILD HOME HEADER** (מוצג לילדים בלבד) — כרטיס סגול עם יתרה, כפתורי "בקשת קנייה" ו"אתגר אקדמיה"
- **כרטיס יתרה** (`#tour-balance-card`) — gradient כחול-אינדיגו, מציג יתרה כספית
  - ADMIN: מציג `admin_total_balance` (יתרה כוללת של הקבוצה)
  - CHILD: מציג `currentUser.balance` (יתרה אישית)
- **Quick Tiles** (`#quick-tiles`) — 6 כרטיסי קישור מהיר (JS מרנדר)
- **פיד פעילות** (`#unified-feed-list`) — פיד מאוחד מסונן לפי user/תאריך

**אלמנטים בפיד (buildAndRenderFeed):**
1. הודעת פתיחת סביבה (system event)
2. תנועות עובר ושב (transactions)
3. משימות מאושרות
4. חידוני אקדמיה
5. עדכוני קהילה

**פילטרים בפיד:**
- לפי משתמש (`feed-user-filter`) — מוסתר כברירת מחדל
- לפי תאריך (`feed-date-filter`) — הכל / חודש אחרון / 3 חודשים

**Child-specific:**
- `#child-todo-section` — רשימת "לביצוע" (משימות ממתינות + אתגרי אקדמיה)
- `#child-home-footer` — 3 כפתורי ניווט מהיר: חיסכון, היסטוריה, קהילה

---

### 3.2 בנק משפחתי (`content-bank`)

**מטרה:** ניהול חשבונות ילדים, דמי כיס, הלוואות ויעדי חיסכון.

**תצוגת ADMIN (`bank-admin-view`):**
- **PayDay Panel** — כפתור "בצע PayDay" לחלוקת דמי כיס + ריבית לכל הילדים בלחיצה אחת
- **רשימת חשבונות ילדים** (`#bank-accounts-list`)
- **בקשות הלוואה ממתינות** (`#admin-loans-panel`) — מוסתר כשאין הלוואות
- **יעדי חיסכון** (`#admin-goals-list`) — עם radial progress + כפתור "טיפ מ-familAI"

**תצוגת CHILD (`bank-child-view`):**
- **כרטיס אשראי** — עיצוב dark, מציג:
  - דמי כיס שבועיים (`card-allowance`)
  - ריבית (`card-interest`)
  - מצב בזבוז השבוע (progress bar, מגבלת 20%)
  - שם בעל החשבון
- **כפתורי פעולה:**
  - "בקש הלוואה" → `openLoanModal()`
  - "יעד חיסכון" → `openGoalModal()`
- **יעדים שלי** (`#my-goals-container`) — radial progress per goal
- **הלוואות שלי** (`#my-loans-list`)

**API Endpoints:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/admin/payday` | ביצוע PayDay |
| GET | `/api/loans` | שליפת הלוואות |
| POST | `/api/loans/request` | בקשת הלוואה |
| POST | `/api/loans/approve` | אישור הלוואה |
| POST | `/api/loans/reject` | דחיית הלוואה |
| POST | `/api/goals` | יצירת יעד חיסכון |
| POST | `/api/goals/deposit` | הפקדה ליעד |
| POST | `/api/goals/familai-advice` | ייעוץ AI ליעד |
| POST | `/api/admin/adjust-balance` | התאמת יתרה ידנית |
| POST | `/api/admin/update-settings` | עדכון הגדרות דמי כיס/ריבית |

---

### 3.3 תזרים (`content-cashflow`)

**מטרה:** צפייה ועריכה של כל הפעולות הפיננסיות.

**רכיבי UI:**
- הסבר: "כאן ניתן לראות ולערוך את כל הפעולות הפיננסיות מהעבר"
- פילטר לפי משתמש (`#cashflow-user-filter`) — מוצג רק ל-ADMIN
- פילטר לפי תאריך: כל הזמן / חודש אחרון / 3 חודשים
- `#cashflow-list` — רשימת תנועות

**קטגוריות הכנסה:** משכורת, דמי כיס, בונוס, מתנה, עסק, אחר

**קטגוריות הוצאה:** מסעדות, סופר ופארם, תחבורה ודלק, דיור ותחזוקה, חשבונות ותקשורת, פנאי ובילויים, ביגוד, בריאות, חינוך, חופשות, חיות מחמד, מתנות, אחר

**עריכה:** מודל `#edit-transaction-modal` — סכום, תיאור, קטגוריה + אפשרות מחיקה

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/transactions?groupId=&userId=&limit=200` | שליפת תנועות |
| POST | `/api/transaction` | הוספת תנועה |
| PUT | `/api/transaction/:id` | עריכת תנועה |
| DELETE | `/api/transaction/:id` | מחיקת תנועה |

---

### 3.4 תקציב (`content-budget`)

**מטרה:** הגדרת יעדי הוצאות לפי קטגוריות + מעקב.

**רכיבי UI:**
- כפתור "תובנות familAI" (`#btn-budget-insight`) — ADMIN בלבד
- הנחיה: "כאן מגדירים יעד הוצאות לכל תחום"
- כפתור הוספת קטגוריה (`#btn-add-budget-cat`) — ADMIN
- `#budget-list` — רשימת קטגוריות עם progress bars

**קטגוריות תקציב מורחב (BUDGET_LABELS):**
מסעדות, סופר ופארם, תחבורה, דיור, חשבונות, פנאי, ביגוד, בריאות, חינוך, חופשות, חיות מחמד, מתנות, אחר, הפרשות כלליות, דמי כיס לילדים, תגמול על משימות, אתגרי אקדמיה, הפקדות לחיסכון

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/budget/filter?groupId=` | שליפת תקציב |
| POST | `/api/budget/update` | עדכון מגבלת קטגוריה |
| POST | `/api/budget/familai-insight` | תובנות AI לתקציב |

---

### 3.5 תשקיף (`content-forecast`)

**מטרה:** ניהול הכנסות/הוצאות עתידיות וקבועות.

**רכיבי UI:**
- כפתור "תובנות עתיד" (AI insight)
- בחירת תצוגה: חודשי / שנתי
- פילטר חודש/שנה
- `#forecast-summary` — יתרה צפויה + שינוי נטו
- `#forecast-charts` — גרף עוגה (Chart.js, `ratioChart`) — הכנסות מול הוצאות
- `#forecast-list` — רשימת פעולות עתידיות

**Recurring transactions:** תמיכה בפעולות קבועות (`is_recurring=true`, `end_month`)

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/transactions?is_recurring=true` | תנועות קבועות |
| POST | `/api/forecast/familai-insight` | תובנות AI לתשקיף |

---

### 3.6 רשימת קניות / סופר (`content-shop`)

**מטרה:** ניהול רשימת קניות משותפת, מצב "אני בסופר", checkout.

**רכיבי UI:**
- כפתורי כותרת: היסטוריה, סרוק קבלה (ADMIN), סרוק מוצר, הוסף
- "שתף בוואטסאפ" + "הדבק רשימה"
- כפתור "אני בסופר! 🛒" → `openSupermarketMode()` (מצב קניות מודרך)
- "רשימות שמורות" — `openSavedListsModal()`
- `#shop-requests-container` — בקשות ממתינות לאישור הורה (CHILD mode)
- `#shop-list` — רשימת הפריטים

**מצבי פריט:**
- `pending` → רגיל (לבן)
- `in-cart` → ירוק (`bg-green-50`)
- `missing` → כתום, strike-through

**Cart Footer (sticky):**
- `#cart-footer` — מציג סה"כ בעגלה + כפתור "סיום ואישור רשימת קניות"
- `openCheckoutSummary()` → מודל checkout

**AI בסופר:**
- סריקת קבלה: `POST /api/shopping/scan-receipt` → `showReceiptReviewModal` → confirmation → שמירה
- זיהוי מוצר מצולום: `POST /api/shopping/identify-product`

**PRODUCT_DB:** מיפוי מוצרים לקטגוריות מובנה בקוד (ירקות, חלב, לחם, מזווה, בשר, ניקיון, חטיפים).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/shopping/add` | הוספת פריט |
| POST | `/api/shopping/update` | עדכון פריט |
| DELETE | `/api/shopping/delete/:id` | מחיקת פריט |
| DELETE | `/api/shopping/clear/:groupId` | ניקוי כל העגלה |
| POST | `/api/shopping/checkout` | סיום קניה + עדכון מלאי |
| GET | `/api/shopping/history` | היסטוריית קניות |
| POST | `/api/shopping/copy` | העתקת רשימה שמורה |
| POST | `/api/shopping/scan-receipt` | סריקת קבלה AI |
| POST | `/api/shopping/scan-receipt/save` | שמירת פריטים מקבלה |
| POST | `/api/shopping/identify-product` | זיהוי מוצר מתמונה |
| POST | `/api/shopping/category-map` | שמירת מיפוי קטגוריה |

---

### 3.7 מזווה / מלאי ביתי (`content-pantry`)

**מטרה:** מעקב אחרי מוצרים בבית, ניהול כמויות, העברה לרשימת קניות.

**רכיבי UI:**
- כפתור "דוח מלאי AI" (`#btn-pantry-insight`) — ADMIN
- הנחיה: "כשמשהו נגמר - כפתור העגלה יעביר אותו ישירות לרשימת הקניות"
- כפתורי: סרוק להוספה, הוספה ידנית, מחיקה מרובה
- `#pantry-list` — כרטיסי מוצר

**כרטיס מוצר:**
- שם מוצר + תאריך עדכון + גודל מארז (upp)
- כפתורי +/- לכמות (תומך בשברים: 1/upp)
- יחידות בודדות (`totalSubUnits = qty × upp`)
- "השתמשתי" → `openPantryUseModal` → ניכוי כמות
- "חסר (לקניות)" → `movePantryToCart` → מחיקה מהמזווה + הוספה לעגלה

**Multi-delete mode:** בחירת מספר פריטים למחיקה בבת אחת.

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/pantry/add` | הוספת מוצר |
| POST | `/api/pantry/update` | עדכון כמות |
| POST | `/api/pantry/use` | שימוש במוצר (גריעה) |
| DELETE | `/api/pantry/delete/:id` | מחיקה |
| POST | `/api/pantry/familai-insight` | דוח מלאי AI |

---

### 3.8 שף AI / מתכונים (`content-recipes`)

**מטרה:** יצירת מתכונים אוטומטית מתוך מוצרי המזווה בעזרת AI.

**רכיבי UI:**
- Banner: "השף הפרטי שלכם 👨‍🍳 — familAI תרכיב לכם מתכון מושלם"
- בחירת סוג ארוחה: ארוחת צהריים/ערב/בוקר, קינוח, נשנוש בריא
- מספר סועדים (ברירת מחדל: 4)
- **בחירת מצרכים:**
  - מהמזווה (checkbox לכל מוצר) + "סמן/בטל הכל"
  - או: "התעלם מהמזווה" + textarea להקלדה ידנית
- כפתור "צור מתכון עכשיו" → `generateRecipe()`
- `#recipe-result-container` — תוצאה מפורמטת + כפתור העתקה

**פורמט תוצאה:** Markdown מומר ל-HTML (h2, h3, רשימות, bold).

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/recipes/generate` | יצירת מתכון AI |

**Body:** `{ groupId, mealType, diners, ignorePantry, customIngredients, pantryItems }`

---

### 3.9 הזמנות שלי (`content-myorders`)

**מטרה:** מעקב הזמנות מעסקים מקומיים, קריאות שירות, הצעות מחיר.

**4 תת-טאבים:**

| Tab | ID | תיאור |
|---|---|---|
| הזמנות | `myorders-section-orders` | הזמנות מעסקים |
| הפעילות שלי | `myorders-section-activities` | עסקים שחיברו אתכם |
| קריאות | `myorders-section-faults` | קריאות שירות פתוחות |
| הצעות | `myorders-section-quotes` | הצעות מחיר |

**פאנל סינון הזמנות:**
- חיפוש טקסט (שם עסק, לקוח, הערות)
- תקופה: הכל / שבוע / חודש / 3 חודשים
- מיון: חדש→ישן / ישן→חדש

**Pagination:** 15 הזמנות לעמוד (`PAGE_SIZE = 15`), ניווט הקודם/הבא עם מונה "X–Y מתוך Z".

**סטטוסי הזמנה:**

| סטטוס DB | צבע | טקסט |
|---|---|---|
| `pending_approval` | צהוב | ממתין לאישור עסק |
| `new` | כחול | התקבל בעסק |
| `processing` | כתום | באריזה / הכנה |
| `ready` | סגול | מוכן לאיסוף |
| `shipped` | אינדיגו | בדרך אליך! 🛵 |
| `delivering` | אינדיגו | השליח בדרך אליך 🛵 |
| `completed` | ירוק | הושלם ונמסר |

**כרטיס הזמנה — שדות:**
- שם עסק + אייקון חנות
- סטטוס + תאריך/שעה
- מספר הזמנה (#ID)
- סכום כולל
- Toggle לפתיחת פרטים:
  - רשימת פריטים (שם × כמות × מחיר שורה)
  - הערות
  - "הומרה מהצעת מחיר #X" (אם רלוונטי)
  - אישור קבלה + דירוג (1-5 כוכבים) — להזמנות delivery שהושלמו

**קריאות שירות (`myorders-section-faults`):**
- סינון: הכל / מעסק / פנימיות
- כרטיס קריאה: כותרת, חומרה, סטטוס, שם ציוד, טכנאי מוגדר, תאריך מתוכנן
- כפתורי: "חייג", "וואטסאפ"

**הצעות מחיר (`myorders-section-quotes`):**
- סטטוסים: טיוטה, ממתין לתשובתך, ממתין לתגובת העסק, אישרת, אושרה, בוטלה
- כרטיס הצעה: כותרת, שם עסק, תאריך, תוקף, סכום, פריטים
- Timeline: היסטוריית אירועי ההצעה
- תגובה להצעה: אשר / סרב / בקש הנחה / בקש שינויים / הודעה חופשית
- מודל `openFamilyQuoteView` — תצוגה מפורטת עם חישוב מע"מ/הנחה

**Auto-refresh:** `startMyOrdersAutoRefresh()` — כל 20 שניות כשב-myorders tab.

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | שליפת הזמנות |
| GET | `/api/store/quotes/family/:groupId?userId=` | הצעות מחיר |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובה להצעה |
| POST | `/api/store/orders/:id/customer-feedback` | דירוג הזמנה |

---

### 3.10 משימות משפחתיות (`content-tasks`)

**מטרה:** יצירת משימות לילדים עם תגמול כספי, בדיקת AI ע"י צילום.

**רכיבי UI:**
- "עשיתי מעשה טוב" (CHILD — self-report) `#btn-self-task`
- "חדשה" (ADMIN) `#btn-add-task`
- `#tasks-list` — רשימת משימות

**כרטיס משימה לפי סטטוס:**

| סטטוס | צבע | ADMIN | CHILD |
|---|---|---|---|
| `pending` | לבן | "ממתין לילד" badge | כפתור "סיימתי" + מצלמה |
| `done` | צהוב | "אשר ושלם" | "בבדיקה" |
| `approved` | ירוק | "בוצע" ✓ | "בוצע" ✓ |

**יצירת משימה (ADMIN):**
- ידנית: כותרת + תגמול + ילד + ימים לביצוע
- AI: נושא + גיל הילד → familAI מציעה 3 משימות עם תגמולים
- Toggle: אישור AI בתמונה — כן/לא

**אישור קבלה (CHILD):**
1. CHILD לוחץ "סיימתי" → מצלמה נפתחת
2. צילום → `handleTaskProofUpload` → `executeWithAIWarning`
3. `POST /api/tasks/vision-verify` → תוצאת AI
4. אם approved → תגמול מועבר לארנק + קונפטי

**"מעשה טוב" (CHILD self-task):**
- CHILD מדווח על משימה שביצע מיוזמתו
- נשלח לאישור ADMIN

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/tasks` | יצירת משימה |
| POST | `/api/tasks/update` | עדכון סטטוס/אישור |
| POST | `/api/tasks/ai-generate` | יצירת משימות AI |
| POST | `/api/tasks/vision-verify` | אימות בתמונה AI |

---

### 3.11 אקדמיה פיננסית (`content-academy`)

**מטרה:** ידע פיננסי לילדים דרך חידונים — עם תגמול כספי על הצלחה.

**תצוגת ADMIN:**
- הנחיה: "הקצו מבחנים לילדים כדי שירוויחו כסף מלמידה"
- "יצירת אתגר" (AI) + "הקצאה" (ידנית)
- `#academy-pending-container` — בקשות לאישור
- `#admin-assignments-list` — רשימת הקצאות

**תצוגת CHILD:**
- Banner: "האקדמיה הפיננסית — תלמד, תענה נכון - ותרוויח כסף!"
- "הגרל אתגר מהיר" → `requestChallenge()`
- `#my-assignments-list` — מטלות להשלמה
- `#academy-history-container` — היסטוריה
- **ספריית מבחנים** — פילטר לפי גיל (6-8, 8-10, 10-13, 13-15, 15-18, 18+) ונושא (חשבון, אנגלית, קריאה, פיננסי)

**יצירת אתגר AI:**
- גיל + נושא → `POST /api/academy/ai-generate`
- familAI יוצר שאלות + תשובות + threshold (85%)
- לאחר יצירה → `openAssignModalSpecific(bundleId)` → הקצאה לילד

**ביצוע חידון:**
- שאלות רב-ברירה
- דרוג: `quiz-option.selected`, `.correct`, `.wrong`
- "familAI, איפה טעיתי?" → `askTutor()` → הסבר AI

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/academy/assign` | הקצאת אתגר לילד |
| POST | `/api/academy/submit` | שליחת תוצאות |
| POST | `/api/academy/bundles` | שליפת/יצירת bundle |
| POST | `/api/academy/ai-generate` | יצירת אתגר AI |
| POST | `/api/academy/tutor` | הסבר AI על שגיאה |
| GET | `/api/academy/bundles/:id` | שליפת bundle ספציפי |
| PUT | `/api/academy/bundles/:id` | עדכון bundle |

---

### 3.12 קהילה / שכונה (`content-community`)

**מטרה:** חיבור לעסקים מקומיים, הטבות, חדשות קהילתיות.

**3 תת-טאבים:**

| Tab | תיאור |
|---|---|
| חיבור | התחברות לקהילה בקוד |
| הטבות | עסקים מקומיים + הנחות בלעדיות |
| חדשות | עדכוני קהילה (Coming Soon) |

**חיבור לקהילה:**
- שדה קוד קהילה (6 תווים, UPPERCASE) + כפתור "התחבר"
- `POST /api/community/user-create` → שיוך לקהילה
- `currentGroup.community_id` מתעדכן
- "התנתק" → `leaveCommunity()`

**הטבות עסקים:**
- `renderFamilyCommunities(window.communityBusinessesCache)` — רנדור עסקים מהקהילה
- כרטיס עסק: שם, הנחה, כפתור "הזמן"
- חיבור ל-`/api/storefront/:code` של העסק

**API:**
| Method | Path | תיאור |
|---|---|---|
| POST | `/api/community/user-create` | הצטרפות לקהילה |
| GET | `/api/community/my-initiatives/:groupId` | יוזמות |

---

### 3.12.1 FlowPool — רכישה קבוצתית קהילתית (תת-טאב `pool`/`pool-archive` בתוך קהילה)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול סבל ממספר כשלים חמורים**: endpoints ללא אימות
> כלל (כולל צ'אט פרטי), XSS פעיל בכל שדות הטקסט, היעדר מוחלט של בידול הרשאות (ילד=מנהל),
> פיצ'ר "עריכת פול" שבור לחלוטין (שם עמודה שגוי בקוד), ו"סגירה ללא בחירת הצעה" לא ממומשת.
> כולם תוקנו ותועדו למטה.

**מטרה:** מנגנון רכישה קבוצתית/מכרז קהילתי ("FlowPool") — **לא** קופה כספית משותפת. משפחה
פותחת "פול" (בקשה לשירות/מוצר עם תקרת מחיר אופציונלית) בתוך קהילה מחוברת; משפחות נוספות
מצטרפות; עסקי הקהילה (ובסיבוב 2 — גם עסקי "אורח" מחוץ לקהילה) מגישים הצעות מחיר; היוזם/ת
או מנהל/ת הקהילה בוחר/ת הצעה מנצחת. Flow coins (מטבע משחקי פנימי, לא כסף אמיתי) מוענקים
על יצירה/הצטרפות/זכייה.

**מיקום:** תת-טאב בתוך הטאב "קהילה" (`fam-comm-view-pool`), לא טאב עצמאי. קהילה מוחרגת
לחלוטין מ-`enforcePermissions` ונכפית גם לילדים (`app.js:9108-9120`) — כך שבפועל **כל סוג
משתמש משפחתי, כולל CHILD, רואה את תת-הטאב**. לאחר התיקון (ר' למטה), הצגת הכפתורים בצד
הלקוח עדיין זהה לכל התפקידים, אך **פעולות ניהול בפועל נחסמות בשרת** עבור משתמשי CHILD.

**תת-אזורים:**
- **פתיחת פול** (`openCreatePoolModal`/`createFamPool`) — כותרת, תיאור (שדות חובה), קטגוריית
  שירות, תקציב מקס' (אופציונלי), מספר משפחות מינימלי. היוזם מצטרף אוטומטית.
- **רשימת פולים פעילים** (`renderFamPools`) — כרטיס לכל פול: כותרת, קטגוריה, סטטוס (סיבוב 1
  פתוח/סיבוב 2 פתוח/סגור/פג תוקף), מספר משפחות, תקציב, תג "✦ יזמת" אם רלוונטי. בורר קהילה
  אם המשפחה מחוברת ליותר מקהילה אחת.
- **פרטי פול** (`openFamPoolDetail`) — סטטוס, תקציב, תיאור, רשימת חברי הפול וכפתור הסרה
  (ליוזם בלבד), רשימת הצעות עסקים עם קישור לחנות/טלפון ובחירת הצעה מנצחת (ליוזם/מנהל קהילה
  בלבד), צ'אט הודעות פתוח לכל חברי הפול (משפחות+עסקים), פתיחת סיבוב 2 לעסקי חוץ.
- **טיפול בפול שפג תוקפו** (ליוזם): חידוש תוקף ב-7 ימים נוספים, העברה לארכיב, או "סגירה ללא
  בחירת הצעה" (למשל אם העסקה בוצעה ישירות מול עסק מחוץ למערכת).
- **עריכת פול** (`openEditFamPool`/`saveEditFamPool`) — כותרת/תיאור/תקציב, ליוזם בלבד.
- **ארכיון פולים** (`loadFamPoolArchive`) — פולים סגורים/מוארכבים של המשפחה, עם אפשרות
  שחזור לפעילות (7 ימים חדשים).

**הרשאות לפי סוג משתמש (תוקן):** פעולות ניהול — פתיחת פול, הסרת חברה, בחירת הצעה מנצחת,
פתיחת סיבוב 2, עריכה, חידוש תוקף, ארכוב (יוזם), שחזור — **חסומות כעת בשרת למשתמש מסוג
CHILD** (נבדק מול `role` האמיתי של המשתמש שהתחבר, לא רק זהות הקבוצה). הצטרפות לפול קיים
ושליחת הודעות בצ'אט **נשארו פתוחות לכל סוגי המשתמשים** (כולל CHILD) — פעולות שיתופיות
בסיכון נמוך. בחירת הצעה מנצחת/פתיחת סיבוב 2 מוגבלות גם למנהל/ת קהילה (`is_community_manager`)
או ליוזם, ללא קשר לתפקיד המשפחתי הפנימי.

**אינטגרציית עסקים:** עסק מגיש הצעה דרך `/bid` (מוגבל לעסק אחד — הצעה אחת לכל פול, הגשה
חוזרת מחליפה את הקודמת). עסק "אורח" (לא חבר קהילה מאושר) יכול להגיש הצעה **רק בסיבוב 2**
(נאכף כעת בשרת). עסק רואה את כל הפולים הפתוחים בקהילות שהוא חבר בהן, את ההצעות שהגיש,
וארכיון אישי (הסתרת פול מהתצוגה שלו בלבד, ללא שינוי סטטוס גלובלי).

**API** (family-side עיקרי; כל ה-endpoints מוגנים `verifyFamily`/`verifyBiz`/`verifyFamilyOrBiz`
לפי הצורך, עם בדיקת בעלות/חברות קהילה):

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/community/pool` | יצירת פול (חסום ל-CHILD) |
| GET | `/api/community/pool/community/:communityId` | רשימת פולים בקהילה (חברי קהילה בלבד) |
| GET | `/api/community/pool/:id` | פרטי פול מלאים (חברי קהילה/יוזם בלבד) |
| POST | `/api/community/pool/:id/join` | הצטרפות (כל התפקידים) |
| POST | `/api/community/pool/:id/remove-member` | הסרת חברה (יוזם, חסום ל-CHILD) |
| POST | `/api/community/pool/:id/bid` | הגשת הצעה (עסק) |
| GET | `/api/community/pool/:id/bids` | רשימת הצעות (יוזם/מנהל קהילה) |
| POST | `/api/community/pool/:id/select-bid` | בחירת הצעה / סגירה ללא הצעה (`closeOnly`) |
| POST | `/api/community/pool/:id/open-round2` | פתיחת סיבוב 2 |
| POST | `/api/community/pool/:id/archive` | ארכוב (גלובלי ליוזם, אישי לעסק) |
| POST | `/api/community/pool/:id/renew` | חידוש תוקף |
| POST | `/api/community/pool/:id/edit` | עריכה |
| POST | `/api/community/pool/:id/restore` | שחזור מארכיב |
| GET | `/api/community/pool/:id/messages` | הודעות (מאומת, חברי קהילה/עסק משתתף) |
| POST | `/api/community/pool/:id/message` | שליחת הודעה (כל התפקידים) |
| GET | `/api/community/pool/family-archive/:groupId` | ארכיון פולים של המשפחה |
| GET | `/api/biz/pools/:bizGroupId` | פולים פתוחים לעסק |
| GET | `/api/biz/my-pool-bids/:bizGroupId` | הצעות שהעסק הגיש |
| GET | `/api/biz/pool-archive/:bizGroupId` | ארכיון אישי לעסק |
| POST | `/api/community/pool/cleanup` | ניקוי פולים שפג תוקפם (Super-Admin, cron) |

**טבלאות:** `flow_pools`, `flow_pool_members`, `flow_pool_bids`, `flow_pool_messages`,
`biz_pool_hidden`.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. `GET /api/community/pool/:id`, `GET /api/community/pool/community/:communityId`,
   `GET /api/community/pool/:id/messages` — שלושתם **ללא כל middleware אימות**. כל גורם,
   כולל לא-מחובר, יכול היה לקרוא פרטי כל פול (כולל שמות חברים) וצ'אט פרטי מלא, ולהציג רשימת
   כל הפולים בכל קהילה. תוקן: נוספה `verifyFamily`/`verifyFamilyOrBiz` + בדיקת חברות
   בקהילה/השתתפות בפול בפועל.
2. **אין בידול הרשאות role** — טאב "קהילה" מוחרג לחלוטין מהרשאות ומוכרח גם לילדים, ואף
   endpoint לא בדק `role` בתוך המשפחה (רק זהות קבוצה) — כל ילד/ה יכול היה ליצור פולים, להסיר
   חברים, לבחור הצעה מנצחת, לפתוח סיבוב 2, לערוך/לארכב/לשחזר פול. תוקן: נוספה בדיקת
   `role!=='CHILD'` בשרת לכל פעולות הניהול (לא לפעולות שיתופיות כמו הצטרפות/הודעה).
3. **XSS פעיל** — `safeStr` (הפונקציה ששימשה לבריחת טקסט ברוב תצוגות הפול) מבצעת רק escaping
   ל-`'`/`"`, **לא ל-`<`/`>`** — כותרת/תיאור/הודעות/שמות הוזרקו ל-`innerHTML` ללא הגנה מפני
   הזרקת תגיות. תוקן: מעבר ל-`escHtml()` (בריחה מלאה כולל `<`/`>`/`&`) בכל מקום שבו הטקסט
   מוצג כתוכן HTML (לא כארגומנט JS בתוך `onclick`, שם ה-escaping של `safeStr` תקין להקשר הזה).
   כולל תיקון חלון "עריכת פול" (`openEditFamPool`) שהזריק כותרת/תיאור גולמיים (ללא שום
   escaping) ל-`value`/לתוכן textarea.
4. **באג לוגי קריטי ב-`/edit`**: הקוד השווה `fp.rows[0].initiator_group_id` (עמודה שלא
   קיימת בטבלה — שם העמודה האמיתי הוא `initiator_id`) ⇒ ההשוואה תמיד נכשלה ⇒ עריכת פול
   **הייתה שבורה לחלוטין בפועל** עבור כל משתמש, כולל היוזם האמיתי. תוקן.
5. **"סגירה ללא בחירת הצעה" לא הייתה ממומשת בשרת** — הלקוח (`closeFamPool`) שלח
   `closeOnly:true` ל-`/select-bid`, אך השרת התעלם מהפרמטר, חיפש הצעה לפי `bidId:null` (תמיד
   נכשל), ואז קרא ל-`/archive` שמעביר לסטטוס `archived` ולא `closed` כפי שה-UI תיאר. תוקן:
   `/select-bid` מטפל כעת מפורשות ב-`closeOnly` וסוגר את הפול (`status='closed'`) ללא צורך
   בבחירת הצעה.
6. **דליפת `e.message` גולמי** ללקוח בכל ה-endpoints — תוקן להודעות כלליות בעברית.
7. **IDOR בשלושה endpoints עסקיים** (`/api/biz/my-pool-bids/:bizGroupId`,
   `/api/biz/pools/:bizGroupId`, `/api/biz/pool-archive/:bizGroupId`) — `bizGroupId` מה-URL
   לא הושווה ל-`req.bizAuth.groupId`, כך שעסק מחובר יכול היה למשוך נתוני עסק אחר. תוקן.
8. **אכיפת סיבוב 1/2 לעסק אורח לא הייתה קיימת** — עסק "אורח" (לא חבר קהילה מאושר) יכול
   היה להגיש הצעה גם בסיבוב 1, בניגוד לכוונת הפיצ'ר. תוקן: נבדק שהפול בסטטוס `open_r2`.
9. **אין ולידציה על מחיר הצעה** — התקבל כל ערך (כולל שלילי/לא מספרי). תוקן: נדרש מספר חיובי.
10. **באג תקשורת שקט (לא היה בדוח המקורי, התגלה תוך כדי תיקון)**: `sendPoolMessage` בצד
    הלקוח שלח `sender_type`/`sender_id` (snake_case) בעוד השרת ציפה ל-`senderType`/`senderId`
    (camelCase) — כתוצאה מכך **שליחת הודעה בצ'אט נכשלה תמיד** (403 "אין הרשאה לשלוח הודעה
    בשם שולח אחר", כי `senderId` תמיד הגיע `undefined`). תוקן.
11. אין הגבלת אורך תוכן הודעה בצד שרת — נוספה הגבלה ל-1000 תווים.

---

### 3.13 ניהול הבית (`content-home-maintenance`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול היה שבור לחלוטין בצד המשפחה** (כל קריאות ה-API
> נדחו עם 401, כי השרת דרש session עסקי בלבד). התיקון תועד למטה ונכלל בקוד הנוכחי.

**מטרה:** ניהול ציוד הבית, לוח תחזוקה, ספר תקלות ואנשי קשר (טכנאים/נותני שירות קבועים).

**ברירת מחדל ותפקידים:** הטאב מופיע כברירת מחדל לתפקיד `MANAGER` בלבד (`ROLE_DEFAULTS`,
`public/app.js:9099`) — לא מופיע אוטומטית ל-ADMIN/MEMBER/CHILD, אלא אם הורחבו הרשאות ה-tabs
ידנית (`PUT /api/users/:id/permissions`).

**כניסה למודול:** `loadHomeMaintenance()` (`app.js:11838`) — טוען קריאות שירות חיצוניות מעסקים
→ מושך במקביל ציוד/תחזוקות/תקלות/אנשי קשר → פותח טאב "ציוד" כברירת מחדל → מריץ בדיקת התראות
(`POST /notifications/check/:groupId`).

**4 תת-טאבים** (`switchHomeMaintenanceTab`, `app.js:11887`):

| Tab | View ID | תיאור |
|---|---|---|
| 🔧 ציוד | `hm-view-items` | מכשירי/ציוד הבית |
| 📋 תחזוקה | `hm-view-maintenance` | לוח תחזוקה תקופתית |
| ⚠️ תקלות | `hm-view-faults` | ספר תקלות (+ קריאות שירות חיצוניות מעסקים) |
| 👤 אנשי קשר | `hm-view-contacts` | טכנאים/נותני שירות קבועים |

#### 🔧 ציוד
כרטיס לכל פריט, ממוין לפי שם: שם, תגית קטגוריה, תגית סטטוס (פעיל/לא פעיל/הושלך), מספר סידורי,
מצב אחריות (אדום אם פגה, צהוב אם &lt;30 יום, אחרת תאריך פקיעה), מונה תחזוקות ממתינות ותקלות
פתוחות. טופס הוספה/עריכה (`openHMItemModal`, `app.js:11940`): שם (חובה), קטגוריה (מקרר/תנור/
מזגן/חשמל/אינסטלציה/רכב/כללי), מספר סידורי/דגם, תאריך רכישה, תאריך פקיעת אחריות, סטטוס, איש
קשר לתיקון (מתוך רשימת אנשי הקשר), הערות. מחיקה עם אישור. **היסטוריה** (`openHMHistory`): ציר
זמן מאוחד של תחזוקות+תקלות לפריט, עם חיפוש וסינון לפי סוג/תקופה.

#### 📋 תחזוקה
כרטיסים לפי תאריך מתוכנן: שם ציוד, סוג (תקופתי/תיקון/בדיקה), סטטוס (ממתין/בוצע/פג תוקף —
"פג תוקף" מחושב בצד הלקוח). סינון: הכל/ממתין/פג תוקף/בוצע. טופס הוספה/עריכה: ציוד (חובה), סוג,
תיאור, תאריך מתוכנן, עלות, "חזרה אוטומטית (ימים)", שם/טלפון איש קשר כטקסט חופשי (לא מקושר
לטאב אנשי הקשר). **"✓ בצע"**: שואל על עלות (אופציונלי) ושולח ל-`PUT /maintenance/:id/complete`
— אם הוגדר מרווח חזרה, השרת יוצר אוטומטית רשומת תחזוקה הבאה באותו מרווח ימים.

#### ⚠️ תקלות
בראש הרשימה — קריאות שירות פעילות שנפתחו מול עסקים ("🏢 קריאת שירות מהעסק"). מתחת — תקלות
ביתיות: תמונה, כותרת, תגית חומרה (נמוכה/בינונית/גבוהה/קריטית), תגית סטטוס (פתוח/בטיפול/טופל),
ציוד קשור, תאריך. שתי לשוניות פנימיות: **פרטים** (מועד מתוזמן, תיאור, הערות פתרון, איש מקצוע
משויך, כפתורי חיוג/WhatsApp/Waze) ו-**הערות** (ציר הערות נפרד). סינון: הכל/פתוח/בטיפול/טופל.
טופס דיווח/עריכה: ציוד (חובה), כותרת (חובה), פירוט, איש קשר (עם הצעת שליחת WhatsApp אוטומטית
בסיום), תאריך/שעה מבוקשים, דחיפות, סטטוס, **תמונה** (מועלית בפועל לשרת ומוחזר URL קבוע — לא
נשמרת כ-base64 ב-DB). שינוי סטטוס יוצר אוטומטית הערת מערכת "סטטוס שונה מ-X ל-Y".

#### 👤 אנשי קשר
כרטיס לכל איש קשר: שם, חברה, התמחות, כפתורי טלפון/WhatsApp. אנשי קשר שמקושרים לעסק אמיתי
ב-WEFLOWZ מקבלים תג "WEFLOWZ" וכפתור "שלח קריאה" (`openServiceCallWizard`) שפותח אשף קריאת
שירות מלא מול העסק. לאחרים — כפתור "קשר ל-WEFLOWZ" לחיפוש וקישור. הוספה/עריכה/מחיקה.

#### התראות (`POST /notifications/check/:groupId`)
לכל תחזוקה ממתינה שמועדה בעוד 2-7 ימים: "🔧 תחזוקה בעוד X ימים". למועד היום/מחר: "🔧 תחזוקה
היום/מחר". לקריאות שירות מתוזמנות למחר (כולל של כל המשפחות באותה קהילה): "📅 קריאת שירות מחר".
נכתב ל-`alert_notifications` עם מפתח ייחודי (מונע כפילויות), מעדכן תג הפעמון.

#### חיבור ל"הזמנות שלי"
תקלות פתוחות מוצגות גם שם: `renderMyFaultsAsServiceCalls` (`app.js:1113`, "🏠 תקלה בבית") עם
כפתורי חיוג/WhatsApp ו"פרטים →" שמעביר ישירות לטאב התקלות.

#### תג המודול
`updateHMBadge` (`app.js:11890`) — מספר תקלות פתוחות + מספר תחזוקות שמועדן בתוך 7 ימים, על
כפתור הטאב עצמו.

**API** — כל ה-endpoints מוגנים ב-`verifyFamilyOrBiz` (מקבל session משפחתי **או** עסקי לפי
טוקן; `groupId` נלקח תמיד מה-session, לא מה-URL/body — פרמטר `:groupId` ב-URL מתעלם בפועל):

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/equipment/items/:groupId` | רשימת ציוד |
| POST | `/api/equipment/items` | הוספה/עריכה (עם `id`) |
| DELETE | `/api/equipment/items/:id` | מחיקה |
| GET | `/api/equipment/items/:id/history` | היסטוריה מאוחדת לפריט |
| GET | `/api/equipment/maintenance/:groupId` | לוח תחזוקה |
| POST | `/api/equipment/maintenance` | הוספה/עריכה |
| PUT | `/api/equipment/maintenance/:id/complete` | סימון בוצע (+ תזמון אוטומטי הבא) |
| DELETE | `/api/equipment/maintenance/:id` | מחיקה |
| GET | `/api/equipment/faults/:groupId` | רשימת תקלות |
| POST | `/api/equipment/faults` | דיווח/עריכת תקלה |
| PATCH | `/api/equipment/faults/:id/status` | שינוי סטטוס (+ הערת מערכת אוטומטית) |
| GET / POST | `/api/equipment/faults/:id/notes` | ציר הערות לתקלה |
| DELETE | `/api/equipment/faults/:id` | מחיקה |
| GET | `/api/equipment/technicians/:groupId` | אנשי קשר |
| POST | `/api/equipment/technicians` | הוספה/עריכה |
| DELETE | `/api/equipment/technicians/:id` | מחיקה |
| POST | `/api/equipment/technicians/:id/link-business` | קישור לעסק אמיתי ב-WEFLOWZ |
| POST | `/api/equipment/notifications/check/:groupId` | הרצת בדיקת התראות |
| — | `/api/upload/product-image` | העלאת תמונת תקלה (multipart, מחזיר URL) |

**טבלאות:** `equipment_items`, `equipment_maintenance`, `equipment_faults`, `equipment_technicians`
(server.js:1093-1199). חולקות קוד/schema עם המודול העסקי המקביל — טוקן ה-session (משפחתי/עסקי)
הוא שקובע לאיזו `group_id` כל בקשה מוגבלת, לא route נפרד.

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון, כל ה-endpoints היו מוגנים ב-`verifyBiz`
(דורש session עסקי בלבד) בעוד הקריאות מצד המשפחה נשלחו בלי טוקן בכלל — כל בקשה נדחתה עם 401,
בלי הודעת שגיאה למשתמש (מסכים ריקים "אין רשומות"), ומחיקה הציגה "נמחק" גם כשנכשלה. בנוסף
`link-business` היה פתוח לגמרי בלי הרשאה ובלי סינון `group_id` — כל אחד יכול היה לשייך טכנאי
של קבוצה אחרת לעסק. תוקן: מעבר ל-`verifyFamilyOrBiz` + `communityFetch` בצד הלקוח, הוספת
הרשאה+סינון ל-`link-business`, בדיקת תשובת שרת אמיתית במחיקה/טעינה, ותיקון תמונת תקלה
להעלאה אמיתית במקום base64 ב-DB.

---

### 3.14 ניהול / Members (`content-members`)

**מטרה:** ניהול בני המשפחה, תמונת מיתוג, הזמנת חברים.

**רכיבי UI:**
- **תמונת מיתוג:** העלאת תמונה → `previewFamilyPhoto` → `saveFamilyPhoto()`
- `#members-list` — רשימת חברי המשפחה
- כפתור "הפק דוח 360" → `open360Report()`
- כפתורי ADMIN (מוסתרים לחברים רגילים):
  - "הזמן בן משפחה בוואטסאפ" → `sendWhatsAppInvite('MEMBER')`
  - "קבל פרטי גישה למייל" → `sendCredentialsEmail()`
- `#admin-panel` — בקשות הצטרפות ממתינות (`pending-list`)
- Modal הזמנה: ADMIN / MEMBER בוואטסאפ

**הזמנה בוואטסאפ:**
- ADMIN: מקבל הרשאות מנהל
- MEMBER: ילד/בן משפחה — בקשה לאישור

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/group/members` | רשימת חברים |
| GET | `/api/admin/pending-users` | בקשות ממתינות |
| POST | `/api/admin/approve-user` | אישור בקשה |
| DELETE | `/api/users/:id` | מחיקת משתמש |
| POST | `/api/users/:id/password` | שינוי סיסמה |
| PUT | `/api/users/:id/permissions` | עדכון הרשאות |
| POST | `/api/admin/send-credentials` | שליחת פרטי גישה למייל |

---

### 3.15 פרופיל והגדרות

**פרופיל אישי** נפתח מ-`openProfileModal()`:
- שינוי כינוי, סיסמה
- מידע אישי: תז, מייל, שנת לידה
- סוללת AI (ADMIN: מציג כמות נותרת + אפשרות Pro)
- כפתור "שדרג ל-Pro"

**Sidebar משפחה:** `openFamilySidebar()`:
- ניווט מהיר
- הגדרות
- התנתקות

---

### 3.16 מרקטפלייס (`content-marketplace`)

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js + public/marketplace.html)
> כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — ה-endpoint המרכזי של המודול לא היה מוגן אימות בכלל**
> (כל בקשה, אפילו ללא טוקן, קיבלה את כל רשימת העסקים הפעילים). התיקון תועד למטה ונכלל בקוד
> הנוכחי.

**מטרה:** גילוי עסקים (חנות ציבורית) מתוך סביבת המשפחה — חיפוש, סינון לפי קטגוריה/קרבה
גיאוגרפית, "ביקרתי לאחרונה", מבצעי שבוע, אזורים מועדפים, כניסה לחנות הציבורית (storefront)
של כל עסק.

**ארכיטקטורה:** הטאב `loadMarketplaceTab()` (`app.js:~18485`) מטמיע `<iframe>` עצמאי
ל-`public/marketplace.html?groupId=&token=&familyName=` (דף נפרד, same-origin, עם
`<script>` עצמאי). תקשורת הורה↔iframe דרך `postMessage` (למשל `openStorefront` כדי לפתוח
את `storefront.html` של העסק בלשונית/טאב חדש, עם `e.origin` מאומת משני הצדדים).

**גישה לפי סוג משתמש (`ROLE_DEFAULTS`, `app.js:9097`):** הטאב `marketplace` **אינו** ברירת
מחדל לאף תפקיד חוץ מ-`ADMIN` (`ALL_TABS` המלא). `MANAGER`, `SENIOR`, `MEMBER`, `CHILD` לא
רואים את הטאב כברירת מחדל — הוא נחשף להם רק אם ADMIN הרחיב ידנית את הרשאות ה-tabs שלהם
(`PUT /api/users/:id/permissions`, מודול 3.14 "ניהול/Members"). בפועל, המודול מיועד בעיקר
להורה/מנהל המשפחה, אך אינו חסום באופן מהותי לשאר התפקידים ברגע שהוענקה הרשאת tab —
כל ה-endpoints בודקים רק זהות **קבוצה** (`req.familyAuth.groupId`), לא תפקיד בתוך הקבוצה,
כך שכל חבר משפחה עם טוקן תקף וגישה לטאב רואה את **אותם** נתונים (אין הבדלי תוכן בין
ADMIN/MEMBER/CHILD בתוך המודול עצמו — ההבדל היחיד הוא האם הטאב מוצג).

**טוקן:** `marketplace.html` קורא את טוקן המשפחה ישירות מ-`localStorage.getItem('ofl_family_token')`
(אותו מפתח שמשמש את `getFamilyToken()` ב-`app.js`) — פרמטר ה-URL `token`/`familyToken` הוא
רק fallback (כדי לא לחשוף את הטוקן מיותר ב-query string כששומרים אותו ממילא ב-localStorage
של אותו origin). כל קריאות ה-API הפנימיות עוברות דרך עוטפת `apiFetch()` שמוסיפה אוטומטית
`Authorization: Bearer <FAMILY_TOKEN>`.

**טעינת הנתונים — `GET /api/family/marketplace/:groupId`:** endpoint יחיד שמחזיר בבת אחת:
1. **יתרת Flow coins (FLW)** של המשפחה — `SELECT balance FROM flow_wallets WHERE entity_type='family' AND entity_id=groupId` (מוצג בראש הדף, רלוונטי למימוש הטבות/מטבעות מול עסקים).
2. **ביקרתי לאחרונה** — 3 העסקים האחרונים לפי `family_business_visits.last_visited_at`,
   מסונן לעסקים לא-מחוקים/לא-מוקפאים בלבד (`is_deleted`, `account_status`).
3. **מבצעי השבוע** — 2 ה-`community_promotions` עם `discount_pct` הגבוה ביותר שעדיין בתוקף
   (`valid_until > NOW()`), ללא תלות במשפחה הספציפית (רשימה גלובלית לכל המשתמשים).
4. **רשימת כל העסקים** — כל `family_groups` מסוג `BUSINESS` פעילים, עם סינון אופציונלי
   `category` (`business_type ILIKE`) ו-`q` (`name ILIKE`), ועד 500 שורות.
5. **סינון "קרוב אליי"** (כש-`lat`+`lng` מגיעים ב-query) — JOIN עם `biz_service_areas`,
   חישוב מרחק אווירי (Haversine) בין מיקום המשתמש לכל אזור שירות של כל עסק בנפרד, השוואה
   מול רדיוס השירות של אותו אזור (`radius_km`, ברירת מחדל 15 אם לא סופק `radius`), ובחירת
   אזור השירות הקרוב ביותר כ"מרחק האמיתי" של העסק (לא ממוצע/מינימום מלאכותי בין כמה אזורים).
   תוצאה: עד 200 עסקים, ממוינים לפי מרחק עולה.

**תת-אזורים ב-UI (`public/marketplace.html`):**
- **ביקרתי לאחרונה** (`renderRecent`, שורה ~758) — 3 כרטיסים, לוגו/תמונה, שם, קטגוריה.
- **מבצעי השבוע** (`renderWeekly`, שורה ~776) — כרטיס מבצע עם כותרת ההטבה, אחוז הנחה,
  תוקף, ושם/לוגו/קטגוריה (`catLabel()`) של העסק המציע.
- **מומלץ לי** (`renderRecommended`, שורה ~798) — שילוב תצוגתי של מבצעי שבוע + מדגם
  מתוך רשימת העסקים (לא אלגוריתם המלצה אישי — ר' "מגבלות ידועות").
- **רשימת עסקים מלאה** (`_renderBizPage`, שורה ~829) — צ'יפים לסינון קטגוריה: הכל, יופי,
  ספורט, התקנות/שירות (ועוד לפי `catLabel`/`BUSINESS_TYPES`, כולל `services` שנוסף בתיקון
  זה), חיפוש טקסט חופשי (מסונן כרגע **רק בצד הלקוח** על התוצאות שכבר נטענו — הפרמטר `q`
  קיים ונתמך במלואו בשרת, אך הלקוח לא שולח אותו היום — ר' מגבלות), וסינון "קרוב אליי".
  כל כרטיס עסק מציג: לוגו/תמונה, שם, קטגוריה, טלפון (אם קיים ב-`store_settings`), ומרחק
  בק"מ כש"קרוב אליי" פעיל.
- **אזורים מועדפים** (`loadFamilyAreas`/`addFamilyArea`/`delFamilyArea`) — ניהול רשימת
  אזורי מגורים/עניין של המשפחה: הוספת עיר (עם `is_primary` לאזור ראשי), geocoding אוטומטי
  דרך Nominatim (OpenStreetMap, חיצוני) אם לא סופקו קואורדינטות ידנית, מחיקה. משמש כקלט
  לסינון "קרוב אליי" (המשתמש יכול לבחור אזור שמור במקום GPS חי).
- **חיפוש חי** (`showSearchResults`) — תיבת חיפוש עם dropdown עד 8 תוצאות מיידי, סגנון
  זהה (לוגו-עיגול/ראשי-תיבות, שם, קטגוריה), כל שורה פותחת עסק באותה דרך כמו שאר הכרטיסים.

**פתיחת עסק (`openBiz(el)`):** קורא `data-biz-id`/`data-biz-name` מהאלמנט שנלחץ → בונה
`storefront.html?groupId=<biz>&familyGroupId=<family>&flowRedeem=1` → שולח `postMessage`
להורה (`{action:'openStorefront', bizId, bizName, url}`, עם `location.origin` כיעד) כדי
שה-`app.js` ההורה יפתח את ה-storefront בטאב/חלון חדש; אם הדף לא רץ בתוך iframe (למשל
נפתח ישירות), פותח `window.open` בעצמו. במקביל (אם יש טוקן+קבוצה) שולח ברקע
`POST /api/family/visit-business` לרישום הביקור — לא חוסם את הניווט אם הקריאה נכשלת.

**API** (family-side, כולן מוגנות `verifyFamily` + בדיקת `groupId===req.familyAuth.groupId`):

| Method | Path | Query/Body | תיאור |
|---|---|---|---|
| GET | `/api/family/marketplace/:groupId` | `category`, `q`, `lat`, `lng`, `radius` | נתוני המרקטפלייס המלאים: יתרת FLW + recent + weekly + רשימת עסקים (+near אם lat/lng) |
| GET | `/api/family/marketplace-history/:groupId` | — | היסטוריית עסקים שביקרו (כל הרשומות, לא רק 3 אחרונים) |
| POST | `/api/family/visit-business` | `businessGroupId` | רישום/עדכון ביקור (upsert לפי זוג family+business, מולידציה שהעסק קיים ומסוג BUSINESS) |
| GET | `/api/family/preferred-areas/:groupId` | — | רשימת אזורים מועדפים (ראשי קודם) |
| POST | `/api/family/preferred-areas/:groupId` | `city`, `radius_km`, `is_primary`, `lat?`, `lng?` | הוספה/עדכון אזור (upsert לפי עיר, geocoding אוטומטי אם אין קואורדינטות) |
| DELETE | `/api/family/preferred-areas/:groupId/:areaId` | — | מחיקת אזור |

**טבלאות:** `family_business_visits` (ביקורים, `last_visited_at`), `biz_service_areas`
(`lat`/`lng`/`radius_km` לכל אזור שירות של עסק), `family_preferred_areas` (`city`,`lat`,
`lng`,`radius_km`,`is_primary`), `family_groups` (type=`BUSINESS`, `business_type`,
`is_deleted`, `account_status`), `store_settings` (`logo_url`,`phone`), `community_promotions`
(מבצעי שבוע, `discount_pct`,`valid_until`,`biz_code`), `flow_wallets` (יתרת FLW,
`entity_type='family'`).

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. `GET /api/family/marketplace/:groupId` לא היה מוגן ב-`verifyFamily` כלל, וגם לא בדק
   התאמת `groupId` מה-URL לזהות המתקשר (IDOR) — כל גורם ללא טוקן יכול היה למשוך את כל
   רשימת העסקים הפעילים, נתוני "מי ביקר לאחרונה" של כל משפחה, ועסקאות אחרות.
2. `GET /api/family/marketplace-history/:groupId` היה מוגן ב-`verifyFamily` אך ללא בדיקת
   בעלות (IDOR) — אפשר היה למשוך היסטוריית ביקורים של משפחה אחרת לפי שינוי `groupId` ב-URL.
3. `loadMarketplaceTab()` ב-`app.js` קרא את טוקן המשפחה ממפתחות localStorage שגויים
   (`'familyToken'`/`'token'`, שלא היו קיימים בפועל) במקום `'ofl_family_token'` — כך שהטוקן
   שהוזרם בפועל ל-iframe היה תמיד ריק. זה לא גרם לתקלה גלויה כל עוד ה-endpoint לא דרש
   אימות, אבל היה הופך את כל המודול ללא פעיל ברגע שמוסיפים אימות — תוקן לפני שהתיקון האחר
   נכנס לתוקף.
4. חישוב "קרוב אליי" השתמש ב-`MIN(lat), MIN(lng), MIN(radius_km)` בנפרד על פני כל אזורי
   השירות של עסק (GROUP BY), מה שיכול "להמציא" נקודת מיקום לא קיימת לעסק עם כמה אזורי
   שירות — תוקן לחישוב מרחק אמיתי לכל אזור שירות בנפרד ובחירת המרחק המינימלי האמיתי.
5. `POST /api/family/visit-business` לא בדק שה-`businessGroupId` שהתקבל אכן קיים והוא
   מסוג `BUSINESS` — תוקן.
6. כרטיסי עסק ב-`marketplace.html` נבנו עם `onclick="openBiz(' + id + ',\'' + name + '\')"` —
   דפוס XSS: גם אחרי `esc()`, הדפדפן מפענח entities בערכי attribute *לפני* שהתוכן מתפרש כ-JS,
   כך ששם עסק עם `'` יכול לשבור מחוץ למחרוזת ה-JS. גם `src` של לוגו/תמונת עסק לא עבר `esc()`.
   תוקן בכל 5 מוקדי הרינדור: מעבר ל-`data-biz-id`/`data-biz-name` + `onclick="openBiz(this)"`,
   ו-`esc()` על כל `src`.
7. `postMessage(msg, '*')` (3 מוקדים) — הודעות בין ה-iframe להורה נשלחו לכל origin; תוקן
   ל-`postMessage(msg, location.origin)`, וגם ה-listener בצד ההורה (`app.js`) נבדק כעת מול
   `e.origin !== window.location.origin`.
8. שגיאות שרת (`catch`) החזירו `e.message` גולמי ללקוח בחלק מה-endpoints — תוקן להודעות
   כלליות בעברית.
9. `biz_category` הוצג כקוד גולמי (למשל `beauty`) במקום תווית בעברית במבצעי השבוע — תוקן
   ל-`catLabel()`. `distance_km` חושב בשרת אך לא הוצג ללקוח — נוסף לכרטיסי הרשימה.

**מגבלות ידועות (לא תוקנו — החלטות מוצר, לא באגים):**
- "מבצעי השבוע"/"מומלץ לי" אינם מותאמים אישית למשפחה — זו רשימה גלובלית.
- חיפוש הטקסט החופשי מסונן כרגע רק בצד הלקוח; הפרמטר `q` קיים ונתמך בשרת אך לא נשלח.
- טיפול `storefront.html` בפרמטר `familyToken` ב-URL לא נבדק כחלק מהמודול הזה (קובץ נפרד,
  בשימוש רחב ממקומות נוספים — סומן לבדיקה נפרדת).

---

## 4. "הזמנות שלי" — renderMyOrders

> עודכן: 2026-10 | אומת מול קוד בפועל (server.js + public/app.js) כחלק מתהליך אפיון עומק.
> **נכון לגרסה שלפני אוקטובר 2026 — המודול סבל מהכשל האבטחתי החמור ביותר שנמצא עד כה
> בתהליך האפיון**: חמישה endpoints קריטיים ללא אימות כלל (כולל שניים שאפשרו שינוי/כתיבת
> נתונים), ו-**stored XSS שניתן לניצול ללא חשבון בכלל** דרך שילוב של שניים מהם. כולם תוקנו.

**מטרה:** מרכז את כל האינטראקציה הפיננסית/שירותית של המשפחה מול עסקים: הזמנות ממסעכים/
חנויות, הצעות מחיר (RFQ), קריאות שירות (עם צ'אט פנימי ותחנות תשלום), ופעילות מול כל סוג עסק
(יופי/ספורט/מסעדות/שירותים) ב-accordion מאוחד.

**גישה לפי סוג משתמש:** הטאב `myorders` מוגדר כ-`ALWAYS_OPEN_TABS`/`ALWAYS_OPEN_DROPS`
(`app.js:13130-13134`) — **לכל סוגי המשתמשים, כולל CHILD, יש גישה מלאה וזהה** לכל תתי-הטאבים,
ללא שום סינון תפקיד. גם בצד השרת, לאחר התיקון, כל ה-endpoints בודקים רק **זהות קבוצה**
(session תקף של המשפחה), לא תפקיד בתוכה — כך שכל חבר משפחה מחובר, כולל ילד/ה, יכול לאשר/
לסרב הצעת מחיר פיננסית (כגון עבודת שיפוץ יקרה) ולראות את כל הנתונים הכספיים מול עסקים. זהו
מצב קיים ומכוון (לא תוקן כחלק מהתיקון, בניגוד למודול FlowPool שבו הוגבל CHILD) — ראו הערה
בסוף.

### 4.1 זרימת טעינה

```
switchTab('myorders')
  → switchMyOrdersTab('orders') // last session tab
  → fetchMyOrders()
    → GET /api/store/orders/my/:userId (מאומת — session המשפחה)
    → myOrdersCache = data.orders
    → renderMyOrders()
  → loadFamilyServiceCalls()
  → startMyOrdersAutoRefresh()
```

### 4.2 renderMyOrders — לוגיקה מלאה

```javascript
renderMyOrders() {
  // 1. עדכון פאנל סינון (search, period buttons, sort button)
  // 2. applyOrdersFilter(myOrdersCache):
  //    - סינון quote orders (status !== 'quote')
  //    - סינון לפי חיפוש טקסט
  //    - סינון לפי תקופה (week/month/quarter)
  //    - מיון לפי created_at (asc/desc)
  // 3. Pagination: PAGE_SIZE = 15
  //    totalPages = Math.ceil(length / 15)
  //    page = window._myOrdersPageNum
  // 4. רנדור כרטיסי הזמנה
  // 5. Pagination bar (הקודם/הבא עם מונה)
}
```

### 4.3 כרטיס הזמנה — שדות מלאים

- **שם עסק** + אייקון store
- **סטטוס** (צבע גבול + badge + אייקון)
- **תאריך** + שעה (he-IL format)
- **מספר הזמנה** (#id — font-mono)
- **סכום** (₪ bold)
- **Toggle פרטים** (onclick):
  - **פריטים**: שם × כמות × מחיר שורה
  - **הערות** (אם קיים)
  - **Badge "הומרה מהצעת מחיר #X"** (אם quote_status=approved)
  - **אישור קבלה** (הזמנות is_delivery=true, status=completed):
    - "✅ כן, קיבלתי" → פתיחת מודל דירוג 1-5 (`_orderRatingModal`/`_submitOrderRating`) → POST feedback
    - "❌ לא קיבלתי" → הודעת פנייה לעסק, ללא ביטול בפועל — **אין מנגנון "ביטול הזמנה" צד-לקוח במודול זה**, רק דיווח "לא קיבלתי"

### 4.4 תתי-טאבים נוספים

- **הצעות מחיר** (`renderFamilyQuotesTab`/`openFamilyQuoteView`) — טיימליין אירועי הצעה מלא,
  תצוגת פריטים/הנחה/מע"מ, תגובת לקוח (אישור/סירוב/בקשת הנחה/בקשת שינויים/הודעה חופשית) דרך
  `PATCH /api/store/quotes/:id/customer-response`.
- **קריאות שירות** (`renderBusinessServiceCallsTab`/`openFamilyCallModal`) — תקלות בית
  (`renderMyFaultsAsServiceCalls`, מוצג גם כאן) + קריאות שירות חיצוניות מול עסקים, עם צ'אט
  פנימי (`service_call_messages`) ותחנות תשלום (`work_order_payments`), ו-polling נפרד של
  הצ'אט כל 10 שניות כל עוד המודל פתוח.
- **הפעילות שלי** (`loadMyActivities`/`_renderBizAccordion`) — accordion לכל עסק מקושר, מרונדר
  לפי `bizType`: תורים/RFQ/אישור-דחיית תור ללקוחות יופי, מנויים/צ'ק-אינים לספורט, היסטוריית
  הזמנות למסעדות/שירותים. מקור הנתונים: `GET /api/family/business-activity/:familyGroupId/:bizGroupId`.

### 4.5 Auto-refresh

`startMyOrdersAutoRefresh()` — **רץ כל 3 שניות בפועל** (לא 20 שניות כפי שתועד בעבר — תוקן כאן
לשקף את הקוד האמיתי), ללא קשר לטאב הפעיל: מרענן תמיד את `myOrdersCache` ובודק שינויי סטטוס
(מציג toast + בד bell-badge), אך מעדכן את ה-DOM בפועל רק אם `myorders` הוא הטאב הפעיל. אם טאב
"הצעות" גלוי — שולף גם הצעות מחיר. ה-interval אינו נוקה באופן מפורש (`clearInterval`) באף
מקום, אך בפועל אינו מהווה דליפה — `logout()` מבצע ניווט מלא (`window.location.href='/'`)
שמאפס את כל מצב ה-JS, כולל אינטרוולים, באותו אופן כמו אינטרוולים גלובליים נוספים באפליקציה
(למשל `pollInterval`, רענון bell badge).

**API — כל ה-endpoints הבאים מוגנים כעת `verifyFamily`/`verifyFamilyOrBiz`/`verifyBiz` עם
בדיקת בעלות (לאחר התיקון המתואר למטה):**

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | הזמנות (לא כולל הצעות) — `userId` נבדק מול session |
| GET | `/api/store/quotes/family/:familyGroupId` | הצעות מחיר פעילות למשפחה |
| POST | `/api/store/orders/:id/customer-feedback` | אישור קבלה / "לא קיבלתי" + דירוג (1-5, נאכף) |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובת לקוח להצעה (allow-list לסוגי תגובה) |
| GET | `/api/family/business-activity/:familyGroupId/:bizGroupId` | פעילות accordion לפי סוג עסק |
| PUT | `/api/family/:familyGroupId/beauty/appointments/:id/client-confirm` | אישור/דחיית תור יופי |
| GET/POST | `/api/service-calls/:id/messages` | צ'אט קריאת שירות (משפחה/עסק, לפי שייכות בפועל) |
| GET | `/api/service-calls/:id/payments` | תחנות תשלום לקריאת שירות |
| POST | `/api/service-calls/:id/payments` | הוספת תחנת תשלום (עסק בלבד) |
| GET | `/api/family/linked-businesses/:groupId` | עסקים מקושרים (היה מוגן נכון גם לפני התיקון) |

**הערה היסטורית (תועד למען שקיפות)**: עד לתיקון —
1. **5 endpoints ללא אימות כלל**: `GET /api/store/orders/my/:userId`,
   `GET /api/store/quotes/family/:familyGroupId`,
   `GET /api/family/business-activity/:familyGroupId/:bizGroupId`,
   `GET`/`POST /api/service-calls/:id/messages`, `GET`/`POST /api/service-calls/:id/payments`,
   ו-`PUT /api/family/:familyGroupId/beauty/appointments/:id/client-confirm` — כולם קיבלו את
   מזהה המשפחה/המשתמש **מה-URL או מגוף הבקשה בלבד**, ללא session. כל גורם לא-מחובר, בניחוש
   ID רציף, יכול היה לקרוא היסטוריית הזמנות מלאה, הצעות מחיר פיננסיות (כולל הנחות), תורים/
   מנויים/RFQ אישיים, וצ'אט פרטי + תשלומים של כל קריאת שירות — **ואף לכתוב** הודעות מזויפות
   "מהעסק" ולשנות סטטוס תור, ללא שום הרשאה.
2. **Stored XSS הניתן לניצול ללא חשבון כלל**: בשילוב עם #1, `safeStr()` (הפונקציה ששימשה
   כמעט בכל רינדור במודול) מבצעת escaping חלקי בלבד (`'`/`"`, לא `<`/`>`/`&`). תוקף שאינו
   מחובר בכלל יכול היה להזריק הודעת צ'אט זדונית (`POST /api/service-calls/:id/messages` ללא
   אימות) לכל `call_id` נחוש, וכל משתמש משפחה שפותח את אותה קריאת שירות (`openFamilyCallModal`)
   מריץ את הקוד הזדוני בדפדפנו. תוקן: מעבר ל-`escHtml()` (בריחה מלאה) בכל תצוגת טקסט חיצוני
   במודול (הודעות, כותרות, תיאורים, שמות עסק/טכנאי, הערות, תגובות לקוח).
3. **Bypass מובנה בבדיקת ה-IDOR היחידה שהייתה קיימת** ב-`customer-response`: הבדיקה
   `if (familyGroupId && ...)` דילגה על עצמה לחלוטין אם הקורא פשוט לא שלח `familyGroupId`
   בגוף הבקשה. תוקן: המזהה נלקח כעת מה-session בלבד (`req.familyAuth.groupId`), לא מהבקשה.
4. דליפת `e.message` גולמי ללקוח בכל ה-endpoints שנסקרו — תוקן להודעות כלליות בעברית.
5. אין ולידציה על `rating` (נדרש 1-5) — תוקן (ערך מחוץ לטווח נדחה לערך ריק).
6. אין allow-list לסוגי תגובת לקוח (`responseType`) בהצעת מחיר — תוקן.
7. אין הגבלת אורך על טקסט חופשי (הערות/תגובות/הודעות צ'אט) — נוספה הגבלה (1000-2000 תווים
   לפי סוג השדה), בדומה לתיקון המקביל במודול FlowPool.
8. פער תיעוד: Auto-refresh תועד בעבר כ"20 שניות", בפועל 3 שניות — תוקן כאן.

**לא תוקן (סיכון/שינוי התנהגות, הוחלט להשאיר כמגבלה ידועה ולא כקוד שבור):** היעדר בידול
הרשאות role בתוך המודול (CHILD = ADMIN מבחינת יכולת אישור הצעות מחיר וצפייה בנתונים
פיננסיים) — בשונה ממודול FlowPool, כאן לא נחסם CHILD, מכיוון שחסימה גורפת עלולה לפגוע
בתרחישי שימוש לגיטימיים (למשל נער/ה שמנהל/ת בעצמו/ה תיאום מול מורה פרטי). אם רצוי לשנות
זאת, יש להחליט תחילה אילו פעולות ספציפיות (למשל רק אישור הצעת מחיר מעל סכום מסוים) ראוי
להגביל ל-ADMIN, כדי לא לפגוע בפונקציונליות קיימת.

---

## 5. פיצ'רי AI — familAI

### 5.1 AI Battery System

```javascript
// מכסה: 10 פעולות יום לקבוצה (מתאפס בחצות)
ai_tokens INT DEFAULT 10
last_token_reset DATE DEFAULT CURRENT_DATE

// בדיקה לפני כל פעולה AI:
handleAITokens(groupId):
  → אם last_token_reset < TODAY: איפוס ל-10
  → אם is_premium: עוקף מגבלה
  → אם tokens > 0: tokens -= 1, return true
  → אחרת: return false → BATTERY_EMPTY error
```

**UI Battery:**
- `#ai-battery-indicator` — badge בכותרת: "⚡ X/10"
  - > 3 tokens: slate
  - 1-3 tokens: כתום
  - 0 tokens: אדום
  - Pro: gradient indigo-purple + "⚡ ∞ (Pro)"
- `#ai-battery-modal` — "הסוללה שלי התרוקנה" modal
- `#ai-warning-modal` — אזהרה לפני כל פעולה AI (ניתן להשתיק ליום)

### 5.2 פעולות AI

| פעולה | Endpoint | צרכן |
|---|---|---|
| יצירת מתכון | `POST /api/recipes/generate` | token |
| יצירת אתגר אקדמיה | `POST /api/academy/ai-generate` | token |
| ייעוץ ליעד חיסכון | `POST /api/goals/familai-advice` | token |
| תובנות תקציב | `POST /api/budget/familai-insight` | token |
| דוח מלאי מזווה | `POST /api/pantry/familai-insight` | token |
| תובנות תשקיף | `POST /api/forecast/familai-insight` | token |
| אימות משימה בתמונה | `POST /api/tasks/vision-verify` | token |
| סריקת קבלה | `POST /api/shopping/scan-receipt` | token |
| זיהוי מוצר | `POST /api/shopping/identify-product` | token |
| הסבר שגיאה (Tutor) | `POST /api/academy/tutor` | token |
| יצירת משימות AI | `POST /api/tasks/ai-generate` | token |
| צ'אט familAI | `openFamilaiChatModal()` | token |

### 5.3 executeWithAIWarning

```javascript
executeWithAIWarning(actionFn) {
  // אם Pro → מבצע ישירות
  // אם tokens <= 0 → ai-battery-modal
  // אם ofl_hide_ai_warning === today → מבצע ישירות
  // אחרת → ai-warning-modal עם "המשך בפעולה"
}
```

**Model:** Gemini 1.5/2.5 Flash (Google AI) — Auto-Discovery

---

## 6. API Endpoints — Family Environment

### 6.1 Auth

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/login` | כניסה |
| POST | `/api/groups` | יצירת קבוצה חדשה |
| POST | `/api/join` | הצטרפות לקבוצה |
| POST | `/api/forgot-code` | שחזור קוד |
| POST | `/api/groups/onboard` | השלמת הקמה |

### 6.2 Data

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/data/:userId` | שליפת כל הנתונים (main call) |
| GET | `/api/group/members` | חברי קבוצה |
| GET | `/api/transactions` | תנועות |
| POST | `/api/transaction` | הוספת תנועה |
| PUT | `/api/transaction/:id` | עריכה |
| DELETE | `/api/transaction/:id` | מחיקה |

### 6.3 Finance

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/admin/payday` | PayDay |
| POST | `/api/admin/adjust-balance` | התאמת יתרה |
| POST | `/api/admin/update-settings` | הגדרות דמי כיס |
| GET | `/api/loans` | הלוואות |
| POST | `/api/loans/request` | בקשת הלוואה |
| POST | `/api/loans/approve` | אישור הלוואה |
| POST | `/api/loans/reject` | דחיית הלוואה |
| POST | `/api/goals` | יצירת יעד |
| POST | `/api/goals/deposit` | הפקדה ליעד |
| GET | `/api/budget/filter` | תקציב |
| POST | `/api/budget/update` | עדכון תקציב |

### 6.4 Shopping & Pantry

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/shopping/add` | הוספת פריט |
| POST | `/api/shopping/update` | עדכון פריט |
| DELETE | `/api/shopping/delete/:id` | מחיקת פריט |
| DELETE | `/api/shopping/clear/:groupId` | ניקוי עגלה |
| POST | `/api/shopping/checkout` | סיום קנייה |
| GET | `/api/shopping/history` | היסטוריה |
| POST | `/api/pantry/add` | הוספת מוצר |
| POST | `/api/pantry/update` | עדכון כמות |
| POST | `/api/pantry/use` | שימוש במוצר |
| DELETE | `/api/pantry/delete/:id` | מחיקה |

### 6.5 Tasks & Academy

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/tasks` | יצירת משימה |
| POST | `/api/tasks/update` | עדכון/אישור |
| POST | `/api/tasks/ai-generate` | AI משימות |
| POST | `/api/tasks/vision-verify` | אימות תמונה AI |
| POST | `/api/academy/assign` | הקצאת אתגר |
| POST | `/api/academy/submit` | הגשת תוצאות |
| POST | `/api/academy/ai-generate` | יצירת אתגר AI |
| POST | `/api/academy/tutor` | AI tutor |

### 6.6 Orders & Community

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/store/orders/my/:userId` | הזמנות שלי |
| GET | `/api/store/quotes/family/:groupId` | הצעות מחיר |
| PATCH | `/api/store/quotes/:id/customer-response` | תגובה להצעה |
| POST | `/api/store/orders/:id/customer-feedback` | דירוג הזמנה |
| POST | `/api/community/user-create` | הצטרפות לקהילה |

### 6.7 AI Endpoints

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/recipes/generate` | מתכון AI |
| POST | `/api/goals/familai-advice` | ייעוץ יעד |
| POST | `/api/budget/familai-insight` | תובנות תקציב |
| POST | `/api/pantry/familai-insight` | דוח מלאי |
| POST | `/api/forecast/familai-insight` | תובנות תשקיף |
| POST | `/api/shopping/scan-receipt` | סריקת קבלה |
| POST | `/api/shopping/identify-product` | זיהוי מוצר |

### 6.8 Support & Settings

| Method | Path | תיאור |
|---|---|---|
| POST | `/api/support/ticket` | פתיחת קריאה |
| GET | `/api/support/tickets/my/:groupId` | קריאות שלי |
| GET | `/api/banners` | באנרים |
| GET | `/api/settings/welcome` | הודעת ברוכים |
| GET | `/api/public/legal/:key` | תקנון/פרטיות |

---

## 7. לוגיקות מיוחדות

### 7.1 Polling Intervals

| Interval | תיאור |
|---|---|
| 30,000 ms | `fetchData()` + `fetchLoans()` + `fetchPendingUsers()` (ADMIN) |
| 30,000 ms | `refreshBellBadge()` |
| 20,000 ms | `startMyOrdersAutoRefresh()` (רק ב-myorders tab) |

### 7.2 localStorage Keys

| Key | תוכן |
|---|---|
| `ofl_session` | `{user, group}` JSON |
| `ofl_sa_token` | טוקן Super Admin |
| `ofl_banners` | cache של באנרים |
| `ofl_ai_skip_{date}` | מניעת אזהרת AI יומית |
| `ofl_hide_ai_warning` | תאריך השתקת אזהרת AI |
| `tour_done_{userId}` | Tour הושלם |
| `ofl_welcome_{userId}_{code}` | הודעת welcome נצפתה |
| `ofl_upgrade_shown_{groupId}` | modal שדרוג הוצג |
| `acc_*` | הגדרות נגישות |

### 7.3 PWA

- `manifest.json` + Service Worker
- `theme-color: #4f46e5` (indigo)
- אייקונים: 192×192, 152×152
- כותרת PWA: "FamilyFlow" / "Oneflow Life"
- `beforeinstallprompt` → `deferredPrompt` → prompt() ב-Android
- iOS: הוראות ידניות (Share → Add to Home Screen)
- `setupPwaInstallSection()` — מזהה iOS/Android אוטומטית

### 7.4 Tour System

**`checkAndStartTour(force)`:**
- בדיקה: `tour_done_{userId}` ב-localStorage
- אם לא נצפה (או force=true) → הפעלה לפי role

**`triggerManualTour()`** — חשוף כ-`window.triggerManualTour`, ניתן לקריאה מ-Help

**ADMIN Tour (14 שלבים):**
header → AI battery → יתרה → FAB → shop → pantry → bank → tasks → academy → budget → forecast → recipes → members

**CHILD Tour (11 שלבים):**
ברכת ברוכים הבאים → AI battery → ארנק → shop → pantry → bank → tasks → academy → budget → forecast → recipes

**ספריית Tour:** Intro.js v7.2.0, RTL mode, `disableInteraction: true`

### 7.5 Notifications / Bell Badge

- `#bell-badge` (כותרת header) + `#fgnav-bell-badge` (Family Group NAV)
- `refreshBellBadge()` — כל 30 שניות
- `#unread-inbox-badge` — הודעות לא-נקראות ב-inbox

**Inbox (`openInboxModal`):** הודעות נכנסות מעסקים ומהמערכת

### 7.6 Accessibility

```javascript
accState = {
  'text-lg': false,       // הגדלת פונט 110%
  'grayscale': false,     // גוונים אפורים
  'contrast': false,      // ניגודיות מוגברת
  'readable-font': false, // Arial + letter-spacing
  'highlight-links': false // מסגרת סביב קישורים
}
```

פאנל נגישות: `openAccessibilityModal()` — floating pill בתחתית (תמיד גלוי).

### 7.7 באנרים פרסומיים

- `#app-banner-top` — באנר עליון (מתחת לHeader, 96px)
- `#app-banner-bottom` — באנר תחתון (מעל ה-FAB, 96px)
- טעינה: `GET /api/banners?type=FAMILY`
- Cache: localStorage `ofl_banners`

### 7.8 FAB — Floating Action Button

`#fab-container` (fixed bottom-left):
- כפתור ראשי (+) → פותח menu
- כפתורי menu:
  - 🛒 הוספה לקניות
  - ➕ הכנסה חדשה (`openTransactionModal('income')`)
  - ➖ הוצאה חדשה (`openTransactionModal('expense')`)
- כשב-shop tab: FAB מועלה (`fab-lifted`) מעל ה-cart footer

### 7.9 Floating Pill

בתחתית המסך (fixed, center):
- **עוזרת אישית** (familAI chat) — מוצג בתנאים מסוימים
- **מפריד**
- **צ'אט משפחתי** (`openTeamChatModal`) — badge הודעות לא-נקראות
- **מפריד**
- **נגישות** (תמיד גלוי)

### 7.10 support tickets

- `#tickets-modal` — פתיחת קריאת שירות (נושא + תיאור)
- `POST /api/support/ticket` → מייל התראה לסופר-אדמין
- סטטוסים: open / in_progress / resolved

### 7.11 SA Impersonation

אם `localStorage.getItem('ofl_sa_token')`:
- מציג banner אדום עם "מחובר כ-Super Admin (השתלטות)"
- כפתור "התנתק וחזור לניהול" → `exitImpersonation()`

---

## 8. Chart.js — גרף תשקיף

- `ratioChart` — Doughnut/Pie chart ב-`content-forecast`
- Canvas: `#ratioChart` (200×200)
- Script: CDN defer
- נבנה מחדש בכל `renderForecast()`
- מנהל instance: `forecastRatioChart` — destroy לפני יצירה מחדש

---

## 9. מבנה מסד הנתונים (טבלאות רלוונטיות לFamily)

| טבלה | תיאור |
|---|---|
| `family_groups` | קבוצות (משפחות/עסקים) |
| `users` | חברי קבוצה |
| `transactions` | תנועות כספיות |
| `tasks` | משימות |
| `budget_allocations` | הגדרות תקציב |
| `goals` | יעדי חיסכון |
| `loans` | הלוואות |
| `shopping_list` | רשימת קניות |
| `shopping_trips` | סיכומי קניות |
| `shopping_trip_items` | פריטי כל קניה |
| `pantry` | מלאי ביתי |
| `quiz_bundles` | חבילות אתגרי אקדמיה |
| `quiz_questions` | שאלות |
| `user_assignments` | הקצאות אתגרים |
| `communities` | קהילות |
| `community_businesses` | עסקים בקהילה |
| `store_orders` | הזמנות מעסקים |
| `inbox_messages` | הודעות נכנסות |
| `support_tickets` | קריאות שירות |
| `team_chat` | צ'אט משפחתי |
| `global_products` | מסד מוצרים גלובלי (ברקוד) |

---

*נוצר אוטומטית מקוד המקור · Oneflow Life · 2026-06-20*
