# אפיון Storefront — חנות מקוונת ציבורית
מסמך אפיון · OneFlow Life · עודכן 24.08.2026

---

## סקירה כללית

`storefront.html` — דף ציבורי של החנות המקוונת של עסק. הלקוח נכנס, מדפדף, בוחר מוצרים, ממלא פרטי משלוח/איסוף ומגיש הזמנה. הקובץ הוא HTML יחיד (290KB) עם כל הלוגיקה ב-Vanilla JS.

---

## ארכיטקטורה

- **Frontend בלבד** — כל הלוגיקה client-side, API calls לשרת
- **ספריות:** Tailwind CSS, Font Awesome, Heebo, canvas-confetti
- **State:** משתנים גלובליים + `window.*` functions
- **API Endpoint:** `/api/store/<slug>`

---

## מבנה ה-HTML הראשי

| אלמנט | תפקיד |
|---|---|
| `#toast` | הודעות הצלחה/שגיאה |
| `#loading-screen` | מסך טעינה ראשוני |
| `#store-app` | כל האפליקציה (מוסתר עד הטעינה) |
| `#side-menu` + `#menu-overlay` | תפריט צד עם קטגוריות |

---

## Header

| אלמנט | תפקיד |
|---|---|
| `#store-hero-banner` | תמונת באנר (גובה 160px) |
| `#store-logo` | לוגו עיגול (112px) |
| `#store-name`, `#store-slogan` | שם ותגית העסק |
| `#header-hours` | שעות פעילות |
| `#header-wa` | כפתור WhatsApp |
| `#header-phone` | כפתור חייג |
| `#btn-book-appointment` | קביעת תור (מוסתר לפי הגדרות) |
| `#btn-book-table` | הזמנת שולחן (מסעדנות) |
| `#store-welcome` | הודעת ברוכים הבאים |

---

## ניווט וקטלוג

| אלמנט | תפקיד |
|---|---|
| `#categories-container` | סרגל קטגוריות אופקי עם scroll |
| `#catalog-container` | גריד המוצרים |
| `#search-input` | חיפוש חופשי (onkeyup: `handleSearch()`) |
| `#view-mode-btn` | מעבר גריד/רשימה |
| `#store-breadcrumbs` | breadcrumbs ניווט |

---

## עגלת קניות

| אלמנט | תפקיד |
|---|---|
| `#cart-footer` | sticky footer — מוצג רק כשיש פריטים |
| `#cart-total` | סכום כולל |
| `#cart-count` | כמות פריטים |
| `#btn-cart-checkout` | `openCheckoutModal()` |

---

## מודאל מוצר רגיל (`#product-modal`)

| שדה | תפקיד |
|---|---|
| `#prod-modal-image` | תמונת המוצר |
| `#prod-modal-name` | שם המוצר |
| `#prod-modal-price` | מחיר בסיס |
| `#prod-modal-desc` | תיאור קצר |
| `#prod-modal-long-desc` | תיאור ארוך |
| `#mod-options-container` | תוספות/אופציות (modifiers) |
| `#prod-modal-qty` | כמות (בקרת + / −) |
| `#mod-total-display` | מחיר דינמי כולל תוספות |
| `#btn-add-with-mod` | הוסף לסל |

---

## מודאל מוצר מורכב (`#complex-product-modal`)

| שדה | תפקיד |
|---|---|
| `#cx-modal-title` | שם המוצר |
| `#cx-modal-desc` | תיאור |
| `#cx-modal-types` | בחירת סוג |
| `#cx-modal-image-wrap` | תמונה |
| `#cx-modal-steps-container` | שלבי הרכבה (wizard) |
| `#cx-modal-qty` | כמות |
| `#cx-total-display` | מחיר כולל |
| `#btn-submit-complex` | `submitComplexProduct()` |

---

## מודאל Checkout (`#checkout-modal`)

### שדות חובה

| שדה | תיאור |
|---|---|
| `#cust-name` | שם מלא |
| `#cust-phone` | טלפון |

### Toggle: איסוף עצמי / משלוח

`toggleDelivery(bool)` — כשמשלוח, מוצגים:

| שדה | תיאור |
|---|---|
| `#cust-city` | עיר |
| `#cust-street` | רחוב |
| `#cust-house` | מספר בית |
| `#cust-floor` | קומה |
| `#cust-apt` | דירה |

### מתי ההזמנה

| אפשרות | שדה |
|---|---|
| בהקדם האפשרי | `toggleTargetTime('asap')` |
| הזמנה עתידית | `toggleTargetTime('future')` → `#target-time-input` (datetime-local) |

### סיכום
- `#checkout-items` — רשימת פריטים
- `#checkout-total` — סכום סופי

---

## מודאל הזמנת שולחן (`#table-reservation-modal`)

| שדה | תיאור |
|---|---|
| `#res-name` | שם |
| `#res-phone` | טלפון |
| `#res-guests` | מספר סועדים (`updateTableResGuests()`) |
| `#res-date` | תאריך |
| `#res-time` | שעה (`selectTableTime()`) |
| `#res-notes` | הערות |

---

## מודאל קביעת תור (`#booking-modal`)

| שדה | תיאור |
|---|---|
| שם, טלפון, תיאור | פרטי הלקוח |
| זמן | בחירת חריץ זמן (`generateAvailableTimeSlots()`) |
| `submitBookingRequest()` | שליחה לשרת |

---

## מודאל אימות SMS (`#sms-verification-modal`)

| שדה | תיאור |
|---|---|
| `#sms-code-input` | קוד 6 ספרות |
| `verifySmsCode()` | אימות |
| `closeSmsVerificationModal()` | סגירה |

---

## מודאל יצירת קשר (`#contact-modal`)

| שדה | תיאור |
|---|---|
| שם, טלפון, הודעה | פרטי פנייה |
| `submitContactForm()` | שליחה |

---

## גלריה

| אלמנט | תפקיד |
|---|---|
| `openGalleryPage()` | פתיחת עמוד גלריה |
| `openGalleryLightbox()` | לייטבוקס תמונה |
| `lbNav(dir)` | ניווט בין תמונות |
| `lbSliderChange()` | שינוי ערך סליידר |
| `lbToggleZoom()` | הגדלה/הקטנה |
| `closeGalleryPage()` | סגירה |

---

## תמיכה ספציפית לסוגי עסק

### ספורט (Sport)
| פונקציה | תפקיד |
|---|---|
| `openSportClassRegister()` | הרשמה לשיעור |
| `openSportPurchaseModal()` | רכישת מנוי |
| `openSportWaitlist()` | רשימת המתנה |
| `openSportCancelRegistration()` | ביטול הרשמה |
| `openSportRFQ()` | בקשת הצעת מחיר |
| `_sportSelfCheckin()` | צ'ק-אין עצמי |
| `_sportPublicSignWaiver()` | חתימה על כתב ויתור |
| `_sportSyncCalendar()` | סנכרון ללוח שנה |
| `_sport1ClickConfirm()` | אישור בקליק אחד |

### מומחים (Professional)
| פונקציה | תפקיד |
|---|---|
| `showProfBranding()` | מסך מיתוג מקצועי |
| `showProfStore()` | מסך חנות מקצועית |
| `_showExpertiseDetail()` | פרטי מומחיות |

### פיצה (Restaurant)
| פונקציה | תפקיד |
|---|---|
| `fillPizza()` | מילוי הזמנת פיצה |
| `selectPizzaTopping()` | בחירת תוספת |
| `togglePizzaSlice()` | בחירת חתיכה |

---

## מימוש נקודות FlowPoints

| אלמנט | תפקיד |
|---|---|
| `#flow-redeem-input` | כמות נקודות למימוש |
| `onFlowRedeemInput()` | עדכון קלט |
| `clearFlowRedeem()` | ניקוי |
| `applyPromoCode()` | החלת קוד קופון |

---

## פונקציות JavaScript ראשיות (`window.*`)

| פונקציה | תפקיד |
|---|---|
| `toggleSideMenu(bool)` | פתיחה/סגירה תפריט צד |
| `filterCategory(catId)` | סינון קטגוריה |
| `scrollCategories(dir)` | גלילה בסרגל |
| `handleSearch()` | חיפוש חי |
| `toggleViewMode()` | grid/list |
| `updateCart()` | עדכון עגלה |
| `calculateModTotal()` | חישוב מחיר עם תוספות |
| `resetStoreAfterOrder()` | איפוס לאחר הזמנה |
| `goToPromoSlide()` | מעבר לשקף מבצע |
| `addPromoProductToCart()` | הוספת מוצר מבצע |

---

## API Calls

| Method | Endpoint | תפקיד |
|---|---|---|
| GET | `/api/store/<slug>` | טעינת נתוני החנות |
| POST | `/api/store/<slug>/order` | שליחת הזמנה |
| POST | `/api/store/<slug>/booking` | קביעת תור |
| POST | `/api/store/<slug>/table` | הזמנת שולחן |
| POST | `/api/store/<slug>/contact` | יצירת קשר |
| POST | `/api/store/<slug>/verify-sms` | אימות SMS |
