const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(express.static('public'));

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(async (client) => {
      console.log('✅ Connected to DB (Pool)');
      
      // שדרוגים שקטים קודמים למקרה שזה לא DB חדש לחלוטין
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE'); } catch(e) {}
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS end_month VARCHAR(10)'); } catch(e) {}
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT TRUE'); } catch(e) {}
      try { await client.query('ALTER TABLE budget_allocations ADD COLUMN IF NOT EXISTS target_user_id INT REFERENCES users(id) ON DELETE CASCADE'); } catch(e) {}
      
      try { await client.query('ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      try { await client.query('ALTER TABLE shopping_trip_items ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      try { await client.query('ALTER TABLE pantry ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      
      try {
          await client.query('ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_admin_email_key CASCADE');
          await client.query('ALTER TABLE family_groups ADD CONSTRAINT family_groups_email_type_key UNIQUE (admin_email, type)');
      } catch(e) { console.log('Email constraint exists or error:', e.message); }

      try {
          await client.query(`CREATE TABLE IF NOT EXISTS time_clock (
              id SERIAL PRIMARY KEY,
              group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
              user_id INT REFERENCES users(id) ON DELETE CASCADE,
              punch_in TIMESTAMP NOT NULL,
              punch_out TIMESTAMP,
              total_minutes INT DEFAULT 0
          )`);
      } catch(e) { console.log('Time clock table error:', e.message); }
      
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION'); } catch(e) {}

      client.release();
  })
  .catch(err => console.error('Connection Error', err.stack));

const calculateAge = (birthYear) => new Date().getFullYear() - (birthYear || new Date().getFullYear());
const getAgeGroup = (age) => { if(age<8) return '6-8'; if(age<10) return '8-10'; if(age<13) return '10-13'; if(age<15) return '13-15'; if(age<18) return '15-18'; return '18+'; };

const generateGroupCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// פונקציה לחישוב מרחק במטרים בין שתי קואורדינטות
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function handleAITokens(groupId) {
    try {
        await pool.query(`UPDATE family_groups SET ai_tokens = 10, last_token_reset = CURRENT_DATE WHERE id = $1 AND (last_token_reset IS NULL OR last_token_reset < CURRENT_DATE)`, [groupId]);
        const res = await pool.query('SELECT ai_tokens, is_premium FROM family_groups WHERE id = $1', [groupId]);
        if(res.rows.length === 0) return false;
        const group = res.rows[0];
        if(group.is_premium) return true;
        if(group.ai_tokens > 0) {
            await pool.query('UPDATE family_groups SET ai_tokens = ai_tokens - 1 WHERE id = $1', [groupId]);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error handling AI tokens:', e);
        return false;
    }
}

const handleAIError = (e, res, defaultMsg) => {
    console.error('AI Error:', e);
    if (e.message && e.message.includes('429')) return res.status(429).json({ error: 'מערכת ה-AI עמוסה כרגע. אנא המתינו כדקה ונסו שוב.' });
    res.status(500).json({ error: defaultMsg || 'שגיאה בתקשורת עם ה-AI' });
};

// --- FORCE DATABASE UPGRADE ---
app.get('/api/force-upgrade', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const results = [];
        const queries = [
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE',
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS end_month VARCHAR(10)',
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT TRUE',
            'ALTER TABLE budget_allocations ADD COLUMN IF NOT EXISTS target_user_id INT REFERENCES users(id) ON DELETE CASCADE',
            'ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE shopping_trip_items ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE pantry ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION',
            'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION'
        ];

        for (let q of queries) {
            try {
                await client.query(q);
                results.push({ query: q, status: 'success' });
            } catch (err) {
                results.push({ query: q, status: 'error', error: err.message });
            }
        }
        
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS time_clock (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                punch_in TIMESTAMP NOT NULL,
                punch_out TIMESTAMP,
                total_minutes INT DEFAULT 0
            )`);
            results.push({ query: 'time_clock table', status: 'success' });
        } catch(err) {
            results.push({ query: 'time_clock table', status: 'error', error: err.message });
        }

        res.json({ success: true, message: 'Database upgrade process finished. Check details.', details: results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if(client) client.release();
    }
});

// --- SYSTEM SETUP ---
app.get('/setup-db', async (req, res) => {
    try {
        await pool.query(`
            DROP TABLE IF EXISTS user_assignments CASCADE;
            DROP TABLE IF EXISTS quiz_questions CASCADE;
            DROP TABLE IF EXISTS quiz_bundles CASCADE;
            DROP TABLE IF EXISTS budget_allocations CASCADE;
            DROP TABLE IF EXISTS goals CASCADE;
            DROP TABLE IF EXISTS loans CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS transactions CASCADE;
            DROP TABLE IF EXISTS shopping_list CASCADE;
            DROP TABLE IF EXISTS shopping_trips CASCADE;
            DROP TABLE IF EXISTS shopping_trip_items CASCADE;
            DROP TABLE IF EXISTS pantry CASCADE;
            DROP TABLE IF EXISTS time_clock CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS family_groups CASCADE;
            DROP TABLE IF EXISTS system_settings CASCADE;
            DROP TABLE IF EXISTS global_products CASCADE;

            CREATE TABLE system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT);
            CREATE TABLE family_groups (
                id SERIAL PRIMARY KEY, 
                name VARCHAR(100), 
                type VARCHAR(20) DEFAULT 'FAMILY', 
                admin_email VARCHAR(100), 
                group_code VARCHAR(10) UNIQUE, 
                ai_tokens INT DEFAULT 10, 
                last_token_reset DATE DEFAULT CURRENT_DATE, 
                is_premium BOOLEAN DEFAULT FALSE, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                location_lat DOUBLE PRECISION, 
                location_lng DOUBLE PRECISION, 
                UNIQUE(admin_email, type)
            );
            CREATE TABLE users (
                id SERIAL PRIMARY KEY, 
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, 
                nickname VARCHAR(50), 
                birth_year INT, 
                password_hash VARCHAR(100), 
                role VARCHAR(20) DEFAULT 'MEMBER', 
                status VARCHAR(20) DEFAULT 'pending', 
                balance DECIMAL(10,2) DEFAULT 0.00, 
                allowance_amount DECIMAL(10,2) DEFAULT 0.00, 
                interest_rate DECIMAL(5,2) DEFAULT 0.00
            );
            CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, amount DECIMAL(10,2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_manual BOOLEAN DEFAULT TRUE, is_recurring BOOLEAN DEFAULT FALSE, end_month VARCHAR(10));
            CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, created_by INT REFERENCES users(id), assigned_to INT REFERENCES users(id), title VARCHAR(255), reward DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', deadline TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE budget_allocations (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, category VARCHAR(50), target_user_id INT REFERENCES users(id) ON DELETE CASCADE, amount_limit DECIMAL(10,2) DEFAULT 0.00, UNIQUE(group_id, category, target_user_id));
            CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, target_user_id INT REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(255), target_amount DECIMAL(10,2), current_amount DECIMAL(10,2) DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, original_amount DECIMAL(10,2), remaining_amount DECIMAL(10,2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, requester_id INT REFERENCES users(id), item_name VARCHAR(100), normalized_name VARCHAR(100), quantity DECIMAL(10,2) DEFAULT 1, unit VARCHAR(20) DEFAULT 'יח''', estimated_price DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, units_per_package INT DEFAULT 1);
            CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, buyer_id INT REFERENCES users(id), store_name VARCHAR(100), branch_name VARCHAR(100), total_amount DECIMAL(10,2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INT REFERENCES shopping_trips(id) ON DELETE CASCADE, item_name VARCHAR(100), normalized_name VARCHAR(100), quantity DECIMAL(10,2), unit VARCHAR(20) DEFAULT 'יח''', price_per_unit DECIMAL(10,2), units_per_package INT DEFAULT 1);
            CREATE TABLE pantry (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, item_name VARCHAR(100), quantity DECIMAL(10,2) DEFAULT 1, unit VARCHAR(20) DEFAULT 'יח''', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, units_per_package INT DEFAULT 1);
            CREATE TABLE time_clock (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, punch_in TIMESTAMP NOT NULL, punch_out TIMESTAMP, total_minutes INT DEFAULT 0);
            CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, type VARCHAR(20), age_group VARCHAR(10), title VARCHAR(255), text_content TEXT, threshold INT DEFAULT 85, reward DECIMAL(10,2) DEFAULT 10.00, created_by VARCHAR(50) DEFAULT 'SYSTEM', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE quiz_questions (id SERIAL PRIMARY KEY, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, q TEXT, options JSONB, correct INT);
            CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INT, custom_reward DECIMAL(10,2), deadline TIMESTAMP, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE global_products (barcode VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(50) DEFAULT 'כללי', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>DB tables fully reset and updated! (Includes time_clock table)</p><a href="/">Go to App</a>');
    } catch (e) { res.status(500).send(e.message); }
});

// --- SUPER ADMIN ENDPOINTS ---

const verifySA = (req, res, next) => {
    if (req.headers.authorization !== 'SA_SECRET_TOKEN_2026') return res.status(403).json({error: 'Forbidden'});
    next();
};

app.post('/api/superadmin/login', async (req, res) => {
    try {
        const { code, password } = req.body;
        const saUserRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_username'");
        const saPassRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_password'");
        
        const currentCode = saUserRes.rows.length > 0 ? saUserRes.rows[0].value : 'admin';
        const currentPass = saPassRes.rows.length > 0 ? saPassRes.rows[0].value : '123456';
        
        if (code === currentCode && password === currentPass) {
            res.json({ success: true, token: 'SA_SECRET_TOKEN_2026' });
        } else {
            res.status(401).json({ error: 'פרטי גישה שגויים לניהול מערכת' });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/superadmin/credentials', verifySA, async (req, res) => {
    try {
        const { newUsername, newPassword } = req.body;
        if (!newUsername || !newPassword) return res.status(400).json({error: 'חסרים נתונים'});
        
        await pool.query("INSERT INTO system_settings (key, value) VALUES ('sa_username', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [newUsername]);
        await pool.query("INSERT INTO system_settings (key, value) VALUES ('sa_password', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [newPassword]);
        
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/superadmin/data', verifySA, async (req, res) => {
    try {
        const groups = await pool.query('SELECT * FROM family_groups ORDER BY created_at DESC');
        const users = await pool.query('SELECT * FROM users ORDER BY group_id, id');
        // נשלוף רק תנועות אמיתיות כדי לא לשכפל את תנועת הפתיחה שיצרנו אוטומטית בהרשמה
        const activity = await pool.query('SELECT t.amount, t.description, t.date, t.type, u.nickname as user_name, f.name as group_name FROM transactions t JOIN users u ON t.user_id = u.id JOIN family_groups f ON t.group_id = f.id ORDER BY t.date DESC LIMIT 50');
        const settings = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('welcome_msg', 'business_welcome_msg', 'ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom', 'business_ad_banner_text_top', 'business_ad_banner_link_top', 'business_ad_banner_img_top', 'business_ad_banner_text_bottom', 'business_ad_banner_link_bottom', 'business_ad_banner_img_bottom')");
        
        let unifiedActivity = [];
        activity.rows.forEach(a => { 
            unifiedActivity.push({ 
                date: a.date, 
                group_name: a.group_name, 
                user_name: a.user_name, 
                description: a.description, 
                amount: a.amount, 
                is_financial: true 
            }); 
        });
        
        // הוספת קבוצות שאין להן תנועות בכלל (במקרה ש"תנועת הפתיחה" נמחקה)
        groups.rows.forEach(g => {
            const hasActivity = unifiedActivity.some(act => act.group_name === g.name);
            if (!hasActivity) {
                 const adminUser = users.rows.find(u => u.group_id === g.id && u.role === 'ADMIN');
                 unifiedActivity.push({ date: g.created_at, group_name: g.name, user_name: adminUser ? adminUser.nickname : 'מנהל', description: '🎉 פתח/ה סביבה חדשה', amount: 0, is_financial: false });
            }
        });
        
        unifiedActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const getSet = (k) => settings.rows.find(r => r.key === k)?.value || '';

        const stats = {
            families: groups.rows.filter(g => g.type === 'FAMILY').length,
            businesses: groups.rows.filter(g => g.type === 'BUSINESS').length,
            familyUsers: users.rows.filter(u => { const g = groups.rows.find(g=>g.id===u.group_id); return g && g.type === 'FAMILY'; }).length,
            businessUsers: users.rows.filter(u => { const g = groups.rows.find(g=>g.id===u.group_id); return g && g.type === 'BUSINESS'; }).length
        };
        
        res.json({
            groups: groups.rows, users: users.rows, activity: unifiedActivity.slice(0, 50), stats: stats,
            welcomeMsg: getSet('welcome_msg'),
            businessWelcomeMsg: getSet('business_welcome_msg'),
            
            adBannerTextTop: getSet('ad_banner_text_top'),
            adBannerLinkTop: getSet('ad_banner_link_top'),
            adBannerImgTop: getSet('ad_banner_img_top'),
            adBannerTextBottom: getSet('ad_banner_text_bottom'),
            adBannerLinkBottom: getSet('ad_banner_link_bottom'),
            adBannerImgBottom: getSet('ad_banner_img_bottom'),
            
            bizBannerTextTop: getSet('business_ad_banner_text_top'),
            bizBannerLinkTop: getSet('business_ad_banner_link_top'),
            bizBannerImgTop: getSet('business_ad_banner_img_top'),
            bizBannerTextBottom: getSet('business_ad_banner_text_bottom'),
            bizBannerLinkBottom: getSet('business_ad_banner_link_bottom'),
            bizBannerImgBottom: getSet('business_ad_banner_img_bottom')
        });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// שליפת דוח 360 למנהל המערכת הראשי (SA)
app.get('/api/superadmin/group-360/:id', verifySA, async (req, res) => {
    try {
        const groupId = req.params.id;
        const gRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [groupId]);
        if(gRes.rows.length === 0) return res.status(404).json({error: 'הקבוצה לא נמצאה'});
        const group = gRes.rows[0];

        const uRes = await pool.query('SELECT nickname, role, balance, allowance_amount FROM users WHERE group_id = $1 ORDER BY role, nickname', [groupId]);
        const tRes = await pool.query(`SELECT t.amount, t.type, t.category, t.description, t.date, u.nickname as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = $1 AND t.date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY t.date DESC`, [groupId]);
        const tasksRes = await pool.query('SELECT status, count(*) FROM tasks WHERE group_id = $1 GROUP BY status', [groupId]);

        res.json({ success: true, group, users: uRes.rows, transactions: tRes.rows, tasksSummary: tasksRes.rows });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/superadmin/groups/:id', verifySA, async (req, res) => {
    try { await pool.query('DELETE FROM family_groups WHERE id=$1', [req.params.id]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/superadmin/users/:id', verifySA, async (req, res) => {
    try { await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/superadmin/settings', verifySA, async (req, res) => {
    try {
        if (req.body.welcomeMsg !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('welcome_msg', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.welcomeMsg]);
        if (req.body.businessWelcomeMsg !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('business_welcome_msg', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.businessWelcomeMsg]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/superadmin/groups/:id/premium', verifySA, async (req, res) => {
    try {
        const enable = req.body.enable === true || req.body.enable === 'true';
        await pool.query('UPDATE family_groups SET is_premium = $1 WHERE id = $2', [enable, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/settings/welcome', async (req, res) => {
    try {
        const key = req.query.type === 'BUSINESS' ? 'business_welcome_msg' : 'welcome_msg';
        const s = await pool.query("SELECT value FROM system_settings WHERE key = $1", [key]);
        res.json({ message: s.rows.length > 0 ? s.rows[0].value : '' });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/banners', async (req, res) => {
    try {
        const isBiz = req.query.type === 'BUSINESS';
        const keys = isBiz ? 
            "('business_ad_banner_text_top', 'business_ad_banner_link_top', 'business_ad_banner_img_top', 'business_ad_banner_text_bottom', 'business_ad_banner_link_bottom', 'business_ad_banner_img_bottom')" :
            "('ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom')";
            
        const result = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ${keys}`);
        const banners = {};
        
        // תיקון: הבטחת בניית המפתחות כך שצד הלקוח ימצא אותם בלי קשר למשפחה או עסק
        result.rows.forEach(r => { 
            let k = r.key.replace('business_ad_banner_', 'banner_').replace('ad_banner_', 'banner_');
            banners[k] = r.value; 
        });
        
        res.json({ success: true, banners: { 
            banner_top_text: banners['banner_text_top'] || '', 
            banner_top_link: banners['banner_link_top'] || '', 
            banner_top_img: banners['banner_img_top'] || '', 
            banner_bottom_text: banners['banner_text_bottom'] || '', 
            banner_bottom_link: banners['banner_link_bottom'] || '',
            banner_bottom_img: banners['banner_img_bottom'] || ''
        } });
    } catch(e) { res.json({ success: false, error: e.message, banners: {} }); }
});

app.post('/api/superadmin/banners', verifySA, async (req, res) => {
    const { topText, topLink, topImg, bottomText, bottomLink, bottomImg, bizTopText, bizTopLink, bizTopImg, bizBottomText, bizBottomLink, bizBottomImg } = req.body;
    const items = [ 
        { k: 'ad_banner_text_top', v: topText || '' }, 
        { k: 'ad_banner_link_top', v: topLink || '' }, 
        { k: 'ad_banner_img_top', v: topImg || '' },
        { k: 'ad_banner_text_bottom', v: bottomText || '' }, 
        { k: 'ad_banner_link_bottom', v: bottomLink || '' },
        { k: 'ad_banner_img_bottom', v: bottomImg || '' },
        { k: 'business_ad_banner_text_top', v: bizTopText || '' }, 
        { k: 'business_ad_banner_link_top', v: bizTopLink || '' }, 
        { k: 'business_ad_banner_img_top', v: bizTopImg || '' },
        { k: 'business_ad_banner_text_bottom', v: bizBottomText || '' }, 
        { k: 'business_ad_banner_link_bottom', v: bizBottomLink || '' },
        { k: 'business_ad_banner_img_bottom', v: bizBottomImg || '' }
    ];
    try {
        await pool.query('BEGIN');
        for (let item of items) await pool.query(`INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [item.k, item.v]);
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await pool.query('ROLLBACK'); res.status(500).json({ error: 'שגיאה בשמירת באנרים במסד הנתונים' });
    }
});

app.post('/api/admin/send-credentials', async (req, res) => {
    try {
        const { groupId, adminId } = req.body;
        const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1 AND group_id = $2", [adminId, groupId]);
        if(adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') return res.status(403).json({error: "רק מנהל מורשה לבצע פעולה זו"});

        const groupRes = await pool.query("SELECT admin_email, name, type FROM family_groups WHERE id = $1", [groupId]);
        if(groupRes.rows.length === 0 || !groupRes.rows[0].admin_email) return res.status(400).json({error: "לא נמצאה כתובת מייל מוגדרת. אנא ודאו שהזנתם מייל בעת ההרשמה."});
        const adminEmail = groupRes.rows[0].admin_email;
        const groupName = groupRes.rows[0].name;
        const groupType = groupRes.rows[0].type;

        const usersRes = await pool.query("SELECT nickname, password_hash, role FROM users WHERE group_id = $1 ORDER BY role, nickname", [groupId]);
        
        let emailContent = `שלום מנהל/ת ${groupType === 'BUSINESS' ? 'ארגון' : 'משפחת'} ${groupName},\n\nלהלן פרטי הגישה של המשתמשים למערכת Oneflow:\n\n`;
        usersRes.rows.forEach(u => {
            let roleStr = '';
            if (groupType === 'BUSINESS') {
                roleStr = u.role === 'ADMIN' ? 'מנהל צוות' : 'עובד';
            } else {
                roleStr = u.role === 'ADMIN' ? 'מנהל/הורה' : 'ילד/בן משפחה';
            }
            emailContent += `שם משתמש: ${u.nickname}\nסיסמה: ${u.password_hash}\nתפקיד: ${roleStr}\n---\n`;
        });
        emailContent += `\nבברכה,\nצוות Oneflow`;

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: `"Oneflow" <${process.env.SMTP_USER}>`,
                to: adminEmail,
                subject: 'Oneflow - פרטי גישה של משתמשי הסביבה',
                text: emailContent
            });
        }

        res.json({ success: true });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// שליפת דוח 360 להורה/מנהל הקבוצה
app.get('/api/group/:groupId/report-360', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { adminId } = req.query;

        // וידוא שהמבקש הוא מנהל הסביבה
        const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1 AND group_id = $2", [adminId, groupId]);
        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') {
            return res.status(403).json({error: "רק מנהל הסביבה מורשה להפיק דוח זה"});
        }

        const gRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [groupId]);
        const group = gRes.rows[0];

        const uRes = await pool.query('SELECT nickname, role, balance, allowance_amount FROM users WHERE group_id = $1 ORDER BY role, nickname', [groupId]);
        const tRes = await pool.query(`SELECT t.amount, t.type, t.category, t.description, t.date, u.nickname as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = $1 AND t.date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY t.date DESC`, [groupId]);
        const tasksRes = await pool.query('SELECT status, count(*) FROM tasks WHERE group_id = $1 GROUP BY status', [groupId]);

        res.json({ success: true, group, users: uRes.rows, transactions: tRes.rows, tasksSummary: tasksRes.rows });
    } catch(e) { res.status(500).json({error: e.message}); }
});


// ============================================================
// --- CORE DATA ENDPOINTS (RESTORED FOR APP FUNCTIONALITY) ---
// ============================================================

app.get('/api/data/:userId', async (req, res) => {
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userRes.rows[0];
        
        const groupRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [user.group_id]);
        const group = groupRes.rows[0];

        const tasks = await pool.query('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 ORDER BY t.created_at DESC', [group.id]);
        const pantry = await pool.query('SELECT * FROM pantry WHERE group_id = $1 ORDER BY updated_at DESC', [group.id]);
        const shoppingList = await pool.query('SELECT sl.*, u.nickname as requester_name FROM shopping_list sl LEFT JOIN users u ON sl.requester_id = u.id WHERE sl.group_id = $1 ORDER BY sl.added_at DESC', [group.id]);
        const goals = await pool.query('SELECT g.*, u.nickname as owner_name FROM goals g LEFT JOIN users u ON g.target_user_id = u.id WHERE g.user_id = $1 OR g.target_user_id = $1', [user.id]);
        
        const allBundles = await pool.query('SELECT * FROM quiz_bundles ORDER BY created_at DESC');
        
        // התיקון לקריסה: שינוי ל-qb.reward as default_reward כפי שמוגדר בטבלה
        const userBundles = await pool.query(`
            SELECT ua.*, qb.title, qb.type, qb.age_group, qb.threshold, qb.text_content, qb.reward as default_reward, u.nickname as assignee_name 
            FROM user_assignments ua 
            JOIN quiz_bundles qb ON ua.bundle_id = qb.id 
            LEFT JOIN users u ON ua.user_id = u.id
            WHERE ua.user_id = $1 OR $2 = 'ADMIN'
        `, [user.id, user.role]);

        for (let b of userBundles.rows) {
            const qRes = await pool.query('SELECT * FROM quiz_questions WHERE bundle_id = $1', [b.bundle_id]);
            b.questions = qRes.rows;
        }

        let weeklyStats = null;
        if (user.role !== 'ADMIN') {
            const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const spentRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as spent FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= $2", [user.id, startOfWeek]);
            weeklyStats = { spent: spentRes.rows[0].spent, limit: user.allowance_amount };
        }

        res.json({
            user, group, 
            tasks: tasks.rows, 
            pantry: pantry.rows, 
            shopping_list: shoppingList.rows,
            goals: goals.rows,
            quiz_bundles: userBundles.rows,
            all_bundles: allBundles.rows,
            weekly_stats: weeklyStats
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- SHOPPING LIST ENDPOINTS ---
// ============================================================

app.post('/api/shopping/add', async (req, res) => {
    try {
        const { itemName, quantity, unit, estimatedPrice, userId, groupId, unitsPerPackage } = req.body;
        let actualGroupId = parseInt(groupId);
        
        // הגנה מקריסה כשהלקוח לא מעביר groupId (למשל, בעת רענון)
        if (isNaN(actualGroupId) && userId) {
            const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
            if (uRes.rows.length > 0) actualGroupId = uRes.rows[0].group_id;
        }
        
        if (!actualGroupId) return res.status(400).json({ success: false, error: 'Group ID is missing' });
        
        await pool.query(
            `INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, unit, estimated_price, units_per_package) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [actualGroupId, userId || null, itemName, parseFloat(quantity) || 1, unit || 'יח\'', parseFloat(estimatedPrice) || 0, parseInt(unitsPerPackage) || 1]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    try {
        const { itemId, status, estimatedPrice } = req.body;
        if (status !== undefined) await pool.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if (estimatedPrice !== undefined) await pool.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [parseFloat(estimatedPrice) || 0, itemId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/clear/:groupId', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE group_id=$1', [req.params.groupId]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    try {
        const { totalAmount, userId, storeName, branchName, boughtItems, missingItems } = req.body;
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const groupId = uRes.rows[0].group_id;
        
        await pool.query('BEGIN');
        
        // Record trip
        const tripRes = await pool.query(`INSERT INTO shopping_trips (group_id, buyer_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [groupId, userId, storeName, branchName, totalAmount]);
        const tripId = tripRes.rows[0].id;
        
        // Record transaction
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'groceries', 'expense')`, [userId, groupId, totalAmount, `רכש מלאי/סופר: ${storeName}`]);
        
        // Process bought items
        for (let item of boughtItems) {
            await pool.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [tripId, item.name, item.quantity, item.price / (item.quantity||1)]);
            
            // Move to pantry
            const pRes = await pool.query(`SELECT id, quantity FROM pantry WHERE group_id=$1 AND item_name=$2`, [groupId, item.name]);
            if (pRes.rows.length > 0) {
                await pool.query(`UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id=$2`, [item.quantity, pRes.rows[0].id]);
            } else {
                await pool.query(`INSERT INTO pantry (group_id, item_name, quantity) VALUES ($1, $2, $3)`, [groupId, item.name, item.quantity]);
            }
            
            await pool.query(`DELETE FROM shopping_list WHERE id=$1`, [item.id]);
        }
        
        // Missing items remain pending
        for (let item of missingItems) {
            await pool.query(`UPDATE shopping_list SET status='pending' WHERE id=$1`, [item.id]);
        }
        
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch(e) { 
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const { groupId } = req.query;
        const trips = await pool.query('SELECT st.*, u.nickname FROM shopping_trips st LEFT JOIN users u ON st.buyer_id = u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC', [groupId]);
        for (let t of trips.rows) {
            const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [t.id]);
            t.items = items.rows;
        }
        res.json(trips.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/copy', async (req, res) => {
    try {
        const { tripId, userId } = req.body;
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const groupId = uRes.rows[0].group_id;
        
        const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [tripId]);
        for(let i of items.rows) {
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, status) VALUES ($1, $2, $3, $4, 'pending')`, [groupId, userId, i.item_name, i.quantity]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- PANTRY ENDPOINTS ---
// ============================================================

app.post('/api/pantry/add', async (req, res) => {
    try {
        const { groupId, itemName, quantity, unit, unitsPerPackage } = req.body;
        const actualGroupId = parseInt(groupId);
        
        // הגנה מפני מזהה קבוצה חסר
        if (!actualGroupId) return res.status(400).json({ success: false, error: 'Group ID is missing' });

        const existing = await pool.query('SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2', [actualGroupId, itemName]);
        if (existing.rows.length > 0) {
            await pool.query('UPDATE pantry SET quantity = quantity + $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [parseFloat(quantity) || 1, existing.rows[0].id]);
        } else {
            // הוספת המוצר למזווה בבטחה
            await pool.query('INSERT INTO pantry (group_id, item_name, quantity, unit, units_per_package) VALUES ($1, $2, $3, $4, $5)', [actualGroupId, itemName, parseFloat(quantity) || 1, unit || 'יח\'', parseInt(unitsPerPackage) || 1]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/pantry/update', async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        await pool.query('UPDATE pantry SET quantity=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [parseFloat(quantity) || 0, itemId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pantry/use', async (req, res) => {
    try {
        const { groupId, itemName, usedQuantity, usedUnits } = req.body;
        const pRes = await pool.query('SELECT * FROM pantry WHERE group_id=$1 AND item_name=$2', [groupId, itemName]);
        if(pRes.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        
        const item = pRes.rows[0];
        let deductAmount = 0;
        if (usedUnits > 0 && item.units_per_package > 0) deductAmount = usedUnits / item.units_per_package;
        else deductAmount = usedQuantity;
        
        const newQty = Math.max(0, item.quantity - deductAmount);
        if (newQty <= 0) {
            await pool.query('DELETE FROM pantry WHERE id=$1', [item.id]);
        } else {
            await pool.query('UPDATE pantry SET quantity=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [newQty, item.id]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pantry/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM pantry WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});


// ============================================================
// --- BUDGET ENDPOINTS ---
// ============================================================

app.get('/api/budget/filter', async (req, res) => {
    try {
        const { groupId, targetUserId } = req.query;
        let params = [groupId];
        let targetFilterA = '';
        let targetFilterE = '';
        
        // הגנה מפני undefined strings
        if (targetUserId && targetUserId !== 'all' && targetUserId !== 'undefined') {
            params.push(targetUserId);
            targetFilterA = `AND (target_user_id = $2 OR target_user_id IS NULL)`;
            targetFilterE = `AND user_id = $2`;
        }

        // שימוש ב-CTE לשאילתה חסינת תקלות המשלבת הקצאות אל מול הוצאות
        const query = `
            WITH Allocations AS (
                SELECT category, amount_limit 
                FROM budget_allocations 
                WHERE group_id = $1 ${targetFilterA}
            ),
            Expenses AS (
                SELECT category, SUM(amount) as spent 
                FROM transactions 
                WHERE group_id = $1 
                AND type = 'expense' 
                AND date >= date_trunc('month', CURRENT_DATE)
                ${targetFilterE}
                GROUP BY category
            )
            SELECT 
                COALESCE(a.category, e.category) as category, 
                COALESCE(MAX(a.amount_limit), 0) as limit, 
                COALESCE(MAX(e.spent), 0) as spent
            FROM Allocations a
            FULL OUTER JOIN Expenses e ON a.category = e.category
            GROUP BY COALESCE(a.category, e.category)
        `;
        
        const result = await pool.query(query, params);
        res.json(result.rows || []);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        const finalUserId = targetUserId === 'all' ? null : targetUserId;
        await pool.query(`
            INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (group_id, category, target_user_id) 
            DO UPDATE SET amount_limit = $4
        `, [groupId, category, finalUserId, parseFloat(limit) || 0]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- TRANSACTIONS ENDPOINTS ---
// ============================================================

app.get('/api/transactions', async (req, res) => {
    try {
        const { groupId, userId, limit } = req.query;
        let q = `SELECT t.*, u.nickname as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = $1`;
        let p = [groupId];
        if(userId !== 'all') { q += ` AND t.user_id = $2`; p.push(userId); }
        q += ` ORDER BY t.date DESC LIMIT $${p.length + 1}`; p.push(limit || 200);
        const result = await pool.query(q, p); res.json(result.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/transaction', async (req, res) => {
    try {
        const { userId, amount, description, category, type, date, isRecurring, endMonth, groupId } = req.body;
        // הכנסה מאובטחת של הפעולה, תוך סימון "ידני" כברירת מחדל לפעולות המתווספות מהממשק
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, date, is_recurring, end_month, is_manual) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`, [userId, groupId, parseFloat(amount)||0, description, category, type, date || new Date(), isRecurring, endMonth]);
        
        if (type === 'expense') await pool.query(`UPDATE users SET balance = balance - $1 WHERE id=$2`, [parseFloat(amount)||0, userId]);
        else await pool.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [parseFloat(amount)||0, userId]);
        
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/transaction/:id', async (req, res) => {
    try {
        const { amount, description, category, requesterId, groupId } = req.body;
        const oldTx = await pool.query('SELECT amount, type, user_id FROM transactions WHERE id=$1', [req.params.id]);
        if(oldTx.rows.length===0) return res.status(404).json({error:'Not found'});
        const tx = oldTx.rows[0];
        const diff = parseFloat(amount) - parseFloat(tx.amount);
        await pool.query('UPDATE transactions SET amount=$1, description=$2, category=$3 WHERE id=$4', [parseFloat(amount)||0, description, category, req.params.id]);
        if (diff !== 0) {
            if(tx.type === 'expense') await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [diff, tx.user_id]);
            else await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [diff, tx.user_id]);
        }
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/transaction/:id', async (req, res) => {
    try {
        const txRes = await pool.query('SELECT * FROM transactions WHERE id=$1', [req.params.id]);
        if(txRes.rows.length===0) return res.status(404).json({error:'Not found'});
        const tx = txRes.rows[0];
        await pool.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
        if(tx.type === 'expense') await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [tx.amount, tx.user_id]);
        else await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [tx.amount, tx.user_id]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ============================================================
// --- LOANS ENDPOINTS ---
// ============================================================

app.get('/api/loans', async (req, res) => {
    try {
        const loans = await pool.query('SELECT l.*, u.nickname FROM loans l JOIN users u ON l.user_id = u.id WHERE l.group_id=$1 ORDER BY l.created_at DESC', [req.query.groupId]);
        res.json(loans.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/loans/request', async (req, res) => {
    try {
        const { userId, amount, reason, groupId } = req.body;
        await pool.query('INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason) VALUES ($1, $2, $3, $4, $5)', [userId, groupId, parseFloat(amount)||0, parseFloat(amount)||0, reason]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/loans/approve', async (req, res) => {
    try {
        const { loanId, userId, amount, adminId } = req.body;
        const l = await pool.query('SELECT group_id FROM loans WHERE id=$1', [loanId]);
        await pool.query('UPDATE loans SET status=$1 WHERE id=$2', ['approved', loanId]);
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [parseFloat(amount)||0, userId]);
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, 'הלוואה / מקדמה אושרה', 'other', 'income')`, [userId, l.rows[0].group_id, parseFloat(amount)||0]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/loans/reject', async (req, res) => {
    try {
        await pool.query('UPDATE loans SET status=$1 WHERE id=$2', ['rejected', req.body.loanId]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ============================================================
// --- GOALS ENDPOINTS ---
// ============================================================

app.post('/api/goals', async (req, res) => {
    try {
        const { userId, targetUserId, title, target, groupId } = req.body;
        await pool.query('INSERT INTO goals (user_id, target_user_id, title, target_amount) VALUES ($1, $2, $3, $4)', [userId, targetUserId || null, title, parseFloat(target)||0]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/goals/deposit', async (req, res) => {
    try {
        const { userId, goalId, amount, groupId } = req.body;
        await pool.query('BEGIN');
        await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [parseFloat(amount)||0, userId]);
        const g = await pool.query('UPDATE goals SET current_amount = current_amount + $1 WHERE id=$2 RETURNING title', [parseFloat(amount)||0, goalId]);
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'savings', 'expense')`, [userId, groupId, parseFloat(amount)||0, 'הפקדה ליעד: ' + g.rows[0].title]);
        await pool.query('COMMIT');
        res.json({success:true});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// ============================================================
// --- MEMBERS & ADMIN TOOLS ---
// ============================================================

app.get('/api/group/members', async (req, res) => {
    try {
        const { groupId } = req.query;
        const users = await pool.query('SELECT id, nickname, role, balance, allowance_amount, interest_rate, birth_year FROM users WHERE group_id=$1 AND status=$2 ORDER BY role, nickname', [groupId, 'active']);
        res.json(users.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const { groupId } = req.query;
        const users = await pool.query('SELECT id, nickname, role, birth_year FROM users WHERE group_id=$1 AND status=$2', [groupId, 'pending']);
        res.json(users.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/approve-user', async (req, res) => {
    try {
        await pool.query('UPDATE users SET status=$1 WHERE id=$2', ['active', req.body.userId]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:id', async (req, res) => {
    try { await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/users/:id/password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const u = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.params.id]);
        if(u.rows[0].password_hash !== oldPassword) return res.status(401).json({error: 'סיסמה נוכחית שגויה'});
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newPassword, req.params.id]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/adjust-balance', async (req, res) => {
    try {
        const { adminId, groupId, childId, type, amount, reason } = req.body;
        const actAmount = type === 'deduct' ? -(parseFloat(amount)||0) : (parseFloat(amount)||0);
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [actAmount, childId]);
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'other', $5)`, [childId, groupId, parseFloat(amount)||0, reason, type === 'deduct' ? 'expense' : 'income']);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/update-settings', async (req, res) => {
    try {
        const { userId, allowance, interest } = req.body;
        await pool.query('UPDATE users SET allowance_amount=$1, interest_rate=$2 WHERE id=$3', [parseFloat(allowance)||0, parseFloat(interest)||0, userId]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/payday', async (req, res) => {
    try {
        const { groupId } = req.body;
        const users = await pool.query(`SELECT id, allowance_amount, interest_rate, balance FROM users WHERE group_id=$1 AND status='active' AND role != 'ADMIN'`, [groupId]);
        let totalDistributed = 0;
        await pool.query('BEGIN');
        for(let u of users.rows) {
            let toAdd = parseFloat(u.allowance_amount) || 0;
            let bal = parseFloat(u.balance) || 0;
            if(bal > 0 && parseFloat(u.interest_rate) > 0) {
                toAdd += bal * (parseFloat(u.interest_rate) / 100);
            }
            if(toAdd > 0) {
                await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [toAdd, u.id]);
                await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, 'שכר / חלוקת קצבה ותמריצים', 'allowance', 'income')`, [u.id, groupId, toAdd]);
                totalDistributed += toAdd;
            }
        }
        await pool.query('COMMIT');
        res.json({success:true, totalDistributed});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// ============================================================
// --- TASKS ENDPOINTS ---
// ============================================================

app.post('/api/tasks', async (req, res) => {
    try {
        const { title, reward, assignedTo, days, status, groupId } = req.body;
        const deadline = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
        await pool.query('INSERT INTO tasks (group_id, title, reward, assigned_to, deadline, status) VALUES ($1, $2, $3, $4, $5, $6)', [groupId, title, parseFloat(reward)||0, assignedTo, deadline, status]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/tasks/update', async (req, res) => {
    try {
        const { taskId, status, finalReward } = req.body;
        const tRes = await pool.query('SELECT * FROM tasks WHERE id=$1', [taskId]);
        const t = tRes.rows[0];
        const rew = finalReward !== undefined ? (parseFloat(finalReward)||0) : (parseFloat(t.reward)||0);
        await pool.query('BEGIN');
        await pool.query('UPDATE tasks SET status=$1, reward=$2 WHERE id=$3', [status, rew, taskId]);
        if (status === 'approved') {
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [rew, t.assigned_to]);
            await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'tasks', 'income')`, [t.assigned_to, t.group_id, rew, 'תגמול משימה: ' + t.title]);
        }
        await pool.query('COMMIT');
        res.json({success:true});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// ============================================================
// --- ACADEMY ENDPOINTS ---
// ============================================================

app.post('/api/academy/assign', async (req, res) => {
    try {
        const { userId, bundleId, reward, days, groupId } = req.body;
        const deadline = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
        await pool.query('INSERT INTO user_assignments (user_id, bundle_id, custom_reward, deadline) VALUES ($1, $2, $3, $4)', [userId, bundleId, reward || null, deadline]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/academy/submit', async (req, res) => {
    try {
        const { userId, bundleId, score, groupId } = req.body;
        // תיקון שאיבת default_reward מהטבלה המקורית לתוך ה-Query
        const b = await pool.query('SELECT threshold, reward as default_reward FROM quiz_bundles WHERE id=$1', [bundleId]);
        const ua = await pool.query(`SELECT id, custom_reward FROM user_assignments WHERE user_id=$1 AND bundle_id=$2 AND status='assigned' ORDER BY id DESC LIMIT 1`, [userId, bundleId]);
        const passed = score >= b.rows[0].threshold;
        const status = passed ? 'completed' : 'failed';
        await pool.query('BEGIN');
        if (ua.rows.length > 0) {
            await pool.query('UPDATE user_assignments SET status=$1, score=$2 WHERE id=$3', [status, score, ua.rows[0].id]);
            if (passed) {
                const rew = parseFloat(ua.rows[0].custom_reward) || parseFloat(b.rows[0].default_reward) || 0;
                await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [rew, userId]);
                await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, 'בונוס למידה מ-AI', 'academy', 'income')`, [userId, groupId, rew]);
            }
        }
        await pool.query('COMMIT');
        res.json({success:true});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// ============================================================
// --- AI ENDPOINTS (ADAPTED FOR FAMILY / BUSINESS) ---
// ============================================================

app.post('/api/recipes/generate', async (req, res) => {
    try {
        const { groupId, mealType, diners, ignorePantry, customIngredients, pantryItems } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) return res.status(500).json({ error: 'מפתח API חסר בשרת' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        let prompt = `You are a professional family chef. Create a delicious recipe in Hebrew for ${diners} people. Meal type: ${mealType}.\n`;
        if (ignorePantry) prompt += `The user wants to cook using ONLY these specific ingredients: ${customIngredients}.\n`;
        else prompt += `The user wants to cook using these specific items they have selected from their pantry: ${pantryItems}.\nTry to prioritize using these items. You can assume basic staples (salt, pepper, oil, water) are available.\n`;
        prompt += `Provide a catchy title, a short warm description, prep time, a clear list of exact ingredients with amounts, and clear numbered instructions. Format the response nicely using simple Markdown. Make it fun and engaging! Make sure to output simple Markdown TEXT, do not output JSON.`;

        const result = await model.generateContent(prompt);
        res.json({ success: true, recipe: result.response.text() });
    } catch (error) { handleAIError(error, res, 'שגיאה ביצירת המתכון מול ה-AI.'); }
});

app.post('/api/academy/ai-generate', async (req, res) => {
    try {
        const { ageGroup, topic, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `Create a professional 5-question multiple-choice training/onboarding quiz in Hebrew about "${topic}" for employees.
            Requirements: 1. Language MUST be Hebrew. 2. Output strictly as JSON matching this schema:
            { "title": "A clear title for the training", "text_content": "A short professional text before the questions.", "questions": [ { "q": "The question text", "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 0 } ] }`;
        } else {
            prompt = `Create a fun and educational 5-question multiple-choice quiz in Hebrew about "${topic}" for children aged ${ageGroup}.
            Requirements: 1. Language MUST be Hebrew. 2. Output strictly as JSON matching this schema:
            { "title": "A catchy title for the quiz", "text_content": "A short educational text before the questions. Make it engaging.", "questions": [ { "q": "The question text", "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 0 } ] }`;
        }

        const result = await model.generateContent(prompt);
        const quizData = JSON.parse(result.response.text());
        const bundleType = gType === 'BUSINESS' ? 'professional' : 'financial';
        const bundleRes = await pool.query(`INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward) VALUES ($1, $2, $3, $4, 80, 10.0) RETURNING id`, [bundleType, ageGroup, quizData.title, quizData.text_content || '']);
        const newBundleId = bundleRes.rows[0].id;
        for (const q of quizData.questions) await pool.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת הלומדה'); }
});

app.post('/api/tasks/ai-generate', async (req, res) => {
    try {
        const { age, topic, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are an expert organizational manager. Suggest 3 professional tasks, project milestones, or office duties related to the topic: "${topic}". For each task, suggest a fair bonus reward in ILS (integer between 50 and 500).
            Output STRICTLY as a JSON array of objects without any markdown blocks. Example: [{"title": "task 1", "reward": 100}, {"title": "task 2", "reward": 200}]`;
        } else {
            prompt = `You are an expert in parenting. Suggest 3 age-appropriate household chores or educational tasks for a child aged ${age} related to the topic: "${topic}". For each task, suggest a fair monetary reward in ILS (integer between 5 and 50).
            Output STRICTLY as a JSON array of objects without any markdown blocks. Example: [{"title": "task 1", "reward": 10}, {"title": "task 2", "reward": 20}]`;
        }

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();
        let parsedTasks;
        try {
            parsedTasks = JSON.parse(textResult);
            if (!Array.isArray(parsedTasks)) {
                if (parsedTasks.tasks && Array.isArray(parsedTasks.tasks)) parsedTasks = parsedTasks.tasks;
                else parsedTasks = Object.values(parsedTasks).find(val => Array.isArray(val)) || [];
            }
        } catch (parseError) { throw new Error("AI returned invalid JSON format"); }
        res.json({ success: true, tasks: parsedTasks });
    } catch (e) { handleAIError(e, res, 'שגיאה בפירוק המשימות'); }
});

app.post('/api/goals/familai-advice', async (req, res) => {
    try {
        const { userId, goalId, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const userRes = await pool.query('SELECT nickname, birth_year, balance, allowance_amount FROM users WHERE id=$1', [userId]);
        const goalRes = await pool.query('SELECT title, target_amount, current_amount FROM goals WHERE id=$1', [goalId]);
        if (userRes.rows.length === 0 || goalRes.rows.length === 0) throw new Error('Data not found');
        const user = userRes.rows[0]; const goal = goalRes.rows[0]; const age = calculateAge(user.birth_year);
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are a smart business advisor. The department/employee ${user.nickname} is tracking a budget/goal called "${goal.title}". Target: ${goal.target_amount} ILS. Current: ${goal.current_amount} ILS. Write a short, professional, and encouraging message directly to them in Hebrew. Give a practical 2-step plan to achieve this goal efficiently. Keep it under 4 sentences. Use appropriate emojis.`;
        } else {
            prompt = `You are 'familAI', a friendly digital character in a family app. A child named ${user.nickname} (age ${age}) is saving money for a goal called "${goal.title}". Target: ${goal.target_amount} ILS. Current: ${goal.current_amount} ILS. Wallet balance: ${user.balance} ILS. Weekly allowance: ${user.allowance_amount} ILS. Write a short, fun, encouraging message directly to ${user.nickname} in Hebrew. Give a practical 2-step plan to reach their goal faster. Keep it under 4 sentences. Introduce yourself as 'familAI' at the start. Use emojis.`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, advice: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת עצה'); }
});

app.post('/api/budget/familai-insight', async (req, res) => {
    try {
        const { groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const txsRes = await pool.query(`SELECT t.amount, t.category, t.type, u.nickname FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 AND t.date >= date_trunc('month', CURRENT_DATE)`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are an intelligent business financial analyst. Analyze these operational expenses from this month: ${JSON.stringify(txsRes.rows)}. Write a short "Executive Summary" for the management in Hebrew. Mention where most budget went, point out anomalies, and give one smart tip to optimize costs next month. Format as clear, professional text with emojis. Max 4-5 sentences. Start with "שלום הנהלה, מצורף סיכום ביצועי התקציב:"`;
        } else {
            prompt = `You are 'familAI', the intelligent financial advisor for a family. Analyze these family transactions from this month: ${JSON.stringify(txsRes.rows)}. Write a short "Executive Summary" for the parents in Hebrew. Mention where most expenses went, point out if kids are earning/saving well, and give one smart tip to save money next month. Format as clear, encouraging text with emojis. Max 4-5 sentences. Start with "היי הורים, כאן familAI עם סיכום התקציב שלכם!"`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בניתוח התקציב'); }
});

app.post('/api/pantry/familai-insight', async (req, res) => {
    try {
        const { groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const pantryRes = await pool.query('SELECT item_name, quantity, unit, updated_at FROM pantry WHERE group_id=$1', [groupId]);
        const historyRes = await pool.query(`SELECT sti.item_name, sti.quantity, sti.unit, sti.price_per_unit, st.trip_date FROM shopping_trip_items sti JOIN shopping_trips st ON sti.trip_id = st.id WHERE st.group_id=$1 AND st.trip_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are a smart office inventory and procurement manager. Here is the current inventory: ${JSON.stringify(pantryRes.rows)}. Here is the procurement history from the last month: ${JSON.stringify(historyRes.rows)}. Analyze this data in Hebrew. Write a short, smart summary (3-4 sentences) speaking directly to the operations/office manager. Compare what they have to what they usually order, and warn them if they might run out of a critical item soon. Give one smart procurement tip. Use emojis. Do not use Markdown formatting. Start with "דוח מלאי ורכש תקופתי:"`;
        } else {
            prompt = `You are 'familAI', a smart home inventory and grocery manager. Here is the family's current pantry inventory: ${JSON.stringify(pantryRes.rows)}. Here is their shopping history from the last month: ${JSON.stringify(historyRes.rows)}. Analyze this data in Hebrew. Write a short, smart summary (3-4 sentences) speaking directly to the parents. Compare what they have to what they usually buy, and gently warn them if they might run out of a frequently bought item soon. Give one smart shopping tip or savings recommendation. Start with "היי! כאן familAI מנהלת המזווה שלכם 📦" and use emojis. Do not use Markdown formatting.`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בניתוח המלאי'); }
});

app.post('/api/forecast/familai-insight', async (req, res) => {
    try {
        const { groupId, period, mode, targetUserId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        
        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        let txsRes;
        if(targetUserId === 'all') {
            txsRes = await pool.query(`SELECT amount, category, type, is_recurring, description FROM transactions WHERE group_id=$1 AND is_recurring = TRUE`, [groupId]);
        } else {
            txsRes = await pool.query(`SELECT amount, category, type, is_recurring, description FROM transactions WHERE user_id=$1 AND is_recurring = TRUE`, [targetUserId]);
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are a corporate financial advisor. Based on these recurring operational transactions expected for the upcoming ${mode === 'monthly' ? 'month' : 'year'}: ${JSON.stringify(txsRes.rows)}, give a short 2-3 sentence advice in Hebrew on how to prepare and balance the organization's cashflow. Use emojis. Do not use Markdown format.`;
        } else {
            prompt = `You are 'familAI', a financial advisor. Based on these recurring transactions expected for the upcoming ${mode === 'monthly' ? 'month' : 'year'}: ${JSON.stringify(txsRes.rows)}, give a short 2-3 sentence advice in Hebrew on how to prepare and balance their cashflow. Use emojis. Do not use Markdown format.`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בניתוח התשקיף'); }
});

app.post('/api/tasks/vision-verify', async (req, res) => {
    try {
        const { taskId, title, imageBase64, mimeType, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are an AI QA manager. An employee claims they completed the task/ticket: "${title}". Look at the attached image proof. Is the task reasonably completed? Return JSON strictly matching this schema: { "verified": true/false, "message": "Short feedback in Hebrew speaking directly to the employee. If verified, acknowledge it professionally. If not, clarify what is missing." }`;
        } else {
            prompt = `You are 'familAI'. A child claims they completed the task: "${title}". Look at the attached image. Is the task reasonably done? Be forgiving but honest. Return JSON strictly matching this schema: { "verified": true/false, "message": "Short feedback in Hebrew speaking directly to the child. If verified, praise them. If not, nicely tell them what is missing." }`;
        }

        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const feedback = JSON.parse(result.response.text());
        if(feedback.verified) {
            const t = (await pool.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
            const baseReward = parseFloat(t.reward) || 0;
            let bonus = 0;
            if(baseReward > 0) {
                bonus = Math.max(1, Math.round(baseReward * 0.1)); 
            }
            const total = baseReward + bonus;

            await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [total, t.assigned_to]);
            await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`, [t.assigned_to, t.group_id, total, `תגמול משימה (אושר ע"י AI) + בונוס: ${t.title}`]);
            await pool.query('UPDATE tasks SET status = $1, reward = $2 WHERE id = $3', ['approved', total, taskId]);
            
            if(bonus > 0) feedback.message += ` (איזה יופי! קיבלת גם בונוס AI של ₪${bonus}!)`;
        }
        res.json({ success: true, verified: feedback.verified, message: feedback.message });
    } catch (e) { handleAIError(e, res, 'שגיאה בניתוח התמונה'); }
});

app.post('/api/shopping/scan-receipt', async (req, res) => {
    try {
        const { imageBase64, mimeType, userId } = req.body;
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const groupId = uRes.rows[0].group_id;

        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are 'familAI'. Read this Israeli supermarket receipt or business invoice. Extract the items purchased, their quantities, and the SINGLE UNIT PRICE. CRITICAL: If there is more than 1 unit of an item, extract ONLY the price for ONE unit. If the receipt only shows the total price for that row, divide the total price by the quantity to get the unit price. Return JSON strictly matching this array schema: [ { "name": "Item name in Hebrew", "price": 12.50, "qty": 1 } ]`;
        
        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const items = JSON.parse(result.response.text());
        let normalizedArray = [];
        try {
            const names = items.map(i => i.name);
            const normPrompt = `Normalize these product names to generic, brand-less Hebrew names. Return a JSON array of strings in the exact same order. Example: ["חלב תנובה 3%", "במבה אסם 80ג"] -> ["חלב 3%", "במבה"]. Items: ${JSON.stringify(names)}`;
            const normResult = await model.generateContent(normPrompt);
            normalizedArray = JSON.parse(normResult.response.text());
        } catch(e) { console.error(e); }
        
        for (let i = 0; i < items.length; i++) {
             const item = items[i];
             const normName = normalizedArray[i] || item.name;
             await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`, [groupId, userId, item.name, normName, parseFloat(item.qty) || 1, parseFloat(item.price) || 0]);
        }
        res.json({ success: true, count: items.length });
    } catch (e) { handleAIError(e, res, 'שגיאה בקריאת החשבונית'); }
});

app.post('/api/academy/tutor', async (req, res) => {
    try {
        const { question, wrongAnswer, correctAnswer, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const gRes = await pool.query('SELECT type FROM family_groups WHERE id=$1', [groupId]);
        const gType = gRes.rows.length > 0 ? gRes.rows[0].type : 'FAMILY';

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (gType === 'BUSINESS') {
            prompt = `You are a professional corporate trainer. An employee answered a training question incorrectly. Question: "${question}" They answered: "${wrongAnswer}" The correct answer is: "${correctAnswer}". Explain briefly and professionally in Hebrew (2-3 sentences max) why the correct answer is right. Be constructive.`;
        } else {
            prompt = `You are 'familAI', a friendly tutor. A child answered a question incorrectly. Question: "${question}" They answered: "${wrongAnswer}" The correct answer is: "${correctAnswer}". Explain briefly in Hebrew (2-3 sentences max) why the correct answer is right and why their answer was a mistake. Be super encouraging! Start with "היי! כאן familAI...".`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, explanation: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בהבאת ההסבר'); }
});

app.post('/api/guide/chat', async (req, res) => {
    try {
        const { question } = req.body;
        if (!genAI) return res.status(500).json({ success: false, error: 'מפתח API חסר בשרת' });

        let guideText = "";
        try {
            guideText = fs.readFileSync(path.join(__dirname, 'public', 'guide.html'), 'utf-8');
        } catch(e) {
            guideText = "Oneflow Life is a family financial and task management app.";
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', the friendly AI assistant for the 'Oneflow Life' app. 
        A user is reading the user guide and asked a question to understand the system better.
        Here is the full content of the guide HTML:
        ${guideText}
        
        User's question: "${question}"
        
        Answer directly in Hebrew based ONLY on the guide content above. 
        Be concise (3-4 sentences max), friendly, use emojis, and address the user directly. Do not use complex markdown, just basic bolding where needed.`;

        const result = await model.generateContent(prompt);
        res.json({ success: true, answer: result.response.text().trim() });
    } catch (e) {
        console.error('Guide Chat Error:', e);
        res.status(500).json({ success: false, error: 'מצטערת, לא הצלחתי לייצר תשובה כרגע.' });
    }
});


// --- TIME CLOCK ENDPOINTS WITH GPS ---

// שמירת קואורדינטות העסק על ידי המנהל
app.post('/api/timeclock/set-location', async (req, res) => {
    try {
        const { groupId, adminId, lat, lng } = req.body;
        // בדיקה שהמבקש הוא אכן מנהל הארגון
        const uRes = await pool.query('SELECT role FROM users WHERE id=$1 AND group_id=$2', [adminId, groupId]);
        if (uRes.rows.length === 0 || uRes.rows[0].role !== 'ADMIN') return res.status(403).json({error: 'רק מנהל רשאי להגדיר את מיקום העסק'});
        
        await pool.query('UPDATE family_groups SET location_lat=$1, location_lng=$2 WHERE id=$3', [lat, lng, groupId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// בדיקת סטטוס השעון
app.get('/api/timeclock/status', async (req, res) => {
    try {
        const { userId } = req.query;
        const openPunch = await pool.query('SELECT punch_in FROM time_clock WHERE user_id=$1 AND punch_out IS NULL', [userId]);
        res.json({ isPunchedIn: openPunch.rows.length > 0, punchInTime: openPunch.rows.length > 0 ? openPunch.rows[0].punch_in : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// דקירת כניסה/יציאה - עם ולידציה של GPS
app.post('/api/timeclock/punch', async (req, res) => {
    try {
        const { userId, groupId, lat, lng } = req.body;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'לא התקבל מיקום. חובה לאשר גישה למיקום (GPS) כדי לדווח.' });
        }

        // שליפת מיקום העסק
        const gRes = await pool.query('SELECT location_lat, location_lng FROM family_groups WHERE id=$1', [groupId]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
        
        const bizLat = gRes.rows[0].location_lat;
        const bizLng = gRes.rows[0].location_lng;
        
        // אם המנהל לא הגדיר מיקום
        if (!bizLat || !bizLng) {
            return res.status(400).json({ error: 'המנהל טרם הגדיר את מיקום העסק במערכת. פנה להנהלה.' });
        }
        
        // חישוב המרחק במטרים
        const distance = calculateDistance(lat, lng, bizLat, bizLng);
        const MAX_ALLOWED_DISTANCE = 150; // 150 מטר רדיוס (ניתן לשינוי בעתיד)
        
        if (distance > MAX_ALLOWED_DISTANCE) {
            return res.status(403).json({ error: `אינך נמצא בקרבת העסק. מרחק נוכחי: ${Math.round(distance)} מטר. מותר עד ${MAX_ALLOWED_DISTANCE} מטר.` });
        }

        const openPunch = await pool.query('SELECT id, punch_in FROM time_clock WHERE user_id=$1 AND punch_out IS NULL', [userId]);
        if (openPunch.rows.length > 0) {
            // מבצע דיווח יציאה
            const punchId = openPunch.rows[0].id;
            const punchIn = new Date(openPunch.rows[0].punch_in);
            const punchOut = new Date();
            const diffMins = Math.max(0, Math.round((punchOut - punchIn) / 60000));
            await pool.query('UPDATE time_clock SET punch_out=$1, total_minutes=$2 WHERE id=$3', [punchOut, diffMins, punchId]);
            res.json({ success: true, status: 'out' });
        } else {
            // מבצע דיווח כניסה
            await pool.query('INSERT INTO time_clock (user_id, group_id, punch_in) VALUES ($1, $2, CURRENT_TIMESTAMP)', [userId, groupId]);
            res.json({ success: true, status: 'in' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/timeclock/report', async (req, res) => {
    try {
        const { groupId, userId } = req.query;
        let query, params;
        if (userId === 'all') {
            query = `SELECT tc.*, u.nickname FROM time_clock tc JOIN users u ON tc.user_id = u.id WHERE tc.group_id=$1 ORDER BY tc.punch_in DESC`;
            params = [groupId];
        } else {
            query = `SELECT tc.*, u.nickname FROM time_clock tc JOIN users u ON tc.user_id = u.id WHERE tc.user_id=$1 ORDER BY tc.punch_in DESC`;
            params = [userId];
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------
// פונקציות ניהול יצירת סביבות חדשות בצורה בטוחה
// ---------------------------------------------------------

app.post('/api/groups', async (req, res) => {
    let dbClient;
    try {
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        
        let code = generateGroupCode();
        
        // יצירת הקבוצה (משפחה/עסק)
        const gRes = await dbClient.query(
            `INSERT INTO family_groups (type, name, admin_email, group_code) VALUES ($1, $2, $3, $4) RETURNING *`, 
            [req.body.type, req.body.groupName, req.body.adminEmail, code]
        );
        const group = gRes.rows[0];
        
        // המרת שנת הלידה כדי למנוע קריסה
        const birthYear = parseInt(req.body.birthYear) || null;
        
        // יצירת משתמש המנהל
        const uRes = await dbClient.query(
            `INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ADMIN', 'active') RETURNING *`, 
            [group.id, req.body.adminNickname, birthYear, req.body.password]
        );

        // --- הוספת תנועת פתיחה כדי שהקבוצה תופיע מיד למנהל הראשי ---
        const welcomeText = req.body.type === 'BUSINESS' ? 'סביבת עבודה נפתחה בהצלחה! 🎉' : 'הבנק המשפחתי נפתח בהצלחה! 🎉';
        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) 
             VALUES ($1, $2, 0, $3, 'system', 'income', FALSE)`, 
            [uRes.rows[0].id, group.id, welcomeText]
        );
        
        await dbClient.query('COMMIT');
        res.json({ success: true, user: uRes.rows[0], group: group });
        
    } catch (e) { 
        if (dbClient) {
            try { await dbClient.query('ROLLBACK'); } catch(rbErr) { console.error('Rollback failed', rbErr); }
        }
        console.error("Create Group Error:", e);
        
        if (e.message && e.message.includes('unique constraint')) {
            res.status(400).json({ error: 'כתובת המייל הזו כבר רשומה במערכת.' });
        } else {
            res.status(500).json({ error: 'שגיאת שרת: ' + e.message });
        }
    } finally { 
        if (dbClient) dbClient.release(); 
    }
});

app.post('/api/join', async (req, res) => {
    try {
        const { groupCode, nickname, birthYear, password, role } = req.body;
        if (!groupCode || !nickname || !password) return res.status(400).json({ error: 'חסרים נתונים חובה' });
        
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד ארגון/משפחה לא חוקי' });
        
        const group = gRes.rows[0];
        const reqRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        const bYear = parseInt(birthYear) || null;
        
        await pool.query(
            `INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, 
            [group.id, nickname, bYear, password, reqRole]
        );
        res.json({ success: true });
    } catch (e) { 
        console.error("Join Error:", e);
        res.status(500).json({ error: 'שגיאת שרת: ' + e.message }); 
    }
});

app.post('/api/login', async (req, res) => {
    try {
        if (!req.body.groupCode || !req.body.nickname || !req.body.password) {
            return res.status(400).json({ error: 'חסרים פרטי התחברות' });
        }
        
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [req.body.groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד שגוי' });
        
        const group = gRes.rows[0];
        const uRes = await pool.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2 AND password_hash = $3', [group.id, req.body.nickname, req.body.password]);
        
        if (uRes.rows.length === 0) return res.status(401).json({ error: 'כינוי או סיסמה שגויים' });
        if (uRes.rows[0].status !== 'active') return res.status(403).json({ error: 'חשבון ממתין לאישור מנהל' });
        
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) { 
        console.error("Login Error:", e);
        res.status(500).json({ error: 'שגיאת שרת: ' + e.message }); 
    }
});

// האזנה לשרת - חובה ב-Render או כל סביבה שמריצה את האפליקציה!
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
