# מודולים מתקדמים — Family Flow

> מודולים בעלי לוגיקה מובנית ב-server.js שאינם מתועדים בספרות הקיימת

---

## 1. Work Orders — הזמנות עבודה

**טבלאות DB:** `work_orders`, `work_order_assignees`, `work_order_inventory`, `work_order_messages`, `work_order_notes_history`, `work_order_payments`, `work_order_timeline`

### תיאור
מודול ניהול הזמנות עבודה לעסקים (אחזקה, שירות, ציוד). כולל מחזור חיים מלא מפתיחה עד סגירה.

### שדות עיקריים
- **סטטוסים:** `open → assigned → in_progress → completed → closed`
- **שיוך:** מספר נציגים לעבודה, כל אחד עם תפקיד ושעות
- **מלאי:** חלקים/ציוד שנוצרו לטובת העבודה
- **לוח זמנים:** timeline מבוסס-event לכל שינוי סטטוס
- **תשלומים:** פיצול — חלק מהלקוח, חלק מוחזר

### API
```
GET    /api/work-orders/:bizId
POST   /api/work-orders/:bizId
GET    /api/work-orders/:bizId/:id
PUT    /api/work-orders/:bizId/:id
POST   /api/work-orders/:bizId/:id/assign
POST   /api/work-orders/:bizId/:id/timeline
POST   /api/work-orders/:bizId/:id/message
GET    /api/work-orders/:bizId/:id/messages
POST   /api/work-orders/:bizId/:id/payment
```

---

## 2. FLW (FlowWallet לילדים)

**טבלאות DB:** `flw_kid_wallets`, `flw_kid_config`, `flw_kid_redeem_requests`

### תיאור
מטבעות דיגיטליים לילדים בתוך משפחה. הורים מגדירים מכסות ומאשרים מימוש.

### לוגיקה מרכזית
- **הגדרת ילד:** הורה מגדיר לכל ילד מגבלת `weekly_limit` ו-`daily_limit`
- **הרוויחה:** ילד מרוויח מטבעות על השלמת משימות/מחאלנג'ים
- **מימוש:** ילד שולח `redeem_request`, הורה מאשר/דוחה
- **היסטוריה:** כל טרנזקציה נרשמת עם סיבה ומאשר

### API
```
GET  /api/flw/kid-config/:groupId
POST /api/flw/kid-config
PUT  /api/flw/kid-config/:kidId
GET  /api/flw/kid-wallet/:groupId
POST /api/flw/redeem-request
PUT  /api/flw/redeem-request/:id/approve
PUT  /api/flw/redeem-request/:id/reject
GET  /api/flw/transactions/:kidId
```

---

## 3. Professional — שירותים מקצועיים

**טבלאות DB:** `professional_documents`, `professional_document_versions`, `professional_doc_types`, `professional_expertise`, `professional_leads`, `professional_content`, `professional_articles`

### תיאור
מודול לעסקים מקצועיים (עורכי דין, רואי חשבון, יועצים). ניהול מסמכים עם גרסאות, לידים, ותוכן מקצועי.

### יכולות עיקריות
- **מסמכים:** עם versioning מלא, status workflow, חתימה דיגיטלית
- **מומחיות:** תיוג תחומי מומחיות לעסק לחיפוש קהילתי
- **לידים:** ניהול לידים נכנסים מקהילה
- **תוכן:** מאמרים ותוכן מקצועי לפרסום

### API
```
GET    /api/professional/:bizId/documents
POST   /api/professional/:bizId/documents
GET    /api/professional/:bizId/documents/:id
PUT    /api/professional/:bizId/documents/:id
POST   /api/professional/:bizId/documents/:id/version
GET    /api/professional/:bizId/expertise
POST   /api/professional/:bizId/expertise
DELETE /api/professional/:bizId/expertise/:id
GET    /api/professional/:bizId/leads
POST   /api/professional/:bizId/leads
GET    /api/professional/:bizId/articles
POST   /api/professional/:bizId/articles
GET    /api/professional/content
```

---

## 4. Logistics — לוגיסטיקה ומשלוחים

**טבלאות DB:** `logistics_orders`, `logistics_drivers`, `logistics_routes`, `logistics_route_stops`, `logistics_vehicles`, `logistics_pricing_zones`, `logistics_rate_cards`, `logistics_customers`, `logistics_invoices`, `logistics_order_events`, `logistics_cod_sessions`, `logistics_rfq`

### תיאור
מודול שינוע ומשלוחים לעסקי לוגיסטיקה. כולל ניתוב, נהגים, תמחור אזורי, וניהול COD.

### לוגיקה מרכזית
- **הזמנות:** מחזור חיים מלא עם event-log לכל שינוי
- **ניתוב אוטומטי:** משבצת עצירות לנהגים לפי אזור
- **COD:** סשן גבייה במזומן עם reconciliation
- **תמחור:** rate-cards לפי אזור ומשקל/נפח
- **RFQ:** לקוחות מגישים בקשות, עסק מגיב עם הצעה

### API
```
GET    /api/logistics/:bizId/orders
POST   /api/logistics/:bizId/orders
PUT    /api/logistics/:bizId/orders/:id
GET    /api/logistics/:bizId/orders/:id
GET    /api/logistics/:bizId/drivers
POST   /api/logistics/:bizId/drivers
GET    /api/logistics/:bizId/routes
POST   /api/logistics/:bizId/routes
GET    /api/logistics/:bizId/vehicles
POST   /api/logistics/:bizId/vehicles
GET    /api/logistics/:bizId/pricing-zones
POST   /api/logistics/:bizId/pricing-zones
POST   /api/logistics/:bizId/cod-sessions
GET    /api/logistics/rfq
POST   /api/logistics/rfq
PUT    /api/logistics/rfq/:id/respond
```

---

## 5. Restaurant Tables — ניהול שולחנות מסעדה

**טבלאות DB:** `restaurant_table_states`, `restaurant_table_assignments`, `restaurant_table_bills`, `temp_table_reservations`

### תיאור
מודול ניהול שולחנות למסעדות. מצב שולחן בזמן אמת, הזמנות מקדימות, חיוב מפוצל.

### לוגיקה מרכזית
- **מצב שולחן:** `free | seated | ordered | billed | cleaning`
- **שיוך:** כל שולחן מוקצה לסרבר
- **חשבון:** פיצול חשבון בין מספר לקוחות
- **הזמנה מראש:** temp_reservation עם TTL

### API
```
GET  /api/tables/:bizId
POST /api/tables/:bizId/:tableId/seat
POST /api/tables/:bizId/:tableId/order
POST /api/tables/:bizId/:tableId/bill
POST /api/tables/:bizId/:tableId/split-bill
POST /api/tables/:bizId/:tableId/clear
GET  /api/tables/:bizId/reservations
POST /api/tables/:bizId/reservations
```

---

## 6. Kiosk — קיוסק עצמאי

**טבלאות DB:** `store_orders`, `store_catalog` (shared)

### תיאור
ממשק קיוסק מגע לעסקים — לקוח מזמין עצמאית בלי נציג. מחובר לחנות הקיימת.

### לוגיקה מרכזית
- **מצב:** טעינת קטלוג בפרמטר `kiosk=true`
- **הזמנה:** יצירת `store_order` עם `source='kiosk'`
- **תשלום:** אינטגרציה עם מסוף תשלום חיצוני
- **קבלה:** הדפסה/SMS אישור

### API
```
GET  /api/kiosk/:bizId/catalog
POST /api/kiosk/:bizId/order
GET  /api/kiosk/:bizId/order/:id/status
POST /api/kiosk/:bizId/payment-confirm
```

---

## 7. Alerts — מערכת התראות

**טבלאות DB:** `alert_rules`, `alert_notifications`

### תיאור
מנוע התראות חכם — עסק מגדיר חוקים, המערכת יוצרת התראות אוטומטיות.

### לוגיקה מרכזית
- **חוקים:** condition (threshold, schedule, event) + action (notification, email, SMS)
- **טריגרים:** מלאי נמוך, תור ממתין, תשלום באיחור, חריגת תקציב
- **נמענים:** user_id רשימה, תפקיד, או broadcast לקבוצה
- **היסטוריה:** כל התראה נרשמת עם read_at

### API
```
GET    /api/alerts/rules
POST   /api/alerts/rules
PUT    /api/alerts/rules/:id
DELETE /api/alerts/rules/:id
GET    /api/alerts/notifications
POST   /api/alerts/notifications/:id/read
POST   /api/alerts/notifications/read-all
GET    /api/alerts/unread-count
```

---

## 8. B2B — מסחר בין עסקים

**טבלאות DB:** `global_products`, `supplier_products`, `supplier_product_catalog_links`, `purchase_orders`, `suppliers`

### תיאור
רשת קישור בין עסקי-ספק לעסקי-לקוח בתוך הפלטפורמה. ספק מעלה קטלוג, לקוח מזמין.

### לוגיקה מרכזית
- **קטלוג גלובלי:** `global_products` — מוצרים קנוניים
- **קטלוג ספק:** `supplier_products` — גרסת הספק עם מחיר/מלאי
- **קישור:** `supplier_product_catalog_links` — איזה עסק קשור לאיזה ספק
- **הזמנה:** `purchase_orders` עם status workflow

### API
```
GET  /api/b2b/catalog/:groupId
GET  /api/b2b/orders/:groupId
POST /api/b2b/orders
PUT  /api/b2b/orders/:id/status
POST /api/b2b/orders/receive
GET  /api/b2b/orders/:id
```

---

## 9. FlowPool — רכישה קולקטיבית

**טבלאות DB:** `flow_pools`, `flow_pool_members`, `flow_pool_bids`, `flow_pool_messages`, `biz_pool_hidden`

### תיאור
מנגנון Pool — קבוצת מגדירים צורך, עסקים מציעים הצעות, Pool בוחר הצעה ומשלם יחד.

### מחזור חיים Pool
```
open → bidding → round2 (אופציונלי) → selected → completed | archived
```

### שחקנים
- **Pool Creator:** פותח Pool, מגדיר צורך, קובע מועד סגירה
- **Members:** מצטרפים, תורמים לסכום
- **Bidders (עסקים):** מציעים הצעה עם מחיר וזמן
- **Pool Admin:** בוחר הצעה מנצחת

### API
```
GET    /api/community/pool
POST   /api/community/pool
GET    /api/community/pool/:id
PUT    /api/community/pool/:id/edit
POST   /api/community/pool/:id/join
POST   /api/community/pool/:id/bid
GET    /api/community/pool/:id/bids
POST   /api/community/pool/:id/select-bid
POST   /api/community/pool/:id/message
GET    /api/community/pool/:id/messages
POST   /api/community/pool/:id/open-round2
POST   /api/community/pool/:id/archive
POST   /api/community/pool/:id/renew
POST   /api/community/pool/:id/restore
GET    /api/community/pool/community/:communityId
GET    /api/community/pool/family-archive/:groupId
GET    /api/biz/pools/:bizGroupId
GET    /api/biz/my-pool-bids/:bizGroupId
```

---

## 10. Community Wallet — ארנק קהילה

**טבלאות DB:** `community_wallets`, `community_wallet_transactions`

### תיאור
ארנק כספי שייך לקהילה (לא למשפחה בודדת). משמש לקרן קהילתית, פרסים, מימון פעילויות.

### לוגיקה מרכזית
- **יצירה:** קהילה פותחת ארנק עם יעד צבירה
- **הפקדות:** משפחות תורמות, עסקים תורמים (cash-back)
- **משיכות:** מנהל קהילה מאשר הוצאות
- **דיווח:** כל טרנזקציה עם סיבה ואישור

### API
```
GET  /api/community/wallet/:communityId
POST /api/community/wallet/deposit
POST /api/community/wallet/withdraw
GET  /api/community/wallet/transactions/:communityId
GET  /api/community/cashback-info/:groupId
```

---

## סיכום כיסוי

| מודול | טבלאות DB | נתיבי API | תועד בעבר |
|-------|-----------|-----------|-----------|
| Work Orders | 7 | ~9 | ❌ |
| FLW (ילדים) | 3 | ~8 | ❌ |
| Professional | 7 | ~11 | ❌ |
| Logistics | 12 | ~14 | ❌ |
| Restaurant Tables | 4 | ~8 | ❌ |
| Kiosk | shared | ~4 | ❌ |
| Alerts | 2 | ~8 | ❌ |
| B2B | 5 | ~6 | ❌ |
| FlowPool | 5 | ~14 | חלקי |
| Community Wallet | 2 | ~5 | ❌ |
| **סה"כ** | **47** | **~87** | |
