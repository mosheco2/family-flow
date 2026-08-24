# סכמת בסיס נתונים מלאה — Family-Flow

> תאריך: 2026-07-22
> מספר טבלאות: ~178 (כולל כפילויות CREATE IF NOT EXISTS)
> מנוע: PostgreSQL | Backend: Node.js / Express

---

## קבוצות טבלאות

### 1. משתמשים ואימות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `users` | כל משתמשי המערכת (משפחה + עסק + SA) | id, nickname, email, phone, role, group_id, balance, permissions (JSONB), profile_image, last_seen, employee_role_type, id_number |
| `sa_users` | משתמשי Super Admin | id, team_id, name, email, password_hash, status, working_hours |
| `sa_teams` | צוותי Super Admin + הרשאות RBAC | id, name, permissions (JSONB) |
| `zone_managers` | מנהלי אזורים (Zone Managers) | id, name, email, phone, password_hash, status, commission_pct, notes |

---

### 2. קבוצות ועסקים

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `family_groups` | הישות המרכזית — משפחה או עסק | id, name, admin_email, type (family/business), business_type, plan (standard/enterprise), is_premium, features (JSONB), licensed_features (JSONB), location_lat/lng, street_address, city, vat_number, contact_name, table_count, ai_tokens, owner_user_id |
| `group_licenses` | רישיונות פיצ'ר לכל קבוצה | id, group_id, feature_key, is_active, price_monthly, activated_at |
| `group_snapshots` | גיבויים של קבוצות (Snapshots) | id, group_id, snapshot_data (JSONB), created_at |
| `biz_type_visibility` | נראות סוגי עסקים | מנגנון feature-flagging לפי סוג עסק — SA מסתיר אלמנטי UI לסוג עסק מסוים. שדות: business_type VARCHAR(50), element_key VARCHAR(200), PK על שניהם. 3 endpoints: GET/POST /api/sa/biz-visibility/:type (verifySA), GET /api/biz-visibility/:type (ציבורי, נקרא בזמן ריצה ע"י business-app.js). |
| `member_business_links` | קישור בין חברים לעסקים | id, member_group_id, business_group_id, status, token |
| `user_assignments` | שיוך משתמשים נוסף | (גנרי) |
| `billing_records` | רשומות חיוב לעסקים | id, business_id, amount, plan_type, status, created_at |

---

### 3. FLW — מטבע דיגיטלי קהילתי

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `flow_config` | הגדרות FLW — כמות לפעולה | key (PK), personal_amount, community_amount, description |
| `flow_wallets` | ארנקי FLW (משפחה / עסק) | id, entity_type (family/business), entity_id, balance, updated_at |
| `flow_transactions` | היסטוריית עסקאות FLW | id, entity_type, entity_id, amount, action_key, description, reference_id, created_at |
| `flow_redemptions` | מימוש FLW להנחה בעסק | id, family_group_id, business_group_id, flow_amount, discount_ils, discount_code (UNIQUE), status, created_at, used_at |
| `flw_kid_wallets` | ארנק FLW לילדים | id, child_user_id (UNIQUE), family_group_id, balance_flw, lifetime_flw, redeemed_flw, updated_at |
| `flw_kid_config` | הגדרות ארנק ילד | id, family_group_id, child_user_id (UNIQUE), flw_value_ils, max_daily_flw, auto_approve, updated_at |
| `flw_kid_redeem_requests` | בקשות מימוש FLW ילדים | id, child_user_id, family_group_id, flw_amount, status, created_at, approved_at |

---

### 4. Work Orders — הזמנות עבודה

> הערה: Work Orders מאוחסנות בטבלת `store_orders` עם `call_type='work_order'`

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `work_order_assignees` | עובדים מוקצים להזמנת עבודה | id, work_order_id → store_orders, user_id, user_name, assigned_at, assigned_by, hourly_rate, hours_worked |
| `work_order_inventory` | חומרים שהוקצו/נוצלו בהזמנה | id, work_order_id, catalog_id, item_name, reserved_qty, used_qty, needed_qty, unit_price, status, pantry_id |
| `work_order_messages` | הודעות פנימיות להזמנת עבודה | id, work_order_id, user_id, user_name, message_text, created_at |
| `work_order_timeline` | ציר זמן אירועים בהזמנה | id, work_order_id, event_type, description, user_name, metadata (JSONB), created_at |
| `work_order_notes_history` | היסטוריית הערות להזמנה | id, work_order_id, note_text, created_by, created_at |
| `work_order_payments` | תשלומים / milestone payments | id, work_order_id, service_call_id, milestone_name, amount, due_date, payment_method, status, received_amount, received_at, total_amount |

---

### 5. Logistics — לוגיסטיקה ומשלוחים

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `logistics_orders` | הזמנות משלוח | id, group_id, customer_name, customer_phone, address, status, driver_id, total_amount, cod_amount, pod_image, tracking_token, created_at |
| `logistics_order_events` | אירועי מעקב הזמנה | id, order_id, event_type, description, created_at |
| `logistics_drivers` | נהגים | id, group_id, name, phone, is_active, current_lat, current_lng |
| `logistics_vehicles` | כלי רכב | id, group_id, name, type, license_plate, is_active |
| `logistics_pricing_zones` | אזורי תמחור | id, group_id, name, price, min_order |
| `logistics_rate_cards` | כרטיסי תעריף | id, group_id, name, rules (JSONB) |
| `logistics_routes` | מסלולים | id, group_id, name, driver_id, status, created_at |
| `logistics_route_stops` | עצירות במסלול | id, route_id, order_id, sequence, status |
| `logistics_cod_sessions` | סשיאני תשלום במזומן | id, group_id, driver_id, status, total_cod, closed_at |
| `logistics_customers` | לקוחות לוגיסטיקה | id, group_id, name, phone, email, address |
| `logistics_invoices` | חשבוניות לוגיסטיקה | id, group_id, customer_id, amount, status, created_at |
| `logistics_rfq` | בקשות הצעת מחיר (לוגיסטיקה) | id, group_id, description, status, messages (JSONB) |

---

### 6. Restaurant / Tables — מסעדה ושולחנות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `restaurant_table_states` | מצב שולחנות (group_id PK) | group_id, states (JSONB), updated_at |
| `restaurant_table_bills` | חשבונות שולחן (group_id PK) | group_id, bills (JSONB), updated_at |
| `restaurant_table_assignments` | שיוך עובדים לשולחנות | group_id, assignments (JSONB), shift_date, updated_at |
| `temp_table_reservations` | הזמנת שולחן זמנית (SMS) | id, group_id, customer_name, customer_phone, reservation_date, reservation_time, num_guests, sms_code, verified_at, status, expires_at |

---

### 7. Store & Commerce — חנות וסחר

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `store_settings` | הגדרות חנות לכל קבוצה | group_id (PK), is_active, welcome_message, phone, min_order, slogan, store_type, logo_url, open_time, close_time, delivery_fee, include_vat, vat_rate, enable_table_booking, kiosk_password |
| `store_catalog` | קטלוג מוצרים | id, group_id, name, description, price, category, is_available, image_url, product_type, long_description, gallery, sku, stock_quantity, sort_order, kitchen_station, is_complimentary, reserved_qty, overhead_details (JSONB) |
| `store_orders` | הזמנות + הצעות מחיר + Work Orders | id, group_id, customer_name, customer_phone, total_amount, status, items (JSONB), is_delivery, delivery_fee, family_group_id, call_type (work_order/service_call), quote_status, quote_number, quote_title, confirm_token, payment_status, wo_notes, order_source, customer_rating, created_at |
| `store_order_items` | פריטי הזמנה | id, order_id, catalog_id, item_name, quantity, price_at_order |
| `store_customers` | לקוחות CRM | id, group_id, name, phone, email, company_name, business_id, family_group_id, notes |
| `store_coupons` | קופונים | id, group_id, code, type, value, min_order, is_active, expires_at |
| `store_promotions` | מבצעים | id, group_id, title, type, details (JSONB), start_date, end_date, is_active |
| `store_popups` | חלונות קופצים | id, group_id, title, content, button_text, button_url, image_url, popup_type, trigger_type, trigger_ref, scheduled_at, expires_at, is_active |
| `delivery_zones` | אזורי משלוח | id, group_id, name, min_order, delivery_fee, sort_order |
| `business_gallery` | גלריית עסק | id, group_id, image_url, caption, sort_order |
| `product_ingredients` | מצרכים (food cost) | id, catalog_id, ingredient_name, quantity, unit |
| `product_category_map` | מיפוי קטגוריות מוצר | id, group_id, normalized_name, category |
| `sent_newsletters` | ניוזלטרים שנשלחו | id, group_id, subject, content_html, audience, recipient_count, sent_at |
| `purchase_orders` | הזמנות רכש מספקים | id, group_id, supplier_id, work_order_id, service_call_id, status, confirm_token, supplier_confirmed_at |

---

### 8. Beauty — יופי וקוסמטיקה

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `beauty_practitioners` | קוסמטיקאיות / מטפלים | id, biz_id → family_groups, name, role, color, is_active |
| `beauty_resources` | חדרים / ציוד | id, biz_id, name, type, is_active |
| `beauty_appointments` | תורים | id, biz_id, client_id, practitioner_id, resource_id, service_ids (JSONB), start_time, end_time, status, total_price, notes, oneflow_family_group_id |
| `beauty_appointment_segments` | קטעי תור מורכב | id, appointment_id, practitioner_id, resource_id, service_id, start_offset, duration |
| `beauty_service_catalog` | קטלוג שירותים | id, biz_id, name, duration_min, price, category, color, is_active |
| `beauty_client_records` | רשומות לקוח | id, biz_id, name, phone, email, notes, oneflow_group_id |
| `beauty_client_photos` | תמונות לקוח (לפני/אחרי) | id, biz_id, client_id, image_url, notes, created_at |
| `beauty_formulas` | נוסחאות צבע/טיפול | id, biz_id, client_id, formula_text, created_at |
| `beauty_inventory` | מלאי מוצרים | id, biz_id, product_name, quantity, unit, min_quantity, cost_price |
| `beauty_commissions` | עמלות למטפלים | id, biz_id, practitioner_id, appointment_id, amount, is_paid, paid_at |
| `beauty_rfq` | בקשות הצעת מחיר (יופי) | id, family_id, biz_id, service_type, status, questions (JSONB), client_message |
| `beauty_subscription_types` | סוגי מנויים | id, biz_id, name, sessions, price, validity_days |
| `beauty_client_subscriptions` | מנויי לקוחות | id, biz_id, client_id, subscription_type_id, sessions_left, expires_at, status |

---

### 9. Professional Platform — פלטפורמה מקצועית

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `professional_content` | תוכן אתר מקצועי | id, group_id (UNIQUE), hero_title_he/en, hero_subtitle_he/en, about_text_he/en, updated_at |
| `professional_expertise` | תחומי מומחיות | id, group_id, icon, title_he/en, description_he/en, sort_order, is_active |
| `professional_articles` | מאמרים מקצועיים | id, group_id, title_he/en, content_he/en, tags, is_published |
| `professional_leads` | לידים מהאתר | id, group_id, name, phone, email, subject, message, status, created_at |
| `professional_documents` | מסמכים / חוזים / הצהרות | id, group_id, customer_name, customer_phone, customer_email, customer_id_number, title, content, doc_type, status, is_template, signature_data, work_order_id, created_at |
| `professional_document_versions` | גרסאות מסמך | id, document_id, title, content, doc_type, status, changed_at |
| `professional_doc_types` | סוגי מסמכים מותאמים | id, group_id, name, icon |
| `time_logs` | רישום שעות עבודה | id, group_id, user_id, customer_name, wo_id, description, minutes, hourly_rate, logged_date, is_billed |

---

### 10. Sport / Fitness — ספורט וכושר

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `sport_membership_types` | סוגי מנויים | id, group_id, name, type, price, duration_days, sessions, color, is_active |
| `sport_memberships` | מנויי חברים | id, group_id, member_name, member_phone, membership_type_id, status, start_date, end_date, sessions_total, sessions_used, frozen_at, frozen_days_banked |
| `sport_checkins` | כניסות חברים | id, group_id, membership_id, member_name, checked_in_at, checked_out_at |
| `sport_class_types` | סוגי שיעורים | id, group_id, name, color, default_duration_min, is_active |
| `sport_classes` | שיעורים | id, group_id, class_type_id, class_name, trainer_name, class_date, start_time, end_time, max_capacity, current_enrolled |
| `sport_class_registrations` | הרשמה לשיעורים | id, class_id, membership_id, registered_at |
| `sport_class_waitlist` | רשימת המתנה לשיעור | id, class_id, membership_id, created_at |
| `sport_trainers` | מדריכים | id, group_id, name, phone, specialties, hourly_rate, is_active |
| `sport_trainer_sessions` | שיעורים פרטיים עם מדריך | id, trainer_id, membership_id, session_date, duration_min, is_paid |
| `sport_payments` | תשלומי ספורט | id, group_id, membership_id, amount, payment_method, paid_at |
| `sport_cancel_policy` | מדיניות ביטול | id (group_id PK), hours_before, penalty_type, penalty_value |
| `sport_health_declarations` | הצהרות בריאות | id, group_id, membership_id, declared_at, signature |
| `sport_waiver_templates` | תבניות ויתור | id, group_id, content, created_at |
| `sport_leads` | לידים לחדר כושר | id, group_id, name, phone, source, status, created_at |

---

### 11. Community & Zone — קהילה ואזורים

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `communities` | קהילות | id, name, description, manager_group_id, zone_id, status, created_at |
| `family_communities` | שיוך משפחות לקהילות | family_group_id, community_id, status, is_community_manager |
| `community_businesses` | עסקים בקהילה | community_id, business_id, discount_pct, status |
| `community_posts` | פוסטים בפיד קהילתי | id, community_id, author_type, author_id, content, image_url, is_approved |
| `community_post_likes` | לייקים לפוסטים | id, post_id, group_id |
| `community_post_comments` | תגובות לפוסטים | id, post_id, author_id, content |
| `community_post_reports` | דיווחים על פוסטים | id, post_id, reporter_id, reason |
| `community_post_shares` | שיתופי פוסטים | id, post_id, group_id |
| `community_feed_reads` | סימון פוסטים כנקראים | id, post_id, group_id |
| `community_notifications` | התראות קהילה | id, community_id, group_id, type, content, is_read |
| `community_articles` | מאמרים קהילתיים | id, community_id, author_type, author_id, title, body, image_url |
| `community_interest_groups` | קבוצות עניין בקהילה | id, community_id, name, description |
| `community_group_members` | חברים בקבוצת עניין | group_id (interest_group), family_group_id |
| `community_referrals` | הפניות בקהילה | id, from_group_id, to_group_id, community_id, status |
| `community_promotions` | מבצעים קהילתיים | id, community_id, business_id, title, discount_pct, promo_code (UNIQUE), promo_type, catalog_item_id, condition_type, status, valid_until |
| `community_wallets` | ארנק קהילתי (cashback) | community_id (PK), balance, total_earned, updated_at |
| `community_wallet_transactions` | עסקאות ארנק קהילתי | id, community_id, amount, type (cashback), reference_id, description |
| `community_bundles` | חבילות קהילתיות | id, community_id, name, price, items (JSONB) |
| `community_bundle_businesses` | עסקים בחבילה | bundle_id, business_id |
| `manager_zones` | אזורים של Zone Manager | id, manager_id → zone_managers, name, status |
| `zone_manager_commissions` | עמלות Zone Manager | id, manager_id, community_id, order_id, amount, commission_pct |
| `zone_manager_payments` | תשלומים ל-Zone Manager | id, manager_id, amount, payment_method, notes, paid_at |
| `zm_campaigns` | קמפיינים שיווקיים של ZM | id, zone_manager_id, title, subtitle, text_content, fields_config (JSONB), token (UNIQUE), status, image_url, campaign_type |
| `zm_campaign_leads` | לידים מקמפיין ZM | id, campaign_id, data (JSONB), ai_score, status, crm_notes |
| `zm_lead_actions` | פעולות על ליד ZM | id, lead_id, action_type, notes |
| `zm_inbox_threads` | שרשורי אינבוקס ZM | id, zone_manager_id, community_id, group_id, subject |
| `zm_inbox_messages` | הודעות אינבוקס ZM | id, thread_id, sender_type, sender_id, content, is_read |
| `zm_message_templates` | תבניות הודעה ZM | id, zone_manager_id, name, subject, content |

---

### 12. Tasks & Goals & Academy — משימות, מטרות וחינוך

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `tasks` | משימות משפחה/עסק | id, group_id, title, description, assigned_to, status, due_date, created_at |
| `goals` | מטרות חיסכון | id, group_id, name, target_amount, current_amount, deadline |
| `quiz_bundles` | חבילות שאלות (Academy) | id, group_id, name, questions (JSONB) |
| `quiz_questions` | שאלות בודדות | id, bundle_id, question, correct_answer, options (JSONB) |
| `games_catalog` | קטלוג משחקי ילדים | id, name, subject, age_min, age_max, url, thumbnail, is_active |
| `games_global_config` | הגדרות גלובליות משחקים | id, max_daily_games, flw_per_game |
| `game_assignments` | שיוך משחק לילד | id, family_group_id, child_user_id, game_id, rounds_total, rounds_used, flw_per_round, status, start_level, finance_age, level_progress (JSONB) |
| `game_sessions` | סשיאני משחק | id, child_user_id, game_id, score, flw_earned, duration_seconds, played_at |
| `kid_free_play_log` | לוג משחק חופשי לילד | id, child_user_id, game_id, played_date |
| `kid_quests` | חידונים לילדים | id, family_group_id, child_user_id, quest_lib_id, status, score, flw_earned |
| `kid_quest_questions` | שאלות חידון ילד | id, quest_id, question_text, correct_answer, options (JSONB) |
| `kid_quest_results` | תוצאות חידון | id, quest_id, submitted_at, score |
| `quest_library` | ספריית חידונים (SA) | id, title, subject, age_min, age_max, difficulty, flw_reward, pass_score, description, tags, is_public |
| `quest_library_questions` | שאלות בספריית חידונים | id, quest_id, question_text, correct_answer, options (JSONB), explanation |
| `quest_library_ratings` | דירוגי חידון | id, quest_id, group_id, rating |
| `quest_library_reports` | דיווחים על חידון | id, quest_id, group_id, reason |

---

### 13. Finance — כספים, תקציב, הלוואות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `transactions` | עסקאות כספיות | id, group_id, user_id, amount, category, description, month, is_recurring, end_month, is_manual, created_at |
| `budget_allocations` | הקצאות תקציב | id, group_id, category, amount, month, target_user_id |
| `loans` | הלוואות בין חברי קבוצה | id, group_id, lender_id, borrower_id, amount, status, created_at |
| `shopping_list` | רשימת קניות | id, group_id, name, quantity, category, units_per_package, is_done |
| `shopping_trip_items` | פריטי טיול קניות | id, trip_id, item_name, quantity, actual_price, units_per_package |
| `shopping_trips` | טיולי קניות | id, group_id, store_name, trip_date, total_spent |
| `saved_shopping_lists` | רשימות קניות שמורות | id, group_id, name, items (JSONB) |
| `pantry` | מחסן / מזווה | id, group_id, name, quantity, unit, category, min_quantity, units_per_package, reserved_qty |
| `time_clock` | שעון נוכחות | id, group_id, user_id, punch_in, punch_out, total_minutes |
| `team_chat` | צ'אט צוות פנימי | id, group_id, user_id, message, created_at |

---

### 14. FlowPool — פול קהילתי

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `flow_pools` | פולים קהילתיים | id, community_id, initiator_type (family/business), initiator_id, title, description, service_category, max_price, offer_price, min_families, status (open_r1/open_r2/closed/expired), winner_bid_id, expires_at |
| `flow_pool_members` | חברים בפול | pool_id + group_id (PK), joined_at |
| `flow_pool_bids` | הצעות מחיר בפול | id, pool_id, business_group_id, price, description, is_guest, status |
| `flow_pool_messages` | הודעות בפול | id, pool_id, sender_type, sender_id, content, created_at |
| `biz_pool_hidden` | פולים שעסק הסתיר | id, pool_id, biz_group_id, UNIQUE(pool_id, biz_group_id) |

---

### 15. Banner Ads — פרסומות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `banner_slots` | חריצי פרסומות | id, name, dimensions, position, is_active |
| `banner_pricing` | תמחור חריצי פרסומות | id, slot_id, duration_days, price |
| `banner_slot_communities` | קהילות לכל חריץ | slot_id, community_id |
| `banner_orders` | הזמנות פרסומת | id, business_id, slot_id, start_date, end_date, image_url, status, amount |
| `business_platform_dues` | חיובי עמלת פלטפורמה | id, business_id, order_id, order_amount, commission_pct, commission_amount, cashback_pct, cashback_amount, community_id, status |
| `business_platform_collections` | גביית עמלות מעסקים | id, business_id, amount, collected_at, notes |

---

### 16. Alerts & Notifications — התראות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `alert_rules` | חוקי התראה | id, group_id, name, trigger_type, trigger_config (JSONB), recipients (JSONB), channels (JSONB), cooldown_minutes, is_active |
| `alert_notifications` | התראות שנוצרו | id, group_id, rule_id, trigger_type, message, is_read, reference_key, created_at |
| `sla_configs` | הגדרות SLA לפי מודול | id, group_id, module, status, status_label, max_hours, channels (JSONB), is_active |
| `activity_log` | לוג פעילות (Bell Feed) | id, group_id, user_id, user_name, action_type, action_key, description, created_at |
| `inbox_messages` | הודעות אינבוקס | id, group_id, sender_type, sender_name, sender_contact, subject, content, is_read, direction, customer_group_id, customer_phone, created_at |
| `internal_messages` | הודעות פנימיות (סופר אדמין) | id, ... |
| `message_acknowledgments` | אישורי קריאת הודעות | id, ... |

---

### 17. Super Admin — ניהול מערכת

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `sa_audit_log` | לוג ביקורת פעולות SA | id, admin_email, action, details (JSONB), created_at |
| `sa_internal_chat` | צ'אט פנימי SA | id, room, sender_name, sender_id, message, created_at |
| `sa_product_book` | ספר מוצר | id, module_name, title, description, status, original_ticket_id |
| `sa_product_matrix` | מטריצת בדיקות מוצר | id, environment, module_name, scenario_name, expected_result, status, last_tested_at |
| `sa_dev_tasks` | משימות פיתוח | id, title, type, priority, status, description, environment, module_name, target_version, assigned_developer, version_id, owner_id, original_ticket_id, group_id |
| `sa_dev_sub_tasks` | תתי-משימות פיתוח | id, task_id, title, is_done, updated_at |
| `sa_versions` | גרסאות מוצר | id, name, target_date, status |
| `sa_qa_runs` | ריצות QA | id, version_id, tester_name, results (JSONB), status |
| `sa_qa_test_results` | תוצאות בדיקות QA | id, test_id, env, status, note, UNIQUE(test_id, env) |
| `qa_task_assignments` | שיוך משימות QA | task_id (PK), data (JSONB), updated_at |
| `support_tickets` | כרטיסי תמיכה | id, group_id, user_id, subject, description, status, priority, ticket_type, assigned_to, assigned_team, log (JSONB) |
| `pilot_waitlist` | רשימת המתנה לפיילוט | id, name, email, phone, business_type, status, created_at |
| `system_settings` | הגדרות מערכת גלובליות | key (PK), value, updated_at |
| `ai_usage_log` | לוג שימוש ב-AI | id, group_id, endpoint, created_at |
| `page_images` | תמונות לדפים | id, page, slot, image_url, is_active |
| `group_snapshots` | Snapshots של קבוצות | id, group_id, snapshot_data (JSONB), version_label, created_at |

---

### 18. Equipment & Service Calls — ציוד וקריאות שירות

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `equipment_items` | פריטי ציוד | id, group_id, name, category, serial_number, purchase_date, warranty_expiry, status, technician_id |
| `equipment_maintenance` | אחזקה מתוכננת/שבוצעה | id, equipment_id, group_id, maintenance_type, description, scheduled_date, completed_date, status, cost, interval_days |
| `equipment_faults` | תקלות ציוד | id, equipment_id, group_id, title, description, severity, status, technician_id, scheduled_date, resolved_date |
| `equipment_fault_notes` | הערות לתקלה | id, fault_id, group_id, note, status_from, status_to |
| `equipment_technicians` | טכנאים | id, group_id, name, company_name, phone, email, specialty, business_group_id, oneflow_verified |
| `service_calls` | קריאות שירות (משפחה ↔ עסק) | id, family_group_id, business_group_id, technician_contact_id, title, description, address, photos (JSONB), status, priority, scheduled_at, price_quote, discount_pct, community_discount, payment_status, rating, call_type |
| `service_call_messages` | הודעות בקריאת שירות | id, call_id, sender_type, sender_name, message |
| `service_call_notes` | הערות לקריאת שירות | id, call_id, author_name, note |

---

### 19. Suppliers & B2B — ספקים ומסחר בין עסקים

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `suppliers` | ספקים | id, group_id, name, contact, phone, email, customer_number |
| `supplier_products` | מוצרי ספק | id, supplier_id, name, sku, price, unit, catalog_id |
| `supplier_product_catalog_links` | קישור מוצר ספק ↔ קטלוג חנות | id, supplier_product_id, catalog_id, qty_per_unit, UNIQUE |
| `global_products` | מוצרים גלובליים (SA) | id, name, category, barcode, image_url |

---

### 20. Surveys & Calendar — סקרים ויומן

| טבלה | תיאור | שדות מרכזיים |
|---|---|---|
| `surveys` | סקרים | id, group_id, title, description, status, unique_code (UNIQUE), required_fields (JSONB), anonymous, closed_at |
| `survey_questions` | שאלות סקר | id, survey_id, order_index, type, question_text, options (JSONB), required |
| `survey_responses` | תשובות לסקר | id, survey_id, respondent_data (JSONB), answers (JSONB), comment, submitted_at |
| `calendar_settings` | הגדרות יומן תורים | group_id (PK), is_active, open_time, close_time, interval_mins |
| `calendar_services` | שירותי יומן | id, group_id, name, duration_mins, price |
| `calendar_events` | אירועי יומן / תורים | id, group_id, service_id, title, customer_phone, customer_name, customer_group_id, event_date, start_time, status, work_order_id, call_type, num_guests, preferred_practitioner_id, reserved_table_number |
| `payment_confirmations` | אישורי תשלום | id, ... |

---

## מפת יחסים מרכזית

```
family_groups (1) ←→ (N) users
family_groups (1) ←→ (1) store_settings
family_groups (1) ←→ (N) store_orders ← store_order_items
store_orders (1) ←→ (N) work_order_assignees
store_orders (1) ←→ (N) work_order_inventory → store_catalog
store_orders (1) ←→ (N) work_order_payments
communities (N) ←→ (N) family_groups [via family_communities]
communities (N) ←→ (N) family_groups [via community_businesses]
zone_managers (1) ←→ (N) manager_zones → communities
flow_pools → communities
flow_pool_bids → flow_pools + family_groups
```
