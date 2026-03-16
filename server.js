const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
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

// --- פונקציית ניהול "סוללת AI" ומנויי Premium ---
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
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS family_groups CASCADE;
            DROP TABLE IF EXISTS system_settings CASCADE;
            DROP TABLE IF EXISTS global_products CASCADE;

            CREATE TABLE system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT);
            CREATE TABLE family_groups (id SERIAL PRIMARY KEY, name VARCHAR(100), type VARCHAR(20) DEFAULT 'FAMILY', admin_email VARCHAR(100) UNIQUE, group_code VARCHAR(10) UNIQUE, ai_tokens INT DEFAULT 10, last_token_reset DATE DEFAULT CURRENT_DATE, is_premium BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE users (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, nickname VARCHAR(50), birth_year INT, password_hash VARCHAR(100), role VARCHAR(20) DEFAULT 'MEMBER', status VARCHAR(20) DEFAULT 'pending', balance DECIMAL(10,2) DEFAULT 0.00, allowance_amount DECIMAL(10,2) DEFAULT 0.00, interest_rate DECIMAL(5,2) DEFAULT 0.00);
            
            -- מעודכן לתמוך בתזרים (פעולות קבועות ותאריכים עתידיים)
            CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, amount DECIMAL(10,2), description VARCHAR(255), category VARCHAR(50), type VARCHAR(20), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_manual BOOLEAN DEFAULT TRUE, is_recurring BOOLEAN DEFAULT FALSE, end_date TIMESTAMP);
            
            CREATE TABLE tasks (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, created_by INT REFERENCES users(id), assigned_to INT REFERENCES users(id), title VARCHAR(255), reward DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', deadline TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE budget_allocations (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, category VARCHAR(50), target_user_id INT REFERENCES users(id) ON DELETE CASCADE, amount_limit DECIMAL(10,2) DEFAULT 0.00, UNIQUE(group_id, category, target_user_id));
            CREATE TABLE goals (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, target_user_id INT REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(255), target_amount DECIMAL(10,2), current_amount DECIMAL(10,2) DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE loans (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, original_amount DECIMAL(10,2), remaining_amount DECIMAL(10,2), reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_list (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, requester_id INT REFERENCES users(id), item_name VARCHAR(100), normalized_name VARCHAR(100), quantity DECIMAL(10,2) DEFAULT 1, unit VARCHAR(20) DEFAULT 'יח''', estimated_price DECIMAL(10,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_trips (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, buyer_id INT REFERENCES users(id), store_name VARCHAR(100), branch_name VARCHAR(100), total_amount DECIMAL(10,2), trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE shopping_trip_items (id SERIAL PRIMARY KEY, trip_id INT REFERENCES shopping_trips(id) ON DELETE CASCADE, item_name VARCHAR(100), normalized_name VARCHAR(100), quantity DECIMAL(10,2), unit VARCHAR(20) DEFAULT 'יח''', price_per_unit DECIMAL(10,2));
            CREATE TABLE pantry (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, item_name VARCHAR(100), quantity DECIMAL(10,2) DEFAULT 1, unit VARCHAR(20) DEFAULT 'יח''', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE quiz_bundles (id SERIAL PRIMARY KEY, type VARCHAR(20), age_group VARCHAR(10), title VARCHAR(255), text_content TEXT, threshold INT DEFAULT 85, reward DECIMAL(10,2) DEFAULT 10.00, created_by VARCHAR(50) DEFAULT 'SYSTEM', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE quiz_questions (id SERIAL PRIMARY KEY, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, q TEXT, options JSONB, correct INT);
            CREATE TABLE user_assignments (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'assigned', score INT, custom_reward DECIMAL(10,2), deadline TIMESTAMP, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            
            CREATE TABLE global_products (barcode VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(50) DEFAULT 'כללי', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>DB tables fully reset and updated! (Includes support for Forecast & Recurring Transactions)</p><a href="/">Go to App</a>');
    } catch (e) { res.status(500).send(e.message); }
});

// --- SUPER ADMIN ENDPOINTS ---
const SA_CODE = 'admin';
const SA_PASS = '123456';

app.post('/api/superadmin/login', (req, res) => {
    const { code, password } = req.body;
    if (code === SA_CODE && password === SA_PASS) res.json({ success: true, token: 'SA_SECRET_TOKEN_2026' });
    else res.status(401).json({ error: 'פרטי גישה שגויים לניהול מערכת' });
});

const verifySA = (req, res, next) => {
    if (req.headers.authorization !== 'SA_SECRET_TOKEN_2026') return res.status(403).json({error: 'Forbidden'});
    next();
};

app.get('/api/superadmin/data', verifySA, async (req, res) => {
    try {
        const groups = await pool.query('SELECT * FROM family_groups ORDER BY created_at DESC');
        const users = await pool.query('SELECT * FROM users ORDER BY group_id, id');
        const activity = await pool.query('SELECT t.amount, t.description, t.date, t.type, u.nickname as user_name, f.name as group_name FROM transactions t JOIN users u ON t.user_id = u.id JOIN family_groups f ON t.group_id = f.id ORDER BY t.date DESC LIMIT 50');
        const settings = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('welcome_msg', 'ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom')");
        
        let unifiedActivity = [];
        activity.rows.forEach(a => { unifiedActivity.push({ date: a.date, group_name: a.group_name, user_name: a.user_name, description: a.description, amount: a.amount, is_financial: true }); });
        groups.rows.forEach(g => {
            const adminUser = users.rows.find(u => u.group_id === g.id && u.role === 'ADMIN');
            unifiedActivity.push({ date: g.created_at, group_name: g.name, user_name: adminUser ? adminUser.nickname : 'מנהל', description: '🎉 פתח/ה משפחה חדשה', amount: 0, is_financial: false });
        });
        unifiedActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        res.json({
            groups: groups.rows, users: users.rows, activity: unifiedActivity.slice(0, 50),
            welcomeMsg: settings.rows.find(r => r.key === 'welcome_msg')?.value || '',
            adBannerTextTop: settings.rows.find(r => r.key === 'ad_banner_text_top')?.value || '',
            adBannerLinkTop: settings.rows.find(r => r.key === 'ad_banner_link_top')?.value || '',
            adBannerImgTop: settings.rows.find(r => r.key === 'ad_banner_img_top')?.value || '',
            adBannerTextBottom: settings.rows.find(r => r.key === 'ad_banner_text_bottom')?.value || '',
            adBannerLinkBottom: settings.rows.find(r => r.key === 'ad_banner_link_bottom')?.value || '',
            adBannerImgBottom: settings.rows.find(r => r.key === 'ad_banner_img_bottom')?.value || ''
        });
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
        if (req.body.adBannerTextTop !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_text_top', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerTextTop]);
        if (req.body.adBannerLinkTop !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_link_top', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerLinkTop]);
        if (req.body.adBannerImgTop !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_img_top', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerImgTop]);
        if (req.body.adBannerTextBottom !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_text_bottom', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerTextBottom]);
        if (req.body.adBannerLinkBottom !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_link_bottom', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerLinkBottom]);
        if (req.body.adBannerImgBottom !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('ad_banner_img_bottom', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.adBannerImgBottom]);
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
        const s = await pool.query("SELECT value FROM system_settings WHERE key = 'welcome_msg'");
        res.json({ message: s.rows.length > 0 ? s.rows[0].value : '' });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/banners', async (req, res) => {
    try {
        const result = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ('ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom')`);
        const banners = {};
        result.rows.forEach(r => { banners[r.key.replace('ad_', '')] = r.value; });
        res.json({ success: true, banners: { 
            banner_top_text: banners['banner_text_top'], 
            banner_top_link: banners['banner_link_top'], 
            banner_top_img: banners['banner_img_top'], 
            banner_bottom_text: banners['banner_text_bottom'], 
            banner_bottom_link: banners['banner_link_bottom'],
            banner_bottom_img: banners['banner_img_bottom']
        } });
    } catch(e) { res.json({ success: false, error: e.message, banners: {} }); }
});

app.post('/api/superadmin/banners', verifySA, async (req, res) => {
    const { topText, topLink, topImg, bottomText, bottomLink, bottomImg } = req.body;
    const items = [ 
        { k: 'ad_banner_text_top', v: topText || '' }, 
        { k: 'ad_banner_link_top', v: topLink || '' }, 
        { k: 'ad_banner_img_top', v: topImg || '' },
        { k: 'ad_banner_text_bottom', v: bottomText || '' }, 
        { k: 'ad_banner_link_bottom', v: bottomLink || '' },
        { k: 'ad_banner_img_bottom', v: bottomImg || '' }
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

// --- EMAIL CREDENTIALS ---
app.post('/api/admin/send-credentials', async (req, res) => {
    try {
        const { groupId, adminId } = req.body;
        const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1 AND group_id = $2", [adminId, groupId]);
        if(adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') return res.status(403).json({error: "רק מנהל משפחה מורשה לבצע פעולה זו"});

        const groupRes = await pool.query("SELECT admin_email, name FROM family_groups WHERE id = $1", [groupId]);
        if(groupRes.rows.length === 0 || !groupRes.rows[0].admin_email) return res.status(400).json({error: "לא נמצאה כתובת מייל מוגדרת למשפחה זו. אנא ודאו שהזנתם מייל בעת ההרשמה."});
        const adminEmail = groupRes.rows[0].admin_email;
        const groupName = groupRes.rows[0].name;

        const usersRes = await pool.query("SELECT nickname, password_hash, role FROM users WHERE group_id = $1 ORDER BY role, nickname", [groupId]);
        
        let emailContent = `שלום מנהל/ת משפחת ${groupName},\n\nלהלן פרטי הגישה של כל בני הבית למערכת Oneflow Life:\n\n`;
        usersRes.rows.forEach(u => {
            const roleStr = u.role === 'ADMIN' ? 'מנהל/הורה' : 'ילד/בן משפחה';
            emailContent += `שם משתמש: ${u.nickname}\nסיסמה: ${u.password_hash}\nתפקיד: ${roleStr}\n---\n`;
        });
        emailContent += `\nבברכה,\nצוות Oneflow Life`;

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: `"Oneflow Life" <${process.env.SMTP_USER}>`,
                to: adminEmail,
                subject: 'Oneflow Life - פרטי הגישה של המשפחה',
                text: emailContent
            });
        }

        res.json({ success: true });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// --- GLOBAL PRODUCTS (BARCODES) ---
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT barcode, name, category FROM global_products');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { barcode, name, category } = req.body;
        if (!barcode || !name) return res.status(400).json({ error: 'חסר ברקוד או שם מוצר' });
        await pool.query(
            `INSERT INTO global_products (barcode, name, category) VALUES ($1, $2, $3) ON CONFLICT (barcode) DO NOTHING`, 
            [barcode, name, category || 'כללי']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- FORECAST / CASHFLOW ENDPOINTS ---

app.get('/api/forecast', async (req, res) => {
    try {
        const { groupId, userId, period, mode } = req.query; // period: 'YYYY-MM' or 'YYYY', mode: 'monthly' or 'yearly'
        if (!groupId || !period) return res.json({ startingBalance: 0, items: [] });
        
        let targetStartDate, targetEndDate;
        const isYearly = mode === 'yearly';

        if (isYearly) {
            targetStartDate = new Date(`${period}-01-01T00:00:00`);
            targetEndDate = new Date(`${period}-12-31T23:59:59`);
        } else {
            targetStartDate = new Date(`${period}-01T00:00:00`);
            targetEndDate = new Date(targetStartDate.getFullYear(), targetStartDate.getMonth() + 1, 0, 23, 59, 59);
        }
        
        let userFilter = '';
        let params = [groupId];
        if (userId && userId !== 'all') {
            userFilter = ` AND t.user_id = $2`;
            params.push(userId);
        }

        // שולפים את כל הפעולות הרלוונטיות של המשפחה/המשתמש (כולל קבועות ועתידיות)
        const query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 ${userFilter} ORDER BY t.date ASC`;
        const txRes = await pool.query(query, params);
        const allTxs = txRes.rows;

        // חישוב יתרת הבסיס האמיתית כרגע
        let currentBal = 0;
        if (userId && userId !== 'all') {
            const uRes = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
            currentBal = parseFloat(uRes.rows[0].balance) || 0;
        } else {
            const uRes = await pool.query('SELECT SUM(balance) as bal FROM users WHERE group_id=$1 AND status=\'active\'', [groupId]);
            currentBal = parseFloat(uRes.rows[0].bal) || 0;
        }

        let startingBalance = currentBal;
        let items = [];
        const now = new Date();
        
        // חישוב הפעולות מנקודת הזמן הנוכחית ועד סוף התקופה המבוקשת
        allTxs.forEach(tx => {
            const txDate = new Date(tx.date);
            const amt = parseFloat(tx.amount);
            const isIncome = tx.type === 'income';
            
            if (tx.is_recurring) {
                const endDate = tx.end_date ? new Date(tx.end_date) : new Date(targetStartDate.getFullYear() + 10, 11, 31);
                
                let tempDate = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
                
                // משפיע על יתרת הפתיחה רק מ"עכשיו" ועד תחילת התקופה המבוקשת
                if (tempDate < now) tempDate.setMonth(now.getMonth() + 1); // מדלג על מה שכבר חושב בעבר ביתרה האמיתית
                
                while (tempDate > now && tempDate < targetStartDate && tempDate <= endDate) {
                     startingBalance += isIncome ? amt : -amt;
                     tempDate.setMonth(tempDate.getMonth() + 1);
                }

                // הוספת הפעולות המשתכפלות לתוך התקופה המבוקשת עצמה (חודש ספציפי או שנה שלמה)
                let itemTempDate = new Date(tempDate); 
                if (itemTempDate < targetStartDate) itemTempDate = new Date(targetStartDate.getFullYear(), targetStartDate.getMonth(), txDate.getDate());
                
                while (itemTempDate >= targetStartDate && itemTempDate <= targetEndDate && itemTempDate <= endDate) {
                    items.push({
                        id: tx.id,
                        type: tx.type,
                        amount: amt,
                        description: tx.description,
                        category: tx.category,
                        user_name: tx.user_name,
                        date_str: itemTempDate.toLocaleDateString('he-IL'),
                        timestamp: itemTempDate.getTime(),
                        is_recurring: true
                    });
                    itemTempDate.setMonth(itemTempDate.getMonth() + 1);
                }

            } else {
                // פעולה חד פעמית רגילה
                if (txDate >= targetStartDate && txDate <= targetEndDate) {
                    items.push({
                        id: tx.id,
                        type: tx.type,
                        amount: amt,
                        description: tx.description,
                        category: tx.category,
                        user_name: tx.user_name,
                        date_str: txDate.toLocaleDateString('he-IL'),
                        timestamp: txDate.getTime(),
                        is_recurring: false
                    });
                } else if (txDate > now && txDate < targetStartDate) {
                    startingBalance += isIncome ? amt : -amt;
                }
            }
        });

        // מיון לפי תאריך עולה
        items.sort((a, b) => a.timestamp - b.timestamp);

        res.json({ startingBalance: startingBalance, items });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/forecast/familai-insight', async (req, res) => {
    try {
        const { groupId, period, mode, targetUserId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        let userFilter = ''; let params = [groupId];
        if (targetUserId && targetUserId !== 'all') { userFilter = ` AND user_id = $2`; params.push(targetUserId); }

        const query = `SELECT amount, description, category, type, date, is_recurring FROM transactions WHERE group_id=$1 ${userFilter} AND (date >= CURRENT_DATE OR is_recurring = TRUE)`;
        const txsRes = await pool.query(query, params);

        const periodName = mode === 'yearly' ? `שנת ${period}` : `חודש ${period}`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', a smart financial forecaster for a family. Analyze these upcoming/recurring transactions for the requested period: ${JSON.stringify(txsRes.rows)}. Write a short, smart forecast insight for the upcoming period (${periodName}) in Hebrew. Max 3-4 sentences. Be encouraging, point out if they have heavy expenses coming up in certain categories, and give one tip on how to prepare. Use emojis. Start with "היי! כאן familAI רואת העתידות 🔮"`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בתובנות התשקיף'); }
});


// --- AI ENDPOINTS ---
app.post('/api/recipes/generate', async (req, res) => {
    try {
        const { groupId, mealType, diners, ignorePantry, customIngredients, pantryItems } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) return res.status(500).json({ error: 'מפתח API של בינה מלאכותית חסר בשרת' });

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

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Create a fun and educational 5-question multiple-choice quiz in Hebrew about "${topic}" for children aged ${ageGroup}.
        Requirements: 1. Language MUST be Hebrew. 2. Output strictly as JSON matching this schema exactly:
        { "title": "A catchy title for the quiz", "text_content": "A short educational text before the questions. Make it engaging.", "questions": [ { "q": "The question text", "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 0 } ] }`;

        const result = await model.generateContent(prompt);
        const quizData = JSON.parse(result.response.text());
        const bundleRes = await pool.query(`INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward) VALUES ('financial', $1, $2, $3, 80, 10.0) RETURNING id`, [ageGroup, quizData.title, quizData.text_content || '']);
        const newBundleId = bundleRes.rows[0].id;
        for (const q of quizData.questions) await pool.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת המבחן'); }
});

app.post('/api/tasks/ai-generate', async (req, res) => {
    try {
        const { age, topic, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are an expert in parenting. Suggest 3 age-appropriate household chores or educational tasks for a child aged ${age} related to the topic: "${topic}". For each task, suggest a fair monetary reward in ILS (integer between 5 and 50).
        Output STRICTLY as a JSON array of objects without any markdown blocks. Example: [{"title": "task 1", "reward": 10}, {"title": "task 2", "reward": 20}]`;

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
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת המשימות'); }
});

app.post('/api/goals/familai-advice', async (req, res) => {
    try {
        const { userId, goalId, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const userRes = await pool.query('SELECT nickname, birth_year, balance, allowance_amount FROM users WHERE id=$1', [userId]);
        const goalRes = await pool.query('SELECT title, target_amount, current_amount FROM goals WHERE id=$1', [goalId]);
        if (userRes.rows.length === 0 || goalRes.rows.length === 0) throw new Error('Data not found');
        const user = userRes.rows[0]; const goal = goalRes.rows[0]; const age = calculateAge(user.birth_year);
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', a friendly digital character in a family app. A child named ${user.nickname} (age ${age}) is saving money for a goal called "${goal.title}". Target: ${goal.target_amount} ILS. Current: ${goal.current_amount} ILS. Wallet balance: ${user.balance} ILS. Weekly allowance: ${user.allowance_amount} ILS. Write a short, fun, encouraging message directly to ${user.nickname} in Hebrew. Give a practical 2-step plan to reach their goal faster. Keep it under 4 sentences. Introduce yourself as 'familAI' at the start. Use emojis.`;

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

        const txsRes = await pool.query(`SELECT t.amount, t.category, t.type, u.nickname FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 AND t.date >= date_trunc('month', CURRENT_DATE)`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', the intelligent financial advisor for a family. Analyze these family transactions from this month: ${JSON.stringify(txsRes.rows)}. Write a short "Executive Summary" for the parents in Hebrew. Mention where most expenses went, point out if kids are earning/saving well, and give one smart tip to save money next month. Format as clear, encouraging text with emojis. Max 4-5 sentences. Start with "היי הורים, כאן familAI עם סיכום התקציב שלכם!"`;
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

        const pantryRes = await pool.query('SELECT item_name, quantity, unit, updated_at FROM pantry WHERE group_id=$1', [groupId]);
        const historyRes = await pool.query(`SELECT sti.item_name, sti.quantity, sti.unit, sti.price_per_unit, st.trip_date FROM shopping_trip_items sti JOIN shopping_trips st ON sti.trip_id = st.id WHERE st.group_id=$1 AND st.trip_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', a smart home inventory and grocery manager. Here is the family's current pantry inventory: ${JSON.stringify(pantryRes.rows)}. Here is their shopping history from the last month: ${JSON.stringify(historyRes.rows)}. Analyze this data in Hebrew. Write a short, smart summary (3-4 sentences) speaking directly to the parents. Compare what they have to what they usually buy, and gently warn them if they might run out of a frequently bought item soon. Give one smart shopping tip or savings recommendation. Start with "היי! כאן familAI מנהלת המזווה שלכם 📦" and use emojis. Do not use Markdown formatting.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בניתוח המזווה'); }
});

app.post('/api/shopping/identify-product', async (req, res) => {
    try {
        const { imageBase64, mimeType, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig: { responseMimeType: "application/json" } 
        });
        
        const prompt = `You are 'familAI', a smart grocery scanning assistant. 
        Look at the attached image and identify the main grocery or household product shown in it. 
        Return JSON strictly matching this schema: 
        { "productName": "Generic Hebrew name of the product (e.g. 'חלב תנובה 3%', 'קורנפלקס', 'נייר טואלט')" }. 
        If the image is completely unclear or there is no product, return: { "error": "Could not identify" }.`;

        const result = await model.generateContent([ 
            prompt, 
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } 
        ]);
        
        const aiResponse = JSON.parse(result.response.text());
        
        if (aiResponse.error) {
            return res.json({ success: false, error: 'לא מצאתי מוצר ברור בתמונה.' });
        }
        
        res.json({ success: true, productName: aiResponse.productName });
    } catch (e) { 
        handleAIError(e, res, 'שגיאה בזיהוי המוצר מול השרת'); 
    }
});

app.post('/api/tasks/vision-verify', async (req, res) => {
    try {
        const { taskId, title, imageBase64, mimeType, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are 'familAI'. A child claims they completed the task: "${title}". Look at the attached image. Is the task reasonably done? Be forgiving but honest. Return JSON strictly matching this schema: { "verified": true/false, "message": "Short feedback in Hebrew speaking directly to the child. If verified, praise them. If not, nicely tell them what is missing." }`;
        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const feedback = JSON.parse(result.response.text());
        if(feedback.verified) {
            const t = (await pool.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
            const baseReward = parseFloat(t.reward) || 0;
            let bonus = 0;
            if(baseReward > 0) {
                bonus = Math.max(1, Math.round(baseReward * 0.1)); // 10% בונוס מינימום 1 ש"ח
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
        const prompt = `You are 'familAI'. Read this Israeli supermarket receipt. Extract the items purchased, their quantities, and the total price per row. Return JSON strictly matching this array schema: [ { "name": "Item name in Hebrew", "price": 12.50, "qty": 1 } ]`;
        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const items = JSON.parse(result.response.text());
        let normalizedArray = [];
        try {
            const names = items.map(i => i.name);
            const normPrompt = `Normalize these grocery product names to generic, brand-less Hebrew names. Return a JSON array of strings in the exact same order. Example: ["חלב תנובה 3%", "במבה אסם 80ג"] -> ["חלב 3%", "במבה"]. Items: ${JSON.stringify(names)}`;
            const normResult = await model.generateContent(normPrompt);
            normalizedArray = JSON.parse(normResult.response.text());
        } catch(e) { console.error(e); }
        
        for (let i = 0; i < items.length; i++) {
             const item = items[i];
             const normName = normalizedArray[i] || item.name;
             await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`, [groupId, userId, item.name, normName, item.qty || 1, item.price || 0]);
        }
        res.json({ success: true, count: items.length });
    } catch (e) { handleAIError(e, res, 'שגיאה בקריאת הקבלה'); }
});

app.post('/api/academy/tutor', async (req, res) => {
    try {
        const { question, wrongAnswer, correctAnswer, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are 'familAI', a friendly tutor. A child answered a question incorrectly. Question: "${question}" They answered: "${wrongAnswer}" The correct answer is: "${correctAnswer}". Explain briefly in Hebrew (2-3 sentences max) why the correct answer is right and why their answer was a mistake. Be super encouraging! Start with "היי! כאן familAI...".`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, explanation: result.response.text().trim() });
    } catch (e) { handleAIError(e, res, 'שגיאה בהבאת ההסבר'); }
});

// --- BASIC API ENDPOINTS ---
app.post('/api/groups', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        let code = generateGroupCode();
        const gRes = await dbClient.query(`INSERT INTO family_groups (type, name, admin_email, group_code) VALUES ($1, $2, $3, $4) RETURNING *`, [req.body.type, req.body.groupName, req.body.adminEmail, code]);
        const group = gRes.rows[0];
        const uRes = await dbClient.query(`INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ADMIN', 'active') RETURNING *`, [group.id, req.body.adminNickname, req.body.birthYear, req.body.password]);
        await dbClient.query('COMMIT');
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/join', async (req, res) => {
    try {
        const { groupCode, nickname, birthYear, password, role } = req.body;
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד משפחה לא חוקי' });
        const group = gRes.rows[0];
        const reqRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        await pool.query(`INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [group.id, nickname, birthYear, password, reqRole]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [req.body.groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד משפחה שגוי' });
        const group = gRes.rows[0];
        const uRes = await pool.query('SELECT * FROM users WHERE group_id = $1 AND nickname = $2 AND password_hash = $3', [group.id, req.body.nickname, req.body.password]);
        if (uRes.rows.length === 0) return res.status(401).json({ error: 'כינוי או סיסמה שגויים' });
        if (uRes.rows[0].status !== 'active') return res.status(403).json({ error: 'חשבון ממתין לאישור מנהל' });
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const u = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (u.rows.length > 0) res.json(u.rows[0]); else res.status(404).json({error: 'Not found'});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/users/:id/password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const updateRes = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3 RETURNING id",
            [newPassword, req.params.id, oldPassword]
        );
        if (updateRes.rows.length === 0) return res.status(400).json({error: "סיסמה נוכחית שגויה"});
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { adminId } = req.query;
        const adminCheck = await pool.query("SELECT group_id FROM users WHERE id = $1 AND role = 'ADMIN'", [adminId]);
        if (adminCheck.rows.length === 0) return res.status(403).json({error: "Only admins can delete users"});
        const groupId = adminCheck.rows[0].group_id;
        await pool.query("DELETE FROM users WHERE id = $1 AND group_id = $2", [req.params.id, groupId]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/data/:userId', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.userId]);
        if(uRes.rows.length===0) return res.status(404).json({error: 'No user'});
        const user = uRes.rows[0];

        const gRes = await pool.query('SELECT ai_tokens, is_premium, last_token_reset FROM family_groups WHERE id=$1', [user.group_id]);
        const groupData = gRes.rows[0] || { ai_tokens: 10, is_premium: false };

        let tasksRes={rows:[]}, shopRes={rows:[]}, allBRes={rows:[]}, pantryRes={rows:[]};
        try { tasksRes = await pool.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id=$1 ORDER BY t.id DESC`, [user.group_id]); } catch(e){ }
        
        try { 
            const sRes = await pool.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requester_id = u.id WHERE s.group_id=$1 ORDER BY s.id DESC`, [user.group_id]); 
            shopRes.rows = sRes.rows;
            for (let i = 0; i < shopRes.rows.length; i++) {
                const item = shopRes.rows[i];
                const searchName = item.normalized_name || item.item_name;
                const bestPriceRes = await pool.query(`
                    SELECT sti.price_per_unit, st.store_name, st.branch_name, st.trip_date
                    FROM shopping_trip_items sti
                    JOIN shopping_trips st ON sti.trip_id = st.id
                    WHERE st.group_id = $1 AND (sti.normalized_name = $2 OR sti.item_name = $3)
                    ORDER BY sti.price_per_unit ASC LIMIT 1
                `, [user.group_id, searchName, searchName]);
                if (bestPriceRes.rows.length > 0) item.best_price = bestPriceRes.rows[0];
            }
        } catch(e){ }
        
        try { allBRes = await pool.query(`SELECT id, type, age_group, title, reward, threshold, created_at FROM quiz_bundles ORDER BY id DESC`); } catch(e){ }
        try { pantryRes = await pool.query(`SELECT * FROM pantry WHERE group_id=$1 ORDER BY item_name ASC`, [user.group_id]); } catch(e){ }

        let goalsRes = {rows:[]}, weeklyStats = null, userBundles = [];

        if(user.role === 'ADMIN') {
            try { goalsRes = await pool.query(`SELECT g.*, u.nickname as owner_name FROM goals g LEFT JOIN users u ON g.target_user_id = u.id WHERE g.user_id=$1 OR g.target_user_id IN (SELECT id FROM users WHERE group_id=$2)`, [user.id, user.group_id]); } catch(e){}
            try { 
                const ubRes = await pool.query(`SELECT ua.status, ua.score, ua.custom_reward, ua.deadline, ua.assigned_at, ua.user_id as assigned_to_user, qb.id as bundle_id, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content, u.nickname as assignee_name FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id JOIN users u ON ua.user_id = u.id WHERE u.group_id = $1 ORDER BY ua.id DESC`, [user.group_id]); 
                userBundles = ubRes.rows;
            } catch(e){ }
        } else {
            try { goalsRes = await pool.query(`SELECT * FROM goals WHERE target_user_id=$1`, [user.id]); } catch(e){}
            try { 
                const spentRes = await pool.query(`SELECT COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id=$1 AND type='expense' AND date >= date_trunc('week', CURRENT_DATE)`, [user.id]);
                const limitRes = await pool.query(`SELECT COALESCE(amount_limit, 0) as limit FROM budget_allocations WHERE target_user_id=$1 AND category='allowance_spend'`, [user.id]);
                weeklyStats = { spent: spentRes.rows[0].spent, limit: limitRes.rows.length > 0 ? limitRes.rows[0].limit : user.allowance_amount * 0.2 };
            } catch(e){}
            try {
                const ubRes = await pool.query(`SELECT ua.status, ua.score, ua.custom_reward, ua.deadline, ua.assigned_at, ua.user_id as assigned_to_user, qb.id as bundle_id, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content, u.nickname as assignee_name FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id JOIN users u ON ua.user_id = u.id WHERE ua.user_id = $1 ORDER BY ua.id DESC`, [user.id]);
                userBundles = ubRes.rows;
                const activeBundleIds = userBundles.filter(b => b.status === 'assigned').map(b => b.bundle_id);
                if (activeBundleIds.length > 0) {
                    const qRes = await pool.query(`SELECT id, bundle_id, q, options, correct FROM quiz_questions WHERE bundle_id = ANY($1::int[])`, [activeBundleIds]);
                    userBundles.forEach(b => {
                        if (b.status === 'assigned') b.questions = qRes.rows.filter(q => q.bundle_id === b.bundle_id);
                    });
                }
            } catch(e){ }
        }

        res.json({
            user: user, group: groupData, tasks: tasksRes.rows || [], shopping_list: shopRes.rows || [], goals: goalsRes.rows || [],
            weekly_stats: weeklyStats, quiz_bundles: userBundles || [], all_bundles: allBRes.rows || [], pantry: pantryRes.rows || []
        });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const { groupId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        const users = await pool.query(`SELECT * FROM users WHERE group_id = $1 AND status = 'pending'`, [groupId]);
        res.json(users.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/approve-user', async (req, res) => {
    try {
        await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [req.body.userId]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/group/members', async (req, res) => {
    try {
        const { requesterId, groupId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        const uReq = await pool.query('SELECT role FROM users WHERE id=$1', [requesterId]);
        const isAdmin = uReq.rows[0].role === 'ADMIN';
        let members;
        try { members = await pool.query('SELECT id, nickname, role, birth_year, balance, allowance_amount, interest_rate FROM users WHERE group_id=$1 AND status=$2', [groupId, 'active']); } 
        catch(e) { members = await pool.query('SELECT id, nickname, role, birth_year, balance FROM users WHERE group_id=$1 AND status=$2', [groupId, 'active']); }
        if(isAdmin) res.json(members.rows);
        else res.json(members.rows.map(m => ({id: m.id, nickname: m.nickname, role: m.role, birth_year: m.birth_year, balance: m.id == requesterId ? m.balance : null})));
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/update-settings', async (req, res) => {
    try {
        await pool.query(`UPDATE users SET allowance_amount=$1, interest_rate=$2 WHERE id=$3`, [req.body.allowance || 0, req.body.interest || 0, req.body.userId]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// פונקציה חדשה: ניהול יתרה של הילד (קנס/בונוס ידני ע"י ההורה)
app.post('/api/admin/adjust-balance', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { adminId, groupId, childId, type, amount, reason } = req.body;

        // בדיקה שמי שמבצע את הפעולה הוא אכן הורה/מנהל באותה קבוצה
        const adminCheck = await dbClient.query(`SELECT role FROM users WHERE id = $1 AND group_id = $2`, [adminId, groupId]);
        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') {
            await dbClient.query('ROLLBACK');
            return res.status(403).json({ error: 'אין הרשאת מנהל לביצוע פעולה זו' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            await dbClient.query('ROLLBACK');
            return res.status(400).json({ error: 'סכום לא תקין' });
        }

        const isAdd = type === 'add';
        const op = isAdd ? '+' : '-';
        const txType = isAdd ? 'income' : 'expense';
        const txCategory = 'other'; // קטגוריה כללית
        const descPrefix = isAdd ? 'בונוס/הוספה יזומה:' : 'קנס/הפחתה יזומה:';
        const finalReason = reason ? reason : (isAdd ? 'ללא סיבה' : 'ללא סיבה');

        // עדכון היתרה של הילד
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id = $2 AND group_id = $3`, [parsedAmount, childId, groupId]);

        // רישום הפעולה כעסקה בפיד (כדי שהילד וההורה יראו על מה ירד/נוסף כסף)
        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
            [childId, groupId, parsedAmount, `${descPrefix} ${finalReason}`, txCategory, txType]
        );

        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        dbClient.release();
    }
});

app.post('/api/admin/payday', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const children = await dbClient.query(`SELECT id, allowance_amount, interest_rate, balance FROM users WHERE group_id=$1 AND role='MEMBER' AND status='active'`, [req.body.groupId]);
        let totalDistributed = 0;
        for(let child of children.rows) {
            const allowance = parseFloat(child.allowance_amount) || 0;
            let interest = 0;
            const spentRes = await dbClient.query(`SELECT COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id=$1 AND type='expense' AND date >= date_trunc('week', CURRENT_DATE - INTERVAL '7 days') AND date < date_trunc('week', CURRENT_DATE)`, [child.id]);
            const spent = parseFloat(spentRes.rows[0].spent);
            const limit = allowance * 0.2; 
            if (spent <= limit && parseFloat(child.balance) > 0) interest = parseFloat(child.balance) * ((parseFloat(child.interest_rate)||0) / 100);
            const totalAdded = allowance + interest;
            if(totalAdded > 0) {
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [totalAdded, child.id]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'allowance', 'income', FALSE)`, [child.id, req.body.groupId, totalAdded, `יום תשלום: ${allowance} דמי כיס + ${interest.toFixed(2)} ריבית`]);
                totalDistributed += totalAdded;
            }
        }
        await dbClient.query('COMMIT');
        res.json({success: true, totalDistributed});
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({error: e.message}); } finally { dbClient.release(); }
});

// שינוי לפונקציית פעולות (תומך כעת בתאריכים עתידיים ופעולות קבועות)
app.post('/api/transaction', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        await dbClient.query('BEGIN');
        
        const isRecurring = req.body.isRecurring === true;
        let endDate = null;
        if (isRecurring && req.body.endMonth) {
            endDate = new Date(`${req.body.endMonth}-01`);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0); 
        }
        
        let txDate = req.body.date ? new Date(req.body.date) : new Date();

        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, date, is_recurring, end_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
            [req.body.userId, u.rows[0].group_id, req.body.amount, req.body.description, req.body.category, req.body.type, txDate, isRecurring, endDate]
        );
        
        // מעדכן יתרה רק אם התאריך של הפעולה אינו עתידי (עבור הפעולה הראשונה)
        const now = new Date();
        if (txDate <= now) {
            const op = req.body.type === 'income' ? '+' : '-';
            await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id = $2`, [req.body.amount, req.body.userId]);
        }
        
        if (req.body.type === 'expense') await dbClient.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING`, [u.rows[0].group_id, req.body.category, req.body.userId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';
        const { groupId, userId } = req.query;
        if(!groupId || groupId === 'undefined') return res.json([]);
        let query, params;
        if(userId === 'all') {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 AND t.date <= CURRENT_TIMESTAMP ORDER BY t.date DESC ${limit}`;
             params = [groupId];
        } else {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.user_id=$1 AND t.date <= CURRENT_TIMESTAMP ORDER BY t.date DESC ${limit}`;
             params = [userId];
        }
        const t = await pool.query(query, params);
        res.json(t.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.assignedTo]);
        let deadline = null;
        if (req.body.days && parseInt(req.body.days) > 0) {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + parseInt(req.body.days));
        }
        const status = req.body.status || 'pending';
        await dbClient.query(`INSERT INTO tasks (group_id, created_by, assigned_to, title, reward, deadline, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
            [u.rows[0].group_id, req.body.createdBy || req.body.assignedTo, req.body.assignedTo, req.body.title, req.body.reward, deadline, status]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/tasks/update', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { taskId, status, finalReward } = req.body;
        const t = (await dbClient.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
        
        if (status === 'completed_self') {
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', ['approved', taskId]);
        } else if (status === 'approved') {
            let amountToPay = finalReward !== undefined ? parseFloat(finalReward) : parseFloat(t.reward);
            if (amountToPay > 0) {
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amountToPay, t.assigned_to]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`, [t.assigned_to, t.group_id, amountToPay, `תגמול משימה/מעשה טוב: ${t.title}`]);
            }
            await dbClient.query('UPDATE tasks SET status = $1, reward = $2 WHERE id = $3', ['approved', amountToPay, taskId]);
        } else {
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);
        }
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/goals', async (req, res) => {
    try {
        const { userId, targetUserId, title, target } = req.body;
        const finalTargetId = targetUserId || userId;
        await pool.query(`INSERT INTO goals (user_id, target_user_id, title, target_amount) VALUES ($1, $2, $3, $4)`, [userId, finalTargetId, title, target]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/goals/deposit', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, goalId, amount } = req.body;
        const g = (await dbClient.query('SELECT target_user_id, title FROM goals WHERE id=$1', [goalId])).rows[0];
        const u = (await dbClient.query('SELECT balance, group_id FROM users WHERE id=$1', [userId])).rows[0];
        if (parseFloat(u.balance) < parseFloat(amount)) { await dbClient.query('ROLLBACK'); return res.status(400).json({ error: 'אין מספיק יתרה' }); }
        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);
        await dbClient.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [amount, goalId]);
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'savings', 'expense', FALSE)`, [userId, u.group_id, amount, `הפקדה ליעד: ${g.title}`]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

// ============================================================
// --- BUDGET ENDPOINTS ---
// ============================================================

app.get('/api/budget/filter', async (req, res) => {
    try {
        const { groupId, targetUserId } = req.query;
        if (!groupId || groupId === 'undefined') return res.json([]);

        let allocations, spent;

        if (!targetUserId || targetUserId === 'all') {
            allocations = await pool.query(
                `SELECT category, COALESCE(SUM(amount_limit), 0) AS lim
                 FROM budget_allocations WHERE group_id = $1
                 GROUP BY category`,
                [groupId]
            );
            spent = await pool.query(
                `SELECT category, COALESCE(SUM(amount), 0) AS spent
                 FROM transactions
                 WHERE group_id = $1 AND type = 'expense'
                   AND date >= date_trunc('month', CURRENT_DATE)
                 GROUP BY category`,
                [groupId]
            );
        } else {
            allocations = await pool.query(
                `SELECT category, COALESCE(amount_limit, 0) AS lim
                 FROM budget_allocations
                 WHERE group_id = $1 AND target_user_id = $2`,
                [groupId, targetUserId]
            );
            spent = await pool.query(
                `SELECT category, COALESCE(SUM(amount), 0) AS spent
                 FROM transactions
                 WHERE user_id = $1 AND type = 'expense'
                   AND date >= date_trunc('month', CURRENT_DATE)
                 GROUP BY category`,
                [targetUserId]
            );
        }

        const result = {};
        allocations.rows.forEach(r => {
            result[r.category] = { category: r.category, limit: parseFloat(r.lim) || 0, spent: 0 };
        });
        spent.rows.forEach(r => {
            if (!result[r.category]) result[r.category] = { category: r.category, limit: 0, spent: 0 };
            result[r.category].spent = parseFloat(r.spent) || 0;
        });

        res.json(Object.values(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        if (!groupId || !category) return res.status(400).json({ error: 'חסרים פרמטרים' });

        const lim = parseFloat(limit) || 0;

        if (!targetUserId || targetUserId === 'all') {
            const members = await pool.query(
                `SELECT id FROM users WHERE group_id = $1 AND status = 'active'`,
                [groupId]
            );
            for (const m of members.rows) {
                await pool.query(
                    `INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (group_id, category, target_user_id)
                     DO UPDATE SET amount_limit = $4`,
                    [groupId, category, m.id, lim]
                );
            }
        } else {
            await pool.query(
                `INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (group_id, category, target_user_id)
                 DO UPDATE SET amount_limit = $4`,
                [groupId, category, targetUserId, lim]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- LOANS ENDPOINTS ---
// ============================================================

app.post('/api/loans/request', async (req, res) => {
    try {
        const { userId, amount, reason } = req.body;
        if (!userId || !amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'סכום לא תקין' });
        const uRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
        if (uRes.rows.length === 0) return res.status(404).json({ error: 'משתמש לא נמצא' });
        await pool.query(
            `INSERT INTO loans (user_id, group_id, original_amount, remaining_amount, reason, status)
             VALUES ($1, $2, $3, $3, $4, 'pending')`,
            [userId, uRes.rows[0].group_id, parseFloat(amount), reason || '']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/loans', async (req, res) => {
    try {
        const { groupId, userId } = req.query;
        if (!groupId && !userId) return res.json([]);
        let query, params;
        if (groupId) {
            query = `SELECT l.*, u.nickname FROM loans l JOIN users u ON l.user_id = u.id WHERE l.group_id = $1 ORDER BY l.created_at DESC`;
            params = [groupId];
        } else {
            query = `SELECT l.*, u.nickname FROM loans l JOIN users u ON l.user_id = u.id WHERE l.user_id = $1 ORDER BY l.created_at DESC`;
            params = [userId];
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/loans/approve', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const { loanId, adminId } = req.body;
        await dbClient.query('BEGIN');
        const adminCheck = await dbClient.query(`SELECT group_id FROM users WHERE id = $1 AND role = 'ADMIN'`, [adminId]);
        if (adminCheck.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(403).json({ error: 'רק מנהל יכול לאשר הלוואות' }); }
        const loanRes = await dbClient.query(`SELECT * FROM loans WHERE id = $1 AND status = 'pending'`, [loanId]);
        if (loanRes.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ error: 'הלוואה לא נמצאה או כבר טופלה' }); }
        const loan = loanRes.rows[0];
        await dbClient.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [loan.original_amount, loan.user_id]);
        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'loan', 'income', FALSE)`,
            [loan.user_id, loan.group_id, loan.original_amount, `הלוואה אושרה: ${loan.reason || 'הלוואה מההורים'}`]
        );
        await dbClient.query(`UPDATE loans SET status = 'approved' WHERE id = $1`, [loanId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/loans/reject', async (req, res) => {
    try {
        const { loanId, adminId } = req.body;
        const adminCheck = await pool.query(`SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'`, [adminId]);
        if (adminCheck.rows.length === 0) return res.status(403).json({ error: 'רק מנהל יכול לדחות הלוואות' });
        await pool.query(`UPDATE loans SET status = 'rejected' WHERE id = $1`, [loanId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- ACADEMY ENDPOINTS ---
// ============================================================

app.post('/api/academy/assign', async (req, res) => {
    try {
        const { userId, bundleId, reward, days } = req.body;
        if (!userId || !bundleId) return res.status(400).json({ error: 'חסרים פרמטרים' });
        let deadline = null;
        if (days && parseInt(days) > 0) { deadline = new Date(); deadline.setDate(deadline.getDate() + parseInt(days)); }
        const customReward = (reward !== '' && reward !== undefined && reward !== null) ? parseFloat(reward) : null;
        await pool.query(
            `INSERT INTO user_assignments (user_id, bundle_id, custom_reward, deadline) VALUES ($1, $2, $3, $4)`,
            [userId, bundleId, customReward, deadline]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/request-challenge', async (req, res) => {
    try {
        const { userId, bundleId } = req.body;
        let finalBundleId = bundleId;
        if (!finalBundleId) {
            const uRes = await pool.query('SELECT birth_year FROM users WHERE id=$1', [userId]);
            if (uRes.rows.length === 0) return res.status(404).json({ error: 'משתמש לא נמצא' });
            const age = calculateAge(uRes.rows[0].birth_year);
            const ageGroup = getAgeGroup(age);
            const assigned = await pool.query('SELECT bundle_id FROM user_assignments WHERE user_id=$1', [userId]);
            const assignedIds = assigned.rows.map(r => r.bundle_id);
            const available = await pool.query('SELECT id FROM quiz_bundles WHERE age_group=$1', [ageGroup]);
            const choices = available.rows.filter(b => !assignedIds.includes(b.id));
            if (choices.length === 0) return res.json({ success: false, error: 'אין אתגרים זמינים לגיל שלך כרגע' });
            finalBundleId = choices[Math.floor(Math.random() * choices.length)].id;
        }
        await pool.query('INSERT INTO user_assignments (user_id, bundle_id) VALUES ($1, $2)', [userId, finalBundleId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/submit', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const { userId, bundleId, score } = req.body;
        await dbClient.query('BEGIN');
        const asRes = await dbClient.query(`SELECT * FROM user_assignments WHERE user_id=$1 AND bundle_id=$2 AND status='assigned'`, [userId, bundleId]);
        if (asRes.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ error: 'הקצאה לא נמצאה' }); }
        const assignment = asRes.rows[0];
        const bRes = await dbClient.query('SELECT threshold, reward FROM quiz_bundles WHERE id=$1', [bundleId]);
        const bundle = bRes.rows[0];
        const passed = score >= bundle.threshold;
        const finalReward = assignment.custom_reward !== null ? parseFloat(assignment.custom_reward) : parseFloat(bundle.reward);
        const newStatus = passed ? 'completed' : 'failed';
        await dbClient.query('UPDATE user_assignments SET status=$1, score=$2 WHERE user_id=$3 AND bundle_id=$4', [newStatus, score, userId, bundleId]);
        if (passed && finalReward > 0) {
            const uRes = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [userId]);
            await dbClient.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [finalReward, userId]);
            await dbClient.query(
                `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'academy', 'income', FALSE)`,
                [userId, uRes.rows[0].group_id, finalReward, `תגמול אקדמיה: ${score}%`]
            );
        }
        await dbClient.query('COMMIT');
        res.json({ success: true, passed, reward: passed ? finalReward : 0 });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

// ============================================================
// --- SHOPPING & PANTRY ENDPOINTS ---
// ============================================================

app.post('/api/shopping/add', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT group_id, role FROM users WHERE id=$1', [req.body.userId]);
        const user = uRes.rows[0];
        const initialStatus = user.role === 'ADMIN' ? 'pending' : 'requested';
        let normalizedName = req.body.itemName;
        const unit = req.body.unit || 'יח\'';
        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const prompt = `Normalize this grocery product name to a generic, brand-less Hebrew name. For example: 'חלב תנובה 3% קרטון' -> 'חלב 3%'. Product: "${req.body.itemName}". Output JSON: {"normalized": "..."}`;
                const result = await model.generateContent(prompt);
                const data = JSON.parse(result.response.text());
                if(data.normalized) normalizedName = data.normalized;
            } catch(e) {}
        }
        const iRes = await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, unit, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [user.group_id, req.body.userId, req.body.itemName, normalizedName, req.body.quantity, unit, req.body.estimatedPrice || 0, initialStatus]);
        res.json({ success: true, id: iRes.rows[0].id, alert: null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    try {
        const { itemId, status, estimatedPrice, unit } = req.body;
        if (status) await pool.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if (estimatedPrice !== undefined) await pool.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [estimatedPrice, itemId]);
        if (unit !== undefined) await pool.query('UPDATE shopping_list SET unit=$1 WHERE id=$2', [unit, itemId]);
        res.json({ success: true, alert: null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/checkout', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, totalAmount, storeName, branchName, boughtItems, missingItems } = req.body;
        const u = (await dbClient.query('SELECT group_id FROM users WHERE id=$1', [userId])).rows[0];
        const tripRes = await dbClient.query(`INSERT INTO shopping_trips (group_id, buyer_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [u.group_id, userId, storeName || 'סופר', branchName || '', totalAmount]);
        const tripId = tripRes.rows[0].id;
        for (let item of boughtItems) {
            const slItemRes = await dbClient.query('SELECT normalized_name, unit FROM shopping_list WHERE id=$1', [item.id]);
            const normName = slItemRes.rows.length > 0 ? (slItemRes.rows[0].normalized_name || item.name) : item.name;
            const unit = slItemRes.rows.length > 0 ? (slItemRes.rows[0].unit || 'יח\'') : 'יח\'';
            const pricePerUnit = parseFloat(item.price) / (parseFloat(item.quantity) || 1);
            await dbClient.query(`INSERT INTO shopping_trip_items (trip_id, item_name, normalized_name, quantity, unit, price_per_unit) VALUES ($1, $2, $3, $4, $5, $6)`, [tripId, item.name, normName, item.quantity, unit, pricePerUnit]);
            
            const pantryExists = await dbClient.query('SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2 AND unit=$3', [u.group_id, normName, unit]);
            if (pantryExists.rows.length > 0) {
                 await dbClient.query('UPDATE pantry SET quantity = quantity + $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [item.quantity, pantryExists.rows[0].id]);
            } else {
                 await dbClient.query('INSERT INTO pantry (group_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4)', [u.group_id, normName, item.quantity, unit]);
            }
            await dbClient.query(`DELETE FROM shopping_list WHERE id=$1`, [item.id]);
        }
        for (let item of missingItems) { await dbClient.query(`UPDATE shopping_list SET status='pending' WHERE id=$1`, [item.id]); }
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'groceries', 'expense', FALSE)`, [userId, u.group_id, totalAmount, `קניות בסופר: ${storeName}`]);
        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const trips = await pool.query(`SELECT st.*, u.nickname FROM shopping_trips st JOIN users u ON st.buyer_id = u.id WHERE st.group_id=$1 ORDER BY st.id DESC LIMIT 10`, [req.query.groupId]);
        for (let t of trips.rows) {
            const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [t.id]);
            t.items = items.rows;
        }
        res.json(trips.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/copy', async (req, res) => {
    try {
        const { tripId, userId } = req.body;
        const u = (await pool.query('SELECT group_id FROM users WHERE id=$1', [userId])).rows[0];
        const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [tripId]);
        for(let i of items.rows) {
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, unit, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`, [u.group_id, userId, i.item_name, i.normalized_name || i.item_name, i.quantity, i.unit || 'יח\'']);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pantry/add', async (req, res) => {
    try {
        const { groupId, itemName, quantity } = req.body;
        const unit = req.body.unit || 'יח\'';
        const existing = await pool.query('SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2 AND unit=$3', [groupId, itemName, unit]);
        if (existing.rows.length > 0) {
            await pool.query('UPDATE pantry SET quantity = quantity + $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [quantity, existing.rows[0].id]);
        } else {
            await pool.query('INSERT INTO pantry (group_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4)', [groupId, itemName, quantity, unit]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pantry/update', async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        await pool.query('UPDATE pantry SET quantity=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [quantity, itemId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pantry/use', async (req, res) => {
    try {
        const { groupId, itemName, usedQuantity } = req.body;
        const existing = await pool.query('SELECT id, quantity FROM pantry WHERE group_id=$1 AND item_name=$2', [groupId, itemName]);
        if (existing.rows.length > 0) {
            const currentQty = parseFloat(existing.rows[0].quantity);
            const newQty = currentQty - parseFloat(usedQuantity);
            if (newQty <= 0) {
                await pool.query('DELETE FROM pantry WHERE id=$1', [existing.rows[0].id]);
            } else {
                await pool.query('UPDATE pantry SET quantity = $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [newQty, existing.rows[0].id]);
            }
            res.json({ success: true, remaining: newQty <= 0 ? 0 : newQty });
        } else {
            res.json({ success: false, error: 'המוצר לא נמצא במזווה' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pantry/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM pantry WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
