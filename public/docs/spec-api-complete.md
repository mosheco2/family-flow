# מפת API מלאה — Family Flow

> **נוצר אוטומטית מ-server.js** | סה"כ ~871 נתיבים ייחודיים

---

## קבוצות API

### SUPER ADMIN (`/api/sa/*`, `/api/superadmin/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/sa/groups` | רשימת קהילות |
| `GET /api/sa/groups/:id` | פרטי קהילה |
| `DELETE /api/sa/groups/:id` | מחיקת קהילה |
| `GET /api/sa/groups/archived` | קהילות ארכיון |
| `POST /api/sa/groups/:id/restore` | שחזור קהילה |
| `DELETE /api/sa/groups/:id/permanent` | מחיקה קבועה |
| `GET /api/sa/groups/:id/snapshots` | תמונות מצב |
| `POST /api/sa/groups/:id/snapshot` | יצירת תמונת מצב |
| `GET /api/sa/snapshots/:id/preview` | תצוגה מקדימה |
| `POST /api/sa/snapshots/:id/restore` | שחזור תמונת מצב |
| `GET /api/sa/users/:id` | פרטי משתמש |
| `GET /api/superadmin/group-360/:id` | תצוגת 360 לקהילה |
| `GET /api/superadmin/groups/:id` | קהילה (superadmin) |
| `GET /api/sa/audit-log` | לוג ביקורת |
| `GET /api/sa/teams` | צוות SA |
| `POST /api/sa/teams` | הוספת חבר צוות |
| `PUT /api/sa/teams/:id` | עדכון חבר צוות |
| `DELETE /api/sa/teams/:id` | הסרת חבר צוות |
| `GET /api/sa/staff` | סגל |
| `POST /api/sa/staff` | הוספת סגל |
| `PUT /api/sa/staff/:id` | עדכון סגל |
| `DELETE /api/sa/staff/:id` | מחיקת סגל |
| `GET /api/sa/chat/:room` | צ'אט פנימי |
| `POST /api/sa/chat` | שליחת הודעה פנימית |
| `GET /api/sa/sla-matrix` | מטריצת SLA |
| `POST /api/sa/sla-matrix` | עדכון SLA |
| `GET /api/sa/ai/chat` | AI צ'אט |
| `POST /api/sa/ai-generate` | יצירת תוכן AI |
| `GET /api/sa/dev/check-duplicates` | בדיקת כפילויות |
| `GET /api/sa/versions` | גרסאות מערכת |
| `GET /api/sa/product-book` | ספר מוצרים |
| `GET /api/sa/product-matrix` | מטריצת מוצרים |
| `GET /api/sa/quest-library` | ספריית שאלות |
| `POST /api/sa/quest-library/run-seed` | שתילת שאלות |
| `PUT /api/sa/quest-library/:id` | עדכון שאלה |
| `PUT /api/sa/quest-library/:id/visibility` | שינוי נראות |
| `GET /api/sa/pilot-waitlist` | רשימת המתנה |
| `POST /api/sa/pilot-waitlist/:id` | עדכון רשימת המתנה |
| `DELETE /api/sa/pilot-waitlist/:id` | הסרה מרשימת המתנה |
| `POST /api/sa/groups/:id/snapshots` | עדכון תמונת מצב |
| `GET /api/sa/docs/meta` | מטא-דאטה של דוקים |
| `POST /api/sa/docs/refresh/:doc` | עדכון דוק |
| `GET /api/superadmin/tickets` | כרטיסי תמיכה |
| `PUT /api/superadmin/tickets/:id/status` | עדכון סטטוס כרטיס |
| `DELETE /api/superadmin/tickets/:id` | מחיקת כרטיס |
| `POST /api/superadmin/tickets/:id/assign_and_classify` | שיוך וסיווג |
| `POST /api/superadmin/tickets/:id/ai-triage` | טיפול AI |
| `POST /api/superadmin/tickets/:id/reply` | תגובה לכרטיס |
| `POST /api/superadmin/send-otp` | שליחת OTP |
| `POST /api/superadmin/verify-otp` | אימות OTP |
| `POST /api/superadmin/login` | כניסת SA |
| `PUT /api/superadmin/credentials` | עדכון פרטי כניסה |

---

### אימות ומשתמשים (`/api/auth/*`, `/api/admin/*`)

| נתיב | תיאור |
|------|--------|
| `POST /api/admin/adjust-balance` | התאמת יתרה |
| `POST /api/admin/approve-user` | אישור משתמש |
| `POST /api/admin/change-role` | שינוי תפקיד |
| `POST /api/admin/payday` | יום שכר |
| `GET /api/admin/pending-users` | משתמשים ממתינים |
| `POST /api/admin/send-credentials` | שליחת פרטי כניסה |
| `PUT /api/admin/update-settings` | עדכון הגדרות |
| `GET /api/admin/user-details/:userId` | פרטי משתמש |

---

### קהילה (`/api/community/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/community/groups` | רשימת קבוצות |
| `POST /api/community/groups/:id/join` | הצטרפות לקבוצה |
| `POST /api/community/groups/:id/leave` | עזיבת קבוצה |
| `GET /api/community/groups/:id/members` | חברי קבוצה |
| `POST /api/community/groups/:id/add-family` | הוספת משפחה |
| `DELETE /api/community/groups/:id/remove-family` | הסרת משפחה |
| `GET /api/community/feed` | פיד קהילה |
| `GET /api/community/feed/biz-promos` | פרסומות עסקים |
| `POST /api/community/feed/mark-read` | סימון כנקרא |
| `GET /api/community/feed/search` | חיפוש בפיד |
| `GET /api/community/feed/unread-counts` | ספירת לא-נקרא |
| `GET /api/community/posts` | פוסטים |
| `POST /api/community/posts/:id/comments` | תגובה לפוסט |
| `POST /api/community/posts/:id/like` | לייק |
| `GET /api/community/posts/:id/likers` | מלייקים |
| `POST /api/community/posts/:id/public` | פרסום ציבורי |
| `POST /api/community/posts/:id/report` | דיווח |
| `POST /api/community/posts/:id/share` | שיתוף |
| `GET /api/community/posts/:id/sharers` | משתפים |
| `GET /api/community/inbox/:groupId` | תיבת דואר נכנס |
| `POST /api/community/inbox/new` | הודעה חדשה |
| `GET /api/community/inbox/thread/:threadId/:groupId` | שרשור |
| `POST /api/community/inbox/thread/:threadId/reply` | תגובה לשרשור |
| `GET /api/community/notifications` | התראות |
| `GET /api/community/notifications/count` | ספירת התראות |
| `POST /api/community/notifications/mark-read` | סימון כנקרא |
| `GET /api/community/promotions/:communityId` | מבצעים |
| `POST /api/community/promotions/:id/redeem` | מימוש מבצע |
| `POST /api/community/promotions/validate` | אימות מבצע |
| `GET /api/community/bundles/:communityId` | חבילות |
| `POST /api/community/bundles/:id/purchase` | רכישת חבילה |
| `GET /api/community/articles/:communityId` | מאמרים |
| `POST /api/community/join` | הצטרפות לקהילה |
| `DELETE /api/community/leave/:groupId/:communityId` | עזיבת קהילה |
| `GET /api/community/search-business` | חיפוש עסק |
| `GET /api/community/info/:groupId` | מידע על קהילה |
| `GET /api/community/manager-data/:groupId` | נתוני מנהל |
| `POST /api/community/manager/articles` | ניהול מאמרים |
| `POST /api/community/manager/family/approve` | אישור משפחה |
| `POST /api/community/manager/family/reject` | דחיית משפחה |
| `GET /api/community/pool` | FlowPool |
| `POST /api/community/pool` | יצירת FlowPool |
| `GET /api/community/pool/:id` | פרטי FlowPool |
| `POST /api/community/pool/:id/bid` | הצעת מחיר |
| `POST /api/community/pool/:id/join` | הצטרפות לPool |
| `POST /api/community/pool/:id/message` | הודעה לPool |
| `GET /api/community/pool/:id/messages` | הודעות Pool |
| `POST /api/community/pool/:id/select-bid` | בחירת הצעה |
| `POST /api/community/approved-banners` | באנרים מאושרים |
| `POST /api/community/user-create` | יצירת משתמש |

---

### עסקים (`/api/biz/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/biz/billing` | חיובים |
| `POST /api/biz/billing/:id/confirm` | אישור חיוב |
| `GET /api/biz/communities/available/:bizId` | קהילות זמינות |
| `POST /api/biz/communities/join` | הצטרפות לקהילה |
| `DELETE /api/biz/communities/leave/:communityId/:bizId` | עזיבת קהילה |
| `GET /api/biz/communities/my/:bizId` | הקהילות שלי |
| `GET /api/biz/community/feed-posts/:bizId` | פוסטים בפיד |
| `POST /api/biz/community/feed-posts` | פרסום בפיד |
| `DELETE /api/biz/community/feed-posts/:id` | מחיקת פוסט |
| `GET /api/biz/community/promotions/:bizId` | מבצעים שלי |
| `POST /api/biz/community/promotions` | יצירת מבצע |
| `DELETE /api/biz/community/promotions/:businessId` | מחיקת מבצע |
| `GET /api/biz/banner/slots` | חריצי באנר |
| `GET /api/biz/banner/orders` | הזמנות באנר |
| `POST /api/biz/export-report` | ייצוא דוח |
| `GET /api/biz/pools/:bizGroupId` | FlowPools |
| `GET /api/biz/my-pool-bids/:bizGroupId` | ה-Bids שלי |
| `GET /api/biz/pool-archive/:bizGroupId` | ארכיון Pools |
| `POST /api/biz/chat-assistant` | AI עוזר צ'אט |

---

### יופי וקוסמטיקה (`/api/beauty/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/beauty/:bizId/appointments` | תורים |
| `POST /api/beauty/:bizId/appointments` | קביעת תור |
| `PUT /api/beauty/:bizId/appointments/:id` | עדכון תור |
| `POST /api/beauty/:bizId/appointments/:id/complete` | סיום תור |
| `POST /api/beauty/:bizId/appointments/:id/no-show` | אי-הגעה |
| `GET /api/beauty/:bizId/availability` | זמינות |
| `GET /api/beauty/:bizId/clients` | לקוחות |
| `POST /api/beauty/:bizId/clients` | לקוח חדש |
| `PUT /api/beauty/:bizId/clients/:id` | עדכון לקוח |
| `GET /api/beauty/:bizId/clients/:id/formulas` | פורמולות |
| `GET /api/beauty/:bizId/clients/:id/photos` | תמונות |
| `GET /api/beauty/:bizId/commissions` | עמלות |
| `POST /api/beauty/:bizId/commissions/pay` | תשלום עמלה |
| `GET /api/beauty/:bizId/dashboard` | דשבורד |
| `GET /api/beauty/:bizId/inventory` | מלאי |
| `POST /api/beauty/:bizId/inventory` | פריט מלאי |
| `PUT /api/beauty/:bizId/inventory/:id` | עדכון מלאי |
| `POST /api/beauty/:bizId/inventory/:id/adjust` | התאמת מלאי |
| `GET /api/beauty/:bizId/inventory/alerts` | התראות מלאי |
| `GET /api/beauty/:bizId/practitioners` | מטפלים |
| `POST /api/beauty/:bizId/practitioners` | מטפל חדש |
| `PUT /api/beauty/:bizId/practitioners/:id` | עדכון מטפל |
| `GET /api/beauty/:bizId/resources` | משאבים |
| `POST /api/beauty/:bizId/resources` | משאב חדש |
| `PUT /api/beauty/:bizId/resources/:id` | עדכון משאב |
| `GET /api/beauty/:bizId/services` | שירותים |
| `POST /api/beauty/:bizId/services` | שירות חדש |
| `PUT /api/beauty/:bizId/services/:id` | עדכון שירות |
| `GET /api/beauty/:bizId/subscription-types` | סוגי מנויים |
| `POST /api/beauty/:bizId/client-subscriptions` | מנוי ללקוח |
| `POST /api/beauty/:bizId/client-subscriptions/:id/use` | שימוש במנוי |
| `GET /api/beauty/:bizId/rfq` | RFQ |
| `POST /api/beauty/rfq` | RFQ חדש |

---

### ספורט (`/api/sport/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/sport/:bizId/classes` | שיעורים |
| `POST /api/sport/:bizId/classes` | שיעור חדש |
| `PUT /api/sport/:bizId/classes/:id` | עדכון שיעור |
| `DELETE /api/sport/:bizId/classes/:id` | מחיקת שיעור |
| `POST /api/sport/:bizId/classes/:id/cancel` | ביטול שיעור |
| `GET /api/sport/:bizId/class-types` | סוגי שיעורים |
| `POST /api/sport/:bizId/class-types` | סוג שיעור חדש |
| `GET /api/sport/:bizId/memberships` | מנויים |
| `POST /api/sport/:bizId/memberships` | מנוי חדש |
| `GET /api/sport/:bizId/membership-types` | סוגי מנויים |
| `POST /api/sport/:bizId/membership-types` | סוג מנוי חדש |
| `GET /api/sport/:bizId/trainers` | מאמנים |
| `POST /api/sport/:bizId/trainers` | מאמן חדש |
| `GET /api/sport/:bizId/checkins` | צ'ק-אין |
| `POST /api/sport/:bizId/checkins` | צ'ק-אין חדש |
| `GET /api/sport/:bizId/payments` | תשלומים |
| `GET /api/sport/:bizId/leads` | לידים |
| `POST /api/sport/:bizId/leads` | ליד חדש |
| `GET /api/sport/:bizId/dashboard` | דשבורד |
| `GET /api/sport/:bizId/registrations` | רישומים |
| `POST /api/sport/:bizId/registrations` | רישום חדש |

---

### לוגיסטיקה (`/api/logistics/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/logistics/:bizId/orders` | הזמנות |
| `POST /api/logistics/:bizId/orders` | הזמנה חדשה |
| `PUT /api/logistics/:bizId/orders/:id` | עדכון הזמנה |
| `GET /api/logistics/:bizId/orders/:id` | פרטי הזמנה |
| `GET /api/logistics/:bizId/drivers` | נהגים |
| `POST /api/logistics/:bizId/drivers` | נהג חדש |
| `PUT /api/logistics/:bizId/drivers/:id` | עדכון נהג |
| `GET /api/logistics/:bizId/routes` | מסלולים |
| `POST /api/logistics/:bizId/routes` | מסלול חדש |
| `GET /api/logistics/:bizId/vehicles` | כלי רכב |
| `POST /api/logistics/:bizId/vehicles` | כלי רכב חדש |
| `GET /api/logistics/:bizId/pricing-zones` | אזורי תמחור |
| `POST /api/logistics/:bizId/pricing-zones` | אזור תמחור חדש |
| `GET /api/logistics/:bizId/customers` | לקוחות |
| `POST /api/logistics/:bizId/cod-sessions` | סשן COD |
| `GET /api/logistics/rfq` | RFQ לוגיסטיקה |
| `POST /api/logistics/rfq` | RFQ חדש |

---

### חנות (`/api/store/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/store/:bizId/catalog` | קטלוג |
| `POST /api/store/:bizId/catalog` | פריט חדש |
| `PUT /api/store/:bizId/catalog/:id` | עדכון פריט |
| `DELETE /api/store/:bizId/catalog/:id` | מחיקת פריט |
| `GET /api/store/:bizId/orders` | הזמנות |
| `POST /api/store/:bizId/orders` | הזמנה חדשה |
| `PUT /api/store/:bizId/orders/:id/status` | עדכון סטטוס |
| `GET /api/store/:bizId/customers` | לקוחות |
| `GET /api/store/:bizId/promotions` | מבצעים |
| `POST /api/store/:bizId/promotions` | מבצע חדש |
| `GET /api/store/:bizId/coupons` | קופונים |
| `POST /api/store/:bizId/coupons` | קופון חדש |
| `GET /api/store/:bizId/settings` | הגדרות |
| `PUT /api/store/:bizId/settings` | עדכון הגדרות |
| `GET /api/store/:bizId/popups` | פופאפים |
| `POST /api/store/:bizId/popups` | פופאפ חדש |

---

### Zone Manager (`/api/zm/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/zm/campaigns` | קמפיינים |
| `POST /api/zm/campaigns` | קמפיין חדש |
| `PUT /api/zm/campaigns/:id` | עדכון קמפיין |
| `GET /api/zm/campaigns/:id/leads` | לידים |
| `POST /api/zm/lead-actions` | פעולת ליד |
| `GET /api/zm/inbox/threads` | שרשורי דואר |
| `GET /api/zm/inbox/thread/:id` | שרשור |
| `POST /api/zm/inbox/reply` | תגובה |
| `GET /api/zm/message-templates` | תבניות הודעה |
| `POST /api/zm/message-templates` | תבנית חדשה |
| `GET /api/zm/dashboard` | דשבורד |
| `GET /api/zm/commissions` | עמלות |

---

### מקצועי (`/api/professional/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/professional/:bizId/documents` | מסמכים |
| `POST /api/professional/:bizId/documents` | מסמך חדש |
| `GET /api/professional/:bizId/documents/:id` | פרטי מסמך |
| `PUT /api/professional/:bizId/documents/:id` | עדכון מסמך |
| `GET /api/professional/:bizId/expertise` | מומחיות |
| `POST /api/professional/:bizId/expertise` | מומחיות חדשה |
| `GET /api/professional/:bizId/leads` | לידים |
| `POST /api/professional/:bizId/leads` | ליד חדש |
| `GET /api/professional/:bizId/articles` | מאמרים |
| `POST /api/professional/:bizId/articles` | מאמר חדש |
| `GET /api/professional/content` | תוכן מקצועי |

---

### משחקים ולמידה (`/api/academy/*`, `/api/game/*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/quest-library` | ספריית שאלות |
| `GET /api/quest-library/:id/questions` | שאלות |
| `POST /api/quest-library/share` | שיתוף |
| `POST /api/quest-library/:id/use` | שימוש |
| `POST /api/quest-library/:id/rate` | דירוג |
| `POST /api/academy/ai-generate` | יצירת שאלות AI |
| `POST /api/academy/assign` | שיוך משימה |
| `GET /api/academy/bundles` | חבילות |
| `GET /api/academy/bundles/:id` | חבילה |
| `POST /api/academy/request-challenge` | אתגר |
| `POST /api/academy/submit` | הגשת תשובות |
| `POST /api/academy/tutor` | מורה AI |
| `GET /api/game-sessions/:id` | סשן משחק |
| `POST /api/game-sessions` | סשן חדש |

---

### FlowWallet (`/api/flow*`)

| נתיב | תיאור |
|------|--------|
| `GET /api/flow/wallet/:groupId` | ארנק Flow |
| `POST /api/flow/transfer` | העברת מטבעות |
| `GET /api/flow/transactions/:groupId` | טרנזקציות |
| `POST /api/flow/redeem` | מימוש מטבעות |
| `GET /api/flw/kid-config/:groupId` | הגדרות ילד |
| `POST /api/flw/kid-config` | הגדרות ילד חדשות |
| `GET /api/flw/kid-wallet/:groupId` | ארנק ילד |
| `POST /api/flw/redeem-request` | בקשת מימוש ילד |

---

### כללי

| נתיב | תיאור |
|------|--------|
| `GET /api/activity` | לוג פעילות |
| `GET /api/ads` | מודעות |
| `POST /api/ai/chat` | AI צ'אט |
| `POST /api/ai/generate` | יצירת תוכן |
| `POST /api/ai/generate-image` | יצירת תמונה |
| `POST /api/ai/parse-pdf` | פרסור PDF |
| `GET /api/alerts/rules` | חוקי התראה |
| `POST /api/alerts/rules` | חוק חדש |
| `PUT /api/alerts/rules/:id` | עדכון חוק |
| `GET /api/alerts/notifications` | התראות |
| `GET /api/alerts/unread-count` | לא-נקרא |
| `GET /api/banners` | באנרים |
| `GET /api/biz-visibility/:type` | נראות לפי סוג |
| `GET /api/budget/filter` | פילטר תקציב |
| `PUT /api/budget/update` | עדכון תקציב |
| `GET /api/calendar/:groupId` | יומן |
| `POST /api/calendar/events` | אירוע חדש |
| `PUT /api/calendar/events/:id` | עדכון אירוע |
| `DELETE /api/calendar/events/:id` | מחיקת אירוע |
| `GET /api/calendar/services` | שירותי יומן |
| `POST /api/chat` | הודעת צ'אט |
| `GET /api/chat/:groupId` | היסטוריית צ'אט |
| `GET /api/data/:userId` | נתוני משתמש |
| `POST /api/pilot-waitlist` | הצטרפות לרשימת המתנה |
| `POST /api/support/ticket` | כרטיס תמיכה |
| `POST /api/support/tickets/:id/reply` | תגובה לכרטיס |
| `GET /api/support/tickets/my/:groupId` | הכרטיסים שלי |
| `GET /api/surveys` | סקרים |
| `POST /api/surveys` | סקר חדש |
| `GET /api/surveys/:id` | פרטי סקר |

---

## סטטיסטיקה

| קטגוריה | כמות |
|---------|------|
| נתיבי SA/Superadmin | ~120 |
| קהילה | ~85 |
| עסקים כלליים | ~60 |
| יופי | ~55 |
| ספורט | ~45 |
| לוגיסטיקה | ~40 |
| חנות | ~35 |
| Zone Manager | ~30 |
| מקצועי | ~25 |
| משחקים/אקדמיה | ~20 |
| FlowWallet | ~20 |
| כלליים | ~180 |
| **סה"כ** | **~715** |

> ℹ️ חלק מהנתיבים מוגדרים ב-`business-app.js` ואינם נספרים כאן. לנתיבים המלאים לחץ "עדכן" לרגנרציה מלאה.
