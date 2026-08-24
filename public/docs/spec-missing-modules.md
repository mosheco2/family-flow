# מודולים לא מתועדים — Family-Flow
> תאריך מקורי: 2026-07-22 | עדכון: 24.08.2026 | מבוסס על סריקת server.js (קוד אמיתי בלבד)

---

## תוכן עניינים

1. [Work Orders — הזמנות עבודה](#1-work-orders)
2. [FLW Kid Wallet — ארנק ילדים](#2-flw-kid-wallet)
3. [Professional Platform](#3-professional-platform)
4. [Logistics — לוגיסטיקה](#4-logistics)
5. [Restaurant Tables — שולחנות מסעדה](#5-restaurant-tables)
6. [Store Quotes & Kiosk — הצעות מחיר וקיוסק](#6-store-quotes--kiosk)
7. [Alert Rules — חוקי התראות](#7-alert-rules)
8. [B2B, FlowPool & Banner Ads](#8-b2b-flowpool--banner-ads)
9. [Community Wallet & Cashback](#9-community-wallet--cashback)
10. [Public Storefront — חנות ציבורית](#10-public-storefront)
11. [Live Game Host *(חדש 24.08.2026)*](#11-live-game-host)
12. [Community Social Feed *(חדש 24.08.2026)*](#12-community-social-feed)
13. [Family-Business Link & Service Areas *(חדש 24.08.2026)*](#13-family-business-link--service-areas)

---

## 1. Work Orders

### 1.1 מהו המודול

מודול ניהול הזמנות עבודה (Work Orders) מאפשר לעסקים לנהל פרויקטים ועבודות שטח. Work Order **אינו** טבלה נפרדת — הוא שורה ב-`store_orders` עם `call_type='work_order'`. הוא מורחב על ידי 6 טבלאות לוואי.

Flow עסקי: הצעת מחיר (quote) → המרה ל-Work Order → שיוך עובדים → הזמנת מלאי → תשלומים על פי אבני דרך → סגירה.

### 1.2 DB Schema

| טבלה | עמוד ב-server.js | תיאור | שדות מפתח |
|------|-----------------|-------|------------|
| `store_orders` (WO rows) | ~930 | הרשומה הבסיסית של ה-WO | `id`, `group_id`, `call_type='work_order'`, `status`, `quote_title`, `quote_history JSONB`, `wo_notes`, `payment_status`, `customer_rating` |
| `work_order_assignees` | ~967 | עובדים משויכים ל-WO | `work_order_id`, `user_id`, `user_name`, `hourly_rate`, `hours_worked`, `assigned_by` |
| `work_order_inventory` | ~976 | פריטי מלאי שמורים/בשימוש | `work_order_id`, `catalog_id`, `pantry_id`, `item_name`, `reserved_qty`, `used_qty`, `needed_qty`, `unit_price`, `status` |
| `work_order_payments` | ~1037 | תשלומים לפי אבני דרך | `work_order_id`, `service_call_id`, `milestone_name`, `amount`, `due_date`, `payment_method`, `status`, `received_amount`, `received_at`, `total_amount` |
| `work_order_messages` | ~1010 | צ'אט פנימי של ה-WO | `work_order_id`, `user_id`, `user_name`, `message_text`, `created_at` |
| `work_order_timeline` | ~1018 | לוג אירועים | `work_order_id`, `event_type`, `description`, `user_name`, `metadata JSONB` |
| `work_order_notes_history` | ~1027 | היסטוריית הערות | `work_order_id`, `note_text`, `created_by` |
| `supplier_product_catalog_links` | ~998 | קישור ספק-מלאי | `supplier_product_id`, `catalog_id`, `qty_per_unit` |

שדות נוספים שנוספו ל-`store_orders` עבור WO: `order_source`, `call_type`, `status_changed_at`, `customer_response`, `customer_response_type`, `customer_response_at`.

שדות נוספים ל-`calendar_events` עבור WO: `work_order_id FK`, `address`, `attendees_user_ids JSONB`, `customer_name`, `customer_group_id`, `preferred_practitioner_id`, `num_guests`, `call_type`, `reserved_table_number`.

### 1.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/work-orders/:businessGroupId` | רשימת WO לעסק (legacy) |
| GET | `/api/work-orders/list/:groupId` | רשימה מלאה עם פילטרים |
| POST | `/api/work-orders/new/:groupId` | יצירת WO חדש |
| GET | `/api/work-orders/detail/:id` | פרטי WO כולל assignees, inventory, payments |
| PUT | `/api/work-orders/:id/status` | עדכון סטטוס + timeline event |
| POST | `/api/work-orders/convert/:quoteId` | המרת הצעת מחיר ל-WO |
| GET | `/api/work-orders/profitability/:groupId` | דוח רווחיות כולל עלות עובדים + חומרים |
| GET | `/api/work-orders/users/:groupId` | משתמשים זמינים לשיוך |
| POST | `/api/work-orders/:id/assignees` | שיוך עובד ל-WO |
| DELETE | `/api/work-orders/:id/assignees/:userId` | הסרת עובד |
| PUT | `/api/work-orders/:woId/assignees/:userId/cost` | עדכון שעות/תעריף עובד |
| GET | `/api/work-orders/catalog/:groupId` | מלאי זמין להזמנה |
| GET | `/api/store/catalog/:itemId/wo-reservations` | הזמנות WO לפריט מלאי |
| GET | `/api/pantry/:itemId/wo-reservations` | הזמנות WO לפריט מחסן |
| POST | `/api/work-orders/:id/inventory` | שמירת מלאי ל-WO |
| POST | `/api/work-orders/:id/inventory/:resId/use` | סימון שימוש בפריט |
| DELETE | `/api/work-orders/:id/inventory/:resId` | ביטול הזמנת מלאי |
| GET | `/api/work-orders/:id/messages` | הודעות WO |
| POST | `/api/work-orders/:id/messages` | שליחת הודעה |
| PUT | `/api/work-orders/:id/notes` | עדכון הערות (שומר היסטוריה) |
| GET | `/api/work-orders/:id/timeline` | לוג אירועים |
| POST | `/api/work-orders/:id/calendar` | יצירת אירוע יומן מ-WO |
| GET | `/api/work-orders/:id/purchase-orders` | הזמנות רכש משויכות |
| POST | `/api/work-orders/:id/purchase-orders` | יצירת הזמנת רכש מ-WO |
| PATCH | `/api/work-orders/:id/purchase-orders/:poId/status` | עדכון סטטוס הזמנת רכש |
| GET | `/api/work-orders/purchase-orders/group/:groupId` | כל הזמנות הרכש לעסק |
| GET | `/api/work-orders/:id/payments` | תשלומים ל-WO |
| POST | `/api/work-orders/:id/payments` | הוספת אבן דרך לתשלום |
| PATCH | `/api/work-orders/payments/:paymentId/receive` | רישום קבלת תשלום |
| DELETE | `/api/work-orders/payments/:paymentId` | מחיקת תשלום |

### 1.4 לוגיקה עסקית

- **המרת quote ל-WO**: `POST /api/store/quotes/:id/to-work-order` — מעתיק את תוכן ההצעה, שומר את `quote_history JSONB`, משנה `call_type='work_order'`.
- **ניהול מלאי**: בעת שמירת inventory, המערכת מעדכנת `reserved_qty` ב-`store_catalog` ו-`pantry` כך שלא ניתן לשמור את אותו פריט פעמיים.
- **חישוב רווחיות**: `/profitability` מחשב: `(total payments received) - (inventory cost) - (labor cost)`.
- **חיבור ליומן**: ניתן ליצור אירוע יומן עם `work_order_id FK` ישירות מה-WO.
- **Statuses**: `new → in_progress → pending_payment → completed / cancelled`.

---

## 2. FLW Kid Wallet

### 2.1 מהו המודול

מטבע דיגיטלי ייעודי לילדים (FLW — Flow). הורים מגדירים ערך FLW ב-ILS, מגבלות יומיות, ומשימות. ילדים צוברים FLW ממשחקים, quest completions, ומשימות שהורים מאשרים. ניתן לממש FLW לפרסים/כסף אמיתי בכפוף לאישור הורה.

### 2.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `flw_kid_wallets` | ארנק הילד | `child_user_id`, `family_group_id`, `balance_flw`, `lifetime_flw`, `redeemed_flw` |
| `flw_kid_config` | הגדרות הורה לכל ילד | `family_group_id`, `child_user_id`, `flw_value_ils`, `max_daily_flw`, `auto_approve` |
| `flw_kid_redeem_requests` | בקשות מימוש | `child_user_id`, `family_group_id`, `flw_amount`, `status`, `approved_at` |
| `game_sessions` | היסטוריית משחק | `child_user_id`, `game_id`, `score`, `flw_earned`, `duration_seconds`, `played_at` |
| `kid_free_play_log` | מניעת כפל יומי | `child_user_id`, `game_id`, `played_date` UNIQUE |
| `game_assignments` | משימות משחק מהורה | `family_group_id`, `child_user_id`, `game_id`, `rounds_total`, `rounds_used`, `flw_per_round`, `expires_at` |
| `kid_quests` | מטלות ידע | `child_user_id`, `title`, `subject`, `flw_reward`, `pass_score`, `status`, `due_date` |
| `kid_quest_questions` | שאלות בחינה | `quest_id`, `question_text`, `answer_type`, `correct_answer`, `options_json JSONB` |
| `kid_quest_results` | תוצאות | `quest_id`, `child_user_id`, `score` |
| `games_catalog` | קטלוג משחקים | `id`, `name`, `game_type`, `is_active` |

### 2.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/kids/parent-overview/:groupId` | סקירת כל ילדי המשפחה — יתרות + פעילות |
| GET | `/api/kids/wallet/:userId` | יתרת ארנק ילד |
| POST | `/api/kids/award-flw` | הענקת FLW ידנית על ידי הורה |
| GET | `/api/kids/config/:childId` | קריאת הגדרות הורה |
| POST | `/api/kids/config` | שמירת הגדרות (value_ils, max_daily, auto_approve) |
| GET | `/api/kids/games` | רשימת משחקים זמינים |
| GET | `/api/kids/free-play-check` | האם הילד שיחק היום? |
| POST | `/api/kids/redeem` | מימוש FLW מיידי (אם auto_approve) |
| POST | `/api/kids/redeem-request` | בקשת מימוש לאישור הורה |
| GET | `/api/kids/redeem-requests` | רשימת בקשות ממתינות לאישור |
| POST | `/api/kids/assign-game` | שיוך משחק לילד עם FLW |
| GET | `/api/kids/assignments/:childId` | רשימת assignment פעילים |
| POST | `/api/kids/use-round` | שימוש ב-round אחד (מ-assignment) |
| POST | `/api/kids/renew-assignment/:id` | חידוש assignment שנגמר |
| POST | `/api/kids/quests` | יצירת quest חדש |
| GET | `/api/kids/quests/:childId` | quests פעילים לילד |
| GET | `/api/kids/quests/:questId/questions` | שאלות ה-quest |
| POST | `/api/kids/quests/:questId/submit` | שליחת תשובות + חישוב ציון |
| GET | `/api/kids/parent-quests/:parentId` | כל ה-quests שיצר הורה |
| POST | `/api/kids/profile-image/:userId` | העלאת תמונת פרופיל ילד |

### 2.4 לוגיקה עסקית

- **ערך FLW**: `flw_kid_config.flw_value_ils` (ברירת מחדל 0.10 ILS לכל FLW).
- **מגבלה יומית**: המערכת בודקת `SUM(flw_earned)` ב-`game_sessions` ליום היום לפני כל הענקה.
- **Free play**: כל ילד יכול לשחק כל משחק פעם ביום בחינם (ללא FLW). `kid_free_play_log` שומר UNIQUE(child, game, date).
- **Game assignments**: הורה מגדיר rounds_total ו-flw_per_round. כל שימוש ב-round מפחית `rounds_used` ומוסיף FLW. כשמגיע לגבול — assignment סגור עד חידוש.
- **Quest scoring**: ציון `>= pass_score` → FLW מועבר לארנק, `quest.status='completed'`. ציון נמוך → `failed`, ניתן לנסות שוב.

---

## 3. Professional Platform

### 3.1 מהו המודול

מודול עבור עסקים מסוג "professional" (עורכי דין, רואי חשבון, יועצים). מאפשר ניהול: תוכן אתר ציבורי, מסמכים משפטיים עם חתימה דיגיטלית, לוגים שעות עבודה, מאמרים ידע, ו-CRM לידים.

### 3.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `time_logs` | לוג שעות עבודה | `group_id`, `user_id`, `customer_name`, `wo_id FK`, `description`, `minutes`, `hourly_rate`, `logged_date`, `is_billed` |
| `professional_content` | תוכן אתר ציבורי | `group_id UNIQUE`, `hero_title_he/en`, `hero_subtitle_he/en`, `cta_text_he/en`, `about_text_he/en` |
| `professional_expertise` | תחומי התמחות | `group_id`, `icon`, `title_he/en`, `description_he/en`, `sort_order`, `is_active` |
| `professional_articles` | מאמרים/בלוג | `group_id`, `title_he/en`, `content_he/en`, `tags`, `is_published` |
| `professional_leads` | לידים נכנסים | `group_id`, `name`, `phone`, `email`, `subject`, `message`, `status` |
| `professional_documents` | מסמכים משפטיים | `group_id`, `customer_name`, `customer_phone`, `customer_email`, `customer_last_name`, `customer_id_number`, `customer_address`, `title`, `content`, `doc_type`, `status`, `is_template`, `signature_data`, `work_order_id FK` |
| `professional_document_versions` | גרסאות מסמך | `document_id`, `title`, `content`, `doc_type`, `status`, `changed_at` |
| `professional_doc_types` | סוגי מסמך מותאמים | `group_id`, `name`, `icon` |

### 3.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/professional-content/:groupId` | קריאת תוכן אתר |
| POST | `/api/professional-content/:groupId` | שמירת תוכן אתר (upsert) |
| GET | `/api/professional-expertise/:groupId` | רשימת התמחויות |
| POST | `/api/professional-expertise/:groupId` | הוספת התמחות |
| PATCH | `/api/professional-expertise/:id` | עדכון התמחות |
| DELETE | `/api/professional-expertise/:id` | מחיקת התמחות |
| GET | `/api/professional-articles/:groupId` | מאמרים (עם פילטר is_published) |
| POST | `/api/professional-articles/:groupId` | יצירת מאמר |
| PATCH | `/api/professional-articles/:id` | עדכון/פרסום מאמר |
| DELETE | `/api/professional-articles/:id` | מחיקת מאמר |
| GET | `/api/professional-leads/:groupId` | רשימת לידים |
| POST | `/api/professional-leads/:groupId` | יצירת ליד (מטופס ציבורי) |
| PATCH | `/api/professional-leads/:id` | עדכון סטטוס ליד |
| GET | `/api/professional-documents/:groupId` | מסמכים לקבוצה |
| POST | `/api/professional-documents/:groupId` | יצירת מסמך/תבנית |
| PATCH | `/api/professional-documents/:id` | עדכון מסמך (שומר גרסה קודמת) |
| GET | `/api/professional-documents/:id/versions` | גרסאות היסטוריות |
| POST | `/api/professional-documents/:id/send-email` | שליחת מסמך ל-email |
| DELETE | `/api/professional-documents/:id` | מחיקת מסמך |

### 3.4 לוגיקה עסקית

- **חתימה דיגיטלית**: שדה `signature_data TEXT` שומר SVG/base64 של חתימת לקוח.
- **גרסאות**: כל `PATCH` על מסמך מוסיף שורה ל-`professional_document_versions` לפני השינוי.
- **תבניות**: מסמכים עם `is_template=true` ניתנים לשכפול.
- **קישור ל-WO**: מסמכים יכולים להיות קשורים ל-work order דרך `work_order_id FK`.
- **אתר ציבורי**: תוכן `professional_content` מוגש דרך `/api/storefront/:code` לצד המידע הציבורי.

---

## 4. Logistics

### 4.1 מהו המודול

מודול לוגיסטיקה מלאה לעסקי משלוחים/שליחויות. כולל: ניהול הזמנות משלוח, נהגים, כלי רכב, תמחור, מסלולים, POD (Proof of Delivery), COD (Cash on Delivery), ו-Public Tracking.

### 4.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `logistics_orders` | הזמנות משלוח | `group_id`, `order_number`, `customer_name`, `pickup_address`, `delivery_address`, `driver_id`, `vehicle_id`, `status`, `cod_amount`, `pod_signature`, `tracking_token` |
| `logistics_drivers` | נהגים | `group_id`, `name`, `phone`, `vehicle_id`, `status`, `lat`, `lng` |
| `logistics_vehicles` | כלי רכב | `group_id`, `plate`, `type`, `max_weight_kg` |
| `logistics_pricing` | תמחור אזורי | `group_id`, `zone_name`, `price` |
| `logistics_rfq` | בקשות הצעת מחיר | `group_id`, `customer_name`, `description`, `status` |
| `logistics_routes` | מסלולי חלוקה | `group_id`, `route_name`, `status`, `driver_id` |
| `logistics_route_stops` | עצירות במסלול | `route_id`, `order_id`, `stop_order`, `status` |
| `logistics_rate_cards` | כרטיסי תעריף | `group_id`, `name`, `base_fee`, `per_km_fee` |
| `logistics_customers` | לקוחות לוגיסטיקה | `group_id`, `name`, `phone`, `address` |
| `logistics_order_events` | אירועי משלוח | `order_id`, `event_type`, `description`, `created_at` |

### 4.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/logistics/dashboard/:groupId` | KPIs: סה"כ הזמנות, בדרך, הושלמו, COD פתוח |
| GET | `/api/logistics/orders/:groupId` | רשימת הזמנות עם פילטרים |
| POST | `/api/logistics/orders` | יצירת הזמנת משלוח |
| PATCH | `/api/logistics/orders/:id/status` | עדכון סטטוס |
| PATCH | `/api/logistics/orders/:id/assign` | שיוך נהג |
| PATCH | `/api/logistics/orders/:id/pod` | Proof of Delivery (חתימה/תמונה) |
| PATCH | `/api/logistics/orders/:id/cod` | עדכון COD שנגבה |
| PATCH | `/api/logistics/orders/:id` | עדכון כללי |
| DELETE | `/api/logistics/orders/:id` | מחיקת הזמנה |
| GET | `/api/logistics/drivers/:groupId` | רשימת נהגים |
| POST | `/api/logistics/drivers` | הוספת נהג |
| PATCH | `/api/logistics/drivers/:id` | עדכון נהג |
| PATCH | `/api/logistics/drivers/:id/location` | עדכון מיקום נהג (GPS) |
| DELETE | `/api/logistics/drivers/:id` | מחיקת נהג |
| GET | `/api/logistics/vehicles/:groupId` | רשימת כלי רכב |
| POST | `/api/logistics/vehicles` | הוספת רכב |
| PATCH | `/api/logistics/vehicles/:id` | עדכון רכב |
| DELETE | `/api/logistics/vehicles/:id` | מחיקת רכב |
| GET | `/api/logistics/pricing/:groupId` | תמחור אזורי |
| POST | `/api/logistics/pricing` | הוספת תמחור |
| PATCH | `/api/logistics/pricing/:id` | עדכון תמחור |
| DELETE | `/api/logistics/pricing/:id` | מחיקת תמחור |
| GET | `/api/logistics/cod/:groupId` | סיכום COD פתוח לנהגים |
| POST | `/api/logistics/cod/close` | סגירת COD (נהג מסר כסף) |
| GET | `/api/logistics/rfq/:groupId` | בקשות הצעות מחיר |
| POST | `/api/logistics/rfq` | יצירת RFQ |
| PATCH | `/api/logistics/rfq/:id/message` | הוספת הודעה ל-RFQ |
| PATCH | `/api/logistics/rfq/:id/quote` | שליחת הצעת מחיר |
| PATCH | `/api/logistics/rfq/:id/status` | עדכון סטטוס RFQ |
| GET | `/api/logistics/reports/:groupId` | דוחות: סה"כ, לפי נהג, COD |
| POST | `/api/logistics/orders/:id/tracking-token` | יצירת token מעקב |
| GET | `/api/logistics/track/:token` | מעקב ציבורי (ללא auth) |
| POST | `/api/logistics/track/:token/leave-at-door` | לקוח בוחר "השאר בדלת" |
| POST | `/api/logistics/orders/:id/failed-attempt` | רישום ניסיון כשל |
| GET | `/api/logistics/orders/:id/events` | לוג אירועי הזמנה |
| GET | `/api/logistics/routes/:groupId` | מסלולים |
| GET | `/api/logistics/routes/:groupId/:routeId/stops` | עצירות במסלול |
| POST | `/api/logistics/routes` | יצירת מסלול |
| POST | `/api/logistics/routes/:routeId/stops` | הוספת עצירה |
| PATCH | `/api/logistics/routes/:id/status` | עדכון סטטוס מסלול |
| DELETE | `/api/logistics/routes/:id` | מחיקת מסלול |
| GET | `/api/logistics/rate-cards/:groupId` | כרטיסי תעריף |
| POST | `/api/logistics/rate-cards` | יצירת כרטיס תעריף |
| PATCH | `/api/logistics/rate-cards/:id` | עדכון |
| DELETE | `/api/logistics/rate-cards/:id` | מחיקה |
| GET | `/api/logistics/customers/:groupId` | לקוחות לוגיסטיקה |
| POST | `/api/logistics/customers` | הוספת לקוח |
| GET | `/api/logistics/driver-orders/:groupId/:driverId` | הזמנות ספציפיות לנהג |

### 4.4 לוגיקה עסקית

- **Public Tracking**: `GET /api/logistics/track/:token` — endpoint ציבורי ללא auth. מחזיר מיקום נהג + סטטוס הזמנה.
- **COD Flow**: נהג גובה מזומן בעת מסירה, מעדכן `cod_amount` ב-PATCH. בסוף משמרת, `/cod/close` מסמן שהנהג מסר לבית.
- **POD**: Proof of Delivery — חתימת לקוח בbase64 נשמרת ב-`pod_signature`. מאפשר הוכחה משפטית.
- **GPS Tracking**: נהגים מעדכנים `lat/lng` ב-`logistics_drivers` דרך `/drivers/:id/location`. הלקוח רואה מעקב בזמן אמת.

---

## 5. Restaurant Tables

### 5.1 מהו המודול

מודול לניהול שולחנות מסעדה: סטטוסי שולחנות (פנוי/תפוס/ממתין), הקצאת מלצרים, חשבוניות לפי שולחן, והזמנות מקום ציבוריות עם אימות SMS.

### 5.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `restaurant_table_states` | סטטוסי שולחנות | `group_id PK`, `states JSONB` (מפת `{tableNum: status}`) |
| `restaurant_table_bills` | חשבוניות לפי שולחן | `group_id PK`, `bills JSONB` (מפת `{tableNum: {items, total}}`) |
| `restaurant_table_assignments` | הקצאת מלצרים | `group_id PK`, `assignments JSONB`, `shift_date DATE` |
| `temp_table_reservations` | הזמנות ציבוריות | `group_id`, `customer_name`, `customer_phone`, `reservation_date`, `reservation_time`, `num_guests`, `sms_code`, `verified_at`, `status`, `expires_at` |

> שימו לב: 3 מהטבלאות משתמשות ב-`group_id` כ-PRIMARY KEY — כלומר כל עסק שומר את כל הנתונים ב-JSONB יחיד. זה מיועד לגישה מהירה בזמן אמת.

### 5.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/tables/:groupId/states` | קריאת סטטוסי שולחנות |
| PUT | `/api/tables/:groupId/states` | עדכון סטטוסי שולחנות |
| GET | `/api/tables/:groupId/assignments` | קריאת הקצאת מלצרים |
| PUT | `/api/tables/:groupId/assignments` | עדכון הקצאות |
| GET | `/api/tables/:groupId/bills` | קריאת חשבוניות פתוחות |
| PUT | `/api/tables/:groupId/bills` | עדכון חשבוניות |
| GET | `/api/tables/:groupId/reservations-today` | הזמנות מקום להיום |
| GET | `/api/tables/:groupId/reservations-upcoming` | הזמנות עתידיות |
| POST | `/api/public/restaurants/:groupId/book-table` | הזמנת מקום ציבורית (שולח SMS) |
| POST | `/api/public/restaurants/:groupId/verify-table-sms` | אימות קוד SMS |

### 5.4 לוגיקה עסקית

- **JSONB state storage**: כל העדכונים לשולחנות הם replace של כל ה-JSONB blob — מתאים לעדכונים תכופים בזמן אמת.
- **הזמנות ציבוריות**: `temp_table_reservations` עם `expires_at = NOW() + 30 minutes`. לאחר אימות SMS, `verified_at` מתמלא ו-`status='verified'`.
- **SMS verification**: מייצר קוד 4 ספרות, שולח ב-Twilio, מאמת ב-`verify-table-sms`. הזמנה פגה אחרי 30 דקות.
- **חיבור ל-calendar**: `calendar_events` עם `reserved_table_number` ו-`call_type='table_reservation'` מאפשרים שיוך הזמנת מקום לאירוע ביומן.

### 5.5 הערת Middleware (עדכון 24.08.2026)

כל endpoints `/api/tables/:groupId/*` (GET + PUT) פתוחים ללא middleware — **זה מכוון**:
- GET states/bills/assignments: נגיש גם מ-storefront (לקוח רואה שולחנות פנויים) — **אין להוסיף verifyBiz על ה-GET**.
- PUT endpoints (עדכון מלצרים, חשבוניות): פועלים בתוך ממשק הניהול הפנימי בלבד — **שיקול עתידי**: הוספת verifyBizOrLegacy על PUT.
- endpoints ציבוריים (`/api/public/restaurants/*`): ציבוריים by design — הזמנת שולחן + SMS.

---

## 6. Store Quotes & Kiosk

### 6.1 מהו המודול

**Quotes**: מערכת הצעות מחיר מלאה — יצירה, שליחה ללקוח, אישור/דחייה ע"י לקוח, המרה ל-Work Order.

**Kiosk**: מצב self-service — הגדרת סיסמת kiosk, לקוח מבצע הזמנה עצמאית בממשק פשוט ללא login.

### 6.2 DB Schema

שדות רלוונטיים ב-`store_orders` עבור Quotes:
- `call_type = 'quote'`
- `quote_title TEXT`
- `quote_history JSONB DEFAULT '[]'` — גרסאות קודמות של ההצעה
- `customer_response TEXT` — תגובת הלקוח
- `customer_response_type VARCHAR(30)` — `approved / rejected / changes_requested`
- `customer_response_at TIMESTAMP`
- `status_changed_at TIMESTAMP`

שדות בטבלת `store_settings` עבור Kiosk:
- `kiosk_password VARCHAR(100) DEFAULT '1234'`

### 6.3 API Endpoints — Quotes

| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/store/quotes` | יצירת הצעת מחיר חדשה |
| GET | `/api/store/quotes/family/:familyGroupId` | הצעות לפי לקוח (family) |
| GET | `/api/store/quotes/:groupId` | כל הצעות העסק |
| PUT | `/api/store/quotes/:id` | עדכון הצעה |
| PATCH | `/api/store/quotes/:id/status` | עדכון סטטוס |
| POST | `/api/store/quotes/:id/prepare-send` | הכנה לשליחה (יצירת link) |
| POST | `/api/store/quotes/:id/approve` | אישור ע"י בית עסק |
| POST | `/api/store/quotes/:id/send-to-oneflow` | שליחה דרך OneFlow לחתימה |
| POST | `/api/store/quotes/:id/link-only` | שליחת link בלבד ללקוח |
| PATCH | `/api/store/quotes/:id/customer-response` | לקוח מאשר/דוחה/מבקש שינויים |
| POST | `/api/store/quotes/:id/to-work-order` | המרה ל-Work Order |
| POST | `/api/store/quotes/:id/business-message` | הודעת עסק ללקוח על ה-quote |
| POST | `/api/store/customers/:id/send-quote` | שליחת הצעה ל-customer |

### 6.4 API Endpoints — Kiosk

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/store/kiosk-settings/:groupId` | קריאת הגדרות kiosk |
| POST | `/api/store/kiosk-lookup` | אימות לקוח בkiosk (לפי קוד/טלפון) |
| POST | `/api/store/kiosk-order` | הגשת הזמנה מ-kiosk |
| GET | `/api/store/kiosk-password/:groupId` | קריאת סיסמת kiosk |
| PUT | `/api/store/kiosk-password` | שינוי סיסמת kiosk |

### 6.5 לוגיקה עסקית

- **Quote lifecycle**: `draft → sent → approved / rejected / changes_requested → (if approved) converted_to_wo`.
- **quote_history**: בכל עדכון משמעותי, הגרסה הנוכחית נדחפת ל-`quote_history JSONB array` לפני שינוי.
- **OneFlow integration**: שליחה ל-OneFlow (external e-signature service) דרך API חיצוני — לא מנוהל ב-DB.
- **Kiosk flow**: לקוח מזין קוד/טלפון → `kiosk-lookup` מחזיר פרטים → לקוח בוחר מוצרים → `kiosk-order` יוצר הזמנה רגילה ב-`store_orders` עם `order_source='kiosk'`.

### 6.6 הערת Middleware (עדכון 24.08.2026)

- **GET** `/api/store/quotes/family/:familyGroupId` — פתוח בכוונה: לקוח רואה את הצעות המחיר שלו ב-storefront ללא login.
- **GET** `/api/store/quotes/:groupId` — כבר מוגן: `verifyBizOrLegacy + requireModule('sales')` ✓
- **POST/PUT/PATCH** quotes — כבר מוגנים: `verifyBizOrLegacy + requireModule('sales')` ✓
- **Kiosk endpoints** — פתוחים בכוונה: self-service ללא login הוא ה-use case המרכזי.
- **מסקנה**: אין צורך בשינוי — המצב הנוכחי נכון.

---

## 7. Alert Rules

### 7.1 מהו המודול

מנגנון התראות event-driven — עסקים מגדירים חוקים (rules) שמפעילים התראות אוטומטיות בעת אירועים מסוימים (מלאי נמוך, SLA חריגה, הזמנה חדשה וכד').

### 7.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `alert_rules` | הגדרת חוקי התראה | `group_id`, `name`, `trigger_type`, `trigger_config JSONB`, `recipients JSONB DEFAULT '["ADMIN"]'`, `channels JSONB DEFAULT '["in_app"]'`, `cooldown_minutes`, `is_active` |
| `alert_notifications` | התראות שנוצרו | `group_id`, `rule_id FK`, `trigger_type`, `message TEXT`, `is_read`, `reference_key VARCHAR(100)` |
| `sla_configs` | הגדרות SLA | `group_id`, `module VARCHAR(30)`, `status VARCHAR(50)`, `status_label`, `max_hours`, `channels JSONB`, UNIQUE(group_id, module, status) |

### 7.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/alerts/rules` | רשימת חוקים לעסק |
| POST | `/api/alerts/rules` | יצירת חוק חדש |
| PUT | `/api/alerts/rules/:id` | עדכון חוק |
| DELETE | `/api/alerts/rules/:id` | מחיקת חוק |
| GET | `/api/alerts/notifications` | התראות (עם פילטר is_read) |
| GET | `/api/alerts/unread-count` | מספר התראות שלא נקראו |
| POST | `/api/alerts/notifications/:id/read` | סימון כנקראה |
| POST | `/api/alerts/notifications/read-all` | סימון הכל כנקרא |
| POST | `/api/alerts/notifications` | יצירת התראה ידנית |

### 7.4 לוגיקה עסקית

- **trigger_types**: `low_stock`, `new_order`, `status_change`, `sla_breach`, `equipment_maintenance`, `payment_due`.
- **trigger_config JSONB**: כולל ערכי סף — לדוגמה `{"threshold": 5}` ל-`low_stock`.
- **cooldown**: המערכת בודקת שלא נשלחה התראה מאותו rule ב-X דקות האחרונות.
- **channels**: `in_app` (נכון לעכשיו — ערוצים עתידיים כגון SMS/email מוגדרים אך לא ממומשים).
- **SLA breach**: `sla_configs` מגדיר כמה שעות מותר לסטטוס מסוים להישאר. cron (חיצוני) יכול להפעיל את ה-check.
- **reference_key**: מניעת כפל התראות — `alert_notifications.reference_key` שומר ID ייחודי של האירוע.

---

## 8. B2B, FlowPool & Banner Ads

### 8.1 FlowPool

#### מהו המודול
מערכת רכישה קבוצתית קהילתית. משפחה פותחת "פול" לשירות הנדרש, שכנים מצטרפים, עסקים מגישים הצעות מחיר. אחרי `min_families` מצטרפים — הפול עובר לסבב 2 (הצעות סופיות). משפחה בוחרת הצעה מנצחת.

#### DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `flow_pools` | פולים פתוחים | `community_id`, `initiator_type` (`family/business`), `initiator_id`, `title`, `description`, `service_category`, `max_price`, `offer_price`, `min_families`, `status` (`open_r1/open_r2/closed/expired`), `winner_bid_id`, `expires_at` |
| `flow_pool_members` | משפחות בפול | `pool_id`, `group_id` PK composite |
| `flow_pool_bids` | הצעות עסקים | `pool_id`, `business_group_id`, `price`, `description`, `is_guest`, `status` |
| `flow_pool_messages` | הודעות בפול | `pool_id`, `sender_type`, `sender_id`, `content` |
| `biz_pool_hidden` | פולים שעסק הסתיר | `pool_id`, `biz_group_id` UNIQUE |

#### API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/community/pool` | פתיחת פול חדש |
| GET | `/api/community/pool/community/:communityId` | פולים בקהילה |
| GET | `/api/community/pool/:id` | פרטי פול |
| POST | `/api/community/pool/:id/join` | הצטרפות לפול (משפחה) |
| POST | `/api/community/pool/:id/remove-member` | הסרת חבר |
| POST | `/api/community/pool/:id/bid` | הגשת הצעת מחיר (עסק) |
| GET | `/api/community/pool/:id/bids` | הצעות בפול |
| POST | `/api/community/pool/:id/select-bid` | בחירת הצעה מנצחת |
| POST | `/api/community/pool/:id/open-round2` | מעבר לסבב 2 |
| POST | `/api/community/pool/:id/archive` | ארכיב פול |
| POST | `/api/community/pool/:id/renew` | חידוש פול פגה |
| POST | `/api/community/pool/:id/edit` | עדכון פרטי פול |
| POST | `/api/community/pool/:id/restore` | שחזור מארכיב |
| GET | `/api/community/pool/:id/messages` | הודעות |
| POST | `/api/community/pool/:id/message` | שליחת הודעה |
| POST | `/api/community/pool/cleanup` | ניקוי פולים פגי תוקף |
| GET | `/api/biz/pools/:bizGroupId` | פולים הזמינים לעסק |
| GET | `/api/community/pool/family-archive/:groupId` | ארכיב פולים של משפחה |
| GET | `/api/biz/pool-archive/:bizGroupId` | ארכיב פולים של עסק |

#### לוגיקה עסקית

- **Statuses**: `open_r1` (סבב ראשון, הצעות חופשיות) → `open_r2` (סבב שני, הצעות סופיות) → `closed` (נבחרה הצעה) / `expired`.
- **FLW rewards** (מוגדרים ב-`flow_config`): `pool_create` = 3 FLW אישי + 1 קהילתי; `pool_join` = 5+2; `pool_bid_accepted` = 25+10.
- **Auto-expire**: בכל GET של פולי הקהילה, המערכת מריצה `UPDATE SET status='expired' WHERE expires_at <= NOW()`.

---

### 8.2 Banner Ads

#### מהו המודול
מודול פרסום ממומן — עסקים יכולים לבקש banner ads בקהילות. SA מאשר ומנהל. Zone Managers יכולים ליצור banners ב-AI.

#### DB Schema (מ-spec-db-schema.md)

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `banner_slots` | מיקומי banner | `name`, `description`, `max_width`, `max_height`, `price_per_day` |
| `banner_pricing` | תמחור מותאם | `slot_id`, `community_id`, `price_per_day` |
| `banner_orders` | הזמנות פרסום | `business_id`, `slot_id`, `community_id`, `start_date`, `end_date`, `status`, `image_url`, `click_url` |
| `banner_slot_communities` | שיוך slots לקהילות | `slot_id`, `community_id` |

#### API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/banners` | banners פעילים (ציבורי) |
| POST | `/api/superadmin/banners` | יצירת banner (SA בלבד) |
| POST | `/api/biz/community/promotions/:id/banner-request` | עסק מבקש banner לקמפיין |
| GET | `/api/community/approved-banners` | banners מאושרים לקהילה |
| GET | `/api/sa/community/banner-requests` | בקשות banner לאישור SA |
| POST | `/api/sa/community/banner-requests/:id/approve` | אישור banner |
| POST | `/api/sa/community/banner-ai/:id` | יצירת banner עם AI (SA) |
| POST | `/api/zone-manager/ai/generate-banner` | יצירת banner עם AI (ZM) |
| GET | `/api/public/system-banner` | system banner גלובלי |

---

### 8.3 B2B

מודול B2B מאפשר לעסקים לסחור ביניהם. עסקים יכולים להגדיר מוצרי B2B, לפרסם מחירים מיוחדים, ולקבל הזמנות מעסקים אחרים בקהילה.

ה-endpoints הרלוונטיים מחולקים תחת `/api/biz/` ו-`/api/b2b/` — ראה `spec-api-complete.md` לפירוט מלא.

---

## 9. Community Wallet & Cashback

### 9.1 מהו המודול

מערכת cashback קהילתית — לכל קהילה יש ארנק (`community_wallets`). כשלקוח קהילתי קונה מעסק הרשום בקהילה, חלק מהרכישה הולך ל-cashback קהילתי. Super Admin מגדיר את ה-%. Zone Manager גובה עמלות מהעסקים.

### 9.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `community_wallets` | ארנק קהילתי | `community_id PK`, `balance`, `total_earned` |
| `community_wallet_transactions` | תנועות | `community_id`, `amount`, `type` (cashback/withdrawal), `reference_id`, `description` |
| `business_platform_dues` | חובות עסקים לפלטפורמה | `business_id`, `order_id`, `order_amount`, `commission_pct`, `commission_amount`, `cashback_pct`, `cashback_amount`, `community_id`, `status` |
| `business_platform_collections` | גבייה בפועל | `business_id`, `amount`, `collected_at`, `notes`, `created_by` |
| `community_promotions` | מבצעים קהילתיים | `community_id`, `business_id`, `title`, `discount_pct`, `valid_until`, `promo_code`, `promo_type`, `condition_type` |

### 9.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/sa/community-wallets` | רשימת כל ארנקי הקהילות (SA) |
| GET | `/api/community/cashback-info/:groupId` | מידע cashback לעסק |
| GET | `/api/flow/community-wallet/:communityId` | יתרת ארנק קהילה |

### 9.4 לוגיקה עסקית

- **Flow**: עסק מוכר → `business_platform_dues` נוצרת עם `status='pending'` → SA/ZM גובה → `business_platform_collections` נוצרת → `community_wallet_transactions` מתעדת cashback.
- **הגדרת %**: `commission_pct` ו-`cashback_pct` מוגדרים ברמת העסק/קהילה דרך SA.
- **Zone Manager**: ZM גוזר עמלה משלו מ-`commission_pct` דרך `zone_manager_commissions`.
- **מבצעים קהילתיים**: `community_promotions` עם `promo_code` — ניתן להגדיר: הנחת % (`promo_type='discount'`), מחיר מוצר (`promo_type='product'`), תנאי רכישה (`condition_type: min_amount/item`).

---

## 10. Public Storefront

### 10.1 מהו המודול

חנות ציבורית — דף landing page ייחודי לכל עסק, נגיש ללא login. מאפשר ללקוחות לעיין בקטלוג, לשלוח הצעות מחיר, להשאיר לידים, ולהזמין שולחן במסעדה.

### 10.2 DB Schema

ה-Storefront אינו מוסיף טבלאות חדשות — הוא קורא מהטבלאות הקיימות:
- `family_groups` — שם העסק, לוגו, `storefront_code`
- `store_catalog` — קטלוג מוצרים/שירותים
- `professional_content` — תוכן אתר מקצועי
- `professional_expertise` — תחומי התמחות
- `professional_articles` — מאמרים
- `store_popups` — popup מבצעים
- `beauty_service_catalog` — שירותי יופי

שדות ב-`family_groups`:
- `storefront_code VARCHAR(50) UNIQUE` — קוד ייחודי לURL: `/api/storefront/:code`
- `storefront_config JSONB` — הגדרות תצוגה מותאמות
- `is_onboarded BOOLEAN`
- `location_lat/lng DOUBLE PRECISION`

### 10.3 API Endpoints

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/storefront/:code` | עמוד עסק ציבורי — מחזיר את כל הנתונים הנחוצים |
| GET | `/api/public/store-popups/:groupId` | popups פעילים לחנות |
| GET | `/api/public/system-banner` | system banner גלובלי |
| POST | `/api/public/restaurants/:groupId/book-table` | הזמנת שולחן ציבורית |
| POST | `/api/public/restaurants/:groupId/verify-table-sms` | אימות SMS להזמנה |
| POST | `/api/professional-leads/:groupId` | שליחת ליד מהאתר הציבורי |

### 10.4 לוגיקה עסקית

- **`GET /api/storefront/:code`**: endpoint מרכזי — מחפש את העסק ב-`family_groups.storefront_code`, ומחזיר aggregate של:
  - פרטי העסק הבסיסיים
  - קטלוג (`store_catalog` — פעיל בלבד)
  - תוכן מקצועי (`professional_content`, `professional_expertise`, `professional_articles` שפורסמו)
  - קטלוג שירותי יופי (אם `business_type='beauty'`)
- **Store Popups**: `store_popups` עם `popup_type='store'` ו-`is_active=true` ו-`expires_at > NOW()`. כוללים `trigger_type` — `none` (מיידי), `after_seconds`, `exit_intent`.
- **SEO/Public**: כל ה-endpoints הציבוריים הם ללא auth — מאפשרים הטמעה ו-indexing.

---

## 11. Live Game Host

### 11.1 מהו המודול

מודול משחקים חיים מרובי-משתתפים. SA יוצר משחק טריוויה/חידון, קהילות נבחרות רואות אותו, משפחות/ילדים נכנסים עם game_code, מתחרים בזמן אמת, וה-leaderboard מתעדכן. SA שולט על קצב השאלות ומאשר שחקנים.

### 11.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `live_games` | משחקים חיים | `game_code UNIQUE`, `title`, `description`, `status` (draft/waiting/active/finished), `current_question_index`, `sponsor_logo`, `character_image`, `is_visible` |
| `live_game_questions` | שאלות | `game_id FK`, `question_text`, `options JSONB`, `correct_answer`, `time_limit_seconds`, `sort_order` |
| `live_game_participants` | שחקנים | `game_id FK`, `player_name`, `player_type` (child/family), `user_id`, `score`, `is_approved`, `joined_at` |
| `live_game_answers` | תשובות | `game_id FK`, `participant_id FK`, `question_id FK`, `answer`, `is_correct`, `time_taken_ms`, `points_earned` |
| `live_game_assignments` | שיוך קהילות | `game_id FK`, `community_id FK`, `assigned_at` |

### 11.3 API Endpoints

> 20 endpoints | 15 עם verifySA, 5 ציבוריים במכוון

| Method | Path | Auth | תיאור |
|--------|------|------|-------|
| POST | `/api/live-games` | verifySA | יצירת משחק |
| PUT | `/api/live-games/:id` | verifySA | עדכון משחק |
| GET | `/api/live-games/:id` | verifySA | פרטי משחק |
| GET | `/api/live-games` | verifySA | כל המשחקים |
| DELETE | `/api/live-games/:id` | verifySA | מחיקת משחק |
| PUT | `/api/live-games/:id/status` | verifySA | עדכון סטטוס (waiting→active→finished) |
| POST | `/api/live-games/:id/next-question` | verifySA | מעבר לשאלה הבאה |
| PUT | `/api/live-games/:id/restart` | verifySA | איפוס משחק |
| GET | `/api/live-games/:id/waiting-room` | verifySA | שחקנים ממתינים לאישור |
| POST | `/api/live-games/:id/approve` | verifySA | אישור שחקן בודד |
| POST | `/api/live-games/:id/approve-all` | verifySA | אישור כל השחקנים |
| POST | `/api/live-games/:id/notify-start` | verifySA | שליחת הודעת פתיחה |
| PATCH | `/api/live-games/:id/visibility` | verifySA | שינוי נראות |
| POST | `/api/live-games/:id/assign` | verifySA | שיוך קהילות למשחק |
| GET | `/api/live-games/:id/assignments` | verifySA | קהילות משויכות |
| POST | `/api/live-games/:game_code/join` | ציבורי | הצטרפות לחדר המתנה |
| POST | `/api/live-games/:game_code/answer` | ציבורי | הגשת תשובה |
| GET | `/api/live-games/:game_code/state` | ציבורי | מצב משחק נוכחי (polling) |
| GET | `/api/live-games/:game_code/image/:type` | ציבורי | תמונת לוגו/דמות |
| GET | `/api/live-games/:id/leaderboard` | ציבורי | לוח תוצאות |

### 11.4 לוגיקה עסקית

- **Game flow**: SA יוצר → שולח לקהילות → `status='waiting'` → שחקנים מצטרפים עם game_code → SA מאשר → `status='active'` → SA מקדם שאלות ידנית → `status='finished'`.
- **Polling**: שחקנים מבצעים GET `/state` כל כמה שניות — מקבלים את השאלה הנוכחית, מצב, ו-leaderboard.
- **ניקוד**: `points_earned` = נקודות בסיס מינוס עונש זמן (ממהר = יותר נקודות).
- **5 endpoints ציבוריים**: join/answer/state/image/leaderboard — מכוון, שחקנים לא מחוברים למערכת.

---

## 12. Community Social Feed

### 12.1 מהו המודול

פיד חברתי קהילתי — משפחות מפרסמות פוסטים, לייקים, תגובות, ושיתופים בתוך הקהילה. כולל: פיד כללי, פיד לפי קבוצות עניין, ספירת לא-נקראו, חיפוש, ופוסטים ציבוריים לשיתוף ב-WhatsApp.

### 12.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `community_posts` | פוסטים | `community_id FK`, `group_id`, `author_name`, `content TEXT`, `post_type` (text/image/promo/pool), `image_url`, `likes_count`, `comments_count`, `shares_count`, `is_pinned`, `status` (pending/approved/rejected) |
| `community_post_likes` | לייקים | `post_id FK`, `user_id`, `group_id` — UNIQUE(post_id, user_id) |
| `community_post_comments` | תגובות | `post_id FK`, `group_id`, `author_name`, `content TEXT` |
| `community_post_reports` | דיווחים | `post_id FK`, `group_id`, `reason` |
| `community_post_shares` | שיתופים | `post_id FK`, `group_id`, `shared_to` |
| `community_interest_groups` | קבוצות עניין | `community_id FK`, `name`, `description`, `icon`, `created_by_group_id` |
| `community_group_members` | חברי קבוצת עניין | `group_id FK` (interest group), `family_group_id`, UNIQUE composite |
| `community_feed_reads` | סימון נקרא | `post_id FK`, `family_group_id`, UNIQUE composite |
| `community_notifications` | התראות קהילה | `family_group_id`, `community_id`, `notification_type`, `reference_id`, `message`, `is_read` |

### 12.3 API Endpoints

> 23 endpoints | **כולם ללא middleware — ⚠️ פגיעות אבטחה פתוחה**

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/community/feed` | פיד כללי |
| POST | `/api/community/posts` | פרסום פוסט |
| POST | `/api/community/feed/mark-read` | סימון כנקרא |
| GET | `/api/community/feed/unread-counts` | ספירת לא-נקראו |
| GET | `/api/community/feed/search` | חיפוש בפיד |
| GET | `/api/community/feed/biz-promos` | מבצעי עסקים בפיד |
| POST | `/api/community/posts/:id/like` | לייק |
| GET | `/api/community/posts/:id/comments` | תגובות |
| POST | `/api/community/posts/:id/comments` | הוספת תגובה |
| POST | `/api/community/posts/:id/report` | דיווח על פוסט |
| POST | `/api/community/posts/:id/share` | שיתוף |
| GET | `/api/community/posts/:id/likers` | מי עשה לייק |
| GET | `/api/community/posts/:id/sharers` | מי שיתף |
| GET | `/api/community/posts/:id/public` | פוסט ציבורי (לשיתוף WhatsApp) |
| GET | `/api/community/notifications` | התראות קהילה |
| GET | `/api/community/notifications/count` | ספירת התראות |
| POST | `/api/community/notifications/mark-read` | סימון כנקרא |
| GET | `/api/community/:communityId/groups` | קבוצות עניין |
| POST | `/api/community/groups/:id/join` | הצטרפות לקבוצה |
| POST | `/api/community/groups/:id/leave` | עזיבת קבוצה |
| POST | `/api/community/groups` | יצירת קבוצת עניין |
| GET | `/api/community/groups/:id/members` | חברי קבוצה |
| GET | `/api/community/family-feed/:groupId` | פיד של משפחה ספציפית |

### 12.4 לוגיקה עסקית

- **פיד מאוחד**: `GET /api/community/feed` מחזיר שילוב של פוסטים, מבצעי עסקים, ועדכוני פולים — ממוין לפי `created_at DESC`.
- **unread counting**: `community_feed_reads` מקיים רשומה לכל פוסט+משפחה שנקרא. `unread-counts` סופר פוסטים ללא רשומה.
- **קבוצות עניין**: sub-communities בתוך קהילה — חברים לפי תחום (טבע, בישול, ספורט).
- **⚠️ פגיעות אבטחה**: כל 23 endpoints ללא middleware — כל אחד שיודע את community_id יכול לפרסם פוסטים, להוסיף תגובות, ולסמן נקרא בשם כל קבוצה. **נדרש: verifyFamily על פעולות כתיבה לפחות.**

---

## 13. Family-Business Link & Service Areas

### 13.1 מהו המודול

שלושה מנגנונים גאוגרפיים/חברתיים שלא תועדו:
1. **family_link_requests** — בקשות קישור **משפחה-למשפחה** (לא משפחה-לעסק). מאפשר ליצור קשרי parent/child/partner בין קבוצות משפחה שונות.
2. **biz_service_areas** — מרחב השירות הגאוגרפי של עסק (ערים + רדיוס). משמש לפילטר "קרובים אליי" ב-marketplace.
3. **family_preferred_areas** — אזורי העדפה של משפחה לחיפוש עסקים.

> **הבהרה קריטית**: `family_link_requests` הוא קישור **משפחה-למשפחה** בלבד (role: parent/child/partner). אין כאן קישור לעסק. אין אלגוריתם התאמה אוטומטי — `preferred_areas` ו-`service_areas` קיימים כמנגנון גאוגרפי אך אין endpoint שמחבר ביניהם לצורך המלצות.

### 13.2 DB Schema

| טבלה | תיאור | שדות מפתח |
|------|-------|------------|
| `family_link_requests` | בקשות קישור | `requester_group_id FK`, `target_phone`, `role` (parent/child/partner), `status` (pending/accepted/rejected), `target_group_id FK` |
| `family_preferred_areas` | אזורים מועדפים | `family_group_id FK`, `city`, `lat DOUBLE`, `lng DOUBLE`, `radius_km`, `is_primary BOOLEAN` — UNIQUE(family_group_id, city) |
| `biz_service_areas` | אזורי שירות עסק | `business_group_id FK`, `city`, `lat DOUBLE`, `lng DOUBLE`, `radius_km` — UNIQUE(business_group_id, city) |

### 13.3 API Endpoints

> 13 endpoints מאומתים (14 לפי ספירה — endpoint אחד TBD) | **כולם ללא middleware**

#### קישורי משפחה-למשפחה

| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/family/link-request` | יצירת בקשת קישור — body: `{requesterGroupId, targetPhone, role}` |
| GET | `/api/family/link-requests/:groupId` | בקשות קישור של קבוצה |
| POST | `/api/family/link-request/:id/respond` | אישור/דחייה של בקשה |

#### אזורי שירות עסק

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/biz/service-areas/:groupId` | אזורי שירות לעסק |
| POST | `/api/biz/service-areas/:groupId` | הוספת אזור שירות |
| DELETE | `/api/biz/service-areas/:groupId/:areaId` | מחיקת אזור |
| POST | `/api/biz/location/:groupId` | עדכון מיקום בסיסי של עסק |
| GET | `/api/biz/radius-zones/:groupId` | אזורי רדיוס מוגדרים |
| POST | `/api/biz/radius-zones/:groupId` | הוספת אזור רדיוס |
| DELETE | `/api/biz/radius-zones/:groupId/:zoneId` | מחיקת אזור רדיוס |

#### אזורי העדפה משפחה

| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/family/preferred-areas/:groupId` | אזורים מועדפים |
| POST | `/api/family/preferred-areas/:groupId` | הוספת אזור מועדף |
| DELETE | `/api/family/preferred-areas/:groupId/:areaId` | מחיקת אזור |

### 13.4 לוגיקה עסקית

- **link-request flow**: משפחה A שולחת בקשה לטלפון של משפחה B. אם B קיים במערכת → `target_group_id` מתמלא, B מקבל התראה ויכול לאשר/לדחות. role מגדיר את הכיוון: parent שולט ב-child, partner הוא דו-כיווני.
- **גאוגרפיה ב-marketplace**: פילטר "קרובים אליי" ב-`GET /api/public/businesses` מבצע `JOIN biz_service_areas bsa ON bsa.business_group_id = fg.id AND bsa.lat IS NOT NULL`. לא נעשה שימוש ב-`family_preferred_areas` לצורך זה כרגע — הם קיימים אך לא מחוברים לאלגוריתם.
- **⚠️ חסר**: אין endpoint שמחבר `preferred_areas` של משפחה ל-`service_areas` של עסק לצורך המלצות מותאמות אישית.

---

## נספח — טבלאות Cross-Module

| שדה/טבלה | נוגע ב-modules |
|-----------|----------------|
| `store_orders.call_type` | quotes, work_orders, service_calls, table_reservations |
| `calendar_events.work_order_id` | work_orders + calendar |
| `professional_documents.work_order_id` | professional + work_orders |
| `work_order_payments.service_call_id` | work_orders + service_calls |
| `flow_config` | flow_wallets + FlowPool (FLW events) |
| `community_id` | FlowPool + community_wallets + banner_ads + zone_manager |
| `family_groups.features JSONB` | פיצ'ר flags לכל המודולים |

