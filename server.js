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

// עדכון שקט למסד הנתונים ללא איבוד מידע!
pool.connect().then(async (client) => {
    console.log('✅ Connected to DB (Pool)');
    try { await client.query("ALTER TABLE family_groups ADD COLUMN type VARCHAR(20) DEFAULT 'FAMILY'"); } catch(e) {}
    try { await client.query("ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE"); await client.query("ALTER TABLE transactions ADD COLUMN end_month VARCHAR(10)"); } catch(e) {}
    try { await client.query("ALTER TABLE shopping_list ADD COLUMN units_per_package INT DEFAULT 1"); await client.query("ALTER TABLE shopping_trip_items ADD COLUMN units_per_package INT DEFAULT 1"); await client.query("ALTER TABLE pantry ADD COLUMN units_per_package INT DEFAULT 1"); } catch(e) {}
    try { await client.query("CREATE TABLE IF NOT EXISTS time_clock (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, punch_in TIMESTAMP NOT NULL, punch_out TIMESTAMP, total_minutes INT DEFAULT 0)"); } catch (e) {}
    client.release();
}).catch(err => console.error('Connection Error', err.stack));

const calculateAge = (birthYear) => new Date().getFullYear() - (birthYear || new Date().getFullYear());
const getAgeGroup = (age) => { if(age<8) return '6-8'; if(age<10) return '8-10'; if(age<13) return '10-13'; if(age<15) return '13-15'; if(age<18) return '15-18'; return '18+'; };
const generateGroupCode = () => { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let code = ''; for (let i=0; i<6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)); return code; };

async function handleAITokens(groupId) {
    try {
        await pool.query(`UPDATE family_groups SET ai_tokens = 10, last_token_reset = CURRENT_DATE WHERE id = $1 AND (last_token_reset IS NULL OR last_token_reset < CURRENT_DATE)`, [groupId]);
        const res = await pool.query('SELECT ai_tokens, is_premium FROM family_groups WHERE id = $1', [groupId]);
        if(res.rows.length === 0) return false;
        const group = res.rows[0];
        if(group.is_premium) return true;
        if(group.ai_tokens > 0) { await pool.query('UPDATE family_groups SET ai_tokens = ai_tokens - 1 WHERE id = $1', [groupId]); return true; }
        return false;
    } catch (e) { return false; }
}

const handleAIError = (e, res, defaultMsg) => {
    if (e.message && e.message.includes('429')) return res.status(429).json({ error: 'מערכת ה-AI עמוסה כרגע. אנא המתינו כדקה ונסו שוב.' });
    res.status(500).json({ error: defaultMsg || 'שגיאה בתקשורת עם ה-AI' });
};

// --- SUPER ADMIN ENDPOINTS ---
const verifySA = (req, res, next) => { if (req.headers.authorization !== 'SA_SECRET_TOKEN_2026') return res.status(403).json({error: 'Forbidden'}); next(); };

app.post('/api/superadmin/login', async (req, res) => {
    try {
        const { code, password } = req.body;
        const saUserRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_username'");
        const saPassRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_password'");
        const currentCode = saUserRes.rows.length > 0 ? saUserRes.rows[0].value : 'admin';
        const currentPass = saPassRes.rows.length > 0 ? saPassRes.rows[0].value : '123456';
        if (code === currentCode && password === currentPass) res.json({ success: true, token: 'SA_SECRET_TOKEN_2026' });
        else res.status(401).json({ error: 'פרטי גישה שגויים' });
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
        const activity = await pool.query('SELECT t.amount, t.description, t.date, t.type, u.nickname as user_name, f.name as group_name FROM transactions t JOIN users u ON t.user_id = u.id JOIN family_groups f ON t.group_id = f.id ORDER BY t.date DESC LIMIT 50');
        const settings = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('welcome_msg', 'ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom', 'biz_banner_text_top', 'biz_banner_link_top', 'biz_banner_img_top', 'biz_banner_text_bottom', 'biz_banner_link_bottom', 'biz_banner_img_bottom')");
        
        const famGroupsCount = groups.rows.filter(g => g.type !== 'BUSINESS').length;
        const bizGroupsCount = groups.rows.filter(g => g.type === 'BUSINESS').length;
        const famUsersCount = users.rows.filter(u => { const g = groups.rows.find(gr => gr.id === u.group_id); return g && g.type !== 'BUSINESS'; }).length;
        const bizUsersCount = users.rows.filter(u => { const g = groups.rows.find(gr => gr.id === u.group_id); return g && g.type === 'BUSINESS'; }).length;

        let unifiedActivity = [];
        activity.rows.forEach(a => { unifiedActivity.push({ date: a.date, group_name: a.group_name, user_name: a.user_name, description: a.description, amount: a.amount, is_financial: true }); });
        groups.rows.forEach(g => {
            const adminUser = users.rows.find(u => u.group_id === g.id && u.role === 'ADMIN');
            unifiedActivity.push({ date: g.created_at, group_name: g.name, user_name: adminUser ? adminUser.nickname : 'מנהל', description: `🎉 פתח/ה ${g.type === 'BUSINESS' ? 'עסק חדש' : 'משפחה חדשה'}`, amount: 0, is_financial: false });
        });
        unifiedActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        res.json({
            stats: { familyGroups: famGroupsCount, businessGroups: bizGroupsCount, familyUsers: famUsersCount, businessUsers: bizUsersCount },
            groups: groups.rows, users: users.rows, activity: unifiedActivity.slice(0, 50),
            welcomeMsg: settings.rows.find(r => r.key === 'welcome_msg')?.value || '',
            adBannerTextTop: settings.rows.find(r => r.key === 'ad_banner_text_top')?.value || '',
            adBannerLinkTop: settings.rows.find(r => r.key === 'ad_banner_link_top')?.value || '',
            adBannerImgTop: settings.rows.find(r => r.key === 'ad_banner_img_top')?.value || '',
            adBannerTextBottom: settings.rows.find(r => r.key === 'ad_banner_text_bottom')?.value || '',
            adBannerLinkBottom: settings.rows.find(r => r.key === 'ad_banner_link_bottom')?.value || '',
            adBannerImgBottom: settings.rows.find(r => r.key === 'ad_banner_img_bottom')?.value || '',
            bizBannerTextTop: settings.rows.find(r => r.key === 'biz_banner_text_top')?.value || '',
            bizBannerLinkTop: settings.rows.find(r => r.key === 'biz_banner_link_top')?.value || '',
            bizBannerImgTop: settings.rows.find(r => r.key === 'biz_banner_img_top')?.value || '',
            bizBannerTextBottom: settings.rows.find(r => r.key === 'biz_banner_text_bottom')?.value || '',
            bizBannerLinkBottom: settings.rows.find(r => r.key === 'biz_banner_link_bottom')?.value || '',
            bizBannerImgBottom: settings.rows.find(r => r.key === 'biz_banner_img_bottom')?.value || ''
        });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/superadmin/groups/:id', verifySA, async (req, res) => { try { await pool.query('DELETE FROM family_groups WHERE id=$1', [req.params.id]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); } });
app.delete('/api/superadmin/users/:id', verifySA, async (req, res) => { try { await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); } });

app.post('/api/superadmin/settings', verifySA, async (req, res) => {
    try {
        if (req.body.welcomeMsg !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('welcome_msg', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body.welcomeMsg]);
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/superadmin/banners', verifySA, async (req, res) => {
    const { type, topText, topLink, topImg, bottomText, bottomLink, bottomImg } = req.body;
    const prefix = type === 'BUSINESS' ? 'biz_banner_' : 'ad_banner_';
    const items = [ { k: `${prefix}text_top`, v: topText || '' }, { k: `${prefix}link_top`, v: topLink || '' }, { k: `${prefix}img_top`, v: topImg || '' }, { k: `${prefix}text_bottom`, v: bottomText || '' }, { k: `${prefix}link_bottom`, v: bottomLink || '' }, { k: `${prefix}img_bottom`, v: bottomImg || '' } ];
    try {
        await pool.query('BEGIN');
        for (let item of items) await pool.query(`INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [item.k, item.v]);
        await pool.query('COMMIT'); res.json({ success: true });
    } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.post('/api/superadmin/groups/:id/premium', verifySA, async (req, res) => {
    try {
        const enable = req.body.enable === true || req.body.enable === 'true';
        await pool.query('UPDATE family_groups SET is_premium = $1 WHERE id = $2', [enable, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/settings/welcome', async (req, res) => {
    try { const s = await pool.query("SELECT value FROM system_settings WHERE key = 'welcome_msg'"); res.json({ message: s.rows.length > 0 ? s.rows[0].value : '' }); } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/banners', async (req, res) => {
    try {
        const type = req.query.type || 'FAMILY'; const prefix = type === 'BUSINESS' ? 'biz_banner_' : 'ad_banner_';
        const result = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ('${prefix}text_top', '${prefix}link_top', '${prefix}img_top', '${prefix}text_bottom', '${prefix}link_bottom', '${prefix}img_bottom')`);
        const banners = {}; result.rows.forEach(r => { banners[r.key.replace(prefix, 'banner_')] = r.value; });
        res.json({ success: true, banners: { banner_top_text: banners['banner_text_top'], banner_top_link: banners['banner_link_top'], banner_top_img: banners['banner_img_top'], banner_bottom_text: banners['banner_text_bottom'], banner_bottom_link: banners['banner_link_bottom'], banner_bottom_img: banners['banner_img_bottom'] } });
    } catch(e) { res.json({ success: false, error: e.message, banners: {} }); }
});

app.post('/api/admin/send-credentials', async (req, res) => {
    try {
        const { groupId, adminId } = req.body;
        const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1 AND group_id = $2", [adminId, groupId]);
        if(adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') return res.status(403).json({error: "Unauthorized"});
        const groupRes = await pool.query("SELECT admin_email, name, type FROM family_groups WHERE id = $1", [groupId]);
        if(groupRes.rows.length === 0 || !groupRes.rows[0].admin_email) return res.status(400).json({error: "No email"});
        const adminEmail = groupRes.rows[0].admin_email; const groupName = groupRes.rows[0].name; const isBusiness = groupRes.rows[0].type === 'BUSINESS';
        const usersRes = await pool.query("SELECT nickname, password_hash, role FROM users WHERE group_id = $1 ORDER BY role, nickname", [groupId]);
        let emailContent = `שלום מנהל/ת ${isBusiness ? 'צוות' : 'משפחת'} ${groupName},\n\nלהלן פרטי הגישה של כל החברים למערכת Oneflow:\n\n`;
        usersRes.rows.forEach(u => {
            let roleStr = u.role === 'ADMIN' ? 'מנהל' : 'חבר/משתמש';
            if (!isBusiness) roleStr = u.role === 'ADMIN' ? 'מנהל/הורה' : 'ילד/בן משפחה';
            emailContent += `שם משתמש: ${u.nickname}\nסיסמה: ${u.password_hash}\nתפקיד: ${roleStr}\n---\n`;
        });
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
            await transporter.sendMail({ from: `"Oneflow" <${process.env.SMTP_USER}>`, to: adminEmail, subject: 'Oneflow - פרטי הגישה שלכם', text: emailContent });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products', async (req, res) => { try { const result = await pool.query('SELECT barcode, name, category FROM global_products'); res.json(result.rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/products', async (req, res) => { try { const { barcode, name, category } = req.body; if (!barcode || !name) return res.status(400).json({ error: 'חסר ברקוד או שם' }); await pool.query(`INSERT INTO global_products (barcode, name, category) VALUES ($1, $2, $3) ON CONFLICT (barcode) DO NOTHING`, [barcode, name, category || 'כללי']); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// --- TIMECLOCK ENDPOINTS ---
app.get('/api/timeclock/status', async (req, res) => {
    try {
        const { userId } = req.query; if(!userId) return res.status(400).json({error: 'Missing userId'});
        const openPunch = await pool.query('SELECT * FROM time_clock WHERE user_id=$1 AND punch_out IS NULL ORDER BY punch_in DESC LIMIT 1', [userId]);
        if(openPunch.rows.length > 0) res.json({ isPunchedIn: true, punchInTime: openPunch.rows[0].punch_in });
        else res.json({ isPunchedIn: false });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/timeclock/punch', async (req, res) => {
    try {
        const { userId, groupId } = req.body; if(!userId || !groupId) return res.status(400).json({error: 'Missing params'});
        const openPunch = await pool.query('SELECT id, punch_in FROM time_clock WHERE user_id=$1 AND punch_out IS NULL ORDER BY punch_in DESC LIMIT 1', [userId]);
        if (openPunch.rows.length > 0) {
            const punchId = openPunch.rows[0].id; const punchInTime = new Date(openPunch.rows[0].punch_in); const punchOutTime = new Date();
            const totalMinutes = Math.floor((punchOutTime - punchInTime) / 60000);
            await pool.query('UPDATE time_clock SET punch_out=$1, total_minutes=$2 WHERE id=$3', [punchOutTime, totalMinutes, punchId]);
            res.json({ success: true, isPunchedIn: false });
        } else {
            await pool.query('INSERT INTO time_clock (group_id, user_id, punch_in) VALUES ($1, $2, CURRENT_TIMESTAMP)', [groupId, userId]);
            res.json({ success: true, isPunchedIn: true });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/timeclock/report', async (req, res) => {
    try {
        const { groupId, userId, period } = req.query; if(!groupId) return res.json([]);
        let query = `SELECT tc.*, u.nickname FROM time_clock tc JOIN users u ON tc.user_id = u.id WHERE tc.group_id=$1`; let params = [groupId];
        if (userId && userId !== 'all') { params.push(userId); query += ` AND tc.user_id=$${params.length}`; }
        if (period === 'month') query += ` AND tc.punch_in >= date_trunc('month', CURRENT_DATE)`;
        else if (period === 'prev_month') query += ` AND tc.punch_in >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND tc.punch_in < date_trunc('month', CURRENT_DATE)`;
        else if (period === 'year') query += ` AND tc.punch_in >= date_trunc('year', CURRENT_DATE)`;
        query += ` ORDER BY tc.punch_in DESC`;
        const result = await pool.query(query, params); res.json(result.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- AI ENDPOINTS ---
app.post('/api/recipes/generate', async (req, res) => {
    try {
        const { groupId, mealType, diners, ignorePantry, customIngredients, pantryItems } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) return res.status(500).json({ error: 'מפתח API חסר' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        let prompt = `You are a professional chef. Create a delicious recipe in Hebrew for ${diners} people. Meal type: ${mealType}.\n`;
        if (ignorePantry) prompt += `The user wants to cook using ONLY these specific ingredients: ${customIngredients}.\n`;
        else prompt += `The user wants to cook using these specific items they have selected from their pantry: ${pantryItems}.\nTry to prioritize using these items.\n`;
        prompt += `Provide a catchy title, short description, prep time, a clear list of exact ingredients with amounts, and clear numbered instructions. Format nicely using simple Markdown.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, recipe: result.response.text() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/academy/ai-generate', async (req, res) => {
    try {
        const { ageGroup, topic, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Create a fun 5-question multiple-choice quiz in Hebrew about "${topic}" for target audience ${ageGroup}. Requirements: Output strictly as JSON matching this schema: { "title": "...", "text_content": "...", "questions": [ { "q": "...", "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 0 } ] }`;
        const result = await model.generateContent(prompt);
        const quizData = JSON.parse(result.response.text());
        const bundleRes = await pool.query(`INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward) VALUES ('financial', $1, $2, $3, 80, 10.0) RETURNING id`, [ageGroup, quizData.title, quizData.text_content || '']);
        const newBundleId = bundleRes.rows[0].id;
        for (const q of quizData.questions) await pool.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/tasks/ai-generate', async (req, res) => {
    try {
        const { age, topic, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Suggest 3 actionable tasks/goals related to: "${topic}". Suggest a fair monetary reward in ILS (integer 5-150). Output strictly as JSON array: [{"title": "task 1", "reward": 10}]`;
        const result = await model.generateContent(prompt);
        let parsedTasks = JSON.parse(result.response.text());
        if (!Array.isArray(parsedTasks)) { if (parsedTasks.tasks) parsedTasks = parsedTasks.tasks; else parsedTasks = Object.values(parsedTasks).find(val => Array.isArray(val)) || []; }
        res.json({ success: true, tasks: parsedTasks });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/goals/familai-advice', async (req, res) => {
    try {
        const { userId, goalId, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const userRes = await pool.query('SELECT nickname, birth_year, balance, allowance_amount FROM users WHERE id=$1', [userId]);
        const goalRes = await pool.query('SELECT title, target_amount, current_amount FROM goals WHERE id=$1', [goalId]);
        const user = userRes.rows[0]; const goal = goalRes.rows[0]; const age = calculateAge(user.birth_year);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a digital advisor. A user named ${user.nickname} is saving money/budget for a goal called "${goal.title}". Target: ${goal.target_amount} ILS. Current: ${goal.current_amount} ILS. Wallet balance: ${user.balance} ILS. Write a short, encouraging message directly to ${user.nickname} in Hebrew. Give a practical plan to reach their goal. Keep it under 4 sentences. Use emojis.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, advice: result.response.text().trim() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/budget/familai-insight', async (req, res) => {
    try {
        const { groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const txsRes = await pool.query(`SELECT t.amount, t.category, t.type, u.nickname FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 AND t.date >= date_trunc('month', CURRENT_DATE)`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are the intelligent financial advisor. Analyze these transactions from this month: ${JSON.stringify(txsRes.rows)}. Write a short "Executive Summary" in Hebrew. Mention where most expenses went, and give one smart tip to save money or optimize budget next month. Format as clear text with emojis. Max 4 sentences. Start with "שלום, להלן סיכום התקציב שלכם:"`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/pantry/familai-insight', async (req, res) => {
    try {
        const { groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const pantryRes = await pool.query('SELECT item_name, quantity, unit, updated_at FROM pantry WHERE group_id=$1', [groupId]);
        const historyRes = await pool.query(`SELECT sti.item_name, sti.quantity, sti.unit, sti.price_per_unit, st.trip_date FROM shopping_trip_items sti JOIN shopping_trips st ON sti.trip_id = st.id WHERE st.group_id=$1 AND st.trip_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`, [groupId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a smart inventory manager. Here is the current inventory: ${JSON.stringify(pantryRes.rows)}. Here is their shopping history from the last month: ${JSON.stringify(historyRes.rows)}. Analyze this data in Hebrew. Write a short summary (3-4 sentences). Compare what they have to what they usually buy, and warn them if they might run out of a frequently bought item soon. Give one tip. Use emojis.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/forecast/familai-insight', async (req, res) => {
    try {
        const { groupId, period, mode, targetUserId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        let txsRes;
        if(targetUserId === 'all') txsRes = await pool.query(`SELECT amount, category, type, is_recurring, description FROM transactions WHERE group_id=$1 AND is_recurring = TRUE`, [groupId]);
        else txsRes = await pool.query(`SELECT amount, category, type, is_recurring, description FROM transactions WHERE user_id=$1 AND is_recurring = TRUE`, [targetUserId]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are an advisor. Based on these recurring transactions expected for the upcoming ${mode === 'monthly' ? 'month' : 'year'}: ${JSON.stringify(txsRes.rows)}, give a short 2-3 sentence advice in Hebrew on how to prepare and balance cashflow. Use emojis.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, insight: result.response.text().trim() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/tasks/vision-verify', async (req, res) => {
    try {
        const { taskId, title, imageBase64, mimeType, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `A user claims they completed the task: "${title}". Look at the attached image. Is the task reasonably done? Be forgiving but honest. Return JSON strictly matching this schema: { "verified": true/false, "message": "Short feedback in Hebrew speaking directly to the user. If verified, praise them. If not, nicely tell them what is missing." }`;
        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const feedback = JSON.parse(result.response.text());
        if(feedback.verified) {
            const t = (await pool.query('SELECT * FROM tasks WHERE id=$1', [taskId])).rows[0];
            const baseReward = parseFloat(t.reward) || 0;
            let bonus = baseReward > 0 ? Math.max(1, Math.round(baseReward * 0.1)) : 0;
            const total = baseReward + bonus;
            await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [total, t.assigned_to]);
            await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`, [t.assigned_to, t.group_id, total, `תגמול (אושר ע"י AI) + בונוס: ${t.title}`]);
            await pool.query('UPDATE tasks SET status = $1, reward = $2 WHERE id = $3', ['approved', total, taskId]);
            if(bonus > 0) feedback.message += ` (התקבל בונוס איכות AI של ₪${bonus}!)`;
        }
        res.json({ success: true, verified: feedback.verified, message: feedback.message });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/shopping/scan-receipt', async (req, res) => {
    try {
        const { imageBase64, mimeType, userId } = req.body;
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const groupId = uRes.rows[0].group_id;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Read this receipt. Extract items purchased, quantities, and SINGLE UNIT PRICE. CRITICAL: If multiple units, extract ONLY the price for ONE unit. Return JSON matching this array schema: [ { "name": "Item name in Hebrew", "price": 12.50, "qty": 1 } ]`;
        const result = await model.generateContent([ prompt, { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } } ]);
        const items = JSON.parse(result.response.text());
        let normalizedArray = [];
        try {
            const names = items.map(i => i.name);
            const normPrompt = `Normalize these product names to generic Hebrew names. Return JSON array of strings in same order. Items: ${JSON.stringify(names)}`;
            const normResult = await model.generateContent(normPrompt);
            normalizedArray = JSON.parse(normResult.response.text());
        } catch(e) {}
        for (let i = 0; i < items.length; i++) {
             const item = items[i]; const normName = normalizedArray[i] || item.name;
             await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, normalized_name, quantity, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`, [groupId, userId, item.name, normName, item.qty || 1, item.price || 0]);
        }
        res.json({ success: true, count: items.length });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/academy/tutor', async (req, res) => {
    try {
        const { question, wrongAnswer, correctAnswer, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId); if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a tutor. A user answered a question incorrectly. Question: "${question}" They answered: "${wrongAnswer}" The correct answer is: "${correctAnswer}". Explain briefly in Hebrew (2-3 sentences max) why the correct answer is right. Be encouraging!`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, explanation: result.response.text().trim() });
    } catch (e) { handleAIError(e, res); }
});

app.post('/api/guide/chat', async (req, res) => {
    try {
        const { question } = req.body;
        if (!genAI) return res.status(500).json({ success: false, error: 'מפתח API חסר בשרת' });
        let guideText = "";
        try { guideText = fs.readFileSync(path.join(__dirname, 'public', 'guide.html'), 'utf-8'); } catch(e) { guideText = "Oneflow is a financial app."; }
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are the AI assistant for 'Oneflow'. A user is reading the guide and asked a question. Guide content: ${guideText}\n\nQuestion: "${question}"\n\nAnswer directly in Hebrew based ONLY on the guide. Be concise (3-4 sentences), friendly.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, answer: result.response.text().trim() });
    } catch (e) { res.status(500).json({ success: false, error: 'שגיאה' }); }
});

// --- BASIC API ENDPOINTS ---
app.post('/api/groups', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        let code = generateGroupCode();
        const groupType = req.body.type === 'BUSINESS' ? 'BUSINESS' : 'FAMILY';
        const gRes = await dbClient.query(`INSERT INTO family_groups (type, name, admin_email, group_code) VALUES ($1, $2, $3, $4) RETURNING *`, [groupType, req.body.groupName, req.body.adminEmail, code]);
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
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד ההתחברות לא חוקי' });
        const group = gRes.rows[0];
        const reqRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        await pool.query(`INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'pending')`, [group.id, nickname, birthYear, password, reqRole]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [req.body.groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד התחברות שגוי' });
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
        const updateRes = await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3 RETURNING id", [newPassword, req.params.id, oldPassword]);
        if (updateRes.rows.length === 0) return res.status(400).json({error: "סיסמה נוכחית שגויה"});
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { adminId } = req.query;
        const adminCheck = await pool.query("SELECT group_id FROM users WHERE id = $1 AND role = 'ADMIN'", [adminId]);
        if (adminCheck.rows.length === 0) return res.status(403).json({error: "Unauthorized"});
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

        const gRes = await pool.query('SELECT type, name, ai_tokens, is_premium, last_token_reset, group_code FROM family_groups WHERE id=$1', [user.group_id]);
        const groupData = gRes.rows[0] || { ai_tokens: 10, is_premium: false, type: 'FAMILY' };

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
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'allowance', 'income', FALSE)`, [child.id, req.body.groupId, totalAdded, `העברה תכופתית: ${allowance} יסוד + ${interest.toFixed(2)} בונוס`]);
                totalDistributed += totalAdded;
            }
        }
        await dbClient.query('COMMIT');
        res.json({success: true, totalDistributed});
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({error: e.message}); } finally { dbClient.release(); }
});

app.post('/api/admin/adjust-balance', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { adminId, groupId, childId, type, amount, reason } = req.body;
        const u = await dbClient.query('SELECT role FROM users WHERE id=$1', [adminId]);
        if(u.rows[0].role !== 'ADMIN') throw new Error('Not authorized');
        
        const op = type === 'add' ? '+' : '-';
        const txType = type === 'add' ? 'income' : 'expense';
        const txCategory = 'other';
        
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id=$2`, [amount, childId]);
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`, [childId, groupId, amount, reason, txCategory, txType]);
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.post('/api/transaction', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        await dbClient.query('BEGIN');
        
        const tDate = req.body.date ? new Date(req.body.date) : new Date();
        const isRec = req.body.isRecurring === true || req.body.isRecurring === 'true';
        const endM = req.body.endMonth || null;
        
        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, date, is_recurring, end_month) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
            [req.body.userId, u.rows[0].group_id, req.body.amount, req.body.description, req.body.category, req.body.type, tDate, isRec, endM]
        );
        
        const op = req.body.type === 'income' ? '+' : '-';
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id = $2`, [req.body.amount, req.body.userId]);
        if (req.body.type === 'expense') await dbClient.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING`, [u.rows[0].group_id, req.body.category, req.body.userId]);
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.put('/api/transaction/:id', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { id } = req.params;
        const { amount, description, category, requesterId } = req.body;
        const uRes = await dbClient.query('SELECT role FROM users WHERE id=$1', [requesterId]);
        if(uRes.rows[0].role !== 'ADMIN') { await dbClient.query('ROLLBACK'); return res.status(403).json({ error: 'Unauthorized' }); }
        
        const oldT = await dbClient.query('SELECT * FROM transactions WHERE id=$1', [id]);
        if(oldT.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
        
        const diff = parseFloat(amount) - parseFloat(oldT.rows[0].amount);
        const userId = oldT.rows[0].user_id;
        const op = oldT.rows[0].type === 'income' ? '+' : '-';
        
        await dbClient.query('UPDATE transactions SET amount=$1, description=$2, category=$3 WHERE id=$4', [amount, description, category, id]);
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id=$2`, [diff, userId]);
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.delete('/api/transaction/:id', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { id } = req.params;
        const { requesterId } = req.query;
        
        const uRes = await dbClient.query('SELECT role FROM users WHERE id=$1', [requesterId]);
        if(uRes.rows[0].role !== 'ADMIN') { await dbClient.query('ROLLBACK'); return res.status(403).json({ error: 'Unauthorized' }); }
        
        const oldT = await dbClient.query('SELECT * FROM transactions WHERE id=$1', [id]);
        if(oldT.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
        
        const amt = parseFloat(oldT.rows[0].amount);
        const userId = oldT.rows[0].user_id;
        const op = oldT.rows[0].type === 'income' ? '-' : '+';
        
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id=$2`, [amt, userId]);
        await dbClient.query('DELETE FROM transactions WHERE id=$1', [id]);
        
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
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 ORDER BY t.id DESC ${limit}`;
             params = [groupId];
        } else {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.user_id=$1 ORDER BY t.id DESC ${limit}`;
             params = [userId];
        }
        const t = await pool.query(query, params);
        res.json(t.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/forecast', async (req, res) => {
    try {
        const { groupId, userId, period, mode } = req.query;
        if(!groupId || groupId === 'undefined') return res.json({ startingBalance: 0, items: [] });

        let startDate, endDate;
        if (mode === 'monthly') {
            if(!period) {
                startDate = new Date(); startDate.setDate(1); startDate.setHours(0,0,0,0);
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
            } else {
                const [year, month] = period.split('-'); startDate = new Date(year, parseInt(month) - 1, 1); endDate = new Date(year, parseInt(month), 0, 23, 59, 59);
            }
        } else {
            const year = period ? parseInt(period) : new Date().getFullYear();
            startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59);
        }

        let balanceQuery = `SELECT SUM(balance) as total FROM users WHERE group_id = $1 AND status='active'`;
        let balanceParams = [groupId];
        if (userId !== 'all') { balanceQuery += ` AND id = $2`; balanceParams.push(userId); }
        const balRes = await pool.query(balanceQuery, balanceParams);
        const startingBalance = parseFloat(balRes.rows[0].total) || 0;

        let txQuery = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id = $1`;
        let txParams = [groupId];
        if (userId !== 'all') { txQuery += ` AND t.user_id = $2`; txParams.push(userId); }
        const txRes = await pool.query(txQuery, txParams);

        const items = [];
        txRes.rows.forEach(t => {
            const txDate = new Date(t.date);
            const isOneTimeInPeriod = !t.is_recurring && txDate >= startDate && txDate <= endDate;
            if (isOneTimeInPeriod) {
                items.push({ id: t.id, type: t.type, amount: t.amount, category: t.category, description: t.description, is_recurring: false, user_name: t.user_name, date_str: txDate.toLocaleDateString('he-IL') });
            } else if (t.is_recurring) {
                let txStartMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1); let validEnd = true; let endD = null;
                if (t.end_month) { const [endYear, endMonth] = t.end_month.split('-'); endD = new Date(endYear, parseInt(endMonth), 0, 23, 59, 59); if (startDate > endD) validEnd = false; }
                if (endDate < txStartMonth) validEnd = false;
                if (validEnd) {
                    if (mode === 'monthly') { items.push({ id: t.id, type: t.type, amount: t.amount, category: t.category, description: t.description, is_recurring: true, user_name: t.user_name, date_str: 'קבוע (חודשי)' }); } 
                    else if (mode === 'yearly') {
                        let monthsActive = 0;
                        for(let m=0; m<12; m++) {
                            let checkStart = new Date(startDate.getFullYear(), m, 1); let checkEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59); let isActive = checkStart >= txStartMonth;
                            if (endD && checkEnd > endD) isActive = false; if (isActive) monthsActive++;
                        }
                        if(monthsActive > 0) { items.push({ id: t.id, type: t.type, amount: t.amount * monthsActive, category: t.category, description: `${t.description} (x${monthsActive} ח')`, is_recurring: true, user_name: t.user_name, date_str: 'קבוע (שנתי)' }); }
                    }
                }
            }
        });
        res.json({ startingBalance, items });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.assignedTo]);
        let deadline = null;
        if (req.body.days && parseInt(req.body.days) > 0) { deadline = new Date(); deadline.setDate(deadline.getDate() + parseInt(req.body.days)); }
        const status = req.body.status || 'pending';
        await dbClient.query(`INSERT INTO tasks (group_id, created_by, assigned_to, title, reward, deadline, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [u.rows[0].group_id, req.body.createdBy || req.body.assignedTo, req.body.assignedTo, req.body.title, req.body.reward, deadline, status]);
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
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`, [t.assigned_to, t.group_id, amountToPay, `תגמול: ${t.title}`]);
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

app.get('/api/budget/filter', async (req, res) => {
    try {
        const { groupId, targetUserId } = req.query;
        if (!groupId || groupId === 'undefined') return res.json([]);
        let allocations, spent;
        if (!targetUserId || targetUserId === 'all') {
            allocations = await pool.query(`SELECT category, COALESCE(SUM(amount_limit), 0) AS lim FROM budget_allocations WHERE group_id = $1 GROUP BY category`, [groupId]);
            spent = await pool.query(`SELECT category, COALESCE(SUM(amount), 0) AS spent FROM transactions WHERE group_id = $1 AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [groupId]);
        } else {
            allocations = await pool.query(`SELECT category, COALESCE(amount_limit, 0) AS lim FROM budget_allocations WHERE group_id = $1 AND target_user_id = $2`, [groupId, targetUserId]);
            spent = await pool.query(`SELECT category, COALESCE(SUM(amount), 0) AS spent FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [targetUserId]);
        }
        const result = {};
        allocations.rows.forEach(r => { result[r.category] = { category: r.category, limit: parseFloat(r.lim) || 0, spent: 0 }; });
        spent.rows.forEach(r => { if (!result[r.category]) result[r.category] = { category: r.category, limit: 0, spent: 0 }; result[r.category].spent = parseFloat(r.spent) || 0; });
        res.json(Object.values(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        if (!groupId || !category) return res.status(400).json({ error: 'חסרים פרמטרים' });
        const lim = parseFloat(limit) || 0;
        if (!targetUserId || targetUserId === 'all') {
            const members = await pool.query(`SELECT id FROM users WHERE group_id = $1 AND status = 'active'`, [groupId]);
            for (const m of members.rows) {
                await pool.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, category, target_user_id) DO UPDATE SET amount_limit = $4`, [groupId, category, m.id, lim]);
            }
        } else {
            await pool.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, category, target_user_id) DO UPDATE SET amount_limit = $4`, [groupId, category, targetUserId, lim]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
