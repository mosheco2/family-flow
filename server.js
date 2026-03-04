const express = require('express');
const { Pool } = require('pg'); // Changed from Client to Pool for better performance
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Use Pool to handle multiple concurrent connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Max number of concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(() => console.log('✅ Connected to DB (Pool)'))
  .catch(err => console.error('Connection Error', err.stack));

// --- HELPERS (For Age, Grouping and Code Generation) ---
const calculateAge = (birthYear) => new Date().getFullYear() - (birthYear || new Date().getFullYear());

const getAgeGroup = (age) => {
    if (age >= 6 && age < 8) return '6-8';
    if (age >= 8 && age < 10) return '8-10';
    if (age >= 10 && age < 13) return '10-13';
    if (age >= 13 && age < 15) return '13-15';
    if (age >= 15 && age < 18) return '15-18';
    if (age >= 18) return '18+';
    return 'other';
};

// Generate a random 6-character alphanumeric code
const generateGroupCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- CONTENT GENERATORS ---

// 1. Math Generator (Auto-generated)
const generateMath = (ageGroup) => {
    const questions = [];
    for (let i = 0; i < 5; i++) {
        let q, ans, opts = [];
        if (ageGroup === '6-8') {
            const a = Math.floor(Math.random() * 10) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            q = `כמה זה ${a} + ${b}?`;
            ans = a + b;
        } else if (ageGroup === '8-10') {
            const a = Math.floor(Math.random() * 10) + 2;
            const b = Math.floor(Math.random() * 10) + 2;
            q = `כמה זה ${a} × ${b}?`;
            ans = a * b;
        } else if (ageGroup === '10-13') {
            const a = Math.floor(Math.random() * 50) + 10;
            const b = Math.floor(Math.random() * 10) + 2;
            q = `כמה זה ${a} × ${b}?`;
            ans = a * b;
        } else {
            const a = Math.floor(Math.random() * 12) + 2;
            q = `כמה זה ${a} בחזקת 2?`;
            ans = a * a;
        }
        
        opts.push(ans.toString());
        while(opts.length < 4) {
            const fakeAns = ans + (Math.floor(Math.random() * 10) - 5);
            if (fakeAns !== ans && fakeAns > 0 && !opts.includes(fakeAns.toString())) opts.push(fakeAns.toString());
        }
        opts = opts.sort(() => Math.random() - 0.5);
        questions.push({ q, options: opts, correct: opts.indexOf(ans.toString()) });
    }
    return questions;
};

// 2. Reading Comprehension (Hebrew)
const readingContent = [
    {
        age_group: '6-8',
        title: "הכלב של דני",
        text: "לדני יש כלב קטן וחמוד. קוראים לו רקסי. רקסי אוהב לשחק בכדור צהוב בגינה. כל יום אחרי בית הספר, דני רץ לגינה וזורק לרקסי את הכדור.",
        questions: [
            { q: "איך קוראים לכלב של דני?", options: ["רקסי", "בובי", "שוקו", "מיצי"], correct: 0 },
            { q: "באיזה צבע הכדור של רקסי?", options: ["אדום", "כחול", "צהוב", "ירוק"], correct: 2 },
            { q: "מתי דני משחק עם רקסי?", options: ["בבוקר", "אחרי בית הספר", "בלילה", "לפני השינה"], correct: 1 }
        ]
    },
    {
        age_group: '8-10',
        title: "הטיול לירושלים",
        text: "ביום שלישי נסעה כיתה ד' לטיול בירושלים. הם ביקרו בשוק מחנה יהודה, אכלו פלאפל טעים וראו את חומות העיר העתיקה. דנה קנתה לאמא שלה מתנה קטנה בשוק - שרשרת יפה.",
        questions: [
            { q: "לאן נסעה כיתה ד'?", options: ["לתל אביב", "לחיפה", "לירושלים", "לאילת"], correct: 2 },
            { q: "מה הם אכלו בשוק?", options: ["פיצה", "פלאפל", "המבורגר", "שווארמה"], correct: 1 },
            { q: "מה דנה קנתה לאמא שלה?", options: ["צמיד", "עגילים", "טבעת", "שרשרת"], correct: 3 }
        ]
    }
];

// 3. English (Vocabulary/Grammar)
const englishContent = [
    { age_group: '6-8', title: "Animals", questions: [{ q: "איך אומרים כלב באנגלית?", options: ["Cat", "Dog", "Bird", "Fish"], correct: 1 }, { q: "איך אומרים חתול?", options: ["Dog", "Cat", "Cow", "Pig"], correct: 1 }] },
    { age_group: '8-10', title: "Present & Past", questions: [{ q: "What is the past tense of 'Go'?", options: ["Goes", "Going", "Went", "Gone"], correct: 2 }, { q: "She ___ to the store yesterday.", options: ["go", "went", "goes", "going"], correct: 1 }] },
    { age_group: '10-13', title: "Comparatives", questions: [{ q: "An elephant is ___ than a dog.", options: ["big", "biggest", "bigger", "more big"], correct: 2 }, { q: "This is the ___ book I have ever read.", options: ["good", "better", "best", "most good"], correct: 2 }] },
    { age_group: '13-15', title: "Passive Voice", questions: [{ q: "The book ___ by Mark Twain.", options: ["wrote", "was written", "writes", "is write"], correct: 1 }, { q: "The window ___ yesterday.", options: ["broke", "was broken", "breaks", "is break"], correct: 1 }] },
    { age_group: '15-18', title: "Conditionals", questions: [{ q: "If I had money, I ___ a car.", options: ["will buy", "would buy", "bought", "buy"], correct: 1 }, { q: "Unless you ___, you will fail.", options: ["study", "will study", "studied", "would study"], correct: 0 }] }
];

// 4. Financial Education (Hebrew)
const financialContent = [
    {
        age_group: '8-10',
        title: "מהו חיסכון?",
        text: "חיסכון אומר שאנחנו לא מבזבזים את כל הכסף שיש לנו עכשיו, אלא שומרים חלק ממנו לעתיד. אם נשמור קצת כסף כל שבוע, נוכל לקנות משהו גדול ויקר יותר בהמשך.",
        questions: [
            { q: "מה זה חיסכון?", options: ["לבזבז הכל עכשיו", "לשמור כסף לעתיד", "לבקש הלוואה", "לתת מתנות"], correct: 1 },
            { q: "למה כדאי לחסוך?", options: ["כדי שייגמר הכסף", "כדי לקנות משהו גדול בעתיד", "כי זה משעמם", "כדי לאבד את הכסף"], correct: 1 }
        ]
    },
    {
        age_group: '10-13',
        title: "הכנסות והוצאות",
        text: "הכנסה היא כסף שנכנס אלינו (כמו דמי כיס או משכורת). הוצאה היא כסף שאנחנו משלמים על דברים (כמו קניית משחק או אוכל). תקציב מאוזן הוא מצב שבו ההוצאות לא גדולות מההכנסות.",
        questions: [
            { q: "מהי הוצאה?", options: ["דמי כיס שאני מקבל", "כסף שאני משלם בחנות", "מתנה מסבתא", "משכורת"], correct: 1 },
            { q: "מתי התקציב שלנו מאוזן?", options: ["כשההוצאות גדולות מההכנסות", "כשאנחנו קונים כל מה שבא לנו", "כשההוצאות לא גדולות מההכנסות", "כשאנחנו לוקחים הלוואות"], correct: 2 }
        ]
    },
    {
        age_group: '13-15',
        title: "ריבית דריבית - פלא הכלכלה",
        text: "ריבית היא תשלום שאנחנו מקבלים על כך שאנחנו נותנים לבנק לשמור על הכסף שלנו. 'ריבית דריבית' (Compound Interest) אומרת שהריבית שאנחנו מרוויחים מצטרפת לסכום המקורי, ובפעם הבאה נרוויח ריבית גם על הריבית שכבר קיבלנו! כך הכסף גדל מהר יותר.",
        questions: [
            { q: "מהי ריבית על חיסכון?", options: ["קנס שאנחנו משלמים", "תשלום שהבנק נותן לנו על שמירת הכסף", "מס לממשלה", "דמי ניהול חשבון"], correct: 1 },
            { q: "למה 'ריבית דריבית' נחשבת טובה לחוסכים?", options: ["כי מרוויחים ריבית גם על הריבית שנצברה", "כי היא מקטינה את הכסף", "כי הריבית תמיד נשארת אותו דבר", "כי הבנק לוקח לנו עמלה"], correct: 0 }
        ]
    },
    {
        age_group: '15-18',
        title: "שוק ההון ומניות - הבסיס",
        text: "מניה היא חלק קטן מבעלות על חברה. כשאתה קונה מניה, אתה בעצם הופך לשותף קטן בחברה (כמו אפל או גוגל). אם החברה מצליחה ומרוויחה, ערך המניה בדרך כלל עולה, ואתה מרוויח. אם החברה מפסידה, ערך המניה יכול לרדת.",
        questions: [
            { q: "מה זה בעצם מניה?", options: ["הלוואה מהבנק", "חלק מבעלות על חברה", "סוג של כסף מזומן", "ביטוח חיים"], correct: 1 },
            { q: "מה קורה לערך המניה אם החברה מצליחה מאוד?", options: ["הוא בדרך כלל יורד", "הוא נשאר בדיוק אותו דבר", "הוא בדרך כלל עולה", "המניה נמחקת"], correct: 2 }
        ]
    }
];

// --- SEEDING FUNCTION ---
async function seedDatabase() {
    console.log("Seeding initial data...");
    try {
        await pool.query("DELETE FROM quiz_questions");
        await pool.query("DELETE FROM quiz_bundles");

        // Seed dynamically and explicitly
        const insertBundle = async (type, age_group, title, text_content) => {
            const res = await pool.query(
                `INSERT INTO quiz_bundles (type, age_group, title, text_content, threshold, reward) VALUES ($1, $2, $3, $4, 85, 10.0) RETURNING id`,
                [type, age_group, title, text_content]
            );
            return res.rows[0].id;
        };

        const insertQuestions = async (bundleId, questions) => {
            for (const q of questions) {
                await pool.query(
                    `INSERT INTO quiz_questions (bundle_id, q, options, correct) VALUES ($1, $2, $3, $4)`,
                    [bundleId, q.q, JSON.stringify(q.options), q.correct]
                );
            }
        };

        const ageGroups = ['6-8', '8-10', '10-13', '13-15', '15-18'];

        for (let i = 1; i <= 30; i++) {
            for (const age of ageGroups) {
                const mathId = await insertBundle('math', age, `אתגר חשבון ${i}`, null);
                await insertQuestions(mathId, generateMath(age));

                const readBase = readingContent.find(c => c.age_group === age) || readingContent[0];
                const readId = await insertBundle('reading', age, `${readBase.title} - חלק ${i}`, readBase.text);
                await insertQuestions(readId, readBase.questions);

                const engBase = englishContent.find(c => c.age_group === age) || englishContent[0];
                const engId = await insertBundle('english', age, `English Test ${i} (${engBase.title})`, null);
                await insertQuestions(engId, engBase.questions);

                const finBase = financialContent.find(c => c.age_group === age) || financialContent[0];
                const finId = await insertBundle('financial', age, `פיננסי: ${finBase.title} (${i})`, finBase.text);
                await insertQuestions(finId, finBase.questions);
            }
        }
        console.log("Seeding complete: Created ~600 quiz bundles!");

    } catch (e) {
        console.error("Seeding error:", e);
    }
}

// SETUP ROUTE (RESET DB)
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
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS family_groups CASCADE;

            CREATE TABLE family_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                type VARCHAR(20) DEFAULT 'FAMILY',
                admin_email VARCHAR(100) UNIQUE,
                group_code VARCHAR(10) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            CREATE TABLE transactions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                amount DECIMAL(10,2),
                description VARCHAR(255),
                category VARCHAR(50),
                type VARCHAR(20),
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_manual BOOLEAN DEFAULT TRUE
            );
            CREATE TABLE tasks (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                created_by INT REFERENCES users(id),
                assigned_to INT REFERENCES users(id),
                title VARCHAR(255),
                reward DECIMAL(10,2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE budget_allocations (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                category VARCHAR(50),
                target_user_id INT REFERENCES users(id) ON DELETE CASCADE,
                amount_limit DECIMAL(10,2) DEFAULT 0.00
            );
            CREATE TABLE goals (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
                title VARCHAR(255),
                target_amount DECIMAL(10,2),
                current_amount DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE loans (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                original_amount DECIMAL(10,2),
                remaining_amount DECIMAL(10,2),
                reason VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE shopping_list (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                requester_id INT REFERENCES users(id),
                item_name VARCHAR(100),
                quantity INT DEFAULT 1,
                estimated_price DECIMAL(10,2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'pending',
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE shopping_trips (
                id SERIAL PRIMARY KEY,
                group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
                buyer_id INT REFERENCES users(id),
                store_name VARCHAR(100),
                branch_name VARCHAR(100),
                total_amount DECIMAL(10,2),
                trip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE shopping_trip_items (
                id SERIAL PRIMARY KEY,
                trip_id INT REFERENCES shopping_trips(id) ON DELETE CASCADE,
                item_name VARCHAR(100),
                quantity INT,
                price_per_unit DECIMAL(10,2)
            );
            
            -- ACADEMY TABLES
            CREATE TABLE quiz_bundles (
                id SERIAL PRIMARY KEY,
                type VARCHAR(20), 
                age_group VARCHAR(10),
                title VARCHAR(255),
                text_content TEXT, 
                threshold INT DEFAULT 85,
                reward DECIMAL(10,2) DEFAULT 10.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE quiz_questions (
                id SERIAL PRIMARY KEY,
                bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE,
                q TEXT,
                options JSONB,
                correct INT
            );
            CREATE TABLE user_assignments (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                bundle_id INT REFERENCES quiz_bundles(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'assigned', 
                score INT,
                custom_reward DECIMAL(10,2),
                deadline TIMESTAMP,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await seedDatabase();

        res.send('<h1>Oneflow Life System Ready 🚀</h1><p>DB tables reset and created. Academy seeded.</p><a href="/">Go to App</a>');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- API ROUTES ---

// Auth
app.post('/api/groups', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        
        let code = generateGroupCode();
        let codeCheck = await dbClient.query('SELECT id FROM family_groups WHERE group_code = $1', [code]);
        while(codeCheck.rows.length > 0) {
            code = generateGroupCode();
            codeCheck = await dbClient.query('SELECT id FROM family_groups WHERE group_code = $1', [code]);
        }

        const gRes = await dbClient.query(
            `INSERT INTO family_groups (type, name, admin_email, group_code) VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.body.type, req.body.groupName, req.body.adminEmail, code]
        );
        const group = gRes.rows[0];
        const uRes = await dbClient.query(
            `INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, 'ADMIN', 'active') RETURNING *`,
            [group.id, req.body.adminNickname, req.body.birthYear, req.body.password]
        );
        await dbClient.query('COMMIT');
        res.json({ success: true, user: uRes.rows[0], group: group });
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        dbClient.release();
    }
});

app.post('/api/join', async (req, res) => {
    try {
        const { groupCode, nickname, birthYear, password, role } = req.body;
        const gRes = await pool.query('SELECT id FROM family_groups WHERE group_code = $1', [groupCode.toUpperCase()]);
        if (gRes.rows.length === 0) return res.status(404).json({ error: 'קוד משפחה לא חוקי' });
        
        const group = gRes.rows[0];
        const reqRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

        await pool.query(
            `INSERT INTO users (group_id, nickname, birth_year, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'pending')`,
            [group.id, nickname, birthYear, password, reqRole]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const u = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (u.rows.length > 0) res.json(u.rows[0]); else res.status(404).json({error: 'Not found'});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Dash Data - MASSIVELY OPTIMIZED WITH PROMISE.ALL
app.get('/api/data/:userId', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.userId]);
        if(uRes.rows.length===0) return res.status(404).json({error: 'No user'});
        const user = uRes.rows[0];

        // Run all independent queries in parallel
        const [tasksRes, shopRes, allBRes] = await Promise.all([
            pool.query(`SELECT t.*, u.nickname as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.group_id=$1 ORDER BY t.created_at DESC`, [user.group_id]),
            pool.query(`SELECT s.*, u.nickname as requester_name FROM shopping_list s LEFT JOIN users u ON s.requester_id = u.id WHERE s.group_id=$1 ORDER BY s.added_at DESC`, [user.group_id]),
            pool.query(`SELECT id, type, age_group, title, reward FROM quiz_bundles ORDER BY type, age_group`)
        ]);

        let goalsRes, weeklyStats = null, userBundles = [];

        // Admin vs Member specific parallel queries
        if(user.role === 'ADMIN') {
            goalsRes = await pool.query(`SELECT g.*, u.nickname as owner_name FROM goals g LEFT JOIN users u ON g.target_user_id = u.id WHERE g.user_id=$1 OR g.target_user_id IN (SELECT id FROM users WHERE group_id=$2)`, [user.id, user.group_id]);
        } else {
            const [gRes, spentRes, limitRes, ubRes] = await Promise.all([
                pool.query(`SELECT * FROM goals WHERE target_user_id=$1`, [user.id]),
                pool.query(`SELECT COALESCE(SUM(amount),0) as spent FROM transactions WHERE user_id=$1 AND type='expense' AND date >= date_trunc('week', CURRENT_DATE)`, [user.id]),
                pool.query(`SELECT COALESCE(amount_limit, 0) as limit FROM budget_allocations WHERE target_user_id=$1 AND category='allowance_spend'`, [user.id]),
                pool.query(`
                    SELECT ua.status, ua.score, ua.deadline, ua.custom_reward, 
                           qb.id as bundle_id, qb.title, qb.type, qb.threshold, qb.reward as default_reward, qb.text_content
                    FROM user_assignments ua 
                    JOIN quiz_bundles qb ON ua.bundle_id = qb.id 
                    WHERE ua.user_id = $1
                    ORDER BY ua.assigned_at DESC
                `, [user.id])
            ]);
            goalsRes = gRes;
            weeklyStats = { spent: spentRes.rows[0].spent, limit: limitRes.rows.length > 0 ? limitRes.rows[0].limit : user.allowance_amount * 0.2 };
            userBundles = ubRes.rows;

            // Fix N+1 query problem for quiz questions
            const activeBundleIds = userBundles.filter(b => b.status === 'assigned').map(b => b.bundle_id);
            if (activeBundleIds.length > 0) {
                const qRes = await pool.query(`SELECT id, bundle_id, q, options, correct FROM quiz_questions WHERE bundle_id = ANY($1::int[])`, [activeBundleIds]);
                userBundles.forEach(b => {
                    if (b.status === 'assigned') {
                        b.questions = qRes.rows.filter(q => q.bundle_id === b.bundle_id);
                    }
                });
            }
        }

        res.json({
            user: user,
            tasks: tasksRes.rows,
            shopping_list: shopRes.rows,
            goals: goalsRes ? goalsRes.rows : [],
            weekly_stats: weeklyStats,
            quiz_bundles: userBundles,
            all_bundles: allBRes.rows
        });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Admin Panel (Pending Users)
app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const { groupId } = req.query;
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

// Group Members
app.get('/api/group/members', async (req, res) => {
    try {
        const uReq = await pool.query('SELECT role FROM users WHERE id=$1', [req.query.requesterId]);
        const isAdmin = uReq.rows[0].role === 'ADMIN';
        const members = await pool.query('SELECT id, nickname, role, birth_year, balance, allowance_amount, interest_rate FROM users WHERE group_id=$1 AND status=$2', [req.query.groupId, 'active']);
        if(isAdmin) res.json(members.rows);
        else res.json(members.rows.map(m => ({id: m.id, nickname: m.nickname, role: m.role, birth_year: m.birth_year, balance: m.id == req.query.requesterId ? m.balance : null})));
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
            
            if (spent <= limit && parseFloat(child.balance) > 0) {
                 interest = parseFloat(child.balance) * ((parseFloat(child.interest_rate)||0) / 100);
            }
            
            const totalAdded = allowance + interest;
            if(totalAdded > 0) {
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [totalAdded, child.id]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'allowance', 'income', FALSE)`, 
                    [child.id, req.body.groupId, totalAdded, `יום תשלום: ${allowance} דמי כיס + ${interest.toFixed(2)} ריבית`]
                );
                totalDistributed += totalAdded;
            }
        }
        await dbClient.query('COMMIT');
        res.json({success: true, totalDistributed});
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({error: e.message});
    } finally { dbClient.release(); }
});

// Transactions
app.post('/api/transaction', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [req.body.userId]);
        await dbClient.query('BEGIN');
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type) VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.body.userId, u.rows[0].group_id, req.body.amount, req.body.description, req.body.category, req.body.type]);
        const op = req.body.type === 'income' ? '+' : '-';
        await dbClient.query(`UPDATE users SET balance = balance ${op} $1 WHERE id = $2`, [req.body.amount, req.body.userId]);
        
        if (req.body.type === 'expense') {
            await dbClient.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING`, [u.rows[0].group_id, req.body.category, req.body.userId]);
        }
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const limit = req.query.limit ? `LIMIT ${parseInt(req.query.limit)}` : '';
        const { groupId, userId } = req.query;
        
        const uReq = await pool.query('SELECT role FROM users WHERE id=$1', [userId]);
        const isAdmin = uReq.rows[0].role === 'ADMIN';

        let query, params;
        if(isAdmin) {
             query = `SELECT t.*, u.nickname as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.group_id=$1 ORDER BY t.date DESC ${limit}`;
             params = [groupId];
        } else {
             query = `SELECT t.* FROM transactions t WHERE t.user_id=$1 ORDER BY t.date DESC ${limit}`;
             params = [userId];
        }

        const t = await pool.query(query, params);
        res.json(t.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tasks
app.post('/api/tasks', async (req, res) => {
    try {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.body.assignedTo]);
        await pool.query(`INSERT INTO tasks (group_id, created_by, assigned_to, title, reward) VALUES ($1, $2, $3, $4, $5)`,
            [u.rows[0].group_id, req.body.assignedTo, req.body.assignedTo, req.body.title, req.body.reward]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/update', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const t = (await dbClient.query('SELECT * FROM tasks WHERE id=$1', [req.body.taskId])).rows[0];
        
        if (req.body.status === 'completed_self') {
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', ['approved', req.body.taskId]);
        }
        else if (req.body.status === 'approved' && t.reward > 0) {
            await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [t.reward, t.assigned_to]);
            await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'tasks', 'income', FALSE)`,
                [t.assigned_to, t.group_id, t.reward, `תגמול משימה: ${t.title}`]);
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', ['approved', req.body.taskId]);
        } else {
            await dbClient.query('UPDATE tasks SET status = $1 WHERE id = $2', [req.body.status, req.body.taskId]);
        }
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

// Goals
app.post('/api/goals', async (req, res) => {
    try {
        const { userId, targetUserId, title, target } = req.body;
        const finalTargetId = targetUserId || userId;
        await pool.query(`INSERT INTO goals (user_id, target_user_id, title, target_amount) VALUES ($1, $2, $3, $4)`,
            [userId, finalTargetId, title, target]);
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
        
        if (parseFloat(u.balance) < parseFloat(amount)) {
            await dbClient.query('ROLLBACK');
            return res.status(400).json({ error: 'אין מספיק יתרה' });
        }

        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [amount, userId]);
        await dbClient.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [amount, goalId]);
        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'savings', 'expense', FALSE)`,
                [userId, u.group_id, amount, `הפקדה ליעד: ${g.title}`]);
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

// Shopping
app.post('/api/shopping/add', async (req, res) => {
    try {
        const uRes = await pool.query('SELECT group_id, role FROM users WHERE id=$1', [req.body.userId]);
        const user = uRes.rows[0];
        const initialStatus = user.role === 'ADMIN' ? 'pending' : 'requested';
        
        const iRes = await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, estimated_price, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [user.group_id, req.body.userId, req.body.itemName, req.body.quantity, req.body.estimatedPrice || 0, initialStatus]);
        
        let alert = null;
        const itemLower = req.body.itemName.toLowerCase();
        if (itemLower.includes('קוקה קולה') || itemLower.includes('קולה')) alert = { type: 'brand', msg: 'טיפ צרכנות: קריסטל או RC קולה זולים משמעותית. נסה?' };
        else if (itemLower.includes('במבה') && !itemLower.includes('אסם')) alert = { type: 'brand', msg: 'שוש עולה כ-25% פחות. שווה בדיקה!' };
        else if (itemLower.includes('מילקי')) alert = { type: 'brand', msg: 'מעדן שוקולד קצפת של טרה/תנובה לרוב זול יותר ממילקי.' };
        
        res.json({ success: true, id: iRes.rows[0].id, alert });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shopping/update', async (req, res) => {
    try {
        const { itemId, status, estimatedPrice } = req.body;
        let alert = null;

        if (status) await pool.query('UPDATE shopping_list SET status=$1 WHERE id=$2', [status, itemId]);
        if (estimatedPrice !== undefined) {
             await pool.query('UPDATE shopping_list SET estimated_price=$1 WHERE id=$2', [estimatedPrice, itemId]);
             const itemRes = await pool.query('SELECT item_name FROM shopping_list WHERE id=$1', [itemId]);
             if (itemRes.rows.length > 0) {
                 const name = itemRes.rows[0].item_name;
                 const price = parseFloat(estimatedPrice);
                 if (name.includes('חלב') && price > 6.2) alert = { msg: 'שים לב: מחיר חלב בפיקוח הוא כ-6.23 ש"ח.' };
                 if (name.includes('לחם אחיד') && price > 7.1) alert = { msg: 'שים לב: מחיר לחם אחיד בפיקוח הוא כ-7.10 ש"ח.' };
             }
        }
        res.json({ success: true, alert });
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
        
        const tripRes = await dbClient.query(`INSERT INTO shopping_trips (group_id, buyer_id, store_name, branch_name, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [u.group_id, userId, storeName || 'סופר', branchName || '', totalAmount]);
        const tripId = tripRes.rows[0].id;

        for (let item of boughtItems) {
            await dbClient.query(`INSERT INTO shopping_trip_items (trip_id, item_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4)`, [tripId, item.name, item.quantity, item.price]);
            await dbClient.query(`DELETE FROM shopping_list WHERE id=$1`, [item.id]);
        }
        for (let item of missingItems) {
            await dbClient.query(`UPDATE shopping_list SET status='pending' WHERE id=$1`, [item.id]);
        }

        await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'groceries', 'expense', FALSE)`, [userId, u.group_id, totalAmount, `קניות בסופר: ${storeName}`]);
        await dbClient.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [totalAmount, userId]);
        
        await dbClient.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { dbClient.release(); }
});

app.get('/api/shopping/history', async (req, res) => {
    try {
        const trips = await pool.query(`SELECT st.*, u.nickname FROM shopping_trips st JOIN users u ON st.buyer_id = u.id WHERE st.group_id=$1 ORDER BY st.trip_date DESC LIMIT 10`, [req.query.groupId]);
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
            await pool.query(`INSERT INTO shopping_list (group_id, requester_id, item_name, quantity, status) VALUES ($1, $2, $3, $4, 'pending')`, [u.group_id, userId, i.item_name, i.quantity]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Budget Filter
app.get('/api/budget/filter', async (req, res) => {
    try {
        const { groupId, targetUserId } = req.query;
        let expenses;
        let limitsQuery = `SELECT category, amount_limit as limit FROM budget_allocations WHERE group_id=$1`;
        let limitParams = [groupId];

        if (targetUserId && targetUserId !== 'all') {
            expenses = await pool.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE group_id=$1 AND user_id=$2 AND type='expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [groupId, targetUserId]);
            limitsQuery += ` AND target_user_id=$2`;
            limitParams.push(targetUserId);
        } else {
            expenses = await pool.query(`SELECT category, SUM(amount) as spent FROM transactions WHERE group_id=$1 AND type='expense' AND date >= date_trunc('month', CURRENT_DATE) GROUP BY category`, [groupId]);
            limitsQuery = `SELECT category, SUM(amount_limit) as limit FROM budget_allocations WHERE group_id=$1 GROUP BY category`;
        }

        const limits = await pool.query(limitsQuery, limitParams);
        const result = [];
        const cats = new Set([...expenses.rows.map(r=>r.category), ...limits.rows.map(r=>r.category)]);
        
        cats.forEach(c => {
            const spent = expenses.rows.find(r=>r.category === c)?.spent || 0;
            const limit = limits.rows.find(r=>r.category === c)?.limit || 0;
            result.push({ category: c, spent: parseFloat(spent), limit: parseFloat(limit) });
        });

        if (targetUserId === 'all') {
             const allocations = await pool.query(`SELECT SUM(amount) as spent FROM transactions WHERE group_id=$1 AND category='allowance' AND type='income' AND date >= date_trunc('month', CURRENT_DATE)`, [groupId]);
             if (allocations.rows[0].spent > 0) result.push({ category: 'allocations', spent: parseFloat(allocations.rows[0].spent), limit: 0 });
        }

        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/update', async (req, res) => {
    try {
        const { groupId, category, limit, targetUserId } = req.body;
        const target = targetUserId === 'all' ? null : targetUserId;
        const exists = await pool.query(`SELECT id FROM budget_allocations WHERE group_id=$1 AND category=$2 AND (target_user_id=$3 OR ($3 IS NULL AND target_user_id IS NULL))`, [groupId, category, target]);
        if (exists.rows.length > 0) await pool.query(`UPDATE budget_allocations SET amount_limit=$1 WHERE id=$2`, [limit || 0, exists.rows[0].id]);
        else await pool.query(`INSERT INTO budget_allocations (group_id, category, target_user_id, amount_limit) VALUES ($1, $2, $3, $4)`, [groupId, category, target, limit || 0]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Academy
app.get('/api/academy/bundles', async (req, res) => {
    try {
        const bundles = await pool.query(`SELECT id, type, age_group, title, reward, threshold FROM quiz_bundles ORDER BY type, age_group`);
        res.json(bundles.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/assign', async (req, res) => {
    try {
        const { userId, bundleId, reward, days } = req.body;
        let deadline = null;
        if (days && parseInt(days) > 0) {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + parseInt(days));
        }

        const existing = await pool.query(`SELECT id FROM user_assignments WHERE user_id=$1 AND bundle_id=$2 AND status='assigned'`, [userId, bundleId]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'מבחן זה כבר משויך לילד' });

        await pool.query(`INSERT INTO user_assignments (user_id, bundle_id, custom_reward, deadline) VALUES ($1, $2, $3, $4)`, [userId, bundleId, reward || null, deadline]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/request-challenge', async (req, res) => {
    try {
        const { userId, bundleId } = req.body;
        const user = await pool.query(`SELECT birth_year FROM users WHERE id=$1`, [userId]);
        const age = calculateAge(user.rows[0].birth_year);
        const ageGroup = getAgeGroup(age);

        let targetBundleId = bundleId;

        if (!targetBundleId) {
            const available = await pool.query(`SELECT id FROM quiz_bundles WHERE age_group = $1 AND id NOT IN (SELECT bundle_id FROM user_assignments WHERE user_id=$2)`, [ageGroup, userId]);
            if (available.rows.length === 0) return res.status(404).json({ error: 'לא מצאנו אתגרים חדשים לגיל שלך כרגע.' });
            targetBundleId = available.rows[Math.floor(Math.random() * available.rows.length)].id;
        }

        await pool.query(`INSERT INTO user_assignments (user_id, bundle_id) VALUES ($1, $2)`, [userId, targetBundleId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/academy/submit', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { userId, bundleId, score } = req.body;
        
        const assignment = await dbClient.query(`
            SELECT ua.id, ua.custom_reward, qb.reward as default_reward, qb.threshold, qb.title
            FROM user_assignments ua JOIN quiz_bundles qb ON ua.bundle_id = qb.id
            WHERE ua.user_id = $1 AND ua.bundle_id = $2 AND ua.status = 'assigned'
            ORDER BY ua.assigned_at DESC LIMIT 1
        `, [userId, bundleId]);

        if (assignment.rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(400).json({ error: 'Assignment not found or already completed.' });
        }

        const a = assignment.rows[0];
        const passed = score >= a.threshold;
        const status = passed ? 'completed' : 'failed';
        
        await dbClient.query(`UPDATE user_assignments SET status=$1, score=$2 WHERE id=$3`, [status, score, a.id]);

        if (passed) {
            const reward = a.custom_reward !== null ? parseFloat(a.custom_reward) : parseFloat(a.default_reward);
            if (reward > 0) {
                const u = await dbClient.query('SELECT group_id FROM users WHERE id=$1', [userId]);
                await dbClient.query(`UPDATE users SET balance = balance + $1 WHERE id=$2`, [reward, userId]);
                await dbClient.query(`INSERT INTO transactions (user_id, group_id, amount, description, category, type, is_manual) VALUES ($1, $2, $3, $4, 'academy', 'income', FALSE)`,
                    [userId, u.rows[0].group_id, reward, `בונוס אקדמיה: ${a.title}`]);
            }
        }

        await dbClient.query('COMMIT');
        res.json({ success: true, passed });
    } catch (e) {
        await dbClient.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { dbClient.release(); }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
