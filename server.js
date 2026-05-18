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

// ============================================================
// TWILIO SMS OTP CONFIGURATION & LOGIC
// ============================================================
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const otpCache = new Map();

async function sendSMSviaTwilio(to, body) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw new Error('הגדרות Twilio (SID, Token או מספר טלפון) חסרות במשתני הסביבה של השרת');
    }
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const basicAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', TWILIO_PHONE_NUMBER);
    params.append('Body', body);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'שגיאה פנימית בתקשורת מול שרת ה-SMS של Twilio');
    }
    return data;
}
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
      
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE'); } catch(e) {}
      try { await client.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS target_datetime VARCHAR(50)'); } catch(e) {}
      try { await client.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'); } catch(e) {}
      try { await client.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS quote_status VARCHAR(50) DEFAULT \'draft\''); } catch(e) {}
      
      await client.query(`CREATE TABLE IF NOT EXISTS store_customers (
          id SERIAL PRIMARY KEY,
          group_id INTEGER,
          name VARCHAR(255),
          phone VARCHAR(50),
          email VARCHAR(255),
          business_id VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS end_month VARCHAR(10)'); } catch(e) {}
      try { await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT TRUE'); } catch(e) {}
      try { await client.query('ALTER TABLE budget_allocations ADD COLUMN IF NOT EXISTS target_user_id INT REFERENCES users(id) ON DELETE CASCADE'); } catch(e) {}
      try { await client.query('ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      try { await client.query('ALTER TABLE shopping_trip_items ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      try { await client.query('ALTER TABLE pantry ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1'); } catch(e) {}
      try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"tabs":["feed"]}'::jsonb`); } catch(e) {}
      try { await client.query('ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS customer_number VARCHAR(50)'); } catch(e) {}
      
     try {
          await client.query('ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_admin_email_key CASCADE');
          await client.query('ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_email_type_key CASCADE');
          await client.query('ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_admin_email_type_key CASCADE');
      } catch(e) { console.log('Email constraint removal error:', e.message); }

      try {
          await client.query(`CREATE TABLE IF NOT EXISTS time_clock (
              id SERIAL PRIMARY KEY,
              group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
              user_id INT REFERENCES users(id) ON DELETE CASCADE,
              punch_in TIMESTAMP NOT NULL,
              punch_out TIMESTAMP,
              total_minutes INT DEFAULT 0
          )`);
      } catch(e) {}
      
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS ai_tokens INT DEFAULT 10'); } catch(e) {}
      try { await client.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS last_token_reset DATE DEFAULT CURRENT_DATE'); } catch(e) {}
      try { await client.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"store":true,"b2b":true,"academy":true,"calendar":true,"finance":true,"inventory":true,"crm":true,"deliveries":true,"foodcost":true,"ai":true}'::jsonb`); } catch(e) {}
      // מרכז משאבי אנוש והרשאות לסופר אדמין (RBAC)
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_teams (id SERIAL PRIMARY KEY, name VARCHAR(100), permissions JSONB DEFAULT '[]'::jsonb, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_users (id SERIAL PRIMARY KEY, team_id INT REFERENCES sa_teams(id) ON DELETE SET NULL, name VARCHAR(100), email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_users ADD COLUMN IF NOT EXISTS working_hours VARCHAR(50) DEFAULT '09:00-17:00'`); } catch(e) {}

      // מערכת קריאות שירות (מלאה עם דחיפות וסוג SLA)
      try { await client.query(`CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, subject VARCHAR(255), description TEXT, status VARCHAR(20) DEFAULT 'open', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS log JSONB DEFAULT '[]'::jsonb`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to INT REFERENCES sa_users(id) ON DELETE SET NULL`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_team INT REFERENCES sa_teams(id) ON DELETE SET NULL`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal'`); } catch(e) {}
      try { await client.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50) DEFAULT 'general'`); } catch(e) {}

    // צ'אט פנימי מערכתי (Internal Whispers) - ספרינט 3
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_internal_chat (id SERIAL PRIMARY KEY, room VARCHAR(50) DEFAULT 'general', sender_name VARCHAR(100), sender_id INT, message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      
     // מרכז פיתוח, מוצר ו-QA (סופר אדמין)
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_product_matrix (id SERIAL PRIMARY KEY, environment VARCHAR(50), module_name VARCHAR(100), scenario_name TEXT, expected_result TEXT, status VARCHAR(20) DEFAULT 'untested', last_tested_at TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_dev_tasks (id SERIAL PRIMARY KEY, title VARCHAR(255), type VARCHAR(50), priority VARCHAR(50), status VARCHAR(50) DEFAULT 'backlog', description TEXT, environment VARCHAR(50), module_name VARCHAR(100), original_ticket_id INT, target_version VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      
      // הרחבת טבלת המשימות לשיוך הנדסי מלא (ALM)
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS description TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS version_id INT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS assigned_developer VARCHAR(100)`); } catch(e) {}
      
      // ניהול גרסאות, ספר מוצר ו-QA (ספרינט 4 - ALM)
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_versions (id SERIAL PRIMARY KEY, name VARCHAR(100), target_date DATE, status VARCHAR(20) DEFAULT 'planning', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_product_book (id VARCHAR(50) PRIMARY KEY, category VARCHAR(100), name VARCHAR(200), description TEXT, priority VARCHAR(20) DEFAULT 'medium', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_qa_runs (id SERIAL PRIMARY KEY, version_id INT REFERENCES sa_versions(id) ON DELETE SET NULL, tester_name VARCHAR(100), results JSONB, status VARCHAR(20) DEFAULT 'completed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}  
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_qa_test_results (id SERIAL PRIMARY KEY, test_id VARCHAR(50) NOT NULL, env VARCHAR(20) NOT NULL, status VARCHAR(10), note TEXT DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(test_id, env))`); } catch(e) {}
      // טבלת תתי-משימות פיתוח לרזולוציית ביצוע (ALM)
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_dev_sub_tasks (id SERIAL PRIMARY KEY, task_id INT REFERENCES sa_dev_tasks(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, is_done BOOLEAN DEFAULT FALSE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}  
    // טבלת צ'אט צוות פנימי
    try {
          await client.query(`CREATE TABLE IF NOT EXISTS team_chat (
              id SERIAL PRIMARY KEY,
              group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
              user_id INT REFERENCES users(id) ON DELETE CASCADE,
              message TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`);
      } catch(e) { console.error('Error creating team_chat table:', e.message); }

      // טבלאות החנות הוירטואלית (E-commerce)
      try { await client.query(`CREATE TABLE IF NOT EXISTS store_settings (group_id INT PRIMARY KEY REFERENCES family_groups(id) ON DELETE CASCADE, is_active BOOLEAN DEFAULT FALSE, welcome_message TEXT, phone VARCHAR(50), min_order DECIMAL(10,2) DEFAULT 0)`); } catch(e) {}
      // עדכון שדות חדשים למסד נתונים קיים
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS slogan VARCHAR(255)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_type VARCHAR(20) DEFAULT 'retail'`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS logo_url TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS open_time VARCHAR(10)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS close_time VARCHAR(10)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS modifier_presets TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS banner_url TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS include_vat BOOLEAN DEFAULT FALSE`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS store_catalog (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, category VARCHAR(50), is_available BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS image_url TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS options_text TEXT`); } catch(err){}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50)`); } catch(err){}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20) DEFAULT 'red'`); } catch(err){}
try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'retail'`); } catch(err){}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS long_description TEXT`); } catch(err){}
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS gallery TEXT`); } catch(err){}
      
      // --- תוספות פוד-קוסט לחנות ---
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS overhead_details JSONB DEFAULT '[]'::jsonb`); } catch(err){}
      try { await client.query(`
          CREATE TABLE IF NOT EXISTS product_ingredients (
              id SERIAL PRIMARY KEY,
              catalog_id INT REFERENCES store_catalog(id) ON DELETE CASCADE,
              ingredient_name VARCHAR(100),
              quantity DECIMAL(10,3),
              unit VARCHAR(20)
          )
      `); } catch(err){}

      try { await client.query(`CREATE TABLE IF NOT EXISTS store_orders (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, customer_name VARCHAR(100), customer_phone VARCHAR(50), total_amount DECIMAL(10,2), status VARCHAR(20) DEFAULT 'new', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS notes TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS items JSONB`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_details TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS family_group_id INT`); } catch(e) {}
    
      try { await client.query(`CREATE TABLE IF NOT EXISTS store_order_items (id SERIAL PRIMARY KEY, order_id INT REFERENCES store_orders(id) ON DELETE CASCADE, catalog_id INT REFERENCES store_catalog(id) ON DELETE SET NULL, item_name VARCHAR(100), quantity DECIMAL(10,2), price_at_order DECIMAL(10,2))`); } catch(e) {}
     try { await client.query(`CREATE TABLE IF NOT EXISTS store_promotions (id SERIAL PRIMARY KEY, group_id INT, title VARCHAR(100), type VARCHAR(20), details JSONB, start_date TIMESTAMP, end_date TIMESTAMP, is_active BOOLEAN DEFAULT TRUE)`); } catch(e) {}

      // טבלאות מערכת היומן והתורים
      try { 
          await client.query(`CREATE TABLE IF NOT EXISTS calendar_settings (group_id INT PRIMARY KEY REFERENCES family_groups(id) ON DELETE CASCADE, is_active BOOLEAN DEFAULT FALSE, open_time VARCHAR(10) DEFAULT '09:00', close_time VARCHAR(10) DEFAULT '18:00', interval_mins INT DEFAULT 30, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); 
      } catch(e) {}
      
      try { 
          await client.query(`CREATE TABLE IF NOT EXISTS calendar_services (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, name VARCHAR(150) NOT NULL, duration_mins INT DEFAULT 30, price DECIMAL(10,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); 
      } catch(e) {}
      
     try { 
          await client.query(`CREATE TABLE IF NOT EXISTS calendar_events (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, service_id INT REFERENCES calendar_services(id) ON DELETE SET NULL, title VARCHAR(200) NOT NULL, customer_phone VARCHAR(50), notes TEXT, event_date DATE NOT NULL, start_time TIME NOT NULL, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); 
      } catch(e) {}

      // טבלת מערכת ההודעות החדשה (Inbox)
      try {
          await client.query(`CREATE TABLE IF NOT EXISTS inbox_messages (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, sender_type VARCHAR(50), sender_name VARCHAR(100), sender_contact VARCHAR(100), subject VARCHAR(200), content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      } catch(e) { console.error('Error creating inbox_messages table:', e.message); }

      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_qa_test_results (id SERIAL PRIMARY KEY, test_id VARCHAR(50) NOT NULL, env VARCHAR(20) NOT NULL, status VARCHAR(10), note TEXT DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(test_id, env))`); } catch(e) {}
      
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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
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
        return false;
    }
}

const handleAIError = (e, res, defaultMsg) => {
    console.error('AI Error:', e);
    if (e.message && e.message.includes('429')) return res.status(429).json({ error: 'מערכת ה-AI עמוסה כרגע. אנא המתינו כדקה ונסו שוב.' });
    res.status(500).json({ error: defaultMsg || 'שגיאה בתקשורת עם ה-AI' });
};

// =========================================================
// פונקציית מערכת המיילים המרכזית (מאובטחת)
// =========================================================
async function sendSystemEmail(to, subject, htmlContent) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        console.error('⚠️ לא הוגדרו משתני סביבה SMTP_USER ו-SMTP_PASS ב-Render. המייל לא נשלח.');
        return false;
    }

    console.log(`📧 מנסה לשלוח מייל אל: ${to}...`);
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // משתמש בפורט מאובטח 465
            auth: { user: user, pass: pass }
        });
        
        await transporter.sendMail({
            from: `"Oneflow System" <${user}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        
        console.log(`✅ המייל נשלח בהצלחה אל: ${to}`);
        return true;
    } catch (e) {
        console.error('❌ שגיאה בשליחת המייל דרך Gmail:', e.message);
        return false;
    }
}

app.post('/api/support/ticket', async (req, res) => {
    try {
        const { groupId, groupName, userId, userName, userEmail, subject, description } = req.body;
        if (!description || description.length < 5) return res.status(400).json({ success: false, error: 'תיאור קצר מדי.' });

        const initialLog = [{ date: new Date().toISOString(), sender: userName, isStaff: false, message: description }];

        // שמירה למסד הנתונים
        const tRes = await pool.query('INSERT INTO support_tickets (group_id, user_id, subject, description, status, log) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [groupId, userId, subject, description, 'open', JSON.stringify(initialLog)]);
        const newTicketId = tRes.rows[0].id;

        // התראה במייל לסופר אדמין
        const supportEmail = 'mcgames1978@gmail.com'; 
        const ticketHtml = `
            <div dir="rtl" style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">קריאת שירות חדשה #${newTicketId}</h2>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                    <p style="margin: 5px 0;"><strong>נושא:</strong> ${subject}</p>
                    <p style="margin: 5px 0;"><strong>לקוח:</strong> ${userName} (${groupName})</p>
                    <p style="margin: 5px 0;"><strong>מייל:</strong> ${userEmail}</p>
                </div>
                <h3 style="color: #1e293b;">הפנייה:</h3>
                <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; white-space: pre-wrap;">${description}</div>
            </div>
        `;
        sendSystemEmail(supportEmail, `קריאה #${newTicketId}: ${subject}`, ticketHtml).catch(e => console.log('Mail error:', e));
        
        res.json({ success: true, ticketId: newTicketId });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// הוספת תגובה לקריאה קיימת (גם ללקוח וגם לאדמין)
app.post('/api/support/tickets/:id/reply', async (req, res) => {
    try {
        const { message, userName, isStaff, newStatus } = req.body;
        const ticketId = req.params.id;
        
        const tRes = await pool.query('SELECT log, status FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) return res.status(404).json({error: 'Ticket not found'});
        
        let currentLog = tRes.rows[0].log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);
        
        currentLog.push({ date: new Date().toISOString(), sender: userName, isStaff: isStaff, message: message });
        
        // אם מוגדר סטטוס חדש נשתמש בו, אחרת נשנה אוטומטית לפי מי שענה (לקוח -> פתוח, צוות -> בטיפול)
        let statusToUpdate = newStatus || (isStaff ? 'in_progress' : 'open');
        if (!newStatus && tRes.rows[0].status === 'resolved' && !isStaff) {
            statusToUpdate = 'open'; // הלקוח פתח מחדש
        }
        
        await pool.query('UPDATE support_tickets SET log = $1, status = $2 WHERE id = $3', [JSON.stringify(currentLog), statusToUpdate, ticketId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שליפת הקריאות עבור פאנל ה-Super Admin (כולל צוותים משויכים וזמני SLA)
app.get('/api/superadmin/tickets', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, f.name as group_name, u.nickname as user_name, 
                   sa_u.name as assigned_user_name, sa_t.name as assigned_team_name 
            FROM support_tickets t 
            LEFT JOIN family_groups f ON t.group_id = f.id 
            LEFT JOIN users u ON t.user_id = u.id 
            LEFT JOIN sa_users sa_u ON t.assigned_to = sa_u.id
            LEFT JOIN sa_teams sa_t ON t.assigned_team = sa_t.id
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, tickets: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שליפת קריאות שירות ללקוח (לפי מזהה קבוצה/עסק)
app.get('/api/support/tickets/my/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM support_tickets WHERE group_id = $1 ORDER BY created_at DESC', [req.params.groupId]);
        res.json({ success: true, tickets: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// עדכון סטטוס הקריאה ע"י ה-Super Admin ועדכון חותמת זמן ל-SLA
app.put('/api/superadmin/tickets/:id/status', verifySA, async (req, res) => {
    try {
        await pool.query('UPDATE support_tickets SET status = $1, status_updated_at = CURRENT_TIMESTAMP WHERE id = $2', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הראוט החדש: ניהול סיווגים והעברות טיפול, כולל שמירת המקרא של SLA
app.get('/api/sa/sla-matrix', verifySA, async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'sla_matrix_config'");
        const sla = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : [];
        res.json({ success: true, sla });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/sla-matrix', verifySA, async (req, res) => {
    try {
        const { sla } = req.body;
        const exists = await pool.query("SELECT key FROM system_settings WHERE key = 'sla_matrix_config'");
        if (exists.rows.length > 0) {
            await pool.query("UPDATE system_settings SET value = $1 WHERE key = 'sla_matrix_config'", [JSON.stringify(sla)]);
        } else {
            await pool.query("INSERT INTO system_settings (key, value) VALUES ('sla_matrix_config', $1)", [JSON.stringify(sla)]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/superadmin/tickets/:id/assign_and_classify', verifySA, async (req, res) => {
    let dbClient;
    try {
        const { assignedTeam, priority, ticketType, actionBy, auditNote } = req.body;
        const ticketId = req.params.id;
        
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        
        const tRes = await dbClient.query('SELECT log FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) throw new Error('Ticket not found');
        
        let currentLog = tRes.rows[0].log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);
        
        // יצירת הודעת ביקורת (Audit) אוטומטית רק אם סופק פתק מהלקוח/מערכת
        if (auditNote) {
            currentLog.push({ date: new Date().toISOString(), sender: actionBy || 'מערכת', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] ${auditNote}` });
        }
        
        await dbClient.query(
            'UPDATE support_tickets SET assigned_team = $1, priority = $2, ticket_type = $3, log = $4 WHERE id = $5', 
            [assignedTeam || null, priority || 'normal', ticketType || 'general', JSON.stringify(currentLog), ticketId]
        );
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch(e) { 
        if (dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally {
        if (dbClient) dbClient.release();
    }
});

// ==========================================
// --- FAMILAI OPERATIONS (SPRINT 2 - REST OVERRIDE) ---
// ==========================================

// פונקציית עזר לביצוע קריאה ישירה ל-API של גוגל (עקיפת SDK ישן)
async function callGeminiDirect(prompt) {
    if (!apiKey) throw new Error('Gemini API Key is missing in server environment');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || !data.candidates[0].content) throw new Error('AI returned an empty response');
    
    return data.candidates[0].content.parts[0].text;
}

// Triage - סיווג חכם של קריאות שירות ע"י AI
app.post('/api/superadmin/tickets/:id/ai-triage', verifySA, async (req, res) => {
    let dbClient;
    try {
        const ticketId = req.params.id;
        dbClient = await pool.connect();
        
        const tRes = await dbClient.query('SELECT subject, description, log FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) throw new Error('Ticket not found');
        
        const ticket = tRes.rows[0];
        
        const prompt = `
        You are an expert AI Triage Support Agent for a SaaS system called 'Oneflow Life'. 
        Read the following support ticket submitted by a user and classify it.
        
        Ticket Subject: "${ticket.subject}"
        Ticket Description: "${ticket.description}"
        
        Analyze the text and return ONLY a valid JSON object with these exact keys:
        {
            "sentiment": "angry" or "neutral" or "happy",
            "priority": "low" or "normal" or "high" or "critical",
            "ticketType": "general" or "technical" or "billing",
            "reason": "Short 1-sentence explanation in Hebrew of why you classified it this way"
        }`;
        
        let responseText = await callGeminiDirect(prompt);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(responseText);
        
        let currentLog = ticket.log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);
        
        let sentimentTag = aiData.sentiment === 'angry' ? '🔥 סנטימנט לקוח: כועס/מתוסכל' : (aiData.sentiment === 'happy' ? '✨ סנטימנט לקוח: מרוצה/חיובי' : 'סנטימנט לקוח: רגיל');
        const auditNote = `FamilAI סיווג את הפנייה אוטומטית. ${sentimentTag}. סיבה: ${aiData.reason}`;
        
        currentLog.push({ date: new Date().toISOString(), sender: 'FamilAI', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] ${auditNote}` });
        
        await dbClient.query(
            'UPDATE support_tickets SET priority = $1, ticket_type = $2, log = $3 WHERE id = $4', 
            [aiData.priority, aiData.ticketType, JSON.stringify(currentLog), ticketId]
        );
        
        res.json({ success: true, classification: aiData });
    } catch(e) {
        console.error('AI Triage Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (dbClient) dbClient.release();
    }
});

// ==========================================
// --- הוספת תגובה לקריאת שירות ---
// ==========================================
app.post('/api/superadmin/tickets/:id/reply', verifySA, async (req, res) => {
    let dbClient;
    try {
        dbClient = await pool.connect();
        const ticketId = req.params.id;
        const { message, status, isInternal, senderName } = req.body;

        // שליפת הטיקט הקיים מהמסד
        const tRes = await dbClient.query('SELECT status, log FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) throw new Error('Ticket not found');

        const ticket = tRes.rows[0];
        let currentLog = ticket.log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);

        // הוספת ההודעה החדשה ללוג
        currentLog.push({
            date: new Date().toISOString(),
            sender: senderName || 'צוות מערכת',
            isStaff: true,
            isInternal: !!isInternal,
            message: message
        });

        // עדכון סטטוס אם הועבר סטטוס חדש, אחרת נשאר הסטטוס הקיים
        const newStatus = status || ticket.status;
        
        // שמירה חזרה למסד הנתונים
        await dbClient.query(
            "UPDATE support_tickets SET status = $1, status_updated_at = CURRENT_TIMESTAMP, log = $2 WHERE id = $3",
            [newStatus, JSON.stringify(currentLog), ticketId]
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Ticket Reply Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (dbClient) dbClient.release();
    }
});

// Deduplication - מניעת כפילויות חכמה מול בנק המשימות
app.post('/api/sa/dev/check-duplicates', verifySA, async (req, res) => {
    try {
        const { description } = req.body;
        const tasksRes = await pool.query("SELECT id, title, description FROM sa_dev_tasks WHERE status IN ('backlog', 'in_progress', 'qa')");
        const activeTasks = tasksRes.rows;
        
        if (activeTasks.length === 0) return res.json({ success: true, isDuplicate: false });
        
        const prompt = `
        Check if this ticket is a duplicate of active tasks. Respond ONLY with JSON:
        Ticket: "${description}"
        Tasks: ${JSON.stringify(activeTasks)}
        JSON: {"isDuplicate": bool, "matchedTaskId": id, "confidence": 0-100, "explanation": "Hebrew sentence"}`;
        
        let responseText = await callGeminiDirect(prompt);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(responseText);
        
        res.json({ success: true, ...aiData });
    } catch(e) {
        console.error('Deduplication AI Error:', e.message);
        res.status(500).json({ error: 'שגיאת AI: ' + e.message });
    }
});

// ==========================================
// --- FEEDBACK LOOP (SPRINT 3) ---
// ==========================================
// סגירת מעגל: עדכון טיקט תמיכה אוטומטית כשהפיתוח מסתיים
app.post('/api/sa/tickets/:id/feedback-loop', verifySA, async (req, res) => {
    let dbClient;
    try {
        dbClient = await pool.connect();
        const ticketId = req.params.id;
        const { taskTitle, version } = req.body;

        const tRes = await dbClient.query('SELECT log FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) throw new Error('Ticket not found');

        let currentLog = tRes.rows[0].log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);

        const verText = version ? ` (גרסה ${version})` : '';
        const msg = `🎉 צוות הפיתוח עדכן שהמשימה "${taskTitle}" הושלמה בהצלחה${verText}! התקלה תוקנה והקריאה נסגרת אוטומטית. תודה על הדיווח!`;

        currentLog.push({
            date: new Date().toISOString(),
            sender: 'מערכת (Feedback Loop)',
            isStaff: true,
            isInternal: false,
            message: msg
        });

        await dbClient.query(
            "UPDATE support_tickets SET status = 'resolved', status_updated_at = CURRENT_TIMESTAMP, log = $1 WHERE id = $2",
            [JSON.stringify(currentLog), ticketId]
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Feedback Loop Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (dbClient) dbClient.release();
    }
});

// ==========================================
// --- FAMILAI OPERATIONS (SPRINT 2 - REST STABLE OVERRIDE) ---
// ==========================================

// פונקציית המעקף - גילוי אוטומטי (Auto-Discovery) של מודלים נתמכים
async function callGeminiDirect(prompt) {
    if (!apiKey) throw new Error('Gemini API Key is missing in environment');

    try {
        // 1. נשאל את גוגל אילו מודלים בדיוק פתוחים עבור מפתח ה-API הזה
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();

        if (!listData.models) {
            throw new Error('לא הצלחנו למשוך את רשימת המודלים מגוגל. בדוק את תקינות ה-API KEY.');
        }

        // 2. נסנן רק מודלים של ג'מיני שתומכים ביצירת טקסט
        const validModels = listData.models.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.includes('gemini')
        );

        if (validModels.length === 0) {
            throw new Error('לא נמצאו מודלים נתמכים של ג\'מיני עבור מפתח ה-API הזה.');
        }

        // נעדיף את flash המהיר, ואם אין - ניקח את הראשון שעובד ברשימה
        const selectedModel = validModels.find(m => m.name.includes('flash')) || validModels[0];
        console.log('✅ Auto-Discovery selected model:', selectedModel.name);

        // 3. נבצע את הקריאה עם השם המדויק שגוגל החזירה (שכבר כולל את הקידומת models/)
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;
        
        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
            throw new Error('AI returned an empty response.');
        }
        
        return data.candidates[0].content.parts[0].text;
        
    } catch (err) {
        console.error('Gemini Auto-Discovery Error:', err.message);
        throw new Error(`תקלת תקשורת מול גוגל: ${err.message}`);
    }
}
// AI Generator (Unlimited PRO) - REST Override
// ==========================================
// --- SUPER ADMIN: AI Generator (REST OVERRIDE) ---
// ==========================================
app.post('/api/sa/ai-generate', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        if (!token) return res.json({ success: false, error: 'חסרה הרשאת סופר-אדמין' });
        
        const { context, query } = req.body;
        const prompt = `${context}\n\nבקשה: ${query}`;
        
        const responseText = await callGeminiDirect(prompt);
        res.json({ success: true, answer: responseText });
    } catch(e) {
        console.error('AI Gen Error:', e.message);
        res.json({ success: false, error: 'שגיאה במנוע ה-AI: ' + e.message });
    }
});
// שליפת הקריאות עבור פאנל ה-Super Admin
app.get('/api/superadmin/tickets', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, f.name as group_name, u.nickname as user_name 
            FROM support_tickets t 
            LEFT JOIN family_groups f ON t.group_id = f.id 
            LEFT JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, tickets: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// עדכון סטטוס הקריאה ע"י ה-Super Admin
app.put('/api/superadmin/tickets/:id/status', verifySA, async (req, res) => {
    try {
        await pool.query('UPDATE support_tickets SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/test-email', async (req, res) => {
    try {
        const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : null;
        const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s/g, '') : null;

        if (!user || !pass) {
            return res.send('<h1 style="color:red; text-align:center; direction:rtl; margin-top:50px;">❌ שגיאה: משתני הסביבה (SMTP_USER או SMTP_PASS) לא מוגדרים ב-Render!</h1>');
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', 
            port: 465, 
            secure: true,
            auth: { user, pass }
        });

        await transporter.sendMail({
            from: `"Oneflow System Test" <${user}>`,
            to: user,
            subject: '✅ בדיקת מערכת המיילים - Oneflow',
            html: '<div style="direction:rtl; font-family:Arial;"><h2>הצלחה! 🎉</h2><p>המערכת הצליחה לעקוף את החסימה, להתחבר לשרתי גוגל דרך פורט 465 ולשלוח מייל בהצלחה.</p></div>'
        });

        res.send('<h1 style="color:green; text-align:center; direction:rtl; margin-top:50px;">✅ המייל נשלח בהצלחה לתיבה שלך!</h1>');
    } catch (error) {
        res.send(`<h1 style="color:red; text-align:center; direction:rtl; margin-top:50px;">❌ שגיאה:</h1><div style="background:#f4f4f4; padding:20px; font-family:monospace; max-width:800px; margin:20px auto; border: 1px solid #ccc;">${error.message}</div>`);
    }
});


// --- FORCE DATABASE UPGRADE ---
app.get('/api/force-upgrade', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const results = [];
        const queries = [
            'ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_admin_email_key CASCADE',
            'ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_email_type_key CASCADE',
            'ALTER TABLE family_groups DROP CONSTRAINT IF EXISTS family_groups_admin_email_type_key CASCADE',
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE',
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS end_month VARCHAR(10)',
            'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT TRUE',
            'ALTER TABLE budget_allocations ADD COLUMN IF NOT EXISTS target_user_id INT REFERENCES users(id) ON DELETE CASCADE',
            'ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE shopping_trip_items ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE pantry ADD COLUMN IF NOT EXISTS units_per_package INT DEFAULT 1',
            'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION',
            'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT \'{"tabs":["feed"]}\'::jsonb',
            'ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50)',
            'ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20) DEFAULT \'red\'',
            'ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT \'retail\'',
            'ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS long_description TEXT',
            'ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS gallery TEXT',
            'CREATE TABLE IF NOT EXISTS store_promotions (id SERIAL PRIMARY KEY, group_id INT, title VARCHAR(100), type VARCHAR(20), details JSONB, start_date TIMESTAMP, end_date TIMESTAMP, is_active BOOLEAN DEFAULT TRUE)',
            'CREATE TABLE IF NOT EXISTS inbox_messages (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, sender_type VARCHAR(50), sender_name VARCHAR(100), sender_contact VARCHAR(100), subject VARCHAR(200), content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
        ];
        
        for (let q of queries) {
            try { await client.query(q); results.push({ query: q, status: 'success' }); } catch (err) { results.push({ query: q, status: 'error', error: err.message }); }
        }
        
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS time_clock (
                id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                punch_in TIMESTAMP NOT NULL, punch_out TIMESTAMP, total_minutes INT DEFAULT 0
            )`);
            results.push({ query: 'time_clock table', status: 'success' });
        } catch(err) { results.push({ query: 'time_clock table', status: 'error', error: err.message }); }

        res.json({ success: true, message: 'Database upgrade process finished.', details: results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    } finally { if(client) client.release(); }
});

// --- SYSTEM SETUP ---
app.get('/setup-db', async (req, res) => {
    try {
        await pool.query(`
            DROP TABLE IF EXISTS user_assignments CASCADE; DROP TABLE IF EXISTS quiz_questions CASCADE; DROP TABLE IF EXISTS quiz_bundles CASCADE;
            DROP TABLE IF EXISTS budget_allocations CASCADE; DROP TABLE IF EXISTS goals CASCADE; DROP TABLE IF EXISTS loans CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE; DROP TABLE IF EXISTS transactions CASCADE; DROP TABLE IF EXISTS shopping_list CASCADE;
            DROP TABLE IF EXISTS shopping_trips CASCADE; DROP TABLE IF EXISTS shopping_trip_items CASCADE; DROP TABLE IF EXISTS pantry CASCADE;
            DROP TABLE IF EXISTS time_clock CASCADE; DROP TABLE IF EXISTS users CASCADE; DROP TABLE IF EXISTS family_groups CASCADE;
            DROP TABLE IF EXISTS system_settings CASCADE; DROP TABLE IF EXISTS global_products CASCADE;
            DROP TABLE IF EXISTS communities CASCADE; DROP TABLE IF EXISTS community_businesses CASCADE; DROP TABLE IF EXISTS store_coupons CASCADE;
            DROP TABLE IF EXISTS store_customers CASCADE; DROP TABLE IF EXISTS store_orders CASCADE; DROP TABLE IF EXISTS store_order_items CASCADE;
            DROP TABLE IF EXISTS inbox_messages CASCADE;
            
            CREATE TABLE system_settings (key VARCHAR(50) PRIMARY KEY, value TEXT);
            CREATE TABLE family_groups (
                id SERIAL PRIMARY KEY, name VARCHAR(100), type VARCHAR(20) DEFAULT 'FAMILY', admin_email VARCHAR(100), group_code VARCHAR(10) UNIQUE, 
                ai_tokens INT DEFAULT 10, last_token_reset DATE DEFAULT CURRENT_DATE, is_premium BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                location_lat DOUBLE PRECISION, location_lng DOUBLE PRECISION, community_id INT, UNIQUE(admin_email, type)
            );
            CREATE TABLE communities (
                id SERIAL PRIMARY KEY, name VARCHAR(100), city VARCHAR(100), code VARCHAR(50) UNIQUE, manager_email VARCHAR(100), manager_password VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE community_businesses (
                community_id INT, business_id INT, discount_pct DECIMAL DEFAULT 0, status VARCHAR(20) DEFAULT 'approved', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(community_id, business_id)
            );
            CREATE TABLE store_coupons (
                id SERIAL PRIMARY KEY, group_id INT, code VARCHAR(50), discount_pct DECIMAL DEFAULT 0, valid_until DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE users (
                id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, nickname VARCHAR(50), birth_year INT, 
                password_hash VARCHAR(100), role VARCHAR(20) DEFAULT 'MEMBER', status VARCHAR(20) DEFAULT 'pending', balance DECIMAL(10,2) DEFAULT 0.00, 
                allowance_amount DECIMAL(10,2) DEFAULT 0.00, interest_rate DECIMAL(5,2) DEFAULT 0.00, permissions JSONB DEFAULT '{"tabs":["feed"]}'::jsonb
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
            CREATE TABLE inbox_messages (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, sender_type VARCHAR(50), sender_name VARCHAR(100), sender_contact VARCHAR(100), subject VARCHAR(200), content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>DB tables fully reset and updated!</p><a href="/">Go to App</a>');
    } catch (e) { res.status(500).send(e.message); }
});

// --- SUPER ADMIN ENDPOINTS ---

function verifySA(req, res, next) {
    const authHeader = req.headers.authorization || '';
    
    // חילוץ אקטיבי של הטוקן במידה והוא נשלח עם תחילית Bearer מהדפדפן
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    
    if (token !== 'SA_SECRET_TOKEN_2026') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

// ============================================================
// --- SMS OTP LOGIN (SUPER ADMIN MASTER) ---
// ============================================================

app.post('/api/superadmin/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        // אבטחה: הגדר ב-Render משתנה סביבה בשם SUPERADMIN_PHONE עם המספר שלך (למשל: +972501234567)
        const allowedPhone = process.env.SUPERADMIN_PHONE;
        
        if (!allowedPhone || phone !== allowedPhone) {
            // לא נגיד "חסר מספר" להאקרים, נחזיר שגיאה כללית או שהמספר לא מורשה
            return res.json({ success: false, error: 'מספר הטלפון שהוזן אינו מורשה גישה לחשבון מנהל העל.' });
        }
        
        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 דקות
        
        otpCache.set(phone, { code: generatedCode, expiresAt });
        
        const smsText = `קוד הגישה שלך למערכת Oneflow הוא: ${generatedCode}. הקוד בתוקף ל-5 דקות.`;
        await sendSMSviaTwilio(phone, smsText);
        
        res.json({ success: true, message: 'קוד אימות נשלח בהצלחה' });
    } catch (e) {
        console.error('OTP Send Error:', e);
        res.json({ success: false, error: 'שגיאה בשליחת ה-SMS: ' + e.message });
    }
});

app.post('/api/superadmin/verify-otp', async (req, res) => {
    try {
        const { phone, code } = req.body;
        
        const cachedData = otpCache.get(phone);
        if (!cachedData) return res.json({ success: false, error: 'לא נמצאה בקשת התחברות פעילה למספר זה' });
        
        if (Date.now() > cachedData.expiresAt) {
            otpCache.delete(phone);
            return res.json({ success: false, error: 'פג תוקפו של הקוד (חלפו 5 דקות). נסה שנית.' });
        }
        
        if (cachedData.code !== code) return res.json({ success: false, error: 'הקוד שהוקלד אינו תקין' });
        
        // אימות עבר בהצלחה
        otpCache.delete(phone);
        
        const saUserRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_username'");
        const currentCode = saUserRes.rows.length > 0 ? saUserRes.rows[0].value : 'admin';
        
        res.json({ 
            success: true, 
            token: 'SA_SECRET_TOKEN_2026',
            user: { id: 1, name: 'Super Admin Master', role: 'master', email: currentCode, team: 'Management', permissions: ['all'] }
        });
    } catch (e) {
        console.error('OTP Verify Error:', e);
        res.json({ success: false, error: 'שגיאה באימות הקוד' });
    }
});
app.post('/api/superadmin/login', async (req, res) => {
    try {
        const { code, password } = req.body;
        
        // 1. קודם כל בודקים אם קיים משתמש צוות (RBAC) עם המייל והסיסמה האלו
        const userRes = await pool.query(`
            SELECT u.id, u.name, u.email, u.status, t.name as team_name, t.permissions 
            FROM sa_users u 
            LEFT JOIN sa_teams t ON u.team_id = t.id 
            WHERE u.email = $1 AND u.password_hash = $2
        `, [code, password]);
        
        if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            if (user.status !== 'active') return res.status(403).json({ error: 'החשבון שלך נחסם. פנה למנהל המערכת.' });
            
            return res.json({ 
                success: true, 
                token: 'SA_SECRET_TOKEN_2026', 
                user: { id: user.id, name: user.name, email: user.email, team: user.team_name, permissions: user.permissions || [] } 
            });
        }

        // 2. אם לא מצאנו משתמש צוות, נבדוק את סיסמת המאסטר הישנה (Fallback - רק מנהלי העל)
        const saUserRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_username'");
        const saPassRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sa_password'");
        const currentCode = saUserRes.rows.length > 0 ? saUserRes.rows[0].value : 'admin';
        const currentPass = saPassRes.rows.length > 0 ? saPassRes.rows[0].value : '123456';
        
        if (code === currentCode && password === currentPass) { 
            // מנהל העל (Master) תמיד מקבל הרשאת "all" שפותחת הכל
            res.json({ 
                success: true, 
                token: 'SA_SECRET_TOKEN_2026',
                user: { id: 0, name: 'מנהל על (Master)', email: currentCode, team: 'Management', permissions: ['all'] }
            }); 
        } else { 
            res.status(401).json({ error: 'פרטי גישה שגויים לניהול מערכת' }); 
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ==========================================
// --- SUPER ADMIN: HR & RBAC (TEAMS & USERS) ---
// ==========================================

app.get('/api/sa/teams', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_teams ORDER BY name ASC');
        res.json({ success: true, teams: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/staff', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT u.*, t.name as team_name FROM sa_users u LEFT JOIN sa_teams t ON u.team_id = t.id ORDER BY u.name ASC');
        res.json({ success: true, staff: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// --- INTERNAL CHAT (WHISPERS) ---
// ==========================================

// משיכת הודעות לפי חדר
app.get('/api/sa/chat/:room', verifySA, async (req, res) => {
    try {
        const room = req.params.room || 'general';
        // מושך את ה-50 הודעות האחרונות בחדר
        const result = await pool.query('SELECT * FROM sa_internal_chat WHERE room = $1 ORDER BY created_at ASC LIMIT 50', [room]);
        res.json({ success: true, messages: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שליחת הודעה חדשה לחדר
app.post('/api/sa/chat', verifySA, async (req, res) => {
    try {
        const { room, message, senderName, senderId } = req.body;
        if (!message || !message.trim()) return res.json({ success: false, error: 'Empty message' });
        
        await pool.query(
            'INSERT INTO sa_internal_chat (room, sender_name, sender_id, message) VALUES ($1, $2, $3, $4)', 
            [room || 'general', senderName || 'Unknown', senderId || null, message.trim()]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/teams/:id', verifySA, async (req, res) => {
    try {
        const { name, permissions } = req.body;
        await pool.query('UPDATE sa_teams SET name=$1, permissions=$2 WHERE id=$3', [name, JSON.stringify(permissions || []), req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/teams/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_teams WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/staff', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.status, u.created_at, t.name as team_name, t.id as team_id 
            FROM sa_users u 
            LEFT JOIN sa_teams t ON u.team_id = t.id 
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, staff: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/staff', verifySA, async (req, res) => {
    try {
        const { name, email, password, teamId } = req.body;
        const result = await pool.query(
            'INSERT INTO sa_users (name, email, password_hash, team_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status', 
            [name, email, password, teamId || null]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch(e) { 
        if (e.code === '23505') return res.status(400).json({ error: 'כתובת המייל הזו כבר קיימת במערכת' });
        res.status(500).json({ error: e.message }); 
    }
});

app.put('/api/sa/staff/:id', verifySA, async (req, res) => {
    try {
        const { name, email, password, teamId, status } = req.body;
        if (password && password.trim() !== '') {
            await pool.query(
                'UPDATE sa_users SET name=$1, email=$2, password_hash=$3, team_id=$4, status=$5 WHERE id=$6', 
                [name, email, password, teamId || null, status, req.params.id]
            );
        } else {
            await pool.query(
                'UPDATE sa_users SET name=$1, email=$2, team_id=$3, status=$4 WHERE id=$5', 
                [name, email, teamId || null, status, req.params.id]
            );
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/staff/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_users WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// --- עריכת שם סביבה (משפחה/עסק) והאימייל שלה מהאדמין כולל הרשאות מודולים ---
app.put('/api/sa/groups/:id', async (req, res) => {
    try {
        const { name, adminEmail, features } = req.body;
        if (features !== undefined) {
            await pool.query('UPDATE family_groups SET name=$1, admin_email=$2, features=$3 WHERE id=$4', [name, adminEmail, JSON.stringify(features), req.params.id]);
        } else {
            await pool.query('UPDATE family_groups SET name=$1, admin_email=$2 WHERE id=$3', [name, adminEmail, req.params.id]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- עריכת שם משתמש וסיסמה מהאדמין ---
app.put('/api/sa/users/:id', async (req, res) => {
    try {
        const { nickname, password } = req.body;
        if (password && password.trim() !== '') {
            await pool.query('UPDATE users SET nickname=$1, password_hash=$2 WHERE id=$3', [nickname, password, req.params.id]);
        } else {
            await pool.query('UPDATE users SET nickname=$1 WHERE id=$2', [nickname, req.params.id]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

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
        result.rows.forEach(r => { let k = r.key.replace('business_ad_banner_', 'banner_').replace('ad_banner_', 'banner_'); banners[k] = r.value; });
        
        // כאן אנחנו מחזירים את התמונות בדיוק כפי שהן ללא שינוי, כדי לתמוך ב-Base64
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
app.get('/api/superadmin/data', verifySA, async (req, res) => {
    try {
        await pool.query(`UPDATE family_groups SET ai_tokens = 10, last_token_reset = CURRENT_DATE WHERE last_token_reset IS NULL OR last_token_reset < CURRENT_DATE`);
        
        const groups = await pool.query('SELECT * FROM family_groups ORDER BY created_at DESC');
        const users = await pool.query('SELECT * FROM users ORDER BY group_id, id');
        const activity = await pool.query('SELECT t.amount, t.description, t.date, t.type, u.nickname as user_name, f.name as group_name FROM transactions t JOIN users u ON t.user_id = u.id JOIN family_groups f ON t.group_id = f.id ORDER BY t.date DESC LIMIT 50');
        const settings = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('welcome_msg', 'business_welcome_msg', 'ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom', 'business_ad_banner_text_top', 'business_ad_banner_link_top', 'business_ad_banner_img_top', 'business_ad_banner_text_bottom', 'business_ad_banner_link_bottom', 'business_ad_banner_img_bottom', 'sa_email', 'sa_username', 'global_ai_logo', 'login_slides')");
        
        let unifiedActivity = [];
        activity.rows.forEach(a => { unifiedActivity.push({ date: a.date, group_name: a.group_name, user_name: a.user_name, description: a.description, amount: a.amount, is_financial: true }); });
        
        groups.rows.forEach(g => {
            const hasActivity = unifiedActivity.some(act => act.group_name === g.name);
            if (!hasActivity) {
                 const adminUser = users.rows.find(u => u.group_id === g.id && u.role === 'ADMIN');
                 unifiedActivity.push({ date: g.created_at, group_name: g.name, user_name: adminUser ? adminUser.nickname : 'מנהל', description: '🎉 פתח/ה סביבה חדשה', amount: 0, is_financial: false });
            }
        });
        
        unifiedActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        const getSet = (k) => settings.rows.find(r => r.key === k)?.value || '';

        const connectionsRes = await pool.query("SELECT COUNT(*) FROM community_businesses WHERE status = 'approved'");
        const totalConnections = parseInt(connectionsRes.rows[0].count) || 0;

        const stats = {
            families: groups.rows.filter(g => g.type === 'FAMILY').length,
            businesses: groups.rows.filter(g => g.type === 'BUSINESS').length,
            familyUsers: users.rows.filter(u => { const g = groups.rows.find(g=>g.id===u.group_id); return g && g.type === 'FAMILY'; }).length,
            businessUsers: users.rows.filter(u => { const g = groups.rows.find(g=>g.id===u.group_id); return g && g.type === 'BUSINESS'; }).length,
            activeConnections: totalConnections
        };
        
        let loginSlidesRaw = getSet('login_slides');
        let loginSlides = [];
        try { if(loginSlidesRaw) loginSlides = JSON.parse(loginSlidesRaw); } catch(e){}

        res.json({
            groups: groups.rows, users: users.rows, activity: unifiedActivity.slice(0, 50), stats: stats,
            saEmail: getSet('sa_email'), saUsername: getSet('sa_username') || 'admin',
            welcomeMsg: getSet('welcome_msg'), businessWelcomeMsg: getSet('business_welcome_msg'),
            globalAiLogo: getSet('global_ai_logo'), loginSlides: loginSlides,
            adBannerTextTop: getSet('ad_banner_text_top'), adBannerLinkTop: getSet('ad_banner_link_top'), adBannerImgTop: getSet('ad_banner_img_top'),
            adBannerTextBottom: getSet('ad_banner_text_bottom'), adBannerLinkBottom: getSet('ad_banner_link_bottom'), adBannerImgBottom: getSet('ad_banner_img_bottom'),
            bizBannerTextTop: getSet('business_ad_banner_text_top'), bizBannerLinkTop: getSet('business_ad_banner_link_top'), bizBannerImgTop: getSet('business_ad_banner_img_top'),
            bizBannerTextBottom: getSet('business_ad_banner_text_bottom'), bizBannerLinkBottom: getSet('business_ad_banner_link_bottom'), bizBannerImgBottom: getSet('business_ad_banner_img_bottom')
        });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/superadmin/banners', verifySA, async (req, res) => {
    const { topText, topLink, topImg, bottomText, bottomLink, bottomImg, bizTopText, bizTopLink, bizTopImg, bizBottomText, bizBottomLink, bizBottomImg, globalAiLogo, loginSlides } = req.body;
    const items = [ 
        { k: 'ad_banner_text_top', v: topText || '' }, { k: 'ad_banner_link_top', v: topLink || '' }, { k: 'ad_banner_img_top', v: topImg || '' },
        { k: 'ad_banner_text_bottom', v: bottomText || '' }, { k: 'ad_banner_link_bottom', v: bottomLink || '' }, { k: 'ad_banner_img_bottom', v: bottomImg || '' },
        { k: 'business_ad_banner_text_top', v: bizTopText || '' }, { k: 'business_ad_banner_link_top', v: bizTopLink || '' }, { k: 'business_ad_banner_img_top', v: bizTopImg || '' },
        { k: 'business_ad_banner_text_bottom', v: bizBottomText || '' }, { k: 'business_ad_banner_link_bottom', v: bizBottomLink || '' }, { k: 'business_ad_banner_img_bottom', v: bizBottomImg || '' }
    ];
    
    if (globalAiLogo !== undefined) items.push({ k: 'global_ai_logo', v: globalAiLogo || '' });
    if (loginSlides !== undefined) items.push({ k: 'login_slides', v: JSON.stringify(loginSlides || []) });

    try {
        await pool.query('BEGIN');
        for (let item of items) await pool.query(`INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [item.k, item.v]);
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ error: 'שגיאה בשמירת נתוני המערכת' }); }
});

app.get('/api/system/public-config', async (req, res) => {
    try {
        const result = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('global_ai_logo', 'login_slides')");
        const getSet = (k) => result.rows.find(r => r.key === k)?.value || '';
        
        let loginSlides = [];
        try { 
            const rawSlides = getSet('login_slides');
            if(rawSlides) loginSlides = JSON.parse(rawSlides); 
        } catch(e){}
        
        res.json({ 
            success: true, 
            globalAiLogo: getSet('global_ai_logo'),
            loginSlides: loginSlides.filter(s => s.active !== false)
        });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// =========================================================
// פונקציות יצירת סביבות ושליחת מיילים
// =========================================================

app.post('/api/groups', async (req, res) => {
    let dbClient;
    try {
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        const reqEmail = (req.body.adminEmail || '').toLowerCase().trim();

        // 1. משיכת המייל של הסופר אדמין כדי לאפשר לו לפתוח סביבות ללא הגבלה
        const saEmailRes = await dbClient.query("SELECT value FROM system_settings WHERE key = 'sa_email'");
        const saEmail = saEmailRes.rows.length > 0 ? saEmailRes.rows[0].value.toLowerCase().trim() : '';

        // 2. אכיפת מגבלת 2 סביבות ללקוח רגיל (שאינו הסופר אדמין)
        if (reqEmail !== saEmail && saEmail !== '') {
            const countRes = await dbClient.query('SELECT COUNT(*) FROM family_groups WHERE LOWER(admin_email) = $1', [reqEmail]);
            if (parseInt(countRes.rows[0].count) >= 2) {
                await dbClient.query('ROLLBACK');
                return res.status(400).json({ error: 'ניתן לפתוח עד 2 סביבות (משפחות או עסקים) תחת אותה כתובת מייל.' });
            }
        }
        
        let code = generateGroupCode();
        
        // איתור קהילה אם הוזן קוד הפניה (Referral)
        let commId = null;
        if (req.body.inviteCommunityCode) {
            const cRes = await dbClient.query('SELECT id FROM communities WHERE code = $1', [req.body.inviteCommunityCode.toUpperCase().trim()]);
            if (cRes.rows.length > 0) commId = cRes.rows[0].id;
        }
        
        const gRes = await dbClient.query(
            `INSERT INTO family_groups (type, name, admin_email, group_code, community_id) VALUES ($1, $2, LOWER($3), $4, $5) RETURNING *`, 
            [req.body.type, req.body.groupName, reqEmail, code, commId]
        );
        const group = gRes.rows[0];
        const birthYear = parseInt(req.body.birthYear) || null;
        
        const uRes = await dbClient.query(
            `INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ADMIN', 'active') RETURNING *`, 
            [group.id, req.body.adminNickname, birthYear, req.body.password]
        );

        const welcomeText = req.body.type === 'BUSINESS' ? 'סביבת עבודה נפתחה בהצלחה! 🎉' : 'הבנק המשפחתי נפתח בהצלחה! 🎉';
        await dbClient.query(
            `INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, 0, $3, 'system', 'income', FALSE)`, 
            [uRes.rows[0].id, group.id, welcomeText]
        );
        
        await dbClient.query('COMMIT');

        // מנגנון הבשלת קהילה אוטומטי (30 משפחות מפעילות את הקהילה)
        if (commId && req.body.type === 'FAMILY') {
            const famCount = await pool.query(`SELECT COUNT(*) FROM family_groups WHERE community_id = $1 AND type = 'FAMILY'`, [commId]);
            if (parseInt(famCount.rows[0].count) >= 30) {
                await pool.query(`UPDATE communities SET status = 'active' WHERE id = $1 AND status = 'pending'`, [commId]);
            }
        }
        
        // --- מערכת שליחת המיילים ---
        const sysType = req.body.type === 'BUSINESS' ? 'Oneflow Life BIZ (לעסקים)' : 'Oneflow Life (למשפחות)';
        
        const adminAlertHtml = `<div dir="rtl" style="font-family:Arial;"><h2>🎉 סביבה חדשה הוקמה!</h2><p>סוג: ${sysType}</p><p>שם: ${req.body.groupName}</p><p>מייל: ${req.body.adminEmail}</p><p>קוד: <b>${code}</b></p></div>`;
                // שליחת מיילים ברקע - לא חוסמת את התגובה
        sendSystemEmail('mcgames1978@gmail.com', 'Oneflow | הצטרפות חדשה למערכת!', adminAlertHtml).catch(e => console.error('Email error:', e));

        if (req.body.adminEmail) {
            const userThanksHtml = `<div dir="rtl" style="font-family:Arial;"><h2>ברוכים הבאים ל-${sysType}! 🚀</h2><p>שלום ${req.body.adminNickname},</p><p>הסביבה שלכם מוגדרת ומוכנה לפעולה.</p><br><p>פרטי הגישה שלכם:</p><p>קוד סביבה: <strong style="color: #2563eb;">${code}</strong></p><p>משתמש: <strong>${req.body.adminNickname}</strong></p><p>סיסמה: <strong>${req.body.password}</strong></p></div>`;
            sendSystemEmail(req.body.adminEmail, `הסביבה שלכם ב-${sysType} מוכנה!`, userThanksHtml).catch(e => console.error('Email error:', e));
        }

        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) { 
        if (dbClient) { try { await dbClient.query('ROLLBACK'); } catch(rbErr) {} }
        if (e.message && e.message.includes('unique constraint')) { res.status(400).json({ error: 'כתובת המייל הזו כבר רשומה במערכת.' }); } 
        else { res.status(500).json({ error: 'שגיאת שרת: ' + e.message }); }
    } finally { if (dbClient) dbClient.release(); }
});
app.post('/api/groups/onboard', async (req, res) => {
    try {
        const { groupId } = req.body;
        await pool.query('UPDATE family_groups SET is_onboarded = TRUE WHERE id = $1', [groupId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/forgot-code', async (req, res) => {
try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'אנא הזן כתובת מייל' });

        const gRes = await pool.query(`
            SELECT f.name, f.group_code, f.type, u.password_hash, u.nickname 
            FROM family_groups f 
            JOIN users u ON f.id = u.group_id 
            WHERE LOWER(f.admin_email) = LOWER($1) AND u.role = 'ADMIN'
        `, [email]);
        
        if (gRes.rows.length === 0) return res.json({ success: true });

        const group = gRes.rows[0];
        const sysType = group.type === 'BUSINESS' ? 'Oneflow Life BIZ' : 'Oneflow Life';

        const recoveryHtml = `
            <div style="direction: rtl; font-family: Arial, sans-serif;">
                <h2>שחזור פרטי גישה - ${sysType}</h2>
                <p>שלום ${group.nickname},</p>
                <p>התקבלה בקשה לשחזור פרטי הגישה עבור הסביבה שלכם: "<strong>${group.name}</strong>".</p>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="font-size: 16px; margin: 8px 0;"><strong>קוד הסביבה שלכם הוא:</strong> <span style="font-size: 20px; color: #3b82f6; font-weight: bold;">${group.group_code}</span></p>
                    <p style="font-size: 16px; margin: 8px 0;"><strong>שם משתמש מנהל:</strong> <span style="font-size: 18px; color: #3b82f6;">${group.nickname}</span></p>
                    <p style="font-size: 16px; margin: 8px 0;"><strong>סיסמת מנהל:</strong> <span style="font-size: 18px; color: #3b82f6;">${group.password_hash}</span></p>
                </div>
                <p>אם לא ביקשתם שחזור פרטים, ניתן להתעלם מהודעה זו בביטחה.</p>
                <p>בברכה,<br>צוות Oneflow</p>
            </div>`;
            
        sendSystemEmail(email, 'Oneflow | שחזור קוד וסיסמה לסביבה שלך', recoveryHtml);
        res.json({ success: true });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'אירעה שגיאה. נסה שוב מאוחר יותר.' }); 
    }
});

app.post('/api/admin/send-credentials', async (req, res) => {
    try {
        const { groupId, adminId } = req.body;
        const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1 AND group_id = $2", [adminId, groupId]);
        if(adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') return res.status(403).json({error: "רק מנהל מורשה לבצע פעולה זו"});

        const groupRes = await pool.query("SELECT admin_email, name, type FROM family_groups WHERE id = $1", [groupId]);
        if(groupRes.rows.length === 0 || !groupRes.rows[0].admin_email) return res.status(400).json({error: "לא נמצאה כתובת מייל מוגדרת בהרשמה."});
        
        const adminEmail = groupRes.rows[0].admin_email; const groupName = groupRes.rows[0].name; const groupType = groupRes.rows[0].type;
        const usersRes = await pool.query("SELECT nickname, password_hash, role FROM users WHERE group_id = $1 ORDER BY role, nickname", [groupId]);
        
        let emailContent = `<div style="direction: rtl; font-family: Arial, sans-serif;"><h2>פרטי הגישה של משתמשי הסביבה: ${groupName}</h2><ul>`;
        usersRes.rows.forEach(u => {
            let roleStr = groupType === 'BUSINESS' ? (u.role === 'ADMIN' ? 'מנהל' : 'עובד') : (u.role === 'ADMIN' ? 'הורה' : 'ילד');
            emailContent += `<li><strong>שם:</strong> ${u.nickname} | <strong>סיסמה:</strong> ${u.password_hash} | <strong>תפקיד:</strong> ${roleStr}</li>`;
        });
        emailContent += `</ul><p>בברכה,<br>צוות Oneflow</p></div>`;

        sendSystemEmail(adminEmail, 'Oneflow - פרטי גישה של משתמשי הסביבה', emailContent);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        
        const cleanCode = req.body.groupCode.toUpperCase().trim();
        const gRes = await pool.query('SELECT * FROM family_groups WHERE group_code = $1', [cleanCode]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד שגוי. ודאו שאין רווחים מיותרים בסוף הקוד.' });
        
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

// ============================================================
// --- CORE DATA ENDPOINTS ---
// ============================================================

app.get('/api/data/:userId', async (req, res) => {
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userRes.rows[0];
        
        // עדכון מכסת ה-AI היומית למשתמש בזמן הטעינה (מתאפס ל-10 בחצות)
        await pool.query(`UPDATE family_groups SET ai_tokens = 10, last_token_reset = CURRENT_DATE WHERE id = $1 AND (last_token_reset IS NULL OR last_token_reset < CURRENT_DATE)`, [user.group_id]);
        
        const groupRes = await pool.query('SELECT * FROM family_groups WHERE id = $1', [user.group_id]);
        const group = groupRes.rows[0];

        const adminBalRes = await pool.query("SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as total FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id = $1 AND u.role = 'ADMIN'", [group.id]);
        group.admin_total_balance = adminBalRes.rows[0].total;

        const tasks = await pool.query('SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id = $1 ORDER BY t.created_at DESC', [group.id]);
        const pantry = await pool.query('SELECT * FROM pantry WHERE group_id = $1 ORDER BY updated_at DESC', [group.id]);
        const shoppingList = await pool.query('SELECT sl.*, u.nickname as requester_name FROM shopping_list sl LEFT JOIN users u ON sl.requester_id = u.id WHERE sl.group_id = $1 ORDER BY sl.added_at DESC', [group.id]);
        
        for (let item of shoppingList.rows) {
            const bestPriceRes = await pool.query(`SELECT sti.price_per_unit, st.store_name, st.branch_name, st.trip_date, st.group_id FROM shopping_trip_items sti JOIN shopping_trips st ON sti.trip_id = st.id WHERE (sti.item_name = $1 OR sti.normalized_name = $2) AND sti.price_per_unit > 0 ORDER BY sti.price_per_unit ASC LIMIT 1`, [item.item_name, item.normalized_name || item.item_name]);
            if (bestPriceRes.rows.length > 0) { const bp = bestPriceRes.rows[0]; item.best_price = { price_per_unit: bp.price_per_unit, store_name: bp.store_name || 'ספק לא ידוע', branch_name: bp.branch_name || '', trip_date: bp.trip_date, is_local: bp.group_id === group.id }; }
        }

        const goals = await pool.query('SELECT g.*, u.nickname as owner_name FROM goals g LEFT JOIN users u ON g.target_user_id = u.id WHERE g.user_id = $1 OR g.target_user_id = $1', [user.id]);
        const allBundles = await pool.query('SELECT * FROM quiz_bundles ORDER BY created_at DESC');
        const userBundles = await pool.query(`SELECT ua.*, qb.title, qb.type, qb.age_group, qb.threshold, qb.text_content, qb.reward as default_reward, u.nickname as assignee_name FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id LEFT JOIN users u ON ua.user_id = u.id WHERE ua.user_id = $1 OR $2 = 'ADMIN'`, [user.id, user.role]);

        for (let b of userBundles.rows) { const qRes = await pool.query('SELECT * FROM quiz_questions WHERE bundle_id = $1', [b.bundle_id]); b.questions = qRes.rows; }

        let weeklyStats = null;
        if (user.role !== 'ADMIN') {
            const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const spentRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as spent FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= $2", [user.id, startOfWeek]);
            weeklyStats = { spent: spentRes.rows[0].spent, limit: user.allowance_amount };
        }
        
        let community_updates = [];
        let community_businesses = [];
        
        if (group.community_id) {
            const commBizRes = await pool.query(`
                SELECT cb.discount_pct, cb.created_at, b.name as business_name, b.id as business_id, b.group_code, c.name as comm_name
                FROM community_businesses cb
                JOIN family_groups b ON cb.business_id = b.id
                JOIN communities c ON cb.community_id = c.id
                WHERE cb.community_id = $1 AND cb.status = 'approved'
            `, [group.community_id]);
            
            community_businesses = commBizRes.rows; 
            
            if (group.type === 'FAMILY') {
                commBizRes.rows.forEach(biz => {
                    community_updates.push({
                        type: 'system',
                        category: 'community',
                        id: `biz_${biz.business_name}`,
                        user_id: 0,
                        user_name: 'קהילה',
                        description: `הטבה חדשה בקהילת ${biz.comm_name}: ${biz.business_name} (הנחה: ${biz.discount_pct}%) 🛍️`,
                        amount: 0,
                        date: biz.created_at ? new Date(biz.created_at) : new Date()
                    });
                });
            }
        }

        res.json({ 
            user, group, tasks: tasks.rows, pantry: pantry.rows, shopping_list: shoppingList.rows, 
            goals: goals.rows, quiz_bundles: userBundles.rows, all_bundles: allBundles.rows, 
            weekly_stats: weeklyStats, community_updates: community_updates, community_businesses: community_businesses 
        });
    } catch (e) { 
        console.error('Error in /api/data/:userId:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// ============================================================
// --- SHOPPING LIST ENDPOINTS ---
// ============================================================

app.post('/api/shopping/add', async (req, res) => {
    try {
        const { itemName, quantity, unit, estimatedPrice, userId, groupId, unitsPerPackage } = req.body;
        let actualGroupId = parseInt(groupId);
        if (isNaN(actualGroupId) && userId) { const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]); if (uRes.rows.length > 0) actualGroupId = uRes.rows[0].group_id; }
        if (!actualGroupId) return res.status(400).json({ success: false, error: 'Group ID is missing' });
        
        await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, unit, estimated_price, units_per_package) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [actualGroupId, userId || null, itemName, parseFloat(quantity) || 1, unit || 'יח\'', parseFloat(estimatedPrice) || 0, parseInt(unitsPerPackage) || 1]);
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
        const tripRes = await pool.query(`INSERT INTO shopping_trips (group_id, buyer_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [groupId, userId, storeName, branchName, totalAmount]);
        const tripId = tripRes.rows[0].id;
        
        await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'groceries', 'expense')`, [userId, groupId, totalAmount, `רכש מלאי/סופר: ${storeName}`]);
        
        for (let item of boughtItems) {
            const originalItemRes = await pool.query('SELECT unit, units_per_package FROM shopping_list WHERE id=$1', [item.id]);
            let itemUnit = "יח'"; let itemUpp = 1;
            if (originalItemRes.rows.length > 0) { itemUnit = originalItemRes.rows[0].unit || "יח'"; itemUpp = originalItemRes.rows[0].units_per_package || 1; }

            await pool.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit, units_per_package, unit) VALUES ($1, $2, $3, $4, $5, $6)`, [tripId, item.name, item.quantity, item.price / (item.quantity||1), itemUpp, itemUnit]);
            
            const pRes = await pool.query(`SELECT id, quantity FROM pantry WHERE group_id=$1 AND item_name=$2`, [groupId, item.name]);
            if (pRes.rows.length > 0) {
                await pool.query(`UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP, units_per_package = $2, unit = $3 WHERE id=$4`, [item.quantity, itemUpp, itemUnit, pRes.rows[0].id]);
            } else {
                await pool.query(`INSERT INTO pantry (group_id, item_name, quantity, unit, units_per_package) VALUES ($1, $2, $3, $4, $5)`, [groupId, item.name, item.quantity, itemUnit, itemUpp]);
            }
            await pool.query(`DELETE FROM shopping_list WHERE id=$1`, [item.id]);
        }
        
        for (let item of missingItems) { await pool.query(`UPDATE shopping_list SET status='pending' WHERE id=$1`, [item.id]); }
        await pool.query('COMMIT'); res.json({ success: true });
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const { groupId } = req.query;
        const trips = await pool.query('SELECT st.*, u.nickname FROM shopping_trips st LEFT JOIN users u ON st.buyer_id = u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC', [groupId]);
        for (let t of trips.rows) { const items = await pool.query('SELECT * FROM shopping_trip_items WHERE trip_id=$1', [t.id]); t.items = items.rows; }
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
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, status, unit, units_per_package) VALUES ($1, $2, $3, $4, 'pending', $5, $6)`, [groupId, userId, i.item_name, i.quantity, i.unit, i.units_per_package]);
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
        if (!actualGroupId) return res.status(400).json({ success: false, error: 'Group ID is missing' });

        const existing = await pool.query('SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2', [actualGroupId, itemName]);
        if (existing.rows.length > 0) {
            await pool.query('UPDATE pantry SET quantity = quantity + $1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [parseFloat(quantity) || 1, existing.rows[0].id]);
        } else {
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
        let deductAmount = (usedUnits > 0 && item.units_per_package > 0) ? (usedUnits / item.units_per_package) : usedQuantity;
        const newQty = Math.max(0, item.quantity - deductAmount);
        
        if (newQty <= 0) { await pool.query('DELETE FROM pantry WHERE id=$1', [item.id]); } 
        else { await pool.query('UPDATE pantry SET quantity=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [newQty, item.id]); }
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
        let params = [groupId]; let targetFilterA = ''; let targetFilterE = '';
        if (targetUserId && targetUserId !== 'all' && targetUserId !== 'undefined') { params.push(targetUserId); targetFilterA = `AND (target_user_id = $2 OR target_user_id IS NULL)`; targetFilterE = `AND user_id = $2`; }

        const query = `
            WITH Allocations AS ( SELECT category, amount_limit FROM budget_allocations WHERE group_id = $1 ${targetFilterA} ),
            Expenses AS ( SELECT category, SUM(amount) as spent FROM transactions WHERE group_id = $1 AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE) ${targetFilterE} GROUP BY category )
            SELECT COALESCE(a.category, e.category) as category, COALESCE(MAX(a.amount_limit), 0) as limit, COALESCE(MAX(e.spent), 0) as spent
            FROM Allocations a FULL OUTER JOIN Expenses e ON a.category = e.category GROUP BY COALESCE(a.category, e.category)
        `;
        const result = await pool.query(query, params); res.json(result.rows || []);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        const finalUserId = targetUserId === 'all' ? null : targetUserId;
        await pool.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, category, target_user_id) DO UPDATE SET amount_limit = $4`, [groupId, category, finalUserId, parseFloat(limit) || 0]);
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
        const tx = oldTx.rows[0]; const diff = parseFloat(amount) - parseFloat(tx.amount);
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
    try { await pool.query('UPDATE loans SET status=$1 WHERE id=$2', ['rejected', req.body.loanId]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); }
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
        await pool.query('COMMIT'); res.json({success:true});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// ============================================================
// --- MEMBERS & ADMIN TOOLS ---
// ============================================================

app.get('/api/group/members', async (req, res) => {
    try {
        const { groupId } = req.query;
        let users;
        try {
            users = await pool.query('SELECT id, nickname, role, balance, allowance_amount, interest_rate, birth_year, permissions FROM users WHERE group_id=$1 AND status=$2 ORDER BY role, nickname', [groupId, 'active']);
        } catch(err) {
            users = await pool.query('SELECT id, nickname, role, balance, allowance_amount, interest_rate, birth_year FROM users WHERE group_id=$1 AND status=$2 ORDER BY role, nickname', [groupId, 'active']);
        }
        res.json(users.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/users/:id/permissions', async (req, res) => {
    try {
        const { tabs, role } = req.body;
        if (!tabs.includes('feed')) tabs.push('feed');
        
        if (role) {
            await pool.query('UPDATE users SET permissions = $1, role = $2 WHERE id = $3', [JSON.stringify({ tabs }), role, req.params.id]);
        } else {
            await pool.query('UPDATE users SET permissions = $1 WHERE id = $2', [JSON.stringify({ tabs }), req.params.id]);
        }
        res.json({ success: true });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const { groupId } = req.query;
        const users = await pool.query('SELECT id, nickname, role, birth_year FROM users WHERE group_id=$1 AND status=$2', [groupId, 'pending']);
        res.json(users.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/approve-user', async (req, res) => {
    try { await pool.query('UPDATE users SET status=$1 WHERE id=$2', ['active', req.body.userId]); res.json({success:true}); } catch(e) { res.status(500).json({error: e.message}); }
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
    try { const { userId, allowance, interest } = req.body; await pool.query('UPDATE users SET allowance_amount=$1, interest_rate=$2 WHERE id=$3', [parseFloat(allowance)||0, parseFloat(interest)||0, userId]); res.json({success:true}); } 
    catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/payday', async (req, res) => {
    try {
        const { groupId } = req.body;
        const users = await pool.query(`SELECT id, allowance_amount, interest_rate, balance FROM users WHERE group_id=$1 AND status='active' AND role != 'ADMIN'`, [groupId]);
        let totalDistributed = 0;
        await pool.query('BEGIN');
        for(let u of users.rows) {
            let toAdd = parseFloat(u.allowance_amount) || 0; let bal = parseFloat(u.balance) || 0;
            if(bal > 0 && parseFloat(u.interest_rate) > 0) { toAdd += bal * (parseFloat(u.interest_rate) / 100); }
            if(toAdd > 0) {
                await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [toAdd, u.id]);
                await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, 'שכר / חלוקת קצבה ותמריצים', 'allowance', 'income')`, [u.id, groupId, toAdd]);
                totalDistributed += toAdd;
            }
        }
        await pool.query('COMMIT'); res.json({success:true, totalDistributed});
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
        const t = tRes.rows[0]; const rew = finalReward !== undefined ? (parseFloat(finalReward)||0) : (parseFloat(t.reward)||0);
        await pool.query('BEGIN');
        await pool.query('UPDATE tasks SET status=$1, reward=$2 WHERE id=$3', [status, rew, taskId]);
        if (status === 'approved') {
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [rew, t.assigned_to]);
            await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, 'tasks', 'income')`, [t.assigned_to, t.group_id, rew, 'תגמול משימה: ' + t.title]);
        }
        await pool.query('COMMIT'); res.json({success:true});
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
        const b = await pool.query('SELECT threshold, reward as default_reward FROM quiz_bundles WHERE id=$1', [bundleId]);
        const ua = await pool.query(`SELECT id, custom_reward FROM user_assignments WHERE user_id=$1 AND bundle_id=$2 AND status='assigned' ORDER BY id DESC LIMIT 1`, [userId, bundleId]);
        const passed = score >= b.rows[0].threshold; const status = passed ? 'completed' : 'failed';
        await pool.query('BEGIN');
        if (ua.rows.length > 0) {
            await pool.query('UPDATE user_assignments SET status=$1, score=$2 WHERE id=$3', [status, score, ua.rows[0].id]);
            if (passed) {
                const rew = parseFloat(ua.rows[0].custom_reward) || parseFloat(b.rows[0].default_reward) || 0;
                await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [rew, userId]);
                await pool.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, 'בונוס למידה מ-AI', 'academy', 'income')`, [userId, groupId, rew]);
            }
        }
        await pool.query('COMMIT'); res.json({success:true});
    } catch(e) { await pool.query('ROLLBACK'); res.status(500).json({error: e.message}); }
});

// יצירת הכשרה / חפיפה ידנית ושמירה למאגר
app.post('/api/academy/bundles', async (req, res) => {
    let dbClient;
    try {
        const { groupId, title, ageGroup, reward, textContent, questions, type } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        const bundleType = type || 'professional';
        
        const bundleRes = await dbClient.query(
            `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by) VALUES ($1, $2, $3, $4, 80, $5, $6) RETURNING id`, 
            [bundleType, ageGroup || 'כללי', title, textContent || '', parseFloat(reward)||0, String(groupId)]
        );
        
        const newBundleId = bundleRes.rows[0].id;
        
        if (questions && Array.isArray(questions)) {
            for (const q of questions) {
                await dbClient.query(
                    `INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, 
                    [newBundleId, q.q, JSON.stringify(q.options), q.correct]
                );
            }
        }
        
        await dbClient.query('COMMIT');
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally {
        if(dbClient) dbClient.release();
    }
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
        let rawText = result.response.text().trim();
        
        // תיקון חילוץ JSON בטוח ממבנה Markdown אם נוצר בטעות על ידי ה-AI
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('תגובת ה-AI לא הכילה מבנה תקין');
        const quizData = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));

        const bundleType = gType === 'BUSINESS' ? 'professional' : 'financial';
        const bundleRes = await pool.query(`INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by) VALUES ($1, $2, $3, $4, 80, $5, $6) RETURNING id`, [bundleType, ageGroup, quizData.title, quizData.text_content || '', 10.0, String(groupId)]);
        const newBundleId = bundleRes.rows[0].id;
        for (const q of quizData.questions) await pool.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת הלומדה - נסה שנית'); }
});

// --- נתיבים לניהול ועריכת הכשרות ---
app.post('/api/academy/bundles', async (req, res) => {
    let dbClient;
    try {
        const { groupId, title, ageGroup, reward, textContent, questions, type } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        const bundleType = type || 'professional';
        const bundleRes = await dbClient.query(
            `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by) VALUES ($1, $2, $3, $4, 80, $5, $6) RETURNING id`, 
            [bundleType, ageGroup || 'כללי', title, textContent || '', parseFloat(reward)||0, String(groupId)]
        );
        const newBundleId = bundleRes.rows[0].id;
        
        if (questions && Array.isArray(questions)) {
            for (const q of questions) {
                await dbClient.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
            }
        }
        await dbClient.query('COMMIT');
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally { if(dbClient) dbClient.release(); }
});

app.get('/api/academy/bundles/:id', async (req, res) => {
    try {
        const bRes = await pool.query('SELECT * FROM quiz_bundles WHERE id = $1', [req.params.id]);
        if (bRes.rows.length === 0) return res.status(404).json({ error: 'לא נמצאה הכשרה' });
        const qRes = await pool.query('SELECT * FROM quiz_questions WHERE bundle_id = $1 ORDER BY id ASC', [req.params.id]);
        res.json({ success: true, bundle: { ...bRes.rows[0], questions: qRes.rows } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/academy/bundles/:id', async (req, res) => {
    let dbClient;
    try {
        const { title, ageGroup, reward, textContent, questions } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        await dbClient.query(`UPDATE quiz_bundles SET title=$1, age_group=$2, reward=$3, text_content=$4 WHERE id=$5`, [title, ageGroup || 'כללי', parseFloat(reward)||0, textContent || '', req.params.id]);
        await dbClient.query('DELETE FROM quiz_questions WHERE bundle_id = $1', [req.params.id]);
        
        if (questions && Array.isArray(questions)) {
            for (const q of questions) {
                await dbClient.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [req.params.id, q.q, JSON.stringify(q.options), q.correct]);
            }
        }
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally { if(dbClient) dbClient.release(); }
});

// --- נתיבים לניהול ועריכת הכשרות ---
app.post('/api/academy/bundles', async (req, res) => {
    let dbClient;
    try {
        const { groupId, title, ageGroup, reward, textContent, questions, type } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        const bundleType = type || 'professional';
        const bundleRes = await dbClient.query(
            `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward, created_by) VALUES ($1, $2, $3, $4, 80, $5, $6) RETURNING id`, 
            [bundleType, ageGroup || 'כללי', title, textContent || '', parseFloat(reward)||0, String(groupId)]
        );
        const newBundleId = bundleRes.rows[0].id;
        
        if (questions && Array.isArray(questions)) {
            for (const q of questions) {
                await dbClient.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [newBundleId, q.q, JSON.stringify(q.options), q.correct]);
            }
        }
        await dbClient.query('COMMIT');
        res.json({ success: true, bundleId: newBundleId });
    } catch (e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally { if(dbClient) dbClient.release(); }
});

app.get('/api/academy/bundles/:id', async (req, res) => {
    try {
        const bRes = await pool.query('SELECT * FROM quiz_bundles WHERE id = $1', [req.params.id]);
        if (bRes.rows.length === 0) return res.status(404).json({ error: 'לא נמצאה הכשרה' });
        const qRes = await pool.query('SELECT * FROM quiz_questions WHERE bundle_id = $1 ORDER BY id ASC', [req.params.id]);
        res.json({ success: true, bundle: { ...bRes.rows[0], questions: qRes.rows } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/academy/bundles/:id', async (req, res) => {
    let dbClient;
    try {
        const { title, ageGroup, reward, textContent, questions } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        await dbClient.query(`UPDATE quiz_bundles SET title=$1, age_group=$2, reward=$3, text_content=$4 WHERE id=$5`, [title, ageGroup || 'כללי', parseFloat(reward)||0, textContent || '', req.params.id]);
        await dbClient.query('DELETE FROM quiz_questions WHERE bundle_id = $1', [req.params.id]);
        
        if (questions && Array.isArray(questions)) {
            for (const q of questions) {
                await dbClient.query(`INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`, [req.params.id, q.q, JSON.stringify(q.options), q.correct]);
            }
        }
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    } finally { if(dbClient) dbClient.release(); }
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
// --- יצירת תמונות (לוגו ובאנר) באמצעות AI  ---
app.post('/api/ai/generate-image', async (req, res) => {
    try {
        const { prompt, groupId, type } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        
        // אנו משתמשים בשירות יצירת התמונות החינמי של pollinations.ai 
        // כדי לספק תוצאה מידית ויציבה ללא תלות במפתחות פרימיום.
        const encodedPrompt = encodeURIComponent(prompt);
        
        // הגדרת מידות התמונה (באנר מלבני, לוגו מרובע)
        const width = type === 'banner' ? 1200 : 512;
        const height = type === 'banner' ? 400 : 512;
        
        // הוספת Seed אקראי כדי למנוע קבלת תמונה מהקאש (שכפול) בכל לחיצה
        const seed = Math.floor(Math.random() * 1000000);
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
        
        // השרת מחזיר את הכתובת הישירה לתמונה מיד, כשהדפדפן יטען אותה היא תיווצר בזמן אמת.
        res.json({ success: true, imageUrl: imageUrl });
    } catch(e) { 
        console.error('Image Gen Error:', e);
        res.status(500).json({ error: 'שירות יצירת התמונות אינו זמין כרגע. נסה להעלות קובץ ידנית.' });
    }
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
        const { question, guideType } = req.body;
        if (!genAI) return res.status(500).json({ success: false, error: 'מפתח API חסר בשרת' });

        let guideText = "";
        let fileName = guideType === 'BIZ' ? 'biz-guide.html' : 'guide.html';
        
        try {
            guideText = fs.readFileSync(path.join(__dirname, 'public', fileName), 'utf-8');
        } catch(e) {
            guideText = guideType === 'BIZ' ? "Oneflow Life BIZ is a business management app." : "Oneflow Life is a family management app.";
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let prompt = "";
        if (guideType === 'BIZ') {
            prompt = `You are 'FamliAI', the professional business AI assistant for the 'Oneflow Life BIZ' app. 
            A user is reading the business user guide and asked a question to understand the system better.
            Here is the full content of the business guide HTML:
            ${guideText}
            
            User's question: "${question}"
            
            Answer directly in Hebrew based ONLY on the guide content above. 
            Be concise (3-4 sentences max), professional yet friendly, use emojis, and address the user directly. Do not use complex markdown, just basic bolding.`;
        } else {
            prompt = `You are 'familAI', the friendly AI assistant for the 'Oneflow Life' family app. 
            A user is reading the user guide and asked a question to understand the system better.
            Here is the full content of the guide HTML:
            ${guideText}
            
            User's question: "${question}"
            
            Answer directly in Hebrew based ONLY on the guide content above. 
            Be concise (3-4 sentences max), friendly, use emojis, and address the user directly. Do not use complex markdown, just basic bolding.`;
        }

        const result = await model.generateContent(prompt);
        res.json({ success: true, answer: result.response.text().trim() });
    } catch (e) {
        console.error('Guide Chat Error:', e);
        res.status(500).json({ success: false, error: 'מצטערת, לא הצלחתי לייצר תשובה כרגע.' });
    }
});

// --- TIME CLOCK ENDPOINTS WITH GPS ---

app.post('/api/timeclock/set-location', async (req, res) => {
    try {
        const { groupId, adminId, lat, lng } = req.body;
        const uRes = await pool.query('SELECT role FROM users WHERE id=$1 AND group_id=$2', [adminId, groupId]);
        if (uRes.rows.length === 0 || uRes.rows[0].role !== 'ADMIN') return res.status(403).json({error: 'רק מנהל רשאי להגדיר את מיקום העסק'});
        
        await pool.query('UPDATE family_groups SET location_lat=$1, location_lng=$2 WHERE id=$3', [lat, lng, groupId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/timeclock/status', async (req, res) => {
    try {
        const { userId } = req.query;
        const openPunch = await pool.query('SELECT punch_in FROM time_clock WHERE user_id=$1 AND punch_out IS NULL', [userId]);
        res.json({ isPunchedIn: openPunch.rows.length > 0, punchInTime: openPunch.rows.length > 0 ? openPunch.rows[0].punch_in : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timeclock/punch', async (req, res) => {
    try {
        const { userId, groupId, lat, lng } = req.body;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'לא התקבל מיקום. חובה לאשר גישה למיקום (GPS) כדי לדווח.' });
        }

        const gRes = await pool.query('SELECT location_lat, location_lng FROM family_groups WHERE id=$1', [groupId]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
        
        const bizLat = gRes.rows[0].location_lat;
        const bizLng = gRes.rows[0].location_lng;
        
        if (!bizLat || !bizLng) {
            return res.status(400).json({ error: 'המנהל טרם הגדיר את מיקום העסק במערכת. פנה להנהלה.' });
        }
        
        const distance = calculateDistance(lat, lng, bizLat, bizLng);
        const MAX_ALLOWED_DISTANCE = 150; 
        
        if (distance > MAX_ALLOWED_DISTANCE) {
            return res.status(403).json({ error: `אינך נמצא בקרבת העסק. מרחק נוכחי: ${Math.round(distance)} מטר. מותר עד ${MAX_ALLOWED_DISTANCE} מטר.` });
        }

        const openPunch = await pool.query('SELECT id, punch_in FROM time_clock WHERE user_id=$1 AND punch_out IS NULL', [userId]);
        if (openPunch.rows.length > 0) {
            const punchId = openPunch.rows[0].id;
            const punchIn = new Date(openPunch.rows[0].punch_in);
            const punchOut = new Date();
            const diffMins = Math.max(0, Math.round((punchOut - punchIn) / 60000));
            await pool.query('UPDATE time_clock SET punch_out=$1, total_minutes=$2 WHERE id=$3', [punchOut, diffMins, punchId]);
            res.json({ success: true, status: 'out' });
        } else {
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

app.post('/api/timeclock/manual', async (req, res) => {
    try {
        const { groupId, userId, punchIn, punchOut, totalMins } = req.body;
        await pool.query('INSERT INTO time_clock (user_id, group_id, punch_in, punch_out, total_minutes) VALUES ($1, $2, $3, $4, $5)', [userId, groupId, punchIn, punchOut, totalMins]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- STORE / E-COMMERCE ENDPOINTS (B2B/B2C) ---
// ============================================================

app.get('/api/store/settings/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM store_settings WHERE group_id=$1', [req.params.groupId]);
        if (result.rows.length > 0) res.json({ success: true, settings: result.rows[0] });
        else res.json({ success: true, settings: { is_active: false, min_order: 0, welcome_message: '', phone: '', slogan: '', store_type: 'retail', logo_url: null, modifier_presets: '[]', open_time: '', close_time: '', whatsapp_number: '' } });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/settings', async (req, res) => {
    try {
        const { groupId, isActive, welcomeMessage, phone, minOrder, slogan, storeType, logoUrl, bannerUrl, openTime, closeTime, whatsappNumber, deliveryFee, includeVat, storeAlias } = req.body;
        
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS open_time VARCHAR(10)`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS close_time VARCHAR(10)`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20)`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS banner_url TEXT`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS include_vat BOOLEAN DEFAULT FALSE`); } catch(e) {}
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_alias VARCHAR(50) UNIQUE`); } catch(e) {}

        const isVat = (includeVat === true || String(includeVat) === 'true');
        const aliasVal = storeAlias && storeAlias.trim() !== '' ? storeAlias.trim().toLowerCase() : null;

        if (aliasVal) {
            const aliasCheck = await pool.query('SELECT group_id FROM store_settings WHERE store_alias = $1 AND group_id != $2', [aliasVal, groupId]);
            if (aliasCheck.rows.length > 0) return res.status(400).json({ error: 'הכינוי הזה כבר תפוס ע"י חנות אחרת, אנא בחרו כינוי אחר.' });
        }
        
        await pool.query(`
            INSERT INTO store_settings (
                group_id, is_active, welcome_message, phone, min_order, slogan, store_type, logo_url, banner_url, open_time, close_time, whatsapp_number, delivery_fee, include_vat, store_alias
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 
                NULLIF($8, 'DELETE'), 
                NULLIF($9, 'DELETE'), 
                $10, $11, $12, $13, $14, $15) 
            ON CONFLICT (group_id) DO UPDATE SET 
                is_active = EXCLUDED.is_active, 
                welcome_message = EXCLUDED.welcome_message, 
                phone = EXCLUDED.phone, 
                min_order = EXCLUDED.min_order, 
                slogan = EXCLUDED.slogan, 
                store_type = EXCLUDED.store_type, 
                logo_url = CASE 
                    WHEN $8 = 'DELETE' THEN NULL 
                    WHEN $8 IS NOT NULL AND $8 != '' THEN $8 
                    ELSE store_settings.logo_url 
                END,
                banner_url = CASE 
                    WHEN $9 = 'DELETE' THEN NULL 
                    WHEN $9 IS NOT NULL AND $9 != '' THEN $9 
                    ELSE store_settings.banner_url 
                END,
                open_time = EXCLUDED.open_time, 
                close_time = EXCLUDED.close_time, 
                whatsapp_number = EXCLUDED.whatsapp_number, 
                delivery_fee = EXCLUDED.delivery_fee, 
                include_vat = EXCLUDED.include_vat,
                store_alias = EXCLUDED.store_alias
        `, [
            groupId, isActive, welcomeMessage, phone, parseFloat(minOrder)||0, slogan, storeType, 
            logoUrl || null, bannerUrl || null, openTime || '', closeTime || '', whatsappNumber || '', parseFloat(deliveryFee) || 0, isVat, aliasVal
        ]);
        
        res.json({ success: true });
    } catch(e) { 
        console.error("Error saving store settings:", e);
        res.status(500).json({ error: e.message }); 
    }
});
app.post('/api/store/settings/presets', async (req, res) => {
    try {
        const { groupId, presets } = req.body;
        try { await pool.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS modifier_presets TEXT`); } catch(e) {}
        await pool.query(`UPDATE store_settings SET modifier_presets=$1 WHERE group_id=$2`, [presets, groupId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/store/catalog/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM store_catalog WHERE group_id=$1 ORDER BY category, name', [req.params.groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/catalog', async (req, res) => {
    try {
        const { groupId, name, description, price, category, imageUrl, optionsText, badgeText, badgeColor, productType, longDescription } = req.body;
        
        const countRes = await pool.query('SELECT COUNT(*) FROM store_catalog WHERE group_id=$1', [groupId]);
        if (parseInt(countRes.rows[0].count) >= 50) {
            return res.status(400).json({ error: 'הגעת למגבלת 50 המוצרים במסלול החינמי! שדרג למסלול PRO.' });
        }

        const result = await pool.query(
            'INSERT INTO store_catalog (group_id, name, description, price, category, image_url, options_text, badge_text, badge_color, product_type, long_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *', 
            [groupId, name, description, parseFloat(price)||0, category, imageUrl, optionsText, badgeText || null, badgeColor || 'red', productType || 'retail', longDescription || '']
        );
        res.json({ success: true, item: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/catalog/:id', async (req, res) => {
    try {
        const { name, description, price, category, imageUrl, optionsText, badgeText, badgeColor, productType, longDescription } = req.body;
        
        const result = await pool.query(
            'UPDATE store_catalog SET name=$1, description=$2, price=$3, category=$4, image_url=COALESCE($5, image_url), options_text=$6, badge_text=$7, badge_color=$8, product_type=$9, long_description=$10 WHERE id=$11 RETURNING *', 
            [name, description, parseFloat(price)||0, category, imageUrl, optionsText, badgeText || null, badgeColor || 'red', productType || 'retail', longDescription || '', req.params.id]
        );
        res.json({ success: true, item: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/catalog/toggle', async (req, res) => {
    try {
        const { itemId, isAvailable } = req.body;
        await pool.query('UPDATE store_catalog SET is_available=$1 WHERE id=$2', [isAvailable, itemId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/catalog/:id', async (req, res) => {
    try { await pool.query('DELETE FROM store_catalog WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});
// --- הצעות מחיר (Quotes) ---
app.post('/api/store/quotes', async (req, res) => {
    try {
        const { groupId, customerName, customerPhone, items, totalAmount, notes } = req.body;
        const result = await pool.query(
            `INSERT INTO store_orders (group_id, customer_name, customer_phone, total_amount, status, notes, items, created_at) 
             VALUES ($1, $2, $3, $4, 'quote', $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
            [groupId, customerName, customerPhone, totalAmount, notes, JSON.stringify(items)]
        );
        res.json({ success: true, quoteId: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/store/quotes/:groupId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM store_orders 
             WHERE group_id = $1 AND (status = 'quote' OR quote_status IS NOT NULL)
             ORDER BY created_at DESC`, 
            [req.params.groupId]
        );
        res.json({ success: true, quotes: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/store/quotes/:id', async (req, res) => {
    try {
        const { customerName, customerPhone, items, totalAmount, notes } = req.body;
        await pool.query(
            `UPDATE store_orders SET customer_name=$1, customer_phone=$2, total_amount=$3, notes=$4, items=$5 WHERE id=$6 AND status='quote'`,
            [customerName, customerPhone, totalAmount, notes, JSON.stringify(items), req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/store/orders/:groupId', async (req, res) => {
    try {
        const orders = await pool.query("SELECT * FROM store_orders WHERE group_id=$1 AND status != 'quote' ORDER BY created_at DESC", [req.params.groupId]);
        for (let o of orders.rows) {
            const items = await pool.query('SELECT * FROM store_order_items WHERE order_id=$1', [o.id]);
            if (items.rows.length > 0) {
                o.items = items.rows;
            }
            // else: keep JSONB items as-is (quote-converted orders store items in JSONB column)
        }
        res.json(orders.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הוספת הזמנה לחנות
app.post('/api/store/orders', async (req, res) => {
    let dbClient;
    try {
        const { groupId, customerName, customerPhone, items, totalAmount, isDelivery, deliveryFee, deliveryDetails, notes, status } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        
        try { await dbClient.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE`); } catch(e){}
        try { await dbClient.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0`); } catch(e){}
        try { await dbClient.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_details TEXT`); } catch(e){}
        try { await dbClient.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS notes TEXT`); } catch(e){}
        
        const deliveryDetailsStr = deliveryDetails ? JSON.stringify(deliveryDetails) : null;
        const actualDeliveryFee = parseFloat(deliveryFee) || 0;
        const isDeliv = isDelivery === true || isDelivery === 'true';
        
        const familyGroupId = req.body.familyGroupId ? parseInt(req.body.familyGroupId) : null;
        const finalStatus = status || 'new';
        
        const oRes = await dbClient.query(
            'INSERT INTO store_orders (group_id, customer_name, customer_phone, total_amount, status, created_at, is_delivery, delivery_fee, delivery_details, family_group_id, quote_status, notes) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, NULL, $10) RETURNING id', 
            [groupId, customerName, customerPhone, parseFloat(totalAmount)||0, finalStatus, isDeliv, actualDeliveryFee, deliveryDetailsStr, familyGroupId, notes || null]
        );
        const orderId = oRes.rows[0].id;
        
        let itemsHtmlList = '';
        await dbClient.query('UPDATE store_orders SET items = $1 WHERE id = $2', [JSON.stringify(items), orderId]);
        
        for (let item of items) {
            // דילוג על מטא-דאטה או תשלום חוב כדי לא לקרוס על Foreign Key
            if (item.is_quote_metadata || !item.catalogId || item.catalogId === 0 || item.catalogId === 999999) continue; 
            
            await dbClient.query('INSERT INTO store_order_items (order_id, catalog_id, item_name, quantity, price_at_order) VALUES ($1, $2, $3, $4, $5)', [orderId, item.catalogId, item.name, item.quantity, item.price]);
            itemsHtmlList += `<li>${item.name} - כמות: ${item.quantity} - ₪${item.price}</li>`;
        }
        
        if (isDeliv && actualDeliveryFee > 0) {
            itemsHtmlList += `<li><strong>דמי משלוח</strong> - ₪${actualDeliveryFee}</li>`;
        }
        
        await dbClient.query('COMMIT');

        setTimeout(async () => {
            try {
                if (!customerName || customerName === 'לקוח קופה' || customerName === 'לקוח מזדמן') return;
                let custExist;
                if (customerPhone) {
                     custExist = await pool.query('SELECT id FROM store_customers WHERE group_id = $1 AND (phone = $2 OR name = $3)', [groupId, customerPhone, customerName]);
                } else {
                     custExist = await pool.query('SELECT id FROM store_customers WHERE group_id = $1 AND name = $2', [groupId, customerName]);
                }

                if (custExist.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO store_customers (group_id, name, phone, email, business_id, notes, created_at) 
                         VALUES ($1, $2, $3, '', '', $4, CURRENT_TIMESTAMP)`,
                        [groupId, customerName, customerPhone || '', `נוצר אוטומטית מהזמנה בחנות #${orderId}`]
                    );
                } else {
                    if (customerPhone) {
                        const custId = custExist.rows[0].id;
                        await pool.query('UPDATE store_customers SET phone = $1 WHERE id = $2 AND (phone IS NULL OR phone = \'\')', [customerPhone, custId]);
                    }
                }
            } catch(e) {}
        }, 100);
        
        const gRes = await pool.query('SELECT admin_email, name FROM family_groups WHERE id=$1', [groupId]);
        if(gRes.rows.length > 0 && gRes.rows[0].admin_email) {
            const deliveryHtml = isDeliv ? `<p style="margin-top: 10px; padding: 10px; background: #e0e7ff; border-radius: 8px;"><strong>כתובת למשלוח:</strong> ${deliveryDetails?.street || ''} ${deliveryDetails?.house || ''}, ${deliveryDetails?.city || ''}</p>` : '';
            const emailHtml = `<div style="direction:rtl; font-family:Arial; background:#f8fafc; padding:20px; border-radius:10px;">
                <h2 style="color:#0f172a;">הזמנה חדשה בחנות שלך! 🛍️</h2>
                <p>התקבלה הזמנה חדשה מאת: <strong>${customerName}</strong> (טלפון: ${customerPhone})</p>
                <p style="font-size:18px;">סה"כ לתשלום: <strong style="color:#16a34a;">₪${totalAmount}</strong></p>
                ${deliveryHtml}
                <div style="background:white; padding:15px; border-radius:8px; margin-top:15px;">
                    <h3 style="margin-top:0; border-b:1px solid #eee; padding-bottom:5px;">פירוט הפריטים:</h3>
                    <ul>${itemsHtmlList}</ul>
                </div>
            </div>`;
            sendSystemEmail(gRes.rows[0].admin_email, `הזמנה חדשה מ-${customerName} - ₪${totalAmount}`, emailHtml);
        }
        
        res.json({ success: true, orderId });
    } catch(e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        console.error("Order API Error:", e);
        res.status(500).json({ error: e.message }); 
    } finally { if(dbClient) dbClient.release(); }
});

app.post('/api/store/orders/status', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        await pool.query('UPDATE store_orders SET status=$1 WHERE id=$2', [status, orderId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/store/orders/:id/target-date', async (req, res) => {
    try {
        const { targetDatetime } = req.body;
        await pool.query('UPDATE store_orders SET target_datetime=$1 WHERE id=$2', [targetDatetime || null, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/store/quotes/:id/status', async (req, res) => {
    try {
        const { quoteStatus } = req.body;
        await pool.query(`UPDATE store_orders SET quote_status=$1 WHERE id=$2 AND status='quote'`, [quoteStatus, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// --- שליפת הזמנות ללקוח קצה (משפחה) ---
app.get('/api/store/orders/my/:userId', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.params.userId]);
        if (uRes.rows.length === 0) return res.status(404).json({ error: 'משתמש לא נמצא' });
        const familyGroupId = uRes.rows[0].group_id;

        // שולפים את כל ההזמנות של המשפחה - כולל הצעות מחיר, איסוף עצמי ומשלוחים
        const orders = await pool.query(`
            SELECT so.*, fg.name as store_name 
            FROM store_orders so 
            JOIN family_groups fg ON so.group_id = fg.id 
            WHERE so.family_group_id = $1
            ORDER BY so.created_at DESC
        `, [familyGroupId]);

        res.json({ success: true, orders: orders.rows });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});
// --- אישור הצעת מחיר והפיכתה להזמנה במקום ---
app.post('/api/store/quotes/:id/approve', async (req, res) => {
    try {
        const { targetDatetime } = req.body;
        const quoteId = req.params.id;
        
        // הופך את הצעת המחיר להזמנה במקום לייצר שורה כפולה!
        const updateRes = await pool.query(
            `UPDATE store_orders 
             SET status = 'new', quote_status = 'approved', target_datetime = $1, created_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND status = 'quote' RETURNING *`,
            [targetDatetime || null, quoteId]
        );

        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'ההצעה לא נמצאה או שכבר אושרה' });
        const quote = updateRes.rows[0];

        // יצירת לקוח ברקע
        setTimeout(async () => {
            try {
                if (!quote.customer_name) return;
                const custExist = await pool.query('SELECT id FROM store_customers WHERE group_id = $1 AND name = $2', [quote.group_id, quote.customer_name]);
                if (custExist.rows.length === 0) {
                    let businessId = '';
                    try {
                        const itemsArr = typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items;
                        const meta = itemsArr.find(i => i.is_quote_metadata);
                        if (meta) { businessId = JSON.parse(meta.data).companyId || ''; }
                    } catch(e) {}
                    await pool.query(
                        `INSERT INTO store_customers (group_id, name, phone, email, business_id, notes, created_at) 
                         VALUES ($1, $2, $3, '', $4, $5, CURRENT_TIMESTAMP)`,
                        [quote.group_id, quote.customer_name, quote.customer_phone || '', businessId, `לקוח הוקם מאישור הצעה #${quoteId}`]
                    );
                }
            } catch(e) { console.error('Customer Creation Error:', e.message); }
        }, 100);

        res.json({ success: true, orderId: quote.id });
    } catch(e) { res.status(500).json({ error: 'שגיאת שרת: ' + e.message }); }
});
// --- מועדון לקוחות (שליפה, הוספה, ועריכה) ---
app.get('/api/store/customers/:groupId', async (req, res) => {
    try {
        const { type } = req.query;
        let result;
        if(type === 'order') {
            // לקוחות חנות: הזמנות שלא הגיעו מהצעת מחיר (quote_status='draft')
            result = await pool.query(`SELECT DISTINCT sc.* FROM store_customers sc JOIN store_orders so ON so.group_id=sc.group_id AND (so.customer_phone=sc.phone OR so.customer_name=sc.name) WHERE sc.group_id=$1 AND so.status='new' AND (so.quote_status IS NULL OR so.quote_status='draft') ORDER BY sc.name ASC`, [req.params.groupId]);
        } else if(type === 'quote') {
            // לקוחות הצעת מחיר: יש להם הצעה ממתינה או מאושרת
            result = await pool.query(`SELECT DISTINCT sc.* FROM store_customers sc JOIN store_orders so ON so.group_id=sc.group_id AND (so.customer_phone=sc.phone OR so.customer_name=sc.name) WHERE sc.group_id=$1 AND (so.status='quote' OR so.quote_status='approved') ORDER BY sc.name ASC`, [req.params.groupId]);
        } else {
            result = await pool.query('SELECT * FROM store_customers WHERE group_id=$1 ORDER BY name ASC', [req.params.groupId]);
        }
        res.json({ success: true, customers: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/customers', async (req, res) => {
    try {
        const { groupId, name, phone, email, businessId, notes } = req.body;
        const result = await pool.query(
            `INSERT INTO store_customers (group_id, name, phone, email, business_id, notes, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
            [groupId, name, phone || '', email || '', businessId || '', notes || '']
        );
        res.json({ success: true, customerId: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/customers/:id', async (req, res) => {
    try {
        const { name, phone, email, businessId, notes } = req.body;
        await pool.query(
            `UPDATE store_customers SET name=$1, phone=$2, email=$3, business_id=$4, notes=$5 WHERE id=$6`,
            [name, phone || '', email || '', businessId || '', notes || '', req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/customers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM store_customers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/customers/:id', async (req, res) => {
    try {
        const { name, phone, email, businessId, notes } = req.body;
        await pool.query(
            `UPDATE store_customers SET name=$1, phone=$2, email=$3, business_id=$4, notes=$5 WHERE id=$6`,
            [name, phone, email, businessId, notes, req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/storefront/:code', async (req, res) => {
    try {
        const codeOrAlias = req.params.code;
        
        const gRes = await pool.query(`
            SELECT f.id, f.name 
            FROM family_groups f
            LEFT JOIN store_settings s ON f.id = s.group_id
            WHERE f.group_code = $1 OR LOWER(s.store_alias) = LOWER($2)
        `, [codeOrAlias.toUpperCase(), codeOrAlias.toLowerCase()]);
        
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'חנות לא נמצאה' });
        
        const groupId = gRes.rows[0].id;
        const groupName = gRes.rows[0].name;

        const sRes = await pool.query('SELECT * FROM store_settings WHERE group_id=$1', [groupId]);
        const settings = sRes.rows.length > 0 ? sRes.rows[0] : { is_active: false, min_order: 0, welcome_message: '', phone: '', slogan: '', store_type: 'retail', logo_url: null, modifier_presets: '[]', open_time: '', close_time: '', whatsapp_number: '' };

        const cRes = await pool.query('SELECT * FROM store_catalog WHERE group_id=$1 AND is_available=TRUE ORDER BY category, name', [groupId]);

        let communityData = null;
        if (req.query.communityId) {
            const commRes = await pool.query(`
                SELECT c.name, cb.discount_pct 
                FROM community_businesses cb 
                JOIN communities c ON cb.community_id = c.id 
                WHERE cb.business_id = $1 AND cb.community_id = $2 AND cb.status = 'approved'
            `, [groupId, req.query.communityId]);
            
            if (commRes.rows.length > 0) {
                communityData = commRes.rows[0];
            }
        }

        res.json({ success: true, groupId, groupName, settings, catalog: cRes.rows, communityData });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/ai-desc', async (req, res) => {
    try {
        const { productName, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `כתוב לי פסקה קצרה ושיווקית מאוד (עד 2-3 משפטים) בעברית שתתאר את המוצר/מנה הבאה למכירה בחנות/מסעדה שלי: "${productName}". השתמש באימוג'ים ואל תשתמש במרכאות.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, description: result.response.text().trim() });
    } catch(e) { handleAIError(e, res, 'שגיאה בניסוח'); }
});

app.post('/api/biz/chat-assistant', async (req, res) => {
    try {
        const { query, context, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // בניית פרומפט חזק שמכניס את ה-AI לתפקיד עוזרת עסקית מקיפה
        const prompt = `You are 'FamliAI', the intelligent and friendly AI assistant for a business manager using the 'Oneflowlife Pro' management system. 
        Your job is to answer questions, analyze data, and guide the user on how to use the system.
        
        Here is the live data from the system (Orders, Employees, Inventory, Tasks, Finance):
        ${context}
        
        User's Request/Question: "${query}"
        
        Instructions for your response:
        1. Respond directly in Hebrew.
        2. Be professional, concise, but highly insightful.
        3. If the user asks about system data (like "how many open orders do I have" or "what is our budget status"), calculate or infer the answer using the JSON context provided above.
        4. If the user asks how to perform an action in the system (e.g., "how do I add a product"), guide them briefly based on standard UI knowledge (e.g., "Go to the Shop tab -> click Product Catalog -> Add Product").
        5. Do not invent data that is not in the context. If you don't know, say you don't have that specific data right now.
        6. Use emojis occasionally to maintain a friendly tone, but don't overdo it.
        7. Use Markdown ONLY for bolding (**text**) or simple lists. No complex tables or code blocks unless requested.`;
        
        const result = await model.generateContent(prompt);
        res.json({ success: true, answer: result.response.text().trim() });
    } catch(e) { handleAIError(e, res, 'שגיאה במערכת העוזרת'); }
});

// ============================================================
// --- COMMUNITIES & COUPONS ENDPOINTS ---
// ============================================================

async function initCommunityTables() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS communities (id SERIAL PRIMARY KEY, name VARCHAR(100), code VARCHAR(50) UNIQUE, manager_email VARCHAR(100), manager_password VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS community_businesses (community_id INT, business_id INT, discount_pct DECIMAL DEFAULT 0, PRIMARY KEY(community_id, business_id))`,
        `ALTER TABLE community_businesses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`,
        `ALTER TABLE community_businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
        `CREATE TABLE IF NOT EXISTS store_coupons (id SERIAL PRIMARY KEY, group_id INT, code VARCHAR(50), discount_pct DECIMAL DEFAULT 0, valid_until DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS community_id INT`,
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by_group_id INT`
    ];
    
    for (let q of queries) {
        try { await pool.query(q); } catch(e) { console.error("DB Init Warning on query:", q, e.message); }
    }
}
initCommunityTables();

// --- API ליזמות קהילתית (User-led Communities) ---
app.post('/api/community/user-create', async (req, res) => {
    try {
        const { name, city, groupId } = req.body;
        const code = 'C-' + generateGroupCode();
        const result = await pool.query(
            `INSERT INTO communities (name, city, code, created_by_group_id, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
            [name, city, code, groupId]
        );
        res.json({ success: true, community: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/community/my-initiatives/:groupId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, 
            (SELECT COUNT(*) FROM family_groups WHERE community_id = c.id AND type='FAMILY') as family_count 
            FROM communities c WHERE created_by_group_id = $1 ORDER BY created_at DESC
        `, [req.params.groupId]);
        res.json({ success: true, initiatives: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- BIZ APP: COMMUNITY ENDPOINTS (צד העסק) ---
// ============================================================

app.get('/api/biz/communities/my/:bizId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.name, c.city, c.image_url, cb.discount_pct, cb.status,
            (SELECT COUNT(*) FROM family_groups WHERE community_id = c.id AND type = 'FAMILY') as families_count,
            (SELECT COUNT(u.id) FROM users u JOIN family_groups f ON u.group_id = f.id WHERE f.community_id = c.id AND f.type = 'FAMILY') as users_count
            FROM community_businesses cb
            JOIN communities c ON cb.community_id = c.id
            WHERE cb.business_id = $1
        `, [req.params.bizId]);
        res.json({ success: true, communities: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/biz/communities/available/:bizId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.name, c.city, c.image_url,
            (SELECT COUNT(*) FROM family_groups WHERE community_id = c.id AND type = 'FAMILY') as families_count,
            (SELECT COUNT(u.id) FROM users u JOIN family_groups f ON u.group_id = f.id WHERE f.community_id = c.id AND f.type = 'FAMILY') as users_count
            FROM communities c
            WHERE c.id NOT IN (SELECT community_id FROM community_businesses WHERE business_id = $1)
        `, [req.params.bizId]);
        res.json({ success: true, communities: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/biz/communities/join', async (req, res) => {
    try {
        const { communityId, businessId, discountPct } = req.body;
        await pool.query(
            'INSERT INTO community_businesses (community_id, business_id, discount_pct, status, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (community_id, business_id) DO UPDATE SET discount_pct=$3, status=$4', 
            [communityId, businessId, parseFloat(discountPct)||0, 'pending']
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/biz/communities/leave/:communityId/:bizId', async (req, res) => {
    try {
        await pool.query('DELETE FROM community_businesses WHERE community_id=$1 AND business_id=$2', [req.params.communityId, req.params.bizId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/store/coupons/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM store_coupons WHERE group_id=$1 ORDER BY created_at DESC', [req.params.groupId]);
        res.json({ success: true, coupons: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/coupons', async (req, res) => {
    try {
        const { groupId, code, discountPct, validUntil } = req.body;
        if (!code || !discountPct) return res.status(400).json({ error: 'חסרים נתונים חובה' });
        
        await pool.query('INSERT INTO store_coupons (group_id, code, discount_pct, valid_until) VALUES ($1, $2, $3, $4)', [groupId, code.toUpperCase().trim(), parseFloat(discountPct), validUntil || null]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/coupons/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM store_coupons WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// --- מערכת מבצעים (Promotions) ---
// ==========================================

app.get('/api/init-promotions', async (req, res) => {
    try {
        await pool.query(`DROP TABLE IF EXISTS store_promotions`);
        await pool.query(`
            CREATE TABLE store_promotions (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                title VARCHAR(100) NOT NULL,
                promo_type VARCHAR(50) NOT NULL,
                promo_value DECIMAL(10,2),
                target_type VARCHAR(50) DEFAULT 'all',
                target_ids JSONB,
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                show_in_banner BOOLEAN DEFAULT TRUE,
                show_in_tab BOOLEAN DEFAULT TRUE,
                bg_color VARCHAR(20) DEFAULT 'pink',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        res.send('Promotions table recreated successfully with new display settings! You can close this tab.');
    } catch(e) { res.status(500).send('Error creating table: ' + e.message); }
});

app.get('/api/store/promotions/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM store_promotions WHERE group_id = $1 ORDER BY created_at DESC', [req.params.groupId]);
        res.json({ success: true, promotions: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/promotions', async (req, res) => {
    try {
        const { groupId, title, promoType, promoValue, targetType, targetIds, startDate, endDate, showInBanner, showInTab, bgColor } = req.body;
        const result = await pool.query(
            'INSERT INTO store_promotions (group_id, title, promo_type, promo_value, target_type, target_ids, start_date, end_date, show_in_banner, show_in_tab, bg_color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [groupId, title, promoType, promoValue || 0, targetType, JSON.stringify(targetIds || []), startDate || null, endDate || null, showInBanner, showInTab, bgColor]
        );
        res.json({ success: true, promotion: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/promotions/:id', async (req, res) => {
    try {
        const { title, promoType, promoValue, targetType, targetIds, startDate, endDate, showInBanner, showInTab, bgColor } = req.body;
        const result = await pool.query(
            'UPDATE store_promotions SET title=$1, promo_type=$2, promo_value=$3, target_type=$4, target_ids=$5, start_date=$6, end_date=$7, show_in_banner=$8, show_in_tab=$9, bg_color=$10 WHERE id=$11 RETURNING *',
            [title, promoType, promoValue || 0, targetType, JSON.stringify(targetIds || []), startDate || null, endDate || null, showInBanner, showInTab, bgColor, req.params.id]
        );
        res.json({ success: true, promotion: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/promotions/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM store_promotions WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/promotions/toggle/:id', async (req, res) => {
    try {
        const { isActive } = req.body;
        await pool.query('UPDATE store_promotions SET is_active = $1 WHERE id = $2', [isActive, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// --- מערכת רכש B2B, קטלוגים וספקים ---
// ==========================================

app.get('/api/init-procurement', async (req, res) => {
    try {
        await pool.query(`DROP TABLE IF EXISTS purchase_orders CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS purchase_requests CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS supplier_products CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS suppliers CASCADE`);

        await pool.query(`
            CREATE TABLE suppliers (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                contact_person VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(100),
                category VARCHAR(50),
                min_order DECIMAL(10,2) DEFAULT 0,
                delivery_days JSONB DEFAULT '[]',
                cutoff_time TIME DEFAULT '12:00:00',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE supplier_products (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                supplier_id INT REFERENCES suppliers(id) ON DELETE CASCADE,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                unit_type VARCHAR(50) DEFAULT 'יח''',
                units_per_package INT DEFAULT 1,
                properties JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE purchase_orders (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                supplier_id INT REFERENCES suppliers(id) ON DELETE RESTRICT,
                items JSONB NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                expected_delivery DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        res.send('B2B Procurement Engine (Suppliers, Catalogs, Orders) created successfully! You can close this tab.');
    } catch(e) { res.status(500).send('Error creating B2B tables: ' + e.message); }
});

app.get('/api/suppliers/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM suppliers WHERE group_id = $1 ORDER BY name ASC', [req.params.groupId]);
        res.json({ success: true, suppliers: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/suppliers', async (req, res) => {
    try {
        const { id, groupId, name, contactPerson, phone, email, category, minOrder, deliveryDays, cutoffTime, customerNumber } = req.body;
        let result;
        if (id) {
            result = await pool.query(
                'UPDATE suppliers SET name=$1, contact_person=$2, phone=$3, email=$4, category=$5, min_order=$6, delivery_days=$7, cutoff_time=$8, customer_number=$9 WHERE id=$10 AND group_id=$11 RETURNING *',
                [name, contactPerson||'', phone||'', email||'', category||'', minOrder||0, JSON.stringify(deliveryDays||[]), cutoffTime||'12:00:00', customerNumber||'', id, groupId]
            );
        } else {
            result = await pool.query(
                'INSERT INTO suppliers (group_id, name, contact_person, phone, email, category, min_order, delivery_days, cutoff_time, customer_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
                [groupId, name, contactPerson||'', phone||'', email||'', category||'', minOrder||0, JSON.stringify(deliveryDays||[]), cutoffTime||'12:00:00', customerNumber||'']
            );
        }
        res.json({ success: true, supplier: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/suppliers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/suppliers/:supplierId/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM supplier_products WHERE supplier_id = $1 ORDER BY name ASC', [req.params.supplierId]);
        res.json({ success: true, products: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/suppliers/products', async (req, res) => {
    try {
        const { id, groupId, supplierId, name, description, price, unitType, unitsPerPackage, properties } = req.body;
        let result;
        if (id) {
            result = await pool.query(
                'UPDATE supplier_products SET name=$1, description=$2, price=$3, unit_type=$4, units_per_package=$5, properties=$6 WHERE id=$7 RETURNING *',
                [name, description||'', price, unitType||"יח'", unitsPerPackage||1, JSON.stringify(properties||{}), id]
            );
        } else {
            result = await pool.query(
                'INSERT INTO supplier_products (group_id, supplier_id, name, description, price, unit_type, units_per_package, properties) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [groupId, supplierId, name, description||'', price, unitType||"יח'", unitsPerPackage||1, JSON.stringify(properties||{})]
            );
        }
        res.json({ success: true, product: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/suppliers/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM supplier_products WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/b2b/catalog/:groupId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT sp.*, s.name as supplier_name, s.min_order, s.delivery_days, s.cutoff_time
            FROM supplier_products sp
            JOIN suppliers s ON sp.supplier_id = s.id
            WHERE sp.group_id = $1 AND sp.is_active = TRUE
            ORDER BY s.name ASC, sp.name ASC
        `, [req.params.groupId]);
        res.json({ success: true, catalog: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/b2b/orders/:groupId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone, u.nickname as creator_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.group_id = $1
            ORDER BY po.created_at DESC
        `, [req.params.groupId]);
        res.json({ success: true, orders: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/b2b/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת סחורה: עדכון מלאי ויצירת הזמנת חוסרים אוטומטית לספק כטיוטה
app.post('/api/b2b/orders/receive', async (req, res) => {
    let dbClient;
    try {
        const { orderId, groupId, userId, receivedItems, missingItems } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        // עדכון סטטוס הזמנה לסופק
        await dbClient.query("UPDATE purchase_orders SET status = 'delivered' WHERE id = $1", [orderId]);

        // 1. הוספת מה שהתקבל למלאי (Pantry)
        for (let item of receivedItems) {
            const pRes = await dbClient.query(`SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2`, [groupId, item.name]);
            if (pRes.rows.length > 0) {
                await dbClient.query(`UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id=$2`, [parseFloat(item.qty) || 0, pRes.rows[0].id]);
            } else {
                await dbClient.query(`INSERT INTO pantry (group_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4)`, [groupId, item.name, parseFloat(item.qty) || 0, item.unit || "יח'"]);
            }
        }

        // 2. יצירת הזמנת רכש חדשה עבור החוסרים בסטטוס 'טיוטה' (draft)
        if (missingItems && missingItems.length > 0) {
            const origOrderRes = await dbClient.query('SELECT supplier_id FROM purchase_orders WHERE id = $1', [orderId]);
            if (origOrderRes.rows.length > 0) {
                const supplierId = origOrderRes.rows[0].supplier_id;
                let missingTotal = 0;
                
                const mappedMissingItems = missingItems.map(item => {
                    const price = parseFloat(item.price) || 0;
                    const qty = parseFloat(item.qty) || 0;
                    const rowTotal = price * qty;
                    missingTotal += rowTotal;
                    return { 
                        id: item.id, // שומר על המזהה המקורי כדי שנוכל להחזיר לעגלה!
                        sku: item.sku || '',
                        name: item.name, 
                        quantity: qty, 
                        unit: item.unit || "יח'", 
                        price_per_unit: price, 
                        row_total: rowTotal 
                    };
                });

                // הכנסה כטיוטה - draft
                await dbClient.query(`
                    INSERT INTO purchase_orders (group_id, created_by, supplier_id, items, total_amount, status, notes)
                    VALUES ($1, $2, $3, $4, $5, 'draft', $6)
                `, [groupId, userId, supplierId, JSON.stringify(mappedMissingItems), missingTotal, `הזמנת השלמת חוסרים שנוצרה אוטומטית (הזמנה #${orderId})`]);
            }
        }

        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch(e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        console.error("Receive Order Error:", e);
        res.status(500).json({ error: e.message }); 
    } finally {
        if(dbClient) dbClient.release();
    }
});

// תיקון קריטי לשגיאת הרשת: נתיב עדכון סטטוס B2B
app.post('/api/b2b/orders/status', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        await pool.query('UPDATE purchase_orders SET status=$1 WHERE id=$2', [status, orderId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// תיקון: נתיב למחיקת הזמנת טיוטה כשהמשתמש "מושך" אותה בחזרה לעגלה
app.delete('/api/b2b/orders/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM purchase_orders WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת סחורה: עדכון מלאי ויצירת הזמנת חוסרים אוטומטית לספק
app.post('/api/b2b/orders/receive', async (req, res) => {
    let dbClient;
    try {
        const { orderId, groupId, userId, receivedItems, missingItems } = req.body;
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        // עדכון סטטוס הזמנה לסופק
        await dbClient.query("UPDATE purchase_orders SET status = 'delivered' WHERE id = $1", [orderId]);

        // 1. הוספת מה שהתקבל למלאי (Pantry)
        for (let item of receivedItems) {
            const pRes = await dbClient.query(`SELECT id FROM pantry WHERE group_id=$1 AND item_name=$2`, [groupId, item.name]);
            if (pRes.rows.length > 0) {
                await dbClient.query(`UPDATE pantry SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id=$2`, [parseFloat(item.qty) || 0, pRes.rows[0].id]);
            } else {
                await dbClient.query(`INSERT INTO pantry (group_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4)`, [groupId, item.name, parseFloat(item.qty) || 0, item.unit || "יח'"]);
            }
        }

        // 2. יצירת הזמנת רכש חדשה עבור החוסרים מול אותו ספק!
        if (missingItems && missingItems.length > 0) {
            const origOrderRes = await dbClient.query('SELECT supplier_id FROM purchase_orders WHERE id = $1', [orderId]);
            if (origOrderRes.rows.length > 0) {
                const supplierId = origOrderRes.rows[0].supplier_id;
                let missingTotal = 0;
                
                const mappedMissingItems = missingItems.map(item => {
                    const price = parseFloat(item.price) || 0;
                    const qty = parseFloat(item.qty) || 0;
                    const rowTotal = price * qty;
                    missingTotal += rowTotal;
                    return { 
                        id: `missing_${Date.now()}`, 
                        name: item.name, 
                        quantity: qty, 
                        unit: item.unit || "יח'", 
                        price_per_unit: price, 
                        row_total: rowTotal 
                    };
                });

                await dbClient.query(`
                    INSERT INTO purchase_orders (group_id, created_by, supplier_id, items, total_amount, status, notes)
                    VALUES ($1, $2, $3, $4, $5, 'processing', $6)
                `, [groupId, userId, supplierId, JSON.stringify(mappedMissingItems), missingTotal, `הזמנת השלמת חוסרים אוטומטית שנוצרה בעקבות חוסר מהזמנה #${orderId}`]);
            }
        }

        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch(e) { 
        if(dbClient) await dbClient.query('ROLLBACK');
        console.error("Receive Order Error:", e);
        res.status(500).json({ error: e.message }); 
    } finally {
        if(dbClient) dbClient.release();
    }
});

app.get('/api/sa/communities', async (req, res) => {
    try {
        try { await pool.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS community_id INT`); } catch(err) {}

        const result = await pool.query(`
            SELECT c.*, 
                (SELECT COUNT(*) FROM family_groups WHERE community_id = c.id AND type='FAMILY') as family_count,
                (SELECT COUNT(u.id) FROM users u JOIN family_groups f ON u.group_id = f.id WHERE f.community_id = c.id AND f.type='FAMILY') as users_count,
                (SELECT COUNT(*) FROM community_businesses WHERE community_id = c.id AND status='approved') as business_count
            FROM communities c
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, communities: result.rows });
    } catch(e) { 
        console.error("Error in /api/sa/communities:", e);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/sa/communities', async (req, res) => {
    try {
        const { name, city, code, managerEmail, managerPassword, imageUrl } = req.body;
        
        let finalEmail = managerEmail || 'system@oneflowlife.com';
        let finalPass = managerPassword || '';

        if (!name || !code || !city) {
            return res.status(400).json({ success: false, error: 'שם, עיר וקוד קהילה הם שדות חובה' });
        }

        await pool.query(
            'INSERT INTO communities (name, city, code, manager_email, manager_password, image_url) VALUES ($1, $2, $3, $4, $5, $6)', 
            [name, city, code.toUpperCase().trim(), finalEmail, finalPass, imageUrl || null]
        );
        res.json({ success: true });
    } catch(e) { 
        console.error('Error creating community:', e);
        if (e.code === '23505') { 
            return res.status(400).json({ success: false, error: 'קוד הקהילה שבחרת כבר קיים במערכת. אנא בחר קוד אחר.' });
        }
        res.status(500).json({ error: e.message }); 
    }
});

app.put('/api/sa/communities/:id', async (req, res) => {
    try {
        const { name, city, code, managerEmail, managerPassword, imageUrl } = req.body;
        await pool.query('UPDATE communities SET name=$1, city=$2, code=$3, manager_email=$4, manager_password=$5, image_url=$6 WHERE id=$7', 
        [name, city, code.toUpperCase().trim(), managerEmail, managerPassword, imageUrl || null, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/communities/:id', async (req, res) => {
    try {
        await pool.query('UPDATE family_groups SET community_id = NULL WHERE community_id = $1', [req.params.id]);
        await pool.query('DELETE FROM community_businesses WHERE community_id = $1', [req.params.id]);
        await pool.query('DELETE FROM communities WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/communities/:id/details', async (req, res) => {
    try {
        const familiesRes = await pool.query('SELECT id, name, admin_email, group_code FROM family_groups WHERE community_id = $1 AND type = $2', [req.params.id, 'FAMILY']);
        const families = familiesRes.rows;

        if (families.length > 0) {
            const familyIds = families.map(f => f.id);
            const usersRes = await pool.query('SELECT id, group_id, nickname, role FROM users WHERE group_id = ANY($1)', [familyIds]);
            
            families.forEach(f => {
                f.users = usersRes.rows.filter(u => u.group_id === f.id);
            });
        }

        const businessesRes = await pool.query('SELECT b.id, b.name, cb.discount_pct, cb.status FROM community_businesses cb JOIN family_groups b ON cb.business_id = b.id WHERE cb.community_id = $1', [req.params.id]);
        
        res.json({ success: true, families: families, businesses: businessesRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/communities/pending-businesses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cb.community_id, cb.business_id, cb.discount_pct, c.name as comm_name, b.name as biz_name 
            FROM community_businesses cb
            JOIN communities c ON cb.community_id = c.id
            JOIN family_groups b ON cb.business_id = b.id
            WHERE cb.status = 'pending'
        `);
        res.json({ success: true, pending: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/community-business', async (req, res) => {
    try {
        const { communityId, businessId, discountPct } = req.body;
        await pool.query(
            'INSERT INTO community_businesses (community_id, business_id, discount_pct, status, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (community_id, business_id) DO UPDATE SET discount_pct=$3, status=$4', 
            [communityId, businessId, parseFloat(discountPct)||0, 'approved']
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/community-business/:commId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cb.community_id, cb.business_id, cb.discount_pct, cb.status, b.name as business_name 
            FROM community_businesses cb
            JOIN family_groups b ON cb.business_id = b.id
            WHERE cb.community_id = $1
        `, [req.params.commId]);
        res.json({ success: true, connections: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/community-business/:commId/:bizId', async (req, res) => {
    try {
        await pool.query('DELETE FROM community_businesses WHERE community_id=$1 AND business_id=$2', [req.params.commId, req.params.bizId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/community-business/approve', async (req, res) => {
    try {
        const { communityId, businessId } = req.body;
        await pool.query('UPDATE community_businesses SET status=$1, created_at=CURRENT_TIMESTAMP WHERE community_id=$2 AND business_id=$3', ['approved', communityId, businessId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/community-business/reject', async (req, res) => {
    try {
        const { communityId, businessId } = req.body;
        await pool.query('DELETE FROM community_businesses WHERE community_id=$1 AND business_id=$2', [communityId, businessId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/businesses', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, group_code FROM family_groups WHERE type='BUSINESS' ORDER BY name");
        res.json({ success: true, businesses: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// =========================================================
// פונקציית מערכת המיילים לספקים (B2B Orders) - מאובטחת ועמידה!
// =========================================================
app.post('/api/b2b/orders', async (req, res) => {
    let dbClient;
    try {
        const { groupId, userId, orders } = req.body;
        
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        
        let transporter = null;
        if (user && pass) {
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: { user: user, pass: pass }
            });
        }
        
        for (let order of orders) {
            // 1. שמירה במסד הנתונים
            const result = await dbClient.query(`
                INSERT INTO purchase_orders (group_id, created_by, supplier_id, items, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, 'sent') RETURNING id
            `, [groupId, userId, order.supplierId, JSON.stringify(order.items), order.totalAmount]);
            
            const newOrderId = result.rows[0].id;
            const supplierRes = await dbClient.query('SELECT name, email FROM suppliers WHERE id = $1', [order.supplierId]);
            const supplier = supplierRes.rows[0];

            // 2. שילוח מייל (גם אם ה-PDF חסר!)
            if (supplier && supplier.email && transporter) {
                
                // מייצרים רשימת פריטים שתוצג בתוך גוף המייל
                const itemsHtmlList = order.items.map(i => `<li>${i.name} - כמות: ${i.quantity}</li>`).join('');

                const mailOptions = {
                    from: `"מערכת רכש Oneflow" <${user}>`, 
                    to: supplier.email,
                    subject: `הזמנת רכש חדשה מ-Oneflow (הזמנה #${newOrderId})`,
                    html: `
                        <div dir="rtl" style="font-family: Arial, sans-serif; color: #333;">
                            <h2>שלום רב לצוות ${supplier.name},</h2>
                            <p>מצ"ב הזמנת רכש חדשה שהופקה עבורכם דרך מערכת Oneflow.</p>
                            
                            <div style="background: #f8fafc; padding: 15px; border-radius: 10px; margin: 15px 0; border: 1px solid #e2e8f0;">
                                <h3 style="margin-top:0;">תקציר ההזמנה:</h3>
                                <ul>${itemsHtmlList}</ul>
                            </div>
                            
                            <p>אנא עברו על ההזמנה ואשרו לנו את קבלתה ומועד האספקה המשוער.</p>
                            <br>
                            <p>בברכה,</p>
                            <p><b>לקוח Oneflow BIZ</b></p>
                        </div>
                    `,
                    attachments: []
                };

                // מוסיפים את קובץ ה-PDF רק אם הוא עבר בהצלחה
                if (order.pdfBase64) {
                    mailOptions.attachments.push({ 
                        filename: `Purchase_Order_${newOrderId}.pdf`, 
                        content: order.pdfBase64.replace(/^data:application\/pdf;base64,/, ""), 
                        encoding: 'base64' 
                    });
                }

                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`✅ Email sent successfully to ${supplier.email}`);
                } catch (mailErr) {
                    console.error(`❌ Failed to send email to ${supplier.email}:`, mailErr);
                }
            }
        }
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch(e) { 
        if (dbClient) await dbClient.query('ROLLBACK');
        console.error("Order Submit Error:", e);
        res.status(500).json({ error: e.message }); 
    } finally {
        if (dbClient) dbClient.release();
    }
});
// --- AI CATALOG / PANTRY GENERATOR (WIZARD) ---
app.post('/api/ai/generate-catalog', async (req, res) => {
    try {
        const { promptText, type, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
        let sysPrompt = "";
        
        if (type === 'BUSINESS') {
            sysPrompt = `You are a business consultant. The user has a business described as "${promptText}". Generate a realistic starter catalog/menu with 6-10 common products or services for this business type in Hebrew. 
            Return strictly a JSON array of objects: [{"name": "product name", "category": "category name", "price": 15.5, "description": "short description"}]. Make prices realistic in ILS.`;
        } else {
            sysPrompt = `You are a home management expert. The user wants to populate their pantry/shopping list. Family type: "${promptText}". Generate a realistic starter pantry list with 8-12 common grocery/household items in Hebrew.
            Return strictly a JSON array of objects: [{"name": "item name", "category": "category name", "price": 0, "description": ""}].`;
        }

        const result = await model.generateContent(sysPrompt);
        let rawText = result.response.text().trim();
        const jsonStart = rawText.indexOf('[');
        const jsonEnd = rawText.lastIndexOf(']');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('תגובת ה-AI לא הכילה רשימת פריטים תקינה');
        const items = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
        res.json({ success: true, items: items });
    } catch (e) { handleAIError(e, res, 'שגיאה ביצירת הקטלוג האוטומטי'); }
});
// START SERVER
// =========================================================
// --- MULTI-COMMUNITY SUPPORT (FAMILIES UP TO 5) ---
// =========================================================

// 1. יצירת טבלת החיבורים מרובי הקהילות
pool.query(`
    CREATE TABLE IF NOT EXISTS family_communities (
        group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, 
        community_id INT REFERENCES communities(id) ON DELETE CASCADE, 
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        PRIMARY KEY (group_id, community_id)
    )
`).catch(e => console.log(e));

// 2. נתיב חכם למשיכת נתוני כל הקהילות שהמשפחה מחוברת אליהן והעסקים שלהן
app.get('/api/community/info/:groupId', async (req, res) => {
    try {
        const commsRes = await pool.query(`
            SELECT c.id, c.name, c.city, c.image_url, c.code
            FROM family_communities fc
            JOIN communities c ON fc.community_id = c.id
            WHERE fc.group_id = $1 AND c.status = 'active'
        `, [req.params.groupId]);
        
        if(commsRes.rows.length === 0) return res.json({ success: true, communities: [], businesses: [] });
        
        const commIds = commsRes.rows.map(c => c.id);
        const bizRes = await pool.query(`
            SELECT cb.community_id, cb.discount_pct, b.name as business_name, b.group_code, c.name as comm_name
            FROM community_businesses cb
            JOIN family_groups b ON cb.business_id = b.id
            JOIN communities c ON cb.community_id = c.id
            WHERE cb.community_id = ANY($1) AND cb.status = 'approved'
        `, [commIds]);
        
        res.json({ success: true, communities: commsRes.rows, businesses: bizRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// 3. הצטרפות לקהילה (בדיקת מגבלת 5 קהילות)
app.post('/api/community/join', async (req, res) => {
    try {
        const { groupId, code } = req.body;
        const commRes = await pool.query("SELECT id, name FROM communities WHERE code = $1 AND status = 'active'", [code.toUpperCase().trim()]);
        if(commRes.rows.length === 0) return res.status(404).json({error: 'קוד קהילה שגוי או שהקהילה טרם הופעלה על ידי היזם.'});
        
        const commId = commRes.rows[0].id;
        
        // בדיקת המגבלה
        const countRes = await pool.query('SELECT COUNT(*) FROM family_communities WHERE group_id = $1', [groupId]);
        if (parseInt(countRes.rows[0].count) >= 5) return res.status(400).json({error: 'ניתן להצטרף לעד 5 קהילות במקביל.'});
        
        await pool.query('INSERT INTO family_communities (group_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, commId]);
        res.json({success: true, community: commRes.rows[0]});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 4. ניתוק מקהילה ספציפית
app.delete('/api/community/leave/:groupId/:communityId', async (req, res) => {
    try {
        await pool.query('DELETE FROM family_communities WHERE group_id = $1 AND community_id = $2', [req.params.groupId, req.params.communityId]);
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 5. דריסת השאילתות של הסופר-אדמין לספירת משפחות מתוך הטבלה החדשה
app.get('/api/sa/communities', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, 
                (SELECT COUNT(*) FROM family_communities WHERE community_id = c.id) as family_count,
                (SELECT COUNT(u.id) FROM users u JOIN family_communities fc ON u.group_id = fc.group_id WHERE fc.community_id = c.id) as users_count,
                (SELECT COUNT(*) FROM community_businesses WHERE community_id = c.id AND status='approved') as business_count
            FROM communities c
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, communities: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sa/communities/:id/details', async (req, res) => {
    try {
        const familiesRes = await pool.query(`
            SELECT f.id, f.name, f.admin_email, f.group_code 
            FROM family_communities fc
            JOIN family_groups f ON fc.group_id = f.id
            WHERE fc.community_id = $1 AND f.type = 'FAMILY'
        `, [req.params.id]);
        const families = familiesRes.rows;

        if (families.length > 0) {
            const familyIds = families.map(f => f.id);
            const usersRes = await pool.query('SELECT id, group_id, nickname, role FROM users WHERE group_id = ANY($1)', [familyIds]);
            families.forEach(f => { f.users = usersRes.rows.filter(u => u.group_id === f.id); });
        }

        const businessesRes = await pool.query('SELECT b.id, b.name, cb.discount_pct, cb.status FROM community_businesses cb JOIN family_groups b ON cb.business_id = b.id WHERE cb.community_id = $1', [req.params.id]);
        
        res.json({ success: true, families: families, businesses: businessesRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// ============================================================
// --- FOOD COST & RECIPE ENDPOINTS ---
// ============================================================

app.get('/api/food-cost/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        // 1. נשלוף את כל המוצרים בקטלוג
        const catalogRes = await pool.query('SELECT id, name, price, category, overhead_details FROM store_catalog WHERE group_id = $1 AND is_available = TRUE ORDER BY category, name', [groupId]);
        
        // 2. נשלוף את כל המרכיבים ששויכו למוצרים אלו
        const ingredientsRes = await pool.query('SELECT pi.* FROM product_ingredients pi JOIN store_catalog sc ON pi.catalog_id = sc.id WHERE sc.group_id = $1', [groupId]);
        
        // 3. נשלוף מחירי רכש עדכניים כדי לחשב עלות בזמן אמת (נמשוך מהיסטוריית הקניות של העסק את המחיר האחרון לכל פריט)
        const pricesRes = await pool.query(`
            SELECT DISTINCT ON (item_name) item_name, price_per_unit, unit 
            FROM shopping_trip_items sti 
            JOIN shopping_trips st ON sti.trip_id = st.id 
            WHERE st.group_id = $1 
            ORDER BY item_name, st.trip_date DESC
        `, [groupId]);
        
        const priceMap = {};
        pricesRes.rows.forEach(p => {
            priceMap[p.item_name] = { price: parseFloat(p.price_per_unit), unit: p.unit };
        });

        // חיבור הנתונים
        const catalog = catalogRes.rows.map(item => {
            const itemIngredients = ingredientsRes.rows.filter(i => i.catalog_id === item.id);
            let totalIngredientsCost = 0;
            
            const enrichedIngredients = itemIngredients.map(ing => {
                const knownPrice = priceMap[ing.ingredient_name];
                let cost = 0;
                // חישוב פשוט (בהנחה שהיחידות זהות. בשדרוג עתידי ניתן לבצע המרת יחידות)
                if (knownPrice) cost = knownPrice.price * parseFloat(ing.quantity);
                totalIngredientsCost += cost;
                return { ...ing, calculated_cost: cost, known_price: knownPrice ? knownPrice.price : 0 };
            });

            let overheadTotal = 0;
            let overheads = [];
            try {
                overheads = typeof item.overhead_details === 'string' ? JSON.parse(item.overhead_details) : (item.overhead_details || []);
                overheads.forEach(o => overheadTotal += parseFloat(o.cost) || 0);
            } catch(e) {}

            const finalCost = totalIngredientsCost + overheadTotal;
            const salePrice = parseFloat(item.price) || 0;
            const foodCostPct = salePrice > 0 ? (finalCost / salePrice) * 100 : 0;
            const profit = salePrice - finalCost;

            return {
                ...item,
                ingredients: enrichedIngredients,
                overheads: overheads,
                costs: {
                    ingredients: totalIngredientsCost,
                    overhead: overheadTotal,
                    total: finalCost,
                    foodCostPct: foodCostPct,
                    profit: profit
                }
            };
        });

        res.json({ success: true, catalog, priceMap });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/food-cost/recipe/:catalogId', async (req, res) => {
    let dbClient;
    try {
        const { catalogId } = req.params;
        const { ingredients, overheads } = req.body;
        
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        
        // עדכון הוצאות עקיפות בקטלוג
        await dbClient.query('UPDATE store_catalog SET overhead_details = $1 WHERE id = $2', [JSON.stringify(overheads || []), catalogId]);
        
        // מחיקת עץ מוצר ישן והכנסת החדש
        await dbClient.query('DELETE FROM product_ingredients WHERE catalog_id = $1', [catalogId]);
        
        for (let ing of ingredients) {
            await dbClient.query(
                'INSERT INTO product_ingredients (catalog_id, ingredient_name, quantity, unit) VALUES ($1, $2, $3, $4)',
                [catalogId, ing.name, parseFloat(ing.quantity) || 0, ing.unit || "יח'"]
            );
        }
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        if(dbClient) await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        if(dbClient) dbClient.release();
    }
});

// ============================================================
// --- CALENDAR & BOOKING ENDPOINTS ---
// ============================================================

// שליפת הגדרות היומן, השירותים והאירועים
app.get('/api/calendar/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const setRes = await pool.query('SELECT * FROM calendar_settings WHERE group_id=$1', [groupId]);
        const srvRes = await pool.query('SELECT * FROM calendar_services WHERE group_id=$1 ORDER BY created_at DESC', [groupId]);
        const evtRes = await pool.query('SELECT * FROM calendar_events WHERE group_id=$1 ORDER BY event_date ASC, start_time ASC', [groupId]);
        
        let settings = setRes.rows.length > 0 ? setRes.rows[0] : { is_active: false, open_time: '09:00', close_time: '18:00', interval_mins: 30 };
        res.json({ success: true, settings, services: srvRes.rows, events: evtRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירת הגדרות יומן
app.post('/api/calendar/settings', async (req, res) => {
    try {
        const { groupId, isActive, openTime, closeTime, intervalMins } = req.body;
        await pool.query(`
            INSERT INTO calendar_settings (group_id, is_active, open_time, close_time, interval_mins) 
            VALUES ($1, $2, $3, $4, $5) 
            ON CONFLICT (group_id) DO UPDATE SET is_active=$2, open_time=$3, close_time=$4, interval_mins=$5, updated_at=CURRENT_TIMESTAMP
        `, [groupId, isActive, openTime || '09:00', closeTime || '18:00', parseInt(intervalMins) || 30]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הוספת סוג שירות ליומן
app.post('/api/calendar/services', async (req, res) => {
    try {
        const { groupId, name, durationMins, price } = req.body;
        await pool.query('INSERT INTO calendar_services (group_id, name, duration_mins, price) VALUES ($1, $2, $3, $4)', [groupId, name, parseInt(durationMins) || 30, parseFloat(price) || 0]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendar/services/:id', async (req, res) => {
    try { await pool.query('DELETE FROM calendar_services WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

// הוספת אירוע/תור
app.post('/api/calendar/events', async (req, res) => {
    try {
        const { groupId, serviceId, title, customerPhone, notes, eventDate, startTime, status } = req.body;
        await pool.query(
            `INSERT INTO calendar_events (group_id, service_id, title, customer_phone, notes, event_date, start_time, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
            [groupId, serviceId || null, title, customerPhone || '', notes || '', eventDate, startTime, status || 'pending']
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// עדכון סטטוס לאירוע (אישור/ביטול)
app.put('/api/calendar/events/:id/status', async (req, res) => {
    try {
        await pool.query('UPDATE calendar_events SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendar/events/:id', async (req, res) => {
    try { await pool.query('DELETE FROM calendar_events WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- INBOX & MESSAGING ENDPOINTS ---
// ============================================================

// הבאת הודעות של עסק מסוים
app.get('/api/inbox/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inbox_messages WHERE group_id = $1 ORDER BY created_at DESC', [req.params.groupId]);
        res.json({ success: true, messages: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// סימון כנקרא/לא נקרא
app.put('/api/inbox/:id/read', async (req, res) => {
    try {
        const { isRead } = req.body;
        await pool.query('UPDATE inbox_messages SET is_read = $1 WHERE id = $2', [isRead, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מחיקת הודעה
app.delete('/api/inbox/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM inbox_messages WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שליחת הודעה מהחנות (לקוח -> עסק)
app.post('/api/inbox/customer', async (req, res) => {
    try {
        const { groupId, name, contact, subject, content } = req.body;
        if (!groupId || !content) return res.status(400).json({ error: 'חסרים נתונים' });
        
        await pool.query(
            'INSERT INTO inbox_messages (group_id, sender_type, sender_name, sender_contact, subject, content) VALUES ($1, $2, $3, $4, $5, $6)',
            [groupId, 'customer', name || 'לקוח אנונימי', contact || '', subject || 'פנייה מהחנות הציבורית', content]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שליחת הודעת תפוצה מהסופר-אדמין לכלל המערכת (עסקים + משפחות)

// שליחת הודעת תפוצה מהסופר-אדמין לכלל המערכת (עסקים + משפחות)
app.post('/api/sa/inbox/broadcast', verifySA, async (req, res) => {
    try {
        const { targetType, targetValue, subject, content } = req.body;
        if (!subject || !content) return res.status(400).json({ error: 'חובה למלא נושא ותוכן' });

        let groupIds = [];
        let queryStr = "";
        
        if (targetType === 'all') {
            queryStr = "SELECT id FROM family_groups WHERE type='BUSINESS'";
        } else if (targetType === 'pro') {
            queryStr = "SELECT id FROM family_groups WHERE type='BUSINESS' AND is_premium=TRUE";
        } else if (targetType === 'free') {
            queryStr = "SELECT id FROM family_groups WHERE type='BUSINESS' AND is_premium=FALSE";
        } else if (targetType === 'all_families') {
            queryStr = "SELECT id FROM family_groups WHERE type='FAMILY'";
        } else if (targetType === 'pro_families') {
            queryStr = "SELECT id FROM family_groups WHERE type='FAMILY' AND is_premium=TRUE";
        } else if (targetType === 'free_families') {
            queryStr = "SELECT id FROM family_groups WHERE type='FAMILY' AND is_premium=FALSE";
        } else if (targetType === 'specific') {
            groupIds = [parseInt(targetValue)];
        }

        if (queryStr) {
            const gRes = await pool.query(queryStr);
            groupIds = gRes.rows.map(g => g.id);
        }

        if (groupIds.length === 0) return res.status(404).json({ error: 'לא נמצאו נמענים מתאימים לסינון' });

        // פתיחת טרנזקציה להכנסת כל ההודעות
        await pool.query('BEGIN');
        for (let gid of groupIds) {
            await pool.query(
                'INSERT INTO inbox_messages (group_id, sender_type, sender_name, sender_contact, subject, content) VALUES ($1, $2, $3, $4, $5, $6)',
                [gid, 'superadmin', 'מערכת', 'admin@oneflowlife.com', subject, content]
            );
        }
        await pool.query('COMMIT');
        
        res.json({ success: true, count: groupIds.length });
    } catch(e) { 
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message }); 
    }
});

// ============================================================
// --- TEAM CHAT ENDPOINTS ---
// ============================================================

// שליפת היסטוריית הצ'אט של הקבוצה + ניקוי אוטומטי מעל 3 חודשים
app.get('/api/chat/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        // ביצוע ניקוי הודעות ישנות משלושה חודשים בכל פתיחת צ'אט
        await pool.query(`DELETE FROM team_chat WHERE group_id = $1 AND created_at < NOW() - INTERVAL '3 months'`, [groupId]);

        const result = await pool.query(`
            SELECT c.*, u.nickname as user_name 
            FROM team_chat c
            JOIN users u ON c.user_id = u.id
            WHERE c.group_id = $1 
            ORDER BY c.created_at ASC
            LIMIT 500
        `, [groupId]);
        
        res.json({ success: true, messages: result.rows });
    } catch(e) { 
        console.error('Chat fetch error:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// שליחת הודעת צ'אט חדשה
app.post('/api/chat', async (req, res) => {
    try {
        const { groupId, userId, message } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ error: 'הודעה ריקה' });
        
        await pool.query(
            'INSERT INTO team_chat (group_id, user_id, message) VALUES ($1, $2, $3)',
            [groupId, userId, message]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- ראוט דינמי לכתובות חנות מקוצרות (Alias) ---
app.get('/:alias', (req, res, next) => {
    const alias = req.params.alias;
    
    // התעלם מנתיבים של ה-API, בקשות המכילות נקודה (כמו תמונות, קבצי JS/CSS) או סקריפטים של המערכת
    if (alias.startsWith('api') || alias.includes('.') || alias === 'setup-db') {
        return next();
    }

    // הלקוח גלש לכתובת מקוצרת - נגיש לו את ה-HTML של החנות (הכתובת למעלה תישאר נקייה)
    res.sendFile(path.join(__dirname, 'public', 'storefront.html'));
});
// יצירת קריאת שירות חדשה ממשפחה (מחובר לטבלת הליבה support_tickets של הסופר אדמין)
app.post('/api/tickets', async (req, res) => {
    try {
        const groupId = req.body.groupId || req.body.group_id;
        const userId = req.body.userId || req.body.user_id;
        const { subject, content } = req.body;
        
        if (!groupId || !subject || !content) {
            return res.status(400).json({ error: 'חסרים נתונים ליצירת קריאה' });
        }

        // חילוץ שם הלקוח לטובת הלוג של הסופר אדמין
        const uRes = await pool.query('SELECT nickname FROM users WHERE id = $1', [userId]);
        const userName = uRes.rows.length > 0 ? uRes.rows[0].nickname : 'לקוח';
        
        // יצירת הלוג הראשוני שנדרש למערכת המרכזית
        const initialLog = [{ date: new Date().toISOString(), sender: userName, isStaff: false, message: content }];
        
        await pool.query(
            'INSERT INTO support_tickets (group_id, user_id, subject, description, status, log) VALUES ($1, $2, $3, $4, $5, $6)',
            [groupId, userId, subject, content, 'open', JSON.stringify(initialLog)]
        );
        
        res.json({ success: true });
    } catch(e) { 
        console.error('Error creating ticket:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// שליפת רשימת הקריאות עבור המשפחה (משיכה מטבלת הליבה והתאמה לתצוגת הלקוח)
app.get('/api/tickets/:groupId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM support_tickets WHERE group_id = $1 ORDER BY created_at DESC', 
            [req.params.groupId]
        );
        
        // התאמת השדות כדי שהלקוח (app.js) יוכל להציג אותם כפי שהוא מכיר
        const mappedTickets = result.rows.map(t => {
            let admin_reply = '';
            if (t.log) {
                try {
                    const logs = typeof t.log === 'string' ? JSON.parse(t.log) : t.log;
                    // מחפשים את התגובה האחרונה שנכתבה על ידי איש צוות מתוך הלוגים
                    const lastStaffReply = logs.slice().reverse().find(l => l.isStaff === true);
                    if (lastStaffReply) admin_reply = lastStaffReply.message;
                } catch(err) {}
            }
            return {
                id: t.id,
                subject: t.subject,
                content: t.description,
                status: t.status,
                admin_reply: admin_reply,
                created_at: t.created_at
            };
        });
        
        res.json({ success: true, tickets: mappedTickets });
    } catch(e) { 
        console.error('Error fetching tickets:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// ראוט צ'אט עוזרת אישית למשפחות (FamilAI) - סוכנת חכמה ופעילה
app.post('/api/family/chat-assistant', async (req, res) => {
    try {
        const { query, context, groupId, userId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        // אילוץ תשובה מובנית בפורמט JSON בלבד כדי שהשרת יוכל לקרוא פקודות
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig: { responseMimeType: "application/json" } 
        });
        
        const prompt = `You are 'FamilAI', the highly intelligent, proactive AI assistant for a family using the 'Oneflow Life' app. 
        You can deeply analyze data to provide forecasts (e.g., when to buy groceries based on habits, budget predictions) AND you can EXECUTE actions on behalf of the user.
        
        Family Data Context (Current State):
        ${context}
        
        User's Request: "${query}"
        
        Instructions:
        1. Respond in Hebrew. Be friendly, warm, and highly efficient. Use emojis.
        2. If the user asks for a forecast, analysis, or prediction, calculate it smartly using the 'recent_transactions', 'pantry', and 'tasks' data.
        3. Output STRICTLY as a valid JSON object matching this schema:
        {
           "answer": "Your full text response to the user in Hebrew. Use Markdown bolding (**text**) for emphasis.",
           "action_type": "NONE", // Change to "CREATE_TASK" or "ADD_GROCERY" ONLY if the user explicitly asks you to perform an action!
           "action_data": {} // If CREATE_TASK: {"title": "Task name", "reward": 10, "assignee_name": "Name of child/member or null"}. If ADD_GROCERY: {"item": "Item name", "qty": 1}
        }
        `;
        
        const result = await model.generateContent(prompt);
        const aiResponse = JSON.parse(result.response.text());
        
        let finalAnswer = aiResponse.answer;

        // --- מנוע ביצוע הפעולות (Execution Engine) ---
        if (aiResponse.action_type === 'CREATE_TASK' && aiResponse.action_data) {
            let assignedToId = null;
            // חיפוש חכם של הילד במסד הנתונים אם ה-AI זיהה שם
            if (aiResponse.action_data.assignee_name) {
                const uRes = await pool.query('SELECT id FROM users WHERE group_id = $1 AND nickname ILIKE $2', [groupId, `%${aiResponse.action_data.assignee_name}%`]);
                if (uRes.rows.length > 0) assignedToId = uRes.rows[0].id;
            }
            const reward = parseFloat(aiResponse.action_data.reward) || 0;
            const title = aiResponse.action_data.title || 'משימה חדשה';
            
            await pool.query('INSERT INTO tasks (group_id, created_by, assigned_to, title, reward, status) VALUES ($1, $2, $3, $4, $5, $6)', [groupId, userId, assignedToId, title, reward, 'pending']);
            finalAnswer += `\n\n✅ **פקודה בוצעה:** פתחתי את המשימה "${title}" במערכת.`;
        } 
        else if (aiResponse.action_type === 'ADD_GROCERY' && aiResponse.action_data) {
            const item = aiResponse.action_data.item || 'מוצר';
            const qty = parseFloat(aiResponse.action_data.qty) || 1;
            
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, status) VALUES ($1, $2, $3, $4, 'pending')`, [groupId, userId, item, qty]);
            finalAnswer += `\n\n🛒 **פקודה בוצעה:** הוספתי "${item}" (כמות: ${qty}) לרשימת הקניות.`;
        }
        
        res.json({ success: true, answer: finalAnswer });
    } catch(e) { handleAIError(e, res, 'שגיאה במערכת העוזרת FamilAI'); }
});

// ראוט לעדכון תמונת/לוגו משפחה או עסק
app.post('/api/groups/:id/logo', async (req, res) => {
    try {
        const { logo } = req.body;
        if (!logo) return res.status(400).json({ error: 'No logo provided' });
        
        try { await pool.query('ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS image_url TEXT'); } catch(err) {}
        
        const result = await pool.query(
            'UPDATE family_groups SET image_url = $1 WHERE id = $2 RETURNING image_url', 
            [logo, req.params.id]
        );
        
        res.json({ success: true, image_url: result.rows[0].image_url });
    } catch(e) {
        console.error('Logo update error:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- KANBAN TASKS (ALM UPGRADED) ---
app.get('/api/sa/dev/tasks', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_dev_tasks ORDER BY priority DESC, created_at DESC');
        res.json({ success: true, tasks: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/dev/tasks', verifySA, async (req, res) => {
    try {
        const { title, type, priority, status, description, environment, moduleName, originalTicketId, targetVersion, versionId, assignedDeveloper } = req.body;
        const result = await pool.query(
            `INSERT INTO sa_dev_tasks (title, type, priority, status, description, environment, module_name, original_ticket_id, target_version, version_id, assigned_developer) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [title, type || 'feature', priority || 'normal', status || 'backlog', description || '', environment || '', moduleName || '', originalTicketId || null, targetVersion || '', versionId || null, assignedDeveloper || '']
        );
        res.json({ success: true, task: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/dev/tasks/:id', verifySA, async (req, res) => {
    try {
        const { title, type, priority, status, description, targetVersion, versionId, environment, moduleName, assignedDeveloper } = req.body;
        await pool.query(
            `UPDATE sa_dev_tasks SET title=$1, type=$2, priority=$3, status=$4, description=$5, target_version=$6, version_id=$7, environment=$8, module_name=$9, assigned_developer=$10, updated_at=CURRENT_TIMESTAMP WHERE id=$11`,
            [title, type, priority, status, description, targetVersion, versionId || null, environment || '', moduleName || '', assignedDeveloper || '', req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/dev/tasks/:id/status', verifySA, async (req, res) => {
    try {
        const { status, systemOverride } = req.body;
        
        // חסימת העברה ידנית ל-DONE - המשימה חייבת לעבור תהליך QA מסודר
        if (status === 'done' && !systemOverride) {
            return res.status(403).json({ error: 'חסימת מערכת: לא ניתן להעביר משימה לסטטוס "בוצע" ידנית. המשימה תיסגר אוטומטית ברגע שכל תתי-המשימות יסתיימו וריצת ה-QA בספר המוצר תעבור בהצלחה.' });
        }
        
        await pool.query('UPDATE sa_dev_tasks SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/dev/tasks/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_dev_tasks WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- DEV SUB-TASKS (ALM) ---
app.get('/api/sa/dev/subtasks', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_dev_sub_tasks ORDER BY id ASC');
        res.json({ success: true, subtasks: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/dev/subtasks', verifySA, async (req, res) => {
    try {
        const { taskId, title } = req.body;
        const result = await pool.query(`INSERT INTO sa_dev_sub_tasks (task_id, title) VALUES ($1, $2) RETURNING *`, [taskId, title]);
        res.json({ success: true, subtask: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/dev/subtasks/:id/toggle', verifySA, async (req, res) => {
    try {
        const { isDone } = req.body;
        const result = await pool.query(`UPDATE sa_dev_sub_tasks SET is_done=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`, [isDone, req.params.id]);
        res.json({ success: true, subtask: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/dev/subtasks/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_dev_sub_tasks WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- VERSIONS MANAGEMENT EXTENSION ---
app.put('/api/sa/versions/:id', verifySA, async (req, res) => {
    try {
        const { name, targetDate, status } = req.body;
        await pool.query('UPDATE sa_versions SET name=$1, target_date=$2, status=$3 WHERE id=$4', [name, targetDate || null, status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/versions/:id', verifySA, async (req, res) => {
    try {
        await pool.query('UPDATE sa_qa_runs SET version_id = NULL WHERE version_id = $1', [req.params.id]);
        await pool.query('UPDATE sa_dev_tasks SET version_id = NULL WHERE version_id = $1', [req.params.id]);
        await pool.query('DELETE FROM sa_versions WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- PRODUCT MATRIX (QA) ---
app.get('/api/sa/matrix', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_product_matrix ORDER BY environment, module_name, id');
        res.json({ success: true, matrix: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/matrix', verifySA, async (req, res) => {
    try {
        const { environment, moduleName, scenarioName, expectedResult } = req.body;
        const result = await pool.query(
            `INSERT INTO sa_product_matrix (environment, module_name, scenario_name, expected_result) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [environment, moduleName, scenarioName, expectedResult]
        );
        res.json({ success: true, item: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/matrix/:id/status', verifySA, async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE sa_product_matrix SET status=$1, last_tested_at=CURRENT_TIMESTAMP WHERE id=$2', [status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/matrix/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_product_matrix WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// --- QA, PRODUCT BOOK & VERSIONS (SPRINT 4) ---
// ==========================================

// משיכת כל הגרסאות הקיימות
app.get('/api/sa/versions', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_versions ORDER BY id DESC');
        res.json({ success: true, versions: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// פתיחת גרסה חדשה
app.post('/api/sa/versions', verifySA, async (req, res) => {
    try {
        const { name, targetDate } = req.body;
        await pool.query('INSERT INTO sa_versions (name, target_date) VALUES ($1, $2)', [name, targetDate || null]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// משיכת ספר המוצר (כל הבדיקות מהמסד)
app.get('/api/sa/qa/tests', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sa_product_book ORDER BY category ASC, id ASC');
        res.json({ success: true, tests: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הוספה/עדכון ידני של בדיקה (גיבוי להזנה ידנית / אישור לאחר AI)
app.post('/api/sa/qa/tests', verifySA, async (req, res) => {
    try {
        const { id, category, name, description, priority } = req.body;
        // מנגנון Upsert: מעדכן אם קיים, מוסיף אם חדש
        await pool.query(`
            INSERT INTO sa_product_book (id, category, name, description, priority) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE 
            SET category = EXCLUDED.category, name = EXCLUDED.name, description = EXCLUDED.description, priority = EXCLUDED.priority
        `, [id, category, name, description, priority || 'medium']);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ייבוא מסיבי (Seed) - משוריין לכל גרסאות ה-DB
app.post('/api/sa/qa/tests/bulk', verifySA, async (req, res) => {
    try {
        // נוודא שהטבלה אכן קיימת לפני שמתחילים להזריק נתונים
        await pool.query(`CREATE TABLE IF NOT EXISTS sa_product_book (id VARCHAR(50) PRIMARY KEY, category VARCHAR(100), name VARCHAR(200), description TEXT, priority VARCHAR(20) DEFAULT 'medium', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

        const { tests } = req.body; 
        if (!tests || !tests.length) return res.json({ success: false, error: 'לא נשלחו נתונים' });
        
        let inserted = 0;
        for (let t of tests) {
            try {
                await pool.query(`
                    INSERT INTO sa_product_book (id, category, name, description, priority) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [t.id, t.cat || t.category, t.name, t.desc || t.description, t.prio || t.priority || 'medium']);
                inserted++;
            } catch(err) {
                // התעלמות משגיאת כפילות (Unique Violation 23505) - עובד בכל גרסאות Postgres
                if (err.code !== '23505') throw err;
            }
        }
        res.json({ success: true, inserted });
    } catch(e) { 
        console.error('Bulk Insert Error:', e);
        // מחזיר JSON תקין תמיד, גם במקרה של קריסת שרת פנימית
        res.status(500).json({ success: false, error: 'שגיאת שרת פנימית: ' + e.message }); 
    }
});

// שמירת פלט ריצת ה-QA וסגירת מעגל
app.post('/api/sa/qa/runs', verifySA, async (req, res) => {
    try {
        const { versionId, testerName, results } = req.body;
        await pool.query(
            'INSERT INTO sa_qa_runs (version_id, tester_name, results) VALUES ($1, $2, $3)',
            [versionId || null, testerName, JSON.stringify(results)]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מחולל בדיקות QA אוטומטי מבוסס AI (מחזיר טיוטה לממשק ללא שמירה)
app.post('/api/sa/ai/generate-qa', verifySA, async (req, res) => {
    try {
        const { taskTitle, taskDesc, module } = req.body;
        if (!genAI) return res.json({ success: false, error: 'לא הוגדר מפתח API של Gemini בשרת' });

        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a Senior QA Engineer for a SaaS platform called Oneflow Life.
            Based on the following software development task, generate a single, comprehensive QA test case in Hebrew.
            Return ONLY a valid JSON object with the following structure (no markdown formatting, no extra text, just raw JSON):
            {
                "id": "Generate a unique 6-character ID starting with AUTO-, e.g., AUTO-102",
                "category": "The most relevant module/category in Hebrew (e.g., 'קופה', 'לקוחות', 'משפחה', 'אקדמיה', 'כללי')",
                "name": "Test name in Hebrew",
                "description": "Step-by-step description of what to test, and the expected result in Hebrew",
                "priority": "high", "medium", or "low"
            }

            Task Title: ${taskTitle}
            Task Description: ${taskDesc || 'No description provided'}
            Suggested Module: ${module || 'General'}
        `;

        const result = await aiModel.generateContent(prompt);
        let responseText = result.response.text().trim();
        
        if (responseText.startsWith('```json')) responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (responseText.startsWith('```')) responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();
        
        const qaData = JSON.parse(responseText);

        // אנחנו כבר לא שומרים למסד כאן! מחזירים את זה לממשק כדי שהמשתמש יאשר ויערוך ידנית.
        res.json({ success: true, test: qaData });
    } catch(e) {
        console.error('QA Generation Error:', e);
        res.json({ success: false, error: e.message });
    }
});

// ראוט למשיכת הגדרות ציבוריות למסך התחברות
app.get('/api/system/public-config', async (req, res) => {
    try {
        const mockConfig = {
            success: true,
            globalAiLogo: '/logo.png', 
            loginSlides: [
                { image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1000&auto=format&fit=crop' }, 
                { image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1000&auto=format&fit=crop' },  
                { image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1000&auto=format&fit=crop' }   
            ]
        };
        res.json(mockConfig);
    } catch(e) {
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

// ============================================================
// QA TEST RESULTS — שמירת תוצאות בדיקה per test per env
// ============================================================

// שליפת כל תוצאות הסשן הנוכחי
app.get('/api/sa/qa/results', verifySA, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT test_id, env, status, note, updated_at FROM sa_qa_test_results ORDER BY updated_at DESC'
        );
        res.json({ success: true, results: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירה/עדכון batch של תוצאות (מהקליינט, debounced 1.5s)
app.post('/api/sa/qa/results/bulk', verifySA, async (req, res) => {
    try {
        const { results } = req.body;
        if(!results || !results.length) return res.json({ success: true, saved: 0 });
        let saved = 0;
        for(const r of results) {
            if(!r.testId || !r.env) continue;
            await pool.query(
                `INSERT INTO sa_qa_test_results (test_id, env, status, note)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (test_id, env) DO UPDATE
                 SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = CURRENT_TIMESTAMP`,
                [r.testId, r.env, r.status || null, r.note || '']
            );
            saved++;
        }
        res.json({ success: true, saved });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// איפוס כל תוצאות הסשן (לפני ריצה חדשה)
app.delete('/api/sa/qa/results', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_qa_test_results');
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// ============================================================
// QA TEST RESULTS — שמירת תוצאות בדיקה per test per env
// ============================================================

app.get('/api/sa/qa/results', verifySA, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT test_id, env, status, note, updated_at FROM sa_qa_test_results ORDER BY updated_at DESC'
        );
        res.json({ success: true, results: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sa/qa/results/bulk', verifySA, async (req, res) => {
    try {
        const { results } = req.body;
        if(!results || !results.length) return res.json({ success: true, saved: 0 });
        let saved = 0;
        for(const r of results) {
            if(!r.testId || !r.env) continue;
            await pool.query(
                `INSERT INTO sa_qa_test_results (test_id, env, status, note)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (test_id, env) DO UPDATE
                 SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = CURRENT_TIMESTAMP`,
                [r.testId, r.env, r.status || null, r.note || '']
            );
            saved++;
        }
        res.json({ success: true, saved });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sa/qa/results', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM sa_qa_test_results');
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
