#!/usr/bin/env python3
# Generates s1-erd.html (HTML fragment) — conceptual domain model derived from schema2.json
import json, re, html, collections
SP = '/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec/'
S = json.load(open(SP + 'schema2.json'))
S.pop('מחוץ', None)

def esc(t): return html.escape(str(t), quote=False)
def rich(t):
    t = esc(t)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', t)

def cl(table):  # create line
    t = S[table]
    return t['creates'][0] if t['creates'] else None

def cite(table):
    l = cl(table)
    return f'server.js:{l}' if l else 'לא נוצרת'

def ref_of(ty):
    m = re.search(r'REFERENCES\s+(\w+)', ty, re.I)
    return m.group(1).lower() if m else None

def mtype(ty):
    u = ty.upper()
    if '[]' in u: return 'array'
    for k, v in [('SERIAL', 'int'), ('BIGINT', 'int'), ('INTEGER', 'int'), ('INT', 'int'), ('DECIMAL', 'numeric'), ('NUMERIC', 'numeric'),
                 ('DOUBLE', 'numeric'), ('REAL', 'numeric'), ('FLOAT', 'numeric'), ('TIMESTAMP', 'timestamp'), ('DATE', 'date'),
                 ('TIME', 'time'), ('BOOL', 'bool'), ('JSON', 'jsonb'), ('UUID', 'uuid')]:
        if u.startswith(k) or (' ' + k) in (' ' + u.split('(')[0]): return v
    if u.startswith('DYN'): return 'text'
    return 'text'

def pk_cols(table):
    t = S[table]
    pks = [c for c, (ty, l, k) in t['cols'].items() if 'PRIMARY KEY' in ty.upper()]
    for c in t['constraints']:
        m = re.match(r'PRIMARY KEY\s*\(([^)]*)\)', c, re.I)
        if m: pks += [x.strip().lower() for x in m.group(1).split(',')]
    return list(dict.fromkeys(pks))

def unique_single(table, col):
    t = S[table]
    if 'UNIQUE' in t['cols'].get(col, ('', 0, 0))[0].upper(): return True
    for c in t['constraints']:
        m = re.match(r'UNIQUE\s*\(([^)]*)\)', c, re.I)
        if m and [x.strip().lower() for x in m.group(1).split(',')] == [col]: return True
    return False

STATUSRE = re.compile(r'(^|_)status$|^is_active$|^account_status$|^approval_status$|^biz_post_status$|^payment_status$|^quote_status$|^internal_status$|^customer_status$')

def lifecycle(table, extra=None):
    out = []
    for c, (ty, l, k) in S[table]['cols'].items():
        if STATUSRE.search(c):
            d = re.search(r"DEFAULT\s+('[^']*'|[A-Za-z0-9_]+)", ty, re.I)
            ck = re.search(r"CHECK\s*\(\s*\w+\s+IN\s*\(([^)]*)\)", ty, re.I)
            s = f'{c}'
            if d: s += f' (ברירת מחדל {d.group(1)})'
            if ck: s += ' ∈ {' + re.sub(r"\s+", '', ck.group(1)).replace("'", '') + '}'
            s += f' [server.js:{l}]'
            out.append(s)
    if extra: out.append(extra)
    return '; '.join(out) if out else '—'

# ---------- registry ----------
ENT = collections.OrderedDict()   # name -> dict
def E(name, table, notes='', keys=(), logical=(), extra_tables=(), cls='ליבה', life=None, missing=()):
    return dict(name=name, table=table, notes=notes, keys=list(keys), logical=list(logical),
                extra_tables=list(extra_tables), cls=cls, life=life, missing=list(missing))

DOMAINS = []
def D(key, title, kw, intro, diagrams, ents):
    for e in ents:
        e['domain'] = key
        ENT[e['name']] = e
    DOMAINS.append(dict(key=key, title=title, kw=kw, intro=intro, diagrams=diagrams, ents=ents))

TABLE2ENT = {}
def build_maps():
    for n, e in ENT.items():
        TABLE2ENT.setdefault(e['table'], n)

# missing columns used by code (verified heuristically; see section)
MISSING = {
 'alert_notifications': [('type', 25703), ('title', 25703), ('reference_id', 25703)],
 'author_profiles': [('community_id', 45851), ('pen_name', 40298), ('status', 45305)],
 'banner_orders': [('total_price', 9335)],
 'beauty_client_records': [('full_name', 7205), ('phone', 7205), ('email', 7205), ('notes', 7205)],
 'billing_records': [('record_type', 9277), ('reference_id', 9277)],
 'community_promotions': [('biz_code', 8021)],
 'content_categories': [('icon', 41772)],
 'content_reports': [('reporter_group_id', 45947)],
 'content_shares_log': [('shared_at', 44870)],
 'content_tags': [('slug', 45068)],
 'family_groups': [('logo_url', 37121)],
 'flow_pool_bids': [('created_at', 34305)],
 'flow_transactions': [('community_id', 36086)],
 'sport_class_registrations': [('status', 43660)],
 'sport_membership_types': [('updated_at', 29286)],
 'sport_memberships': [('business_group_id', 31897), ('member_group_id', 31897), ('plan_type_id', 31896)],
 'sport_trainers': [('full_name', 43682)],
 'store_promotions': [('min_order', 5533)],
 'system_settings': [('description', 41833)],
 'tasks': [('assignee_id', 4560)],
 'users': [('created_at', 7163), ('full_name', 4560), ('name', 27789)],
 'zone_managers': [('total_commissions', 9266), ('total_paid', 9266)],
}

# ===================== DOMAINS =====================
D('identity', 'זהות ודיירות (Identity &amp; tenancy)', 'identity tenancy family_groups users sessions otp storefront member links',
  'ישות-העל היא `family_groups` — שורה אחת לכל "סביבה" (משפחה, עסק, חשבון חבר/קונה). כל הנתונים התפעוליים תלויים ב-`group_id` שלה. ראו גם את הסעיף "מושג הדיירות המרכזי" למעלה.',
  [('זהות, סשנים וקישורי משפחה↔עסק', ['TenantGroup', 'AppUser', 'FamilySession', 'BusinessOtp', 'BizPasswordReset', 'FamilyPasswordReset',
     'StorefrontCustomer', 'StorefrontOtp', 'StorefrontSession', 'StorefrontSsoToken', 'MemberBusinessLink', 'FamilyBusinessVisit', 'FamilyLinkRequest', 'SaSession'])],
  [
   E('TenantGroup', 'family_groups', 'סביבה (tenant). `type` ∈ {FAMILY, BUSINESS} (ברירת מחדל FAMILY, server.js:6453); `member_type` (family/member/shopper/biz, server.js:1879); `business_type` (ברירת מחדל other, server.js:1175). כפילויות פנימיות: `location_lat/lng` (791) מול `lat/lng` (8357); `is_premium` מול `plan`; חמישה שדות JSONB של הרשאות מודולים: `features` (817), `licensed_features` (1176), `billing_config` (815), `managed_modules` (1949), `unlocked_modules` (1893). `community_id` (6453) הוא שיוך קהילה יחיד ישן — המודל החדש הוא `family_communities`. `UNIQUE(admin_email,type)` (6453).',
     keys=['type', 'member_type', 'business_type', 'plan', 'group_code', 'admin_email', 'managed_modules', 'is_deleted', 'is_test_env'],
     logical=[('community_id', 'Community'), ('created_by_business_group_id', 'TenantGroup')],
     life='account_status ערכים בקוד: active/frozen/pending_activation/archived (server.js:2597, 30977, 36633); is_deleted/deleted_at (3029-3030) — מחיקה רכה; wizard_completed (1952) לעסקים'),
   E('AppUser', 'users', 'משתמש בתוך סביבה (בן משפחה / עובד / מנהל עסק). `role` ∈ ADMIN/MEMBER/CHILD (+SENIOR/MANAGER בעסק — business-app.js:1989-1992). `balance` הוא מטמון מצטבר שמתעדכן ידנית עם כל תנועה (server.js:11402-11403) — לא מחושב מ-`transactions`. `permissions` JSONB (734) מחזיק טאבים והרשאות קהילה. עובד = user בסביבת BUSINESS; אין טבלת `employees` (ראו טבלאות-רפאים).',
     keys=['role', 'nickname', 'phone', 'email', 'balance', 'permissions', 'employee_role_type', 'base_salary'],
     life='status (ברירת מחדל pending) ערכים בקוד: invited/pending/active (server.js:6467, 7757)'),
   E('FamilySession', 'family_sessions', 'סשן אחיד למשפחה ולעסק; `session_type` ∈ family/biz נקבע לפי `family_groups.type` בכניסה (server.js:10706). `token_hash` הוא מפתח.', keys=['session_type', 'expires_at', 'device_hint']),
   E('BusinessOtp', 'business_otp', 'קודי OTP לעסק ולמשפחה (purpose מבחין). ללא FK. לא מנוקה ע"י הקרון היומי (ראו rules-auth).', keys=['phone', 'purpose', 'expires_at', 'attempts', 'channel'], cls='טכני'),
   E('BizPasswordReset', 'biz_password_resets', 'טוקן איפוס סיסמת עסק (hash).', keys=['token_hash', 'expires_at', 'used'], cls='טכני'),
   E('FamilyPasswordReset', 'family_password_resets', 'טוקן איפוס סיסמת מנהל משפחה (hash).', keys=['token_hash', 'expires_at', 'used'], cls='טכני'),
   E('StorefrontCustomer', 'storefront_customers', 'לקוח קצה של חנויות (sc-auth), חוצה-עסקים, מזוהה בטלפון; `family_group_id` מקשר לסביבת משפחה (shopper) שנוצרת ב-SSO (server.js:7351, 43327). חופף מושגית ל-`store_customers` (CRM פר-עסק).', keys=['phone', 'first_name', 'last_name', 'pin_hash']),
   E('StorefrontOtp', 'storefront_otp', 'OTP ללקוח חנות. ללא FK.', keys=['phone', 'purpose', 'expires_at', 'used'], cls='טכני'),
   E('StorefrontSession', 'storefront_sessions', 'סשן לקוח חנות, תפוגה מתגלגלת 30 יום (ראו rules-auth).', keys=['token', 'expires_at', 'last_activity'], cls='טכני'),
   E('StorefrontSsoToken', 'storefront_sso_tokens', 'טוקן חד-פעמי חנות→אפליקציית משפחה. `family_group_id` ללא FK.', keys=['token', 'used', 'expires_at'], logical=[('family_group_id', 'TenantGroup')], cls='טכני'),
   E('MemberBusinessLink', 'member_business_links', 'קשר M:N בין סביבת משפחה/חבר (`member_group_id`) לעסק (`business_group_id`), עם `business_type` מועתק (denormalized). נוצר בקישור לקוח WEFLOWZ (server.js:14987) ובחשבון SOLO שהעסק יוצר (30976).', keys=['business_type', 'linked_member_ref_id', 'is_active'],
     life='status (ברירת מחדל active) ערכים בקוד: pending/active/rejected (server.js:2480, 7435)'),
   E('FamilyBusinessVisit', 'family_business_visits', 'מונה ביקורים משפחה→עסק (UNIQUE זוג).', keys=['visit_count', 'last_visited_at'], cls='מטמון/סטטיסטיקה'),
   E('FamilyLinkRequest', 'family_link_requests', 'בקשת קישור/מיזוג בין שתי סביבות.', keys=['role']),
   E('SaSession', 'sa_sessions', 'סשן Super Admin; טוקן גולמי ללא user_id (server.js:568).', keys=['token', 'expires_at'], cls='טכני'),
  ])

D('finance', 'כספים משפחתיים (Family finance)', 'finance transactions budget goals loans balance cashflow',
  'אותן טבלאות משמשות גם כ"תזרים" של עסק: `logBizIncome`/`logBizExpense` כותבים ל-`transactions` עם `group_id` של העסק ו-`user_id` של ה-ADMIN (server.js:4201-4224).',
  [('תנועות, תקציבים, יעדים והלוואות', ['TenantGroup', 'AppUser', 'Transaction', 'BudgetAllocation', 'Goal', 'Loan', 'FamilyAuditLog'])],
  [
   E('Transaction', 'transactions', 'תנועת הכנסה/הוצאה. משמשת גם לתזרים עסקי (category=sales, is_manual=FALSE — server.js:4206). כל יצירה/עריכה/מחיקה מעדכנת ידנית את `users.balance` (11402, 11425, 11446). הטבלה `cashflow_entries` שבה הקוד מנסה לסכם הכנסות (28976) אינה קיימת — התזרים האמיתי הוא כאן.', keys=['amount', 'type', 'category', 'date', 'is_recurring', 'payment_method', 'is_manual'],
     life='אין סטטוס; type ∈ income/expense בקוד (server.js:4206, 4218)'),
   E('BudgetAllocation', 'budget_allocations', 'תקרת תקציב לקטגוריה (ולמשתמש יעד). UNIQUE(group_id,category,target_user_id) (6474).', keys=['category', 'amount_limit']),
   E('Goal', 'goals', 'יעד חיסכון. אין `group_id` — הסביבה נגזרת דרך `user_id`.', keys=['title', 'target_amount', 'current_amount']),
   E('Loan', 'loans', 'הלוואה/מקדמה לבן משפחה.', keys=['original_amount', 'remaining_amount', 'reason']),
   E('FamilyAuditLog', 'family_audit_log', 'יומן התאמות יתרה ידניות. ללא FK כלל (517).', keys=['action', 'amount', 'extra_type', 'reason'], logical=[('group_id', 'TenantGroup'), ('target_user_id', 'AppUser')], cls='יומן'),
  ])

D('tasks', 'משימות ושגרות (Tasks / Routines)', 'tasks routines occurrences evidence approval sites contracts calendar work order',
  'משימה (`tasks`) משמשת גם למשמרות עסקיות: משמרת = task שכותרתו `SHIFT|date|…` (server.js:4560; rules-biz). מודול השגרות מוגבל ל-restaurant/maintenance_repair (CHECK ב-server.js:3632; public/business-app.js:37895).',
  [('משימות', ['TenantGroup', 'AppUser', 'Task', 'TaskComment', 'TaskSetTemplate', 'ShiftTemplate']),
   ('שגרות (Routines)', ['TenantGroup', 'AppUser', 'RoutineSite', 'RoutineFacility', 'RoutineItem', 'ServiceContract', 'Routine', 'RoutineOccurrence',
     'RoutineEvidence', 'RoutineApprovalRound', 'RoutineEventLog', 'RoutineDocument', 'Task', 'CalendarEvent', 'StoreOrder'])],
  [
   E('Task', 'tasks', 'משימה עם תגמול כספי (`reward`) ו-proof תמונה. גם משמרת (`SHIFT|…`). הקוד משתמש ב-`t.assignee_id` (server.js:4560) — העמודה האמיתית היא `assigned_to`.', keys=['title', 'reward', 'deadline', 'is_recurring', 'priority'],
     life='status (ברירת מחדל pending) [server.js:6473]'),
   E('TaskComment', 'task_comments', 'תגובה על משימה.', keys=['text'], cls='צאצא'),
   E('TaskSetTemplate', 'task_set_templates', 'תבנית סט משימות כ-JSONB (`data`) עם `client_id` מצד הלקוח.', keys=['client_id', 'data'], cls='תצורה'),
   E('ShiftTemplate', 'shift_templates', 'תבנית משמרת (שעות). `group_id` ללא FK (719).', keys=['name', 'start_time', 'end_time'], logical=[('group_id', 'TenantGroup')], cls='תצורה'),
   E('RoutineSite', 'routine_sites', 'אתר (של לקוח או פנימי). `customer_id` ללא FK ולא מקושר ל-CRM (rules-routines).', keys=['name', 'address', 'is_internal', 'customer_id']),
   E('RoutineFacility', 'routine_facilities', 'מתקן באתר.', keys=['name', 'facility_type'], cls='צאצא'),
   E('RoutineItem', 'routine_items', 'פריט במתקן.', keys=['name', 'serial_number', 'install_date'], cls='צאצא'),
   E('ServiceContract', 'routine_service_contracts', 'חוזה שירות (maintenance_repair).', keys=['billing_model', 'subscription_amount', 'visits_included_per_year', 'start_date', 'end_date']),
   E('Routine', 'routines', 'הגדרת שגרה: יעד (`target_level`), תדירות, אחראי, ראיות נדרשות, אישורים, ו-`output_type` שקובע מה נוצר בהפעלת מופע (task / task_calendar / work_order_template).', keys=['business_type', 'name', 'target_level', 'output_type', 'frequency_type', 'assignee_user_id', 'customer_id']),
   E('RoutineOccurrence', 'routine_occurrences', 'מופע מתוזמן. בהפעלה נוצרים task / calendar_event / store_orders(work_order) ונשמרים ב-`linked_*` (server.js:6960-6999). שדות `linked_*` ללא FK.', keys=['scheduled_date', 'grace_deadline', 'assignee_user_id', 'exception_flag'],
     logical=[('linked_task_id', 'Task'), ('linked_calendar_event_id', 'CalendarEvent'), ('linked_work_order_id', 'StoreOrder')]),
   E('RoutineEvidence', 'routine_evidence', 'ראיה לביצוע (ערך מספרי, checklist, תמונה, מסמך).', keys=['evidence_type', 'numeric_value', 'is_out_of_range', 'document_expiry_date'], cls='צאצא'),
   E('RoutineApprovalRound', 'routine_approval_rounds', 'סבב אישור פנימי + לקוח (עם `confirm_token` לקישור ציבורי).', keys=['round_number', 'confirm_token'], cls='צאצא'),
   E('RoutineEventLog', 'routine_event_log', 'ציר זמן אירועים לשגרה/מופע.', keys=['event_type', 'actor_type', 'channel'], cls='יומן'),
   E('RoutineDocument', 'routine_documents', 'מסמך מופק (דו"ח מופע/תקופה/תיק אתר) עם `view_token` ציבורי.', keys=['document_type', 'exposure_level', 'view_token', 'sent_channel']),
  ])

D('shopping', 'קניות ומזווה (Shopping / Pantry)', 'shopping list trips pantry inventory saved lists',
  '`pantry` משמש גם כמחסן חומרי גלם של עסק: ניכוי אוטומטי לפי מתכוני Food Cost (server.js:22269-22310) ושריון לפקודת עבודה (`work_order_inventory.pantry_id`, 1437).',
  [('קניות ומזווה', ['TenantGroup', 'AppUser', 'ShoppingListItem', 'ShoppingTrip', 'ShoppingTripItem', 'PantryItem', 'SavedShoppingList', 'ProductCategoryMap', 'GlobalProduct', 'WorkOrderInventory'])],
  [
   E('ShoppingListItem', 'shopping_list', 'פריט ברשימת קניות פעילה.', keys=['item_name', 'normalized_name', 'quantity', 'unit', 'estimated_price'], life='status (ברירת מחדל pending) [server.js:6477]'),
   E('ShoppingTrip', 'shopping_trips', 'סבב קנייה שבוצע (קבלה).', keys=['store_name', 'total_amount', 'trip_date']),
   E('ShoppingTripItem', 'shopping_trip_items', 'שורת קבלה; משמשת גם כמקור מחירים ל-Food Cost (server.js:16408).', keys=['item_name', 'normalized_name', 'price_per_unit'], cls='צאצא'),
   E('PantryItem', 'pantry', 'פריט מזווה/מחסן; `reserved_qty` לשריון פקודות עבודה.', keys=['item_name', 'quantity', 'unit', 'reserved_qty']),
   E('SavedShoppingList', 'saved_shopping_lists', 'רשימה שמורה כ-JSON (`items`). בנוסף `family_groups.shop_session_list_id` (958) מצביע עליה ללא FK.', keys=['name', 'items'], cls='תצורה'),
   E('ProductCategoryMap', 'product_category_map', 'מטמון סיווג שם מנורמל→קטגוריה לכל סביבה.', keys=['normalized_name', 'category'], cls='מטמון/סטטיסטיקה'),
   E('GlobalProduct', 'global_products', 'קטלוג ברקודים גלובלי — נוצר ב-/setup-db ואין אליו אף שאילתה.', keys=['barcode', 'name', 'category'], cls='לא בשימוש'),
  ])

D('kids', 'ילדים, אקדמיה ו-FLW (Kids / FLW)', 'kids flw academy quiz games quests wallet library',
  'כל הישויות תלויות ב-`users` מסוג CHILD (`child_user_id`) וב-`family_groups` (`family_group_id`). FLW הוא מטבע-ילד נפרד מ-FLOW הקהילתי.',
  [('אקדמיה, משחקים וארנק FLW', ['TenantGroup', 'AppUser', 'QuizBundle', 'QuizQuestion', 'UserAssignment', 'GameCatalog', 'GamesGlobalConfig', 'GameSession', 'GameAssignment', 'KidFreePlayLog', 'KidWallet', 'KidConfig', 'KidRedeemRequest']),
   ('משימות לימוד (Quests) וספרייה', ['TenantGroup', 'AppUser', 'KidQuest', 'KidQuestQuestion', 'KidQuestResult', 'QuestLibrary', 'QuestLibraryQuestion', 'QuestLibraryRating', 'QuestLibraryReport'])],
  [
   E('QuizBundle', 'quiz_bundles', 'חבילת חידון/קריאה (אקדמיה ישנה) — גלובלית, ללא group_id.', keys=['type', 'age_group', 'title', 'threshold', 'reward'], cls='לגאסי'),
   E('QuizQuestion', 'quiz_questions', 'שאלה בחבילה.', keys=['q', 'options', 'correct'], cls='צאצא'),
   E('UserAssignment', 'user_assignments', 'שיוך חבילה לילד.', keys=['score', 'custom_reward', 'deadline'], life='status (ברירת מחדל assigned) [server.js:6484]'),
   E('GameCatalog', 'games_catalog', 'קטלוג משחקים גלובלי (קבצי HTML).', keys=['title', 'subject', 'flw_reward', 'file_path', 'is_active']),
   E('GamesGlobalConfig', 'games_global_config', 'הגדרת דמות ברירת מחדל גלובלית (שורה יחידה).', keys=['default_character_url'], cls='תצורה'),
   E('GameSession', 'game_sessions', 'משחק שהושלם + FLW שהורווח.', keys=['score', 'flw_earned', 'duration_seconds'], cls='יומן'),
   E('GameAssignment', 'game_assignments', 'משחק שהורה שייך לילד עם מכסת סבבים.', keys=['rounds_total', 'rounds_used', 'flw_per_round', 'expires_at']),
   E('KidFreePlayLog', 'kid_free_play_log', 'מגבלת משחק חופשי יומי (UNIQUE ילד/משחק/יום).', keys=['played_date'], logical=[('game_id', 'GameCatalog')], cls='יומן'),
   E('KidWallet', 'flw_kid_wallets', 'ארנק FLW של ילד (1:1 — UNIQUE child_user_id).', keys=['balance_flw', 'lifetime_flw', 'redeemed_flw']),
   E('KidConfig', 'flw_kid_config', 'הגדרות FLW לילד (שער המרה, תקרה יומית).', keys=['flw_value_ils', 'max_daily_flw', 'auto_approve'], cls='תצורה'),
   E('KidRedeemRequest', 'flw_kid_redeem_requests', 'בקשת המרת FLW לכסף.', keys=['flw_amount', 'approved_at']),
   E('KidQuest', 'kid_quests', 'משימת לימוד שהורה יוצר (אפשר מתוך ספרייה).', keys=['title', 'subject', 'flw_reward', 'pass_score', 'due_date']),
   E('KidQuestQuestion', 'kid_quest_questions', 'שאלה במשימה.', keys=['question_text', 'answer_type', 'correct_answer'], cls='צאצא'),
   E('KidQuestResult', 'kid_quest_results', 'תוצאת ילד.', keys=['score', 'flw_earned', 'completed_at'], cls='צאצא'),
   E('QuestLibrary', 'quest_library', 'ספריית משימות משותפת. `community_id` מוגדר REFERENCES family_groups (server.js:3291) — לא ל-communities — ואינו נשאל בקוד.', keys=['title', 'visibility', 'use_count', 'rating_avg', 'is_hidden', 'is_featured']),
   E('QuestLibraryQuestion', 'quest_library_questions', 'שאלה בספרייה.', keys=['question_text', 'answer_type'], cls='צאצא'),
   E('QuestLibraryRating', 'quest_library_ratings', 'דירוג (UNIQUE quest/user).', keys=['rating'], cls='קישור'),
   E('QuestLibraryReport', 'quest_library_reports', 'דיווח על משימה.', keys=['reason'], cls='קישור'),
  ])

D('bizcore', 'ליבת עסק ו-HR (Business core / HR)', 'business hr time clock payroll register calendar crm inbox chat alerts sla surveys whatsapp',
  'עובד = `users` בסביבת BUSINESS. נוכחות ב-`time_clock`; משמרת = `tasks`; שכר משולם דרך `time_clock.paid_at` ו-`transactions`. היומן (`calendar_events`) משרת שירותים, הזמנות שולחן (`call_type=table_reservation`) ושגרות.',
  [('צוות ופעילות פנימית', ['TenantGroup', 'AppUser', 'TimeClock', 'RegisterSession', 'TeamChat', 'TeamPost', 'BizDm', 'ActivityLog', 'BizAuditLog', 'AlertRule', 'AlertNotification', 'SlaConfig', 'WhatsappSettings', 'WhatsappLog', 'DashboardMetric']),
   ('לקוחות, יומן ותקשורת', ['TenantGroup', 'AppUser', 'StoreCustomer', 'CalendarSettings', 'CalendarService', 'CalendarEvent', 'InboxMessage', 'CustomerChat', 'CustomerChatMessage', 'StorefrontCustomer', 'Survey', 'SurveyQuestion', 'SurveyResponse', 'StoreOrder'])],
  [
   E('TimeClock', 'time_clock', 'החתמת כניסה/יציאה עם GPS; `paid_at` מסמן ששולם שכר.', keys=['punch_in', 'punch_out', 'total_minutes', 'paid_at']),
   E('RegisterSession', 'register_sessions', 'פתיחת/סגירת קופה (POS) עם הפרש מזומן. ללא FK.', keys=['session_date', 'open_float', 'expected_cash', 'actual_cash', 'diff'], logical=[('group_id', 'TenantGroup'), ('user_id', 'AppUser')]),
   E('TeamChat', 'team_chat', 'צ\'אט צוות. חופף ל-`team_posts` (לוח הודעות) — שני ערוצים מקבילים.', keys=['message'], cls='כפילות'),
   E('TeamPost', 'team_posts', 'לוח הודעות צוות (author_name מועתק).', keys=['author_name', 'message'], cls='כפילות'),
   E('BizDm', 'biz_dm_messages', 'הודעה ישירה עובד↔עובד. ללא FK.', keys=['body', 'read_at'], logical=[('group_id', 'TenantGroup'), ('from_user_id', 'AppUser'), ('to_user_id', 'AppUser')]),
   E('ActivityLog', 'activity_log', 'יומן פעילות משתמשים. חופף ל-`biz_audit_log`.', keys=['action_type', 'action_key', 'description'], cls='יומן'),
   E('BizAuditLog', 'biz_audit_log', 'יומן ביקורת ישויות (entity_type/entity_id).', keys=['action_type', 'entity_type', 'entity_id'], cls='יומן'),
   E('AlertRule', 'alert_rules', 'חוק התראה (טריגר, נמענים, ערוצים, cooldown).', keys=['trigger_type', 'trigger_config', 'channels', 'cooldown_minutes'], cls='תצורה'),
   E('AlertNotification', 'alert_notifications', 'התראה בתוך האפליקציה; משמשת גם כהתראה למשפחה על קריאת שירות (server.js:25703) עם עמודות `type/title/reference_id` שאינן קיימות בטבלה.', keys=['trigger_type', 'message', 'is_read', 'reference_key']),
   E('SlaConfig', 'sla_configs', 'יעד SLA לסטטוס במודול (UNIQUE group/module/status).', keys=['module', 'status', 'max_hours'], cls='תצורה'),
   E('WhatsappSettings', 'whatsapp_settings', 'הגדרות WhatsApp לעסק. עמודות כפולות לאותו מושג: `notify_owner_checkin` מול `owner_checkin` מול `ov_owner_checkin` (override, server.js:4473-4476) ועוד `tpl_*` (4477-4480).', keys=['enabled', 'phone_owner', 'phone_employee'], cls='תצורה'),
   E('WhatsappLog', 'whatsapp_log', 'לוג שליחות; נכתב רק ב-services/whatsapp.js:70. עמודות כפולות: `recipient_phone`/`phone`, `content`/`message_body`.', keys=['message_type', 'recipient_type', 'phone', 'status'], cls='יומן'),
   E('DashboardMetric', 'dashboard_metric_history', 'היסטוריית מדדי דשבורד יומית (PK group/metric/date).', keys=['metric_key', 'stat_date', 'value'], logical=[('group_id', 'TenantGroup')], cls='מטמון/סטטיסטיקה'),
   E('StoreCustomer', 'store_customers', 'CRM פר-עסק. `group_id` = העסק (ללא FK, 708); `family_group_id` (1242) מקשר ללקוח WEFLOWZ; `business_id` ללקוח עסקי (B2B); `credit_balance` (1244). אחת מחמש טבלאות "לקוח" מקבילות (ראו כפילויות).', keys=['name', 'phone', 'email', 'company_name', 'credit_balance'],
     logical=[('group_id', 'TenantGroup'), ('family_group_id', 'TenantGroup')]),
   E('CalendarSettings', 'calendar_settings', 'שעות פעילות, מרווח, חלון ביטול (PK=group_id).', keys=['open_time', 'close_time', 'interval_mins', 'cancellation_hours'], cls='תצורה'),
   E('CalendarService', 'calendar_services', 'שירות ביומן (משך/מחיר).', keys=['name', 'duration_mins', 'price']),
   E('CalendarEvent', 'calendar_events', 'אירוע/תור ביומן העסק. `call_type`=table_reservation להזמנת שולחן (server.js:2423, 23091); `customer_group_id` = משפחת הלקוח; `work_order_id` לזימון מפקודה.', keys=['event_date', 'start_time', 'call_type', 'customer_phone', 'num_guests', 'reserved_table_number', 'attendees_user_ids'],
     life='status (ברירת מחדל pending) ערכים בקוד: pending/approved/confirmed/rejected/cancelled_by_customer [server.js:1039]'),
   E('InboxMessage', 'inbox_messages', 'תיבת פניות של העסק (נכנס/יוצא). חופף ל-customer_chats.', keys=['sender_type', 'subject', 'direction', 'is_read']),
   E('CustomerChat', 'customer_chats', 'שיחה עסק↔לקוח חנות (UNIQUE group/customer).', keys=['last_message_at']),
   E('CustomerChatMessage', 'customer_chat_messages', 'הודעה בשיחה.', keys=['sender_type', 'body', 'read_at'], cls='צאצא'),
   E('Survey', 'surveys', 'סקר עם `unique_code` ציבורי.', keys=['title', 'unique_code', 'anonymous'], life='status (ברירת מחדל draft) [server.js:1068]'),
   E('SurveyQuestion', 'survey_questions', 'שאלה בסקר.', keys=['type', 'question_text', 'options'], cls='צאצא'),
   E('SurveyResponse', 'survey_responses', 'תשובה (JSON).', keys=['respondent_data', 'answers'], cls='צאצא'),
  ])

D('store', 'חנות, הזמנות, הצעות מחיר ופקודות עבודה (Store / Orders / Quotes)', 'store catalog variants inventory orders quotes work orders promotions coupons delivery',
  '`store_orders` היא טבלה רב-תכליתית: הזמנה (call_type NULL), הצעת מחיר (status=quote + quote_status), ופקודת עבודה (call_type=work_order). המרת הצעה לפקודה מעדכנת את אותה שורה (server.js:15108).',
  [('קטלוג ומלאי', ['TenantGroup', 'StoreSettings', 'CatalogItem', 'ProductVariant', 'InventoryMovement', 'StockCount', 'StockCountItem', 'StoreReturn', 'StoreReturnItem', 'StoreOrder', 'Supplier']),
   ('הזמנה / הצעה / פקודת עבודה', ['TenantGroup', 'AppUser', 'StoreOrder', 'StoreOrderItem', 'CatalogItem', 'WorkOrderAssignee', 'WorkOrderInventory', 'WorkOrderMessage', 'WorkOrderQuoteLink',
     'WorkOrderTimeline', 'WorkOrderNotesHistory', 'WorkOrderPayment', 'WorkOrderEquipment', 'TimeLog', 'MenuTemplate', 'CommunityCampaign', 'ServiceCall', 'PantryItem', 'EquipmentItem']),
   ('שיווק חזית ומשלוחים', ['TenantGroup', 'StorePromotion', 'StoreCoupon', 'StoreRetailPromotion', 'DeliveryZone', 'RadiusDeliveryZone', 'StorePopup', 'SentNewsletter', 'BrandingContent', 'BusinessGallery'])],
  [
   E('StoreSettings', 'store_settings', 'הגדרות חנות/אתר (PK=group_id, 1:1 עם עסק): שעות, VAT, משלוח, תבנית, `sport_settings` JSON ועוד ~40 שדות.', keys=['is_active', 'store_type', 'store_alias', 'site_mode', 'delivery_fee', 'include_vat', 'template_id'], cls='תצורה'),
   E('CatalogItem', 'store_catalog', 'מוצר/מנה/שירות בקטלוג העסק. `supplier_id` ללא FK; `stock_quantity`/`reserved_qty` למלאי קמעונאי.', keys=['name', 'price', 'category', 'product_type', 'sku', 'barcode', 'cost_price', 'stock_quantity', 'has_variants'],
     logical=[('supplier_id', 'Supplier')], life='is_available (אין סטטוס)'),
   E('ProductVariant', 'store_product_variants', 'וריאציה (מידה/צבע) עם מלאי ומחיר דורס.', keys=['variant_name', 'attributes', 'sku', 'price_override', 'stock_quantity']),
   E('InventoryMovement', 'store_inventory_movements', 'תנועת מלאי (change_qty + reason).', keys=['change_qty', 'reason', 'reference_id'], cls='יומן'),
   E('StockCount', 'store_stock_counts', 'ספירת מלאי.', keys=['started_at', 'completed_at']),
   E('StockCountItem', 'store_stock_count_items', 'שורת ספירה (expected/counted/diff).', keys=['expected_qty', 'counted_qty', 'diff_qty'], cls='צאצא'),
   E('StoreReturn', 'store_returns', 'החזרה מול הזמנה מקורית.', keys=['refund_method', 'total_refund', 'restock']),
   E('StoreReturnItem', 'store_return_items', 'שורת החזרה; `catalog_id`/`variant_id` ללא FK.', keys=['qty', 'unit_price'], logical=[('catalog_id', 'CatalogItem')], cls='צאצא'),
   E('StoreOrder', 'store_orders', 'הזמנה / הצעת מחיר / פקודת עבודה (ראו מבוא). `items` JSON כפול ל-`store_order_items` (denormalized). `family_group_id` = משפחת הלקוח; `community_promo_id`/`campaign_id` לקהילה; `menu_template_id` לאירוע. `quote_history`, `wo_notes` שדות JSON/טקסט.', keys=['call_type', 'customer_name', 'customer_phone', 'total_amount', 'items', 'is_delivery', 'target_datetime', 'quote_number', 'confirm_token', 'order_source', 'is_event'],
     logical=[('family_group_id', 'TenantGroup'), ('community_promo_id', 'CommunityPromotion')],
     life='status (ברירת מחדל new) ערכים בקוד: new/pending_approval/processing/open/quote/delivered/completed (server.js:993, 15108, 14680); quote_status: waiting_customer/waiting_business/approved (+draft/sent לפי rules-store); payment_status (1517)'),
   E('StoreOrderItem', 'store_order_items', 'שורת הזמנה (מחיר בעת ההזמנה).', keys=['item_name', 'quantity', 'price_at_order'], cls='צאצא'),
   E('WorkOrderAssignee', 'work_order_assignees', 'שיוך עובד לפקודה + עלות שעה (UNIQUE wo/user).', keys=['hourly_rate', 'hours_worked', 'role_label'], cls='קישור'),
   E('WorkOrderInventory', 'work_order_inventory', 'שריון/שימוש במלאי לפקודה — מקטלוג או מ-pantry.', keys=['reserved_qty', 'used_qty', 'needed_qty', 'unit_price'], life='status (ברירת מחדל reserved) [server.js:1437]'),
   E('WorkOrderMessage', 'work_order_messages', 'שיח פנימי בפקודה.', keys=['message_text'], cls='צאצא'),
   E('WorkOrderQuoteLink', 'work_order_quote_links', 'קישור M:N פקודה↔הצעת מחיר — שני הצדדים הם `store_orders` (UNIQUE זוג).', keys=['linked_at'], cls='קישור'),
   E('WorkOrderTimeline', 'work_order_timeline', 'ציר זמן אירועים.', keys=['event_type', 'metadata'], cls='יומן'),
   E('WorkOrderNotesHistory', 'work_order_notes_history', 'היסטוריית הערות — נכתבת (server.js:27104) ואינה נקראת.', keys=['note_text'], cls='לא בשימוש'),
   E('WorkOrderPayment', 'work_order_payments', 'תחנת תשלום — לפקודה או לקריאת שירות (`service_call_id`).', keys=['milestone_name', 'amount', 'due_date', 'received_amount'], life='status (ברירת מחדל pending) ערכים בקוד: pending/received [server.js:1505]'),
   E('WorkOrderEquipment', 'work_order_equipment', 'שריון ציוד לפקודה/אירוע.', keys=['event_date', 'start_time', 'duration_minutes', 'cost'], life='status (ברירת מחדל reserved) [server.js:1537]'),
   E('TimeLog', 'time_logs', 'דיווח שעות לחיוב (מקצועי) עם `wo_id`. `group_id`/`user_id` ללא FK. חופף ל-time_clock.', keys=['minutes', 'hourly_rate', 'logged_date', 'is_billed', 'customer_name'], logical=[('group_id', 'TenantGroup'), ('user_id', 'AppUser')]),
   E('StorePromotion', 'store_promotions', 'מבצע חנות (באנר/טאב). `group_id` ללא FK. הקוד מכניס `min_order` שאינו קיים (server.js:5533).', keys=['title', 'promo_type', 'promo_value', 'target_type', 'start_date', 'end_date'], logical=[('group_id', 'TenantGroup')]),
   E('StoreCoupon', 'store_coupons', 'קופון הנחה. `group_id` ללא FK.', keys=['code', 'discount_pct', 'valid_until'], logical=[('group_id', 'TenantGroup')]),
   E('StoreRetailPromotion', 'store_retail_promotions', 'מבצעי קמעונאות — נוצרת (1343) ואין אליה שום שאילתה.', keys=['promo_type', 'scope', 'coupon_code'], cls='לא בשימוש'),
   E('DeliveryZone', 'delivery_zones', 'אזור משלוח בשם. מקביל ל-`biz_radius_delivery_zones`.', keys=['name', 'min_order', 'delivery_fee'], cls='כפילות'),
   E('RadiusDeliveryZone', 'biz_radius_delivery_zones', 'מעגל משלוח לפי רדיוס (UNIQUE group/radius).', keys=['radius_km', 'delivery_fee'], cls='כפילות'),
   E('StorePopup', 'store_popups', 'פופאפ לחנות/עובדים.', keys=['popup_type', 'trigger_type', 'scheduled_at', 'expires_at', 'is_active']),
   E('SentNewsletter', 'sent_newsletters', 'ניוזלטר שנשלח.', keys=['subject', 'audience', 'recipient_count'], cls='יומן'),
   E('BrandingContent', 'branding_content', 'סקשן תוכן תדמית (JSON).', keys=['section_type', 'sort_order', 'data']),
   E('BusinessGallery', 'business_gallery', 'תמונת גלריה. `group_id` ללא FK.', keys=['image_url', 'caption', 'tag'], logical=[('group_id', 'TenantGroup')]),
  ])

D('restaurant', 'מסעדה, תפריטים, Food Cost ורכש (Restaurant / Menus / FoodCost / Procurement)', 'restaurant tables visits reservations menus food cost ingredients suppliers purchase orders',
  'מצב שולחנות, חשבונות ושיוך מלצרים נשמרים כ-JSON יחיד לכל עסק (blob) ולא כטבלאות שולחן/חשבון נורמליות (server.js:1253-1255).',
  [('תפעול מסעדה ותפריטים', ['TenantGroup', 'RestaurantCustomer', 'RestaurantVisit', 'TableStates', 'TableBills', 'TableAssignments', 'TempTableReservation', 'TempBookingRequest', 'CalendarEvent', 'MenuTemplate', 'MenuSection', 'MenuItem', 'MenuQuoteRequest', 'CatalogItem', 'StoreOrder']),
   ('Food Cost ורכש', ['TenantGroup', 'AppUser', 'CatalogItem', 'ProductIngredient', 'FoodCostPreset', 'FoodCostFixedOverhead', 'Supplier', 'SupplierProduct', 'SupplierProductLink', 'PurchaseOrder', 'ServiceCall', 'StoreOrder', 'PantryItem'])],
  [
   E('RestaurantCustomer', 'restaurant_customers', 'לקוח מסעדה (CRM נפרד). `group_id` ללא FK; `visits_total` מונה.', keys=['customer_name', 'customer_phone', 'visits_total'], logical=[('group_id', 'TenantGroup')], life='status (ברירת מחדל active) [server.js:1248]'),
   E('RestaurantVisit', 'restaurant_visits', 'ביקור/צ\'ק-אין.', keys=['guests', 'visited_at', 'checked_out_at'], logical=[('group_id', 'TenantGroup')]),
   E('TableStates', 'restaurant_table_states', 'JSON מצב כל השולחנות (שורה לעסק).', keys=['states'], logical=[('group_id', 'TenantGroup')], cls='מטמון/סטטיסטיקה'),
   E('TableBills', 'restaurant_table_bills', 'JSON חשבונות פתוחים לשולחנות.', keys=['bills'], logical=[('group_id', 'TenantGroup')], cls='מטמון/סטטיסטיקה'),
   E('TableAssignments', 'restaurant_table_assignments', 'JSON שיוך מלצרים למשמרת.', keys=['assignments', 'shift_date'], logical=[('group_id', 'TenantGroup')], cls='מטמון/סטטיסטיקה'),
   E('TempTableReservation', 'temp_table_reservations', 'שלב ביניים של הזמנת שולחן עם אימות SMS; לאחר אימות נוצר `calendar_events` (rules-restaurant).', keys=['reservation_date', 'reservation_time', 'num_guests', 'sms_code', 'expires_at'], cls='טכני'),
   E('TempBookingRequest', 'temp_booking_requests', 'שלב ביניים לתור שירות עם SMS. `service_id` ללא FK.', keys=['event_date', 'start_time', 'service_id', 'sms_code'], cls='טכני'),
   E('MenuTemplate', 'menu_templates', 'תבנית תפריט/פרויקט (`template_type` menu/project) — גם דף אירוע ציבורי (`public_slug`).', keys=['template_type', 'name', 'event_type', 'pricing_mode', 'base_price_per_person', 'public_slug', 'is_public']),
   E('MenuSection', 'menu_sections', 'שלב בתפריט (מינ\'/מקס\' בחירות).', keys=['name', 'min_choices', 'max_choices', 'price_modifier'], cls='צאצא'),
   E('MenuItem', 'menu_items', 'פריט בשלב — אופציונלית מצביע לקטלוג.', keys=['name', 'custom_price', 'allergens'], cls='צאצא'),
   E('MenuQuoteRequest', 'menu_quote_requests', 'בקשת הצעה מתבנית; בהמרה `linked_order_id` (server.js:43026).', keys=['event_date', 'guest_count', 'selections', 'source']),
   E('ProductIngredient', 'product_ingredients', 'מרכיב במתכון של פריט קטלוג; הקישור למחסן הוא לפי שם (`ingredient_name` ↔ `pantry.item_name`, server.js:22288-22297) ולא FK.', keys=['ingredient_name', 'quantity', 'unit', 'waste_pct', 'unit_weight_grams']),
   E('FoodCostPreset', 'food_cost_overhead_presets', 'תבנית תקורות.', keys=['name', 'overheads'], cls='תצורה'),
   E('FoodCostFixedOverhead', 'food_cost_fixed_overhead', 'תקורה קבועה לעסק (PK=group_id).', keys=['labor_cost_manual', 'profit_targets'], cls='תצורה'),
   E('Supplier', 'suppliers', 'ספק.', keys=['name', 'phone', 'category', 'min_order', 'delivery_days', 'cutoff_time']),
   E('SupplierProduct', 'supplier_products', 'מוצר ספק (מחיר/יחידה) עם קישור אופציונלי לקטלוג.', keys=['name', 'price', 'unit_type', 'units_per_package']),
   E('SupplierProductLink', 'supplier_product_catalog_links', 'M:N מוצר ספק↔פריט קטלוג עם יחס כמות.', keys=['qty_per_unit'], cls='קישור'),
   E('PurchaseOrder', 'purchase_orders', 'הזמנת רכש; `items` JSON; קשור אופציונלית לקריאת שירות או לפקודת עבודה; `confirm_token` לאישור ספק.', keys=['items', 'total_amount', 'expected_delivery', 'confirm_token'], life='status (ברירת מחדל pending) ערכים בקוד: draft/pending/sent/delivered [server.js:17160]'),
  ])

D('sport', 'ספורט (Sport)', 'sport memberships classes registrations waitlist trainers checkins leads appointments waiver',
  'החבר (`sport_memberships`) מזוהה בשם/טלפון בלבד ואינו מקושר ל-`users`/`family_groups`. כל הטבלאות מחזיקות `group_id` ללא FK (למשל server.js:1655, 1667).',
  [('מנויים, שיעורים ומאמנים', ['TenantGroup', 'SportMembershipType', 'SportMembership', 'SportCheckin', 'SportPayment', 'SportClassType', 'SportClass', 'SportClassRegistration', 'SportClassWaitlist', 'SportClassEquipment',
     'SportCancelPolicy', 'SportHealthDeclaration', 'SportWaiverTemplate', 'SportTrainer', 'SportTrainerSession', 'SportLead', 'SportAppointment', 'EquipmentItem'])],
  [
   E('SportMembershipType', 'sport_membership_types', 'סוג מנוי (monthly/yearly/punch_card/day_pass/pt_sessions — server.js:29284).', keys=['name', 'type', 'price', 'duration_days', 'sessions', 'is_public'], logical=[('group_id', 'TenantGroup')]),
   E('SportMembership', 'sport_memberships', 'חבר + מנוי פעיל (שתי ישויות במושג אחד). הקפאה, QR, הצהרת בריאות מועתקת (`waiver_valid_until`). נתיב ב-server.js:31896 מניח עמודות `business_group_id/member_group_id/plan_type_id` וטבלה `membership_plan_types` — שאינן קיימות.', keys=['member_name', 'member_phone', 'start_date', 'end_date', 'sessions_total', 'sessions_used', 'qr_token', 'is_trial'],
     logical=[('group_id', 'TenantGroup')], life='status (ברירת מחדל active) ערכים בקוד: active/frozen/expired/cancelled [server.js:1667]'),
   E('SportCheckin', 'sport_checkins', 'כניסה/יציאה.', keys=['checked_in_at', 'checked_out_at'], cls='יומן'),
   E('SportPayment', 'sport_payments', 'תשלום חבר.', keys=['amount', 'payment_method', 'paid_at']),
   E('SportClassType', 'sport_class_types', 'סוג שיעור + כללי הרשמה; `allowed_membership_type_ids` מערך.', keys=['name', 'default_duration_min', 'booking_open_days', 'max_per_session']),
   E('SportClass', 'sport_classes', 'מופע שיעור. `trainer_name` מועתק לצד `trainer_id`.', keys=['class_date', 'start_time', 'end_time', 'capacity', 'trainer_name'], life='status (ברירת מחדל scheduled) [server.js:1702]'),
   E('SportClassRegistration', 'sport_class_registrations', 'רישום לשיעור (UNIQUE class/membership). אין עמודת status — מצב נגזר מ-`cancelled_at`/`attended`; הקוד בוחר `sr.status` (server.js:43660).', keys=['attended', 'cancelled_at', 'cancel_type'], cls='קישור'),
   E('SportClassWaitlist', 'sport_class_waitlist', 'רשימת המתנה.', keys=['position', 'promoted_at', 'expires_at']),
   E('SportClassEquipment', 'sport_class_equipment', 'ציוד לשיעור.', keys=[], cls='קישור'),
   E('SportCancelPolicy', 'sport_cancel_policy', 'מדיניות ביטול.', keys=['cancel_window_hours', 'late_cancel_action', 'late_cancel_fee'], cls='תצורה'),
   E('SportHealthDeclaration', 'sport_health_declarations', 'הצהרת בריאות חתומה.', keys=['signed_at', 'valid_until', 'is_minor', 'signature_data']),
   E('SportWaiverTemplate', 'sport_waiver_templates', 'תבנית תקנון/הצהרה.', keys=['title', 'validity_months', 'require_guardian_for_minors'], cls='תצורה'),
   E('SportTrainer', 'sport_trainers', 'מאמן + מודל שכר. הקוד בוחר `tr.full_name` (43682) — העמודה היא `name`.', keys=['name', 'pay_type', 'hourly_rate', 'per_class_rate', 'revenue_percent']),
   E('SportTrainerSession', 'sport_trainer_sessions', 'שורת שכר מאמן לשיעור (כולל מחליף).', keys=['session_date', 'hours_worked', 'pay_amount', 'is_substitute', 'paid_at']),
   E('SportLead', 'sport_leads', 'ליד; `converted_to_membership_id` בהמרה.', keys=['member_name', 'member_phone', 'source'], life='status (ברירת מחדל new) [server.js:1830]'),
   E('SportAppointment', 'sport_appointments', 'תור אישי (PT).', keys=['client_name', 'start_time', 'end_time', 'service_name'], life='status (ברירת מחדל pending) [server.js:1842]'),
  ])

D('beauty', 'יופי (Beauty)', 'beauty appointments segments practitioners resources clients formulas inventory commissions rfq subscriptions',
  'כאן ה-FK לעסק נקרא `business_group_id` ולמשפחת הלקוח `client_family_id` — שתיהן ל-`family_groups`. תור יופי אינו `calendar_events` (יומן נפרד; אירועי bap-* סינתטיים — rules-beauty).',
  [('יופי ואסתטיקה', ['TenantGroup', 'BeautyPractitioner', 'BeautyResource', 'BeautyServiceCatalog', 'BeautyAppointment', 'BeautySegment', 'BeautyClientRecord', 'BeautyFormula', 'BeautyClientPhoto',
     'BeautyInventory', 'BeautyCommission', 'BeautyRfq', 'BeautySubscriptionType', 'BeautyClientSubscription'])],
  [
   E('BeautyPractitioner', 'beauty_practitioners', 'מטפלת; `user_id` ללא FK (משתמש עובד אופציונלי).', keys=['display_name', 'tier', 'commission_rate_svc', 'commission_rate_retail', 'work_days', 'slot_minutes', 'is_active'], logical=[('user_id', 'AppUser')]),
   E('BeautyResource', 'beauty_resources', 'חדר/ציוד.', keys=['name', 'resource_type', 'is_active']),
   E('BeautyServiceCatalog', 'beauty_service_catalog', 'קטלוג טיפולים (נפרד מ-store_catalog).', keys=['name', 'category', 'duration_minutes', 'price', 'requires_patch_test', 'allowed_practitioner_ids']),
   E('BeautyAppointment', 'beauty_appointments', 'כותרת תור (לקוח, מקדמה, סה"כ). `rfq_id` ללא FK.', keys=['client_name', 'client_phone', 'client_type', 'booking_source', 'deposit_amount', 'total_price', 'payment_confirmed'], logical=[('rfq_id', 'BeautyRfq')],
     life='status (ברירת מחדל confirmed) ערכים בשימוש: pending_client/confirmed/scheduled/completed/no_show/cancelled/pending_cancel (rules-beauty) [server.js:2047]'),
   E('BeautySegment', 'beauty_appointment_segments', 'מקטע בתור (שירות × מטפלת × משאב × זמן). `service_catalog_id` ללא FK.', keys=['segment_order', 'service_name', 'start_time', 'end_time', 'price', 'backbar_items'], logical=[('service_catalog_id', 'BeautyServiceCatalog')], cls='צאצא'),
   E('BeautyClientRecord', 'beauty_client_records', 'תיק לקוח (רפואי, patch test, נאמנות, סטטיסטיקה מצטברת).', keys=['client_name', 'client_phone', 'patch_test_status', 'loyalty_points', 'visit_count', 'total_spent']),
   E('BeautyFormula', 'beauty_formulas', 'פורמולת צבע/טיפול.', keys=['treatment_type', 'formula_data'], cls='צאצא'),
   E('BeautyClientPhoto', 'beauty_client_photos', 'תמונת לפני/אחרי.', keys=['photo_type', 'image_url', 'is_consent_given'], cls='צאצא'),
   E('BeautyInventory', 'beauty_inventory', 'מלאי מקצועי/קמעונאי (נפרד מ-store_catalog ו-pantry).', keys=['product_name', 'inventory_type', 'stock_qty', 'reorder_threshold', 'cost_price', 'retail_price']),
   E('BeautyCommission', 'beauty_commissions', 'עמלת מטפלת לתור.', keys=['commission_type', 'gross_amount', 'commission_amount', 'is_paid']),
   E('BeautyRfq', 'beauty_rfq', 'בקשת ייעוץ (שאלון, תמונות, תוכנית טיפול, הודעות JSON).', keys=['service_description', 'questionnaire_data', 'treatment_plan', 'resulting_appointment_ids'], life='status (ברירת מחדל new) [server.js:2176]'),
   E('BeautySubscriptionType', 'beauty_subscription_types', 'סוג חבילה/מנוי.', keys=['name', 'sessions_count', 'price', 'validity_days'], cls='תצורה'),
   E('BeautyClientSubscription', 'beauty_client_subscriptions', 'חבילה שנרכשה ללקוח.', keys=['sessions_total', 'sessions_used', 'expires_at']),
  ])

D('logistics', 'לוגיסטיקה (Logistics)', 'logistics orders drivers vehicles routes stops cod rfq invoices pricing rate cards',
  'הזמנת משלוח (`logistics_orders`) נפרדת לחלוטין מ-`store_orders`. במסירה נוצרים חשבונית והכנסה (rules-logistics).',
  [('משלוחים', ['TenantGroup', 'AppUser', 'LogisticsOrder', 'LogisticsOrderEvent', 'LogisticsDriver', 'LogisticsVehicle', 'LogisticsRoute', 'LogisticsRouteStop', 'LogisticsPricingZone', 'LogisticsRateCard', 'LogisticsCodSession', 'LogisticsRfq', 'LogisticsCustomer', 'LogisticsInvoice'])],
  [
   E('LogisticsOrder', 'logistics_orders', 'הזמנת משלוח. `driver_id`/`vehicle_id`/`pricing_zone_id` ללא FK; `tracking_token` לדף מעקב ציבורי.', keys=['order_number', 'pickup_address', 'delivery_address', 'scheduled_date', 'cod_amount', 'delivery_fee', 'tracking_token', 'failed_attempts_count'],
     logical=[('driver_id', 'LogisticsDriver'), ('vehicle_id', 'LogisticsVehicle'), ('pricing_zone_id', 'LogisticsPricingZone')], life='status (ברירת מחדל new) ערכים בקוד: new/assigned/failed_attempt/delivered/cancelled [server.js:2299]'),
   E('LogisticsOrderEvent', 'logistics_order_events', 'ציר אירועים; `order_id` ללא FK.', keys=['event_type', 'old_status', 'new_status'], logical=[('order_id', 'LogisticsOrder')], cls='יומן'),
   E('LogisticsDriver', 'logistics_drivers', 'נהג (+מיקום אחרון). `vehicle_id` ללא FK.', keys=['name', 'phone', 'current_lat', 'current_lng'], logical=[('vehicle_id', 'LogisticsVehicle')], life='status (ברירת מחדל active) [server.js:2286]'),
   E('LogisticsVehicle', 'logistics_vehicles', 'רכב (תוקף ביטוח/טסט).', keys=['name', 'type', 'plate_number', 'capacity_kg', 'insurance_expires_at']),
   E('LogisticsRoute', 'logistics_routes', 'מסלול חלוקה יומי.', keys=['route_date', 'name'], life='status (ברירת מחדל planned) [server.js:2386]'),
   E('LogisticsRouteStop', 'logistics_route_stops', 'עצירה במסלול.', keys=['stop_order', 'eta'], cls='צאצא'),
   E('LogisticsPricingZone', 'logistics_pricing_zones', 'אזור מחיר.', keys=['zone_name', 'base_price', 'price_per_km', 'price_per_kg'], cls='תצורה'),
   E('LogisticsRateCard', 'logistics_rate_cards', 'חוק תוספת.', keys=['rule_type', 'condition_key', 'surcharge_amount', 'surcharge_pct'], cls='תצורה'),
   E('LogisticsCodSession', 'logistics_cod_sessions', 'סגירת יום COD — נכתבת (server.js:32969) ואינה נקראת; הסיכום מחושב מ-logistics_orders.', keys=['session_date', 'total_collected', 'total_deposited'], logical=[('driver_id', 'LogisticsDriver')], cls='לא בשימוש'),
   E('LogisticsRfq', 'logistics_rfq', 'בקשת הצעת מחיר למשלוח.', keys=['quote_amount', 'deposit_amount', 'preferred_date'], life='status (ברירת מחדל new) [server.js:2340]'),
   E('LogisticsCustomer', 'logistics_customers', 'מזמין/נמען (CRM לוגיסטי נפרד). `oneflow_user_id` ללא FK.', keys=['name', 'phone', 'customer_type', 'discount_pct']),
   E('LogisticsInvoice', 'logistics_invoices', 'חשבונית למשלוח.', keys=['invoice_number', 'amount', 'vat_amount', 'total_amount', 'invoice_type'], life='status (ברירת מחדל pending) [server.js:2443]'),
  ])

D('service', 'תחזוקה, שירות ומקצועי (Maintenance / Service / Professional)', 'equipment maintenance faults technicians service calls professional documents leads articles',
  'קריאת שירות (`service_calls`) היא ישות דו-צדדית: `family_group_id` (הלקוח) ו-`business_group_id` (נותן השירות), עם תחנות תשלום משותפות לפקודות עבודה (`work_order_payments.service_call_id`).',
  [('ציוד וקריאות שירות', ['TenantGroup', 'EquipmentTechnician', 'EquipmentItem', 'EquipmentMaintenance', 'EquipmentFault', 'EquipmentFaultNote', 'EquipmentLoan', 'ServiceCall', 'ServiceCallMessage', 'ServiceCallNote', 'WorkOrderPayment', 'PurchaseOrder', 'StoreOrder']),
   ('מקצועי (Professional)', ['TenantGroup', 'ProfessionalContent', 'ProfessionalExpertise', 'ProfessionalArticle', 'ProfessionalLead', 'ProfessionalDocument', 'ProfessionalDocVersion', 'ProfessionalDocType', 'StoreOrder', 'TimeLog'])],
  [
   E('EquipmentTechnician', 'equipment_technicians', 'איש קשר טכנאי; `business_group_id` אם הטכנאי הוא עסק WEFLOWZ.', keys=['name', 'company_name', 'phone', 'specialty', 'oneflow_verified']),
   E('EquipmentItem', 'equipment_items', 'פריט ציוד (גם למשפחה וגם לעסק).', keys=['name', 'category', 'serial_number', 'warranty_expiry'], life='status (ברירת מחדל active) [server.js:1112]'),
   E('EquipmentMaintenance', 'equipment_maintenance', 'טיפול תקופתי (`interval_days`).', keys=['maintenance_type', 'scheduled_date', 'completed_date', 'cost', 'interval_days'], life='status (ברירת מחדל pending) [server.js:1124]'),
   E('EquipmentFault', 'equipment_faults', 'תקלה.', keys=['title', 'severity', 'scheduled_date', 'resolved_date'], life='status (ברירת מחדל open) [server.js:1139]'),
   E('EquipmentFaultNote', 'equipment_fault_notes', 'הערת טיפול + מעבר סטטוס.', keys=['note', 'status_from', 'status_to'], cls='יומן'),
   E('EquipmentLoan', 'equipment_loans', 'השאלת ציוד.', keys=['borrower_name', 'loaned_at', 'returned_at']),
   E('ServiceCall', 'service_calls', 'קריאת שירות משפחה↔עסק. `source_quote_id` (server.js:770) ו-`assigned_member_id` ללא FK.', keys=['title', 'call_type', 'priority', 'scheduled_at', 'price_quote', 'discount_pct', 'needs_triage', 'parts_status'],
     logical=[('source_quote_id', 'StoreOrder')], life='status (ברירת מחדל new) [server.js:1201]; payment_status (1524)'),
   E('ServiceCallMessage', 'service_call_messages', 'צ\'אט לקוח-עסק בקריאה.', keys=['sender_type', 'message'], cls='צאצא'),
   E('ServiceCallNote', 'service_call_notes', 'יומן טיפול פנימי.', keys=['note'], cls='צאצא'),
   E('ProfessionalContent', 'professional_content', 'תוכן אתר דו-לשוני (שורה לעסק). `group_id` ללא FK בכל טבלאות professional_*.', keys=['hero_title_he', 'about_text_he'], logical=[('group_id', 'TenantGroup')], cls='תצורה'),
   E('ProfessionalExpertise', 'professional_expertise', 'תחום מומחיות.', keys=['title_he', 'sort_order', 'is_active'], logical=[('group_id', 'TenantGroup')]),
   E('ProfessionalArticle', 'professional_articles', 'מאמר באתר.', keys=['title_he', 'tags', 'is_published'], logical=[('group_id', 'TenantGroup')]),
   E('ProfessionalLead', 'professional_leads', 'פנייה נכנסת.', keys=['name', 'phone', 'subject'], logical=[('group_id', 'TenantGroup')], life='status (ברירת מחדל new) [server.js:1602]'),
   E('ProfessionalDocument', 'professional_documents', 'מסמך/חוזה (גם תבנית) עם חתימה; `work_order_id` ללא FK.', keys=['title', 'doc_type', 'is_template', 'customer_name', 'signature_data'], logical=[('group_id', 'TenantGroup'), ('work_order_id', 'StoreOrder')], life='status (ברירת מחדל draft) [server.js:1614]'),
   E('ProfessionalDocVersion', 'professional_document_versions', 'גרסת מסמך; `document_id` ללא FK.', keys=['title', 'changed_at'], logical=[('document_id', 'ProfessionalDocument')], cls='יומן'),
   E('ProfessionalDocType', 'professional_doc_types', 'סוג מסמך מותאם.', keys=['name', 'icon'], logical=[('group_id', 'TenantGroup')], cls='תצורה'),
  ])

D('community', 'קהילה, מנהלי אזור, פולים, שוקה ובאנרים (Community / ZM / Pools / Shuka / Banners)', 'community zone manager zm campaigns leads inbox feed posts shuka campaigns promotions cashback flow pools live games',
  'קהילה היא טבלה נפרדת (`communities`) ולא סוג של `family_groups`. החברות היא M:N: משפחות דרך `family_communities`, עסקים דרך `community_businesses`. אזור (`manager_zones`) מקבץ קהילות (`communities.zone_id`) תחת מנהל אזור.',
  [('קהילה ומנהלי אזור', ['TenantGroup', 'Community', 'FamilyCommunity', 'CommunityBusiness', 'CommunityInterest', 'ManagerZone', 'ZoneManager', 'ZmCommission', 'ZmPayment', 'ZmCampaign', 'ZmCampaignLead', 'ZmLeadAction', 'ZmInboxThread', 'ZmInboxMessage', 'ZmMessageTemplate', 'CommunityArticle']),
   ('פיד חברתי ומשחקים חיים', ['TenantGroup', 'AppUser', 'Community', 'InterestGroup', 'InterestGroupMember', 'CommunityPost', 'PostLike', 'PostComment', 'PostReport', 'PostShare', 'FeedRead', 'CommunityNotification', 'LiveGame', 'LiveGameQuestion', 'LiveGameParticipant', 'LiveGameAnswer', 'LiveGameAssignment']),
   ('שוקה (קמפיינים), מבצעים וקאשבק', ['TenantGroup', 'Community', 'CommunityCampaign', 'CampaignBusiness', 'CampaignProduct', 'CampaignRequest', 'CommunityPromotion', 'CommunityBannerRequest', 'CommunityBundle', 'CommunityBundleBusiness', 'CommunityReferral', 'CommunityWallet', 'CommunityWalletTx', 'CatalogItem', 'StoreOrder']),
   ('FLOW, פולים ואזורי שירות', ['TenantGroup', 'Community', 'FlowConfig', 'FlowWallet', 'FlowTransaction', 'FlowRedemption', 'FlowPool', 'FlowPoolMember', 'FlowPoolBid', 'FlowPoolMessage', 'BizPoolHidden', 'BizServiceArea', 'FamilyPreferredArea'])],
  [
   E('Community', 'communities', 'קהילה. `community_type` (ברירת מחדל geographic, server.js:21045); `interest_tags`; `manager_password` גולמי מה-setup הישן (6458).', keys=['name', 'city', 'code', 'community_type', 'min_families', 'created_by_group_id'],
     logical=[('created_by_group_id', 'TenantGroup')], life='status ערכים בקוד: pending/active [server.js:16510]'),
   E('FamilyCommunity', 'family_communities', 'חברות משפחה בקהילה (PK group/community) + `is_community_manager` + מפנה.', keys=['is_community_manager', 'joined_at'], cls='קישור', life='status ערכים בקוד: approved (+pending לפי rules-community) [server.js:532]'),
   E('CommunityBusiness', 'community_businesses', 'חיבור עסק לקהילה + אחוז הנחה. ללא FK כלל (6461).', keys=['discount_pct', 'removal_requested'], logical=[('community_id', 'Community'), ('business_id', 'TenantGroup')], cls='קישור',
     life='status (ברירת מחדל approved) ערכים בקוד: approved/rejected/removed/biz_invited/comm_mgr_pending [server.js:6461]'),
   E('CommunityInterest', 'community_interests', 'תגית עניין לקהילה (PK). כפול ל-`communities.interest_tags`.', keys=['interest_tag'], cls='כפילות'),
   E('ManagerZone', 'manager_zones', 'אזור של מנהל אזור.', keys=['name'], life='status (ברירת מחדל active) [server.js:607]'),
   E('ZoneManager', 'zone_managers', 'מנהל אזור (סיסמה, אחוז עמלה). הסשן נשמר ב-Map בזיכרון (server.js:6495); הטבלה `zone_manager_sessions` שהקוד שואל (41097, 41428, 46160) אינה קיימת.', keys=['name', 'email', 'phone', 'commission_pct'], life='status (ברירת מחדל active) ערכים בקוד: pending/active [server.js:596]'),
   E('ZmCommission', 'zone_manager_commissions', 'עמלת מנהל אזור מהזמנה (`order_id` ללא FK).', keys=['amount', 'commission_pct'], logical=[('order_id', 'StoreOrder')], cls='יומן'),
   E('ZmPayment', 'zone_manager_payments', 'תשלום למנהל אזור.', keys=['amount', 'payment_method', 'paid_at']),
   E('ZmCampaign', 'zm_campaigns', 'קמפיין לידים (טופס ציבורי `token`).', keys=['title', 'token', 'campaign_type', 'fields_config'], life='status (ברירת מחדל active) [server.js:638]'),
   E('ZmCampaignLead', 'zm_campaign_leads', 'ליד מקמפיין + ציון AI.', keys=['data', 'ai_score', 'lead_type'], life='status (ברירת מחדל new) [server.js:650]'),
   E('ZmLeadAction', 'zm_lead_actions', 'פעולת CRM על ליד.', keys=['action_type', 'notes'], cls='יומן'),
   E('ZmInboxThread', 'zm_inbox_threads', 'שרשור הודעות מנהל אזור↔קהילה/סביבה.', keys=['subject', 'last_message_at']),
   E('ZmInboxMessage', 'zm_inbox_messages', 'הודעה בשרשור; `sender_id` פולימורפי לפי `sender_type`.', keys=['sender_type', 'sender_id', 'is_read'], cls='צאצא'),
   E('ZmMessageTemplate', 'zm_message_templates', 'תבנית הודעה.', keys=['name', 'subject'], cls='תצורה'),
   E('CommunityArticle', 'community_articles', 'מאמר קהילה; `community_id`/`author_id` ללא FK, מחבר פולימורפי.', keys=['author_type', 'author_id', 'title', 'published_at'], logical=[('community_id', 'Community')]),
   E('InterestGroup', 'community_interest_groups', 'קבוצת עניין בקהילה; מונים `members_count`/`posts_count` כמטמון.', keys=['name', 'members_count', 'posts_count']),
   E('InterestGroupMember', 'community_group_members', 'חברות משפחה בקבוצת עניין.', keys=['joined_at'], cls='קישור'),
   E('CommunityPost', 'community_posts', 'פוסט קהילה (משפחה או עסק — `business_id` + `biz_post_status`); מונים כמטמון.', keys=['post_type', 'content', 'likes_count', 'comments_count', 'score', 'is_hidden', 'is_pinned'], life='biz_post_status (ברירת מחדל NULL) [server.js:3409]; is_hidden'),
   E('PostLike', 'community_post_likes', 'לייק (UNIQUE post/family).', keys=[], cls='קישור'),
   E('PostComment', 'community_post_comments', 'תגובה (עץ דרך `parent_comment_id`).', keys=['content', 'is_hidden'], cls='צאצא'),
   E('PostReport', 'community_post_reports', 'דיווח.', keys=['reason'], cls='קישור'),
   E('PostShare', 'community_post_shares', 'שיתוף.', keys=[], cls='קישור'),
   E('FeedRead', 'community_feed_reads', 'סמן קריאה אחרון לפיד (PK family/community).', keys=['last_read_at'], cls='מטמון/סטטיסטיקה'),
   E('CommunityNotification', 'community_notifications', 'התראה חברתית.', keys=['action_type', 'is_read', 'ref_id']),
   E('LiveGame', 'live_games', 'טריוויה חיה (קוד משחק, ספונסר).', keys=['title', 'game_code', 'current_question_index', 'is_public'], life='status (ברירת מחדל waiting) [server.js:36693]'),
   E('LiveGameQuestion', 'live_game_questions', 'שאלה.', keys=['question', 'correct_index', 'time_seconds'], cls='צאצא'),
   E('LiveGameParticipant', 'live_game_participants', 'משתתף (`user_id` ללא FK).', keys=['display_name', 'score', 'approved'], cls='צאצא'),
   E('LiveGameAnswer', 'live_game_answers', 'תשובה (UNIQUE question/user).', keys=['answer_index', 'is_correct', 'response_time_ms'], cls='צאצא'),
   E('LiveGameAssignment', 'live_game_assignments', 'הזמנת סביבה למשחק.', keys=['notified_at'], cls='קישור'),
   E('CommunityCampaign', 'community_campaigns', '"שוקה": שוק/קמפיין קהילתי עם חלון פתיחה (`start_at/end_at/active_days/active_hours`) ו-`ordering_enabled` (server.js:15463-15502).', keys=['title', 'code', 'ordering_enabled', 'start_at', 'end_at', 'recurrence', 'is_open_for_requests'], life='status (ברירת מחדל active) [server.js:16513]'),
   E('CampaignBusiness', 'community_campaign_businesses', 'עסק משתתף בשוק (PK campaign/business).', keys=['added_at'], cls='קישור'),
   E('CampaignProduct', 'community_campaign_products', 'מוצר בשוק עם מחיר דורס ואישור מנהל השוק (server.js:16564).', keys=['price_override', 'approval_status'], cls='קישור', life='approval_status [server.js:16566]'),
   E('CampaignRequest', 'community_campaign_requests', 'בקשה/הזמנה להצטרף לשוק (`direction`).', keys=['direction', 'message'], life='status (ברירת מחדל pending) [server.js:16550]'),
   E('CommunityPromotion', 'community_promotions', 'מבצע קהילתי של עסק (קוד, תנאים, מוצר). הקוד מצטרף לפי `cp.biz_code` שאינו קיים (server.js:8021).', keys=['title', 'promo_type', 'discount_pct', 'promo_code', 'valid_until', 'condition_type'], life='status (ברירת מחדל pending) [server.js:533]'),
   E('CommunityBannerRequest', 'community_banner_requests', 'בקשת באנר על בסיס מבצע — מערכת לגאסי (rules-community); הוחלפה ב-banner_orders.', keys=['start_date', 'end_date', 'position'], cls='לגאסי', life='status (ברירת מחדל pending) [server.js:21052]'),
   E('CommunityBundle', 'community_bundles', 'חבילת עסקים בהנחה.', keys=['name', 'discount_pct'], life='status (ברירת מחדל active) [server.js:21029]'),
   E('CommunityBundleBusiness', 'community_bundle_businesses', 'עסק בחבילה.', keys=[], cls='קישור'),
   E('CommunityReferral', 'community_referrals', 'שגריר: משפחה מפנה עסק לקהילה.', keys=['reward_points'], life='status (ברירת מחדל pending) [server.js:21020]'),
   E('CommunityWallet', 'community_wallets', 'ארנק ₪ קאשבק לקהילה (PK community_id). מקביל ל-`flow_wallets` entity_type=community (מטבע FLOW).', keys=['balance', 'total_earned']),
   E('CommunityWalletTx', 'community_wallet_transactions', 'תנועת ארנק; `reference_id` = store_orders.id בקאשבק (server.js:18589).', keys=['amount', 'type', 'reference_id'], logical=[('reference_id', 'StoreOrder')], cls='יומן'),
   E('FlowConfig', 'flow_config', 'טבלת פרסים לפי `action_key` (אישי/קהילתי).', keys=['key', 'personal_amount', 'community_amount'], cls='תצורה'),
   E('FlowWallet', 'flow_wallets', 'ארנק FLOW פולימורפי: `entity_type` ∈ family/business/community + `entity_id` (UNIQUE זוג) — ללא FK (server.js:21646, 21718-21730).', keys=['entity_type', 'entity_id', 'balance'], logical=[('entity_id', 'TenantGroup'), ('entity_id', 'Community')]),
   E('FlowTransaction', 'flow_transactions', 'תנועת FLOW פולימורפית. הקוד מכניס `community_id` שאינו קיים (server.js:36086).', keys=['entity_type', 'entity_id', 'amount', 'action_key', 'reference_id'], logical=[('entity_id', 'TenantGroup')], cls='יומן'),
   E('FlowRedemption', 'flow_redemptions', 'מימוש FLOW להנחה בעסק (`discount_code`).', keys=['flow_amount', 'discount_ils', 'discount_code', 'expires_at'], life='status (ברירת מחדל active) ערכים: active/used (server.js:22037 בודק גם pending) [server.js:21664]'),
   E('FlowPool', 'flow_pools', 'פול רכישה קבוצתית; יוזם פולימורפי (`initiator_type`+`initiator_id` ללא FK); `winner_bid_id` ללא FK.', keys=['initiator_type', 'initiator_id', 'title', 'max_price', 'offer_price', 'min_families', 'expires_at'],
     logical=[('initiator_id', 'TenantGroup')], life='status (ברירת מחדל open_r1) ערכים בקוד: open_r1/open_r2/closed/expired/archived [server.js:33909]'),
   E('FlowPoolMember', 'flow_pool_members', 'משפחה בפול.', keys=['joined_at'], cls='קישור'),
   E('FlowPoolBid', 'flow_pool_bids', 'הצעת עסק לפול (זמן ב-`submitted_at`; הקוד בוחר `created_at` — server.js:34305).', keys=['price', 'is_guest'], life='status (ברירת מחדל pending) [server.js:33931]'),
   E('FlowPoolMessage', 'flow_pool_messages', 'הודעה בפול.', keys=['sender_type', 'sender_id'], cls='צאצא'),
   E('BizPoolHidden', 'biz_pool_hidden', 'פול שהעסק הסתיר. ללא FK.', keys=[], logical=[('pool_id', 'FlowPool'), ('biz_group_id', 'TenantGroup')], cls='קישור'),
   E('BizServiceArea', 'biz_service_areas', 'אזור שירות של עסק (עיר/רדיוס).', keys=['city', 'radius_km']),
   E('FamilyPreferredArea', 'family_preferred_areas', 'אזור מועדף של משפחה.', keys=['city', 'radius_km', 'is_primary']),
  ])

D('kolhaam', 'קול העם (Kol HaAm)', 'kol haam content items authors categories tags comments reactions reports collections achievements',
  'פלטפורמת תוכן קהילתית. הכותב (`author_profiles`) הוא 1:1 עם סביבת משפחה; קריאות/ריאקציות הן ברמת `users`.',
  [('כתיבה, אישור ומוניטין', ['TenantGroup', 'AppUser', 'Community', 'AuthorProfile', 'ContentCategory', 'ContentTag', 'ContentSeries', 'ContentItem', 'ContentItemTag', 'ContentVersion', 'DraftCollaborator', 'EditorPick', 'KhHtmlBackup', 'KhScanWhitelist', 'AchievementType', 'AuthorAchievement', 'AuthorFollower', 'ContentFlowReward']),
   ('מעורבות, תגובות ודיווחים', ['TenantGroup', 'AppUser', 'ContentItem', 'EngagementMetrics', 'ContentReaction', 'ContentSave', 'ContentViewLog', 'ContentShareLog', 'ContentComment', 'CommentReaction', 'SolutionVote', 'CommentMention', 'ContentReport', 'UserCollection', 'UserCollectionItem', 'KhCopilotUsage', 'AiCopilotUsageLog'])],
  [
   E('AuthorProfile', 'author_profiles', 'פרופיל כותב (UNIQUE family_group_id). 14 עמודות נוספות מתווספות דינמית בלולאה (server.js:44615-44627, 45133-45148). הקוד משתמש גם ב-`community_id`, `pen_name`, `status` שאינן קיימות.', keys=['badge_level', 'display_name', 'reputation_score', 'is_revoked', 'total_earned_flow'], life='badge_level ∈ {DEFAULT,LOCAL_LEADER,GLOBAL_LEADER,LEGACY} (server.js:44639); is_revoked/revoked_until'),
   E('ContentCategory', 'content_categories', 'קטגוריה GLOBAL/LOCAL (LOCAL שייכת לקהילה). הקוד מכניס `icon` שאינו קיים (41772).', keys=['title', 'scope_level', 'is_default', 'is_active'], life='scope_level ∈ {GLOBAL,LOCAL} [server.js:39263]; is_active'),
   E('ContentTag', 'content_tags', 'תגית + מונה שימוש. הקוד מכניס `slug` שאינו קיים (45068).', keys=['name', 'usage_count']),
   E('ContentSeries', 'content_series', 'סדרה של כותב.', keys=['title']),
   E('ContentItem', 'content_items', 'פריט תוכן עם מסלול אישור כפול ZM→SA.', keys=['content_type', 'scope_type', 'title', 'reading_time_minutes', 'views_count', 'is_quarantined', 'report_count', 'is_pinned_global'],
     life='status (ברירת מחדל DRAFT) ∈ {DRAFT,PENDING_ZM,PENDING_SA,PUBLISHED_LOCAL,PUBLISHED_GLOBAL,REJECTED}; zm_approval_status; sa_approval_status [server.js:39288]'),
   E('ContentItemTag', 'content_items_tags', 'M:N פריט↔תגית. נתיב יצירת טיוטה מ-AI כותב לטבלה `content_item_tags` (בלי s) שאינה קיימת (server.js:45070).', keys=[], cls='קישור'),
   E('ContentVersion', 'content_version_history', 'גרסת תוכן.', keys=['version_number', 'title'], cls='יומן'),
   E('DraftCollaborator', 'draft_collaborators', 'שותף לטיוטה.', keys=['added_at'], cls='קישור'),
   E('EditorPick', 'editor_picks', 'בחירת עורך SA.', keys=['note', 'pinned_until']),
   E('KhHtmlBackup', 'kh_html_backup', 'גיבוי HTML לפני ניקוי — נכתב בלבד (server.js:40563).', keys=['original_html', 'cleaned_at'], cls='לא בשימוש'),
   E('KhScanWhitelist', 'kh_scan_whitelist', 'פריט שסומן כתקין בסריקה.', keys=['marked_at'], cls='טכני'),
   E('AchievementType', 'achievement_types', 'סוג הישג + פרס FLOW.', keys=['key', 'title', 'flow_reward', 'scope'], cls='תצורה'),
   E('AuthorAchievement', 'author_achievements', 'הישג שהושג.', keys=['earned_at'], cls='קישור'),
   E('AuthorFollower', 'author_followers', 'משפחה עוקבת אחר כותב; `follower_group_id` ללא FK.', keys=[], logical=[('follower_group_id', 'TenantGroup')], cls='קישור'),
   E('ContentFlowReward', 'content_flow_rewards', 'פרס FLOW לכותב — נכתב בלבד (server.js:44739).', keys=['reward_reason', 'amount'], cls='יומן'),
   E('EngagementMetrics', 'content_engagement_metrics', 'מטמון מונים וציון טרנדינג לפריט (מחושב בקרון).', keys=['likes_count', 'views_count', 'current_trending_score'], cls='מטמון/סטטיסטיקה'),
   E('ContentReaction', 'content_reactions', 'LIKE/DISLIKE (PK item/user).', keys=['reaction_type'], cls='קישור'),
   E('ContentSave', 'content_saves', 'שמירה (bookmark).', keys=[], cls='קישור'),
   E('ContentViewLog', 'content_views_log', 'צפייה (dedup 30 דק\').', keys=['viewed_at'], cls='יומן'),
   E('ContentShareLog', 'content_shares_log', 'שיתוף; הקוד בוחר `shared_at` (44870) — העמודה `created_at`.', keys=['share_channel'], cls='יומן'),
   E('ContentComment', 'content_comments', 'תגובה (עץ עד עומק 3), סימון פתרון.', keys=['depth_level', 'content_text', 'is_solution_marked', 'is_hidden', 'report_count']),
   E('CommentReaction', 'comment_reactions', 'לייק לתגובה.', keys=[], cls='קישור'),
   E('SolutionVote', 'solution_votes', 'הצבעת פתרון.', keys=[], cls='קישור'),
   E('CommentMention', 'comment_mentions', 'אזכור בתגובה — נוצרת (40775) ואין אליה שאילתה.', keys=['is_read'], cls='לא בשימוש'),
   E('ContentReport', 'content_reports', 'דיווח על פריט/תגובה. סריקת AI מכניסה `reporter_group_id` שאינו קיים (45947).', keys=['reason', 'notes'], life='status (ברירת מחדל PENDING) ∈ {PENDING,REVIEWED_OK,REVIEWED_ACTIONED} [server.js:40783]'),
   E('UserCollection', 'user_collections', 'אוסף של משפחה (`owner_group_id` ללא FK) עם `share_slug`.', keys=['title', 'is_public', 'share_slug'], logical=[('owner_group_id', 'TenantGroup')]),
   E('UserCollectionItem', 'user_collection_items', 'פריט באוסף.', keys=[], cls='קישור'),
   E('KhCopilotUsage', 'kh_ai_copilot_usage', 'מכסת AI יומית למשפחה (PK group/date).', keys=['usage_date', 'call_count'], cls='מטמון/סטטיסטיקה'),
   E('AiCopilotUsageLog', 'ai_copilot_usage_log', 'לוג פעולות AI — נכתב בלבד (45971). `group_id` ללא FK.', keys=['action_type', 'flagged'], cls='יומן'),
  ])

D('sa', 'Super Admin, חיוב ופלטפורמה (SA / Billing / Platform)', 'super admin sa billing banners dues commission platform settings support tickets dev qa whatsapp templates',
  'חיוב העסק מתפצל לשלושה מנגנונים מקבילים: (1) עמלת פלטפורמה על הזמנות (`business_platform_dues`) ו-גבייה (`business_platform_collections`); (2) רישוי פיצ\'רים/מודולים (`group_licenses` + שדות JSON ב-`family_groups`); (3) באנרים (`banner_orders` → `billing_records` → `payment_confirmations`).',
  [('צוות SA, תמיכה ופיתוח', ['TenantGroup', 'AppUser', 'SaTeam', 'SaUser', 'SupportTicket', 'SaDevTask', 'SaDevSubTask', 'SaVersion', 'SaQaRun', 'SaQaTestResult', 'QaTaskAssignment', 'SaProductMatrix', 'SaProductBook', 'SaInternalChat', 'SaAuditLog']),
   ('חיוב, עמלות ובאנרים', ['TenantGroup', 'Community', 'StoreOrder', 'PlatformDue', 'PlatformCollection', 'GroupLicense', 'BannerSlot', 'BannerSlotCommunity', 'BannerPricing', 'BannerOrder', 'BillingRecord', 'PaymentConfirmation']),
   ('תצורת פלטפורמה וגיבויים', ['TenantGroup', 'SystemSetting', 'BusinessTemplate', 'BizTypeVisibility', 'WhatsappGlobalDefaults', 'WhatsappNotificationType', 'PageImage', 'MarketingCampaign', 'PilotWaitlist', 'AiUsageLog', 'InternalMessage', 'MessageAck', 'GroupSnapshot', 'DemoSnapshot'])],
  [
   E('SaTeam', 'sa_teams', 'צוות SA עם הרשאות JSON (נאכפות בצד לקוח בלבד — rules-sa).', keys=['name', 'permissions'], cls='תצורה'),
   E('SaUser', 'sa_users', 'נציג SA.', keys=['name', 'email', 'working_hours'], life='status (ברירת מחדל active) [server.js:820]'),
   E('SupportTicket', 'support_tickets', 'פנייה לתמיכה מסביבה; משויכת לנציג/צוות.', keys=['subject', 'priority', 'ticket_type', 'log'], life='status (ברירת מחדל open) ערכים בקוד: open/resolved [server.js:824]'),
   E('SaDevTask', 'sa_dev_tasks', 'משימת פיתוח (מ-ticket דרך `original_ticket_id` ללא FK). עמודות כפולות `module`/`module_name`, `env`/`environment`.', keys=['title', 'type', 'priority', 'module', 'env', 'qa_passed'], logical=[('original_ticket_id', 'SupportTicket')], life='status (ברירת מחדל backlog) [server.js:845]'),
   E('SaDevSubTask', 'sa_dev_sub_tasks', 'תת-משימה.', keys=['title', 'is_done'], cls='צאצא'),
   E('SaVersion', 'sa_versions', 'גרסת שחרור.', keys=['name', 'target_date'], life='status (ברירת מחדל planning) [server.js:856]'),
   E('SaQaRun', 'sa_qa_runs', 'ריצת QA — נכתבת בלבד (server.js:23866, 24010).', keys=['tester_name', 'results'], cls='לא בשימוש'),
   E('SaQaTestResult', 'sa_qa_test_results', 'תוצאת בדיקה לפי סביבה (PK test/env); `test_id` ללא FK.', keys=['test_id', 'env', 'status'], cls='יומן'),
   E('QaTaskAssignment', 'qa_task_assignments', 'שיוך QA כ-JSON לפי task_id.', keys=['task_id', 'data'], cls='טכני'),
   E('SaProductMatrix', 'sa_product_matrix', 'מטריצת תרחישי מוצר. חופף ל-`sa_product_book`.', keys=['environment', 'module_name', 'scenario_name'], cls='כפילות'),
   E('SaProductBook', 'sa_product_book', 'ספר מוצר (סעיפים/סביבות).', keys=['category', 'name', 'section_id', 'envs'], cls='כפילות'),
   E('SaInternalChat', 'sa_internal_chat', 'צ\'אט צוות SA.', keys=['room', 'sender_name', 'message']),
   E('SaAuditLog', 'sa_audit_log', 'יומן פעולות SA.', keys=['action_type', 'target_type', 'target_id', 'prev_status', 'new_status'], cls='יומן'),
   E('PlatformDue', 'business_platform_dues', 'חוב עמלת פלטפורמה פר-הזמנה + קאשבק לקהילה (server.js:18577). `order_id`/`community_id` ללא FK.', keys=['order_amount', 'commission_pct', 'commission_amount', 'cashback_pct', 'cashback_amount'],
     logical=[('order_id', 'StoreOrder'), ('community_id', 'Community')], life='status (ברירת מחדל pending) [server.js:573]'),
   E('PlatformCollection', 'business_platform_collections', 'גבייה בפועל מהעסק (סכום כולל, לא מקושר לחובות ספציפיים).', keys=['amount', 'collected_at']),
   E('GroupLicense', 'group_licenses', 'רישוי פיצ\'ר לעסק (UNIQUE group/feature) — מקביל לשדות JSON ב-family_groups.', keys=['feature_key', 'is_active', 'price_monthly']),
   E('BannerSlot', 'banner_slots', 'מיקום באנר.', keys=['name', 'location_key', 'base_price_coins', 'base_price_ils'], cls='תצורה'),
   E('BannerSlotCommunity', 'banner_slot_communities', 'שיוך מיקום לקהילה.', keys=[], cls='קישור'),
   E('BannerPricing', 'banner_pricing', 'מחירון (משך × מס\' קהילות).', keys=['duration_days', 'community_count', 'price_coins', 'price_ils'], cls='תצורה'),
   E('BannerOrder', 'banner_orders', 'הזמנת באנר; `community_ids` מערך (לא טבלת קישור). הקוד מסכם `bo.total_price` — העמודה `total_price_ils`.', keys=['community_ids', 'start_date', 'end_date', 'total_price_ils', 'coins_used', 'cash_amount'],
     life='status (ברירת מחדל pending_approval) ערכים בקוד: active/expired/cancelled [server.js:34450]'),
   E('BillingRecord', 'billing_records', 'רשומת חיוב לעסק (כרגע רק באנרים).', keys=['amount_ils', 'coins_used', 'payment_method', 'due_date', 'paid_at'], life='payment_status (ברירת מחדל unpaid) ערכים בקוד: unpaid/pending_confirm/paid [server.js:34466]'),
   E('PaymentConfirmation', 'payment_confirmations', 'אישור תשלום חתום (חתימה, IP).', keys=['confirmed_at', 'signature_data', 'ip_address']),
   E('SystemSetting', 'system_settings', 'key/value גלובלי (אחוזי עמלה/קאשבק — server.js:18571-18572). הקוד מכניס `description` שאינו קיים (41833).', keys=['key', 'value'], cls='תצורה'),
   E('BusinessTemplate', 'business_templates', 'תבנית הקמת עסק (JSON).', keys=['name', 'business_type', 'json_data'], cls='תצורה'),
   E('BizTypeVisibility', 'biz_type_visibility', 'הסתרת אלמנט UI לפי סוג עסק (PK).', keys=['business_type', 'element_key'], cls='תצורה'),
   E('WhatsappGlobalDefaults', 'whatsapp_global_defaults', 'ברירות מחדל גלובליות ל-WhatsApp.', keys=['owner_order', 'customer_order'], cls='תצורה'),
   E('WhatsappNotificationType', 'whatsapp_notification_types', 'סוג התראה + תבנית + dedup.', keys=['name', 'trigger_hook', 'recipient_type', 'dedup_hours', 'enabled'], cls='תצורה'),
   E('PageImage', 'page_images', 'תמונות דפים שיווקיים (UNIQUE page/slot).', keys=['page', 'slot', 'image_url'], cls='תצורה'),
   E('MarketingCampaign', 'marketing_campaigns', 'קמפיין שיווק פלטפורמה (טקסט לפי מגדר).', keys=['title', 'sector'], cls='תצורה'),
   E('PilotWaitlist', 'pilot_waitlist', 'רשימת המתנה לפיילוט.', keys=['name', 'phone', 'yishuv', 'source'], life='status (ברירת מחדל new) [server.js:3105]'),
   E('AiUsageLog', 'ai_usage_log', 'לוג קריאות AI לסביבה.', keys=['endpoint'], cls='יומן'),
   E('InternalMessage', 'internal_messages', 'הודעת broadcast מ-SA (`target_type/target_id`).', keys=['title', 'target_type', 'target_id']),
   E('MessageAck', 'message_acknowledgments', 'אישור קריאה (PK message/employee). `employee_id` מתייחס לטבלת `employees` שאינה קיימת (server.js:24420).', keys=['employee_id', 'status'], logical=[('message_id', 'InternalMessage')], cls='לגאסי'),
   E('GroupSnapshot', 'group_snapshots', 'גיבוי סביבה (JSON) עם תפוגה; `group_id` ללא FK.', keys=['snapshot_type', 'expires_at'], logical=[('group_id', 'TenantGroup')], cls='טכני'),
   E('DemoSnapshot', 'demo_snapshots', 'צילום מצב לעסק דמו (PK group).', keys=['captured_at'], cls='טכני'),
  ])

build_maps()
import sys; sys.path.insert(0, SP)
from agg import AGG
ENT2AGG = {}
for an, mem in AGG:
    for m in mem:
        assert m in ENT, m
        assert m not in ENT2AGG, m
        ENT2AGG[m] = an
assert len(ENT2AGG) == len(ENT), set(ENT) - set(ENT2AGG)

# ---------- coverage ----------
covered = {e['table'] for e in ENT.values()}
for e in ENT.values(): covered |= set(e['extra_tables'])
uncovered = [t for t in S if t not in covered]
assert not uncovered, uncovered
dup_tables = [t for t, c in collections.Counter(e['table'] for e in ENT.values()).items() if c > 1]
assert not dup_tables, dup_tables

# ---------- render helpers ----------
def keyfields(e, limit=None):
    t = S[e['table']]
    pks = pk_cols(e['table'])
    fks = [c for c, (ty, l, k) in t['cols'].items() if ref_of(ty)]
    lg = [c for c, _ in e['logical'] if c in t['cols']]
    st = [c for c in t['cols'] if STATUSRE.search(c)]
    ks = [k for k in e['keys'] if k in t['cols']]
    order = list(dict.fromkeys(pks + fks + lg + ks + st))
    return order, pks, fks, lg

def mermaid_diagram(names):
    lines = ['erDiagram']
    nameset = set(names)
    t2e = {}
    for n in names: t2e.setdefault(ENT[n]['table'], n)
    rels = []
    for n in names:
        e = ENT[n]
        t = S[e['table']]
        home = n in CUR_DOMAIN_ENTS
        cols, pks, fks, lg = keyfields(e)
        if not home:
            show = pks[:2] or ['id']
            lines.append(f'    {n} {{')
            for c in show:
                ty = t['cols'][c][0] if c in t['cols'] else 'INT'
                lines.append(f'        {mtype(ty)} {c} PK')
            lines.append('    }')
        else:
            lines.append(f'    {n} {{')
            for c in cols[:14]:
                ty = t['cols'][c][0]
                tag = ''
                if c in pks: tag = ' PK'
                elif c in fks: tag = ' FK'
                elif c in lg: tag = ' FK "no constraint"'
                lines.append(f'        {mtype(ty)} {c}{tag}')
            lines.append('    }')
        # FK relations
        for c, (ty, l, k) in t['cols'].items():
            r = ref_of(ty)
            if r and r in t2e and (home or ENT[t2e[r]]['name'] in CUR_DOMAIN_ENTS):
                parent = t2e[r]
                if parent == n and r != e['table']: continue
                card = '||--o|' if unique_single(e['table'], c) or (c in pks and len(pks) == 1) else '||--o{'
                rels.append(f'    {parent} {card} {n} : "{c}"')
        if home:
            for c, pn in e['logical']:
                if pn in nameset:
                    rels.append(f'    {pn} ||..o{{ {n} : "{c} (logical)"')
    lines += list(dict.fromkeys(rels))
    return '\n'.join(lines)

def relations_text(e):
    t = S[e['table']]
    out = []
    for c, (ty, l, k) in t['cols'].items():
        r = ref_of(ty)
        if r:
            od = re.search(r'ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION)', ty, re.I)
            out.append(f'{c} → {r}' + (f' ({od.group(1).upper()})' if od else '') + f' [{l}]')
    for c, pn in e['logical']:
        out.append(f'{c} ⇢ {ENT[pn]["table"]} (ללא FK)')
    return out

CLASS_DESC = {
 'ליבה': 'ישות עסקית מרכזית', 'צאצא': 'ישות-בת התלויה בהורה', 'קישור': 'טבלת קשר M:N / שיוך', 'יומן': 'יומן/לוג append-only',
 'תצורה': 'הגדרות/תבניות', 'טכני': 'טוקנים/סשנים/ביניים טכניים', 'מטמון/סטטיסטיקה': 'נתון נגזר/מטמון/JSON blob',
 'כפילות': 'חופפת מושגית לטבלה אחרת', 'לגאסי': 'מערכת ישנה שהוחלפה/שבורה', 'לא בשימוש': 'נוצרת אך לא נקראת (או לא נגישה כלל)',
}

out = []
W = out.append
W('<div class="intro"><p><b>מודל תחום מושגי (ERD) לבנייה מחדש.</b> הדף ממפה את 299 הטבלאות הפיזיות שנוצרות ב-<code>server.js</code> (CREATE TABLE / ALTER TABLE … ADD COLUMN) ל-' + str(len(ENT)) +
  ' טבלאות-ישות, המקובצות ל-' + str(len(AGG)) + ' <b>ישויות ליבה</b> (aggregates — שורש + ישויות-בת/קישור/יומן) ב-15 תחומים, עם תרשים <code>erDiagram</code> לכל תחום (קווים מלאים = REFERENCES פיזי; קווים מקווקווים = קשר לוגי שהקוד מבצע ב-JOIN/WHERE ללא אילוץ FK), טבלת ישויות, וסעיפים על מושג הדיירות, טבלאות-רפאים, עמודות חסרות, כפילויות וקשרים חוצי-תחומים.</p>'
  '<p><b>שיטה:</b> חילוץ אוטומטי של עמודות/REFERENCES/CONSTRAINT מגוף ה-CREATE וה-ALTER (כולל לולאות ALTER דינמיות של <code>author_profiles</code>), סריקת כל מחרוזות ה-SQL בקוד לזיהוי טבלאות ועמודות שאינן קיימות בסכמה, ובדיקה ידנית של נקודות ההצטלבות (קאשבק, שגרות, הצעה↔פקודה). כל ציטוט <code>server.js:N</code> מפנה לשורת היצירה/השימוש. הערה: ב-schema.json המקורי הושמטו 7 עמודות שבאו אחרי הערת <code>--</code> בתוך CREATE (למשל <code>flow_pools.title</code>, <code>initiator_id</code>) — כאן תוקן.</p>'
  '<p><b>סיווג:</b> ' + ' · '.join(f'<b>{k}</b> = {v}' for k, v in CLASS_DESC.items()) + '.</p></div>')

# ---- aggregate catalog ----
W('<h2 class="grp">קטלוג ישויות הליבה (' + str(len(AGG)) + ')</h2>')
W('<section class="proc" data-f="core entities aggregates catalog mapping"><h3>ישות ליבה → טבלאות פיזיות</h3><p>הטבלה הראשונה ברשימה היא שורש ה-aggregate; השאר תלויות בו (FK או קשר לוגי). סימון ⚠ = יש בקבוצה טבלה שסווגה כפילות/לגאסי/לא בשימוש.</p><div class="tbl-wrap"><table><thead><tr><th>#</th><th>ישות ליבה</th><th>תחום</th><th>טבלאות</th></tr></thead><tbody>')
_dt = {d['key']: re.sub(r'\s*\(.*', '', d['title']) for d in DOMAINS}
for i, (an, mem) in enumerate(AGG, 1):
    flags = [ENT[m]['cls'] for m in mem if ENT[m]['cls'] in ('כפילות', 'לגאסי', 'לא בשימוש')]
    tl = ', '.join(('<b>' if j == 0 else '') + f'<code>{ENT[m]["table"]}</code>' + ('</b>' if j == 0 else '') + (f' <small>({ENT[m]["cls"]})</small>' if ENT[m]['cls'] in ('כפילות', 'לגאסי', 'לא בשימוש') else '') for j, m in enumerate(mem))
    W(f'<tr><td>{i}</td><td><b>{an}</b>{" ⚠" if flags else ""}</td><td>{_dt[ENT[mem[0]]["domain"]]}</td><td>{tl}</td></tr>')
W('</tbody></table></div></section>')

# ---- tenancy section ----
W('<h2 class="grp">מושג הדיירות המרכזי — family_groups</h2>')
W('''<section class="proc" data-f="tenancy family_groups type business member_type business_type community group tenant">
<h3>איך סביבה היא FAMILY / BIZ / חבר / קונה — ולמה COMMUNITY אינה סביבה</h3>
<p>כל סביבה היא שורה ב-<code>family_groups</code> (server.js:6453). הסוג נקבע בשלוש עמודות, והקוד משלב ביניהן:</p>
<div class="tbl-wrap"><table><thead><tr><th>עמודה</th><th>ערכים</th><th>היכן נקבע</th><th>היכן נבדק</th></tr></thead><tbody>
<tr><td><code>type</code></td><td><code>FAMILY</code> (ברירת מחדל) / <code>BUSINESS</code></td><td>CREATE (6453); <code>/api/groups</code> מקבל <code>req.body.type</code> (10132-10134); הרשמת עסק כותבת <code>'BUSINESS'</code> (8133); מחולל עסק (5472)</td><td>ניתוב לקוח: <code>type==='BUSINESS'</code> → <code>/business.html</code> (public/app.js:153, 600); סוג הסשן <code>biz</code>/<code>family</code> לפי type (server.js:10706); דוחות SA סופרים FAMILY מול BUSINESS (9126, 9493-9499)</td></tr>
<tr><td><code>member_type</code></td><td><code>family</code> (ברירת מחדל, 1879) / <code>member</code> / <code>shopper</code> / <code>biz</code></td><td><code>member</code>: חשבון SOLO שעסק יוצר ללקוח (30976) או מארח מיזוג (2596); <code>shopper</code>: לקוח חנות שנכנס ב-SSO (7351, 43327); <code>biz</code>: הרשמת עסק (8133)</td><td>"משפחה אמיתית" בסטטיסטיקות = <code>type='FAMILY' AND member_type NOT IN ('member','shopper')</code> (9126, 4821); כניסת עסק מקבלת <code>member_type='biz' OR type='BUSINESS'</code> (8184, 8229); חבר נועל מודולים בלקוח (public/app.js:1802, 11747). הקוד מתעד גם "member biz" קל — FAMILY עם member_type='biz' (10539-10546)</td></tr>
<tr><td><code>business_type</code></td><td>15 ערכים ב-<code>BUSINESS_TYPES</code>: restaurant, retail, services, construction, maintenance_repair, logistics, healthcare, beauty, education, sport, events, food_production, professional, store_only, other (public/business-app.js:37527-37541)</td><td>ברירת מחדל <code>'other'</code> (server.js:1175); נבחר רק בויזארד ההקמה או ע"י SA (rules-sa)</td><td>רשימת מודולים בלקוח <code>BUSINESS_TYPES[].modules</code>; טאבי יופי (public/business-app.js:5661); שגרות רק ל-restaurant/maintenance_repair (server.js:3632 CHECK; business-app.js:37895); <code>biz_type_visibility</code> (25312)</td></tr>
</tbody></table></div>
<p><b>שכבות נוספות:</b> <code>plan</code> (standard ברירת מחדל 832; solo/member/enterprise בקוד — 10133, 30977); <code>account_status</code> (active ברירת מחדל 36633; pending_activation/frozen/archived); הרשאות מודולים ב-<code>managed_modules</code> (1949) הנאכפות בשרת ע"י <code>requireModule</code> (rules-auth) לצד <code>features</code>/<code>licensed_features</code>/<code>billing_config</code>/<code>unlocked_modules</code>.</p>
<p><b>COMMUNITY אינה ערך של <code>type</code>.</b> קהילה היא ישות נפרדת בטבלה <code>communities</code> (6458) עם חברות M:N: <code>family_communities</code> (18349) למשפחות ו-<code>community_businesses</code> (6461) לעסקים; מנהל קהילה = <code>family_communities.is_community_manager</code>. העמודה <code>family_groups.community_id</code> (6453, ללא FK) היא שיוך ישן חד-ערכי שעדיין נקרא (למשל 13865). החריג: <code>quest_library.community_id</code> מוגדר <code>REFERENCES family_groups</code> (3291).</p>
<p><b>אותה סביבה בשני תפקידים:</b> עסק הוא <code>group_id</code> של הנתונים התפעוליים שלו, ומשפחה מופיעה כ"לקוח" דרך עמודות ייעודיות — רשימת המיזוג של חשבונות כפולים מונה אותן במפורש: <code>store_orders.family_group_id</code>, <code>calendar_events.customer_group_id</code>, <code>beauty_*.client_family_id</code>, <code>service_calls.family_group_id</code>, <code>store_customers.family_group_id</code>, <code>flow_redemptions.family_group_id</code>, <code>storefront_customers.family_group_id</code> ועוד (server.js:2701-2710). הקשר המפורש משפחה↔עסק הוא <code>member_business_links</code> (1880).</p>
</section>''')

# ---- ghost tables & missing columns ----
W('<h2 class="grp">טבלאות-רפאים, עמודות חסרות וטבלאות בעייתיות</h2>')
GHOSTS = [
 ('zone_manager_sessions', '41097, 41428, 46160', 'בדיקת ZM בנתיבי קול העם; ב-41097/41428 לפי <code>token/expires_at</code> וב-46160 לפי <code>group_id/is_active</code> — שתי צורות סותרות', 'סשני ZM נשמרים ב-<code>Map</code> בזיכרון (server.js:6495). השאילתות עטופות ב-try/catch ⇒ תמיד "לא ZM".'),
 ('cashflow_entries', '28976', 'KPI "הכנסות החודש" בדשבורד מקצועי', 'התזרים האמיתי הוא <code>transactions</code> (type=income). עטוף ב-<code>safe()</code> ⇒ מחזיר ברירת מחדל.'),
 ('group_notifications', '32655', 'התראת שימור ללקוחות יופי', 'אין טבלה; ה-INSERT בתוך try ("if table exists"). מקבילה קיימת: <code>alert_notifications</code>.'),
 ('employees', '24420', 'סטטיסטיקת אישורי הודעות SA (<code>JOIN employees</code>)', 'עובדים הם <code>users</code>; הנתיב נכשל תמיד ב-500.'),
 ('membership_plan_types', '31896', 'כרטיס ספורט במשפחה', 'הטבלה האמיתית <code>sport_memberships</code>/<code>sport_membership_types</code>; גם העמודות <code>business_group_id</code>, <code>member_group_id</code>, <code>plan_type_id</code> אינן קיימות. עטוף ב-<code>.catch</code> ⇒ רשימה ריקה.'),
 ('content_item_tags', '45070', 'שיוך תגיות בטיוטת AI בקול העם', 'הטבלה האמיתית <code>content_items_tags</code> (39320); בנוסף <code>content_tags.slug</code> (45068) לא קיים.'),
]
W('<section class="proc" data-f="ghost tables never created zone_manager_sessions cashflow_entries group_notifications employees membership_plan_types content_item_tags"><h3>טבלאות שהקוד שואל ואינן נוצרות בשום מקום</h3><div class="tbl-wrap"><table><thead><tr><th>טבלה</th><th>server.js</th><th>שימוש</th><th>מצב בפועל / תחליף</th></tr></thead><tbody>')
for g in GHOSTS: W(f'<tr><td><code>{g[0]}</code></td><td>{g[1]}</td><td>{g[2]}</td><td>{g[3]}</td></tr>')
W('</tbody></table></div><p>טבלאות נוספות שמופיעות רק בקבצי גיבוי שאינם נטענים (<code>servertemp.js</code>, <code>servergithub.js</code>, <code>server1.js</code>): quizzes, bundles, bundle_questions, products, product_prices, shopping_history(_items), user_quiz_history, budgets, groups_tbl — אינן חלק מהמודל.</p></section>')

W('<section class="proc" data-f="missing columns used by code schema drift"><h3>עמודות שהקוד משתמש בהן ואינן קיימות בסכמה</h3><p>זוהו בסריקת כל מחרוזות ה-SQL (alias.column, UPDATE … SET, INSERT (cols)) מול העמודות שנוצרות. לכל אחת נבדקה השורה ידנית.</p><div class="tbl-wrap"><table><thead><tr><th>טבלה</th><th>עמודה חסרה</th><th>server.js</th><th>עמודה קיימת קרובה / הערה</th></tr></thead><tbody>')
HINT = {('tasks', 'assignee_id'): 'assigned_to', ('users', 'full_name'): 'first_name/last_name/nickname', ('users', 'name'): 'nickname (נתיבי שגרות)', ('users', 'created_at'): 'אין — שחזור דמו', ('sport_trainers', 'full_name'): 'name',
        ('banner_orders', 'total_price'): 'total_price_ils', ('flow_pool_bids', 'created_at'): 'submitted_at', ('content_shares_log', 'shared_at'): 'created_at', ('beauty_client_records', 'full_name'): 'client_name (שחזור דמו)',
        ('beauty_client_records', 'phone'): 'client_phone', ('beauty_client_records', 'email'): 'client_email', ('beauty_client_records', 'notes'): 'medical_notes?', ('alert_notifications', 'type'): 'trigger_type',
        ('alert_notifications', 'reference_id'): 'reference_key', ('zone_managers', 'total_commissions'): 'מחושב מ-zone_manager_commissions', ('zone_managers', 'total_paid'): 'מחושב מ-zone_manager_payments',
        ('family_groups', 'logo_url'): 'image_url / store_settings.logo_url', ('sport_class_registrations', 'status'): 'cancelled_at/attended', ('community_promotions', 'biz_code'): 'business_id',
        ('billing_records', 'reference_id'): 'banner_order_id', ('billing_records', 'record_type'): '—', ('author_profiles', 'community_id'): 'home_community_id', ('sport_memberships', 'business_group_id'): 'group_id',
        ('sport_memberships', 'plan_type_id'): 'membership_type_id', ('flow_transactions', 'community_id'): 'entity_type=community', ('content_reports', 'reporter_group_id'): 'reported_by_user_id'}
nmiss = 0
for t in sorted(MISSING):
    for c, l in MISSING[t]:
        nmiss += 1
        W(f'<tr><td><code>{t}</code></td><td><code>{c}</code></td><td>{l}</td><td>{esc(HINT.get((t, c), "—"))}</td></tr>')
W('</tbody></table></div></section>')

# duplicates
W('''<section class="proc" data-f="duplicates parallel customer wallet calendar chat promotions delivery denormalized"><h3>מושגים מפוצלים / כפולים — המלצת איחוד לבנייה מחדש</h3><div class="tbl-wrap"><table><thead><tr><th>מושג</th><th>טבלאות פיזיות מקבילות</th><th>הערה</th></tr></thead><tbody>
<tr><td>לקוח של עסק</td><td><code>store_customers</code> (708), <code>storefront_customers</code> (1898), <code>restaurant_customers</code> (1248), <code>logistics_customers</code> (2426), <code>beauty_client_records</code> (2088), <code>sport_memberships.member_*</code> (1667), <code>routine_sites.customer_id</code> (3578, ללא FK)</td><td>שבעה ייצוגים; הקישור היחיד המשותף הוא טלפון או <code>family_group_id</code>.</td></tr>
<tr><td>תור / אירוע ביומן</td><td><code>calendar_events</code> (1039), <code>beauty_appointments</code>+<code>segments</code> (2047, 2071), <code>sport_appointments</code> (1842), <code>sport_classes</code> (1702)</td><td>יופי מייצר אירועים סינתטיים (rules-beauty).</td></tr>
<tr><td>קטלוג שירותים/מוצרים</td><td><code>store_catalog</code> (940), <code>calendar_services</code> (1035), <code>beauty_service_catalog</code> (2212), <code>beauty_inventory</code> (2139), <code>supplier_products</code> (17144)</td><td></td></tr>
<tr><td>מלאי</td><td><code>pantry</code> (6480), <code>store_catalog.stock_quantity</code>, <code>store_product_variants.stock_quantity</code>, <code>beauty_inventory.stock_qty</code></td><td>Food Cost מקשר מתכון↔מחסן לפי שם.</td></tr>
<tr><td>ארנק</td><td><code>users.balance</code>, <code>flw_kid_wallets</code> (3149), <code>flow_wallets</code> (21646), <code>community_wallets</code> (552), <code>store_customers.credit_balance</code></td><td>ארבעה מטבעות: ₪ משפחתי, FLW ילד, FLOW, ₪ קאשבק קהילתי.</td></tr>
<tr><td>מבצע / קופון</td><td><code>store_promotions</code> (1009), <code>store_coupons</code> (6464), <code>store_retail_promotions</code> (1343, לא בשימוש), <code>community_promotions</code> (533), <code>community_bundles</code> (21029), <code>flow_redemptions</code> (21664)</td><td></td></tr>
<tr><td>אזור משלוח/שירות</td><td><code>delivery_zones</code> (1013), <code>biz_radius_delivery_zones</code> (922), <code>logistics_pricing_zones</code> (2262), <code>biz_service_areas</code> (36642)</td><td></td></tr>
<tr><td>הודעות</td><td><code>inbox_messages</code>, <code>customer_chats</code>, <code>biz_dm_messages</code>, <code>team_chat</code>, <code>team_posts</code>, <code>service_call_messages</code>, <code>work_order_messages</code>, <code>zm_inbox_*</code>, <code>sa_internal_chat</code></td><td>תשעה ערוצים נפרדים.</td></tr>
<tr><td>יומן ביקורת</td><td><code>activity_log</code>, <code>biz_audit_log</code>, <code>family_audit_log</code>, <code>sa_audit_log</code>, <code>routine_event_log</code>, <code>work_order_timeline</code>, <code>logistics_order_events</code></td><td></td></tr>
<tr><td>שעות עבודה</td><td><code>time_clock</code> (781), <code>time_logs</code> (1557), <code>work_order_assignees.hours_worked</code>, <code>sport_trainer_sessions</code> (1814)</td><td></td></tr>
<tr><td>שורות הזמנה</td><td><code>store_orders.items</code> (JSON) + <code>store_order_items</code> (1008); <code>purchase_orders.items</code> (JSON)</td><td>denormalized.</td></tr>
<tr><td>הרשאות מודולים</td><td><code>family_groups.features/licensed_features/billing_config/managed_modules/unlocked_modules/module_requests</code>, <code>group_licenses</code> (1189)</td><td>שבעה מקורות.</td></tr>
</tbody></table></div></section>''')

# ---- domains ----
dom_count = 0; diag_count = 0
for d in DOMAINS:
    dom_count += 1
    CUR_DOMAIN_ENTS = {e['name'] for e in d['ents']}
    W(f'<h2 class="grp">{d["title"]}</h2>')
    W(f'<section class="proc" data-f="{d["kw"]}"><h3>סקירה ותרשימים — {d["title"]}</h3><p>{rich(d["intro"])}</p>')
    for (dt, names) in d['diagrams']:
        assert len(names) <= 20, (dt, len(names))
        for n in names: assert n in ENT, n
        diag_count += 1
        W(f'<h4>{esc(dt)}</h4>')
        W('<pre class="mermaid">\n' + esc(mermaid_diagram(names)) + '\n</pre>')
    W('</section>')
    W(f'<section class="proc" data-f="{d["kw"]} entities table"><h3>ישויות — {d["title"]}</h3><div class="tbl-wrap"><table><thead><tr><th>ישות</th><th>טבלה פיזית</th><th>ישות ליבה</th><th>שדות מפתח</th><th>קשרים</th><th>מחזור חיים / סטטוס</th><th>סיווג והערות</th></tr></thead><tbody>')
    for e in d['ents']:
        cols, pks, fks, lg = keyfields(e)
        kf = ', '.join(f'<code>{c}</code>' for c in cols[:12])
        rel = '<br>'.join(esc(x) for x in relations_text(e)) or '—'
        life = esc(e['life']) if e['life'] else esc(lifecycle(e['table']))
        miss = MISSING.get(e['table'], [])
        mtxt = ('<br><i>עמודות חסרות בשימוש: ' + ', '.join(f'<code>{c}</code> ({l})' for c, l in miss) + '</i>') if miss else ''
        W(f'<tr><td><b>{e["name"]}</b></td><td><code>{e["table"]}</code><br><small>{cite(e["table"])} · {len(S[e["table"]]["cols"])} עמ\'</small></td><td>{ENT2AGG[e["name"]]}</td><td>{kf}</td><td><small>{rel}</small></td><td><small>{life}</small></td><td><b>{e["cls"]}</b>. {rich(e["notes"])}{mtxt}</td></tr>')
    W('</tbody></table></div></section>')

# ---- cross domain ----
W('<h2 class="grp">קשרים חוצי-תחומים</h2>')
W('''<section class="proc" data-f="cross domain order cashback community wallet zone manager commission flow promo">
<h3>הזמנה → קאשבק → ארנק קהילה → עמלת מנהל אזור (+FLOW, הכנסה, ניכוי מלאי)</h3>
<pre class="mermaid">
erDiagram
    StoreOrder ||..o| PlatformDue : "order_id"
    PlatformDue }o..|| Community : "community_id"
    Community ||--o| CommunityWallet : "community_id"
    CommunityWallet ||--o{ CommunityWalletTx : "community_id"
    StoreOrder ||..o{ CommunityWalletTx : "reference_id"
    Community }o--|| ManagerZone : "zone_id"
    ManagerZone }o--|| ZoneManager : "manager_id"
    ZoneManager ||--o{ ZmCommission : "manager_id"
    StoreOrder ||..o{ ZmCommission : "order_id"
    StoreOrder }o..o| CommunityPromotion : "community_promo_id"
    StoreOrder ||..o{ FlowTransaction : "reference_id"
    StoreOrder ||..o{ Transaction : "logBizIncome"
    StoreOrder ||..o{ PantryItem : "deductPantryForOrder"
</pre>
<p>המעבר של <code>store_orders.status</code> ל-<code>delivered</code>/<code>completed</code> ב-<code>POST /api/store/orders/status</code> (server.js:14666-14700) מפעיל: (1) <code>triggerCashbackForOrder</code> (18548): מאתר קהילה משותפת — <code>family_communities</code> של <code>family_group_id</code> × <code>community_businesses</code> מאושר של העסק (18550-18557); יוצר <code>business_platform_dues</code> עם עמלה <code>platform_commission_pct</code> (ברירת מחדל 3) וקאשבק <code>community_cashback_pct</code>% מהעמלה (ברירת מחדל 30) (18571-18580); מזכה <code>community_wallets</code> + <code>community_wallet_transactions</code> type=cashback (18583-18591); ואם הקהילה באזור עם מנהל פעיל — <code>zone_manager_commissions</code> בשיעור <code>zone_managers.commission_pct</code> מהעמלה (18595-18609). (2) <code>logBizIncome</code> → שורת <code>transactions</code> לעסק (4201). (3) <code>deductPantryForOrder</code> → <code>store_order_items</code> × <code>product_ingredients</code> → <code>pantry</code> לפי שם (22269-22310). (4) אם יש <code>community_promo_id</code> — <code>awardFlow('family', …,'promo_used')</code> → <code>flow_wallets</code>/<code>flow_transactions</code> אישי וקהילתי (14688-14692, 21709-21737).</p>
</section>
<section class="proc" data-f="cross domain work order quote service call purchase order payments">
<h3>הצעת מחיר ↔ פקודת עבודה ↔ קריאת שירות ↔ רכש ↔ תשלומים</h3>
<pre class="mermaid">
erDiagram
    StoreOrder ||--o{ WorkOrderQuoteLink : "work_order_id"
    StoreOrder ||--o{ WorkOrderQuoteLink : "quote_id"
    StoreOrder ||..o{ ServiceCall : "source_quote_id"
    StoreOrder ||--o{ WorkOrderPayment : "work_order_id"
    ServiceCall ||--o{ WorkOrderPayment : "service_call_id"
    StoreOrder ||--o{ PurchaseOrder : "work_order_id"
    ServiceCall ||--o{ PurchaseOrder : "service_call_id"
    StoreOrder ||--o{ CalendarEvent : "work_order_id"
    MenuTemplate ||--o{ StoreOrder : "menu_template_id"
    MenuQuoteRequest }o--o| StoreOrder : "linked_order_id"
    StoreOrder ||..o{ ProfessionalDocument : "work_order_id"
    StoreOrder ||--o{ TimeLog : "wo_id"
</pre>
<p>הצעת מחיר ופקודת עבודה הן אותה טבלה. מסלול א\' (המרה): אישור הצעה הופך את השורה עצמה לפקודה — <code>quote_status='approved', status='processing', call_type='work_order'</code> + אירוע <code>work_order_timeline</code> (server.js:15108-15113). מסלול ב\' (תחזוקה ותיקונים): פקודה קיימת מקושרת להצעות נפרדות דרך <code>work_order_quote_links</code> (27165). קריאת שירות יכולה לנבוע מהצעה (<code>service_calls.source_quote_id</code>, 770, ללא FK). תחנות תשלום (<code>work_order_payments</code>, 1505) ורכש (<code>purchase_orders</code>, 17160) מצביעים לפקודה או לקריאה. בקשת הצעה מתבנית תפריט מומרת להזמנה (<code>menu_quote_requests.linked_order_id</code>, 43026).</p>
</section>
<section class="proc" data-f="cross domain routine occurrence task calendar work order">
<h3>שגרה → משימה / אירוע יומן / פקודת עבודה</h3>
<pre class="mermaid">
erDiagram
    Routine ||--o{ RoutineOccurrence : "routine_id"
    RoutineOccurrence |o..o| Task : "linked_task_id"
    RoutineOccurrence |o..o| CalendarEvent : "linked_calendar_event_id"
    RoutineOccurrence |o..o| StoreOrder : "linked_work_order_id"
    StoreOrder ||--o{ WorkOrderAssignee : "work_order_id"
    RoutineSite ||--o{ Routine : "site_id"
    ServiceContract ||--o{ Routine : "service_contract_id"
</pre>
<p>בהפעלת מופע לפי <code>routines.output_type</code>: <code>task</code> יוצר <code>tasks</code>; <code>task_calendar</code> יוצר גם <code>calendar_events</code> (status=approved, attendees=האחראי; server.js:6960-6969); <code>work_order_template</code> יוצר <code>store_orders</code> עם <code>call_type='work_order'</code>, <code>status='open'</code> ו-<code>work_order_assignees</code> (6973-6994). המזהים נשמרים ב-<code>routine_occurrences.linked_*</code> ללא FK (6997).</p>
</section>
<section class="proc" data-f="cross domain family business customer member links service call beauty calendar">
<h3>משפחה כלקוחה של עסק</h3>
<p>משפחה (<code>family_groups</code> type=FAMILY) צורכת שירותי עסק (type=BUSINESS) דרך: <code>member_business_links</code> (קשר מפורש, 1880), <code>store_orders.family_group_id</code>, <code>calendar_events.customer_group_id</code> (1039), <code>beauty_appointments/beauty_rfq/beauty_client_records.client_family_id</code> (2047, 2176, 2088), <code>service_calls.family_group_id</code>+<code>business_group_id</code> (1201), <code>store_customers.family_group_id</code> (1242), <code>family_business_visits</code> (2010), <code>flow_redemptions</code> (21664), <code>flow_pool_members</code>/<code>flow_pool_bids</code> (33925, 33931). לקוח חנות (<code>storefront_customers</code>) מקבל סביבת משפחה shopper ב-SSO (7351, 43327).</p>
</section>
<section class="proc" data-f="cross domain equipment sport class work order technician business">
<h3>ציוד משותף ומבצע-שירות כעסק</h3>
<p><code>equipment_items</code> משמש תחזוקה (1124), השאלות (1153), שיעורי ספורט (<code>sport_class_equipment</code>, 1718) ושריון לפקודות/אירועים (<code>work_order_equipment</code>, 1537). טכנאי (<code>equipment_technicians.business_group_id</code>, 1099) יכול להיות עסק WEFLOWZ, ובכך תקלה של משפחה מובילה ל-<code>service_calls</code> מולו (<code>technician_contact_id</code>, 1201).</p>
</section>
<section class="proc" data-f="cross domain kol haam flow achievements community zm approval">
<h3>קול העם ↔ קהילה ↔ FLOW</h3>
<p>פריט תוכן LOCAL שייך ל-<code>communities</code> (<code>content_items.community_id</code>) ומאושר ע"י מנהל האזור (<code>zm_approval_status</code>) ואז SA לפרסום GLOBAL (<code>sa_approval_status</code>, 39288). הישגים מזכים FLOW (<code>achievement_types.flow_reward</code>, <code>content_flow_rewards</code>) ונכתבים ל-<code>flow_wallets</code> entity_type=family (44729).</p>
</section>''')

# ---- appendix: full table catalog ----
W('<h2 class="grp">נספח — מיפוי כל 299 הטבלאות לישויות</h2>')
W('<section class="proc" data-f="appendix all tables mapping catalog classification"><h3>טבלה פיזית → ישות → תחום → סיווג</h3><div class="tbl-wrap"><table><thead><tr><th>#</th><th>טבלה</th><th>נוצרת</th><th>עמודות</th><th>הפניות SQL</th><th>ישות</th><th>ישות ליבה</th><th>תחום</th><th>סיווג</th></tr></thead><tbody>')
dt = {d['key']: re.sub(r'\s*\(.*', '', d['title']) for d in DOMAINS}
clscount = collections.Counter()
for i, t in enumerate(sorted(S), 1):
    n = TABLE2ENT[t]; e = ENT[n]; clscount[e['cls']] += 1
    W(f'<tr><td>{i}</td><td><code>{t}</code></td><td>{cite(t)}</td><td>{len(S[t]["cols"])}</td><td>{S[t]["refs"]}</td><td>{n}</td><td>{ENT2AGG[n]}</td><td>{dt[e["domain"]]}</td><td>{e["cls"]}</td></tr>')
W('</tbody></table></div><p>סיכום סיווג: ' + ' · '.join(f'{k}: {v}' for k, v in clscount.most_common()) + '. "הפניות SQL" = מספר מופעי FROM/JOIN/INTO/UPDATE בשם הטבלה ב-server.js.</p></section>')

open(SP + 's1-erd.html', 'w').write('\n'.join(out))
print('entities', len(ENT), 'domains', dom_count, 'diagrams', diag_count + 3, 'tables', len(S), 'missing', nmiss, dict(clscount))
