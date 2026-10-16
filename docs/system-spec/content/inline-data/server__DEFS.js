// source: server.js:9578
const DEFS = {
            orders: {
                base: `FROM store_orders so LEFT JOIN family_groups fg ON fg.id=so.group_id WHERE so.status NOT IN ('cancelled','rejected') AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'so.created_at',
                select: `so.id, so.customer_name as title, fg.name as entity, so.total_amount as amount, so.status, so.created_at`
            },
            new_families: {
                base: `FROM family_groups WHERE type='FAMILY' AND member_type NOT IN ('member','shopper') AND is_test_env IS NOT TRUE`,
                dateCol: 'created_at',
                select: `id, name as title, NULL::text as entity, NULL::numeric as amount, NULL::text as status, created_at`
            },
            new_businesses: {
                base: `FROM family_groups WHERE type='BUSINESS' AND is_test_env IS NOT TRUE`,
                dateCol: 'created_at',
                select: `id, name as title, NULL::text as entity, NULL::numeric as amount, NULL::text as status, created_at`
            },
            new_users: {
                base: `FROM users u LEFT JOIN family_groups fg ON fg.id=u.group_id WHERE fg.id IS NULL OR fg.is_test_env IS NOT TRUE`,
                dateCol: 'u.created_at',
                select: `u.id, COALESCE(u.first_name||' '||u.last_name, u.nickname,'—') as title, fg.name as entity, NULL::numeric as amount, NULL::text as status, u.created_at`
            },
            new_communities: {
                base: `FROM communities WHERE 1=1`,
                dateCol: 'created_at',
                select: `id, name as title, status as entity, NULL::numeric as amount, status, created_at`
            },
            tickets: {
                base: `FROM support_tickets t LEFT JOIN family_groups fg ON fg.id=t.group_id WHERE fg.id IS NULL OR fg.is_test_env IS NOT TRUE`,
                dateCol: 't.created_at',
                select: `t.id, t.subject as title, fg.name as entity, NULL::numeric as amount, t.status, t.created_at`
            },
            banners: {
                base: `FROM banner_orders bo JOIN banner_slots bs ON bs.id=bo.slot_id LEFT JOIN family_groups fg ON fg.id=bo.business_id WHERE fg.id IS NULL OR fg.is_test_env IS NOT TRUE`,
                dateCol: 'bo.created_at',
                select: `bo.id, bs.name as title, fg.name as entity, bo.total_price as amount, bo.status, bo.created_at`
            },
            flow: {
                base: `FROM flow_transactions ft LEFT JOIN family_groups fg ON ft.entity_type IN ('family','business') AND fg.id=ft.entity_id LEFT JOIN communities c ON ft.entity_type='community' AND c.id=ft.entity_id WHERE ft.amount>0 AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'ft.created_at',
                select: `ft.id, ft.description as title, COALESCE(fg.name, c.name,'—') as entity, ft.amount, NULL::text as status, ft.created_at`
            },
            zm_commissions: {
                base: `FROM billing_records WHERE record_type='zm_commission'`,
                dateCol: 'created_at',
                select: `id, description as title, NULL::text as entity, amount_ils as amount, payment_status as status, created_at`
            },
            commission: {
                base: `FROM billing_records br LEFT JOIN family_groups fg ON fg.id=br.business_id WHERE br.payment_status='paid' AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'br.created_at',
                select: `br.id, fg.name as title, br.description as entity, br.amount_ils as amount, br.payment_status as status, br.created_at`
            },
            cashback: {
                base: `FROM billing_records br LEFT JOIN family_groups fg ON fg.id=br.business_id WHERE br.payment_status='paid' AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'br.created_at',
                select: `br.id, fg.name as title, br.description as entity, br.cash_amount as amount, br.payment_status as status, br.created_at`
            },
            collected: {
                base: `FROM business_platform_collections c LEFT JOIN family_groups fg ON fg.id=c.business_id WHERE fg.id IS NULL OR fg.is_test_env IS NOT TRUE`,
                dateCol: 'c.collected_at',
                select: `c.id, fg.name as title, c.notes as entity, c.amount, NULL::text as status, c.collected_at as created_at`
            },
            debt: {
                base: `FROM billing_records br LEFT JOIN family_groups fg ON fg.id=br.business_id WHERE br.payment_status!='paid' AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'br.created_at',
                select: `br.id, fg.name as title, br.description as entity, br.amount_ils as amount, br.payment_status as status, br.created_at`
            },
            flow_issued: {
                base: `FROM flow_transactions ft LEFT JOIN family_groups fg ON ft.entity_type IN ('family','business') AND fg.id=ft.entity_id LEFT JOIN communities c ON ft.entity_type='community' AND c.id=ft.entity_id WHERE ft.amount>0 AND (fg.id IS NULL OR fg.is_test_env IS NOT TRUE)`,
                dateCol: 'ft.created_at',
                select: `ft.id, ft.description as title, COALESCE(fg.name, c.name,'—') as entity, ft.amount, NULL::text as status, ft.created_at`
            },
            flow_redeemed: {
                base: `FROM flow_redemptions fr LEFT JOIN family_groups fgf ON fgf.id=fr.family_group_id LEFT JOIN family_groups fgb ON fgb.id=fr.business_group_id WHERE COALESCE(fgf.is_test_env,false) IS NOT TRUE AND COALESCE(fgb.is_test_env,false) IS NOT TRUE`,
                dateCol: 'fr.created_at',
                select: `fr.id, fgf.name as title, fgb.name as entity, fr.discount_ils as amount, fr.status, fr.created_at`
            },
            new_communities: {
                base: `FROM communities WHERE 1=1`,
                dateCol: 'created_at',
                select: `id, name as title, status as entity, NULL::numeric as amount, status, created_at`
            },
            community_join_req: {
                base: `FROM family_communities fc JOIN family_groups fg ON fg.id=fc.group_id JOIN communities c ON c.id=fc.community_id WHERE fc.status='pending' AND fg.is_test_env IS NOT TRUE`,
                dateCol: 'fc.joined_at',
                select: `fg.id, fg.name as title, c.name as entity, NULL::numeric as amount, fc.status, fc.joined_at as created_at`
            },
            community_biz_links: {
                base: `FROM community_businesses cb JOIN family_groups fg ON fg.id=cb.business_id JOIN communities c ON c.id=cb.community_id WHERE cb.status='approved' AND fg.is_test_env IS NOT TRUE`,
                dateCol: 'cb.created_at',
                select: `fg.id, fg.name as title, c.name as entity, NULL::numeric as amount, cb.status, cb.created_at`
            },
            active_zm: {
                base: `FROM zone_managers WHERE status='active'`,
                dateCol: 'created_at',
                select: `id, name as title, email as entity, NULL::numeric as amount, status, created_at`
            },
            active_businesses: {
                base: `FROM family_groups WHERE type='BUSINESS' AND account_status='active' AND is_test_env IS NOT TRUE`,
                dateCol: 'created_at',
                select: `id, name as title, NULL::text as entity, NULL::numeric as amount, account_status as status, created_at`
            },
            active_families: {
                base: `FROM family_groups WHERE type='FAMILY' AND account_status='active' AND member_type NOT IN ('member','shopper') AND is_test_env IS NOT TRUE`,
                dateCol: 'created_at',
                select: `id, name as title, NULL::text as entity, NULL::numeric as amount, account_status as status, created_at`
            },
            active_users_family: {
                base: `FROM users u JOIN family_groups fg ON fg.id=u.group_id WHERE fg.type='FAMILY' AND u.status='active' AND fg.is_test_env IS NOT TRUE`,
                dateCol: 'u.last_seen',
                select: `u.id, COALESCE(u.first_name||' '||u.last_name, u.nickname,'—') as title, fg.name as entity, NULL::numeric as amount, u.status, u.last_seen as created_at`
            },
            active_users_biz: {
                base: `FROM users u JOIN family_groups fg ON fg.id=u.group_id WHERE fg.type='BUSINESS' AND u.status='active' AND fg.is_test_env IS NOT TRUE`,
                dateCol: 'u.last_seen',
                select: `u.id, COALESCE(u.first_name||' '||u.last_name, u.nickname,'—') as title, fg.name as entity, NULL::numeric as amount, u.status, u.last_seen as created_at`
            },
            active_users_sa: {
                base: `FROM sa_users WHERE status='active'`,
                dateCol: 'created_at',
                select: `id, name as title, email as entity, NULL::numeric as amount, status, created_at`
            },
            active_users_zm: {
                base: `FROM zone_managers WHERE status='active'`,
                dateCol: 'created_at',
                select: `id, name as title, email as entity, NULL::numeric as amount, status, created_at`
            },
            ai_usage: {
                base: `FROM ai_usage_log al LEFT JOIN family_groups fg ON fg.id=al.group_id WHERE fg.id IS NULL OR fg.is_test_env IS NOT TRUE`,
                dateCol: 'al.created_at',
                select: `al.id, fg.name as title, NULL::text as entity, NULL::numeric as amount, NULL::text as status, al.created_at`
            },
            online_now: {
                base: `FROM users u JOIN family_groups fg ON fg.id=u.group_id WHERE u.last_seen > NOW()-INTERVAL '3 minutes' AND fg.is_test_env IS NOT TRUE`,
                dateCol: 'u.last_seen',
                select: `u.id, COALESCE(u.first_name||' '||u.last_name, u.nickname,'—') as title, fg.name as entity, NULL::numeric as amount, NULL::text as status, u.last_seen as created_at`
            },
            dev_tasks_open: {
                base: `FROM sa_dev_tasks WHERE status IN ('backlog','in_progress')`,
                dateCol: 'created_at',
                select: `id, title, status as entity, NULL::numeric as amount, status, created_at`
            }
        };
