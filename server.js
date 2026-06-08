require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
// Serve WebP automatically when browser supports it and WebP version exists
app.use((req, res, next) => {
    if (/\.(png|jpe?g)$/i.test(req.path) && (req.headers.accept || '').includes('image/webp')) {
        const webpPath = path.join(__dirname, 'public', req.path.replace(/\.(png|jpe?g)$/i, '.webp'));
        if (fs.existsSync(webpPath)) {
            res.set('Content-Type', 'image/webp');
            return res.sendFile(webpPath);
        }
    }
    next();
});

app.use(express.static('public', {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (/\.(webp|png|jpe?g|gif|svg|ico)$/i.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=604800, immutable');
        } else if (/\.(js|css|html)$/i.test(filePath)) {
            res.set('Cache-Control', 'no-cache, must-revalidate');
        }
    }
}));

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const genAIv2 = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
      try { await client.query('ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS quote_number VARCHAR(20)'); } catch(e) {}
      try { await client.query(`UPDATE store_orders SET quote_number = 'QT-' || LPAD(id::text, 6, '0') WHERE status = 'quote' AND quote_number IS NULL`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS confirm_token VARCHAR(64)`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMP`); } catch(e) {}
      try { await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS confirm_token VARCHAR(64)`); } catch(e) {}
      try { await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_confirmed_at TIMESTAMP`); } catch(e) {}

      // ============ COMMUNITY CASHBACK SYSTEM ============
      try { await client.query(`ALTER TABLE family_communities ADD COLUMN IF NOT EXISTS is_community_manager BOOLEAN DEFAULT FALSE`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS community_wallets (
          community_id INT PRIMARY KEY REFERENCES communities(id) ON DELETE CASCADE,
          balance NUMERIC(12,2) DEFAULT 0,
          total_earned NUMERIC(12,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS community_wallet_transactions (
          id SERIAL PRIMARY KEY,
          community_id INT REFERENCES communities(id) ON DELETE CASCADE,
          amount NUMERIC(12,2) NOT NULL,
          type VARCHAR(20) NOT NULL DEFAULT 'cashback',
          reference_id INT,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS business_platform_dues (
          id SERIAL PRIMARY KEY,
          business_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          order_id INT,
          order_amount NUMERIC(12,2),
          commission_pct NUMERIC(5,2),
          commission_amount NUMERIC(12,2),
          cashback_pct NUMERIC(5,2),
          cashback_amount NUMERIC(12,2),
          community_id INT,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS business_platform_collections (
          id SERIAL PRIMARY KEY,
          business_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          amount NUMERIC(12,2) NOT NULL,
          collected_at DATE NOT NULL DEFAULT CURRENT_DATE,
          notes TEXT,
          created_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      // ===== ZONE MANAGER SYSTEM =====
      try { await client.query(`CREATE TABLE IF NOT EXISTS zone_managers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(50),
          password_hash VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          commission_pct NUMERIC(5,2) DEFAULT 5.00,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS manager_zones (
          id SERIAL PRIMARY KEY,
          manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS zone_id INT REFERENCES manager_zones(id) ON DELETE SET NULL`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zone_manager_commissions (
          id SERIAL PRIMARY KEY,
          manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          community_id INT REFERENCES communities(id) ON DELETE CASCADE,
          order_id INT,
          amount NUMERIC(12,2) NOT NULL,
          commission_pct NUMERIC(5,2),
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zone_manager_payments (
          id SERIAL PRIMARY KEY,
          manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          amount NUMERIC(12,2) NOT NULL,
          payment_method VARCHAR(100),
          notes TEXT,
          paid_at TIMESTAMP DEFAULT NOW(),
          recorded_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      // ===== END ZONE MANAGER SYSTEM =====

      // ===== ZONE MANAGER MARKETING & INBOX =====
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_campaigns (
          id SERIAL PRIMARY KEY,
          zone_manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          subtitle VARCHAR(300),
          text_content TEXT,
          fields_config JSONB DEFAULT '[]'::jsonb,
          token VARCHAR(80) UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_campaign_leads (
          id SERIAL PRIMARY KEY,
          campaign_id INT REFERENCES zm_campaigns(id) ON DELETE CASCADE,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          ai_score INT,
          ai_notes TEXT,
          status VARCHAR(30) DEFAULT 'new',
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_inbox_threads (
          id SERIAL PRIMARY KEY,
          zone_manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          community_id INT REFERENCES communities(id) ON DELETE CASCADE,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          subject VARCHAR(200),
          last_message_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_inbox_messages (
          id SERIAL PRIMARY KEY,
          thread_id INT REFERENCES zm_inbox_threads(id) ON DELETE CASCADE,
          sender_type VARCHAR(20) NOT NULL,
          sender_id INT NOT NULL,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_message_templates (
          id SERIAL PRIMARY KEY,
          zone_manager_id INT REFERENCES zone_managers(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          subject VARCHAR(200),
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`ALTER TABLE zm_campaigns ADD COLUMN IF NOT EXISTS image_url TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE zm_campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(30) DEFAULT 'general'`); } catch(e) {}
      try { await client.query(`ALTER TABLE zm_campaign_leads ADD COLUMN IF NOT EXISTS lead_type VARCHAR(20) DEFAULT 'unknown'`); } catch(e) {}
      try { await client.query(`ALTER TABLE zm_campaign_leads ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'new'`); } catch(e) {}
      try { await client.query(`ALTER TABLE zm_campaign_leads ADD COLUMN IF NOT EXISTS crm_notes TEXT`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS zm_lead_actions (
          id SERIAL PRIMARY KEY,
          lead_id INT REFERENCES zm_campaign_leads(id) ON DELETE CASCADE,
          action_type VARCHAR(50) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      // ===== END ZONE MANAGER MARKETING & INBOX =====
      // ===================================================

      await client.query(`CREATE TABLE IF NOT EXISTS saved_shopping_lists (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES family_groups(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          items JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      
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
      try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)'); } catch(e) {}
      try { await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS kiosk_password VARCHAR(100) DEFAULT '1234'`); } catch(e) {}
      try { await client.query('ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT NULL'); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS store_popups (
          id SERIAL PRIMARY KEY,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          button_text VARCHAR(100),
          button_url TEXT,
          image_url TEXT,
          scheduled_at TIMESTAMP,
          expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_popups ADD COLUMN IF NOT EXISTS popup_type VARCHAR(20) DEFAULT 'store'`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_popups ADD COLUMN IF NOT EXISTS image_base64 TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_popups ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) DEFAULT 'none'`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_popups ADD COLUMN IF NOT EXISTS trigger_ref TEXT`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sent_newsletters (id SERIAL PRIMARY KEY, group_id INT REFERENCES family_groups(id) ON DELETE CASCADE, subject VARCHAR(200), content_html TEXT, audience VARCHAR(50), recipient_count INT DEFAULT 0, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS product_category_map (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES family_groups(id) ON DELETE CASCADE, normalized_name TEXT NOT NULL, category TEXT NOT NULL, UNIQUE(group_id, normalized_name))`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS alert_rules (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES family_groups(id) ON DELETE CASCADE, name VARCHAR(200) NOT NULL, trigger_type VARCHAR(50) NOT NULL, trigger_config JSONB DEFAULT '{}', recipients JSONB DEFAULT '["ADMIN"]', channels JSONB DEFAULT '["in_app"]', cooldown_minutes INTEGER DEFAULT 60, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS alert_notifications (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES family_groups(id) ON DELETE CASCADE, rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL, trigger_type VARCHAR(50), message TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sla_configs (id SERIAL PRIMARY KEY, group_id INTEGER REFERENCES family_groups(id) ON DELETE CASCADE, module VARCHAR(30) NOT NULL, status VARCHAR(50) NOT NULL, status_label VARCHAR(100), max_hours DECIMAL(6,2) NOT NULL DEFAULT 24, is_active BOOLEAN DEFAULT TRUE, UNIQUE(group_id, module, status))`); } catch(e) {}
      try { await client.query(`ALTER TABLE sla_configs ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '["in_app"]'`); } catch(e) {}
      try { await client.query(`ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}
      try { await client.query(`ALTER TABLE alert_notifications ADD COLUMN IF NOT EXISTS reference_key VARCHAR(100)`); } catch(e) {}
      try { await client.query(`DELETE FROM alert_notifications WHERE trigger_type='equipment_maintenance' AND message LIKE '%"undefined"%'`); } catch(e) {}

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
      try { await client.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50) DEFAULT ''`); } catch(e) {}
      try { await client.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100) DEFAULT ''`); } catch(e) {}
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
      
      // הרחבת טבלת המשימות לשיוך הנדסי מלא (ALM) וחיבור מערכת התראות
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS description TEXT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS version_id INT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS assigned_developer VARCHAR(100)`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS owner_id INT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS original_ticket_id INT`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_dev_tasks ADD COLUMN IF NOT EXISTS group_id INT`); } catch(e) {}
      
      // ניהול גרסאות, ספר מוצר ו-QA (ספרינט 4 - ALM)
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_versions (id SERIAL PRIMARY KEY, name VARCHAR(100), target_date DATE, status VARCHAR(20) DEFAULT 'planning', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
      try { await client.query(`ALTER TABLE sa_product_book ADD COLUMN IF NOT EXISTS original_ticket_id INT`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_qa_runs (id SERIAL PRIMARY KEY, version_id INT REFERENCES sa_versions(id) ON DELETE SET NULL, tester_name VARCHAR(100), results JSONB, status VARCHAR(20) DEFAULT 'completed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}  
      try { await client.query(`CREATE TABLE IF NOT EXISTS sa_qa_test_results (id SERIAL PRIMARY KEY, test_id VARCHAR(50) NOT NULL, env VARCHAR(20) NOT NULL, status VARCHAR(10), note TEXT DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(test_id, env))`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS qa_task_assignments (task_id VARCHAR(50) PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e) {}
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
      try { await client.query(`ALTER TABLE store_catalog ADD COLUMN IF NOT EXISTS sku VARCHAR(100)`); } catch(err){}
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

      // טבלת לוג פעילות (Bell Activity Feed)
      try { await client.query(`CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(100),
        action_type VARCHAR(50),
        action_key VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`); } catch(e) {}
      try { await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_group ON activity_log(group_id, created_at DESC)`); } catch(e) {}

      // טבלאות מחולל סקרים
      try { await client.query(`CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'draft',
        unique_code VARCHAR(12) UNIQUE NOT NULL,
        required_fields JSONB DEFAULT '[]',
        anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS survey_questions (
        id SERIAL PRIMARY KEY,
        survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
        order_index INT DEFAULT 0,
        type VARCHAR(30) NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB DEFAULT '[]',
        required BOOLEAN DEFAULT TRUE
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
        respondent_data JSONB DEFAULT '{}',
        answers JSONB DEFAULT '[]',
        comment TEXT DEFAULT '',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`); } catch(e) {}

      // ===== EQUIPMENT MAINTENANCE MODULE =====
      try { await client.query(`CREATE TABLE IF NOT EXISTS equipment_technicians (
          id SERIAL PRIMARY KEY,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          company_name VARCHAR(100),
          phone VARCHAR(20),
          email VARCHAR(100),
          specialty VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS technician_id INT REFERENCES equipment_technicians(id) ON DELETE SET NULL`); } catch(e) {}
      try { await client.query(`ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS interval_days INT DEFAULT NULL`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS equipment_items (
          id SERIAL PRIMARY KEY,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          category VARCHAR(50) DEFAULT 'כללי',
          serial_number VARCHAR(100),
          purchase_date DATE,
          warranty_expiry DATE,
          status VARCHAR(20) DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS equipment_maintenance (
          id SERIAL PRIMARY KEY,
          equipment_id INT REFERENCES equipment_items(id) ON DELETE CASCADE,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          maintenance_type VARCHAR(50) DEFAULT 'periodic',
          description TEXT,
          scheduled_date DATE,
          completed_date DATE,
          status VARCHAR(20) DEFAULT 'pending',
          cost DECIMAL(10,2),
          technician_name VARCHAR(100),
          technician_phone VARCHAR(20),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS equipment_faults (
          id SERIAL PRIMARY KEY,
          equipment_id INT REFERENCES equipment_items(id) ON DELETE CASCADE,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          image_url TEXT,
          severity VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'open',
          resolved_date DATE,
          resolution_notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}

      try { await client.query(`CREATE TABLE IF NOT EXISTS equipment_fault_notes (
          id SERIAL PRIMARY KEY,
          fault_id INT REFERENCES equipment_faults(id) ON DELETE CASCADE,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          note TEXT NOT NULL,
          status_from VARCHAR(20),
          status_to VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW()
      )`); } catch(e) {}

      // ===== BUSINESS TYPES & ROLE DASHBOARDS =====
      try { await client.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'other'`); } catch(e) {}
      try { await client.query(`ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS licensed_features JSONB DEFAULT '{}'::jsonb`); } catch(e) {}
      try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_role_type VARCHAR(50)`); } catch(e) {}
      try { await client.query(`CREATE TABLE IF NOT EXISTS group_licenses (
          id SERIAL PRIMARY KEY,
          group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
          feature_key VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          price_monthly DECIMAL(10,2) DEFAULT 0,
          activated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(group_id, feature_key)
      )`); } catch(e) {}
      // ===== END BUSINESS TYPES & ROLE DASHBOARDS =====

      client.release();
  })
  .catch(err => console.error('Connection Error', err.stack));

// ── ACTIVITY LOG HELPER ─────────────────────────────────────────
async function logActivity(groupId, userId, userName, actionType, actionKey, description) {
  try {
    await pool.query(
      'INSERT INTO activity_log (group_id, user_id, user_name, action_type, action_key, description) VALUES ($1,$2,$3,$4,$5,$6)',
      [groupId, userId || null, userName || 'מערכת', actionType, actionKey, description]
    );
  } catch(e) { /* non-blocking */ }
}

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
    if (e.message && e.message.includes('429')) return res.status(429).json({ success: false, error: 'מערכת ה-AI עמוסה כרגע. אנא המתינו כדקה ונסו שוב.' });
    if (e.message && e.message.includes('GEMINI_API_KEY')) return res.status(500).json({ success: false, error: 'מפתח AI חסר בשרת' });
    res.status(500).json({ success: false, error: defaultMsg || 'שגיאה בתקשורת עם ה-AI', detail: e.message });
};

// =========================================================
// פונקציית איתור לקוחות OneFlow לפי מספרי הזמנה + טלפון + מייל
// =========================================================
async function resolveOneFlowGroupIds(pool, businessGroupId, customers) {
    const result = new Set();
    // שיטה 1: חיפוש לפי family_group_id בהזמנות (הכי אמין)
    const ordersRes = await pool.query(
        `SELECT DISTINCT family_group_id FROM store_orders
         WHERE group_id=$1 AND family_group_id IS NOT NULL AND family_group_id != $1`,
        [businessGroupId]
    );
    ordersRes.rows.forEach(r => result.add(r.family_group_id));

    // שיטה 2+3: התאמה לפי פרטי לקוחות (טלפון/מייל)
    for (const c of customers) {
        if (result.size > 0 && !c.phone && !c.email) continue;
        let gid = null;
        if (c.phone) {
            const digits = (c.phone || '').replace(/\D/g, '');
            const alt = digits.startsWith('972') ? '0' + digits.substring(3) : digits.startsWith('0') ? '972' + digits.substring(1) : digits;
            // שיטה 2a: חיפוש בעמודת phone של users
            const ur = await pool.query('SELECT group_id FROM users WHERE phone=$1 OR phone=$2 OR phone=$3 LIMIT 1', [digits, alt, c.phone]);
            if (ur.rows.length) gid = ur.rows[0].group_id;
            // שיטה 2b: חיפוש לפי customer_phone בהזמנות
            if (!gid) {
                const or2 = await pool.query(
                    `SELECT DISTINCT family_group_id FROM store_orders
                     WHERE group_id=$1 AND family_group_id IS NOT NULL
                       AND (REGEXP_REPLACE(customer_phone,'\\D','','g')=$2 OR REGEXP_REPLACE(customer_phone,'\\D','','g')=$3)
                     LIMIT 1`,
                    [businessGroupId, digits, alt]
                );
                if (or2.rows.length) gid = or2.rows[0].family_group_id;
            }
        }
        if (!gid && c.email) {
            const er = await pool.query("SELECT id FROM family_groups WHERE LOWER(admin_email)=LOWER($1) AND type='FAMILY' LIMIT 1", [c.email]);
            if (er.rows.length) gid = er.rows[0].id;
        }
        if (gid && gid !== parseInt(businessGroupId)) result.add(gid);
    }
    return result;
}

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

async function sendAlertEmail(groupId, subject, message) {
    try {
        const gr = await pool.query('SELECT admin_email, business_name FROM family_groups WHERE id=$1', [groupId]);
        if (!gr.rows.length || !gr.rows[0].admin_email) return;
        const { admin_email, business_name } = gr.rows[0];
        const html = `
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <div style="background:#4f46e5;padding:20px 24px;">
                <h2 style="color:#fff;margin:0;font-size:18px;">⚡ התראה מ-OneFlow</h2>
                <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">${business_name || 'OneFlow Life'}</p>
              </div>
              <div style="padding:24px;">
                <p style="font-size:15px;color:#1e293b;margin:0 0 16px;">${message}</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
                <p style="font-size:11px;color:#94a3b8;margin:0;">OneFlow Life · מערכת ניהול עסקי</p>
              </div>
            </div>`;
        await sendSystemEmail(admin_email, subject, html);
    } catch(e) { console.error('sendAlertEmail error:', e.message); }
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
// ראוט עוזרת AI למנהל המערכת (Super Admin) - חיבור מעודכן למנוע Gemini 2.5 Flash
app.post('/api/ai/chat', verifySA, async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!genAI) {
            return res.status(500).json({ success: false, error: 'מפתח Gemini אינו מוגדר בשרת.' });
        }

        // פונקציה לווידוא תקינות טבלאות בעליית השרת
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS internal_messages (
                id SERIAL PRIMARY KEY,
                title TEXT,
                content TEXT,
                target_type VARCHAR(50),
                target_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS message_acknowledgments (
                message_id INTEGER,
                employee_id INTEGER,
                status VARCHAR(20),
                responded_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (message_id, employee_id)
            );
        `);
        console.log('Database tables initialized successfully.');
    } catch (e) { console.error('DB Init Error:', e); }
}
initDB();
        // יישור קו עם שאר המערכת: שימוש במודל 2.5 המעודכן שעובד על המפתח שלך
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const systemInstruction = `אתה עוזר AI ביצועי ואנליטי ברמת Expert למנהל העל (Super Admin) של מערכת Oneflow Life.
בכל בקשה תקבל בלוק נתונים עדכני בפורמט JSON בשם "מידע פנימי בזמן אמת". הנתונים האלו הם אמת מוחלטת והם משקפים את מסד הנתונים כרגע.
ההנחיות שלך:
1. ענה ישירות, קצר ולעניין על סמך הנתונים שסופקו לך. אל תתן תשובות תיאורטיות, אל תחנך את המנהל, ואל תכתוב "אין לי גישה" - כי הגישה סופקה לך בבלוק הנתונים.
2. נתח את הנתונים הקיימים, תן סיכומים מספריים (כמה פתוחים, כמה סגורים וכו') ותן חיזוי קצר אם נדרש.
3. אם המנהל מבקש לבצע פעולה ממשית (למשל "מחק את קריאה 5" או "הוסף קהילה"), ספק לו את שאילתת ה-SQL המדויקת או פקודת ה-API שעליו להריץ, ללא הסברים מיותרים.`;

        const prompt = `${systemInstruction}\n\nבקשת המנהל אליך: ${message}`;
        
        const result = await model.generateContent(prompt);
        const reply = result.response.text();
        
        res.json({ success: true, reply });
    } catch(e) { 
        console.error('AI Chat Error:', e.message);
        res.status(500).json({ success: false, error: `תקלת תקשורת מול גוגל: ${e.message}` }); 
    }
});
// הוספת קריאת שירות יזומה על ידי מנהל המערכת (סופר אדמין)
async function postToInternalChat(message, senderName) {
    try {
        await pool.query(
            'INSERT INTO sa_internal_chat (room, sender_name, sender_id, message) VALUES ($1, $2, $3, $4)',
            ['general', senderName || 'מערכת', null, message]
        );
    } catch(_) {}
}

app.post('/api/superadmin/tickets', verifySA, async (req, res) => {
    try {
        const { subject, description, group_id } = req.body;
        const staffSender = req.saUser ? req.saUser.name : 'צוות מערכת';
        const initialLog = [{ date: new Date().toISOString(), sender: staffSender + ' (יזום)', isStaff: true, isInternal: false, message: description }];

        if (group_id) {
            initialLog.push({ date: new Date().toISOString(), sender: 'מערכת', isStaff: true, isInternal: false, message: `📋 קריאת שירות נפתחה עבורך על ידי צוות התמיכה בנושא: "${subject}". נחזור אליך בהקדם.` });
            initialLog.push({ date: new Date().toISOString(), sender: 'מערכת', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] קריאה יזומה נפתחה ושויכה ללקוח (group_id: ${group_id})` });
        }

        const result = await pool.query(
            'INSERT INTO support_tickets (group_id, user_id, subject, description, status, log) VALUES ($1, NULL, $2, $3, $4, $5) RETURNING id',
            [group_id || null, subject, description, 'open', JSON.stringify(initialLog)]
        );
        const ticketId = result.rows[0].id;

        if (group_id) {
            await postToInternalChat(`🎫 קריאה יזומה #${ticketId} נפתחה: "${subject}" — שויכה ללקוח. טיפול נדרש.`, staffSender);
        }

        res.json({ success: true, ticketId });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// שליפת הקריאות עבור פאנל ה-Super Admin (כולל צוותים משויכים וזמני SLA)
app.get('/api/superadmin/tickets', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, f.name as group_name, f.admin_email as group_email, f.group_code,
                   u.nickname as user_name,
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
        const tickets = result.rows.map(t => {
            if (Array.isArray(t.log)) {
                t.log = t.log.filter(entry => !entry.isInternal);
            } else if (typeof t.log === 'string') {
                try {
                    const parsed = JSON.parse(t.log);
                    t.log = JSON.stringify(parsed.filter(entry => !entry.isInternal));
                } catch(_) {}
            }
            return t;
        });
        res.json({ success: true, tickets });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// עדכון סטטוס הקריאה ע"י ה-Super Admin ועדכון חותמת זמן ל-SLA
app.put('/api/superadmin/tickets/:id/status', verifySA, async (req, res) => {
    try {
        await pool.query('UPDATE support_tickets SET status = $1, status_updated_at = CURRENT_TIMESTAMP WHERE id = $2', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מחיקת קריאת שירות מהסופר אדמין
app.delete('/api/superadmin/tickets/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM support_tickets WHERE id=$1', [req.params.id]);
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
        const { message, status, isInternal, senderName, auditNote } = req.body;

        // שליפת הטיקט הקיים מהמסד
        const tRes = await dbClient.query('SELECT status, log FROM support_tickets WHERE id = $1', [ticketId]);
        if (tRes.rows.length === 0) throw new Error('Ticket not found');

        const ticket = tRes.rows[0];
        let currentLog = ticket.log || [];
        if (typeof currentLog === 'string') currentLog = JSON.parse(currentLog);

        // הוספת ההודעה החדשה ללוג רק אם יש תוכן
        if (message && message.trim()) {
            currentLog.push({
                date: new Date().toISOString(),
                sender: senderName || 'צוות מערכת',
                isStaff: true,
                isInternal: !!isInternal,
                message: message
            });
        }

        // audit log בשינוי סטטוס
        const statusLabelsTicket = { open: 'פתוחה', in_progress: 'בטיפול פעיל', resolved: 'נסגרה', closed: 'נסגרה' };
        if (status && status !== ticket.status) {
            const label = statusLabelsTicket[status] || status;
            currentLog.push({ date: new Date().toISOString(), sender: 'מערכת', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] סטטוס הקריאה עודכן: ${label}` });
        }
        // audit note (e.g. sent to ALM/QA)
        if (auditNote) {
            currentLog.push({ date: new Date().toISOString(), sender: senderName || 'מערכת', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] ${auditNote}` });
        }

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

// Zone Manager sessions: token → { managerId, name, email }
const zoneManagerSessions = new Map();
const zmPasswordResets = new Map(); // token -> { managerId, name, email, expires }

async function verifyZoneManager(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(403).json({ error: 'Unauthorized zone manager' });
    // בדיקה ב-cache תחילה
    if (zoneManagerSessions.has(token)) {
        req.zmSession = zoneManagerSessions.get(token);
        return next();
    }
    // אם השרת הופעל מחדש — חלץ manager ID מהטוקן ובדוק ב-DB
    if (token.startsWith('ZM_')) {
        const parts = token.split('_');
        if (parts.length >= 3) {
            const managerId = parseInt(parts[1]);
            if (!isNaN(managerId)) {
                try {
                    const r = await pool.query("SELECT id,name,email FROM zone_managers WHERE id=$1 AND status='active'", [managerId]);
                    if (r.rows.length) {
                        const mgr = r.rows[0];
                        const session = { managerId: mgr.id, name: mgr.name, email: mgr.email };
                        zoneManagerSessions.set(token, session);
                        req.zmSession = session;
                        return next();
                    }
                } catch(e) {}
            }
        }
    }
    return res.status(403).json({ error: 'Unauthorized zone manager' });
}

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

        // 2. אם לא מצאנו משתמש צוות, נבדוק פרטי מנהל-על מ-system_settings
        const [saUserRes, saPassRes, saEmailRes] = await Promise.all([
            pool.query("SELECT value FROM system_settings WHERE key = 'sa_username'"),
            pool.query("SELECT value FROM system_settings WHERE key = 'sa_password'"),
            pool.query("SELECT value FROM system_settings WHERE key = 'sa_email'"),
        ]);
        const currentUsername = saUserRes.rows.length > 0 ? saUserRes.rows[0].value : 'admin';
        const currentPass = saPassRes.rows.length > 0 ? saPassRes.rows[0].value : '123456';
        const currentEmail = saEmailRes.rows.length > 0 ? saEmailRes.rows[0].value : '';

        // מאפשר כניסה עם שם משתמש או מייל ארגוני
        const codeMatchesMaster = (code === currentUsername) || (currentEmail && code === currentEmail);
        if (codeMatchesMaster && password === currentPass) {
            res.json({
                success: true,
                token: 'SA_SECRET_TOKEN_2026',
                user: { id: 0, name: 'מנהל על (Master)', email: currentEmail || currentUsername, team: 'Management', permissions: ['all'] }
            });
        } else {
            res.status(401).json({ error: 'פרטי גישה שגויים לניהול מערכת' });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// עדכון פרטי כניסה של מנהל-על ראשי (username, password, org email)
app.post('/api/superadmin/credentials', verifySA, async (req, res) => {
    try {
        const { newUsername, newPassword, newEmail } = req.body;
        if (!newUsername && !newPassword && !newEmail) {
            return res.status(400).json({ error: 'יש לספק לפחות שדה אחד לעדכון' });
        }
        const updates = [];
        if (newUsername) updates.push(pool.query(
            "INSERT INTO system_settings (key, value) VALUES ('sa_username', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [newUsername]
        ));
        if (newPassword) updates.push(pool.query(
            "INSERT INTO system_settings (key, value) VALUES ('sa_password', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [newPassword]
        ));
        if (newEmail !== undefined) updates.push(pool.query(
            "INSERT INTO system_settings (key, value) VALUES ('sa_email', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [newEmail]
        ));
        await Promise.all(updates);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        if (req.body.smsLoginEnabled !== undefined) await pool.query("INSERT INTO system_settings (key, value) VALUES ('sms_login_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(req.body.smsLoginEnabled)]);
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
        const settings = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('welcome_msg', 'business_welcome_msg', 'ad_banner_text_top', 'ad_banner_link_top', 'ad_banner_img_top', 'ad_banner_text_bottom', 'ad_banner_link_bottom', 'ad_banner_img_bottom', 'business_ad_banner_text_top', 'business_ad_banner_link_top', 'business_ad_banner_img_top', 'business_ad_banner_text_bottom', 'business_ad_banner_link_bottom', 'business_ad_banner_img_bottom', 'sa_email', 'sa_username', 'global_ai_logo', 'login_slides', 'sms_login_enabled')");
        
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
            globalAiLogo: getSet('global_ai_logo'), loginSlides: loginSlides, smsLoginEnabled: getSet('sms_login_enabled') !== 'false',
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

app.get('/api/settings/login-mode', async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'sms_login_enabled'");
        const raw = result.rows[0]?.value;
        // ברירת מחדל: true (פעיל) אם הערך לא קיים
        const smsEnabled = raw === null || raw === undefined ? true : raw !== 'false';
        res.json({ success: true, smsEnabled });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
app.put('/api/groups/:id/doc-settings', async (req, res) => {
    try {
        const { vat_number, contact_name } = req.body;
        await pool.query('UPDATE family_groups SET vat_number=$1, contact_name=$2 WHERE id=$3', [vat_number || '', contact_name || '', req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        const allBundles = await pool.query(`SELECT * FROM quiz_bundles WHERE created_by = $1 OR created_by = 'SYSTEM' ORDER BY created_at DESC`, [String(user.group_id)]);
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
        let userRole = 'ADMIN';
        if (userId) {
            const uRes = await pool.query('SELECT group_id, role FROM users WHERE id=$1', [userId]);
            if (uRes.rows.length > 0) { if (isNaN(actualGroupId)) actualGroupId = uRes.rows[0].group_id; userRole = uRes.rows[0].role; }
        }
        if (!actualGroupId) return res.status(400).json({ success: false, error: 'Group ID is missing' });
        const itemStatus = userRole === 'ADMIN' ? 'pending' : 'requested';
        await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, unit, estimated_price, units_per_package, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [actualGroupId, userId || null, itemName, parseFloat(quantity) || 1, unit || 'יח\'', parseFloat(estimatedPrice) || 0, parseInt(unitsPerPackage) || 1, itemStatus]);
        await logActivity(actualGroupId, userId || null, null, 'shopping', 'item_added', `${itemName} נוסף לרשימת הקניות`);
        res.json({ success: true, status: itemStatus });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    try {
        const { itemId, status, estimatedPrice, itemName, quantity, unit } = req.body;
        if (status !== undefined) await pool.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if (estimatedPrice !== undefined) await pool.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [parseFloat(estimatedPrice) || 0, itemId]);
        if (itemName !== undefined) await pool.query('UPDATE shopping_list SET item_name=$1 WHERE id=$2', [itemName, itemId]);
        if (quantity !== undefined) await pool.query('UPDATE shopping_list SET quantity=$1 WHERE id=$2', [parseFloat(quantity) || 1, itemId]);
        if (unit !== undefined) await pool.query('UPDATE shopping_list SET unit=$1 WHERE id=$2', [unit, itemId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/delete/:id', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/clear/:groupId', async (req, res) => {
    try { await pool.query('DELETE FROM shopping_list WHERE group_id=$1', [req.params.groupId]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shopping/category-map', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT normalized_name, category FROM product_category_map WHERE group_id=$1', [groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/category-map', async (req, res) => {
    try {
        const { groupId, normalizedName, category } = req.body;
        await pool.query('INSERT INTO product_category_map (group_id, normalized_name, category) VALUES ($1, $2, $3) ON CONFLICT (group_id, normalized_name) DO UPDATE SET category=$3', [groupId, normalizedName, category]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ALERT RULES CRUD ────────────────────────────────────────────
app.get('/api/alerts/rules', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT * FROM alert_rules WHERE group_id=$1 ORDER BY created_at DESC', [groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts/rules', async (req, res) => {
    try {
        const { groupId, name, triggerType, triggerConfig, cooldownMinutes, channels } = req.body;
        const channelsJson = JSON.stringify(Array.isArray(channels) ? channels : ['in_app']);
        await pool.query('INSERT INTO alert_rules (group_id, name, trigger_type, trigger_config, cooldown_minutes, channels) VALUES ($1, $2, $3, $4, $5, $6)',
            [groupId, name, triggerType, JSON.stringify(triggerConfig || {}), cooldownMinutes || 60, channelsJson]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/alerts/rules/:id', async (req, res) => {
    try {
        const { isActive, name, triggerConfig, cooldownMinutes } = req.body;
        if (isActive !== undefined) await pool.query('UPDATE alert_rules SET is_active=$1 WHERE id=$2', [isActive, req.params.id]);
        if (name !== undefined) await pool.query('UPDATE alert_rules SET name=$1 WHERE id=$2', [name, req.params.id]);
        if (triggerConfig !== undefined) await pool.query('UPDATE alert_rules SET trigger_config=$1 WHERE id=$2', [JSON.stringify(triggerConfig), req.params.id]);
        if (cooldownMinutes !== undefined) await pool.query('UPDATE alert_rules SET cooldown_minutes=$1 WHERE id=$2', [cooldownMinutes, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/alerts/rules/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM alert_rules WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alerts/notifications', async (req, res) => {
    try {
        const { groupId, limit } = req.query;
        const result = await pool.query('SELECT * FROM alert_notifications WHERE group_id=$1 ORDER BY created_at DESC LIMIT $2',
            [groupId, parseInt(limit) || 50]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alerts/unread-count', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT COUNT(*) as count FROM alert_notifications WHERE group_id=$1 AND is_read=FALSE', [groupId]);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts/notifications/:id/read', async (req, res) => {
    try {
        await pool.query('UPDATE alert_notifications SET is_read=TRUE WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts/notifications/read-all', async (req, res) => {
    try {
        const { groupId } = req.body;
        await pool.query('UPDATE alert_notifications SET is_read=TRUE WHERE group_id=$1', [groupId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SLA CRUD ──────────────────────────────────────────────────────
app.get('/api/sla', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT * FROM sla_configs WHERE group_id=$1 ORDER BY module, id', [groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sla', async (req, res) => {
    try {
        const { groupId, module, status, statusLabel, maxHours, isActive, channels } = req.body;
        const channelsJson = JSON.stringify(Array.isArray(channels) ? channels : ['in_app']);
        await pool.query(
            `INSERT INTO sla_configs (group_id, module, status, status_label, max_hours, is_active, channels) VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (group_id, module, status) DO UPDATE SET status_label=$4, max_hours=$5, is_active=$6, channels=$7`,
            [groupId, module, status, statusLabel, parseFloat(maxHours)||24, isActive !== false, channelsJson]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sla/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM sla_configs WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        await pool.query('COMMIT');
        await logActivity(groupId, userId, null, 'shopping', 'checkout', `קניה הושלמה ב-${storeName} — ₪${parseFloat(totalAmount).toFixed(2)}`);
        res.json({ success: true });
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
// --- SAVED SHOPPING LISTS ENDPOINTS ---
// ============================================================

app.get('/api/shopping/saved', async (req, res) => {
    try {
        const { groupId } = req.query;
        const result = await pool.query('SELECT * FROM saved_shopping_lists WHERE group_id=$1 ORDER BY created_at DESC', [groupId]);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/save', async (req, res) => {
    try {
        const { groupId, name, items } = req.body;
        if (!name || !items || items.length === 0) return res.status(400).json({ error: 'Missing name or items' });
        const result = await pool.query('INSERT INTO saved_shopping_lists (group_id, name, items) VALUES ($1, $2, $3) RETURNING id', [groupId, name, JSON.stringify(items)]);
        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/load-saved', async (req, res) => {
    try {
        const { listId, userId } = req.body;
        const uRes = await pool.query('SELECT group_id FROM users WHERE id=$1', [userId]);
        const groupId = uRes.rows[0].group_id;
        const listRes = await pool.query('SELECT * FROM saved_shopping_lists WHERE id=$1 AND group_id=$2', [listId, groupId]);
        if (listRes.rows.length === 0) return res.status(404).json({ error: 'List not found' });
        const items = listRes.rows[0].items;
        for (let item of items) {
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, unit, estimated_price, units_per_package, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`, [groupId, userId, item.item_name, item.quantity || 1, item.unit || "יח'", item.estimated_price || 0, item.units_per_package || 1]);
        }
        res.json({ success: true, count: items.length });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shopping/saved/:id', async (req, res) => {
    try { await pool.query('DELETE FROM saved_shopping_lists WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
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
        await logActivity(actualGroupId, null, null, 'pantry', 'pantry_add', `${itemName} נוסף למזווה`);
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

app.post('/api/pantry/bulk-update', async (req, res) => {
    try {
        const { groupId, items, sendEmail, pdfBase64 } = req.body;
        if (!groupId || !Array.isArray(items)) return res.status(400).json({ error: 'נתונים חסרים' });
        for (const item of items) {
            if (item.id && item.quantity !== undefined && item.quantity !== '') {
                await pool.query(
                    'UPDATE pantry SET quantity=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND group_id=$3',
                    [parseFloat(item.quantity) || 0, item.id, groupId]
                );
            }
        }
        if (sendEmail) {
            const grpRes = await pool.query('SELECT name, admin_email FROM family_groups WHERE id=$1', [groupId]);
            const grp = grpRes.rows[0];
            if (grp && grp.admin_email) {
                const dateStr = new Date().toLocaleDateString('he-IL');
                const rows = items.filter(i => i.quantity !== '').map(i =>
                    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${(i.item_name||i.name||'').replace(/[<>]/g,'')}</td>
                     <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:#64748b">${(i.unit||"יח'").replace(/[<>]/g,'')}</td>
                     <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold">${i.quantity}</td></tr>`
                ).join('');
                const html = `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;padding:24px">
                    <h2 style="color:#4338ca">ספירת מלאי מחסן — ${(grp.name||'').replace(/[<>]/g,'')}</h2>
                    <p style="color:#64748b">תאריך: ${dateStr}</p>
                    <table style="width:100%;border-collapse:collapse;margin-top:12px">
                        <thead><tr>
                            <th style="background:#f1f5f9;padding:8px 12px;text-align:right">פריט</th>
                            <th style="background:#f1f5f9;padding:8px 12px;text-align:center">יחידה</th>
                            <th style="background:#f1f5f9;padding:8px 12px;text-align:center">כמות בפועל</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <p style="margin-top:20px;font-size:11px;color:#94a3b8">OneFlow Life — ${dateStr}</p>
                </div>`;
                const user = process.env.SMTP_USER;
                const pass = process.env.SMTP_PASS;
                if (user && pass) {
                    const nodemailer = require('nodemailer');
                    const transporter = nodemailer.createTransport({ host:'smtp.gmail.com', port:465, secure:true, auth:{user,pass} });
                    const mailOpts = {
                        from: `"Oneflow System" <${user}>`,
                        to: grp.admin_email,
                        subject: `ספירת מלאי מחסן — ${grp.name} — ${dateStr}`,
                        html
                    };
                    if (pdfBase64) {
                        mailOpts.attachments = [{
                            filename: `ספירת_מלאי_${dateStr.replace(/\//g,'-')}.pdf`,
                            content: Buffer.from(pdfBase64, 'base64'),
                            contentType: 'application/pdf'
                        }];
                    }
                    await transporter.sendMail(mailOpts);
                }
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        await logActivity(groupId, userId || null, null, 'finance', 'transaction', `${type === 'income' ? 'הכנסה' : 'הוצאה'}: ₪${amount} — ${description}`);
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
        await logActivity(groupId, childId || null, null, 'finance', 'balance_adjust', `הפרשת דמי כיס: ₪${amount} — ${reason || ''}`);
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
        const { title, reward, assignedTo, days, status, groupId, requireAiCheck } = req.body;
        const deadline = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
        const aiCheck = requireAiCheck !== undefined ? requireAiCheck : true;
        await pool.query('INSERT INTO tasks (group_id, title, reward, assigned_to, deadline, status, require_ai_check) VALUES ($1, $2, $3, $4, $5, $6, $7)', [groupId, title, parseFloat(reward)||0, assignedTo, deadline, status, aiCheck]);
        await logActivity(groupId, assignedTo || null, null, 'task', 'task_created', `משימה חדשה: ${title}`);
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
        await pool.query('COMMIT');
        if (status === 'done') await logActivity(t.group_id, t.assigned_to, null, 'task', 'task_done', `משימה הושלמה: ${t.title}`);
        if (status === 'approved') await logActivity(t.group_id, t.assigned_to, null, 'task', 'task_approved', `משימה אושרה: ${t.title}`);
        let triggeredPopup = null;
        if (status === 'done') {
            try {
                const pRes = await pool.query(
                    `SELECT id, title, content, image_base64 FROM store_popups
                     WHERE group_id=$1 AND is_active=TRUE AND popup_type='employee'
                       AND trigger_type='task' AND trigger_ref=$2
                       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
                    [t.group_id, String(taskId)]
                );
                if (pRes.rows.length > 0) triggeredPopup = pRes.rows[0];
            } catch(e2) {}
        }
        res.json({success:true, triggeredPopup});
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
        const { groupId, type, prompt: businessName } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });

        // Use Gemini to build a contextual English prompt from the business name
        let finalPrompt;
        if (type === 'banner' && businessName && genAI) {
            try {
                const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const geminiResult = await geminiModel.generateContent(
                    `You are a professional image prompt engineer. Based on the business name "${businessName}", write a short English image generation prompt (max 30 words) for a wide banner background photo. Requirements: realistic photography style, relevant to the business type, vibrant colors, no text, no logos, no people faces. Return ONLY the prompt text.`
                );
                finalPrompt = geminiResult.response.text().trim().replace(/^["']|["']$/g, '');
                console.log('Generated banner prompt:', finalPrompt);
            } catch(e) {
                console.error('Gemini prompt gen failed, using default:', e.message);
            }
        }
        if (!finalPrompt) {
            finalPrompt = type === 'banner'
                ? 'professional business store banner background, realistic photography, vibrant colors, no text, no logos, wide panoramic'
                : 'professional business logo icon, clean modern design, colorful, high quality';
        }

        const hfToken = process.env.HF_TOKEN;
        if (!hfToken) return res.json({ success: false, error: 'HF_TOKEN חסר בהגדרות השרת' });

        const hfWidth  = type === 'banner' ? 1024 : 512;
        const hfHeight = type === 'banner' ? 576  : 512;

        // Use HF router endpoint (newer, more reliable)
        const hfEndpoint = `https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell`;
        let hfRes;
        try {
            hfRes = await fetch(hfEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json', 'x-wait-for-model': 'true' },
                body: JSON.stringify({ inputs: finalPrompt, parameters: { width: hfWidth, height: hfHeight } }),
                signal: AbortSignal.timeout(28000)
            });
        } catch (fetchErr) {
            // Router failed - fallback to legacy endpoint
            console.log('Router failed, trying legacy endpoint:', fetchErr.message);
            hfRes = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json', 'x-wait-for-model': 'true' },
                body: JSON.stringify({ inputs: finalPrompt, parameters: { width: hfWidth, height: hfHeight } }),
                signal: AbortSignal.timeout(28000)
            });
        }

        if (hfRes.status === 503) {
            const errData = await hfRes.json().catch(() => ({}));
            const eta = errData.estimated_time ? `בעוד כ-${Math.ceil(errData.estimated_time)} שניות` : 'בעוד כדקה';
            return res.json({ success: false, error: `מודל AI בטעינה, נסה שוב ${eta}` });
        }
        if (!hfRes.ok) {
            const errText = await hfRes.text().catch(() => '');
            console.error('HF error:', hfRes.status, errText);
            return res.json({ success: false, error: `שגיאת שירות AI (${hfRes.status}): ${errText.slice(0,100)}` });
        }

        const buffer = await hfRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = hfRes.headers.get('content-type') || 'image/jpeg';
        res.json({ success: true, imageUrl: `data:${contentType};base64,${base64}` });
    } catch(e) {
        console.error('Image Gen Error:', e.message);
        res.json({ success: false, error: 'שגיאה ביצירת תמונה: ' + (e.message || 'נסה שוב.') });
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
            let triggeredPopup = null;
            try {
                const pRes = await pool.query(
                    `SELECT id, title, content, image_base64 FROM store_popups
                     WHERE group_id=$1 AND is_active=TRUE AND popup_type='employee'
                       AND trigger_type='shift'
                       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
                    [groupId]
                );
                if (pRes.rows.length > 0) triggeredPopup = pRes.rows[0];
            } catch(e2) {}
            res.json({ success: true, status: 'in', triggeredPopup });
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
            'INSERT INTO store_catalog (group_id, name, description, price, category, image_url, options_text, badge_text, badge_color, product_type, long_description, sku) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
            [groupId, name, description, parseFloat(price)||0, category, imageUrl, optionsText, badgeText || null, badgeColor || 'red', productType || 'retail', longDescription || '', req.body.sku || '']
        );
        res.json({ success: true, item: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/catalog/:id', async (req, res) => {
    try {
        const { name, description, price, category, imageUrl, optionsText, badgeText, badgeColor, productType, longDescription } = req.body;

        const result = await pool.query(
            'UPDATE store_catalog SET name=$1, description=$2, price=$3, category=$4, image_url=COALESCE($5, image_url), options_text=$6, badge_text=$7, badge_color=$8, product_type=$9, long_description=$10, sku=$11 WHERE id=$12 RETURNING *',
            [name, description, parseFloat(price)||0, category, imageUrl, optionsText, badgeText || null, badgeColor || 'red', productType || 'retail', longDescription || '', req.body.sku || '', req.params.id]
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

// --- ספירת מלאי ---
app.post('/api/store/inventory-count', async (req, res) => {
    try {
        const { groupId, items, sendEmail } = req.body;
        if (!groupId || !items || !Array.isArray(items)) return res.status(400).json({ error: 'נתונים חסרים' });

        for (const item of items) {
            if (item.id && item.stock_quantity !== undefined && item.stock_quantity !== '') {
                await pool.query(
                    'UPDATE store_catalog SET stock_quantity=$1 WHERE id=$2 AND group_id=$3',
                    [parseInt(item.stock_quantity) || 0, item.id, groupId]
                );
            }
        }

        if (sendEmail) {
            const grpRes = await pool.query('SELECT name, admin_email FROM family_groups WHERE id=$1', [groupId]);
            const grp = grpRes.rows[0];
            if (grp && grp.admin_email) {
                const dateStr = new Date().toLocaleDateString('he-IL');
                const rows = items.filter(i => i.stock_quantity !== '').map(i =>
                    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${(i.name||'').replace(/[<>]/g,'')}</td>
                     <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold">${i.stock_quantity}</td></tr>`
                ).join('');
                const html = `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;padding:24px">
                    <h2 style="color:#4338ca">ספירת מלאי — ${(grp.name||'').replace(/[<>]/g,'')}</h2>
                    <p style="color:#64748b">תאריך: ${dateStr}</p>
                    <table style="width:100%;border-collapse:collapse;margin-top:12px">
                        <thead><tr>
                            <th style="background:#f1f5f9;padding:8px 12px;text-align:right">מוצר</th>
                            <th style="background:#f1f5f9;padding:8px 12px;text-align:center">כמות במלאי</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <p style="margin-top:20px;font-size:11px;color:#94a3b8">OneFlow Life — ${dateStr}</p>
                </div>`;
                await sendSystemEmail(grp.admin_email, `ספירת מלאי — ${grp.name} — ${dateStr}`, html);
            }
        }

        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- הודעות OneFlow: התאמת לקוחות + שליחה לאינבוקס ---
app.get('/api/store/oneflow-customers/:groupId', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const custRes = await pool.query('SELECT id, name, phone, email FROM store_customers WHERE group_id=$1', [groupId]);
        const matchedGids = await resolveOneFlowGroupIds(pool, groupId, custRes.rows);
        // מציג ללקוח רשימה של customers שנמצאו ב-OneFlow
        const matched = custRes.rows.filter(c => {
            if (!c.phone && !c.email) return false;
            // נבדוק אם customer הזה היה חלק מה-matching (אם יש הזמנות נחזיר הכל)
            return true;
        });
        const commRes = await pool.query(
            `SELECT c.id, c.name, COUNT(fg.id)::int AS family_count
             FROM community_businesses cb
             JOIN communities c ON c.id = cb.community_id
             LEFT JOIN family_groups fg ON fg.community_id = c.id AND fg.type='FAMILY'
             WHERE cb.business_id=$1 AND cb.status='approved'
             GROUP BY c.id, c.name`, [groupId]);
        res.json({ success: true, matched, matchedCount: matchedGids.size, communities: commRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/oneflow-message', async (req, res) => {
    try {
        const { groupId, subject, content, targetType, communityId } = req.body;
        if (!groupId || !subject || !content) return res.status(400).json({ error: 'נתונים חסרים' });

        const grpRes = await pool.query('SELECT name FROM family_groups WHERE id=$1', [groupId]);
        const senderName = grpRes.rows[0]?.name || 'עסק';
        let targetGroupIds = new Set();

        if (targetType === 'community' && communityId) {
            const fgRes = await pool.query("SELECT id FROM family_groups WHERE community_id=$1 AND type='FAMILY'", [communityId]);
            fgRes.rows.forEach(r => targetGroupIds.add(r.id));
        } else {
            const custRes = await pool.query('SELECT phone, email FROM store_customers WHERE group_id=$1', [groupId]);
            targetGroupIds = await resolveOneFlowGroupIds(pool, groupId, custRes.rows);
        }

        if (targetGroupIds.size === 0) return res.json({ success: false, error: 'לא נמצאו נמענים OneFlow. ודא שלקוחותיך הזמינו מהחנות דרך OneFlow Life.' });

        await pool.query('BEGIN');
        for (const gid of targetGroupIds) {
            await pool.query(
                'INSERT INTO inbox_messages (group_id, sender_type, sender_name, sender_contact, subject, content) VALUES ($1,$2,$3,$4,$5,$6)',
                [gid, 'business', senderName, '', subject, content]
            );
        }
        await pool.query('COMMIT');
        res.json({ success: true, count: targetGroupIds.size });
    } catch(e) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

// --- AI ניסוח לעסקים ---
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { context, query } = req.body;
        if (!context && !query) return res.status(400).json({ success: false, error: 'נתונים חסרים' });
        const prompt = context ? `${context}\n\nבקשה: ${query}` : query;
        const responseText = await callGeminiDirect(prompt);
        res.json({ success: true, answer: responseText });
    } catch(e) {
        console.error('AI Gen Error:', e.message);
        res.json({ success: false, error: 'שגיאה במנוע ה-AI: ' + e.message });
    }
});

// --- שיגור ניוזלטר עסקי ---
app.post('/api/store/newsletter/broadcast', async (req, res) => {
    try {
        const { groupId, subject, content, audience, communityId } = req.body;
        if (!groupId || !subject || !content) return res.status(400).json({ error: 'נתונים חסרים' });

        const grpRes = await pool.query('SELECT name FROM family_groups WHERE id=$1', [groupId]);
        const senderName = grpRes.rows[0]?.name || 'עסק';
        const targetGroupIds = new Set();

        if (audience === 'community' && communityId) {
            const fgRes = await pool.query("SELECT id FROM family_groups WHERE community_id=$1 AND type='FAMILY'", [communityId]);
            fgRes.rows.forEach(r => targetGroupIds.add(r.id));
        }

        if (audience === 'oneflow_customers' || audience === 'both') {
            const custRes = await pool.query('SELECT phone, email FROM store_customers WHERE group_id=$1', [groupId]);
            const oneflowGids = await resolveOneFlowGroupIds(pool, groupId, custRes.rows);
            oneflowGids.forEach(gid => targetGroupIds.add(gid));
        }

        if (audience === 'employees' || audience === 'both') {
            targetGroupIds.add(parseInt(groupId));
        }

        if (targetGroupIds.size === 0) {
            const errMsg = (audience === 'oneflow_customers' || audience === 'both')
                ? 'לא נמצאו נמענים OneFlow. ודא שלקוחות הזמינו מהחנות דרך OneFlow Life.'
                : 'לא נמצאו נמענים';
            return res.json({ success: false, error: errMsg });
        }

        await pool.query('BEGIN');
        for (const gid of targetGroupIds) {
            await pool.query(
                'INSERT INTO inbox_messages (group_id, sender_type, sender_name, sender_contact, subject, content) VALUES ($1,$2,$3,$4,$5,$6)',
                [gid, 'business', senderName, '', subject, content]
            );
        }
        // שמירת הניוזלטר בהיסטוריה
        await pool.query(
            'INSERT INTO sent_newsletters (group_id, subject, content_html, audience, recipient_count) VALUES ($1,$2,$3,$4,$5)',
            [groupId, subject, content, audience || 'unknown', targetGroupIds.size]
        );
        await pool.query('COMMIT');
        res.json({ success: true, count: targetGroupIds.size });
    } catch(e) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/store/newsletters/:groupId', async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT id, subject, content_html, audience, recipient_count, sent_at FROM sent_newsletters WHERE group_id=$1 ORDER BY sent_at DESC LIMIT 30',
            [req.params.groupId]
        );
        res.json({ success: true, newsletters: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/newsletters/:id', async (req, res) => {
    try { await pool.query('DELETE FROM sent_newsletters WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch(e) { res.status(500).json({ error: e.message }); }
});

// --- פופאפים לחנות הציבורית ---
app.get('/api/store/popups/:groupId', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM store_popups WHERE group_id=$1 ORDER BY created_at DESC', [req.params.groupId]);
        res.json({ success: true, popups: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/popups', async (req, res) => {
    try {
        const { groupId, title, content, imageBase64, scheduledAt, expiresAt, popupType, triggerType, triggerRef } = req.body;
        if (!groupId || !title || !content) return res.status(400).json({ error: 'נתונים חסרים' });
        const r = await pool.query(
            `INSERT INTO store_popups (group_id, title, content, image_base64, scheduled_at, expires_at, popup_type, trigger_type, trigger_ref)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [groupId, title, content, imageBase64||null, scheduledAt||null, expiresAt||null, popupType||'store', triggerType||'none', triggerRef||null]
        );
        res.json({ success: true, popup: r.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/store/popups/:id', async (req, res) => {
    try {
        const { isActive, expiresAt, clearImage, title, content, imageBase64, scheduledAt, triggerType, triggerRef } = req.body;
        const fields = [];
        const vals = [];
        let i = 1;
        if (isActive !== undefined) { fields.push(`is_active=$${i++}`); vals.push(isActive); }
        if (expiresAt !== undefined) { fields.push(`expires_at=$${i++}`); vals.push(expiresAt || null); }
        if (clearImage) { fields.push(`image_base64=$${i++}`); vals.push(null); }
        if (title !== undefined) { fields.push(`title=$${i++}`); vals.push(title); }
        if (content !== undefined) { fields.push(`content=$${i++}`); vals.push(content); }
        if (imageBase64 !== undefined && !clearImage) { fields.push(`image_base64=$${i++}`); vals.push(imageBase64 || null); }
        if (scheduledAt !== undefined) { fields.push(`scheduled_at=$${i++}`); vals.push(scheduledAt || null); }
        if (triggerType !== undefined) { fields.push(`trigger_type=$${i++}`); vals.push(triggerType); }
        if (triggerRef !== undefined) { fields.push(`trigger_ref=$${i++}`); vals.push(triggerRef || null); }
        if (fields.length === 0) return res.json({ success: true });
        vals.push(req.params.id);
        await pool.query(`UPDATE store_popups SET ${fields.join(',')} WHERE id=$${i}`, vals);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store/popups/:id', async (req, res) => {
    try { await pool.query('DELETE FROM store_popups WHERE id=$1', [req.params.id]); res.json({ success: true }); }
    catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/public/store-popups/:groupId', async (req, res) => {
    try {
        await pool.query(`UPDATE store_popups SET image_base64=NULL WHERE group_id=$1 AND expires_at IS NOT NULL AND expires_at < NOW() AND image_base64 IS NOT NULL`, [req.params.groupId]);
        const r = await pool.query(
            `SELECT id, title, content, image_base64, scheduled_at, expires_at
             FROM store_popups
             WHERE group_id=$1 AND is_active=TRUE AND popup_type='store'
               AND (scheduled_at IS NULL OR scheduled_at <= NOW())
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY scheduled_at DESC NULLS LAST
             LIMIT 5`,
            [req.params.groupId]
        );
        res.json({ success: true, popups: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/store/employee-popups/:groupId', async (req, res) => {
    try {
        await pool.query(`UPDATE store_popups SET image_base64=NULL WHERE group_id=$1 AND expires_at IS NOT NULL AND expires_at < NOW() AND image_base64 IS NOT NULL`, [req.params.groupId]);
        const r = await pool.query(
            `SELECT id, title, content, image_base64, scheduled_at, expires_at
             FROM store_popups
             WHERE group_id=$1 AND is_active=TRUE AND popup_type='employee'
               AND trigger_type='none'
               AND (scheduled_at IS NULL OR scheduled_at <= NOW())
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY scheduled_at DESC NULLS LAST
             LIMIT 3`,
            [req.params.groupId]
        );
        res.json({ success: true, popups: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        const quoteId = result.rows[0].id;
        const quoteNumber = `QT-${String(quoteId).padStart(6, '0')}`;
        await pool.query('UPDATE store_orders SET quote_number=$1 WHERE id=$2', [quoteNumber, quoteId]);
        res.json({ success: true, quoteId, quoteNumber });
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
            `UPDATE store_orders SET customer_name=$1, customer_phone=$2, total_amount=$3, notes=$4, items=$5 WHERE id=$6`,
            [customerName, customerPhone, totalAmount, notes, JSON.stringify(items), req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// סיכום עמלות וגביות לעסק (תצוגה עצמית)
app.get('/api/store/commission-summary/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const duesRes = await pool.query(`
            SELECT
                COALESCE(SUM(d.commission_amount), 0) as total_commission,
                COALESCE(SUM(d.order_amount), 0) as total_sales,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', d.created_at) = DATE_TRUNC('month', NOW()) THEN d.commission_amount ELSE 0 END), 0) as month_commission,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', d.created_at) = DATE_TRUNC('month', NOW()) THEN d.order_amount ELSE 0 END), 0) as month_sales
            FROM business_platform_dues d WHERE d.business_id = $1`, [groupId]);
        const collRes = await pool.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_collected,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', collected_at) = DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END), 0) as month_collected
            FROM business_platform_collections WHERE business_id = $1`, [groupId]);
        res.json({ success: true, summary: { ...duesRes.rows[0], ...collRes.rows[0] } });
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
        await pool.query('UPDATE store_orders SET status=$1, status_changed_at=CURRENT_TIMESTAMP WHERE id=$2', [status, orderId]);
        res.json({ success: true });
        if (status === 'delivered' || status === 'completed') triggerCashbackForOrder(orderId);
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
        const uRes = await pool.query('SELECT group_id, phone FROM users WHERE id=$1', [req.params.userId]);
        if (uRes.rows.length === 0) return res.status(404).json({ error: 'משתמש לא נמצא' });
        const { group_id: familyGroupId, phone: userPhone } = uRes.rows[0];

        // שולפים הזמנות לפי family_group_id או לפי phone של המשתמש (קיוסק)
        const orders = await pool.query(`
            SELECT so.*, fg.name as store_name
            FROM store_orders so
            JOIN family_groups fg ON so.group_id = fg.id
            WHERE so.family_group_id = $1
               OR ($2::text IS NOT NULL AND $2::text <> '' AND so.customer_phone = $2::text)
            ORDER BY so.created_at DESC
        `, [familyGroupId, userPhone || null]);

        res.json({ success: true, orders: orders.rows });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});
// --- אישור הצעת מחיר והפיכתה להזמנה במקום ---
app.post('/api/store/quotes/:id/prepare-send', async (req, res) => {
    try {
        const token = require('crypto').randomBytes(24).toString('hex');
        const r = await pool.query('UPDATE store_orders SET confirm_token=$1 WHERE id=$2 RETURNING id', [token, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'הצעה לא נמצאה' });
        const baseUrl = process.env.APP_URL || `https://${req.get('host')}`;
        res.json({ confirmUrl: `${baseUrl}/c/q/${req.params.id}/${token}` });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

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
                SELECT c.name, cb.discount_pct, c.min_families,
                       (SELECT COUNT(*) FROM family_communities WHERE community_id = c.id) as family_count
                FROM community_businesses cb
                JOIN communities c ON cb.community_id = c.id
                WHERE cb.business_id = $1 AND cb.community_id = $2 AND cb.status = 'approved'
            `, [groupId, req.query.communityId]);

            if (commRes.rows.length > 0) {
                const row = commRes.rows[0];
                const minFamilies = parseInt(row.min_families) || 0;
                const familyCount = parseInt(row.family_count) || 0;
                communityData = {
                    name: row.name,
                    discount_pct: row.discount_pct,
                    min_families: minFamilies,
                    family_count: familyCount,
                    discount_active: familyCount >= minFamilies
                };
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

app.post('/api/store/ai-long-desc', async (req, res) => {
    try {
        const { productName, shortDesc, groupId } = req.body;
        const hasTokens = await handleAITokens(groupId);
        if(!hasTokens) return res.json({ success: false, error: 'BATTERY_EMPTY' });
        if (!genAI) throw new Error('GEMINI_API_KEY is not set');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const shortDescHint = shortDesc ? ` (התיאור הקצר הקיים: "${shortDesc}")` : '';
        const prompt = `כתוב תיאור מורחב ומפורט בעברית עבור המוצר/מנה: "${productName}"${shortDescHint}.
התיאור המורחב מיועד לדף המוצר בחנות/מסעדה ועליו לכלול:
- תיאור מפורט של המוצר (מרכיבים, טעמים, מרקם, אפשרויות הגשה)
- יתרונות ונקודות חוזקה
- טיפ או המלצה לצרכן
- שפה שיווקית, חמה ומזמינה
אל תחזור על אותו תוכן שבתיאור הקצר. כתוב 3-5 משפטים. אין להשתמש במרכאות.`;
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
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by_group_id INT`,
        `ALTER TABLE communities ADD COLUMN IF NOT EXISTS min_families INT DEFAULT 30`
    ];

    for (let q of queries) {
        try { await pool.query(q); } catch(e) { console.error("DB Init Warning on query:", q, e.message); }
    }

    // Migration: add existing community founders to family_communities if not already there
    try {
        await pool.query(`
            INSERT INTO family_communities (group_id, community_id)
            SELECT created_by_group_id, id FROM communities
            WHERE created_by_group_id IS NOT NULL
            ON CONFLICT DO NOTHING
        `);
    } catch(e) { console.error("Community founder migration warning:", e.message); }

    // Migration: SA-created communities (no created_by_group_id) have no family threshold
    try {
        await pool.query(`UPDATE communities SET min_families = 0 WHERE created_by_group_id IS NULL`);
    } catch(e) { console.error("Community min_families migration warning:", e.message); }
}
initCommunityTables();

// --- API ליזמות קהילתית (User-led Communities) ---
app.post('/api/community/user-create', async (req, res) => {
    try {
        const { name, city, groupId } = req.body;
        const code = 'C-' + generateGroupCode();
        const result = await pool.query(
            `INSERT INTO communities (name, city, code, created_by_group_id, status, min_families) VALUES ($1, $2, $3, $4, 'pending', 30) RETURNING *`,
            [name, city, code, groupId]
        );
        const commId = result.rows[0].id;
        // Auto-join creator to their own community so they can see businesses in it
        await pool.query(
            'INSERT INTO family_communities (group_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [groupId, commId]
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
        const familiesRes = await pool.query(`
            SELECT f.id, f.name, f.admin_email, f.group_code, fc.is_community_manager
            FROM family_communities fc
            JOIN family_groups f ON fc.group_id = f.id
            WHERE fc.community_id = $1 AND f.type = 'FAMILY'
        `, [req.params.id]);
        const families = familiesRes.rows;

        if (families.length > 0) {
            const familyIds = families.map(f => f.id);
            const usersRes = await pool.query('SELECT id, group_id, nickname, role FROM users WHERE group_id = ANY($1)', [familyIds]);
            families.forEach(f => {
                f.users = usersRes.rows.filter(u => u.group_id === f.id);
                f.is_community_manager = f.is_community_manager === true; // normalize null → false
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
            // 1. שמירה במסד הנתונים — INSERT ראשי ללא תלות בעמודות אופציונליות
            const result = await dbClient.query(`
                INSERT INTO purchase_orders (group_id, created_by, supplier_id, items, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, 'sent') RETURNING id
            `, [groupId, userId, order.supplierId, JSON.stringify(order.items), order.totalAmount]);

            const newOrderId = result.rows[0].id;

            // 1b. אסימון אישור — UPDATE נפרד כדי שכשל כאן לא יפיל את ההזמנה
            let poConfirmUrl = '';
            try {
                const poToken = require('crypto').randomBytes(24).toString('hex');
                await dbClient.query('UPDATE purchase_orders SET confirm_token=$1 WHERE id=$2', [poToken, newOrderId]);
                const baseUrl = process.env.APP_URL || `https://${req.get('host')}`;
                poConfirmUrl = `${baseUrl}/c/po/${newOrderId}/${poToken}`;
            } catch(tokenErr) { console.warn('confirm_token update skipped:', tokenErr.message); }

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
                            <div style="margin: 20px 0; text-align: center;">
                                <a href="${poConfirmUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:15px;text-decoration:none;">✅ אשר קבלת הזמנה</a>
                                <p style="font-size:11px;color:#94a3b8;margin-top:8px;">לחיצה תסמן אוטומטית שהמסמך התקבל אצלכם</p>
                            </div>
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
            SELECT DISTINCT c.id, c.name, c.city, c.image_url, c.code, c.min_families,
                   (SELECT COUNT(*) FROM family_communities WHERE community_id = c.id) as family_count
            FROM communities c
            WHERE c.id IN (
                SELECT community_id FROM family_communities WHERE group_id = $1
                UNION
                SELECT id FROM communities WHERE created_by_group_id = $1
            )
        `, [req.params.groupId]);

        if(commsRes.rows.length === 0) return res.json({ success: true, communities: [], businesses: [] });

        const commIds = commsRes.rows.map(c => c.id);
        const bizRes = await pool.query(`
            SELECT cb.community_id, cb.discount_pct, b.name as business_name, b.group_code, c.name as comm_name,
                   c.min_families, (SELECT COUNT(*) FROM family_communities WHERE community_id = c.id) as family_count
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

// duplicate removed — see /api/sa/communities/:id/details above
// ============================================================
// --- COMMUNITY CASHBACK SYSTEM ENDPOINTS ---
// ============================================================

// פונקציה פנימית: טריגר קאשבק כאשר הזמנה מסומנת כ-delivered
async function triggerCashbackForOrder(orderId) {
    try {
        // מצא את הקהילה המשותפת: המשפחה שהזמינה (family_communities) + העסק שמכר (community_businesses)
        const orderRes = await pool.query(
            `SELECT so.group_id, so.family_group_id, so.total_amount,
                    fc.community_id
             FROM store_orders so
             JOIN family_communities fc ON fc.group_id = so.family_group_id
             JOIN community_businesses cb ON cb.community_id = fc.community_id
                  AND cb.business_id = so.group_id AND cb.status = 'approved'
             WHERE so.id = $1 AND so.status IN ('delivered','completed')
             LIMIT 1`, [orderId]);

        if (!orderRes.rows.length) {
            console.log(`Cashback: no matching community for order ${orderId} (family not in same community as business, or order not delivered)`);
            return;
        }
        const order = orderRes.rows[0];

        // בדיקה שלא כבר טופל
        const existing = await pool.query('SELECT id FROM business_platform_dues WHERE order_id=$1', [orderId]);
        if (existing.rows.length) return;

        const commPct = parseFloat((await pool.query("SELECT value FROM system_settings WHERE key='platform_commission_pct'")).rows[0]?.value || 3);
        const cashbackPct = parseFloat((await pool.query("SELECT value FROM system_settings WHERE key='community_cashback_pct'")).rows[0]?.value || 30);
        const amount = parseFloat(order.total_amount || 0);
        const commAmount = parseFloat((amount * commPct / 100).toFixed(2));
        const cashbackAmount = parseFloat((commAmount * cashbackPct / 100).toFixed(2));

        await pool.query(`INSERT INTO business_platform_dues
            (business_id, order_id, order_amount, commission_pct, commission_amount, cashback_pct, cashback_amount, community_id, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
            [order.group_id, orderId, amount, commPct, commAmount, cashbackPct, cashbackAmount, order.community_id]);

        if (cashbackAmount > 0) {
            await pool.query(`INSERT INTO community_wallets (community_id, balance, total_earned, updated_at)
                VALUES ($1,$2,$2,NOW())
                ON CONFLICT (community_id) DO UPDATE SET
                balance = community_wallets.balance + $2,
                total_earned = community_wallets.total_earned + $2,
                updated_at = NOW()`, [order.community_id, cashbackAmount]);
            await pool.query(`INSERT INTO community_wallet_transactions (community_id, amount, type, reference_id, description)
                VALUES ($1,$2,'cashback',$3,$4)`,
                [order.community_id, cashbackAmount, orderId, `קאשבק מהזמנה #${orderId} על סך ₪${amount}`]);
        }
        // עמלת מנהל אזור: אם הקהילה שייכת לאזור, הפרש % מהעמלה
        try {
            const zoneRes = await pool.query(`
                SELECT mz.id as zone_id, zm.id as manager_id, zm.commission_pct
                FROM communities c
                JOIN manager_zones mz ON c.zone_id=mz.id
                JOIN zone_managers zm ON mz.manager_id=zm.id AND zm.status='active'
                WHERE c.id=$1`, [order.community_id]);
            if (zoneRes.rows.length) {
                const zm = zoneRes.rows[0];
                const zmCommPct = parseFloat(zm.commission_pct || (await pool.query("SELECT value FROM system_settings WHERE key='zone_manager_commission_pct'")).rows[0]?.value || 5);
                const zmAmount = parseFloat((commAmount * zmCommPct / 100).toFixed(2));
                if (zmAmount > 0) {
                    await pool.query(`INSERT INTO zone_manager_commissions (manager_id, community_id, order_id, amount, commission_pct, description) VALUES ($1,$2,$3,$4,$5,$6)`,
                        [zm.manager_id, order.community_id, orderId, zmAmount, zmCommPct, `עמלה מהזמנה #${orderId} בקהילה`]);
                }
            }
        } catch(zmErr) { console.error('Zone manager commission error:', zmErr.message); }

        console.log(`Cashback triggered: order ${orderId}, community ${order.community_id}, cashback ₪${cashbackAmount}`);
    } catch(e) { console.error('Cashback trigger error:', e.message); }
}

// הגדרת אחוזי עמלה וקאשבק (סופר אדמין)
app.get('/api/sa/settings/rates', verifySA, async (req, res) => {
    try {
        const result = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('platform_commission_pct','community_cashback_pct')");
        const rates = {};
        result.rows.forEach(r => { rates[r.key] = parseFloat(r.value); });
        res.json({ success: true, platform_commission_pct: rates.platform_commission_pct || 3, community_cashback_pct: rates.community_cashback_pct || 30 });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/settings/rates', verifySA, async (req, res) => {
    try {
        const { platform_commission_pct, community_cashback_pct } = req.body;
        if (platform_commission_pct !== undefined) {
            await pool.query("INSERT INTO system_settings (key,value) VALUES ('platform_commission_pct',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [String(platform_commission_pct)]);
        }
        if (community_cashback_pct !== undefined) {
            await pool.query("INSERT INTO system_settings (key,value) VALUES ('community_cashback_pct',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [String(community_cashback_pct)]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הגדרת מנהל קהילה (סופר אדמין)
app.put('/api/sa/communities/:commId/set-manager', verifySA, async (req, res) => {
    try {
        const { groupId, isManager } = req.body;
        const { commId } = req.params;
        await pool.query(
            `UPDATE family_communities SET is_community_manager=$1 WHERE group_id=$2 AND community_id=$3`,
            [!!isManager, groupId, commId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// סיכום פיננסי גלובלי (סופר אדמין)
app.get('/api/sa/finance-summary', verifySA, async (req, res) => {
    try {
        const duesRes = await pool.query(`
            SELECT
                COALESCE(SUM(commission_amount), 0) as total_commission,
                COALESCE(SUM(cashback_amount), 0) as total_cashback,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) THEN commission_amount ELSE 0 END), 0) as month_commission,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) THEN cashback_amount ELSE 0 END), 0) as month_cashback
            FROM business_platform_dues
        `);
        const collRes = await pool.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_collected,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', collected_at) = DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END), 0) as month_collected
            FROM business_platform_collections
        `);
        res.json({ success: true, summary: { ...duesRes.rows[0], ...collRes.rows[0] } });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// חובות עסקים לפלטפורמה (סופר אדמין)
app.get('/api/sa/business-dues', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT fg.id as business_id, fg.name as business_name, fg.group_code,
                COUNT(d.id) as order_count,
                SUM(d.order_amount) as total_sales,
                SUM(d.commission_amount) as total_commission,
                SUM(d.cashback_amount) as total_cashback,
                SUM(CASE WHEN d.status='pending' THEN d.commission_amount ELSE 0 END) as pending_commission,
                COALESCE((SELECT SUM(c.amount) FROM business_platform_collections c WHERE c.business_id=fg.id), 0) as total_collected
            FROM business_platform_dues d
            JOIN family_groups fg ON d.business_id = fg.id
            GROUP BY fg.id, fg.name, fg.group_code
            ORDER BY total_commission DESC
        `);
        res.json({ success: true, dues: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// רישום גביה מעסק
app.post('/api/sa/business-collections', verifySA, async (req, res) => {
    try {
        const { business_id, amount, collected_at, notes } = req.body;
        if (!business_id || !amount) return res.status(400).json({ error: 'חסרים שדות חובה' });
        await pool.query(
            `INSERT INTO business_platform_collections (business_id, amount, collected_at, notes, created_by) VALUES ($1,$2,$3,$4,$5)`,
            [business_id, parseFloat(amount), collected_at || new Date().toISOString().split('T')[0], notes || null, req.saUser?.name || 'SA']
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// היסטוריית גביות לעסק
app.get('/api/sa/business-collections/:businessId', verifySA, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT bpc.*, fg.name as business_name FROM business_platform_collections bpc
             JOIN family_groups fg ON bpc.business_id=fg.id
             WHERE bpc.business_id=$1 ORDER BY bpc.collected_at DESC`,
            [req.params.businessId]
        );
        res.json({ success: true, collections: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// יתרות ארנקי קהילות (סופר אדמין)
app.get('/api/sa/community-wallets', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.name, c.city,
                COALESCE(w.balance, 0) as balance,
                COALESCE(w.total_earned, 0) as total_earned,
                w.updated_at,
                (SELECT COUNT(*) FROM family_communities WHERE community_id=c.id) as family_count
            FROM communities c
            LEFT JOIN community_wallets w ON w.community_id = c.id
            ORDER BY COALESCE(w.total_earned,0) DESC
        `);
        res.json({ success: true, wallets: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- ZONE MANAGER SYSTEM ---
// ============================================================

// לוגין מנהל אזור
// הרשמה למנהל אזור (ממתין לאישור SA)
app.post('/api/zone-manager/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'שם, אימייל וסיסמה הם שדות חובה' });
        const existing = await pool.query('SELECT id,status FROM zone_managers WHERE email=$1', [email]);
        if (existing.rows.length) {
            const s = existing.rows[0].status;
            if (s === 'pending') return res.status(400).json({ error: 'בקשת הרשמה כבר קיימת ומחכה לאישור' });
            if (s === 'active') return res.status(400).json({ error: 'כתובת מייל זו כבר רשומה ופעילה במערכת' });
            return res.status(400).json({ error: 'כתובת מייל זו כבר רשומה' });
        }
        await pool.query(`INSERT INTO zone_managers (name, email, phone, password_hash, status, commission_pct) VALUES ($1,$2,$3,$4,'pending',5)`, [name, email, phone || null, password]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שכחתי סיסמה — שליחת לינק לאימייל
app.post('/api/zone-manager/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'נדרשת כתובת מייל' });
        const result = await pool.query("SELECT id, name, email FROM zone_managers WHERE LOWER(email)=LOWER($1) AND status='active'", [email]);
        // לא חושפים אם המייל קיים
        if (result.rows.length) {
            const mgr = result.rows[0];
            const token = `ZMR_${mgr.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            zmPasswordResets.set(token, { managerId: mgr.id, email: mgr.email, expires: Date.now() + 60 * 60 * 1000 });
            const host = req.get('host');
            const proto = req.headers['x-forwarded-proto'] || req.protocol;
            const resetUrl = `${proto}://${host}/zone-manager.html?reset=${token}`;
            const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:16px">
                <h2 style="color:#4f46e5;margin-bottom:8px">איפוס סיסמה — OneFlow</h2>
                <p style="color:#334155">שלום <strong>${mgr.name}</strong>,</p>
                <p style="color:#334155">קיבלנו בקשה לאיפוס הסיסמה לחשבון מנהל האזור שלך.</p>
                <p style="margin:24px 0"><a href="${resetUrl}" style="background:#4f46e5;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">לאיפוס הסיסמה — לחץ כאן</a></p>
                <p style="color:#94a3b8;font-size:12px">הקישור תקף לשעה אחת. אם לא ביקשת איפוס סיסמה, ניתן להתעלם ממייל זה.</p>
            </div>`;
            await sendSystemEmail(mgr.email, 'איפוס סיסמה — OneFlow Zone Manager', html);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// איפוס סיסמה — ולידציה ועדכון
app.post('/api/zone-manager/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password || password.length < 6) return res.status(400).json({ error: 'טוקן או סיסמה לא תקינים' });
        const reset = zmPasswordResets.get(token);
        if (!reset || reset.expires < Date.now()) return res.status(400).json({ error: 'הקישור לא תקף או שפג תוקפו — בקש קישור חדש' });
        await pool.query("UPDATE zone_managers SET password_hash=$1 WHERE id=$2", [password, reset.managerId]);
        zmPasswordResets.delete(token);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM zone_managers WHERE email=$1 AND password_hash=$2 AND status=$3', [email, password, 'active']);
        if (!result.rows.length) return res.status(401).json({ error: 'פרטי גישה שגויים' });
        const mgr = result.rows[0];
        const token = `ZM_${mgr.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        zoneManagerSessions.set(token, { managerId: mgr.id, name: mgr.name, email: mgr.email });
        res.json({ success: true, token, manager: { id: mgr.id, name: mgr.name, email: mgr.email, commission_pct: mgr.commission_pct } });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// דשבורד מנהל אזור
app.get('/api/zone-manager/dashboard', verifyZoneManager, async (req, res) => {
    try {
        const { managerId } = req.zmSession;
        // אזורים + קהילות
        const zonesRes = await pool.query(`
            SELECT mz.id, mz.name, mz.status,
                COUNT(c.id) as community_count,
                COALESCE(SUM((SELECT COUNT(*) FROM family_communities WHERE community_id=c.id)),0) as family_count,
                COALESCE(SUM((SELECT COUNT(*) FROM community_businesses WHERE community_id=c.id AND status='approved')),0) as business_count
            FROM manager_zones mz
            LEFT JOIN communities c ON c.zone_id = mz.id
            WHERE mz.manager_id=$1
            GROUP BY mz.id, mz.name, mz.status
            ORDER BY mz.created_at`, [managerId]);

        const commRes = await pool.query(`
            SELECT c.id, c.name, c.city, c.zone_id, mz.name as zone_name,
                (SELECT COUNT(*) FROM family_communities WHERE community_id=c.id) as family_count,
                (SELECT COUNT(*) FROM community_businesses WHERE community_id=c.id AND status='approved') as business_count,
                (SELECT fc2.is_community_manager FROM family_communities fc2 WHERE fc2.community_id=c.id AND fc2.is_community_manager=TRUE LIMIT 1) as has_local_manager
            FROM communities c
            JOIN manager_zones mz ON c.zone_id = mz.id
            WHERE mz.manager_id=$1
            ORDER BY mz.id, c.name`, [managerId]);

        // עמלות
        const settings = await pool.query("SELECT key,value FROM system_settings WHERE key IN ('zone_min_communities','zone_max_zones_per_manager','community_min_families','community_min_businesses')");
        const s = {}; settings.rows.forEach(r => { s[r.key] = parseFloat(r.value); });

        const [commissionsRes, paidRes] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(amount),0) as total, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',created_at)=DATE_TRUNC('month',NOW()) THEN amount ELSE 0 END),0) as month FROM zone_manager_commissions WHERE manager_id=$1`, [managerId]),
            pool.query(`SELECT COALESCE(SUM(amount),0) as total_paid, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',paid_at)=DATE_TRUNC('month',NOW()) THEN amount ELSE 0 END),0) as month_paid FROM zone_manager_payments WHERE manager_id=$1`, [managerId])
        ]);
        res.json({ success: true, zones: zonesRes.rows, communities: commRes.rows, commissions: { ...commissionsRes.rows[0], ...paidRes.rows[0] }, settings: s });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// היסטוריית עמלות מנהל אזור
app.get('/api/zone-manager/commissions', verifyZoneManager, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT zmc.*, c.name as community_name FROM zone_manager_commissions zmc
            LEFT JOIN communities c ON zmc.community_id=c.id
            WHERE zmc.manager_id=$1 ORDER BY zmc.created_at DESC LIMIT 100`, [req.zmSession.managerId]);
        res.json({ success: true, commissions: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — רשימת מנהלי אזורים (פעילים ומושהים)
app.get('/api/sa/zone-managers', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT zm.*,
                (SELECT COUNT(*) FROM manager_zones WHERE manager_id=zm.id) as zone_count,
                (SELECT COUNT(*) FROM manager_zones mz JOIN communities c ON c.zone_id=mz.id WHERE mz.manager_id=zm.id) as community_count,
                (SELECT COALESCE(SUM(amount),0) FROM zone_manager_commissions WHERE manager_id=zm.id) as total_commissions,
                (SELECT COALESCE(SUM(amount),0) FROM zone_manager_payments WHERE manager_id=zm.id) as total_paid,
                (SELECT COALESCE(SUM(amount),0) FROM zone_manager_payments WHERE manager_id=zm.id AND DATE_TRUNC('month',paid_at)=DATE_TRUNC('month',NOW())) as month_paid
            FROM zone_managers zm WHERE zm.status != 'pending' ORDER BY zm.created_at DESC`);
        res.json({ success: true, managers: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — סיכום פיננסי של מנהלי אזורים (עמלות + תשלומים)
app.get('/api/sa/zone-managers/finance-summary', verifySA, async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT
                COALESCE(SUM(c.amount), 0)                                                                          AS total_earned,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', NOW()) THEN c.amount ELSE 0 END), 0) AS month_earned,
                COALESCE((SELECT SUM(amount) FROM zone_manager_payments), 0)                                        AS total_paid,
                COALESCE((SELECT SUM(amount) FROM zone_manager_payments WHERE DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())), 0) AS month_paid
            FROM zone_manager_commissions c
        `);
        const s = r.rows[0];
        const totalDebt = parseFloat(s.total_earned) - parseFloat(s.total_paid);
        const monthDebt = parseFloat(s.month_earned) - parseFloat(s.month_paid);
        res.json({ success: true, summary: {
            total_earned:  parseFloat(s.total_earned),
            month_earned:  parseFloat(s.month_earned),
            total_paid:    parseFloat(s.total_paid),
            month_paid:    parseFloat(s.month_paid),
            total_debt:    Math.max(0, totalDebt),
            month_debt:    Math.max(0, monthDebt)
        }});
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — סטטיסטיקות קמפיינים
app.get('/api/sa/campaigns/stats', verifySA, async (req, res) => {
    try {
        const r = await pool.query(`SELECT COUNT(*) FILTER (WHERE status='active') as active_campaigns, COUNT(*) as total_campaigns FROM zm_campaigns`);
        res.json({ success: true, active_campaigns: parseInt(r.rows[0].active_campaigns)||0, total_campaigns: parseInt(r.rows[0].total_campaigns)||0 });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — סטטיסטיקות לידים
app.get('/api/sa/leads/stats', verifySA, async (req, res) => {
    try {
        const r = await pool.query(`SELECT COUNT(*) as total_leads FROM zm_campaign_leads`);
        res.json({ success: true, total_leads: parseInt(r.rows[0].total_leads)||0 });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — רשימת בקשות הרשמה ממתינות
app.get('/api/sa/zone-managers/pending', verifySA, async (req, res) => {
    try {
        const result = await pool.query("SELECT id,name,email,phone,created_at FROM zone_managers WHERE status='pending' ORDER BY created_at DESC");
        res.json({ success: true, pending: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — רשימת כל האזורים (לטרנספר)
app.get('/api/sa/all-zones', verifySA, async (req, res) => {
    try {
        const result = await pool.query(`SELECT mz.id, mz.name, zm.name as manager_name, zm.id as manager_id FROM manager_zones mz JOIN zone_managers zm ON mz.manager_id=zm.id WHERE zm.status='active' ORDER BY zm.name, mz.name`);
        res.json({ success: true, zones: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — תשלום עמלה למנהל אזור
app.post('/api/sa/zone-manager-payments', verifySA, async (req, res) => {
    try {
        const { manager_id, amount, payment_method, notes, paid_at } = req.body;
        if (!manager_id || !amount) return res.status(400).json({ error: 'חסרים שדות חובה' });
        await pool.query(`INSERT INTO zone_manager_payments (manager_id, amount, payment_method, notes, paid_at, recorded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
            [manager_id, amount, payment_method || null, notes || null, paid_at || new Date(), req.saUser?.name || 'SA']);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — היסטוריית תשלומים למנהל
app.get('/api/sa/zone-manager-payments/:id', verifySA, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zone_manager_payments WHERE manager_id=$1 ORDER BY paid_at DESC', [req.params.id]);
        res.json({ success: true, payments: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — יצירת מנהל אזור
app.post('/api/sa/zone-managers', verifySA, async (req, res) => {
    try {
        const { name, email, phone, password, commission_pct, notes } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'חסרים שדות חובה' });
        const result = await pool.query(
            `INSERT INTO zone_managers (name, email, phone, password_hash, commission_pct, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [name, email, phone || null, password, commission_pct || 5, notes || null]);
        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — עדכון מנהל אזור
app.put('/api/sa/zone-managers/:id', verifySA, async (req, res) => {
    try {
        const { name, email, phone, password, commission_pct, notes, status } = req.body;
        const sets = [], vals = [];
        const add = (col, v) => { sets.push(`${col}=$${sets.length+1}`); vals.push(v); };
        if (name !== undefined) add('name', name);
        if (email !== undefined) add('email', email);
        if (phone !== undefined) add('phone', phone);
        if (commission_pct !== undefined) add('commission_pct', commission_pct);
        if (notes !== undefined) add('notes', notes);
        if (status !== undefined) add('status', status);
        if (password) add('password_hash', password);
        if (!sets.length) return res.json({ success: true });
        vals.push(req.params.id);
        await pool.query(`UPDATE zone_managers SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — מחיקת מנהל אזור
app.delete('/api/sa/zone-managers/:id', verifySA, async (req, res) => {
    try {
        await pool.query('DELETE FROM zone_managers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — יצירת אזור למנהל
app.post('/api/sa/zone-managers/:id/zones', verifySA, async (req, res) => {
    try {
        const { name } = req.body;
        const maxZones = parseFloat((await pool.query("SELECT value FROM system_settings WHERE key='zone_max_zones_per_manager'")).rows[0]?.value || 4);
        const existing = await pool.query('SELECT COUNT(*) FROM manager_zones WHERE manager_id=$1', [req.params.id]);
        if (parseInt(existing.rows[0].count) >= maxZones) return res.status(400).json({ error: `מנהל יכול להחזיק עד ${maxZones} אזורים` });
        const result = await pool.query('INSERT INTO manager_zones (manager_id, name) VALUES ($1,$2) RETURNING id', [req.params.id, name]);
        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — שיוך קהילה לאזור
app.put('/api/sa/communities/:id/assign-zone', verifySA, async (req, res) => {
    try {
        const { zone_id } = req.body;
        await pool.query('UPDATE communities SET zone_id=$1 WHERE id=$2', [zone_id || null, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — הגדרות פרמטרי סף
app.get('/api/sa/zone-settings', verifySA, async (req, res) => {
    try {
        const keys = ['zone_min_communities','zone_max_zones_per_manager','zone_manager_commission_pct','community_min_families','community_min_businesses'];
        const result = await pool.query("SELECT key,value FROM system_settings WHERE key=ANY($1)", [keys]);
        const defaults = { zone_min_communities: 5, zone_max_zones_per_manager: 4, zone_manager_commission_pct: 5, community_min_families: 30, community_min_businesses: 15 };
        const s = { ...defaults };
        result.rows.forEach(r => { s[r.key] = parseFloat(r.value); });
        res.json({ success: true, settings: s });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/zone-settings', verifySA, async (req, res) => {
    try {
        const keys = ['zone_min_communities','zone_max_zones_per_manager','zone_manager_commission_pct','community_min_families','community_min_businesses'];
        for (const key of keys) {
            if (req.body[key] !== undefined) {
                await pool.query("INSERT INTO system_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2", [key, String(req.body[key])]);
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// SA — אזורים וקהילות של מנהל ספציפי
app.get('/api/sa/zone-managers/:id/details', verifySA, async (req, res) => {
    try {
        const [mgrRes, zonesRes, commRes, commissionsRes] = await Promise.all([
            pool.query('SELECT id,name,email,phone,commission_pct,status,created_at FROM zone_managers WHERE id=$1', [req.params.id]),
            pool.query(`SELECT mz.*, COUNT(c.id) as community_count FROM manager_zones mz LEFT JOIN communities c ON c.zone_id=mz.id WHERE mz.manager_id=$1 GROUP BY mz.id ORDER BY mz.created_at`, [req.params.id]),
            pool.query(`SELECT c.id, c.name, c.city, c.zone_id, mz.name as zone_name,
                (SELECT COUNT(*) FROM family_communities WHERE community_id=c.id) as family_count,
                (SELECT COUNT(*) FROM community_businesses WHERE community_id=c.id AND status='approved') as business_count
                FROM communities c JOIN manager_zones mz ON c.zone_id=mz.id WHERE mz.manager_id=$1`, [req.params.id]),
            pool.query(`SELECT zmc.*, c.name as community_name FROM zone_manager_commissions zmc LEFT JOIN communities c ON zmc.community_id=c.id WHERE zmc.manager_id=$1 ORDER BY zmc.created_at DESC LIMIT 50`, [req.params.id])
        ]);
        if (!mgrRes.rows.length) return res.status(404).json({ error: 'לא נמצא' });
        res.json({ success: true, manager: mgrRes.rows[0], zones: zonesRes.rows, communities: commRes.rows, commissions: commissionsRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// --- ZONE MANAGER: MARKETING, CAMPAIGNS, LEADS, INBOX, TEMPLATES ---
// ============================================================

// חיפוש קהילות + משפחות לצורך מינוי מנהל קהילה (ע"י מנהל אזור)
app.get('/api/zone-manager/communities-members', verifyZoneManager, async (req, res) => {
    try {
        const { managerId } = req.zmSession;
        const { communityId, q } = req.query;
        if (!communityId) return res.status(400).json({ error: 'חסר communityId' });
        const zoneCheck = await pool.query(
            `SELECT c.id FROM communities c JOIN manager_zones mz ON c.zone_id=mz.id WHERE c.id=$1 AND mz.manager_id=$2`,
            [communityId, managerId]);
        if (!zoneCheck.rows.length) return res.status(403).json({ error: 'קהילה לא שייכת לאזור שלך' });
        const search = q ? `%${q}%` : '%';
        const result = await pool.query(
            `SELECT fc.group_id, fg.name, fg.admin_email, fc.is_community_manager
             FROM family_communities fc
             JOIN family_groups fg ON fg.id=fc.group_id
             WHERE fc.community_id=$1 AND (fg.name ILIKE $2 OR fg.admin_email ILIKE $2)
             ORDER BY fc.is_community_manager DESC, fg.name LIMIT 30`,
            [communityId, search]);
        res.json({ success: true, members: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מינוי/הסרת מנהל קהילה ע"י מנהל אזור (משפיע על אותו שדה ש-SA משתמש בו)
app.post('/api/zone-manager/set-community-manager', verifyZoneManager, async (req, res) => {
    try {
        const { managerId } = req.zmSession;
        const { groupId, communityId, isManager } = req.body;
        if (!groupId || !communityId) return res.status(400).json({ error: 'חסרים שדות חובה' });
        const zoneCheck = await pool.query(
            `SELECT c.id FROM communities c JOIN manager_zones mz ON c.zone_id=mz.id WHERE c.id=$1 AND mz.manager_id=$2`,
            [communityId, managerId]);
        if (!zoneCheck.rows.length) return res.status(403).json({ error: 'קהילה לא שייכת לאזור שלך' });
        await pool.query(
            `UPDATE family_communities SET is_community_manager=$1 WHERE group_id=$2 AND community_id=$3`,
            [!!isManager, groupId, communityId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- CAMPAIGNS ---
app.get('/api/zone-manager/campaigns', verifyZoneManager, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, (SELECT COUNT(*) FROM zm_campaign_leads WHERE campaign_id=c.id) as lead_count
             FROM zm_campaigns c WHERE zone_manager_id=$1 ORDER BY created_at DESC`,
            [req.zmSession.managerId]);
        res.json({ success: true, campaigns: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/campaigns', verifyZoneManager, async (req, res) => {
    try {
        const { title, subtitle, text_content, fields_config, campaign_type, image_url } = req.body;
        if (!title) return res.status(400).json({ error: 'כותרת הקמפיין חובה' });
        const token = `CAMP_${req.zmSession.managerId}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        const result = await pool.query(
            `INSERT INTO zm_campaigns (zone_manager_id, title, subtitle, text_content, fields_config, token, campaign_type, image_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [req.zmSession.managerId, title, subtitle || null, text_content || null,
             JSON.stringify(fields_config || []), token, campaign_type || 'general', image_url || null]);
        res.json({ success: true, campaign: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/zone-manager/campaigns/:id', verifyZoneManager, async (req, res) => {
    try {
        const { title, subtitle, text_content, fields_config, status, campaign_type, image_url } = req.body;
        const sets = [], vals = [];
        const add = (col, v) => { sets.push(`${col}=$${sets.length+1}`); vals.push(v); };
        if (title !== undefined) add('title', title);
        if (subtitle !== undefined) add('subtitle', subtitle);
        if (text_content !== undefined) add('text_content', text_content);
        if (fields_config !== undefined) add('fields_config', JSON.stringify(fields_config));
        if (status !== undefined) add('status', status);
        if (campaign_type !== undefined) add('campaign_type', campaign_type);
        if (image_url !== undefined) add('image_url', image_url);
        if (!sets.length) return res.json({ success: true });
        add('updated_at', new Date());
        vals.push(req.params.id, req.zmSession.managerId);
        await pool.query(`UPDATE zm_campaigns SET ${sets.join(',')} WHERE id=$${vals.length-1} AND zone_manager_id=$${vals.length}`, vals);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/zone-manager/campaigns/:id', verifyZoneManager, async (req, res) => {
    try {
        await pool.query('DELETE FROM zm_campaigns WHERE id=$1 AND zone_manager_id=$2', [req.params.id, req.zmSession.managerId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/zone-manager/campaigns/:id/leads', verifyZoneManager, async (req, res) => {
    try {
        const camp = await pool.query('SELECT id FROM zm_campaigns WHERE id=$1 AND zone_manager_id=$2', [req.params.id, req.zmSession.managerId]);
        if (!camp.rows.length) return res.status(404).json({ error: 'קמפיין לא נמצא' });
        const result = await pool.query('SELECT * FROM zm_campaign_leads WHERE campaign_id=$1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, leads: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// דף נחיתה ציבורי — קבלת הגדרות קמפיין
app.get('/api/public/campaign/:token', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.title, c.subtitle, c.text_content, c.fields_config, c.image_url, zm.name as manager_name
             FROM zm_campaigns c JOIN zone_managers zm ON zm.id=c.zone_manager_id
             WHERE c.token=$1 AND c.status='active'`, [req.params.token]);
        if (!result.rows.length) return res.status(404).json({ error: 'קמפיין לא נמצא או לא פעיל' });
        res.json({ success: true, campaign: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הגשת טופס לינק ציבורי
app.post('/api/public/campaign/:token/submit', async (req, res) => {
    try {
        const campRes = await pool.query('SELECT id, campaign_type FROM zm_campaigns WHERE token=$1 AND status=$2', [req.params.token, 'active']);
        if (!campRes.rows.length) return res.status(404).json({ error: 'קמפיין לא נמצא' });
        const body = req.body || {};
        const leadType = body.lead_type || 'unknown';
        delete body.lead_type;
        const campType = campRes.rows[0].campaign_type;
        const inferredType = leadType !== 'unknown' ? leadType : (campType === 'business' ? 'business' : campType === 'family' ? 'family' : 'unknown');
        await pool.query('INSERT INTO zm_campaign_leads (campaign_id, data, lead_type) VALUES ($1,$2,$3)', [campRes.rows[0].id, JSON.stringify(body), inferredType]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- LEAD CRM: עדכון סטטוס/נוטות ---
app.put('/api/zone-manager/leads/:id', verifyZoneManager, async (req, res) => {
    try {
        const { status, crm_notes, lead_type } = req.body;
        const sets = [], vals = [];
        const add = (col, v) => { sets.push(`${col}=$${sets.length+1}`); vals.push(v); };
        if (status !== undefined) add('status', status);
        if (crm_notes !== undefined) add('crm_notes', crm_notes);
        if (lead_type !== undefined) add('lead_type', lead_type);
        if (!sets.length) return res.json({ success: true });
        vals.push(req.params.id);
        await pool.query(`UPDATE zm_campaign_leads SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- LEAD CRM: פעולות / לוג ---
app.get('/api/zone-manager/leads/:id/actions', verifyZoneManager, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zm_lead_actions WHERE lead_id=$1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, actions: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/leads/:id/actions', verifyZoneManager, async (req, res) => {
    try {
        const { action_type, notes } = req.body;
        if (!action_type) return res.status(400).json({ error: 'סוג פעולה חובה' });
        await pool.query('INSERT INTO zm_lead_actions (lead_id, action_type, notes) VALUES ($1,$2,$3)', [req.params.id, action_type, notes || null]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AI: יצירת באנר (SVG via text model — works with any Gemini API key) ---
app.post('/api/zone-manager/ai/generate-banner', verifyZoneManager, async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'AI לא זמין' });
        const { title, campaignType } = req.body;
        const palette = campaignType === 'business'
            ? { c1: '#1e3a8a', c2: '#2563eb', c3: '#0ea5e9', accent: '#38bdf8' }
            : campaignType === 'family'
            ? { c1: '#4f46e5', c2: '#7c3aed', c3: '#db2777', accent: '#f472b6' }
            : { c1: '#064e3b', c2: '#059669', c3: '#10b981', accent: '#34d399' };
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Generate a beautiful SVG marketing banner. Output ONLY valid SVG code, nothing else.
Dimensions: width="1600" height="900". No text, no letters, no numbers.
Use colors: ${palette.c1}, ${palette.c2}, ${palette.c3}, ${palette.accent}.
Include: a gradient background (linearGradient from ${palette.c1} to ${palette.c2}),
8-12 semi-transparent decorative shapes (circles, ellipses, rectangles, polygons) with opacity between 0.08 and 0.35,
abstract modern geometric design, layered depth effect.
Start the response with: <svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
End with: </svg>`;
        let result;
        try {
            result = await model.generateContent(prompt);
        } catch(e) {
            const fallback = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            result = await fallback.generateContent(prompt);
        }
        const raw = result.response.text().trim();
        const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
        if (!match) throw new Error('SVG לא נוצר');
        const svgData = match[0];
        const b64 = Buffer.from(svgData).toString('base64');
        res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${b64}` });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AI: ניסוח טקסט קמפיין ---
app.post('/api/zone-manager/ai/draft-campaign', verifyZoneManager, async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'AI לא זמין' });
        const { goal, audience, tone, campaignType, modules } = req.body;
        const modelName = 'gemini-2.5-flash';
        const fallbackModelName = 'gemini-1.5-flash';
        let model = genAI.getGenerativeModel({ model: modelName });
        const typeContexts = {
            business: `מנהל אזור משווק לבעלי עסקים מקומיים את פלטפורמת OneFlow כמערכת ניהול עסקי.
OneFlow מציעה לעסק: מערכת קופה (POS), ניהול מלאי, חשבוניות, ניהול לקוחות (CRM), כלי שיווק, ניהול נוכחות ומשמרות, ניהול משלוחים, תזרים ותקציב — הכל במקום אחד.
המטרה: לשכנע את בעל העסק להירשם ולנסות את המערכת. אין קשר לקהילה — זהו גיוס לקוח לשימוש במוצר עסקי.`,
            family: `מנהל אזור מגייס משפחות וצרכנים פרטיים לפלטפורמת OneFlow.
OneFlow מציעה למשפחה: הבנק המשפחתי, ניהול תקציב ביתי, תשקיף כלכלי, רשימת סופר חכמה, ניהול מזווה, שף פרטי עם AI, משלוחים מעסקים מקומיים, משימות הבית, לומדות ואקדמיה לילדים, חיבור לקהילה מקומית.
המטרה: גיוס אנשים שישאירו פרטים ונציג ייצור איתם קשר (לא הורדת אפליקציה).`,
            community_join: `מנהל אזור מזמין משפחות ועסקים להצטרף לקהילה מקומית ספציפית בתוך פלטפורמת OneFlow.
הקהילה מציעה: רשת שכנים ועסקים, הנחות מקומיות, קאשבק משותף, פורום שכונתי ואירועים.
המטרה: חיזוק הקהילה המקומית הספציפית ויצירת רשת תמיכה שכונתית.`,
        };
        const context = typeContexts[campaignType] || typeContexts.family;
        const modulesLine = (modules && modules.length)
            ? `\nמודולים שיש לדגש במיוחד במסר: ${modules.join(', ')}.`
            : '';
        const prompt = `כתוב טקסט שיווקי בעברית עבור קמפיין גיוס.
הקשר: ${context}${modulesLine}
${goal ? `פרטים נוספים שסיפק מנהל האזור: ${goal}` : ''}
קהל יעד: ${audience || 'לקוחות פוטנציאליים'}
טון: ${tone || 'חם, ידידותי, מקצועי ומשכנע'}
הפלט יכלול:
- title: כותרת ראשית מושכת (עד 8 מילים)
- subtitle: כותרת משנה מסכמת (עד 20 מילים)
- text_content: גוף הטקסט בלבד (3-4 משפטים) — חשוב: אל תחזור על הכותרת או כותרת המשנה. התחל ישירות בתוכן המרחיב, הפניות לערך, הטבות ספציפיות, וקריאה לפעולה להשארת פרטים (לא הורדת אפליקציה).
החזר JSON בפורמט: {"title": "...", "subtitle": "...", "text_content": "..."}`;
        let result;
        try {
            result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
        } catch(primaryErr) {
            if (primaryErr.message && (primaryErr.message.includes('503') || primaryErr.message.includes('overloaded') || primaryErr.message.includes('high demand'))) {
                model = genAI.getGenerativeModel({ model: fallbackModelName });
                result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
            } else { throw primaryErr; }
        }
        const txt = result.response.text().trim();
        const parsed = JSON.parse(txt);
        res.json({ success: true, ...parsed });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AI: ניתוח לידים ---
app.post('/api/zone-manager/ai/analyze-leads', verifyZoneManager, async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'AI לא זמין' });
        const { campaignId } = req.body;
        const camp = await pool.query('SELECT id FROM zm_campaigns WHERE id=$1 AND zone_manager_id=$2', [campaignId, req.zmSession.managerId]);
        if (!camp.rows.length) return res.status(404).json({ error: 'קמפיין לא נמצא' });
        const leadsRes = await pool.query('SELECT id, data FROM zm_campaign_leads WHERE campaign_id=$1 AND ai_score IS NULL LIMIT 50', [campaignId]);
        if (!leadsRes.rows.length) return res.json({ success: true, analyzed: 0 });
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
        const leadsText = leadsRes.rows.map((l,i) => `${i+1}. ${JSON.stringify(l.data)}`).join('\n');
        const prompt = `נתח את הלידים הבאים שנכנסו דרך קמפיין לגיוס חברים לקהילה. לכל ליד תן ציון 1-10 (10=חם מאוד) וקצר הערה.
לידים:
${leadsText}
החזר JSON: {"results": [{"id": <מספר שורה>, "score": <1-10>, "notes": "<הערה קצרה>"}]}`;
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const parsed = JSON.parse(result.response.text().trim());
        for (const r of (parsed.results || [])) {
            const lead = leadsRes.rows[r.id - 1];
            if (lead) await pool.query('UPDATE zm_campaign_leads SET ai_score=$1, ai_notes=$2 WHERE id=$3', [r.score, r.notes, lead.id]);
        }
        const updated = await pool.query('SELECT * FROM zm_campaign_leads WHERE campaign_id=$1 ORDER BY created_at DESC', [campaignId]);
        res.json({ success: true, analyzed: leadsRes.rows.length, leads: updated.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- AI: הצעת תשובה לשיחה ---
app.post('/api/zone-manager/ai/suggest-reply', verifyZoneManager, async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'AI לא זמין' });
        const { threadId } = req.body;
        const thread = await pool.query('SELECT * FROM zm_inbox_threads WHERE id=$1 AND zone_manager_id=$2', [threadId, req.zmSession.managerId]);
        if (!thread.rows.length) return res.status(404).json({ error: 'שיחה לא נמצאה' });
        const messages = await pool.query('SELECT * FROM zm_inbox_messages WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 6', [threadId]);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const history = messages.rows.reverse().map(m => `${m.sender_type === 'manager' ? 'מנהל אזור' : 'מנהל קהילה'}: ${m.content}`).join('\n');
        const prompt = `הינך מנהל אזור בפלטפורמת OneFlow. השיחה הבאה היא בינך לבין מנהל קהילה:\n\n${history}\n\nהצע תשובה מקצועית, קצרה וחמה בעברית. החזר רק את טקסט התשובה.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, suggestion: result.response.text().trim() });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- INBOX ---
app.get('/api/zone-manager/inbox', verifyZoneManager, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, c.name as community_name, fg.name as group_name,
                (SELECT COUNT(*) FROM zm_inbox_messages WHERE thread_id=t.id AND sender_type='community' AND is_read=FALSE) as unread_count,
                (SELECT content FROM zm_inbox_messages WHERE thread_id=t.id ORDER BY created_at DESC LIMIT 1) as last_message
             FROM zm_inbox_threads t
             LEFT JOIN communities c ON c.id=t.community_id
             LEFT JOIN family_groups fg ON fg.id=t.group_id
             WHERE t.zone_manager_id=$1
             ORDER BY t.last_message_at DESC`, [req.zmSession.managerId]);
        res.json({ success: true, threads: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/inbox/new', verifyZoneManager, async (req, res) => {
    try {
        const { communityId, groupId, subject, content } = req.body;
        if (!communityId || !groupId || !content) return res.status(400).json({ error: 'חסרים שדות חובה' });
        const thread = await pool.query(
            `INSERT INTO zm_inbox_threads (zone_manager_id, community_id, group_id, subject)
             VALUES ($1,$2,$3,$4) RETURNING id`,
            [req.zmSession.managerId, communityId, groupId, subject || 'שיחה חדשה']);
        await pool.query(
            `INSERT INTO zm_inbox_messages (thread_id, sender_type, sender_id, content)
             VALUES ($1,'manager',$2,$3)`,
            [thread.rows[0].id, req.zmSession.managerId, content]);
        await pool.query(
            `INSERT INTO inbox_messages (group_id, sender_type, sender_name, subject, content)
             VALUES ($1,'zone_manager',$2,$3,$4)`,
            [groupId, req.zmSession.name, subject || 'הודעה ממנהל האזור', content]);
        res.json({ success: true, threadId: thread.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// שידור להודעה לכל/לנבחרים
app.post('/api/zone-manager/inbox/broadcast', verifyZoneManager, async (req, res) => {
    try {
        const { subject, content, targetGroupIds } = req.body;
        if (!content) return res.status(400).json({ error: 'תוכן הודעה חובה' });
        const { managerId } = req.zmSession;
        let targets;
        if (targetGroupIds && targetGroupIds.length) {
            const r = await pool.query(
                `SELECT DISTINCT fc.group_id, fc.community_id FROM family_communities fc
                 JOIN communities c ON c.id=fc.community_id
                 JOIN manager_zones mz ON mz.id=c.zone_id
                 WHERE fc.is_community_manager=TRUE AND mz.manager_id=$1 AND fc.group_id=ANY($2)`,
                [managerId, targetGroupIds]);
            targets = r.rows;
        } else {
            const r = await pool.query(
                `SELECT DISTINCT fc.group_id, fc.community_id FROM family_communities fc
                 JOIN communities c ON c.id=fc.community_id
                 JOIN manager_zones mz ON mz.id=c.zone_id
                 WHERE fc.is_community_manager=TRUE AND mz.manager_id=$1`, [managerId]);
            targets = r.rows;
        }
        let sent = 0;
        for (const t of targets) {
            const thread = await pool.query(
                `INSERT INTO zm_inbox_threads (zone_manager_id, community_id, group_id, subject)
                 VALUES ($1,$2,$3,$4) RETURNING id`,
                [managerId, t.community_id, t.group_id, subject || 'הודעה ממנהל האזור']);
            await pool.query(
                `INSERT INTO zm_inbox_messages (thread_id, sender_type, sender_id, content) VALUES ($1,'manager',$2,$3)`,
                [thread.rows[0].id, managerId, content]);
            await pool.query(
                `INSERT INTO inbox_messages (group_id, sender_type, sender_name, subject, content)
                 VALUES ($1,'zone_manager',$2,$3,$4)`,
                [t.group_id, req.zmSession.name, subject || 'הודעה ממנהל האזור', content]);
            sent++;
        }
        res.json({ success: true, sent });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/zone-manager/inbox/:threadId', verifyZoneManager, async (req, res) => {
    try {
        const thread = await pool.query(
            `SELECT t.*, c.name as community_name, fg.name as group_name
             FROM zm_inbox_threads t LEFT JOIN communities c ON c.id=t.community_id
             LEFT JOIN family_groups fg ON fg.id=t.group_id
             WHERE t.id=$1 AND t.zone_manager_id=$2`, [req.params.threadId, req.zmSession.managerId]);
        if (!thread.rows.length) return res.status(404).json({ error: 'שיחה לא נמצאה' });
        const messages = await pool.query('SELECT * FROM zm_inbox_messages WHERE thread_id=$1 ORDER BY created_at ASC', [req.params.threadId]);
        await pool.query(`UPDATE zm_inbox_messages SET is_read=TRUE WHERE thread_id=$1 AND sender_type='community'`, [req.params.threadId]);
        res.json({ success: true, thread: thread.rows[0], messages: messages.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/inbox/:threadId/reply', verifyZoneManager, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'תוכן חובה' });
        const thread = await pool.query('SELECT id, group_id, subject FROM zm_inbox_threads WHERE id=$1 AND zone_manager_id=$2', [req.params.threadId, req.zmSession.managerId]);
        if (!thread.rows.length) return res.status(404).json({ error: 'שיחה לא נמצאה' });
        await pool.query(`INSERT INTO zm_inbox_messages (thread_id, sender_type, sender_id, content) VALUES ($1,'manager',$2,$3)`, [req.params.threadId, req.zmSession.managerId, content]);
        await pool.query('UPDATE zm_inbox_threads SET last_message_at=NOW() WHERE id=$1', [req.params.threadId]);
        await pool.query(
            `INSERT INTO inbox_messages (group_id, sender_type, sender_name, subject, content)
             VALUES ($1,'zone_manager',$2,$3,$4)`,
            [thread.rows[0].group_id, req.zmSession.name, 'תגובה: ' + (thread.rows[0].subject || 'הודעה ממנהל האזור'), content]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- TEMPLATES ---
app.get('/api/zone-manager/templates', verifyZoneManager, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zm_message_templates WHERE zone_manager_id=$1 ORDER BY created_at DESC', [req.zmSession.managerId]);
        res.json({ success: true, templates: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zone-manager/templates', verifyZoneManager, async (req, res) => {
    try {
        const { name, subject, content } = req.body;
        if (!name || !content) return res.status(400).json({ error: 'שם ותוכן חובה' });
        const result = await pool.query(
            'INSERT INTO zm_message_templates (zone_manager_id, name, subject, content) VALUES ($1,$2,$3,$4) RETURNING *',
            [req.zmSession.managerId, name, subject || null, content]);
        res.json({ success: true, template: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/zone-manager/templates/:id', verifyZoneManager, async (req, res) => {
    try {
        await pool.query('DELETE FROM zm_message_templates WHERE id=$1 AND zone_manager_id=$2', [req.params.id, req.zmSession.managerId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- COMMUNITY MANAGER INBOX (in main app) ---
// מנהל קהילה — קבלת שיחות
app.get('/api/community/inbox/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const result = await pool.query(
            `SELECT t.*, zm.name as zone_manager_name, c.name as community_name,
                (SELECT COUNT(*) FROM zm_inbox_messages WHERE thread_id=t.id AND sender_type='manager' AND is_read=FALSE) as unread_count,
                (SELECT content FROM zm_inbox_messages WHERE thread_id=t.id ORDER BY created_at DESC LIMIT 1) as last_message
             FROM zm_inbox_threads t
             LEFT JOIN zone_managers zm ON zm.id=t.zone_manager_id
             LEFT JOIN communities c ON c.id=t.community_id
             WHERE t.group_id=$1
             ORDER BY t.last_message_at DESC`, [groupId]);
        res.json({ success: true, threads: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מנהל קהילה — פתיחת שיחה חדשה עם מנהל האזור
app.post('/api/community/inbox/new', async (req, res) => {
    try {
        const { groupId, communityId, subject, content } = req.body;
        if (!groupId || !communityId || !content) return res.status(400).json({ error: 'חסרים שדות חובה' });
        const managerCheck = await pool.query(
            `SELECT mz.manager_id FROM communities c JOIN manager_zones mz ON mz.id=c.zone_id WHERE c.id=$1`, [communityId]);
        if (!managerCheck.rows.length) return res.status(404).json({ error: 'לא נמצא מנהל אזור לקהילה זו' });
        const zoneManagerId = managerCheck.rows[0].manager_id;
        const thread = await pool.query(
            `INSERT INTO zm_inbox_threads (zone_manager_id, community_id, group_id, subject) VALUES ($1,$2,$3,$4) RETURNING id`,
            [zoneManagerId, communityId, groupId, subject || 'פנייה ממנהל קהילה']);
        await pool.query(
            `INSERT INTO zm_inbox_messages (thread_id, sender_type, sender_id, content) VALUES ($1,'community',$2,$3)`,
            [thread.rows[0].id, groupId, content]);
        res.json({ success: true, threadId: thread.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מנהל קהילה — קריאת שיחה + סימון כנקרא
app.get('/api/community/inbox/thread/:threadId/:groupId', async (req, res) => {
    try {
        const { threadId, groupId } = req.params;
        const thread = await pool.query(
            `SELECT t.*, zm.name as zone_manager_name, c.name as community_name
             FROM zm_inbox_threads t
             LEFT JOIN zone_managers zm ON zm.id=t.zone_manager_id
             LEFT JOIN communities c ON c.id=t.community_id
             WHERE t.id=$1 AND t.group_id=$2`, [threadId, groupId]);
        if (!thread.rows.length) return res.status(404).json({ error: 'שיחה לא נמצאה' });
        const messages = await pool.query('SELECT * FROM zm_inbox_messages WHERE thread_id=$1 ORDER BY created_at ASC', [threadId]);
        await pool.query(`UPDATE zm_inbox_messages SET is_read=TRUE WHERE thread_id=$1 AND sender_type='manager'`, [threadId]);
        res.json({ success: true, thread: thread.rows[0], messages: messages.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מנהל קהילה — מענה לשיחה
app.post('/api/community/inbox/thread/:threadId/reply', async (req, res) => {
    try {
        const { groupId, content } = req.body;
        if (!content || !groupId) return res.status(400).json({ error: 'חסרים שדות חובה' });
        const thread = await pool.query('SELECT id FROM zm_inbox_threads WHERE id=$1 AND group_id=$2', [req.params.threadId, groupId]);
        if (!thread.rows.length) return res.status(404).json({ error: 'שיחה לא נמצאה' });
        await pool.query(`INSERT INTO zm_inbox_messages (thread_id, sender_type, sender_id, content) VALUES ($1,'community',$2,$3)`, [req.params.threadId, groupId, content]);
        await pool.query('UPDATE zm_inbox_threads SET last_message_at=NOW() WHERE id=$1', [req.params.threadId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================

// מידע ארנק לחבר קהילה / מנהל קהילה
app.get('/api/community/cashback-info/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const commsRes = await pool.query(`
            SELECT fc.community_id, fc.is_community_manager, c.name as community_name,
                COALESCE(w.balance, 0) as balance,
                COALESCE(w.total_earned, 0) as total_earned
            FROM family_communities fc
            JOIN communities c ON c.id = fc.community_id
            LEFT JOIN community_wallets w ON w.community_id = fc.community_id
            WHERE fc.group_id = $1
        `, [groupId]);
        res.json({ success: true, communities: commsRes.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ניהול ארנק קהילה למנהל קהילה: רשימת עסקים + תנועות
app.get('/api/community/manager-data/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        // מצא את הקהילות שהמשפחה מנהלת
        const mgrRes = await pool.query(
            `SELECT fc.community_id, c.name as community_name FROM family_communities fc
             JOIN communities c ON c.id=fc.community_id
             WHERE fc.group_id=$1 AND fc.is_community_manager=TRUE`, [groupId]);
        if (!mgrRes.rows.length) return res.json({ success: true, managed_communities: [] });
        const commIds = mgrRes.rows.map(r => r.community_id);

        // עסקים ממתינים לאישור
        const pendingRes = await pool.query(
            `SELECT cb.community_id, cb.business_id, fg.name as business_name, cb.discount_pct, cb.status, cb.created_at
             FROM community_businesses cb JOIN family_groups fg ON cb.business_id=fg.id
             WHERE cb.community_id=ANY($1)`, [commIds]);

        // ארנקים
        const walletsRes = await pool.query(
            `SELECT cw.*, c.name as community_name FROM community_wallets cw
             JOIN communities c ON c.id=cw.community_id WHERE cw.community_id=ANY($1)`, [commIds]);

        // תנועות אחרונות
        const txRes = await pool.query(
            `SELECT cwt.*, c.name as community_name FROM community_wallet_transactions cwt
             JOIN communities c ON c.id=cwt.community_id
             WHERE cwt.community_id=ANY($1) ORDER BY cwt.created_at DESC LIMIT 50`, [commIds]);

        res.json({
            success: true,
            managed_communities: mgrRes.rows,
            pending_businesses: pendingRes.rows,
            wallets: walletsRes.rows,
            transactions: txRes.rows
        });
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

async function appendTicketAuditLog(ticketId, message, sender) {
    if (!ticketId) return;
    try {
        const tRes = await pool.query('SELECT log FROM support_tickets WHERE id=$1', [ticketId]);
        if (!tRes.rows.length) return;
        const log = tRes.rows[0].log || [];
        log.push({ date: new Date().toISOString(), sender: sender || 'מערכת', isStaff: true, isInternal: true, message: `[SYSTEM_AUDIT] ${message}` });
        await pool.query('UPDATE support_tickets SET log=$1 WHERE id=$2', [JSON.stringify(log), ticketId]);
    } catch(_) {}
}

app.post('/api/sa/dev/tasks', verifySA, async (req, res) => {
    try {
        const { title, type, priority, status, description, environment, moduleName, targetVersion, versionId, assignedDeveloper, owner_id, original_ticket_id } = req.body;
        let groupId = null;
        if (original_ticket_id) {
            const tRow = await pool.query('SELECT group_id FROM support_tickets WHERE id=$1', [original_ticket_id]);
            if (tRow.rows.length) groupId = tRow.rows[0].group_id;
        }
        const result = await pool.query(
            `INSERT INTO sa_dev_tasks (title, type, priority, status, description, environment, module_name, original_ticket_id, owner_id, target_version, version_id, assigned_developer, group_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [title, type || 'feature', priority || 'normal', status || 'backlog', description || '', environment || '', moduleName || '', original_ticket_id || null, owner_id || null, targetVersion || '', versionId || null, assignedDeveloper || '', groupId]
        );
        if (original_ticket_id) {
            await appendTicketAuditLog(original_ticket_id, `הקריאה הומרה למשימת טיפול (${title}) ונפתחה במסלול פיתוח`);
        }
        res.json({ success: true, task: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sa/dev/tasks/:id', verifySA, async (req, res) => {
    try {
        // Updated to process owner_id and original_ticket_id on updates
        const { title, type, priority, status, description, targetVersion, versionId, environment, moduleName, assignedDeveloper, owner_id, original_ticket_id } = req.body;
        await pool.query(
            `UPDATE sa_dev_tasks 
             SET title=$1, type=$2, priority=$3, status=$4, description=$5, target_version=$6, version_id=$7, environment=$8, module_name=$9, assigned_developer=$10, owner_id=$11, original_ticket_id=$12, updated_at=CURRENT_TIMESTAMP 
             WHERE id=$13`,
            [title, type, priority, status, description, targetVersion, versionId || null, environment || '', moduleName || '', assignedDeveloper || '', owner_id || null, original_ticket_id || null, req.params.id]
        );
        res.json({ success: true });
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
        const statusLabels = {
            backlog:     'הועבר לבנק משימות',
            in_progress: '🔧 הקריאה נכנסה לפיתוח פעיל',
            qa:          '🔬 הקריאה הועברה לבדיקות QA',
            done:        '✅ הפיתוח הושלם — שוחרר לאוויר'
        };

        if (status === 'done' && !systemOverride) {
            return res.status(403).json({ error: 'חסימת מערכת: לא ניתן להעביר משימה לסטטוס "בוצע" ידנית. המשימה תיסגר אוטומטית ברגע שכל תתי-המשימות יסתיימו וריצת ה-QA בספר המוצר תעבור בהצלחה.' });
        }

        await pool.query('UPDATE sa_dev_tasks SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, req.params.id]);

        const taskRes = await pool.query('SELECT * FROM sa_dev_tasks WHERE id=$1', [req.params.id]);
        if (taskRes.rows.length > 0) {
            const t = taskRes.rows[0];

            if (t.original_ticket_id) {
                const label = statusLabels[status] || status;
                await appendTicketAuditLog(t.original_ticket_id, `סטטוס משימת הטיפול עודכן: ${label}`);
                await postToInternalChat(`🔄 קריאה #${t.original_ticket_id} — "${t.title}": ${label}`, 'מערכת');
            }

            if (status === 'done') {
                const bookId = `DEV-${t.id}`;
                await pool.query(`
                    INSERT INTO sa_product_book (id, category, name, description, priority, original_ticket_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, original_ticket_id=EXCLUDED.original_ticket_id
                `, [bookId, t.module_name || t.environment || 'general', t.title, t.description || '', t.priority || 'medium', t.original_ticket_id || null]);
            }
        }

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
        const matrixResult = await pool.query(
            'SELECT id::text, environment, module_name, scenario_name, expected_result, status, last_tested_at, \'matrix\' as source FROM sa_product_matrix ORDER BY environment, module_name, id'
        );
        // ספר המוצר מספר QA — כל הפריטים, סטטוס לפי תוצאות QA
        const bookResult = await pool.query(`
            SELECT
                pb.id::text                                    AS id,
                'book'                                         AS environment,
                pb.category                                    AS module_name,
                pb.name                                        AS scenario_name,
                pb.description                                 AS expected_result,
                COALESCE((
                    SELECT CASE
                        WHEN COUNT(*) FILTER (WHERE qr.status = 'ok')   > 0 THEN 'passed'
                        WHEN COUNT(*) FILTER (WHERE qr.status = 'fail') > 0 THEN 'failed'
                        ELSE 'untested'
                    END
                    FROM sa_qa_test_results qr WHERE qr.test_id = pb.id
                ), 'untested')                                 AS status,
                NULL                                           AS last_tested_at,
                'book'                                         AS source
            FROM sa_product_book pb
            ORDER BY pb.category, pb.id
        `);
        res.json({ success: true, matrix: [...matrixResult.rows, ...bookResult.rows] });
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
        const result = await pool.query('SELECT *, original_ticket_id FROM sa_product_book ORDER BY category ASC, id ASC');
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

app.put('/api/sa/versions/name/:name', verifySA, async (req, res) => {
    try {
        const { targetDate } = req.body;
        await pool.query(
            'UPDATE sa_versions SET target_date=$1 WHERE name=$2',
            [targetDate || null, req.params.name]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SA QA MODULE ────────────────────────────────────────────────────────────

// Create tables if not exist
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sa_product_book (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        envs TEXT[] DEFAULT ARRAY['family'],
        icon TEXT,
        color TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sa_qa_test_results (
        test_id TEXT NOT NULL,
        env TEXT NOT NULL,
        status TEXT,
        note TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (test_id, env)
      );
      CREATE TABLE IF NOT EXISTS sa_versions (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sa_dev_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        module TEXT,
        status TEXT DEFAULT 'pending',
        version_id INTEGER REFERENCES sa_versions(id),
        env TEXT DEFAULT 'family',
        qa_passed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('SA QA tables ready');
  } catch(e) {
    console.error('SA QA table init error:', e.message);
  }
})();

// ── Product Book ──────────────────────────────────────────────────────────────

app.get('/api/sa/qa/tests', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sa_product_book ORDER BY section_id, id');
    res.json({ tests: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sa/qa/tests', verifySA, async (req, res) => {
  try {
    const { id, section_id, title, description, envs, icon, color } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sa_product_book (id, section_id, title, description, envs, icon, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         section_id=EXCLUDED.section_id, title=EXCLUDED.title,
         description=EXCLUDED.description, envs=EXCLUDED.envs,
         icon=EXCLUDED.icon, color=EXCLUDED.color
       RETURNING *`,
      [id, section_id, title, description || '', envs || ['family'], icon || '', color || '']
    );
    res.json({ test: rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sa/qa/tests', verifySA, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE sa_product_book');
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sa/qa/tests/:id', verifySA, async (req, res) => {
  try {
    await pool.query('DELETE FROM sa_product_book WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── QA Results ────────────────────────────────────────────────────────────────

app.get('/api/sa/qa/results', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sa_qa_test_results');
    res.json({ results: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sa/qa/results/bulk', verifySA, async (req, res) => {
  try {
    const { results } = req.body; // [{testId, env, status, note}]
    if (!Array.isArray(results) || !results.length) return res.json({ ok: true });
    const values = results.map((r, i) => {
      const base = i * 4;
      return `($${base+1},$${base+2},$${base+3},$${base+4},NOW())`;
    }).join(',');
    const flat = results.flatMap(r => [r.testId, r.env, r.status || null, r.note || '']);
    await pool.query(
      `INSERT INTO sa_qa_test_results (test_id, env, status, note, updated_at)
       VALUES ${values}
       ON CONFLICT (test_id, env) DO UPDATE SET
         status=EXCLUDED.status, note=EXCLUDED.note, updated_at=NOW()`,
      flat
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sa/qa/results', verifySA, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE sa_qa_test_results');
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Versions ──────────────────────────────────────────────────────────────────

app.get('/api/sa/versions', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sa_versions ORDER BY created_at DESC');
    res.json({ versions: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sa/versions', verifySA, async (req, res) => {
  try {
    const { name, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sa_versions (name, notes) VALUES ($1,$2)
       ON CONFLICT (name) DO UPDATE SET notes=EXCLUDED.notes
       RETURNING *`,
      [name, notes || '']
    );
    res.json({ version: rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/sa/versions/name/:name', verifySA, async (req, res) => {
  try {
    const { notes } = req.body;
    await pool.query('UPDATE sa_versions SET notes=$1 WHERE name=$2', [notes || '', req.params.name]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sa/versions/name/:name', verifySA, async (req, res) => {
  try {
    await pool.query('DELETE FROM sa_versions WHERE name=$1', [req.params.name]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dev Tasks (skip if already defined above) ─────────────────────────────────

app.get('/api/sa/dev/tasks', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sa_dev_tasks ORDER BY created_at DESC');
    res.json({ tasks: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sa/dev/tasks', verifySA, async (req, res) => {
  try {
    const { id, title, module, status, version_id, env } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sa_dev_tasks (id, title, module, status, version_id, env)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, module=EXCLUDED.module,
         status=EXCLUDED.status, version_id=EXCLUDED.version_id, env=EXCLUDED.env
       RETURNING *`,
      [id, title, module || '', status || 'pending', version_id || null, env || 'family']
    );
    res.json({ task: rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/sa/dev/tasks/:id/status', verifySA, async (req, res) => {
  try {
    const { status, qa_passed } = req.body;
    await pool.query(
      'UPDATE sa_dev_tasks SET status=$1, qa_passed=$2 WHERE id=$3',
      [status || 'pending', qa_passed === true, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sa/dev/tasks/:id', verifySA, async (req, res) => {
  try {
    await pool.query('DELETE FROM sa_dev_tasks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ראוטים למערכת הודעות פנימיות ---

app.get('/api/messages/broadcast', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM internal_messages ORDER BY created_at DESC');
    res.json({ success: true, messages: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/broadcast', verifySA, async (req, res) => {
  const { title, content, targetType, targetId } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO internal_messages (title, content, target_type, target_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, content, targetType, targetId]
    );
    res.json({ success: true, messageId: rows[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/acknowledge', async (req, res) => {
  const { messageId, employeeId, status } = req.body;
  try {
    await pool.query(
      'INSERT INTO message_acknowledgments (message_id, employee_id, status) VALUES ($1, $2, $3) ON CONFLICT (message_id, employee_id) DO UPDATE SET status=$3, responded_at=NOW()',
      [messageId, employeeId, status]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/messages/:id/stats', verifySA, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT e.name, ma.status, ma.responded_at FROM message_acknowledgments ma JOIN employees e ON ma.employee_id = e.id WHERE ma.message_id = $1',
      [req.params.id]
    );
    res.json({ success: true, stats: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ראוט דשבורד מרכזי - דופק מערכת (Pulse) - גרסה חסינת קריסות
app.get('/api/superadmin/pulse', verifySA, async (req, res) => {
    try {
        const [users, tickets, tasks, groups] = await Promise.all([
            pool.query('SELECT COUNT(*) as total FROM users'),
            pool.query('SELECT status, priority FROM support_tickets'),
            pool.query('SELECT status FROM sa_dev_tasks'),
            pool.query('SELECT COUNT(*) as total FROM family_groups')
        ]);

        const openTicketsCount = tickets.rows.filter(t => t.status === 'open' || t.status === 'Open' || t.status === 'in_progress').length;
        const pendingTasksCount = tasks.rows.filter(t => t.status === 'pending' || t.status === 'backlog').length;
        const totalTicketsCount = tickets.rows.length;
        const resolvedCount = tickets.rows.filter(t => t.status === 'resolved' || t.status === 'Resolved').length;
        const qaPercentage = totalTicketsCount > 0 ? Math.round((resolvedCount / totalTicketsCount) * 100) : 100;

        res.json({
            success: true,
            snapshot: {
                totalUsers: parseInt(users.rows[0].total || 0),
                activeEnvironments: parseInt(groups.rows[0].total || 0),
                openTickets: openTicketsCount,
                pendingTasks: pendingTasksCount,
                systemErrors: 0
            },
            stats: {
                totalTickets: totalTicketsCount,
                qaPercentage: qaPercentage
            }
        });
    } catch(e) { 
        console.error('Pulse API Resilient Error Handled:', e);
        // החזרת מבנה נתונים ריק תקין כדי למנוע קריסת קליינט
        res.json({
            success: false,
            snapshot: { totalUsers: 0, activeEnvironments: 0, openTickets: 0, pendingTasks: 0, systemErrors: 1 },
            stats: { totalTickets: 0, qaPercentage: 100 }
        });
    }
});

// ============================================================
// /api/qa/update — Playwright CI reporter (no auth required)
// ============================================================
app.post('/api/qa/update', async (req, res) => {
    try {
        const { testId, status, env = 'family', note } = req.body;
        if (!testId) return res.status(400).json({ error: 'testId required' });
        const timestamp = new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
        const autoNote = note || `🤖 Playwright: ${status === 'ok' ? '✅ עבר' : '❌ נכשל'} — ${timestamp}`;
        await pool.query(
            `INSERT INTO sa_qa_test_results (test_id, env, status, note)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (test_id, env) DO UPDATE
             SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = CURRENT_TIMESTAMP`,
            [testId, env, status, autoNote]
        );
        res.json({ success: true, testId, status });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// QA Task Assignments — shared state across all QA computers
// ============================================================
app.get('/api/qa/assignments', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT task_id, data, updated_at FROM qa_task_assignments ORDER BY updated_at DESC');
        res.json({ success: true, assignments: rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/qa/assignments/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { data } = req.body;
        if (!data) return res.status(400).json({ error: 'data required' });
        await pool.query(
            `INSERT INTO qa_task_assignments (task_id, data, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (task_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [taskId, JSON.stringify(data)]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/qa/assignments', async (req, res) => {
    try {
        const { assignments } = req.body;
        if (!Array.isArray(assignments) || assignments.length === 0) return res.json({ success: true, count: 0 });
        for (const { taskId, data } of assignments) {
            if (!taskId || !data) continue;
            await pool.query(
                `INSERT INTO qa_task_assignments (task_id, data, updated_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (task_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
                [taskId, JSON.stringify(data)]
            );
        }
        res.json({ success: true, count: assignments.length });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ACTIVITY FEED ENDPOINT ─────────────────────────────────────
app.get('/api/activity', async (req, res) => {
  try {
    const { userId, groupId, actionType, days = 30, limit = 50 } = req.query;
    const uRes = await pool.query('SELECT role, group_id FROM users WHERE id=$1', [userId]);
    if (!uRes.rows.length) return res.status(403).json({ error: 'Unauthorized' });
    const user = uRes.rows[0];
    const gId = user.group_id;
    const since = new Date(Date.now() - parseInt(days) * 86400000);

    let query = 'SELECT al.*, u.nickname FROM activity_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.group_id=$1 AND al.created_at >= $2';
    const params = [gId, since];

    // Non-admins see only their own
    if (user.role !== 'ADMIN') {
      query += ' AND al.user_id=$3';
      params.push(userId);
    }
    if (actionType && actionType !== 'all') {
      query += ` AND al.action_type=$${params.length+1}`;
      params.push(actionType);
    }
    query += ' ORDER BY al.created_at DESC LIMIT $' + (params.length+1);
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Count unread (last 24h)
    const unreadRes = await pool.query(
      'SELECT COUNT(*) FROM activity_log WHERE group_id=$1 AND created_at > NOW() - INTERVAL \'1 day\'' + (user.role !== 'ADMIN' ? ' AND user_id=$2' : ''),
      user.role !== 'ADMIN' ? [gId, userId] : [gId]
    );

    res.json({ success: true, activities: result.rows, unreadCount: parseInt(unreadRes.rows[0].count) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── KIOSK ENDPOINTS ──────────────────────────────────────────────

// GET store settings + catalog for kiosk (public, by groupId)
app.get('/api/store/kiosk-settings/:groupId', async (req, res) => {
    try {
        const gId = req.params.groupId;
        const [settingsRes, catalogRes, groupRes] = await Promise.all([
            pool.query('SELECT * FROM store_settings WHERE group_id=$1', [gId]),
            pool.query(`SELECT id,name,description,price,category,image_url,is_available,
                               badge_text,badge_color,options_text,product_type
                        FROM store_catalog WHERE group_id=$1 AND is_available=TRUE ORDER BY category,name`, [gId]),
            pool.query('SELECT name FROM family_groups WHERE id=$1', [gId])
        ]);
        res.json({
            success: true,
            settings: settingsRes.rows[0] || {},
            catalog: catalogRes.rows,
            storeName: groupRes.rows[0]?.name || ''
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST lookup/create customer by phone for kiosk
app.post('/api/store/kiosk-lookup', async (req, res) => {
    try {
        const { groupId, phone, name } = req.body;
        if (!groupId || !phone) return res.status(400).json({ error: 'חסר groupId או phone' });
        // normalize: digits only, try both with and without leading 0
        const digits = phone.replace(/\D/g,'');
        const altPhone = digits.startsWith('0') ? digits.substring(1) : '0' + digits;
        const existing = await pool.query(
            `SELECT * FROM store_customers WHERE group_id=$1 AND (phone=$2 OR phone=$3 OR REPLACE(phone,'-','')=$2 OR REPLACE(phone,'-','')=$3) LIMIT 1`,
            [groupId, digits, altPhone]);
        if (existing.rows.length > 0) {
            const cust = existing.rows[0];
            // count previous orders
            const ordersRes = await pool.query(
                `SELECT COUNT(*) FROM store_orders WHERE group_id=$1 AND customer_phone IN ($2,$3)`,
                [groupId, digits, altPhone]);
            const orderCount = parseInt(ordersRes.rows[0].count) || 0;
            return res.json({ success: true, customer: cust, isNew: false, orderCount });
        }
        // create only if name provided
        if (!name || name === 'לקוח') return res.json({ success: true, customer: null, isNew: true });
        const created = await pool.query(
            'INSERT INTO store_customers (group_id, name, phone) VALUES ($1,$2,$3) RETURNING *',
            [groupId, name, digits]);
        res.json({ success: true, customer: created.rows[0], isNew: true, orderCount: 0 });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST submit kiosk order
app.post('/api/store/kiosk-order', async (req, res) => {
    try {
        const { groupId, customerName, customerPhone, items, notes, total } = req.body;
        if (!groupId || !items?.length) return res.status(400).json({ error: 'נתונים חסרים' });
        const digits = (customerPhone || '').replace(/\D/g,'');
        const altPhone = digits.startsWith('0') ? digits.substring(1) : '0' + digits;

        const orderRes = await pool.query(
            `INSERT INTO store_orders (group_id, customer_name, customer_phone, total_amount, status, items, notes, quote_status, created_at)
             VALUES ($1,$2,$3,$4,'new',$5,$6,NULL,CURRENT_TIMESTAMP) RETURNING id`,
            [groupId, customerName || 'לקוח קיוסק', digits || '', total || 0,
             JSON.stringify(items), notes ? `[קיוסק] ${notes}` : '[קיוסק]']
        );
        const orderId = orderRes.rows[0].id;

        // Update/create customer record so purchase is tracked in CRM
        if (digits) {
            const custRes = await pool.query(
                `SELECT id FROM store_customers WHERE group_id=$1 AND (phone=$2 OR phone=$3 OR REPLACE(phone,'-','')=$2) LIMIT 1`,
                [groupId, digits, altPhone]);
            if (custRes.rows.length > 0) {
                // update existing customer notes with last visit
                await pool.query(
                    `UPDATE store_customers SET notes = COALESCE(notes,'') || $1 WHERE id=$2`,
                    [`\nקנייה בקיוסק #${orderId} — ₪${total} (${new Date().toLocaleDateString('he-IL')})`, custRes.rows[0].id]
                );
            } else if (customerName && customerName !== 'לקוח') {
                await pool.query(
                    `INSERT INTO store_customers (group_id, name, phone, notes) VALUES ($1,$2,$3,$4)`,
                    [groupId, customerName, digits, `קנייה בקיוסק #${orderId} — ₪${total} (${new Date().toLocaleDateString('he-IL')})`]);
            }
        }

        await logActivity(groupId, null, customerName || 'לקוח קיוסק', 'sale', 'kiosk_order', `הזמנת קיוסק #${orderId} — ₪${total}`);
        res.json({ success: true, orderId });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET kiosk password for a group
app.get('/api/store/kiosk-password/:groupId', async (req, res) => {
    try {
        const r = await pool.query('SELECT kiosk_password FROM store_settings WHERE group_id=$1', [req.params.groupId]);
        res.json({ success: true, password: r.rows[0]?.kiosk_password || '1234' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT set kiosk password (admin)
app.put('/api/store/kiosk-password', async (req, res) => {
    try {
        const { groupId, password } = req.body;
        if (!groupId || !password) return res.status(400).json({ error: 'נתונים חסרים' });
        await pool.query(
            `INSERT INTO store_settings (group_id, kiosk_password) VALUES ($1,$2)
             ON CONFLICT (group_id) DO UPDATE SET kiosk_password=$2`,
            [groupId, password]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET/PUT user phone
app.get('/api/users/:userId/phone', async (req, res) => {
    try {
        const r = await pool.query('SELECT phone FROM users WHERE id=$1', [req.params.userId]);
        res.json({ success: true, phone: r.rows[0]?.phone || '' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:userId/phone', async (req, res) => {
    try {
        const { phone } = req.body;
        await pool.query('UPDATE users SET phone=$1 WHERE id=$2', [phone, req.params.userId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SURVEYS API ────────────────────────────────────────────────

const _surveyCode = () => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
};

// רשימת סקרים לעסק
app.get('/api/surveys', async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) return res.status(400).json({ error: 'חסר groupId' });
        const r = await pool.query(
            `SELECT s.*,
             (SELECT COUNT(*) FROM survey_responses WHERE survey_id=s.id)::int AS response_count,
             (SELECT COUNT(*) FROM survey_questions WHERE survey_id=s.id)::int AS question_count
             FROM surveys s WHERE s.group_id=$1 ORDER BY s.created_at DESC`,
            [groupId]);
        res.json({ success: true, surveys: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// יצירת סקר חדש
app.post('/api/surveys', async (req, res) => {
    try {
        const { groupId, title, description, requiredFields, anonymous, questions } = req.body;
        if (!groupId || !title) return res.status(400).json({ error: 'חסרים נתונים' });
        const code = _surveyCode();
        const sv = await pool.query(
            `INSERT INTO surveys (group_id,title,description,required_fields,anonymous,unique_code)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [groupId, title, description||'', JSON.stringify(requiredFields||[]), !!anonymous, code]);
        const id = sv.rows[0].id;
        if (questions?.length) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                await pool.query(
                    `INSERT INTO survey_questions (survey_id,order_index,type,question_text,options,required)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [id, i, q.type, q.text, JSON.stringify(q.options||[]), q.required!==false]);
            }
        }
        res.json({ success: true, survey: sv.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// עדכון סקר (טיוטה בלבד)
app.put('/api/surveys/:id', async (req, res) => {
    try {
        const { title, description, requiredFields, anonymous, questions } = req.body;
        const ex = await pool.query('SELECT status FROM surveys WHERE id=$1', [req.params.id]);
        if (!ex.rows.length) return res.status(404).json({ error: 'לא נמצא' });
        if (ex.rows[0].status !== 'draft') return res.status(400).json({ error: 'ניתן לערוך רק טיוטות' });
        await pool.query(
            `UPDATE surveys SET title=$1,description=$2,required_fields=$3,anonymous=$4 WHERE id=$5`,
            [title, description||'', JSON.stringify(requiredFields||[]), !!anonymous, req.params.id]);
        if (questions) {
            await pool.query('DELETE FROM survey_questions WHERE survey_id=$1', [req.params.id]);
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                await pool.query(
                    `INSERT INTO survey_questions (survey_id,order_index,type,question_text,options,required)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [req.params.id, i, q.type, q.text, JSON.stringify(q.options||[]), q.required!==false]);
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// הפעלת סקר
app.post('/api/surveys/:id/activate', async (req, res) => {
    try {
        const { groupId } = req.body;
        const cnt = await pool.query(
            `SELECT COUNT(*) FROM surveys WHERE group_id=$1 AND status='active'`, [groupId]);
        if (parseInt(cnt.rows[0].count) >= 3)
            return res.status(400).json({ error: 'הגעת למקסימום 3 סקרים פעילים' });
        const r = await pool.query(
            `UPDATE surveys SET status='active' WHERE id=$1 RETURNING *`, [req.params.id]);
        res.json({ success: true, survey: r.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// סגירת סקר
app.post('/api/surveys/:id/close', async (req, res) => {
    try {
        await pool.query(`UPDATE surveys SET status='closed',closed_at=NOW() WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// מחיקת סקר
app.delete('/api/surveys/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM surveys WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// תוצאות סקר (למנהל)
app.get('/api/surveys/:id/results', async (req, res) => {
    try {
        const id = req.params.id;
        const [sv, qs, rs] = await Promise.all([
            pool.query('SELECT * FROM surveys WHERE id=$1', [id]),
            pool.query('SELECT * FROM survey_questions WHERE survey_id=$1 ORDER BY order_index', [id]),
            pool.query('SELECT * FROM survey_responses WHERE survey_id=$1 ORDER BY submitted_at DESC', [id])
        ]);
        res.json({ success: true, survey: sv.rows[0], questions: qs.rows, responses: rs.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ציבורי: קבלת מידע סקר (ללא אוטנטיקציה)
app.get('/api/public/survey/:code', async (req, res) => {
    try {
        const sv = await pool.query('SELECT * FROM surveys WHERE unique_code=$1', [req.params.code]);
        if (!sv.rows.length) return res.status(404).json({ error: 'סקר לא נמצא' });
        const s = sv.rows[0];
        if (s.status !== 'active') return res.status(403).json({ error: 'הסקר אינו פעיל כרגע' });
        const [qs, grp, stg] = await Promise.all([
            pool.query('SELECT * FROM survey_questions WHERE survey_id=$1 ORDER BY order_index', [s.id]),
            pool.query('SELECT name FROM family_groups WHERE id=$1', [s.group_id]),
            pool.query('SELECT logo_url, slogan FROM store_settings WHERE group_id=$1', [s.group_id])
        ]);
        res.json({ success: true,
            survey: { id: s.id, title: s.title, description: s.description,
                      required_fields: s.required_fields, anonymous: s.anonymous,
                      business_name: grp.rows[0]?.name || '',
                      logo_url: stg.rows[0]?.logo_url || null,
                      slogan: stg.rows[0]?.slogan || '' },
            questions: qs.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ציבורי: שליחת תשובה
app.post('/api/public/survey/:code/submit', async (req, res) => {
    try {
        const { respondentData, answers, comment } = req.body;
        const sv = await pool.query(
            `SELECT id FROM surveys WHERE unique_code=$1 AND status='active'`, [req.params.code]);
        if (!sv.rows.length) return res.status(403).json({ error: 'הסקר אינו פעיל' });
        await pool.query(
            `INSERT INTO survey_responses (survey_id,respondent_data,answers,comment)
             VALUES ($1,$2,$3,$4)`,
            [sv.rows[0].id, JSON.stringify(respondentData||{}), JSON.stringify(answers||[]), comment||'']);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ALERT ENGINE ──────────────────────────────────────────────────────────
async function checkRuleTrigger(rule) {
    const config = rule.trigger_config || {};
    const messages = [];
    try {
        switch(rule.trigger_type) {
            case 'timeclock_no_punch_in': {
                const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                const users = await pool.query(
                    `SELECT u.nickname FROM users u WHERE u.group_id=$1 AND u.role != 'ADMIN'
                     AND NOT EXISTS (SELECT 1 FROM time_clock tc WHERE tc.user_id=u.id AND tc.punch_in >= $2)`,
                    [rule.group_id, todayStart]
                );
                if (users.rows.length > 0) messages.push(`עובדים שלא החתימו כניסה היום: ${users.rows.map(u=>u.nickname).join(', ')}`);
                break;
            }
            case 'timeclock_no_punch_out': {
                const maxHours = config.max_hours || 10;
                const punches = await pool.query(
                    `SELECT u.nickname FROM time_clock tc JOIN users u ON tc.user_id=u.id
                     WHERE u.group_id=$1 AND tc.punch_out IS NULL AND tc.punch_in < NOW() - ($2 * INTERVAL '1 hour')`,
                    [rule.group_id, maxHours]
                );
                punches.rows.forEach(p => messages.push(`${p.nickname} החתים כניסה לפני ${maxHours}+ שעות ולא יצא`));
                break;
            }
            case 'inventory_low': {
                const minQty = config.min_quantity !== undefined ? config.min_quantity : 1;
                const items = await pool.query(
                    'SELECT item_name, quantity FROM pantry WHERE group_id=$1 AND quantity <= $2 ORDER BY quantity',
                    [rule.group_id, minQty]
                );
                if (items.rows.length > 0) {
                    const names = items.rows.map(i=>`${i.item_name}(${i.quantity})`).join(', ');
                    messages.push(`מוצרים מתחת לרף מינימום: ${names}`);
                }
                break;
            }
            case 'task_overdue': {
                const tasks = await pool.query(
                    `SELECT t.title, u.nickname FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id
                     WHERE t.group_id=$1 AND t.status NOT IN ('approved','cancelled')
                     AND t.deadline IS NOT NULL AND t.deadline < NOW()`,
                    [rule.group_id]
                );
                tasks.rows.forEach(t => messages.push(`משימה באיחור: "${t.title}"${t.nickname ? ` (${t.nickname})` : ''}`));
                break;
            }
            case 'shopping_pending': {
                const hours = config.pending_hours || 24;
                const items = await pool.query(
                    `SELECT item_name FROM shopping_list WHERE group_id=$1 AND status='requested' AND added_at < NOW() - ($2 * INTERVAL '1 hour')`,
                    [rule.group_id, hours]
                );
                if (items.rows.length > 0) messages.push(`בקשות רכש ממתינות מעל ${hours}ש': ${items.rows.map(i=>i.item_name).join(', ')}`);
                break;
            }
            case 'balance_low': {
                const minBalance = config.min_balance || 500;
                const result = await pool.query(
                    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) as balance FROM transactions WHERE group_id=$1`,
                    [rule.group_id]
                );
                const balance = parseFloat(result.rows[0]?.balance || 0);
                if (balance < minBalance) messages.push(`יתרה נמוכה: ₪${balance.toFixed(2)} (מתחת ל-₪${minBalance})`);
                break;
            }
            case 'order_unhandled': {
                const hours = config.pending_hours || 2;
                const orders = await pool.query(
                    `SELECT id, customer_name FROM store_orders WHERE group_id=$1 AND status='new' AND created_at < NOW() - ($2 * INTERVAL '1 hour')`,
                    [rule.group_id, hours]
                );
                if (orders.rows.length > 0) {
                    const names = orders.rows.map(o => o.customer_name || `#${o.id}`).join(', ');
                    messages.push(`${orders.rows.length} הזמנות ממתינות לטיפול מעל ${hours}ש': ${names}`);
                }
                break;
            }
            case 'quote_not_converted': {
                const days = config.pending_days || 3;
                const quotes = await pool.query(
                    `SELECT id, customer_name FROM store_orders WHERE group_id=$1 AND status='quote' AND quote_status NOT IN ('approved','rejected') AND created_at < NOW() - ($2 * INTERVAL '1 day')`,
                    [rule.group_id, days]
                );
                if (quotes.rows.length > 0) {
                    const names = quotes.rows.map(q => q.customer_name || `#${q.id}`).join(', ');
                    messages.push(`${quotes.rows.length} הצעות מחיר לא הומרו להזמנה מעל ${days} ימים: ${names}`);
                }
                break;
            }
            case 'ticket_open': {
                const hours = config.pending_hours || 24;
                const tickets = await pool.query(
                    `SELECT id, subject FROM support_tickets WHERE group_id=$1 AND status='open' AND created_at < NOW() - ($2 * INTERVAL '1 hour')`,
                    [rule.group_id, hours]
                );
                if (tickets.rows.length > 0) {
                    const subjects = tickets.rows.map(t => t.subject || `#${t.id}`).join(', ');
                    messages.push(`${tickets.rows.length} קריאות שירות פתוחות מעל ${hours}ש': ${subjects}`);
                }
                break;
            }
        }
        const channels = rule.channels || ['in_app'];
        for (const message of messages) {
            await pool.query('INSERT INTO alert_notifications (group_id, rule_id, trigger_type, message) VALUES ($1, $2, $3, $4)',
                [rule.group_id, rule.id, rule.trigger_type, message]);
            if (channels.includes('email')) {
                await sendAlertEmail(rule.group_id, `⚡ התראה: ${rule.name}`, message);
            }
        }
    } catch(e) { console.error(`Alert trigger error (${rule.trigger_type}):`, e.message); }
}

async function runAlertEngine() {
    try {
        const rulesRes = await pool.query('SELECT * FROM alert_rules WHERE is_active=TRUE');
        for (const rule of rulesRes.rows) {
            const lastFired = await pool.query(
                'SELECT created_at FROM alert_notifications WHERE rule_id=$1 ORDER BY created_at DESC LIMIT 1',
                [rule.id]
            );
            if (lastFired.rows.length > 0) {
                const elapsedMins = (Date.now() - new Date(lastFired.rows[0].created_at).getTime()) / 60000;
                if (elapsedMins < (rule.cooldown_minutes || 60)) continue;
            }
            await checkRuleTrigger(rule);
        }
    } catch(e) { console.error('Alert engine error:', e.message); }
}

async function checkSLABreaches() {
    try {
        const configs = await pool.query('SELECT * FROM sla_configs WHERE is_active=TRUE');
        for (const cfg of configs.rows) {
            // cooldown: don't re-fire same module+status breach within 60 min
            const lastFired = await pool.query(
                `SELECT created_at FROM alert_notifications WHERE group_id=$1 AND trigger_type='sla_breach' AND message LIKE $2 ORDER BY created_at DESC LIMIT 1`,
                [cfg.group_id, `%[${cfg.module}:${cfg.status}]%`]
            );
            if (lastFired.rows.length > 0) {
                const elapsedMins = (Date.now() - new Date(lastFired.rows[0].created_at).getTime()) / 60000;
                if (elapsedMins < 60) continue;
            }
            let breachingRows = [];
            if (cfg.module === 'orders') {
                const res = await pool.query(
                    `SELECT id, customer_name, COALESCE(status_changed_at, created_at) as since FROM store_orders
                     WHERE group_id=$1 AND status=$2 AND COALESCE(status_changed_at, created_at) < NOW() - ($3 * INTERVAL '1 hour')`,
                    [cfg.group_id, cfg.status, cfg.max_hours]
                );
                breachingRows = res.rows;
            } else if (cfg.module === 'quotes') {
                const statusFilter = cfg.status === 'draft' ? `quote_status='draft' OR quote_status IS NULL` : `quote_status=$2`;
                const params = cfg.status === 'draft'
                    ? [cfg.group_id, cfg.max_hours]
                    : [cfg.group_id, cfg.status, cfg.max_hours];
                const qParam = cfg.status === 'draft' ? `$2` : `$3`;
                const res = await pool.query(
                    `SELECT id, customer_name, COALESCE(status_changed_at, created_at) as since FROM store_orders
                     WHERE group_id=$1 AND status='quote' AND (${statusFilter}) AND COALESCE(status_changed_at, created_at) < NOW() - (${qParam} * INTERVAL '1 hour')`,
                    params
                );
                breachingRows = res.rows;
            }
            if (breachingRows.length > 0) {
                const label = cfg.status_label || cfg.status;
                const names = breachingRows.map(r => r.customer_name || `#${r.id}`).join(', ');
                const msg = `[${cfg.module}:${cfg.status}] חריגת SLA בשלב "${label}" (מעל ${cfg.max_hours}ש'): ${names}`;
                await pool.query('INSERT INTO alert_notifications (group_id, trigger_type, message) VALUES ($1,$2,$3)',
                    [cfg.group_id, 'sla_breach', msg]);
                const channels = cfg.channels || ['in_app'];
                if (channels.includes('email')) {
                    await sendAlertEmail(cfg.group_id, `⏱️ חריגת SLA: ${label}`, msg);
                }
            }
        }
    } catch(e) { console.error('SLA engine error:', e.message); }
}

setTimeout(runAlertEngine, 30000);
setInterval(runAlertEngine, 5 * 60 * 1000);
setTimeout(checkSLABreaches, 45000);
setInterval(checkSLABreaches, 5 * 60 * 1000);

// =========================================================
// עמודי אישור קבלה ציבוריים (ללא auth)
// =========================================================
function confirmationPage(title, subtitle, alreadyDone) {
    const color = alreadyDone ? '#64748b' : '#22c55e';
    const icon = alreadyDone ? '✅' : '🎉';
    return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>אישור קבלה</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:24px;padding:40px 32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.12);max-width:380px;width:100%}.icon{font-size:64px;margin-bottom:20px}.title{font-size:22px;font-weight:900;color:#1e293b;margin-bottom:10px}.sub{font-size:14px;color:#64748b;line-height:1.6}.badge{display:inline-block;background:${color}20;color:${color};border:1px solid ${color}40;border-radius:100px;padding:6px 18px;font-size:13px;font-weight:700;margin-top:20px}</style></head>
<body><div class="card"><div class="icon">${icon}</div><h1 class="title">${title}</h1><p class="sub">${subtitle}</p><span class="badge">${alreadyDone ? 'כבר אושר בעבר' : 'המערכת עודכנה ✓'}</span></div></body></html>`;
}

app.get('/c/q/:id/:token', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM store_orders WHERE id=$1 AND confirm_token=$2', [req.params.id, req.params.token]);
        if (!r.rows.length) return res.status(404).send('<h2 style="text-align:center;font-family:Arial;margin-top:20vh">קישור לא תקף או פג תוקפו</h2>');
        const order = r.rows[0];
        const alreadyDone = !!order.customer_confirmed_at;
        if (!alreadyDone) {
            await pool.query('UPDATE store_orders SET customer_confirmed_at=NOW() WHERE id=$1', [req.params.id]);
        }
        const name = order.customer_name || 'לקוח';
        const num = order.quote_number || `#${order.id}`;
        res.send(confirmationPage(
            `תודה ${name}!`,
            `קבלת הצעת מחיר ${num} על סך ₪${parseFloat(order.total_amount||0).toFixed(2)} אושרה.\nנציג ייצור איתך קשר בהקדם.`,
            alreadyDone
        ));
    } catch(e) { res.status(500).send('שגיאה: ' + e.message); }
});

app.get('/c/po/:id/:token', async (req, res) => {
    try {
        const r = await pool.query('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id WHERE po.id=$1 AND po.confirm_token=$2', [req.params.id, req.params.token]);
        if (!r.rows.length) return res.status(404).send('<h2 style="text-align:center;font-family:Arial;margin-top:20vh">קישור לא תקף או פג תוקפו</h2>');
        const order = r.rows[0];
        const alreadyDone = !!order.supplier_confirmed_at;
        if (alreadyDone) {
            return res.send(confirmationPage(`הזמנה #${order.id} אושרה!`, `תודה ${order.supplier_name || 'ספק'} — ההזמנה כבר אושרה בעבר.`, true));
        }
        // Show a confirmation page with a button — do NOT auto-confirm on GET
        // (WhatsApp link-preview bots do GET requests, auto-confirming on GET is a bug)
        res.send(`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>אישור הזמנת רכש #${order.id}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:24px;padding:40px 32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.12);max-width:380px;width:100%}.icon{font-size:56px;margin-bottom:16px}.title{font-size:20px;font-weight:900;color:#1e293b;margin-bottom:8px}.sub{font-size:14px;color:#64748b;line-height:1.6;margin-bottom:24px}button{background:#22c55e;color:#fff;border:none;padding:14px 36px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;width:100%}button:active{opacity:.85}</style></head>
<body><div class="card">
<div class="icon">📦</div>
<h1 class="title">הזמנת רכש #${order.id}</h1>
<p class="sub">מ: ${(order.supplier_name||'').replace(/[<>]/g,'')} קיבלתם הזמנת רכש חדשה.<br>לחצו לאישור הקבלה:</p>
<form method="POST" action="/c/po/${order.id}/${req.params.token}">
<button type="submit">✅ אישור קבלת ההזמנה</button>
</form>
</div></body></html>`);
    } catch(e) { res.status(500).send('שגיאה: ' + e.message); }
});

app.post('/c/po/:id/:token', async (req, res) => {
    try {
        const r = await pool.query('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id WHERE po.id=$1 AND po.confirm_token=$2', [req.params.id, req.params.token]);
        if (!r.rows.length) return res.status(404).send('<h2 style="text-align:center;font-family:Arial;margin-top:20vh">קישור לא תקף</h2>');
        const order = r.rows[0];
        const alreadyDone = !!order.supplier_confirmed_at;
        if (!alreadyDone) {
            await pool.query('UPDATE purchase_orders SET supplier_confirmed_at=NOW() WHERE id=$1', [req.params.id]);
        }
        res.send(confirmationPage(`הזמנה #${order.id} התקבלה!`, `תודה ${order.supplier_name || 'ספק'} על אישור קבלת הזמנת הרכש.\nנפנה אליכם בכל שאלה.`, alreadyDone));
    } catch(e) { res.status(500).send('שגיאה: ' + e.message); }
});

// Public logo endpoint — returns global_ai_logo as binary image (for OG meta tags)
app.get('/api/public/logo', async (req, res) => {
    try {
        const logoRes = await pool.query("SELECT value FROM system_settings WHERE key='global_ai_logo'");
        const logoData = logoRes.rows[0]?.value || '';
        if (!logoData || !logoData.startsWith('data:')) {
            return res.redirect('/social-logo.jpg');
        }
        const [header, base64] = logoData.split(',');
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(Buffer.from(base64, 'base64'));
    } catch(e) { res.redirect('/social-logo.jpg'); }
});

// Serve campaign banner image as binary (og:image must be a real URL, not data:)
app.get('/api/public/campaign-image/:token', async (req, res) => {
    try {
        const r = await pool.query('SELECT image_url FROM zm_campaigns WHERE token=$1 AND status=$2', [req.params.token, 'active']);
        const imageUrl = r.rows[0]?.image_url || '';
        if (!imageUrl || !imageUrl.startsWith('data:')) return res.status(404).send('');
        const [header, base64] = imageUrl.split(',');
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(Buffer.from(base64, 'base64'));
    } catch(e) { res.status(500).send(''); }
});

// Public system banner (top banner from superadmin settings)
app.get('/api/public/system-banner', async (req, res) => {
    try {
        const r = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('ad_banner_img_top','ad_banner_link_top','global_ai_logo')");
        const map = {};
        r.rows.forEach(row => { map[row.key] = row.value; });
        const logoVal = map['global_ai_logo'] || '';
        res.json({
            bannerImg: map['ad_banner_img_top'] || '',
            bannerLink: map['ad_banner_link_top'] || '',
            logoData: !!(logoVal && logoVal.startsWith('data:')),
            logoSrc: logoVal.startsWith('data:') ? logoVal : ''
        });
    } catch(e) { res.status(500).json({ bannerImg: '', bannerLink: '', logoData: false, logoSrc: '' }); }
});

// Legal documents - public read
const LEGAL_DEFAULTS = {
    legal_tos_family: `<p><strong>1. מבוא:</strong> ברוכים הבאים למערכת Oneflow. השימוש באפליקציה מהווה הסכמה מלאה לתנאים המפורטים מטה.</p>
<p><strong>2. מהות השירות:</strong> המערכת מספקת כלים וירטואליים לניהול התקציב. ה"כסף" המוצג במערכת אינו כסף פיזי, אינו מקושר לחשבון בנק אמיתי, אלא מהווה רישום פנימי (וירטואלי) לצורך ניהול פנימי בלבד.</p>
<p><strong>3. שימוש בבינה מלאכותית (AI):</strong> חלק מתכונות המערכת מבוססות על מודלי שפה וראייה ממוחשבת (AI). התובנות, המשימות, החידונים, פיענוח הקבלות ואישור התמונות נוצרים אוטומטית על ידי אלגוריתם. ייתכנו שגיאות או אי-דיוקים ביצירת התוכן. המנהל נושא באחריות המלאה לבקר ולאשר את המידע.</p>
<p><strong>4. פרטיות המידע:</strong> אנו מתחייבים לשמור על פרטיות המידע שהוזן למערכת ולא לשתפו עם צדדים שלישיים למטרות פרסום ללא הסכמתכם. במקרה של חשבונות לקטינים, האחריות על המידע חלה על ההורה המנהל.</p>
<p><strong>5. עדכונים ותקשורת:</strong> נהיה רשאים לשלוח אליכם התראות ועדכונים במידה ואישרתם קבלת דיוור. תוכלו לבקש את הסרתכם מרשימת התפוצה בכל עת.</p>`,
    legal_tos_business: `<p><strong>1. מבוא:</strong> ברוכים הבאים לפלטפורמת Oneflow לעסקים. השימוש מהווה הסכמה לתנאים המפורטים מטה.</p>
<p><strong>2. מהות השירות:</strong> הפלטפורמה מספקת כלים לניהול עסק, לקוחות, הזמנות ושיווק. האחריות על הנתונים, ההזמנות וניהול הלקוחות חלה על בעל העסק בלבד.</p>
<p><strong>3. תשלומים:</strong> כל עסקה כספית מתבצעת ישירות בין העסק ללקוח. Oneflow אינה צד בעסקה ואינה נושאת באחריות לכשלים בתשלום.</p>
<p><strong>4. פרטיות:</strong> הנתונים שנאספים משמשים לתפעול השירות בלבד ולא יועברו לצדדים שלישיים ללא הסכמה.</p>
<p><strong>5. הפסקת שירות:</strong> שמורה לנו הזכות להשעות חשבון שנמצאת בו הפרה של התנאים.</p>`,
    legal_privacy: `<p><strong>מדיניות פרטיות — OneFlow</strong></p>
<p>אנו מחויבים להגנה על פרטיות המשתמשים. מסמך זה מפרט אילו נתונים נאספים, כיצד הם נשמרים ולאילו מטרות.</p>
<p><strong>נתונים הנאספים:</strong> שם, דוא"ל, מספר טלפון, תמונות שהועלו למערכת, ונתוני שימוש.</p>
<p><strong>שימוש בנתונים:</strong> הנתונים משמשים אך ורק לתפעול השירות ושיפורו.</p>
<p><strong>אחסון:</strong> הנתונים מאוחסנים בשרתים מאובטחים ומוגנים בהצפנה.</p>
<p><strong>זכויות משתמש:</strong> ניתן לבקש מחיקת הנתונים בכל עת על ידי פנייה לתמיכה.</p>`,
    legal_accessibility: `<p><strong>הצהרת נגישות — OneFlow</strong></p>
<p>OneFlow פועלת לאפשר גישה שוויונית לשירות עבור אנשים עם מוגבלויות.</p>
<p><strong>תכונות נגישות:</strong> הגדלת טקסט, ניגודיות גבוהה, גווני אפור, פונט קריא והדגשת קישורים.</p>
<p><strong>רמת תאימות:</strong> אנו שואפים לעמוד בדרישות WCAG 2.1 ברמה AA.</p>
<p><strong>פנייה לנגישות:</strong> לדיווח על בעיות נגישות או בקשת סיוע, אנא פנה לצוות התמיכה.</p>`
};

app.get('/api/public/legal/:key', async (req, res) => {
    const allowed = ['legal_tos_family', 'legal_tos_business', 'legal_privacy', 'legal_accessibility'];
    const { key } = req.params;
    if (!allowed.includes(key)) return res.status(404).json({ success: false });
    try {
        const r = await pool.query("SELECT value FROM system_settings WHERE key = $1", [key]);
        const content = r.rows[0]?.value || LEGAL_DEFAULTS[key] || '';
        res.json({ success: true, content });
    } catch(e) { res.status(500).json({ success: false, content: LEGAL_DEFAULTS[key] || '' }); }
});

// Legal documents - SA read all
app.get('/api/sa/legal', verifySA, async (req, res) => {
    try {
        const keys = ['legal_tos_family', 'legal_tos_business', 'legal_privacy', 'legal_accessibility'];
        const r = await pool.query(`SELECT key, value FROM system_settings WHERE key = ANY($1)`, [keys]);
        const map = {};
        keys.forEach(k => { map[k] = LEGAL_DEFAULTS[k] || ''; });
        r.rows.forEach(row => { map[row.key] = row.value; });
        res.json({ success: true, docs: map });
    } catch(e) { res.status(500).json({ success: false }); }
});

// Legal documents - SA update
app.put('/api/sa/legal/:key', verifySA, async (req, res) => {
    const allowed = ['legal_tos_family', 'legal_tos_business', 'legal_privacy', 'legal_accessibility'];
    const { key } = req.params;
    if (!allowed.includes(key)) return res.status(400).json({ success: false, error: 'Invalid key' });
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ success: false, error: 'Missing content' });
    try {
        await pool.query("INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, content]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false }); }
});

// OG preview route for campaign WhatsApp sharing
app.get('/c/camp/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const campRes = await pool.query(
            `SELECT c.title, c.subtitle, c.text_content, c.image_url
             FROM zm_campaigns c WHERE c.token=$1 AND c.status='active'`, [token]);
        const campaign = campRes.rows[0];
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // og:image must be an absolute HTTP URL returning JPEG/PNG (not data: or SVG)
        let ogImage = '';
        const isSvg = (url) => url && (url.startsWith('data:image/svg') || url.endsWith('.svg'));
        if (campaign?.image_url && campaign.image_url.startsWith('data:') && !isSvg(campaign.image_url)) {
            ogImage = `${baseUrl}/api/public/campaign-image/${token}`;
        }
        if (!ogImage) {
            const logoRes = await pool.query("SELECT value FROM system_settings WHERE key='global_ai_logo'");
            const logoVal = logoRes.rows[0]?.value || '';
            if (logoVal && logoVal.startsWith('data:') && logoVal.includes(',') && !isSvg(logoVal)) {
                ogImage = `${baseUrl}/api/public/logo`;
            }
        }
        // Final fallback: static logo.png (always JPEG/PNG, always works for WhatsApp)
        if (!ogImage) {
            ogImage = `${baseUrl}/logo.png`;
        }
        const title = (campaign?.title || 'OneFlow').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const desc = (campaign?.subtitle || campaign?.text_content || 'הצטרפו לפלטפורמת OneFlow').slice(0, 200).replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const campaignUrl = `${baseUrl}/campaign.html?t=${token}`;
        const hasCampaignImage = campaign?.image_url && campaign.image_url.startsWith('data:') && !isSvg(campaign.image_url);
        const ogW = hasCampaignImage ? '1200' : '512';
        const ogH = hasCampaignImage ? '630' : '512';
        res.set('Cache-Control', 'no-cache');
        res.send(`<!DOCTYPE html><html lang="he" dir="rtl"><head>
<meta charset="UTF-8">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<meta property="og:url" content="${campaignUrl}">
<meta property="og:type" content="website">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
<meta property="og:site_name" content="OneFlow">
<meta name="twitter:card" content="${hasCampaignImage ? 'summary_large_image' : 'summary'}">
<meta http-equiv="refresh" content="0; url=${campaignUrl}">
<title>${title}</title>
</head><body dir="rtl" style="font-family:sans-serif;text-align:center;padding:2rem;color:#334155">
<h2>${title}</h2><p>${desc}</p>
<a href="${campaignUrl}" style="color:#4f46e5;font-weight:bold">לחץ כאן להמשך &rarr;</a>
</body></html>`);
    } catch(e) { res.redirect('/campaign.html?t=' + req.params.token); }
});

// ============================================================
// --- EQUIPMENT MAINTENANCE MODULE ---
// ============================================================

// טכנאים
app.get('/api/equipment/technicians/:groupId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM equipment_technicians WHERE group_id=$1 ORDER BY name ASC', [req.params.groupId]);
        res.json({ success: true, technicians: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/technicians', async (req, res) => {
    try {
        const { id, groupId, name, companyName, phone, email, specialty, notes } = req.body;
        if (!groupId || !name) return res.status(400).json({ error: 'שם חובה' });
        let result;
        if (id) {
            result = await pool.query(
                `UPDATE equipment_technicians SET name=$1, company_name=$2, phone=$3, email=$4, specialty=$5, notes=$6 WHERE id=$7 AND group_id=$8 RETURNING *`,
                [name, companyName||null, phone||null, email||null, specialty||null, notes||null, id, groupId]);
        } else {
            result = await pool.query(
                `INSERT INTO equipment_technicians (group_id, name, company_name, phone, email, specialty, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [groupId, name, companyName||null, phone||null, email||null, specialty||null, notes||null]);
        }
        res.json({ success: true, technician: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipment/technicians/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM equipment_technicians WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equipment/items/:groupId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ei.*, et.name as technician_name, et.phone as technician_phone, et.email as technician_email
             FROM equipment_items ei
             LEFT JOIN equipment_technicians et ON et.id=ei.technician_id
             WHERE ei.group_id=$1 ORDER BY ei.name ASC`,
            [req.params.groupId]);
        res.json({ success: true, items: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/items', async (req, res) => {
    try {
        const { id, groupId, name, category, serialNumber, purchaseDate, warrantyExpiry, status, notes, technicianId } = req.body;
        if (!groupId || !name) return res.status(400).json({ error: 'שם וקבוצה חובה' });
        let result;
        if (id) {
            result = await pool.query(
                `UPDATE equipment_items SET name=$1, category=$2, serial_number=$3, purchase_date=$4, warranty_expiry=$5, status=$6, notes=$7, technician_id=$8 WHERE id=$9 AND group_id=$10 RETURNING *`,
                [name, category||'כללי', serialNumber||null, purchaseDate||null, warrantyExpiry||null, status||'active', notes||null, technicianId||null, id, groupId]);
        } else {
            result = await pool.query(
                `INSERT INTO equipment_items (group_id, name, category, serial_number, purchase_date, warranty_expiry, status, notes, technician_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                [groupId, name, category||'כללי', serialNumber||null, purchaseDate||null, warrantyExpiry||null, status||'active', notes||null, technicianId||null]);
        }
        res.json({ success: true, item: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipment/items/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM equipment_items WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equipment/maintenance/:groupId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.*, e.name as equipment_name, e.category as equipment_category
             FROM equipment_maintenance m JOIN equipment_items e ON e.id=m.equipment_id
             WHERE m.group_id=$1 ORDER BY m.scheduled_date ASC NULLS LAST, m.created_at DESC`,
            [req.params.groupId]);
        res.json({ success: true, records: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/maintenance', async (req, res) => {
    try {
        const { id, groupId, equipmentId, maintenanceType, description, scheduledDate, cost, technicianName, technicianPhone, notes, intervalDays } = req.body;
        if (!groupId || !equipmentId) return res.status(400).json({ error: 'ציוד וקבוצה חובה' });
        let result;
        if (id) {
            result = await pool.query(
                `UPDATE equipment_maintenance SET equipment_id=$1, maintenance_type=$2, description=$3, scheduled_date=$4, cost=$5, technician_name=$6, technician_phone=$7, notes=$8, interval_days=$9 WHERE id=$10 AND group_id=$11 RETURNING *`,
                [equipmentId, maintenanceType||'periodic', description||null, scheduledDate||null, cost||null, technicianName||null, technicianPhone||null, notes||null, intervalDays||null, id, groupId]);
        } else {
            result = await pool.query(
                `INSERT INTO equipment_maintenance (equipment_id, group_id, maintenance_type, description, scheduled_date, cost, technician_name, technician_phone, notes, interval_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [equipmentId, groupId, maintenanceType||'periodic', description||null, scheduledDate||null, cost||null, technicianName||null, technicianPhone||null, notes||null, intervalDays||null]);
        }
        res.json({ success: true, record: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipment/maintenance/:id/complete', async (req, res) => {
    try {
        const { cost, technicianName, notes } = req.body;
        const updated = await pool.query(
            `UPDATE equipment_maintenance SET status='completed', completed_date=CURRENT_DATE, cost=COALESCE($1,cost), technician_name=COALESCE($2,technician_name), notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
            [cost||null, technicianName||null, notes||null, req.params.id]);
        const rec = updated.rows[0];
        // תזמון אוטומטי — אם הוגדר interval_days, צור רשומה הבאה
        if (rec && rec.interval_days) {
            const nextDate = new Date(rec.completed_date || new Date());
            nextDate.setDate(nextDate.getDate() + rec.interval_days);
            await pool.query(
                `INSERT INTO equipment_maintenance (equipment_id, group_id, maintenance_type, description, scheduled_date, technician_name, technician_phone, notes, interval_days)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [rec.equipment_id, rec.group_id, rec.maintenance_type, rec.description, nextDate.toISOString().split('T')[0], rec.technician_name, rec.technician_phone, rec.notes, rec.interval_days]);
        }
        res.json({ success: true, nextScheduled: rec?.interval_days ? true : false });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipment/maintenance/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM equipment_maintenance WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equipment/faults/:groupId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, e.name as equipment_name, e.category as equipment_category,
             (SELECT COUNT(*) FROM equipment_fault_notes fn WHERE fn.fault_id=f.id) as notes_count
             FROM equipment_faults f JOIN equipment_items e ON e.id=f.equipment_id
             WHERE f.group_id=$1 ORDER BY f.created_at DESC`,
            [req.params.groupId]);
        res.json({ success: true, faults: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equipment/faults/:id/notes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM equipment_fault_notes WHERE fault_id=$1 ORDER BY created_at ASC`,
            [req.params.id]);
        res.json({ success: true, notes: result.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/faults/:id/notes', async (req, res) => {
    try {
        const { note, statusFrom, statusTo, groupId } = req.body;
        if (!note || !groupId) return res.status(400).json({ error: 'חסרים שדות' });
        const result = await pool.query(
            `INSERT INTO equipment_fault_notes (fault_id, group_id, note, status_from, status_to) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [req.params.id, groupId, note, statusFrom||null, statusTo||null]);
        res.json({ success: true, note: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/faults', async (req, res) => {
    try {
        const { id, groupId, equipmentId, title, description, imageUrl, severity, status, resolutionNotes, resolvedDate } = req.body;
        if (!groupId || !equipmentId || !title) return res.status(400).json({ error: 'ציוד וכותרת חובה' });
        let result;
        if (id) {
            result = await pool.query(
                `UPDATE equipment_faults SET equipment_id=$1, title=$2, description=$3, image_url=$4, severity=$5, status=$6, resolution_notes=$7, resolved_date=$8
                 WHERE id=$9 AND group_id=$10 RETURNING *`,
                [equipmentId, title, description||null, imageUrl||null, severity||'medium', status||'open', resolutionNotes||null, resolvedDate||null, id, groupId]);
        } else {
            result = await pool.query(
                `INSERT INTO equipment_faults (equipment_id, group_id, title, description, image_url, severity, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [equipmentId, groupId, title, description||null, imageUrl||null, severity||'medium', status||'open']);
        }
        res.json({ success: true, fault: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/equipment/faults/:id/status', async (req, res) => {
    try {
        const { status, note, groupId } = req.body;
        if (!status || !groupId) return res.status(400).json({ error: 'חסרים שדות' });
        const existing = await pool.query('SELECT * FROM equipment_faults WHERE id=$1 AND group_id=$2', [req.params.id, groupId]);
        if (!existing.rows.length) return res.status(404).json({ error: 'לא נמצא' });
        const fault = existing.rows[0];
        const resolvedDate = status === 'resolved' ? (fault.resolved_date || new Date().toISOString().split('T')[0]) : null;
        const result = await pool.query(
            `UPDATE equipment_faults SET status=$1, resolved_date=$2 WHERE id=$3 AND group_id=$4 RETURNING *`,
            [status, resolvedDate, req.params.id, groupId]);
        if (note && note.trim()) {
            const statusLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
            const label = statusLabels[status] || status;
            await pool.query(
                `INSERT INTO equipment_fault_notes (fault_id, group_id, note, status_from, status_to) VALUES ($1,$2,$3,$4,$5)`,
                [req.params.id, groupId, `סטטוס שונה ל"${label}": ${note.trim()}`, fault.status, status]);
        } else {
            const statusLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
            const fromLabel = statusLabels[fault.status] || fault.status;
            const toLabel = statusLabels[status] || status;
            await pool.query(
                `INSERT INTO equipment_fault_notes (fault_id, group_id, note, status_from, status_to) VALUES ($1,$2,$3,$4,$5)`,
                [req.params.id, groupId, `סטטוס שונה מ"${fromLabel}" ל"${toLabel}"`, fault.status, status]);
        }
        res.json({ success: true, fault: result.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipment/faults/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM equipment_faults WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/equipment/items/:id/history', async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) return res.status(400).json({ error: 'חסר groupId' });
        const maintenance = await pool.query(
            `SELECT id, 'maintenance' as type,
             COALESCE(description, maintenance_type) as title,
             description, status,
             COALESCE(completed_date::text, scheduled_date::text) as event_date,
             scheduled_date, completed_date, maintenance_type, technician_name, cost
             FROM equipment_maintenance WHERE equipment_id=$1 AND group_id=$2`,
            [req.params.id, groupId]);
        const faults = await pool.query(
            `SELECT id, 'fault' as type, title, description, status, created_at::text as event_date,
             severity, resolution_notes, resolved_date
             FROM equipment_faults WHERE equipment_id=$1 AND group_id=$2`,
            [req.params.id, groupId]);
        const combined = [...maintenance.rows, ...faults.rows]
            .sort((a, b) => new Date(b.event_date || 0) - new Date(a.event_date || 0));
        res.json({ success: true, history: combined });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/notifications/check/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const today = new Date(); today.setHours(0,0,0,0);
        const in7 = new Date(today); in7.setDate(today.getDate() + 7);
        const upcoming = await pool.query(
            `SELECT m.*, e.name as equipment_name
             FROM equipment_maintenance m JOIN equipment_items e ON e.id=m.equipment_id
             WHERE m.group_id=$1 AND m.status='pending' AND m.scheduled_date IS NOT NULL
             AND m.scheduled_date >= $2 AND m.scheduled_date <= $3`,
            [groupId, today.toISOString().split('T')[0], in7.toISOString().split('T')[0]]);
        let created = 0;
        for (const m of upcoming.rows) {
            const sDate = new Date(m.scheduled_date); sDate.setHours(0,0,0,0);
            const diffDays = Math.round((sDate - today) / 86400000);
            const dateStr = sDate.toLocaleDateString('he-IL');
            const notifications = [];
            const maintLabel = m.description || m.maintenance_type || 'תחזוקה';
            if (diffDays >= 2 && diffDays <= 7) {
                notifications.push({ refKey: `eq_maint_${m.id}_7d_${m.scheduled_date}`, message: `🔧 תחזוקה בעוד ${diffDays} ימים: "${maintLabel}" — ${m.equipment_name} (${dateStr})` });
            }
            if (diffDays <= 1) {
                const whenStr = diffDays === 0 ? 'היום' : 'מחר';
                notifications.push({ refKey: `eq_maint_${m.id}_1d_${m.scheduled_date}`, message: `🔧 תחזוקה ${whenStr}: "${maintLabel}" — ${m.equipment_name} (${dateStr})` });
            }
            for (const n of notifications) {
                const exists = await pool.query('SELECT id FROM alert_notifications WHERE group_id=$1 AND reference_key=$2', [groupId, n.refKey]);
                if (exists.rows.length > 0) continue;
                await pool.query('INSERT INTO alert_notifications (group_id, trigger_type, message, reference_key) VALUES ($1,$2,$3,$4)',
                    [groupId, 'equipment_maintenance', n.message, n.refKey]);
                created++;
            }
        }
        res.json({ success: true, created });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== BUSINESS TYPE & LICENSING ENDPOINTS =====

app.patch('/api/groups/:id/business-settings', async (req, res) => {
    try {
        const { business_type, licensed_features } = req.body;
        await pool.query(
            'UPDATE family_groups SET business_type=$1, licensed_features=$2 WHERE id=$3',
            [business_type || 'other', JSON.stringify(licensed_features || {}), req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id/role-type', async (req, res) => {
    try {
        const { employee_role_type } = req.body;
        await pool.query('UPDATE users SET employee_role_type=$1 WHERE id=$2',
            [employee_role_type || null, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/groups/:id/licenses', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM group_licenses WHERE group_id=$1 ORDER BY feature_key', [req.params.id]);
        res.json({ success: true, licenses: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/groups/:id/licenses', async (req, res) => {
    try {
        const { feature_key, is_active, price_monthly } = req.body;
        await pool.query(
            `INSERT INTO group_licenses (group_id, feature_key, is_active, price_monthly)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (group_id, feature_key) DO UPDATE SET is_active=$3, price_monthly=$4`,
            [req.params.id, feature_key, is_active !== false, price_monthly || 0]
        );
        // Sync licensed_features JSONB on family_groups for fast client reads
        const lic = await pool.query('SELECT feature_key, is_active FROM group_licenses WHERE group_id=$1', [req.params.id]);
        const lf = {};
        lic.rows.forEach(l => { lf[l.feature_key] = l.is_active; });
        await pool.query('UPDATE family_groups SET licensed_features=$1 WHERE id=$2', [JSON.stringify(lf), req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== END BUSINESS TYPE & LICENSING =====

// הפעלת השרת
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
