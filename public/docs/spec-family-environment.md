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

### 3.13 ניהול הבית (`content-home-maintenance`)

**מטרה:** ניהול ציוד הבית, לוח תחזוקה, ספר תקלות ואנשי קשר.

**4 תת-טאבים:**

| Tab | תיאור |
|---|---|
| ציוד 🔧 | `hm-view-items` — מכשירי הבית |
| תחזוקה 📋 | `hm-view-maintenance` — לוח תחזוקה תקופתית |
| תקלות ⚠️ | `hm-view-faults` — ספר בעיות |
| אנשי קשר 👤 | `hm-view-contacts` — ספר טכנאים |

**ניהול ציוד:** הוספה/עריכה של ציוד: שם, דגם, סדרה, תאריך רכישה, אחריות.

**לוח תחזוקה:**
- פילטר: הכל / ממתין / פג תוקף / בוצע
- תזכורות לתחזוקה תקופתית

**תקלות (service calls):**
- פילטר: הכל / פתוח / בטיפול / טופל
- כרטיס תקלה: כותרת, חומרה, סטטוס, ציוד קשור, טכנאי, תאריך מתוכנן, חיוג/WhatsApp
- `POST /api/equipment/faults/:groupId`

**אנשי קשר:**
- חיפוש בעסקי OneFlow: `openLinkBusinessModal` → חיפוש ב-database העסקים
- הוספה ידנית: שם, טלפון, מקצוע, הערות

**API:**
| Method | Path | תיאור |
|---|---|---|
| GET | `/api/equipment/items/:groupId` | ציוד |
| POST | `/api/equipment/items` | הוספת ציוד |
| GET | `/api/equipment/maintenance/:groupId` | לוח תחזוקה |
| GET | `/api/equipment/faults/:groupId` | תקלות |
| POST | `/api/equipment/faults` | פתיחת תקלה |

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

## 4. Flow הזמנות שלי — renderMyOrders

### 4.1 זרימת טעינה

```
switchTab('myorders')
  → switchMyOrdersTab('orders') // last session tab
  → fetchMyOrders()
    → GET /api/store/orders/my/:userId
    → myOrdersCache = data.orders
    → renderMyOrders()
  → loadFamilyServiceCalls()
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
    - "✅ כן, קיבלתי" → prompt דירוג 1-5 → POST feedback
    - "❌ לא קיבלתי" → הודעת פנייה לעסק

### 4.4 Auto-refresh

`startMyOrdersAutoRefresh()` → כל 20 שניות, **רק כשב-myorders tab**:
- שולף הזמנות + מרנדר
- אם tab הצעות פתוח → שולף הצעות גם

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

---

## 13. מערכת עזרה מותאמת תפקיד (Help System)

**גרסה: 2026-06-28** — נוסף לאחר ה-spec המקורי.

### 13.1 כפתור "?" — Help Sheet

בכל לשונית ראשית בסרגל התחתון מוצג כפתור עגול "?" בפינה עליונה ימנית.  
לחיצה קוראת ל-`openFamilyHelp()` שמציגה Bottom Sheet מותאמת לפי:
- **לשונית פעילה** — `window._currentFamilyTab` מעודכן בכל החלפת לשונית
- **תפקיד המשתמש** — ADMIN/MANAGER → מדריך הורה; CHILD/MEMBER → מדריך ילד

### 13.2 FAMILY_HELP_CONTENT

מאגר תוכן בקובץ `app.js` עם 14 ערכים (אחד לכל לשונית):

| לשונית | אייקון | תיאור |
|--------|--------|--------|
| `feed` | 🏠 | לוח ראשי — דשבורד |
| `shop` | 🛒 | חנות עסקים |
| `myorders` | 📦 | הזמנות שלי |
| `bank` | 💰 | בנק משפחתי |
| `cashflow` | 📊 | תזרים מזומנים |
| `academy` | 🎓 | אקדמיה |
| `tasks` | ✅ | משימות |
| `community` | 🏘️ | קהילה |
| `members` | 👥 | חברי המשפחה |
| `budget` | 💳 | תקציב |
| `pantry` | 🥫 | מלאי מזון |
| `recipes` | 👨‍🍳 | מתכונים |
| `forecast` | 🔮 | תחזית כלכלית |
| `home-maintenance` | 🔧 | תחזוקת הבית |

כל ערך מכיל:
```js
{
  icon, title,
  what,       // טקסט הסבר לילד/עובד
  what_admin, // טקסט הסבר להורה/מנהל (אופציונלי)
  tips,       // מערך טיפים לילד
  tips_admin  // מערך טיפים להורה (אופציונלי)
}
```

### 13.3 לוגיקת בחירת תוכן

```js
const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
const what  = (isAdmin && help.what_admin)  ? help.what_admin  : help.what;
const tips  = (isAdmin && help.tips_admin)  ? help.tips_admin  : help.tips;
```

---

## 14. מודול FLOW — מטבע קהילתי

**גרסה: 2026-06-28** — מערכת נקודות FLOW (סמל: Flw) נוספה.

### 14.1 מבנה הארנק

כל משפחה מחזיקה **ארנק FLOW אישי** עם:
- **יתרה** — נקודות Flw שנצברו
- **היסטוריית עסקאות** — list עם תיאור, סכום ותאריך
- **קוד מימוש** — קוד הנחה ייחודי (פורמט `FL...`) הניתן לפדייה בעסקים

### 14.2 איך מרוויחים Flw

| פעולה | סכום Flw |
|-------|---------|
| השלמת פרופיל | 15 |
| קנייה ראשונה מחנות קהילה | 10 |
| רכישת חבילת קהילה | 15 |
| פדיית מבצע קהילה | 10 |
| השארת ביקורת על עסק | 10 |
| השפעת חבר (referral) — לממליץ | 35 |
| השפעת חבר (referral) — לארנק קהילה | 15 |

### 14.3 ממשק משתמש

**לחצן ארנק** בלשונית קהילה → `loadFamilyFlowWallet()` → modal עם:
- יתרה Flw גדולה ומודגשת (גרדיאנט זהוב)
- היסטוריית 10 עסקאות אחרונות
- כפתור "מימוש" → `openFlowRedeemModal()`

**מימוש:**
1. המשתמש בוחר כמה Flw לממש (מינימום 50)
2. מקבל קוד הנחה ייחודי (`POST /api/flow/redeem`)
3. מציג את הקוד לעסק שמאמת אותו

### 14.4 API Endpoints

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/flow/wallet/family/:groupId` | יתרה + עסקאות |
| POST | `/api/flow/redeem` | יצירת קוד מימוש |
| POST | `/api/flow/redemptions/:code/use` | אימות קוד ע"י עסק |

---

## 15. מודול קהילה — פיצ'רים מתקדמים

**גרסה: 2026-06-28** — 6 פיצ'רים קהילתיים נוספו.

### 15.1 ארבע לשוניות הקהילה (`switchFamCommunityTab`)

| id | כפתור | תיאור |
|----|-------|-------|
| `join` | 🏠 הקהילות שלי | הצטרפות וניהול קהילות |
| `benefits` | 🏪 עסקים | רשימת עסקים עם הנחות |
| `news` | 📢 חדשות | מבצעים וחבילות (badge מספרי) |
| `interests` | 🔍 עניין | placeholder בלבד — string יחיד ברשימת הטאבים (app.js ~שורה 5900) שמטרתו הסתרה בלבד. אין UI, render, או תוכן תומך כלל. |

### 15.2 עמוד "הקהילות שלי" (join)

כשמחובר לקהילות מוצג:
- **רשימת קהילות פעילות** (עד 5) — עם שם, עיר, ארנק Flw (cashback)
- **תג "מנהל קהילה"** אם `is_community_manager = true`
- **כפתור "ניהול"** → `openCommunityManagerPanel()` למנהל
- **כפתור "התנתק"** → `leaveCommunity()`
- **כפתור הצטרפות לקהילה נוספת** (אם < 5)

כשלא מחובר: מוצג banner הסבר עם כפתור הצטרפות (קוד) + שדה קוד מומלץ (referral).

### 15.3 עמוד "עסקים" (benefits)

רשימת עסקים מהקהילות שלי — לכל עסק:
- שם + אייקון
- **הנחה** — אחוז הנחה + סטטוס (פעיל/ממתין למינימום משפחות)
- קישור לדף החנות של העסק
- שם הקהילה

### 15.4 עמוד "חדשות" (news)

טוען ב-`loadCommunityFeed()` → `GET /api/community/family-feed/:groupId`

**מבצעים (promotions):** `renderCommunityPromotions()`
- כרטיס מבצע עם שם עסק, תיאור, אחוז הנחה, תאריך פג תוקף
- כפתור "מימש" → `redeemCommunityPromo(promoId)` → `POST /api/community/promotions/:id/redeem`
- זיכוי Flw אוטומטי בפדיית מבצע

**חבילות (bundles):** `renderCommunityBundles()`
- חבילת עסקים — רשימת עסקים בחבילה, מחיר, תיאור
- כפתור "רכוש" → `purchaseCommunityBundle(bundleId)` → `POST /api/community/bundles/:id/purchase`
- זיכוי Flw אוטומטי בקנייה

**Banners:** `renderCommunityBanners()` — באנר גרדיאנט צבעוני של עסקים

### 15.5 מערכת הפניות (Referral)

- כל משפחה מקבלת **קוד הפניה אישי** ב-`GET /api/community/my-referral-code/:groupId`
- הקוד מוצג בכרטיס ב-join view עם כפתור **העתקה/WhatsApp**
- כאשר משפחה נרשמת עם קוד הפניה → המפנה מקבל 35Flw + קהילה מקבלת 15Flw
- שדה "קוד חבר שהמליץ" בטופס ההצטרפות לקהילה

### 15.6 API Endpoints קהילה

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/community/info/:groupId` | מידע קהילות, עסקים |
| GET | `/api/community/family-feed/:groupId` | banners, promos, bundles |
| POST | `/api/community/promotions/:id/redeem` | פדיית מבצע |
| POST | `/api/community/bundles/:id/purchase` | רכישת חבילה |
| GET | `/api/community/my-referral-code/:groupId` | קוד הפניה אישי |
| POST | `/api/community/join` | הצטרפות לקהילה (+ referralCode) |
| POST | `/api/community/leave` | עזיבת קהילה |

---

## 16. DB — טבלאות נוספות (עדכון 2026-06-28)

| טבלה | תיאור |
|------|-------|
| `flow_wallets` | ארנק Flw לישות (entity_type + entity_id) |
| `flow_transactions` | כל עסקאות ה-Flw |
| `flow_redemptions` | קודי מימוש שנוצרו |
| `community_promotions` | מבצעי עסקים בקהילה |
| `community_bundles` | חבילות עסקים |
| `community_banners` | באנרים לקידום |
| `community_referrals` | קודי הפניה ומעקב |

---

*עודכן: 2026-06-28 | Oneflow Life*
