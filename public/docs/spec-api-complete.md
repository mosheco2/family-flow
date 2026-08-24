# מפת API מלאה — Family-Flow

> תאריך מקורי: 2026-07-22  
> עדכון אחרון: 24.08.2026 — ביקורת middleware + 3 מודולים חדשים  
> סה"כ endpoints: ~450+ (נמנו מ-server.js)  
> רמות auth: ציבורי | verifyBizOrLegacy | requireModule(module) | verifySA | verifyZM

---

## ביקורת Middleware — 24.08.2026

| קבוצת endpoints | סה"כ | עם middleware | פתוחים | הערה |
|---|---|---|---|---|
| /api/store/* | 78 | 21 | 57 | 21 עם verifyBizOrLegacy+requireModule('sales') |
| /api/work-orders/* | 30 | 0 | 30 | כולם פתוחים — דורש טיפול |
| /api/beauty/* | 47 | 0 | 47 | כולם פתוחים — דורש טיפול |
| /api/logistics/* | 53 | 51 | 2 | 2 ציבוריים מכוון (track, leave-at-door) |
| /api/professional-* | 22 | 0 | 22 | כולם פתוחים — דורש טיפול |
| /api/community/* | 74 | 0 | 74 | כולם פתוחים — by design |
| /api/biz/* | 54 | 42 | 12 | 42 עם verifyBizOrLegacy, פירוט ברמת שורה TBD |
| /api/kids/* | 20 | 0 | 20 | כולם פתוחים — דורש טיפול |

---

## /api/auth — אימות וניהול משתמשים

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/login | כניסה למערכת | ציבורי |
| POST | /api/join | הצטרפות לקבוצה קיימת | ציבורי |
| POST | /api/forgot-code | שחזור קוד גישה | ציבורי |
| POST | /api/groups | יצירת קבוצה חדשה (אשף הקמה) | ציבורי |
| POST | /api/groups/onboard | השלמת אונבורדינג לקבוצה | ציבורי |
| GET | /api/data/:userId | טעינת נתוני משתמש מלאים | ציבורי |
| POST | /api/users/:id/password | שינוי סיסמה | ציבורי |
| POST | /api/users/:id/set-first-password | הגדרת סיסמה ראשונה | ציבורי |
| DELETE | /api/users/:id | מחיקת משתמש | ציבורי |
| PUT | /api/users/:id/permissions | עדכון הרשאות משתמש | ציבורי |
| POST | /api/admin/send-credentials | שליחת פרטי כניסה במייל | ציבורי |
| POST | /api/admin/adjust-balance | עדכון יתרה ידני | ציבורי |
| POST | /api/admin/payday | ביצוע יום תשלום | ציבורי |
| POST | /api/admin/approve-user | אישור משתמש ממתין | ציבורי |
| POST | /api/admin/change-role | שינוי תפקיד משתמש | ציבורי |
| GET | /api/admin/pending-users | רשימת ממתינים לאישור | ציבורי |
| GET | /api/admin/user-details/:userId | פרטי משתמש לאדמין | ציבורי |
| PUT | /api/admin/user-details/:userId | עדכון פרטי משתמש לאדמין | ציבורי |
| GET | /api/group/members | רשימת חברי הקבוצה | ציבורי |
| PUT | /api/groups/:id/inventory-settings | עדכון הגדרות מלאי לקבוצה | ציבורי |
| PUT | /api/groups/:id/doc-settings | עדכון הגדרות מסמכים | ציבורי |

---

## /api/sa — Super Admin

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/superadmin/send-otp | שליחת OTP לכניסה | ציבורי |
| POST | /api/superadmin/verify-otp | אימות OTP | ציבורי |
| POST | /api/superadmin/login | כניסת SA | ציבורי |
| POST | /api/superadmin/credentials | עדכון סיסמת SA | verifySA |
| GET | /api/superadmin/data | לוח בקרה ראשי — כל הנתונים | verifySA |
| GET | /api/superadmin/online-count | מספר משתמשים מחוברים | verifySA |
| GET | /api/sa/dashboard | דאשבורד מפורט SA | verifySA |
| GET | /api/superadmin/group-360/:id | תצוגת 360° של קבוצה | verifySA |
| DELETE | /api/superadmin/groups/:id | מחיקת קבוצה | verifySA |
| DELETE | /api/superadmin/users/:id | מחיקת משתמש | verifySA |
| PATCH | /api/superadmin/users/:id | עדכון משתמש | verifySA |
| POST | /api/superadmin/groups/:id/premium | הגדרת קבוצה כ-Premium | verifySA |
| POST | /api/superadmin/groups/:id/plan | שינוי פלאן קבוצה | verifySA |
| PUT | /api/sa/groups/:id | עדכון פרטי קבוצה | ציבורי |
| PUT | /api/sa/users/:id | עדכון פרטי משתמש | ציבורי |
| GET | /api/sa/groups/:id/snapshots | רשימת Snapshots לקבוצה | verifySA |
| GET | /api/sa/snapshots/:id/preview | תצוגת Snapshot | verifySA |
| POST | /api/sa/snapshots/:id/restore | שחזור Snapshot | verifySA |
| POST | /api/sa/groups/:id/snapshot | יצירת Snapshot ידני | verifySA |
| GET | /api/sa/groups/archived | קבוצות ארכיב | verifySA |
| POST | /api/sa/groups/:id/restore | שחזור קבוצה מארכיב | verifySA |
| DELETE | /api/sa/groups/:id/permanent | מחיקה קבועה | verifySA |
| GET | /api/sa/audit-log | לוג ביקורת | verifySA |
| GET | /api/sa/pilot-waitlist | רשימת המתנה לפיילוט | verifySA |
| PATCH | /api/sa/pilot-waitlist/:id | עדכון סטטוס ממתין | verifySA |
| DELETE | /api/sa/pilot-waitlist/:id | מחיקת ממתין | verifySA |
| GET | /api/sa/teams | צוותי SA | verifySA |
| POST | /api/sa/teams | יצירת צוות SA | verifySA |
| PUT | /api/sa/teams/:id | עדכון צוות SA | verifySA |
| DELETE | /api/sa/teams/:id | מחיקת צוות SA | verifySA |
| GET | /api/sa/staff | חברי צוות SA | verifySA |
| POST | /api/sa/staff | הוספת חבר צוות | verifySA |
| PUT | /api/sa/staff/:id | עדכון חבר צוות | verifySA |
| DELETE | /api/sa/staff/:id | מחיקת חבר צוות | verifySA |
| GET | /api/sa/chat/:room | הודעות צ'אט פנימי | verifySA |
| POST | /api/sa/chat | שליחת הודעת צ'אט | verifySA |
| GET | /api/sa/ai-usage | סטטיסטיקת שימוש AI | verifySA |
| GET | /api/sa/businesses | רשימת עסקים | verifySA |
| GET | /api/sa/finance-summary | סיכום פיננסי כולל | verifySA |
| GET | /api/sa/business-dues | חיובי עסקים | verifySA |
| POST | /api/sa/business-collections | רישום גביה מעסק | verifySA |
| GET | /api/sa/business-collections/:businessId | גביות לפי עסק | verifySA |
| GET | /api/sa/community-wallets | ארנקי קהילות | verifySA |
| GET | /api/sa/settings/rates | שיעורי עמלות | verifySA |
| PUT | /api/sa/settings/rates | עדכון שיעורי עמלות | verifySA |
| GET | /api/sa/settings/:keys | קריאת הגדרות מערכת | verifySA |
| POST | /api/sa/settings | עדכון הגדרת מערכת | verifySA |
| GET | /api/sa/sla-matrix | מטריצת SLA | verifySA |
| POST | /api/sa/sla-matrix | עדכון מטריצת SLA | verifySA |
| GET | /api/sa/docs/meta | מטא-דאטה תיעוד | verifySA |
| POST | /api/sa/docs/refresh/:doc | רענון תיעוד SA | verifySA |

---

## /api/sa/tickets — תמיכת SA

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/superadmin/tickets | יצירת כרטיס תמיכה | verifySA |
| GET | /api/superadmin/tickets | רשימת כרטיסי תמיכה | verifySA |
| PUT | /api/superadmin/tickets/:id/status | עדכון סטטוס כרטיס | verifySA |
| DELETE | /api/superadmin/tickets/:id | מחיקת כרטיס | verifySA |
| POST | /api/superadmin/tickets/:id/assign_and_classify | שיוך וסיווג AI | verifySA |
| POST | /api/superadmin/tickets/:id/ai-triage | טריאז' AI | verifySA |
| POST | /api/superadmin/tickets/:id/reply | תשובה לכרטיס | verifySA |
| POST | /api/sa/tickets/:id/feedback-loop | לולאת משוב | verifySA |
| POST | /api/support/ticket | פתיחת כרטיס (מצד לקוח) | ציבורי |
| POST | /api/support/tickets/:id/reply | תשובה ממשתמש | ציבורי |
| GET | /api/support/tickets/my/:groupId | כרטיסים של קבוצה | ציבורי |

---

## /api/sa/communities — ניהול קהילות (SA)

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/sa/communities | כל הקהילות | ציבורי |
| POST | /api/sa/communities | יצירת קהילה | ציבורי |
| PUT | /api/sa/communities/:id | עדכון קהילה | ציבורי |
| PUT | /api/sa/communities/:id/approve | אישור קהילה | verifySA |
| DELETE | /api/sa/communities/:id | מחיקת קהילה | ציבורי |
| GET | /api/sa/communities/:id/details | פרטי קהילה מלאים | ציבורי |
| GET | /api/sa/communities/pending-businesses | עסקים ממתינים | ציבורי |
| GET | /api/sa/communities/pending-families | משפחות ממתינות | ציבורי |
| POST | /api/sa/community-business | הוספת עסק לקהילה | ציבורי |
| GET | /api/sa/community-business/:commId | עסקים בקהילה | ציבורי |
| DELETE | /api/sa/community-business/:commId/:bizId | הסרת עסק | ציבורי |
| PUT | /api/sa/community-business/discount | עדכון הנחה | verifySA |
| POST | /api/sa/community-business/approve | אישור עסק בקהילה | ציבורי |
| POST | /api/sa/community-business/reject | דחיית עסק | ציבורי |
| POST | /api/sa/community-business/approve-direct | אישור ישיר | ציבורי |
| POST | /api/sa/community-family/approve | אישור משפחה | ציבורי |
| POST | /api/sa/community-family/reject | דחיית משפחה | ציבורי |
| POST | /api/sa/community-promo/approve | אישור מבצע | ציבורי |
| POST | /api/sa/community-promo/reject | דחיית מבצע | ציבורי |
| GET | /api/sa/community-promos/pending | מבצעים ממתינים | ציבורי |
| PUT | /api/sa/communities/:commId/set-manager | שיוך מנהל קהילה | verifySA |
| PUT | /api/sa/communities/:id/assign-zone | שיוך אזור לקהילה | verifySA |

---

## /api/zone-manager — Zone Manager

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/zone-manager/register | הרשמת ZM | ציבורי |
| POST | /api/zone-manager/forgot-password | שחזור סיסמה ZM | ציבורי |
| POST | /api/zone-manager/reset-password | איפוס סיסמה | ציבורי |
| POST | /api/zone-manager/login | כניסת ZM | ציבורי |
| GET | /api/zone-manager/dashboard | דאשבורד ZM | verifyZM |
| GET | /api/zone-manager/commissions | עמלות ZM | verifyZM |
| GET | /api/zone-manager/pending-businesses | עסקים ממתינים | verifyZM |
| POST | /api/zone-manager/community-business/approve | אישור עסק | verifyZM |
| POST | /api/zone-manager/community-business/reject | דחיית עסק | verifyZM |
| PUT | /api/zone-manager/community-business/discount | עדכון הנחה | verifyZM |
| GET | /api/zone-manager/pending-families | משפחות ממתינות | verifyZM |
| POST | /api/zone-manager/community-family/approve | אישור משפחה | verifyZM |
| POST | /api/zone-manager/community-family/reject | דחיית משפחה | verifyZM |
| GET | /api/zone-manager/family-detail/:groupId | פרטי משפחה | verifyZM |
| GET | /api/zone-manager/communities-members | חברי קהילות | verifyZM |
| GET | /api/zone-manager/all-community-managers | כל מנהלי קהילה | verifyZM |
| GET | /api/zone-manager/community-detail/:id | פרטי קהילה | verifyZM |
| POST | /api/zone-manager/set-community-manager | שיוך מנהל קהילה | verifyZM |
| GET | /api/zone-manager/campaigns | קמפיינים | verifyZM |
| POST | /api/zone-manager/campaigns | יצירת קמפיין | verifyZM |
| PUT | /api/zone-manager/campaigns/:id | עדכון קמפיין | verifyZM |
| DELETE | /api/zone-manager/campaigns/:id | מחיקת קמפיין | verifyZM |
| GET | /api/zone-manager/campaigns/:id/leads | לידים לקמפיין | verifyZM |
| GET | /api/zone-manager/leads/:id | פרטי ליד | verifyZM |
| PUT | /api/zone-manager/leads/:id | עדכון ליד | verifyZM |
| GET | /api/zone-manager/leads/:id/actions | פעולות על ליד | verifyZM |
| POST | /api/zone-manager/leads/:id/actions | הוספת פעולה | verifyZM |
| POST | /api/zone-manager/ai/generate-banner | יצירת באנר AI | verifyZM |
| POST | /api/zone-manager/ai/draft-campaign | טיוטת קמפיין AI | verifyZM |
| GET | /api/zm/articles | מאמרים ZM | verifyZM |
| POST | /api/zm/articles | יצירת מאמר ZM | verifyZM |
| DELETE | /api/zm/articles/:id | מחיקת מאמר ZM | verifyZM |

---

## /api/sa/zone-managers — Zone Managers (SA)

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/sa/zone-managers | רשימת Zone Managers | verifySA |
| GET | /api/sa/zone-managers/finance-summary | סיכום פיננסי ZM | verifySA |
| GET | /api/sa/zone-managers/pending | ZM ממתינים | verifySA |
| GET | /api/sa/zone-managers/:id/details | פרטי ZM | verifySA |
| POST | /api/sa/zone-managers | יצירת ZM | verifySA |
| PUT | /api/sa/zone-managers/:id | עדכון ZM | verifySA |
| DELETE | /api/sa/zone-managers/:id | מחיקת ZM | verifySA |
| POST | /api/sa/zone-managers/:id/zones | הוספת אזורים ל-ZM | verifySA |
| GET | /api/sa/all-zones | כל האזורים | verifySA |
| POST | /api/sa/zone-manager-payments | רישום תשלום ל-ZM | verifySA |
| GET | /api/sa/zone-manager-payments/:id | תשלומים ל-ZM | verifySA |
| GET | /api/sa/zone-settings | הגדרות אזורים | verifySA |
| PUT | /api/sa/zone-settings | עדכון הגדרות אזורים | verifySA |
| GET | /api/sa/campaigns/stats | סטטיסטיקת קמפיינים | verifySA |
| GET | /api/sa/leads/stats | סטטיסטיקת לידים | verifySA |

---

## /api/sa/banner — ניהול פרסומות (SA)

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/sa/banner/slots | חריצי פרסומות | ציבורי |
| POST | /api/sa/banner/slots | יצירת חריץ | ציבורי |
| PUT | /api/sa/banner/slots/:id | עדכון חריץ | ציבורי |
| PUT | /api/sa/banner/slots/:id/communities | שיוך קהילות לחריץ | ציבורי |
| PUT | /api/sa/banner/slots/:id/pricing | עדכון תמחור | ציבורי |
| GET | /api/sa/banner/orders | הזמנות פרסומת | ציבורי |
| GET | /api/sa/banner/slots/:id/availability | זמינות חריץ | ציבורי |
| GET | /api/sa/banner/timeline | ציר זמן פרסומות | ציבורי |
| PUT | /api/sa/banner/orders/:id/approve | אישור הזמנת פרסומת | ציבורי |
| PUT | /api/sa/banner/orders/:id | עדכון הזמנה | ציבורי |
| PUT | /api/sa/banner/orders/:id/cancel | ביטול הזמנה | ציבורי |
| GET | /api/sa/billing | חשבונאות SA | ציבורי |
| PUT | /api/sa/billing/:id/paid | סימון כשולם | ציבורי |
| GET | /api/sa/clients/:bizId/ledger | ספר חשבונות עסק | ציבורי |

---

## /api/sa/games — משחקים SA

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/sa/games | קטלוג משחקים | verifySA |
| POST | /api/sa/games | הוספת משחק | verifySA |
| PUT | /api/sa/games/:id | עדכון משחק | verifySA |
| PUT | /api/sa/games/:id/toggle | הפעל/כבה משחק | verifySA |
| PUT | /api/sa/games/global-config | הגדרות גלובליות משחקים | verifySA |
| GET | /api/sa/games/stats | סטטיסטיקת משחקים | verifySA |
| POST | /api/sa/games/dedup | ביטול כפילויות | verifySA |

---

## /api/sa/quest-library — ספריית חידונים SA

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/sa/quest-library/run-seed | ריצת Seed חידונים | verifySA |
| GET | /api/sa/quest-library | ספריית חידונים (SA) | ציבורי |
| PUT | /api/sa/quest-library/:id | עדכון חידון | verifySA |
| PATCH | /api/sa/quest-library/:id/visibility | שינוי נראות | ציבורי |
| GET | /api/quest-library | ספריית חידונים | ציבורי |
| GET | /api/quest-library/:id/questions | שאלות חידון | ציבורי |
| POST | /api/quest-library/share | שיתוף חידון | ציבורי |
| POST | /api/quest-library/:id/use | שימוש בחידון | ציבורי |
| POST | /api/quest-library/:id/rate | דירוג חידון | ציבורי |
| POST | /api/quest-library/:id/report | דיווח על חידון | ציבורי |

---

## /api/store — חנות

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/store/settings/:groupId | הגדרות חנות | ציבורי |
| POST | /api/store/settings | עדכון הגדרות | ציבורי |
| POST | /api/store/settings/presets | החלת Preset | ציבורי |
| GET | /api/store/catalog/:groupId | קטלוג מוצרים | ציבורי |
| PATCH | /api/store/catalog/:groupId/reorder | מיון קטלוג | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/catalog | הוספת מוצר | verifyBizOrLegacy + requireModule('sales') |
| PUT | /api/store/catalog/:id | עדכון מוצר | verifyBizOrLegacy + requireModule('sales') |
| DELETE | /api/store/catalog/:id | מחיקת מוצר | ציבורי |
| POST | /api/store/catalog/toggle | הפעל/כבה מוצר | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/catalog/bulk-import | ייבוא מוצרים בכמות | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/catalog/generate-image | יצירת תמונת AI | ציבורי |
| POST | /api/store/inventory-count | ספירת מלאי | ציבורי |
| GET | /api/store/orders/:groupId | הזמנות לעסק | ציבורי |
| POST | /api/store/orders | יצירת הזמנה | ציבורי |
| POST | /api/store/orders/status | עדכון סטטוס הזמנה | ציבורי |
| PATCH | /api/store/orders/:id/target-date | עדכון תאריך יעד | ציבורי |
| GET | /api/store/orders/my/:userId | הזמנות משתמש | ציבורי |
| POST | /api/store/orders/:id/customer-feedback | משוב לקוח | ציבורי |
| GET | /api/store/customers/:groupId | לקוחות CRM | ציבורי |
| POST | /api/store/customers | יצירת לקוח | ציבורי |
| PUT | /api/store/customers/:id | עדכון לקוח | verifyBizOrLegacy + requireModule('sales') |
| DELETE | /api/store/customers/:id | מחיקת לקוח | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/customers/:id/send-quote | שליחת הצעת מחיר | ציבורי |
| GET | /api/store/quotes/:groupId | הצעות מחיר | verifyBizOrLegacy + requireModule('sales') |
| GET | /api/store/quotes/family/:familyGroupId | הצעות למשפחה | ציבורי |
| POST | /api/store/quotes | יצירת הצעת מחיר | verifyBizOrLegacy + requireModule('sales') |
| PUT | /api/store/quotes/:id | עדכון הצעה | verifyBizOrLegacy + requireModule('sales') |
| PATCH | /api/store/quotes/:id/status | עדכון סטטוס הצעה | verifyBizOrLegacy + requireModule('sales') |
| PATCH | /api/store/quotes/:id/customer-response | תגובת לקוח | ציבורי |
| POST | /api/store/quotes/:id/prepare-send | הכנת שליחה | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/quotes/:id/approve | אישור הצעה | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/quotes/:id/send-to-oneflow | שליחה ל-OneFlow | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/quotes/:id/link-only | יצירת לינק בלבד | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/quotes/:id/business-message | הודעת עסק | verifyBizOrLegacy + requireModule('sales') |
| POST | /api/store/quotes/:id/to-work-order | המרה ל-Work Order | verifyBizOrLegacy + requireModule('sales') |
| GET | /api/store/commission-summary/:groupId | סיכום עמלות | ציבורי |
| GET | /api/store/coupons/:groupId | קופונים לעסק | ציבורי |
| POST | /api/store/coupons | יצירת קופון | ציבורי |
| GET | /api/store/coupons/validate | אימות קופון | ציבורי |
| DELETE | /api/store/coupons/:id | מחיקת קופון | verifyBizOrLegacy + requireModule('sales') |
| GET | /api/store/promotions/:groupId | מבצעים | ציבורי |
| POST | /api/store/promotions | יצירת מבצע | ציבורי |
| PUT | /api/store/promotions/:id | עדכון מבצע | verifyBizOrLegacy + requireModule('sales') |
| DELETE | /api/store/promotions/:id | מחיקת מבצע | verifyBizOrLegacy + requireModule('sales') |
| PUT | /api/store/promotions/toggle/:id | הפעל/כבה מבצע | verifyBizOrLegacy + requireModule('sales') |
| GET | /api/store/popups/:groupId | חלונות קופצים | ציבורי |
| POST | /api/store/popups | יצירת Popup | ציבורי |
| PUT | /api/store/popups/:id | עדכון Popup | ציבורי |
| DELETE | /api/store/popups/:id | מחיקת Popup | ציבורי |
| GET | /api/store/delivery-zones/:groupId | אזורי משלוח | ציבורי |
| POST | /api/store/delivery-zones | יצירת אזור | ציבורי |
| DELETE | /api/store/delivery-zones/:id | מחיקת אזור | ציבורי |
| GET | /api/store/gallery/:groupId | גלריה | ציבורי |
| POST | /api/store/gallery/:groupId | העלאת תמונה | ציבורי |
| DELETE | /api/store/gallery/:groupId/:imageId | מחיקת תמונה | ציבורי |
| PUT | /api/store/gallery/:groupId/reorder | מיון גלריה | ציבורי |
| POST | /api/store/gallery/:groupId/toggle | הצג/הסתר תמונה | ציבורי |
| GET | /api/store/item-image/:itemId | תמונת פריט | ציבורי |
| GET | /api/store/newsletters/:groupId | ניוזלטרים | ציבורי |
| DELETE | /api/store/newsletters/:id | מחיקת ניוזלטר | ציבורי |
| POST | /api/store/newsletter/broadcast | שידור ניוזלטר | ציבורי |
| GET | /api/store/oneflow-customers/:groupId | לקוחות OneFlow | ציבורי |
| POST | /api/store/oneflow-message | הודעת OneFlow | ציבורי |
| GET | /api/store/search-customers | חיפוש לקוחות | ציבורי |
| GET | /api/store/lookup-oneflow | חיפוש OneFlow | ציבורי |
| GET | /api/store/check-oneflow | בדיקת OneFlow | ציבורי |
| POST | /api/store/ai-desc | תיאור מוצר AI | ציבורי |
| POST | /api/store/ai-long-desc | תיאור ארוך AI | ציבורי |

---

## /api/work-orders — הזמנות עבודה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/work-orders/:businessGroupId | WOs לעסק (ישן) | ציבורי |
| GET | /api/work-orders/list/:groupId | רשימת WOs | ציבורי |
| GET | /api/work-orders/detail/:id | פרטי WO | ציבורי |
| POST | /api/work-orders/new/:groupId | יצירת WO חדש | ציבורי |
| POST | /api/work-orders/convert/:quoteId | המרת הצעה ל-WO | ציבורי |
| PUT | /api/work-orders/:id/status | עדכון סטטוס | ציבורי |
| GET | /api/work-orders/profitability/:groupId | דוח רווחיות | ציבורי |
| GET | /api/work-orders/users/:groupId | עובדים זמינים | ציבורי |
| POST | /api/work-orders/:id/assignees | הוספת מוקצה | ציבורי |
| DELETE | /api/work-orders/:id/assignees/:userId | הסרת מוקצה | ציבורי |
| PUT | /api/work-orders/:woId/assignees/:userId/cost | עדכון עלות מוקצה | ציבורי |
| GET | /api/work-orders/catalog/:groupId | מלאי לבחירה | ציבורי |
| POST | /api/work-orders/:id/inventory | הוספת חומרים | ציבורי |
| POST | /api/work-orders/:id/inventory/:resId/use | סימון שימוש | ציבורי |
| DELETE | /api/work-orders/:id/inventory/:resId | הסרת חומר | ציבורי |
| GET | /api/work-orders/:id/messages | הודעות WO | ציבורי |
| POST | /api/work-orders/:id/messages | שליחת הודעה | ציבורי |
| PUT | /api/work-orders/:id/notes | עדכון הערות | ציבורי |
| GET | /api/work-orders/:id/timeline | ציר זמן | ציבורי |
| POST | /api/work-orders/:id/calendar | הוספה ליומן | ציבורי |
| GET | /api/work-orders/:id/purchase-orders | הזמנות רכש ל-WO | ציבורי |
| POST | /api/work-orders/:id/purchase-orders | יצירת הזמנת רכש | ציבורי |
| PATCH | /api/work-orders/:id/purchase-orders/:poId/status | סטטוס הזמנת רכש | ציבורי |
| GET | /api/work-orders/purchase-orders/group/:groupId | כל הזמנות רכש | ציבורי |
| GET | /api/work-orders/:id/payments | תשלומי WO | ציבורי |
| POST | /api/work-orders/:id/payments | הוספת תשלום | ציבורי |
| PATCH | /api/work-orders/payments/:paymentId/receive | אישור קבלת תשלום | ציבורי |
| DELETE | /api/work-orders/payments/:paymentId | מחיקת תשלום | ציבורי |

---

## /api/service-calls — קריאות שירות

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/service-calls | יצירת קריאת שירות | ציבורי |
| PATCH | /api/service-calls/:id | עדכון קריאה | ציבורי |
| DELETE | /api/service-calls/:id | מחיקת קריאה | ציבורי |
| PATCH | /api/service-calls/:id/link-oneflow | קישור ל-OneFlow | ציבורי |
| GET | /api/service-calls/family/:groupId | קריאות משפחה | ציבורי |
| GET | /api/service-calls/business/:groupId | קריאות עסק | ציבורי |
| GET | /api/service-calls/customer/:businessGroupId/:familyGroupId | קריאות לקוח | ציבורי |
| GET | /api/service-calls/by-customer/:businessGroupId | קריאות לפי לקוח | ציבורי |
| GET | /api/service-calls/analytics/:businessGroupId | ניתוח קריאות | ציבורי |
| GET | /api/service-calls/:id/messages | הודעות לקריאה | ציבורי |
| POST | /api/service-calls/:id/messages | שליחת הודעה | ציבורי |
| GET | /api/service-calls/:id/notes | הערות | ציבורי |
| POST | /api/service-calls/:id/notes | הוספת הערה | ציבורי |
| GET | /api/service-calls/:id/payments | תשלומי קריאה | ציבורי |
| POST | /api/service-calls/:id/payments | הוספת תשלום | ציבורי |

---

## /api/beauty — יופי וקוסמטיקה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/beauty/:bizId/practitioners | מטפלים | ציבורי |
| POST | /api/beauty/:bizId/practitioners | הוספת מטפל | ציבורי |
| PATCH | /api/beauty/:bizId/practitioners/:id | עדכון מטפל | ציבורי |
| GET | /api/beauty/:bizId/resources | משאבים | ציבורי |
| POST | /api/beauty/:bizId/resources | הוספת משאב | ציבורי |
| PATCH | /api/beauty/:bizId/resources/:id | עדכון משאב | ציבורי |
| GET | /api/beauty/:bizId/appointments | תורים | ציבורי |
| POST | /api/beauty/:bizId/appointments | יצירת תור | ציבורי |
| PATCH | /api/beauty/:bizId/appointments/:id | עדכון תור | ציבורי |
| POST | /api/beauty/:bizId/appointments/:id/complete | סיום תור | ציבורי |
| POST | /api/beauty/:bizId/appointments/:id/no-show | סימון no-show | ציבורי |
| GET | /api/beauty/:bizId/availability | זמינות | ציבורי |
| GET | /api/beauty/:bizId/clients | לקוחות | ציבורי |
| GET | /api/beauty/:bizId/clients/:id | פרטי לקוח | ציבורי |
| POST | /api/beauty/:bizId/clients | הוספת לקוח | ציבורי |
| PATCH | /api/beauty/:bizId/clients/:id | עדכון לקוח | ציבורי |
| POST | /api/beauty/:bizId/clients/:id/formulas | הוספת נוסחה | ציבורי |
| GET | /api/beauty/:bizId/clients/:id/formulas | נוסחאות לקוח | ציבורי |
| POST | /api/beauty/:bizId/clients/:id/photos | העלאת תמונה | ציבורי |
| GET | /api/beauty/:bizId/clients/:id/photos | תמונות לקוח | ציבורי |
| GET | /api/beauty/:bizId/inventory | מלאי יופי | ציבורי |
| POST | /api/beauty/:bizId/inventory | הוספת פריט מלאי | ציבורי |
| PATCH | /api/beauty/:bizId/inventory/:id | עדכון פריט | ציבורי |
| POST | /api/beauty/:bizId/inventory/:id/adjust | התאמת מלאי | ציבורי |
| GET | /api/beauty/:bizId/inventory/alerts | התראות מלאי | ציבורי |
| GET | /api/beauty/:bizId/dashboard | דאשבורד יופי | ציבורי |
| GET | /api/beauty/:bizId/commissions | עמלות | ציבורי |
| POST | /api/beauty/:bizId/commissions/pay | תשלום עמלות | ציבורי |
| GET | /api/beauty/:bizId/services | שירותים | ציבורי |
| POST | /api/beauty/:bizId/services | הוספת שירות | ציבורי |
| PATCH | /api/beauty/:bizId/services/:id | עדכון שירות | ציבורי |
| GET | /api/beauty/:bizId/subscription-types | סוגי מנויים | ציבורי |
| POST | /api/beauty/:bizId/subscription-types | יצירת מנוי | ציבורי |
| PATCH | /api/beauty/:bizId/subscription-types/:id | עדכון מנוי | ציבורי |
| GET | /api/beauty/:bizId/client-subscriptions/:clientId | מנויי לקוח | ציבורי |
| POST | /api/beauty/:bizId/client-subscriptions | הקצאת מנוי ללקוח | ציבורי |
| PATCH | /api/beauty/:bizId/client-subscriptions/:id/use | שימוש במנוי | ציבורי |
| GET | /api/beauty/:bizId/rfq | בקשות הצעת מחיר | ציבורי |
| POST | /api/beauty/rfq | יצירת RFQ | ציבורי |
| PATCH | /api/beauty/rfq/:id/questionnaire | עדכון שאלון | ציבורי |
| POST | /api/beauty/rfq/:id/client-response | תגובת לקוח | ציבורי |
| POST | /api/beauty/rfq/:id/plan | יצירת תוכנית | ציבורי |
| POST | /api/beauty/rfq/:id/accept | אישור RFQ | ציבורי |
| POST | /api/beauty/rfq/:id/message | הודעה ב-RFQ | ציבורי |
| GET | /api/beauty/businesses | רשימת עסקי יופי | ציבורי |
| GET | /api/beauty/rfq/family/:familyId | RFQs של משפחה | ציבורי |

---

## /api/logistics — לוגיסטיקה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/logistics/dashboard/:groupId | דאשבורד | ציבורי |
| GET | /api/logistics/orders/:groupId | הזמנות | ציבורי |
| POST | /api/logistics/orders | יצירת הזמנה | ציבורי |
| PATCH | /api/logistics/orders/:id/status | עדכון סטטוס | ציבורי |
| PATCH | /api/logistics/orders/:id/assign | שיוך נהג | ציבורי |
| PATCH | /api/logistics/orders/:id/pod | אישור מסירה | ציבורי |
| PATCH | /api/logistics/orders/:id/cod | עדכון COD | ציבורי |
| PATCH | /api/logistics/orders/:id | עדכון הזמנה | ציבורי |
| DELETE | /api/logistics/orders/:id | מחיקת הזמנה | ציבורי |
| POST | /api/logistics/orders/:id/tracking-token | יצירת טוקן מעקב | ציבורי |
| GET | /api/logistics/track/:token | מעקב הזמנה | ציבורי |
| POST | /api/logistics/orders/:id/failed-attempt | כישלון מסירה | ציבורי |
| GET | /api/logistics/orders/:id/events | אירועי הזמנה | ציבורי |
| POST | /api/logistics/track/:token/leave-at-door | השאר בדלת | ציבורי |
| GET | /api/logistics/drivers/:groupId | נהגים | ציבורי |
| POST | /api/logistics/drivers | הוספת נהג | ציבורי |
| PATCH | /api/logistics/drivers/:id | עדכון נהג | ציבורי |
| PATCH | /api/logistics/drivers/:id/location | עדכון מיקום | ציבורי |
| DELETE | /api/logistics/drivers/:id | מחיקת נהג | ציבורי |
| GET | /api/logistics/driver-orders/:groupId/:driverId | הזמנות נהג | ציבורי |
| GET | /api/logistics/vehicles/:groupId | כלי רכב | ציבורי |
| POST | /api/logistics/vehicles | הוספת רכב | ציבורי |
| PATCH | /api/logistics/vehicles/:id | עדכון רכב | ציבורי |
| DELETE | /api/logistics/vehicles/:id | מחיקת רכב | ציבורי |
| GET | /api/logistics/pricing/:groupId | אזורי תמחור | ציבורי |
| POST | /api/logistics/pricing | יצירת אזור | ציבורי |
| PATCH | /api/logistics/pricing/:id | עדכון אזור | ציבורי |
| DELETE | /api/logistics/pricing/:id | מחיקת אזור | ציבורי |
| GET | /api/logistics/rate-cards/:groupId | כרטיסי תעריף | ציבורי |
| POST | /api/logistics/rate-cards | יצירת כרטיס | ציבורי |
| PATCH | /api/logistics/rate-cards/:id | עדכון כרטיס | ציבורי |
| DELETE | /api/logistics/rate-cards/:id | מחיקת כרטיס | ציבורי |
| GET | /api/logistics/customers/:groupId | לקוחות לוגיסטיקה | ציבורי |
| POST | /api/logistics/customers | הוספת לקוח | ציבורי |
| PATCH | /api/logistics/customers/:id | עדכון לקוח | ציבורי |
| DELETE | /api/logistics/customers/:id | מחיקת לקוח | ציבורי |
| GET | /api/logistics/invoices/:groupId | חשבוניות | ציבורי |
| PATCH | /api/logistics/invoices/:id/status | סטטוס חשבונית | ציבורי |
| DELETE | /api/logistics/invoices/:id | מחיקת חשבונית | ציבורי |
| GET | /api/logistics/cod/:groupId | COD פתוח | ציבורי |
| POST | /api/logistics/cod/close | סגירת COD | ציבורי |
| GET | /api/logistics/routes/:groupId | מסלולים | ציבורי |
| POST | /api/logistics/routes | יצירת מסלול | ציבורי |
| POST | /api/logistics/routes/:routeId/stops | הוספת עצירה | ציבורי |
| GET | /api/logistics/routes/:groupId/:routeId/stops | עצירות מסלול | ציבורי |
| PATCH | /api/logistics/routes/:id/status | סטטוס מסלול | ציבורי |
| DELETE | /api/logistics/routes/:id | מחיקת מסלול | ציבורי |
| GET | /api/logistics/rfq/:groupId | בקשות הצעה | ציבורי |
| POST | /api/logistics/rfq | יצירת RFQ | ציבורי |
| PATCH | /api/logistics/rfq/:id/message | הוספת הודעה | ציבורי |
| PATCH | /api/logistics/rfq/:id/quote | הגשת הצעה | ציבורי |
| PATCH | /api/logistics/rfq/:id/status | עדכון סטטוס | ציבורי |
| GET | /api/logistics/reports/:groupId | דוחות | ציבורי |

---

## /api/tables — שולחנות מסעדה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/tables/:groupId/states | מצב שולחנות | ציבורי |
| PUT | /api/tables/:groupId/states | עדכון מצב | ציבורי |
| GET | /api/tables/:groupId/assignments | שיוך עובדים | ציבורי |
| PUT | /api/tables/:groupId/assignments | עדכון שיוך | ציבורי |
| GET | /api/tables/:groupId/bills | חשבונות שולחן | ציבורי |
| PUT | /api/tables/:groupId/bills | עדכון חשבון | ציבורי |

---

## /api/community — קהילה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/community/info/:groupId | פרטי קהילה | ציבורי |
| POST | /api/community/join | הצטרפות לקהילה | ציבורי |
| DELETE | /api/community/leave/:groupId/:communityId | עזיבת קהילה | ציבורי |
| POST | /api/community/user-create | יצירת משתמש קהילתי | ציבורי |
| GET | /api/community/family-feed/:groupId | פיד משפחה | ציבורי |
| POST | /api/community/family-refer | הפניית משפחה | ציבורי |
| GET | /api/community/feed | פיד כללי | ציבורי |
| POST | /api/community/posts | פרסום פוסט | ציבורי |
| POST | /api/community/feed/mark-read | סימון כנקרא | ציבורי |
| GET | /api/community/feed/unread-counts | ספירת לא-נקראו | ציבורי |
| GET | /api/community/feed/search | חיפוש בפיד | ציבורי |
| GET | /api/community/feed/biz-promos | מבצעי עסקים בפיד | ציבורי |
| POST | /api/community/posts/:id/like | לייק לפוסט | ציבורי |
| GET | /api/community/posts/:id/comments | תגובות | ציבורי |
| POST | /api/community/posts/:id/comments | הוספת תגובה | ציבורי |
| POST | /api/community/posts/:id/report | דיווח | ציבורי |
| POST | /api/community/posts/:id/share | שיתוף | ציבורי |
| GET | /api/community/posts/:id/public | פוסט ציבורי | ציבורי |
| GET | /api/community/notifications | התראות קהילה | ציבורי |
| GET | /api/community/notifications/count | ספירת התראות | ציבורי |
| POST | /api/community/notifications/mark-read | סימון כנקרא | ציבורי |
| GET | /api/community/:communityId/groups | קבוצות עניין | ציבורי |
| POST | /api/community/groups/:id/join | הצטרפות לקבוצה | ציבורי |
| POST | /api/community/groups/:id/leave | עזיבת קבוצה | ציבורי |
| POST | /api/community/groups | יצירת קבוצת עניין | ציבורי |
| GET | /api/community/groups/:id/members | חברי קבוצה | ציבורי |
| GET | /api/community/promos/:groupId | מבצעים קהילתיים | ציבורי |
| POST | /api/community/pool | יצירת פול | ציבורי |
| GET | /api/community/pool/community/:communityId | פולי קהילה | ציבורי |
| GET | /api/community/pool/:id | פרטי פול | ציבורי |
| POST | /api/community/pool/:id/join | הצטרפות לפול | ציבורי |
| POST | /api/community/pool/:id/bid | הגשת הצעה | ציבורי |
| GET | /api/community/pool/:id/bids | הצעות בפול | ציבורי |
| POST | /api/community/pool/:id/select-bid | בחירת הצעה | ציבורי |
| POST | /api/community/pool/:id/open-round2 | פתיחת סבב 2 | ציבורי |
| POST | /api/community/pool/:id/archive | ארכוב פול | ציבורי |
| GET | /api/community/pool/:id/messages | הודעות בפול | ציבורי |
| POST | /api/community/pool/:id/message | שליחת הודעה | ציבורי |
| GET | /api/community/search-business | חיפוש עסק | ציבורי |
| GET | /api/community/articles/:communityId | מאמרים | ציבורי |
| GET | /api/community/my-initiatives/:groupId | יוזמות שלי | ציבורי |

---

## /api/biz — סביבת עסקים

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/biz/chat-assistant | עוזר AI לעסק | ציבורי |
| GET | /api/biz/export-report | ייצוא דוח | ציבורי |
| GET | /api/biz/communities/my/:bizId | קהילות שלי | ציבורי |
| GET | /api/biz/communities/available/:bizId | קהילות זמינות | ציבורי |
| POST | /api/biz/communities/join | הצטרפות לקהילה | ציבורי |
| GET | /api/biz/community-invitations/:bizId | הזמנות לקהילה | ציבורי |
| POST | /api/biz/community-invitation/accept | אישור הזמנה | ציבורי |
| POST | /api/biz/community-invitation/decline | דחיית הזמנה | ציבורי |
| DELETE | /api/biz/communities/leave/:communityId/:bizId | עזיבת קהילה | ציבורי |
| PUT | /api/biz/community-discount | עדכון הנחה | ציבורי |
| GET | /api/biz/feed/stats | סטטיסטיקת פיד | ציבורי |
| GET | /api/biz/feed/posts | פוסטי עסק | ציבורי |
| POST | /api/biz/feed/posts | פרסום פוסט עסקי | ציבורי |
| DELETE | /api/biz/feed/posts/:id | מחיקת פוסט | ציבורי |
| POST | /api/biz/community/promotions | יצירת מבצע קהילתי | ציבורי |
| GET | /api/biz/community/promotions/:bizId | מבצעים לעסק | ציבורי |
| GET | /api/biz/my-pool-bids/:bizGroupId | הצעות פול שלי | ציבורי |
| GET | /api/biz/pools/:bizGroupId | פולים לעסק | ציבורי |
| GET | /api/biz/pool-archive/:bizGroupId | ארכיון פולים | ציבורי |
| GET | /api/biz/banner/slots | חריצי פרסומות זמינים | ציבורי |
| POST | /api/biz/banner/orders | הזמנת פרסומת | ציבורי |
| GET | /api/biz/banner/orders | הזמנות פרסומת שלי | ציבורי |
| GET | /api/biz/billing | חשבונאות עסק | ציבורי |
| POST | /api/biz/billing/:id/confirm | אישור חיוב | ציבורי |

---

## /api/flow — FLW מטבע

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/flow/wallet/family/:groupId | ארנק משפחה | ציבורי |
| GET | /api/flow/wallet/business/:groupId | ארנק עסק | ציבורי |
| GET | /api/flow/community-wallet/:communityId | ארנק קהילה | ציבורי |
| POST | /api/flow/redeem | מימוש FLW | ציבורי |
| POST | /api/flow/redeem/validate | אימות מימוש | ציבורי |
| POST | /api/flow/deduct | ניכוי FLW | ציבורי |
| POST | /api/flow/daily-login | FLW כניסה יומית | ציבורי |
| POST | /api/flow/redemptions/:code/use | שימוש בקוד מימוש | ציבורי |

---

## /api/kids — ילדים ו-FLW Kid

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/kids/parent-overview/:groupId | תצוגת הורה | ציבורי |
| POST | /api/kids/profile-image/:userId | תמונת פרופיל | ציבורי |
| GET | /api/kids/games | משחקים | ציבורי |
| GET | /api/kids/wallet/:userId | ארנק ילד | ציבורי |
| GET | /api/kids/free-play-check | בדיקת משחק חופשי | ציבורי |
| POST | /api/kids/award-flw | הענקת FLW | ציבורי |
| GET | /api/kids/config/:childId | הגדרות ילד | ציבורי |
| POST | /api/kids/config | עדכון הגדרות | ציבורי |
| POST | /api/kids/redeem | מימוש FLW | ציבורי |
| POST | /api/kids/redeem-request | בקשת מימוש | ציבורי |
| GET | /api/kids/redeem-requests | בקשות מימוש | ציבורי |
| POST | /api/kids/assign-game | שיוך משחק | ציבורי |
| GET | /api/kids/assignments/:childId | שיוכים לילד | ציבורי |
| POST | /api/kids/use-round | שימוש בסבב | ציבורי |
| POST | /api/kids/renew-assignment/:id | חידוש שיוך | ציבורי |
| POST | /api/kids/quests | יצירת חידון | ציבורי |
| GET | /api/kids/quests/:childId | חידונים לילד | ציבורי |
| GET | /api/kids/quests/:questId/questions | שאלות חידון | ציבורי |
| POST | /api/kids/quests/:questId/submit | הגשת חידון | ציבורי |
| GET | /api/kids/parent-quests/:parentId | חידונים לתצוגת הורה | ציבורי |

---

## /api/family — משפחה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/family/linked-businesses/:groupId | עסקים מקושרים | ציבורי |
| GET | /api/family/business-activity/:familyGroupId/:bizGroupId | פעילות עסק | ציבורי |
| PUT | /api/family/:familyGroupId/beauty/appointments/:id/client-confirm | אישור תור לקוח | ציבורי |
| GET | /api/family/weekly-report/:groupId | דוח שבועי | ציבורי |
| POST | /api/family/chat-assistant | עוזר AI לבית | ציבורי |

---

## /api/alerts — התראות

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/alerts/rules | חוקי התראה | ציבורי |
| POST | /api/alerts/rules | יצירת חוק | ציבורי |
| PUT | /api/alerts/rules/:id | עדכון חוק | ציבורי |
| DELETE | /api/alerts/rules/:id | מחיקת חוק | ציבורי |
| GET | /api/alerts/notifications | התראות | ציבורי |
| GET | /api/alerts/unread-count | ספירת לא-נקראו | ציבורי |
| POST | /api/alerts/notifications/:id/read | סימון כנקרא | ציבורי |
| POST | /api/alerts/notifications/read-all | סימון הכל כנקרא | ציבורי |
| POST | /api/alerts/notifications | יצירת התראה | ציבורי |

---

## /api/finance — כספים

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/transactions | טעינת עסקאות | ציבורי |
| POST | /api/transaction | הוספת עסקה | ציבורי |
| PUT | /api/transaction/:id | עדכון עסקה | ציבורי |
| DELETE | /api/transaction/:id | מחיקת עסקה | ציבורי |
| GET | /api/budget/filter | פילטר תקציב | ציבורי |
| POST | /api/budget/update | עדכון תקציב | ציבורי |
| GET | /api/loans | הלוואות | ציבורי |
| POST | /api/loans/request | בקשת הלוואה | ציבורי |
| POST | /api/loans/approve | אישור הלוואה | ציבורי |
| POST | /api/loans/reject | דחיית הלוואה | ציבורי |
| POST | /api/goals | יצירת מטרה | ציבורי |
| POST | /api/goals/deposit | הפקדה למטרה | ציבורי |
| GET | /api/reports/:groupId | דוחות כלליים | ציבורי |

---

## /api/professional — פלטפורמה מקצועית

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/professional-content/:groupId | תוכן אתר | ציבורי |
| POST | /api/professional-content/:groupId | עדכון תוכן | ציבורי |
| GET | /api/professional-expertise/:groupId | תחומי מומחיות | ציבורי |
| POST | /api/professional-expertise/:groupId | הוספת מומחיות | ציבורי |
| PATCH | /api/professional-expertise/:id | עדכון מומחיות | ציבורי |
| DELETE | /api/professional-expertise/:id | מחיקה | ציבורי |
| GET | /api/professional-articles/:groupId | מאמרים | ציבורי |
| POST | /api/professional-articles/:groupId | פרסום מאמר | ציבורי |
| PATCH | /api/professional-articles/:id | עדכון מאמר | ציבורי |
| DELETE | /api/professional-articles/:id | מחיקת מאמר | ציבורי |
| GET | /api/professional-leads/:groupId | לידים | ציבורי |
| POST | /api/professional-leads/:groupId | הוספת ליד | ציבורי |
| PATCH | /api/professional-leads/:id | עדכון ליד | ציבורי |
| GET | /api/professional-documents/:groupId | מסמכים | ציבורי |
| POST | /api/professional-documents/:groupId | יצירת מסמך | ציבורי |
| PATCH | /api/professional-documents/:id | עדכון מסמך | ציבורי |
| DELETE | /api/professional-documents/:id | מחיקת מסמך | ציבורי |
| GET | /api/professional-documents/:id/versions | גרסאות מסמך | ציבורי |
| POST | /api/professional-documents/:id/send-email | שליחה במייל | ציבורי |
| GET | /api/professional-doc-types/:groupId | סוגי מסמכים | ציבורי |
| POST | /api/professional-doc-types/:groupId | יצירת סוג | ציבורי |
| DELETE | /api/professional-doc-types/:id | מחיקת סוג | ציבורי |
| GET | /api/professional/dashboard/:groupId | דאשבורד | ציבורי |
| GET | /api/timelog/:groupId | לוג שעות | ציבורי |
| POST | /api/timelog/:groupId | רישום שעות | ציבורי |
| PATCH | /api/timelog/entry/:id/bill | סימון כחויב | ציבורי |
| DELETE | /api/timelog/entry/:id | מחיקת רשומה | ציבורי |

---

## /api/ai — בינה מלאכותית

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/ai/chat | צ'אט AI | verifySA |
| POST | /api/sa/ai/chat | צ'אט AI SA | verifySA |
| POST | /api/ai/generate | יצירת תוכן | ציבורי |
| POST | /api/ai/generate-image | יצירת תמונה AI | ציבורי |
| POST | /api/ai/generate-catalog | יצירת קטלוג | ציבורי |
| POST | /api/ai/parse-pdf | פירוס PDF | ציבורי |
| POST | /api/ai/actions | פעולות AI | ציבורי |
| POST | /api/ai/sport/training-plan | תוכנית אימונים AI | ציבורי |
| POST | /api/tasks/ai-generate | יצירת משימות | ציבורי |
| POST | /api/tasks/vision-verify | אימות תמונה | ציבורי |
| POST | /api/shopping/scan-receipt | סריקת קבלה | ציבורי |
| POST | /api/shopping/ai-generate-list | יצירת רשימה AI | ציבורי |
| POST | /api/goals/familai-advice | ייעוץ AI למטרות | ציבורי |
| POST | /api/budget/familai-insight | תובנות תקציב AI | ציבורי |
| POST | /api/pantry/familai-insight | תובנות מזון AI | ציבורי |
| POST | /api/forecast/familai-insight | תחזית AI | ציבורי |
| POST | /api/recipes/generate | יצירת מתכונים AI | ציבורי |
| POST | /api/academy/ai-generate | יצירת תרגילים | ציבורי |
| POST | /api/academy/tutor | מדריך AI | ציבורי |
| POST | /api/guide/chat | צ'אט מדריך | ציבורי |
| POST | /api/store/ai-desc | תיאור מוצר AI | ציבורי |
| POST | /api/store/ai-long-desc | תיאור ארוך AI | ציבורי |
| POST | /api/sa/ai-generate | יצירת תוכן SA | ציבורי |

---

## /api/b2b — מסחר בין עסקים

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/b2b/catalog/:groupId | קטלוג B2B | ציבורי |
| GET | /api/b2b/orders/:groupId | הזמנות B2B | ציבורי |
| POST | /api/b2b/orders | יצירת הזמנת B2B | ציבורי |
| PUT | /api/b2b/orders/:id/status | עדכון סטטוס | ציבורי |
| POST | /api/b2b/orders/receive | קבלת הזמנה | ציבורי |
| DELETE | /api/b2b/orders/:id | מחיקת הזמנה | ציבורי |

---

## /api/suppliers — ספקים

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/suppliers/:groupId | ספקים | ציבורי |
| POST | /api/suppliers | הוספת ספק | ציבורי |
| DELETE | /api/suppliers/:id | מחיקת ספק | ציבורי |
| GET | /api/suppliers/:supplierId/products | מוצרי ספק | ציבורי |
| POST | /api/suppliers/products | הוספת מוצר ספק | ציבורי |
| DELETE | /api/suppliers/products/:id | מחיקת מוצר | ציבורי |
| GET | /api/suppliers/group/:groupId/all-products | כל מוצרי הספקים | ציבורי |

---

## /api/equipment — ציוד ותחזוקה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/equipment/items/:groupId | פריטי ציוד | ציבורי |
| POST | /api/equipment/items | הוספת פריט | ציבורי |
| DELETE | /api/equipment/items/:id | מחיקת פריט | ציבורי |
| GET | /api/equipment/items/:id/history | היסטוריית פריט | ציבורי |
| GET | /api/equipment/maintenance/:groupId | אחזקות | ציבורי |
| POST | /api/equipment/maintenance | יצירת אחזקה | ציבורי |
| PUT | /api/equipment/maintenance/:id/complete | סיום אחזקה | ציבורי |
| DELETE | /api/equipment/maintenance/:id | מחיקת אחזקה | ציבורי |
| GET | /api/equipment/faults/:groupId | תקלות | ציבורי |
| POST | /api/equipment/faults | דיווח תקלה | ציבורי |
| PATCH | /api/equipment/faults/:id/status | עדכון סטטוס | ציבורי |
| DELETE | /api/equipment/faults/:id | מחיקת תקלה | ציבורי |
| GET | /api/equipment/faults/:id/notes | הערות תקלה | ציבורי |
| POST | /api/equipment/faults/:id/notes | הוספת הערה | ציבורי |
| GET | /api/equipment/technicians/:groupId | טכנאים | ציבורי |
| POST | /api/equipment/technicians | הוספת טכנאי | ציבורי |
| DELETE | /api/equipment/technicians/:id | מחיקת טכנאי | ציבורי |
| POST | /api/equipment/technicians/:id/link-business | קישור לעסק | ציבורי |

---

## /api/public — ציבורי (ללא auth)

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/public/settings/:key | הגדרה ציבורית | ציבורי |
| GET | /api/public/store-popups/:groupId | Popups ציבוריים | ציבורי |
| GET | /api/public/gallery/:groupId | גלריה ציבורית | ציבורי |
| GET | /api/public/restaurants/:groupId/availability/:date | זמינות שולחנות | ציבורי |
| POST | /api/public/restaurants/:groupId/book-table | הזמנת שולחן | ציבורי |
| POST | /api/public/restaurants/:groupId/verify-table-sms | אימות SMS | ציבורי |
| GET | /api/public/campaign/:token | דף קמפיין | ציבורי |
| POST | /api/public/campaign/:token/submit | הגשת ליד | ציבורי |
| GET | /api/storefront/:code | חלון ראווה ציבורי | ציבורי |
| GET | /api/banners | פרסומות | ציבורי |
| POST | /api/pilot-waitlist | הצטרפות לפיילוט | ציבורי |
| GET | /api/ads | מודעות | ציבורי |
| GET | /track/:token | מעקב חבילה | ציבורי |
| GET | /api/sport/public-types/:groupId | סוגי מנויים ציבורי | ציבורי |
| GET | /api/sport/public-schedule/:groupId | לוח זמנים ציבורי | ציבורי |
| POST | /api/sport/public-membership-purchase | רכישת מנוי | ציבורי |
| POST | /api/sport/public-class-register | הרשמה לשיעור | ציבורי |
| DELETE | /api/sport/public-class-register | ביטול הרשמה | ציבורי |
| POST | /api/sport/public-sign-declaration | חתימת הצהרה | ציבורי |

---

## /api/shopping — קניות

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/shopping/add | הוספת פריט | ציבורי |
| POST | /api/shopping/update | עדכון פריט | ציבורי |
| DELETE | /api/shopping/delete/:id | מחיקת פריט | ציבורי |
| DELETE | /api/shopping/clear/:groupId | ניקוי רשימה | ציבורי |
| GET | /api/shopping/category-map | מיפוי קטגוריות | ציבורי |
| POST | /api/shopping/category-map | עדכון מיפוי | ציבורי |
| POST | /api/shopping/checkout | סיום קנייה | ציבורי |
| GET | /api/shopping/history | היסטוריית קניות | ציבורי |
| POST | /api/shopping/copy | העתקת רשימה | ציבורי |
| GET | /api/shopping/saved | רשימות שמורות | ציבורי |
| POST | /api/shopping/save | שמירת רשימה | ציבורי |
| POST | /api/shopping/load-saved | טעינת רשימה שמורה | ציבורי |
| DELETE | /api/shopping/saved/:id | מחיקת רשימה | ציבורי |
| POST | /api/shopping/supermarket/start | התחלת טיול קניות | ציבורי |
| POST | /api/shopping/supermarket/end | סיום טיול קניות | ציבורי |
| POST | /api/shopping/scan-receipt/save | שמירת קבלה סרוקה | ציבורי |

---

## /api/timeclock — שעון נוכחות

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/timeclock/status | מצב נוכחי | ציבורי |
| POST | /api/timeclock/punch | כניסה/יציאה | ציבורי |
| POST | /api/timeclock/set-location | הגדרת מיקום | ציבורי |
| GET | /api/timeclock/report | דוח שעות | ציבורי |
| POST | /api/timeclock/manual | רישום ידני | ציבורי |

---

## /api/settings — הגדרות מערכת

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/settings/tour | הגדרות Tour | ציבורי |
| PUT | /api/settings/tour | עדכון Tour | ציבורי |
| GET | /api/settings/welcome | הגדרות Welcome | ציבורי |
| GET | /api/settings/member-content | תוכן לחבר | ציבורי |
| GET | /api/settings/pwa-prompt | הגדרות PWA | ציבורי |
| GET | /api/settings/login-mode | מצב כניסה | ציבורי |
| GET | /api/system/public-config | הגדרות ציבוריות | ציבורי |
| GET | /api/page-images/:page | תמונות דף | ציבורי |
| POST | /api/page-images/:page/:slot | שמירת תמונה | ציבורי |
| PATCH | /api/page-images/:page/:slot/toggle | הצג/הסתר | ציבורי |
| DELETE | /api/page-images/:page/:slot | מחיקת תמונה | ציבורי |

---

## /api/live-games — Live Game Host *(נוסף 24.08.2026)*

> 20 endpoints | 15 עם verifySA, 5 ציבוריים במכוון (join/answer/state/image/leaderboard)

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/live-games | יצירת משחק חי | verifySA |
| PUT | /api/live-games/:id | עדכון משחק | verifySA |
| GET | /api/live-games/:id | פרטי משחק | verifySA |
| GET | /api/live-games | כל המשחקים | verifySA |
| DELETE | /api/live-games/:id | מחיקת משחק | verifySA |
| PUT | /api/live-games/:id/status | עדכון סטטוס | verifySA |
| POST | /api/live-games/:id/next-question | שאלה הבאה | verifySA |
| PUT | /api/live-games/:id/restart | אתחול משחק | verifySA |
| GET | /api/live-games/:id/waiting-room | חדר המתנה | verifySA |
| POST | /api/live-games/:id/approve | אישור שחקן | verifySA |
| POST | /api/live-games/:id/approve-all | אישור כולם | verifySA |
| POST | /api/live-games/:id/notify-start | הודעת פתיחה | verifySA |
| PATCH | /api/live-games/:id/visibility | שינוי נראות | verifySA |
| POST | /api/live-games/:id/assign | שיוך קהילות | verifySA |
| GET | /api/live-games/:id/assignments | שיוכי קהילות | verifySA |
| POST | /api/live-games/:game_code/join | הצטרפות לחדר | ציבורי |
| POST | /api/live-games/:game_code/answer | הגשת תשובה | ציבורי |
| GET | /api/live-games/:game_code/state | מצב משחק | ציבורי |
| GET | /api/live-games/:game_code/image/:type | תמונת משחק | ציבורי |
| GET | /api/live-games/:id/leaderboard | לוח תוצאות | ציבורי |

---

## /api/family/link-requests + /api/biz/service-areas + /api/family/preferred-areas *(נוסף 24.08.2026)*

> 13 endpoints אומתו (14 לפי ספירה — endpoint אחד TBD) | כולם ללא middleware

### קישורי משפחה-למשפחה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| POST | /api/family/link-request | יצירת בקשת קישור | ציבורי |
| GET | /api/family/link-requests/:groupId | בקשות קישור לקבוצה | ציבורי |
| POST | /api/family/link-request/:id/respond | מענה לבקשה | ציבורי |

### אזורי שירות עסק

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/biz/service-areas/:groupId | אזורי שירות | ציבורי |
| POST | /api/biz/service-areas/:groupId | הוספת אזור | ציבורי |
| DELETE | /api/biz/service-areas/:groupId/:areaId | מחיקת אזור | ציבורי |
| POST | /api/biz/location/:groupId | עדכון מיקום עסק | ציבורי |
| GET | /api/biz/radius-zones/:groupId | אזורי רדיוס | ציבורי |
| POST | /api/biz/radius-zones/:groupId | הוספת אזור רדיוס | ציבורי |
| DELETE | /api/biz/radius-zones/:groupId/:zoneId | מחיקת אזור רדיוס | ציבורי |

### אזורי העדפה משפחה

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/family/preferred-areas/:groupId | אזורים מועדפים | ציבורי |
| POST | /api/family/preferred-areas/:groupId | הוספת אזור | ציבורי |
| DELETE | /api/family/preferred-areas/:groupId/:areaId | מחיקת אזור | ציבורי |

> הערה: endpoint 14 — TBD, לא אומת בסשן זה

---

## Community Social Feed — הערת עדכון *(24.08.2026)*

> Endpoints אלה נמצאים תחת /api/community/ (ראה מקטע קהילה לעיל).  
> 2 endpoints חסרים מהרשימה הקיימת:  
> - GET /api/community/posts/:id/likers  
> - GET /api/community/posts/:id/sharers  
> סה"כ ספירה: ~23 social feed endpoints תחת /api/community/ — כולם ללא middleware
