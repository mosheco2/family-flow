// תיקון סגנונות הרמטי לספריית הסיור
const introStyle = document.createElement('style');
introStyle.innerHTML = `
    .introjs-showElement { z-index: 9999998 !important; transform: none !important; }
    .introjs-fixParent { z-index: auto !important; opacity: 1.0 !important; transform: none !important; filter: none !important; }
    body.introjs-active .slider-container, body.introjs-active .slider-scroll, body.introjs-active .overflow-hidden { overflow: visible !important; }
    body.introjs-active header.sticky { z-index: 1 !important; }
    .introjs-overlay { z-index: 9999996 !important; }
    .introjs-helperLayer { z-index: 9999997 !important; }
    .introjs-tooltipReferenceLayer { z-index: 9999998 !important; }
    .introjs-tooltip { z-index: 9999999 !important; }
    @media (max-width: 768px) {
        .introjs-tooltipReferenceLayer { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important; right: auto !important; bottom: auto !important; width: 90vw !important; }
        .introjs-tooltip { position: relative !important; max-width: 350px !important; margin: 0 auto !important; left: auto !important; right: auto !important; top: auto !important; bottom: auto !important; }
        .introjs-arrow { display: none !important; }
    }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false;

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'} ], 
    expense: [ {value:'food',label:'🍔 מסעדות וטייקאווי'}, {value:'groceries',label:'🛒 סופר ופארם'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך וחוגים'}, {value:'vacation',label:'✈️ חופשות וטיולים'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} ] 
};
const BUDGET_LABELS = { 'food': '🍔 מסעדות', 'groceries': '🛒 סופר ופארם', 'transport': '🚌 תחבורה ודלק', 'home': '🏠 דיור ותחזוקה', 'bills': '📄 חשבונות ותקשורת', 'fun': '🎉 פנאי ובילויים', 'clothes': '👕 ביגוד והנעלה', 'health': '💊 בריאות וביטוחים', 'education': '📚 חינוך וחוגים', 'vacation': '✈️ חופשות', 'pets': '🐶 חיות מחמד', 'gifts': '🎁 מתנות ותרומות', 'other': '💸 אחר', 'allocations': '👶 הפרשות כלליות', 'allowance': '💰 דמי כיס לילדים', 'tasks': '✅ תגמול על משימות', 'academy': '🎓 אתגרי אקדמיה', 'savings': '🐖 הפקדות לחיסכון' };
const PRODUCT_DB = { 
    "ירקות ופירות 🍎": ["עגבניות", "מלפפונים", "פלפל אדום", "בצל יבש", "תפוחי אדמה", "בננות", "לימון", "תפוח עץ", "אבוקדו"], 
    "חלב וביצים 🥛": ["חלב 3%", "קוטג' 5%", "גבינה לבנה 5%", "גבינה צהובה", "ביצים L", "יוגורט", "חמאה", "שמנת"], 
    "לחם ומאפים 🍞": ["לחם אחיד", "לחם מלא", "פיתות", "לחמניות"], 
    "מזווה ובישול 🍝": ["אורז", "פסטה", "פתיתים", "עדשים", "שמן זית", "שמן קנולה", "סוכר", "מלח", "קמח", "קפה", "תה"], 
    "בשר ודגים 🍗": ["חזה עוף", "בשר טחון", "שניצל", "נקניקיות", "סלמון"], 
    "ניקיון וטואלטיקה 🧻": ["נייר טואלט", "מגבונים", "נוזל כלים", "אבקת כביסה", "שמפו", "משחת שיניים"], 
    "חטיפים ומתוקים 🍫": ["במבה", "ביסלי", "בייגלה", "עוגיות", "שוקולד"] 
};
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

const hidePreloaderAndShowAuth = (view = 'login') => {
    document.getElementById('auth-container').classList.remove('hidden');
    switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
        preloader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => preloader.classList.add('hidden'), 700);
    }
};

window.onload = async () => { 
    initAccessibility();
    const failsafeTimer = setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader && !preloader.classList.contains('hidden')) {
            console.warn('Failsafe triggered');
            hidePreloaderAndShowAuth('login');
        }
    }, 7000);

    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { 
        document.getElementById('join-code').value = inviteCode; 
        if(inviteRole) document.getElementById('join-role').value = inviteRole; 
        clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; 
    }
    
    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { 
                const res = await fetch(`${API}/users/${session.user.id}`); 
                if(res.ok) { 
                    currentUser = await res.json(); currentGroup = session.group; 
                    localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup})); 
                    clearTimeout(failsafeTimer); await loadDashboard(); 
                } else { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
            } else { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
        } catch(e) { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); } 
    } else { clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
};

// --- SUPER ADMIN LOGIC ---
async function handleSALogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) });
        const data = await res.json();
        if(data.success) { saToken = data.token; document.getElementById('auth-container').classList.add('hidden'); document.getElementById('sa-dashboard-container').classList.remove('hidden'); loadSAData(); } 
        else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); }
}
function logoutSA() { saToken = null; document.getElementById('sa-dashboard-container').classList.add('hidden'); document.getElementById('auth-container').classList.remove('hidden'); switchView('login'); }

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        document.getElementById('sa-welcome-msg').value = data.welcomeMsg || '';
        const actList = document.getElementById('sa-activity-list');
        actList.innerHTML = data.activity.map(a => {
            const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`;
            return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | משפחת <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`;
        }).join('');
        if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        
        saAllGroups = data.groups;
        saAllUsers = data.users;
        renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); 
    let gHtml = '';
    const term = filterText.toLowerCase();

    const filteredGroups = saAllGroups.filter(g => 
        (g.name && g.name.toLowerCase().includes(term)) || 
        (g.group_code && g.group_code.toLowerCase().includes(term))
    );

    if(filteredGroups.length === 0) {
        groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו משפחות התואמות לחיפוש.</p>';
        return;
    }

    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים במשפחה זו.</p>';
        
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        
        gHtml += `
            <div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm">
                <div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid fa-users"></i></div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${isPro}</h3>
                            <p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down text-slate-300"></i>
                </div>
                <div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <div class="mt-3 mb-2 flex justify-between items-center">
                        <h4 class="text-xs font-bold text-slate-600">משתמשים:</h4>
                        <button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק משפחה</button>
                    </div>
                    ${uHtml}
                </div>
            </div>
        `;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() {
    const term = document.getElementById('sa-search-group').value;
    renderSAGroups(term);
}

async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('האם למחוק משפחה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משפחה נמחקה לחלוטין'); loadSAData(); }
async function saveWelcomeMsg() { await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ welcomeMsg: val('sa-welcome-msg') }) }); showToast('success', 'הודעת הפתיחה נשמרה!'); }

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}
function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 300); }

// --- GUIDED TOURS ---
function startAdminTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו המשפחה שלכם מתנהלת פיננסית. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "מרכז השליטה שלכם", intro: "כאן תמצאו את קוד המשפחה שאיתו תזמינו את הילדים. לחיצה על המד של 'familAI' או על 'תפריט' תפתח את אזור ההגדרות והשדרוגים.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "המערכת שלנו מונעת ע\"י בינה מלאכותית מתקדמת (familAI). כאן תוכלו לראות את כמות הפעולות היומית החינמית שנותרה לכם.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תוכלו לראות בזמן אמת את היתרה הפנויה של המשפחה, כך שתמיד תדעו בדיוק איפה אתם עומדים.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "לחיצה קטנה על כפתור הפלוס מאפשרת לכם לרשום הוצאה או הכנסה מכל מקום באפליקציה, בלי לבזבז זמן.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "הסוף לקבוצות וואטסאפ מבולגנות! רשימת קניות משותפת לכולם. בנוסף, תוכלו לצלם את הקבלה מהסופר ו-familAI תזין את הנתונים בעצמה!", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מזווה 📦", intro: "המקרר מתרוקן בלי ששמתם לב? עקבו אחרי המלאי בבית, וכשמוצר נגמר – העבירו אותו לרשימת הקניות בקליק אחד.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "כאן בונים עצמאות פיננסית! הגדירו דמי כיס שבועיים אוטומטיים לילדים, חלקו ריביות על חסכונות ולמדו אותם לנהל כסף.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות הבית ✅", intro: "הדרך המושלמת לרתום את הילדים לעזרה: הגדירו משימות, תמחרו אותן, והילדים יצלמו את התוצר לטובת קבלת התגמול.", position: 'bottom' },
            { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "ללמוד על כסף דרך משחק! יצרו לילדים אתגרים חינוכיים בהתאמה אישית עם ה-AI, ותגמלו אותם על תשובות נכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות חודשיים לכל קטגוריה. familAI תנתח את ההוצאות שלכם ותספק לכם תובנות וטיפים יקרי ערך לחיסכון.", position: 'bottom' },
            { element: '#tab-recipes', title: "השף הפרטי שלכם 👨‍🍳", intro: "נתקעתם בלי רעיון לארוחת ערב? סמנו אילו מוצרים יש לכם במזווה, וה-AI שלנו ירקח עבורכם מתכון מושלם תוך שניות!", position: 'bottom' },
            { element: '#tab-members', title: "הזמנת המשפחה 👨‍👩‍👧‍👦", intro: "מכאן תוכלו לשלוח הזמנה מהירה בוואטסאפ לילדים ולבן/בת הזוג להצטרף. שיהיה בהצלחה!", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { targetElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startChildTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות: להרוויח כסף, לחסוך נכון, ולעזור בבית כמו גדולים. בואו נתחיל!" },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "הכירו את familAI - העוזרת החכמה והסודית שלנו! כאן אפשר לראות את מד האנרגיה שלה להיום.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "כאן מופיע כל הכסף שהרווחת מביצוע משימות ומדמי הכיס. זה הזמן לחשוב על מה כדאי לחסוך!", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "מתחשק לך חטיף או ארטיק? אין צורך לשגע את ההורים, פשוט בקש להוסיף את זה לרשימת הקניות כאן.", position: 'bottom' },
            { element: '#tab-pantry', title: "המזווה 📦", intro: "בא לך לנשנש משהו? כאן אפשר לבדוק בקלות אילו ממתקים או מוצרים טעימים כבר מחכים לכם בבית.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "המקום שבו הכסף שלך צומח! פתח 'קופת חיסכון' למטרה שאתה חולם עליה, ותראה את הריבית מצטברת.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "רוצה להרוויח כסף? בחר משימה, סיים אותה, צלם הוכחה - וקבל את התגמול ישר לארנק!", position: 'bottom' },
            { element: '#tab-academy', title: "האקדמיה 🎓", intro: "מי אמר שללמוד זה משעמם? היכנס לכאן כדי לענות על חידונים כיפיים ותרוויח בונוסים על תשובות נכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "כאן תוכל לראות על מה בזבזת את דמי הכיס החודש, וללמוד לתכנן קניות חכם יותר.", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "רוצה להפתיע את המשפחה? בחר מוצרים שיש במטבח, והשף החכם ייתן לך מתכון מנצח וקל להכנה!", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { targetElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); document.getElementById(`view-${view}`).classList.remove('hidden'); }
function selectType(t) { document.getElementById('create-type').value=t; document.getElementById('type-family').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; document.getElementById('type-group').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { e.preventDefault(); if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); const d=await res.json(); if(d.success) { showToast('success', 'נשלח בהצלחה!'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); }

async function authAction(endpoint, body) { 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); await loadDashboard(); } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','academy','members','budget','pantry','recipes'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } else { try { renderShopList(); } catch(e) {} }
    if (t === 'pantry') renderPantry();
    if (t === 'recipes') renderRecipePantrySelection();
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator');
    if(!indicator || !currentGroup) return;
    
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    
    if (currentGroup.is_premium) {
        indicator.innerHTML = '⚡ ∞ (Pro)';
        indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent');
    } else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
        indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200');
        else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200');
        else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = document.getElementById('ai-battery-modal');
        const upgradeSec = document.getElementById('ai-upgrade-section');
        if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden');
        else upgradeSec.classList.add('hidden');
        modal.classList.remove('hidden');
        return false;
    }
    return true;
}

function closeAiBatteryModal() { document.getElementById('ai-battery-modal').classList.add('hidden'); }

async function upgradeToPremium() {
    const btn = document.getElementById('btn-upgrade-premium');
    if(btn) { btn.disabled = true; btn.innerText = 'מעביר לתשלום... ⏳'; }
    const profileBtn = document.getElementById('btn-profile-upgrade');
    if(profileBtn) { profileBtn.disabled = true; profileBtn.innerText = 'מעביר...'; }
    try {
        const res = await fetch(`${API}/premium/simulate-checkout`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, userId: currentUser.id }) });
        const data = await res.json();
        if(data.success) {
            closeAiBatteryModal();
            document.getElementById('profile-modal').classList.add('hidden');
            showToast('success', data.message);
            triggerConfetti();
            fetchData();
        } else {
            showToast('error', data.error);
        }
    } catch(e) { showToast('error', 'תקלה במעבר לתשלום'); } finally { 
        if(btn) { btn.disabled = false; btn.innerText = 'שדרגו ל-Pro 🚀'; }
        if(profileBtn) { profileBtn.disabled = false; profileBtn.innerText = 'שדרגו למנוי פרימיום (9.90₪)'; }
    }
}

async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden'); document.getElementById('dashboard-container').classList.remove('hidden'); document.getElementById('fab-container').classList.remove('hidden');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
    document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} ${codeBadge}`; 
    
    const isAdmin = currentUser.role === 'ADMIN';
    const roleBadge = isAdmin ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2 font-bold shadow-sm">מנהל</span>' : '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full mr-2 font-bold shadow-sm">ילד</span>';
    document.getElementById('dash-nickname').innerHTML = `${currentUser.nickname || 'משתמש'} ${roleBadge}`; 
    document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'admin-tasks-hint', 'profile-upgrade-section'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) {
            profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>';
        }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        document.getElementById('card-name').innerText = (currentUser.nickname || 'USER').toUpperCase(); document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
    }
    document.getElementById('btn-add-budget-cat').classList.remove('hidden');
    updateBatteryUI();
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); if(isAdmin) fetchPendingUsers(); }, 30000);
        fetchBanners();
        await fetchMembers(); 
        if(isAdmin) fetchPendingUsers(); 
        await fetchData();
    } catch (e) {
        console.error('Error fetching dashboard data:', e);
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => {
            const showedWelcome = await checkGlobalWelcome();
            if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; }
        };
        if (preloader && !preloader.classList.contains('hidden')) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); 
        } else { finalizeLoad(); }
    }
}

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל הבית</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור מי היעד? (כללי/למשפחה)</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = document.getElementById('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = document.getElementById('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים במשפחה עדיין.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'ילד'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/שבוע • ${m.interest_rate || 0}% ריבית</p></div></div><div class="flex gap-2"><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); 
        if(!res.ok) { console.error('Data fetch failed'); return; }
        
        const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens;
            currentGroup.is_premium = data.group.is_premium;
            updateBatteryUI();
            
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) {
                profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>';
            }
        }

        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); 
            const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}

        try {
            const myLoansList = document.getElementById('my-loans-list');
            const adminLoansList = document.getElementById('admin-loans-list');
            const adminLoansContainer = document.getElementById('admin-loans-container');

            if(currentUser.role === 'ADMIN') {
                if(adminLoansList && adminLoansContainer) {
                    const pendingLoans = data.loans ? data.loans.filter(l => l.status === 'pending') : [];
                    if(pendingLoans.length > 0) {
                        adminLoansContainer.classList.remove('hidden');
                        let lHtml = '';
                        pendingLoans.forEach(l => {
                            lHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-purple-100 mb-2"><div><span class="font-bold text-slate-700">${l.user_name} מבקש/ת ₪${l.original_amount}</span><p class="text-xs text-slate-500">למטרה: ${l.reason}</p></div><div class="flex gap-2"><button onclick="handleLoanAction(${l.id}, 'approve')" class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-600 transition shadow-sm"><i class="fa-solid fa-check"></i></button><button onclick="handleLoanAction(${l.id}, 'reject')" class="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-sm"><i class="fa-solid fa-xmark"></i></button></div></div>`;
                        });
                        adminLoansList.innerHTML = lHtml;
                    } else {
                        adminLoansContainer.classList.add('hidden');
                    }
                }
            } else {
                if(myLoansList) {
                    if(data.loans && data.loans.length > 0) {
                        myLoansList.innerHTML = '';
                        data.loans.forEach(l => {
                            let statusHtml = '';
                            if(l.status === 'pending') statusHtml = '<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-bold border border-orange-200">ממתין להורה</span>';
                            else if(l.status === 'approved') statusHtml = '<span class="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-lg font-bold border border-green-200">אושר</span>';
                            else statusHtml = '<span class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold border border-red-200">נדחה</span>';

                            myLoansList.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><h4 class="font-bold text-slate-800 text-sm">הלוואה: ₪${l.original_amount}</h4><p class="text-[10px] text-slate-500">למטרה: ${l.reason}</p></div>${statusHtml}</div>`;
                        });
                    } else {
                        myLoansList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">לא ביקשת הלוואות עדיין</p>';
                    }
                }
            }
        } catch(e) { console.error('Loans Error:', e); }
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
            }
        } catch(e) {}

        try {
            const limit = currentUser.role === 'ADMIN' ? 50 : 20; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) allTransactions = Array.isArray(await transRes.json()) ? await transRes.json() : [];
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); } catch(e) {}
    } catch(e) { console.error('FetchData Crash:', e); }
}

function showFamilAIModal(title, text) {
    document.getElementById('familai-advisor-modal').classList.remove('hidden'); document.getElementById('familai-modal-subtitle').innerText = title;
    if (text) { document.getElementById('familai-advisor-loading').classList.add('hidden'); document.getElementById('familai-advice-text').innerText = text; document.getElementById('familai-advisor-content').classList.remove('hidden'); } 
    else { document.getElementById('familai-advisor-loading').classList.remove('hidden'); document.getElementById('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
async function generateAIQuiz() {
    const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳';
    try {
        const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
        const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
        else showToast('error', data.error || 'שגיאה ביצירת המבחן');
    } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
}

async function getFamilAIAdvice(childId, goalId) {
    showFamilAIModal('היועצת הפיננסית של המשפחה', null); document.getElementById('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
    try {
        const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
        if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); fetchData(); } 
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
    } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
}

async function getBudgetInsight() {
    showFamilAIModal('אנליסטית התקציב', null); document.getElementById('familai-loading-text').innerText = 'בודקת על מה הוצאנו החודש...';
    try {
        const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
        if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
    } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
}

async function getPantryInsight() {
    showFamilAIModal('מנהלת המזווה', null); document.getElementById('familai-loading-text').innerText = 'מחשבת כמויות ומרגלי קנייה...';
    try {
        const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
        if(data.success && data.insight) { showFamilAIModal('מנהלת המזווה', data.insight); fetchData(); }
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המזווה'); }
    } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; const w = currentWrongAnswers[0]; document.getElementById('btn-tutor').disabled = true; document.getElementById('btn-tutor').innerText = 'מכינה הסבר... ⏳';
    try {
        const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) { showFamilAIModal('המורה הפרטית שלך', data.explanation); fetchData(); }
    } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { document.getElementById('btn-tutor').disabled = false; document.getElementById('btn-tutor').innerHTML = '<img src="logo.png" alt="AI" class="w-5 h-5 object-contain"> familAI, איפה טעיתי?'; }
}

function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-purple-600 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-purple-600 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
function openTaskModal(isSelf = false) { 
    document.getElementById('task-modal').classList.remove('hidden'); document.getElementById('task-is-self').value = isSelf; 
    document.getElementById('task-days').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-reward').value = ''; document.getElementById('ai-task-topic').value = ''; document.getElementById('ai-task-results').classList.add('hidden');
    setTaskMode('manual');
    const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardGroup = document.getElementById('task-reward-group'); const assigneeSelect = document.getElementById('task-assignee');
    if(isSelf) { document.getElementById('task-modal-title').innerText = 'משימה אישית'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardGroup.classList.add('hidden'); } 
    else { 
        document.getElementById('task-modal-title').innerText = 'יצירת משימה'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardGroup.classList.remove('hidden'); 
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין ילדים רשומים</option>';
        }
    } 
}

async function generateAITasks() {
    const btn = document.getElementById('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = document.getElementById('task-is-self').value === 'true'; 
    let age;
    if (isSelf) age = new Date().getFullYear() - currentUser.birth_year;
    else {
         if(!assigneeId) return showToast('error', 'קודם כל בחרו למעלה עבור מי המשימה 👆');
         const child = membersCache.find(m => String(m.id) === String(assigneeId)); if(!child) return showToast('error', 'שגיאה במציאת גיל הילד');
         age = new Date().getFullYear() - child.birth_year;
    }
    if(!topic) return showToast('error', 'כתבו ל-familAI באיזה נושא לעזור');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> חושבת...';
    try {
        const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic, groupId: currentGroup.id }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success && data.tasks && data.tasks.length > 0) {
            const resultsContainer = document.getElementById('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
            data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
            resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchData();
        } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
    } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; }
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = isSelf ? 0 : val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    await fetch(`${API}/tasks`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward, assignedTo: assignee, days: days }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', 'משימה נוצרה בהצלחה!'); fetchData(); 
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; document.getElementById('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    showFamilAIModal('בקרת איכות', null); document.getElementById('familai-loading-text').innerText = 'familAI בודקת את התמונה שלך...';
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
            const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: file.type, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
        } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ גדול מדי או שגיאת תקשורת.'); }
        event.target.value = '';
    }; reader.readAsDataURL(file);
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    showFamilAIModal('קופאית אוטומטית', null); document.getElementById('familai-loading-text').innerText = 'familAI סורקת את הקבלה... זה ייקח רגע.';
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
            const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: file.type }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success) { showFamilAIModal('קופאית אוטומטית', `סרקתי והוספתי ${data.count} פריטים מהקבלה לעגלה שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת הקבלה.'); }
        } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ גדול מדי או שגיאת תקשורת.'); }
        event.target.value = '';
    }; reader.readAsDataURL(file);
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${p.quantity - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity}</span><button onclick="updatePantryQty(${p.id}, ${p.quantity + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}')" class="bg-pink-50 text-pink-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-pink-100 transition shadow-sm" title="הוסף לקניות"><i class="fa-solid fa-cart-arrow-down"></i></button></div></div>`;
    });
}

function openPantryModal() { document.getElementById('pantry-modal').classList.remove('hidden'); }
async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty}) });
    document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); fetchData(); showToast('success', 'המוצר נוסף למזווה');
}
async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר נגמר! האם למחוק אותו מהמזווה? (מומלץ להוסיף לעגלת הקניות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); }
    fetchData();
}
async function movePantryToCart(pantryId, itemName) {
    await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, estimatedPrice: 0, userId: currentUser.id}) });
    await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לרשימת הקניות!'); fetchData();
}

function renderChildTodo() {
    const todoSection = document.getElementById('child-todo-section'); const todoList = document.getElementById('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-blue-50 transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${t.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • משימה • תגמול: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-purple-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • אתגר לימודי • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function renderTasks(tasks) {
    const list = document.getElementById('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; } else statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; } else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) actionBtn = `<button onclick="updateTask(${t.id}, 'approved')" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; else statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">אישי</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${t.title} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${t.assignee_name}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr;
}

async function updateTask(id, s) { if(s==='done' || s==='approved' || s==='completed_self') triggerConfetti(); await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:s})}); fetchData(); }

function buildAndRenderFeed() {
    feedCache = [];
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח בהצלחה! 🎉', amount: 0, status: 'welcome' }); }
    if(Array.isArray(allTransactions)) { allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); }); }
    if(Array.isArray(allTasks)) { allTasks.forEach(t => { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה: ${t.title}`, amount: t.reward, status: t.status }); }); }
    if(Array.isArray(bundlesCache)) { bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); }); }
    feedCache.sort((a, b) => (b.date && a.date) ? (b.date - a.date) : 0);
    if(currentUser.role === 'ADMIN') { const filterEl = document.getElementById('feed-user-filter'); if (filterEl) filterEl.classList.remove('hidden'); }
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const filterEl = document.getElementById('feed-user-filter'); const list = document.getElementById('unified-feed-list'); if (!list) return;
    const filterUserId = filterEl ? filterEl.value : 'all'; let filtered = feedCache;
    if (currentUser.role !== 'ADMIN') filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); else if (filterUserId !== 'all' && filterUserId !== '') filtered = feedCache.filter(item => String(item.user_id) === String(filterUserId) || item.type === 'system');
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; return; }
    let html = '';
    filtered.forEach(item => {
        if(!item.date || isNaN(item.date.getTime())) return;
        const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); const userNameDisplay = currentUser.role === 'ADMIN' && item.type !== 'system' ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${item.user_name}</span>` : '';
        const d = item.date; const today = new Date(); const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
        let contentHtml = '';
        if (item.type === 'transaction') {
            const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; const prefix = item.isIncome ? '+' : '-';
            contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        } else if (item.type === 'task') {
            const icon = '<i class="fa-solid fa-list-check text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'pending' ? 'הוקצתה' : (item.status === 'done' ? 'ממתין לאישור' : 'הושלמה'); let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'quiz') {
            const icon = '<i class="fa-solid fa-graduation-cap text-purple-500 bg-purple-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'assigned' ? 'הוקצה' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'נכשל/פג תוקף'); let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'system') {
            const icon = '<i class="fa-solid fa-house text-orange-500 bg-orange-100 p-1.5 rounded-full text-[10px]"></i>';
            contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div></div>`;
        }
        html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border transform transition hover:scale-[1.01] mb-2 flex items-center">${contentHtml}</div>`;
    });
    list.innerHTML = html;
}

function updateAssignDetails() { const select = document.getElementById('assign-bundle-select'); const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { document.getElementById('assign-reward').value = bundle.reward; } }
function openAssignModal() {
    const cSelect = document.getElementById('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר ילד...</option>';
    if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); }
    const bSelect = document.getElementById('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${b.title} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; }
    document.getElementById('assign-reward').value = ''; document.getElementById('assign-days').value = ''; document.getElementById('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = document.getElementById('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = document.getElementById('assign-child-select').value; const bundleId = document.getElementById('assign-bundle-select').value; const reward = document.getElementById('assign-reward').value; const days = document.getElementById('assign-days').value;
    if(!childId) return showToast('error', 'אנא בחר ילד להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days }) });
    document.getElementById('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData();
}

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר familAI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה לילד</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבחנים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו מבחנים לאף ילד עדיין.</p>'; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${b.assignee_name}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    try {
        const libList = document.getElementById('library-list'); if (!libList) return;
        const ageFilter = document.getElementById('lib-age-filter') ? document.getElementById('lib-age-filter').value : 'all'; const catFilter = document.getElementById('lib-cat-filter') ? document.getElementById('lib-cat-filter').value : 'all';
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים להציג כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'math') return '<i class="fa-solid fa-calculator"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-chart-line"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'המבחן נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר מהיר'; } }
}

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    document.getElementById('quiz-title').innerText = bundle.title; document.getElementById('btn-tutor').classList.add('hidden'); 
    const textContainer = document.getElementById('quiz-text-container');
    if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); }
    document.getElementById('quiz-runner-modal').classList.remove('hidden'); renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    document.getElementById('q-progress').innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; document.getElementById('q-text').innerText = q.q;
    const optsContainer = document.getElementById('q-options'); optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 font-medium hover:bg-slate-100 text-slate-700">${opt}</button>`; });
}

async function submitAnswer(selectedIdx) {
    const q = currentQuizData.questions[currentQuestionIndex]; const isCorrect = selectedIdx === q.correct; const btns = document.querySelectorAll('.quiz-option');
    btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong');
    if(!isCorrect) { btns[q.correct].classList.add('correct'); currentWrongAnswers.push({ q: q.q, wrong: q.options[selectedIdx], correct: q.options[q.correct] }); }
    if(isCorrect) quizScore++;
    setTimeout(async () => { currentQuestionIndex++; if (currentQuestionIndex < currentQuizData.questions.length) { renderQuestion(); } else { finishQuiz(); } }, 1000);
}

async function finishQuiz() {
    const total = currentQuizData.questions.length; const finalScore = Math.round((quizScore / total) * 100); const passed = finalScore >= currentQuizData.threshold;
    document.getElementById('question-container').classList.add('hidden'); document.getElementById('quiz-text-container').classList.add('hidden'); document.getElementById('quiz-result').classList.remove('hidden');
    document.getElementById('quiz-icon').innerHTML = passed ? '🏆' : '📚'; document.getElementById('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא...'; document.getElementById('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; document.getElementById('quiz-score-display').innerText = `ציון: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) document.getElementById('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) });
    fetchData(); 
}

function closeQuiz() { document.getElementById('quiz-runner-modal').classList.add('hidden'); document.getElementById('question-container').classList.remove('hidden'); document.getElementById('quiz-result').classList.add('hidden'); }

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { const itemInput = document.getElementById('shop-item'); const btn = document.querySelector('#shop-modal button.bg-pink-500'); const item = itemInput.value; const qty = val('shop-quantity'); const est = val('shop-est-price'); if(!item) return; if (btn.disabled) return; btn.disabled = true; btn.innerText = 'מוסיף...'; try { const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); if (data.success) { document.getElementById('shop-modal').classList.add('hidden'); itemInput.value = ''; document.getElementById('shop-est-price').value = ''; document.getElementById('shop-quantity').value = 1; document.getElementById('suggestions').classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } } finally { btn.disabled = false; btn.innerText = 'הוסף'; } }

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement.classList.contains('price-input')) return;
    const list = document.getElementById('shop-list'); const reqList = document.getElementById('shop-requests-list'); const reqContainer = document.getElementById('shop-requests-container');
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין להורה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${i.item_name}</span><span class="text-xs text-slate-500 block">ביקש/ה: ${i.requester_name}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    if(activeItems.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">העגלה ריקה</p>'; document.getElementById('cart-footer').classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); return; }
    document.getElementById('cart-footer').classList.remove('hidden'); document.getElementById('fab-container').classList.add('fab-lifted');
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const val = i.estimated_price > 0 ? i.estimated_price : ''; const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * i.quantity;
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3
