// תיקון סגנונות הרמטי לספריית הסיור (מעודכן לעיצוב פופ-אפ עגלגל ומודרני)
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
    
    /* סגנונות דינמיים לעסקים */
    body.is-business #tour-balance-card { background: linear-gradient(135deg, #1e293b, #0f172a); }
    body.is-business .tab-active { background: #0f172a; border-color: #0f172a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4); color: white; }
    body.is-business #app-banner-top, body.is-business #app-banner-bottom { background: linear-gradient(to right, #0f172a, #334155); }
    body.is-business .fab-open #fab-menu button { border: 1px solid #475569; }
    
    /* Timeclock specific styles */
    .punch-btn-in { background-color: #10b981; color: white; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4); }
    .punch-btn-out { background-color: #ef4444; color: white; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.4); }
    .punch-pulse { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let forecastCache = { startingBalance: 0, items: [] };
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false;

let forecastRatioChart = null;
let currentForecastMode = 'monthly';
let currentScanTarget = ''; 
let currentPunchStatus = null; 

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

function setupPwaInstallSection() {
    const section = document.getElementById('pwa-install-section'); const iosDiv = document.getElementById('pwa-ios-instructions'); const androidDiv = document.getElementById('pwa-android-instructions'); const btnInstall = document.getElementById('btn-install-pwa');
    if(!section || !iosDiv || !androidDiv || !btnInstall) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    if (isIOS) { iosDiv.classList.remove('hidden'); androidDiv.classList.add('hidden'); } 
    else {
        iosDiv.classList.add('hidden'); androidDiv.classList.remove('hidden');
        btnInstall.onclick = async () => {
            if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') section.classList.add('hidden'); deferredPrompt = null; } 
            else showToast('info', 'כדי להתקין, פתחו את תפריט הדפדפן ובחרו "התקן אפליקציה".');
        };
    }
}

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'}, {value:'other',label:'💸 אחר'} ], 
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
    document.getElementById('auth-container').classList.remove('hidden'); switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
};

window.onload = async () => { 
    initAccessibility();
    const btnMonthly = document.getElementById('btn-forecast-monthly'); const btnYearly = document.getElementById('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const failsafeTimer = setTimeout(() => { 
        const preloader = document.getElementById('app-preloader'); 
        if (preloader && !preloader.classList.contains('hidden')) { 
            console.warn('Failsafe triggered'); hidePreloaderAndShowAuth('login'); 
        } 
    }, 7000);
    
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { document.getElementById('join-code').value = inviteCode; if(inviteRole) document.getElementById('join-role').value = inviteRole; clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; }
    
    const savedSAToken = localStorage.getItem('ofl_sa_token');
    if (savedSAToken) {
        saToken = savedSAToken; clearTimeout(failsafeTimer); document.getElementById('auth-container').classList.add('hidden'); document.getElementById('sa-dashboard-container').classList.remove('hidden');
        const preloader = document.getElementById('app-preloader'); if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
        loadSAData(); return;
    }

    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

async function handleSALogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) }); const data = await res.json();
        if(data.success) { saToken = data.token; localStorage.setItem('ofl_sa_token', saToken); document.getElementById('auth-container').classList.add('hidden'); document.getElementById('sa-dashboard-container').classList.remove('hidden'); loadSAData(); } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); }
}
function logoutSA() { saToken = null; localStorage.removeItem('ofl_sa_token'); document.getElementById('sa-dashboard-container').classList.add('hidden'); document.getElementById('auth-container').classList.remove('hidden'); switchView('login'); }

async function updateSACredentials() {
    const newUsername = val('sa-new-username'); const newPassword = val('sa-new-password');
    if(!newUsername || !newPassword) return showToast('error', 'יש להזין שם משתמש וסיסמה חדשים');
    if(!confirm('האם אתה בטוח שברצונך לשנות את פרטי הגישה של המנהל הראשי?')) return;
    try {
        const res = await fetch(`${API}/superadmin/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ newUsername, newPassword }) }); const data = await res.json();
        if(data.success) { showToast('success', 'פרטי ההתחברות שונו בהצלחה!'); document.getElementById('sa-new-username').value = ''; document.getElementById('sa-new-password').value = ''; } else { showToast('error', data.error || 'שגיאה בעדכון פרטים'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

async function loadSAData() {
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        document.getElementById('sa-welcome-msg').value = data.welcomeMsg || '';
        
        if (data.stats) {
            const elFamGroups = document.getElementById('sa-stat-family-groups'); if(elFamGroups) elFamGroups.innerText = data.stats.familyGroups;
            const elBizGroups = document.getElementById('sa-stat-business-groups'); if(elBizGroups) elBizGroups.innerText = data.stats.businessGroups;
            const elFamUsers = document.getElementById('sa-stat-family-users'); if(elFamUsers) elFamUsers.innerText = data.stats.familyUsers;
            const elBizUsers = document.getElementById('sa-stat-business-users'); if(elBizUsers) elBizUsers.innerText = data.stats.businessUsers;
        }

        const fillBanner = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        fillBanner('sa-banner-top-text', data.adBannerTextTop);
        fillBanner('sa-banner-top-link', data.adBannerLinkTop);
        fillBanner('sa-banner-top-img', data.adBannerImgTop);
        fillBanner('sa-banner-bottom-text', data.adBannerTextBottom);
        fillBanner('sa-banner-bottom-link', data.adBannerLinkBottom);
        fillBanner('sa-banner-bottom-img', data.adBannerImgBottom);
        
        fillBanner('sa-biz-banner-top-text', data.bizBannerTextTop);
        fillBanner('sa-biz-banner-top-link', data.bizBannerLinkTop);
        fillBanner('sa-biz-banner-top-img', data.bizBannerImgTop);
        fillBanner('sa-biz-banner-bottom-text', data.bizBannerTextBottom);
        fillBanner('sa-biz-banner-bottom-link', data.bizBannerLinkBottom);
        fillBanner('sa-biz-banner-bottom-img', data.bizBannerImgBottom);

        const actList = document.getElementById('sa-activity-list');
        actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">פעולה</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`; }).join('');
        if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        saAllGroups = data.groups; saAllUsers = data.users; renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); let gHtml = ''; const term = filterText.toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו קבוצות התואמות לחיפוש.</p>'; return; }
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים בקבוצה זו.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        const iconType = g.type === 'BUSINESS' ? '<i class="fa-solid fa-briefcase text-indigo-500"></i>' : '<i class="fa-solid fa-users text-blue-500"></i>';
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center ml-3">${iconType}</div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${isPro}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | ${g.type}</p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2">${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק קבוצה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { const term = document.getElementById('sa-search-group').value; renderSAGroups(term); }
async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('למחוק קבוצה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'קבוצה נמחקה'); loadSAData(); }
async function saveWelcomeMsg() { await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ welcomeMsg: val('sa-welcome-msg') }) }); showToast('success', 'הודעת הפתיחה נשמרה!'); }

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 300); }

function openAlertModal(title, text) { const titleEl = document.getElementById('generic-alert-title'); const textEl = document.getElementById('generic-alert-text'); const modal = document.getElementById('generic-alert-modal'); if(titleEl && textEl && modal) { titleEl.innerText = title; textEl.innerText = text; modal.classList.remove('hidden'); } }

function executeWithAIWarning(actionCallback) {
    if (currentGroup && currentGroup.is_premium) return actionCallback();
    const todayStr = new Date().toLocaleDateString(); const dismissedDate = localStorage.getItem('ofl_ai_warning_dismissed'); if (dismissedDate === todayStr) return actionCallback();
    const modal = document.getElementById('ai-warning-modal'); const tokensLeft = currentGroup && currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
    const leftEl = document.getElementById('ai-warning-left'); if (leftEl) leftEl.innerText = tokensLeft;
    const btnContinue = document.getElementById('btn-ai-warning-continue'); if(btnContinue){ const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue); newBtn.onclick = () => { const dontShow = document.getElementById('ai-warning-dont-show').checked; if (dontShow) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } modal.classList.add('hidden'); actionCallback(); }; }
    if(modal) modal.classList.remove('hidden');
}

function startAdminTour() {
    switchTab('feed'); const intro = introJs(); const isBiz = currentGroup && currentGroup.type === 'BUSINESS';
    let steps = isBiz ? [
        { title: "ברוכים הבאים ל-Oneflow! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו העסק שלכם מתנהל.", position: 'bottom' },
        { element: '#tour-header', title: "מרכז השליטה", intro: "כאן תמצאו את קוד ההתחברות לארגון ותפריט ניהול.", position: 'bottom' },
        { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "מד האנרגיה היומי שלכם.", position: 'bottom' },
        { element: '#user-balance', title: "מאזן תפעולי 💳", intro: "יתרת התקציב הפנויה.", position: 'bottom' },
        { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "הוספת הוצאה, הכנסה, או רכש.", position: 'top' },
        { element: '#tab-shop', title: "רכש והזמנות 🛒", intro: "ריכוז דרישות עובדים, צילום חשבוניות וסריקת מק\"טים.", position: 'bottom' },
        { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "מעקב אחרי חומרי גלם וציוד משרדי.", position: 'bottom' },
        { element: '#tab-bank', title: "תקציבי מחלקות 🏦", intro: "מסגרות לעובדים ומחלקות, חלוקת בונוסים ואישור אש\"ל.", position: 'bottom' },
        { element: '#tab-tasks', title: "משימות ויעדים ✅", intro: "פרויקטים, טיקטים ובקרת AI.", position: 'bottom' },
        { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "יצירת לומדות וחפיפות מקצועיות.", position: 'bottom' },
        { element: '#tab-budget', title: "בקרה תפעולית 📊", intro: "מעקב מדויק מול התקציב שהוגדר.", position: 'bottom' },
        { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תחזיות, הוצאות קבועות ותכנון קדימה.", position: 'bottom' },
        { element: '#tab-recipes', title: "סיעור מוחות 👨‍🍳", intro: "יועץ AI לניהול משאבים ורעיונות.", position: 'bottom' },
        { element: '#tab-members', title: "ניהול צוות 👥", intro: "הוספת עובדים למערכת.", position: 'bottom' }
    ] : [
        { title: "ברוכים הבאים ל-Oneflow Life! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו המשפחה שלכם מתנהלת.", position: 'bottom' },
        { element: '#tour-header', title: "מרכז השליטה", intro: "כאן תמצאו את קוד המשפחה ותפריט ההגדרות.", position: 'bottom' },
        { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "מד האנרגיה היומי של המערכת.", position: 'bottom' },
        { element: '#user-balance', title: "הארנק המשותף 💳", intro: "היתרה הפנויה של המשפחה.", position: 'bottom' },
        { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "הוספת פעולות ורכש בלחיצה.", position: 'top' },
        { element: '#tab-shop', title: "סופר חכם 🛒", intro: "רשימת קניות, סריקת קבלות עם AI.", position: 'bottom' },
        { element: '#tab-pantry', title: "ניהול מזווה 📦", intro: "מעקב אחר המלאי בבית והעברה אוטומטית לעגלה.", position: 'bottom' },
        { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "דמי כיס, ריביות, הלוואות וחסכונות.", position: 'bottom' },
        { element: '#tab-tasks', title: "משימות הבית ✅", intro: "משימות לילדים, בקרת צילום ותגמול.", position: 'bottom' },
        { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "מבחנים ואתגרים נושאי פרסים.", position: 'bottom' },
        { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "מעקב וניהול הוצאות.", position: 'bottom' },
        { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "פעולות עתידיות ותכנון ארוך טווח.", position: 'bottom' },
        { element: '#tab-recipes', title: "השף הפרטי 👨‍🍳", intro: "מתכונים מבוססי AI מהמזווה.", position: 'bottom' },
        { element: '#tab-members', title: "בני הבית 👨‍👩‍👧‍👦", intro: "הזמנת בני המשפחה.", position: 'bottom' }
    ];
    intro.setOptions({ nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true, steps: steps });
    intro.onbeforechange(function(tE) { if(!tE) return; const id = tE.id; if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); if (tE.classList && tE.classList.contains('tab-btn')) { const sC = document.getElementById('slider-scroll'); if (sC) { sC.style.scrollBehavior = 'auto'; sC.scrollLeft = tE.offsetLeft - (sC.offsetWidth / 2) + (tE.offsetWidth / 2); setTimeout(() => { sC.style.scrollBehavior = 'smooth'; }, 50); } } return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150)); });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startChildTour() {
    switchTab('feed'); const intro = introJs(); const isBiz = currentGroup && currentGroup.type === 'BUSINESS';
    let steps = isBiz ? [
        { title: "ברוכים הבאים ל-Oneflow! 🎉", intro: "המקום לניהול משימות, רכש ויעדים תפעוליים.", position: 'bottom' },
        { element: '#ai-battery-indicator', title: "מנוע ה-AI ⚡", intro: "כאן תוכלו לעקוב אחר צריכת ה-AI בארגון.", position: 'bottom' },
        { element: '#user-balance', title: "התקציב שלי 💳", intro: "מאזן התמריצים האישי שלך.", position: 'bottom' },
        { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "הגשת דרישות רכש לאישור המנהל.", position: 'bottom' },
        { element: '#tab-pantry', title: "דיווח מלאי 📦", intro: "דיווח על ניצול משאבים.", position: 'bottom' },
        { element: '#tab-bank', title: "תקציב אישי 🏦", intro: "מעקב יעדים, בונוסים ובקשות אש\"ל.", position: 'bottom' },
        { element: '#tab-tasks', title: "טיקטים ומשימות ✅", intro: "פרויקטים ששויכו לכם.", position: 'bottom' },
        { element: '#tab-academy', title: "מרכז למידה 🎓", intro: "מבחני ריענון והכשרות מקצועיות.", position: 'bottom' },
        { element: '#tab-budget', title: "מעקב תפעולי 📊", intro: "חלוקת ההוצאות מול היעדים.", position: 'bottom' },
        { element: '#tab-forecast', title: "תשקיף אישי 📅", intro: "פעולות קבועות עתידיות.", position: 'bottom' }
    ] : [
        { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות.", position: 'bottom' },
        { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "הכירו את familAI - העוזרת הסודית שלנו!", position: 'bottom' },
        { element: '#user-balance', title: "הארנק האישי 💳", intro: "הכסף שהרווחת מביצוע משימות.", position: 'bottom' },
        { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "בקשות הוספת מוצרים לקניות.", position: 'bottom' },
        { element: '#tab-pantry', title: "המזווה 📦", intro: "מה יש בבית עכשיו.", position: 'bottom' },
        { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "חסכונות והלוואות.", position: 'bottom' },
        { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "משימות לביצוע ותגמול כספי.", position: 'bottom' },
        { element: '#tab-academy', title: "האקדמיה 🎓", intro: "חידונים ולמידה נושאת פרסים.", position: 'bottom' },
        { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "מעקב על מה בזבזת את הכסף.", position: 'bottom' },
        { element: '#tab-forecast', title: "התשקיף שלי 📅", intro: "הכנסות והוצאות מתוכננות.", position: 'bottom' },
        { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "יצירת מתכונים.", position: 'bottom' }
    ];
    intro.setOptions({ nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true, steps: steps });
    intro.onbeforechange(function(tE) { if(!tE) return; const id = tE.id; if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); if (tE.classList && tE.classList.contains('tab-btn')) { const sC = document.getElementById('slider-scroll'); if (sC) { sC.style.scrollBehavior = 'auto'; sC.scrollLeft = tE.offsetLeft - (sC.offsetWidth / 2) + (tE.offsetWidth / 2); setTimeout(() => { sC.style.scrollBehavior = 'smooth'; }, 50); } } return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150)); });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const el=document.getElementById(`view-${v}`); if(el)el.classList.add('hidden'); }); const t=document.getElementById(`view-${view}`); if(t)t.classList.remove('hidden'); }
function selectType(t) { const c=document.getElementById('create-type'); if(c)c.value=t; const f=document.getElementById('type-family'); if(f)f.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; const b=document.getElementById('type-business'); if(b)b.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='BUSINESS'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); const tos = document.getElementById('create-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { 
    e.preventDefault(); const tos = document.getElementById('join-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; toggleLoader('join', true);
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d=await res.json(); 
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
    } catch(err) { showToast('error', 'שגיאת תקשורת'); } finally { toggleLoader('join', false); }
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); toggleLoader('create', true);
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); await loadDashboard(); } else { showToast('error', data.error); hidePreloaderAndShowAuth('login'); } 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); hidePreloaderAndShowAuth('login'); } finally { toggleLoader('login', false); toggleLoader('create', false); } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { const sc = document.getElementById('slider-scroll'); if(sc) sc.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const cT = document.getElementById(`content-${t}`); if(cT) cT.classList.remove('hidden'); const tT = document.getElementById(`tab-${t}`); if(tT) tT.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'recipes') renderRecipePantrySelection(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow(); if (t === 'timeclock') fetchTimeclockReport();
}

function applyDynamicTerminology() {
    if (!currentGroup || currentGroup.type !== 'BUSINESS') return;
    document.body.classList.add('is-business'); document.title = 'Oneflow | מערכת ניהול לעסקים';
    
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setHtml('tab-shop', 'רכש 🛒'); setHtml('tab-pantry', 'מלאי ציוד 📦'); setHtml('tab-bank', 'תקציבים 💳');
    setHtml('tab-budget', 'בקרה תפעולית 📊'); setHtml('tab-tasks', 'משימות עובדים ✅'); setHtml('tab-academy', 'מרכז הכשרות 🎓');
    setHtml('tab-members', 'ניהול צוות 👥');
    
    const elTabTimeclock = document.getElementById('tab-timeclock'); if (elTabTimeclock) elTabTimeclock.classList.remove('hidden');

    setText('balance-label', 'מאזן קופת הארגון');
    const childTodoSec = document.getElementById('child-todo-section');
    if(childTodoSec) { const h3 = childTodoSec.querySelector('h3'); if(h3) h3.innerText = 'טיקטים ומשימות 🎯'; }
    setHtml('req-title', '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש לאישור הנהלה');
    
    BUDGET_LABELS['allowance'] = '💰 תקציב אישי לעובדים'; BUDGET_LABELS['tasks'] = '✅ בונוס טיקטים'; BUDGET_LABELS['academy'] = '🎓 תמריץ הכשרות';

    const inviteMod = document.getElementById('invite-modal');
    if(inviteMod) {
        const h3 = inviteMod.querySelector('h3'); if(h3) h3.innerText = 'הזמנת עובדים 👨‍💼';
        const p = inviteMod.querySelector('p'); if(p) p.innerHTML = `קוד הארגון: <span id="display-group-code" class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded tracking-widest border border-slate-200">---</span>`;
        const btns = inviteMod.querySelectorAll('button');
        if(btns.length >= 2) { btns[0].innerHTML = '<i class="fa-solid fa-user-tie"></i> מנהל/ת (הרשאה מלאה)'; btns[1].innerHTML = '<i class="fa-solid fa-user"></i> איש/אשת צוות (רגיל)'; }
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200', 'bg-slate-800', 'text-white', 'border-transparent');
    const isBiz = currentGroup.type === 'BUSINESS';
    if (currentGroup.is_premium) { 
        indicator.innerHTML = isBiz ? '<i class="fa-solid fa-bolt"></i> ∞ (Enterprise)' : '⚡ ∞ (Pro)'; 
        if (isBiz) { indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } else { indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent'); }
    } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { const el = document.getElementById('welcome-modal-text'); if(el) el.innerText = data.message; setupPwaInstallSection(); const mod = document.getElementById('welcome-modal'); if(mod) mod.classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { const mod = document.getElementById('welcome-modal'); if(mod) mod.classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { const mod = document.getElementById('profile-modal'); if(mod) mod.classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 300); }
function openAlertModal(title, text) { const titleEl = document.getElementById('generic-alert-title'); const textEl = document.getElementById('generic-alert-text'); const modal = document.getElementById('generic-alert-modal'); if(titleEl && textEl && modal) { titleEl.innerText = title; textEl.innerText = text; modal.classList.remove('hidden'); } }

async function loadDashboard() {
    try {
        const authC = document.getElementById('auth-container'); if(authC) authC.classList.add('hidden'); 
        const dashC = document.getElementById('dashboard-container'); if(dashC) dashC.classList.remove('hidden'); 
        const fabC = document.getElementById('fab-container'); if(fabC) fabC.classList.remove('hidden');
        
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
        const dGroupName = document.getElementById('dash-group-name'); if(dGroupName) dGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
        const dNickname = document.getElementById('dash-nickname'); if(dNickname) dNickname.innerText = currentUser.nickname || 'משתמש'; 
        
        applyDynamicTerminology();

        const isAdmin = currentUser.role === 'ADMIN';
        const isBiz = currentGroup.type === 'BUSINESS';

        if(isAdmin) { 
            ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            if (!isBiz) { const reqTitle = document.getElementById('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור'; }
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${isBiz ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
        } else { 
            ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
            
            const cardName = document.getElementById('card-name'); if(cardName) cardName.innerText = (currentUser.nickname || '').toUpperCase(); 
            const cardAllow = document.getElementById('card-allowance'); if(cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
            const cardInt = document.getElementById('card-interest'); if(cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
            
            const reqTitle = document.getElementById('req-title'); if(reqTitle) reqTitle.innerHTML = isBiz ? '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש שלי' : '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לרכש';
        }
        const btnAddBudg = document.getElementById('btn-add-budget-cat'); if(btnAddBudg) btnAddBudg.classList.remove('hidden'); 
        updateBatteryUI();
        
        if (isBiz && !isAdmin) checkPunchStatus();
        
        try {
            fetchBanners(); await fetchMembers(); if(isAdmin) fetchPendingUsers(); await fetchData(); fetchLoans();
            if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
        } catch (e) {
            console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת נתונים');
        } finally {
            const preloader = document.getElementById('app-preloader'); 
            const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
            if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
        }
    } catch(e) { 
        console.error('UI Setup Error:', e); 
        hidePreloaderAndShowAuth('login');
    }
}

// ================= TIMECLOCK LOGIC =================
async function checkPunchStatus() {
    try {
        const res = await fetch(`${API}/timeclock/status?userId=${currentUser.id}`); const data = await res.json();
        currentPunchStatus = data; updatePunchUI();
    } catch (e) {
        const btn = document.getElementById('btn-punch');
        if(btn) { btn.innerText = 'שגיאה'; btn.classList.remove('punch-pulse', 'punch-btn-in', 'punch-btn-out'); btn.classList.add('bg-slate-200', 'text-slate-400'); }
    }
}
function updatePunchUI() {
    const btn = document.getElementById('btn-punch'); const icon = document.getElementById('punch-icon'); const text = document.getElementById('punch-text'); const statusText = document.getElementById('timeclock-status-text');
    if(!btn || !currentPunchStatus) return;
    btn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed', 'punch-btn-in', 'punch-btn-out', 'punch-pulse');
    if (currentPunchStatus.isPunchedIn) {
        btn.classList.add('punch-btn-out', 'punch-pulse'); if(icon) icon.className = 'fa-solid fa-door-open text-4xl mb-1'; if(text) text.innerText = 'יציאה';
        const inTime = new Date(currentPunchStatus.punchInTime).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        if(statusText) statusText.innerHTML = `בעבודה. <span class="text-xs font-normal">החתמת כניסה: ${inTime}</span>`;
    } else {
        btn.classList.add('punch-btn-in'); if(icon) icon.className = 'fa-solid fa-fingerprint text-4xl mb-1'; if(text) text.innerText = 'כניסה'; if(statusText) statusText.innerHTML = `לא בעבודה כרגע.`;
    }
}
async function togglePunch() {
    const btn = document.getElementById('btn-punch'); if(btn && btn.classList.contains('cursor-not-allowed')) return;
    if(btn) btn.classList.add('cursor-not-allowed', 'opacity-70');
    try {
        const res = await fetch(`${API}/timeclock/punch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', data.isPunchedIn ? 'החתמת כניסה בהצלחה!' : 'החתמת יציאה נרשמה בהצלחה.'); checkPunchStatus(); fetchTimeclockReport(); } else { showToast('error', data.error || 'שגיאה בדיווח נוכחות'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { if(btn) btn.classList.remove('cursor-not-allowed', 'opacity-70'); }
}
async function fetchTimeclockReport() {
    try {
        const dFilter = document.getElementById('tc-date-filter'); const period = dFilter ? dFilter.value : 'month';
        const uFilter = document.getElementById('tc-user-filter'); const uFilterVal = uFilter ? uFilter.value : 'all';
        const targetUserId = currentUser.role === 'ADMIN' ? uFilterVal : currentUser.id;
        const res = await fetch(`${API}/timeclock/report?groupId=${currentGroup.id}&userId=${targetUserId}&period=${period}`); const data = await res.json();
        const list = document.getElementById('timeclock-list'); const totalEl = document.getElementById('tc-total-hours');
        if(!list || !totalEl) return;
        let totalMinutes = 0; let html = '';
        if (data.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">אין דיווחי נוכחות לתקופה זו.</p>'; totalEl.innerText = '00:00'; return; }
        data.forEach(r => {
            const inDate = new Date(r.punch_in); const dateStr = inDate.toLocaleDateString('he-IL'); const inStr = inDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
            let outStr = '--:--'; let durationStr = 'פעיל'; let statusBadge = '<span class="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">פעיל</span>';
            if (r.punch_out) {
                const outDate = new Date(r.punch_out); outStr = outDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
                if (r.total_minutes) { totalMinutes += parseInt(r.total_minutes); const h = Math.floor(r.total_minutes / 60); const m = r.total_minutes % 60; durationStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} שעות`; }
                statusBadge = '';
            }
            const userName = (currentUser.role === 'ADMIN' && r.nickname) ? `<span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-2">${r.nickname}</span>` : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 flex justify-between items-center"><div class="flex-1"><div class="flex items-center mb-1"><span class="font-bold text-slate-700 text-sm">${dateStr}</span>${userName}${statusBadge}</div><div class="text-xs text-slate-500 font-mono tracking-wider"><span class="text-green-600">${inStr}</span> <i class="fa-solid fa-arrow-left text-[8px] mx-1 text-slate-300"></i> <span class="text-red-500">${outStr}</span></div></div><div class="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">${durationStr}</div></div>`;
        });
        list.innerHTML = html; const totH = Math.floor(totalMinutes / 60); const totM = totalMinutes % 60; totalEl.innerText = `${String(totH).padStart(2, '0')}:${String(totM).padStart(2, '0')}`;
    } catch (e) {}
}
// ================= END TIMECLOCK LOGIC =================

window.openBalanceAdjustmentModal = function(id, name) { const uIdEl = document.getElementById('adjustment-user-id'); if(uIdEl) uIdEl.value = id; const uNameEl = document.getElementById('adjustment-user-name'); if(uNameEl) uNameEl.innerText = `עבור: ${name}`; const amtEl = document.getElementById('adjustment-amount'); if(amtEl) amtEl.value = ''; const reasonEl = document.getElementById('adjustment-reason'); if(reasonEl) reasonEl.value = ''; window.toggleAdjustmentType('deduct'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מנהל/הורה' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user'); const cfF = document.getElementById('cashflow-user-filter'); const tcF = document.getElementById('tc-user-filter');
                const isBiz = currentGroup.type === 'BUSINESS'; const teamLabel = isBiz ? 'כל הצוות' : 'כל המשפחה';
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">כללי</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (tcF) { const cur = tcF.value; tcF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => tcF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) tcF.value = cur; tcF.classList.remove('hidden'); }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">עבור מי היעד? (כללי)</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
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
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין משתמשים רשומים עדיין.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'משתמש'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/תקופה • ${m.interest_rate || 0}% בונוס/ריבית</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-blue-600">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="ניהול יתרה"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח למייל...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${currentGroup.type === 'BUSINESS' ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
        }

        if (currentUser.role === 'ADMIN') {
            const totalAdminBalance = membersCache.filter(m => m.role === 'ADMIN').reduce((sum, m) => sum + (parseFloat(m.balance) || 0), 0);
            const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${totalAdminBalance}`;
        } else {
            const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-AI</button>`;
                        const btnText = currentGroup.type === 'BUSINESS' ? 'העבר תקציב' : 'הפקד';
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> ${btnText}</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חריגה מהיעד!' : 'עמידה ביעדים'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); const tcTab = document.getElementById('tab-cashflow'); if (tcTab && tcTab.classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) { console.error('FetchData Error', e); }
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json();
        const list = document.getElementById('pending-list'); const container = document.getElementById('admin-panel');
        if (users && users.length > 0) {
            if(container) container.classList.remove('hidden'); if(list) list.innerHTML = '';
            users.forEach(u => { const age = new Date().getFullYear() - u.birth_year; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-green-600 transition">אשר</button></div></div>`; });
        } else { if(container) container.classList.add('hidden'); }
    } catch(e) {}
}

async function fetchLoans() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        let url; if (currentUser.role === 'ADMIN') { url = `${API}/loans?groupId=${currentGroup.id}`; } else { url = `${API}/loans?userId=${currentUser.id}`; }
        const res = await fetch(url); const loans = await res.json(); renderLoans(loans);
    } catch(e) {}
}

async function fetchBundles() { try { const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json(); if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles; } catch(e) {} }

async function fetchBanners() {
    try {
        const groupType = (currentGroup && currentGroup.type) ? currentGroup.type : 'FAMILY';
        const cached = localStorage.getItem(`ofl_banners_${groupType}`); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=${groupType}`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem(`ofl_banners_${groupType}`, JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

// --- CRUD & Actions ---
async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

async function deleteUser(id, name) {
    if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהמערכת לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return;
    try {
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'המשתמש נמחק בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}

async function submitChangePassword(e) {
    e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...';
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הסיסמה שונתה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); }
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; }
}

function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `הגדרות עבור ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'עודכן'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע העברת כספים שוטפים ובונוסים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } }

function openGoalModal() { if(currentUser.role === 'ADMIN') document.getElementById('goal-user-select-container').classList.remove('hidden'); document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { document.getElementById('deposit-goal-id').value = id; document.getElementById('deposit-goal-title').innerText = title; document.getElementById('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = document.getElementById('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && document.getElementById('goal-user-select-container').style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); document.getElementById('goal-modal').classList.add('hidden'); fetchData(); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = val('deposit-amount'); if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); document.getElementById('goal-deposit-modal').classList.add('hidden'); fetchData(); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    document.getElementById('trans-type').value=t; document.getElementById('trans-modal-title').innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s=document.getElementById('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); document.getElementById('transaction-modal').classList.remove('hidden'); 
}

window.toggleTransType = function(type) {
    const isRecurring = type === 'recurring'; document.getElementById('trans-is-recurring').value = isRecurring;
    const btnOnClass = document.body.classList.contains('is-business') ? 'bg-white text-slate-800' : 'bg-white text-blue-600';
    const btnOffClass = document.body.classList.contains('is-business') ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-700';

    document.getElementById('btn-trans-onetime').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition` : `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition`;
    document.getElementById('btn-trans-recurring').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition` : `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition`;
    if (isRecurring) document.getElementById('trans-end-date-container').classList.remove('hidden'); else { document.getElementById('trans-end-date-container').classList.add('hidden'); document.getElementById('trans-end-month').value = ''; }
};

async function submitTransaction() { 
    const amount = val('trans-amount'); if(!amount) return; if(val('trans-type') === 'expense') triggerShake(); else triggerConfetti(); 
    const isRecurring = document.getElementById('trans-is-recurring').value === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null }) }); 
    document.getElementById('transaction-modal').classList.add('hidden'); showToast('success', 'נשמר!'); fetchData(); 
}

function openEditTransactionModal(id, amount, desc, cat, type) {
    const editId = document.getElementById('edit-trans-id'); if(editId) editId.value = id; 
    const editOldAmt = document.getElementById('edit-trans-old-amount'); if(editOldAmt) editOldAmt.value = amount; 
    const editType = document.getElementById('edit-trans-type'); if(editType) editType.value = type; 
    const editAmt = document.getElementById('edit-trans-amount'); if(editAmt) editAmt.value = amount; 
    const editDesc = document.getElementById('edit-trans-desc'); if(editDesc) editDesc.value = desc;
    const catSelect = document.getElementById('edit-trans-cat'); 
    if(catSelect) {
        catSelect.innerHTML = '';
        if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; }
    }
    const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.remove('hidden');
}

async function submitEditTransaction() {
    const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat');
    if(!amount) return showToast('error', 'נא להזין סכום');
    const btn = document.querySelector('#edit-transaction-modal .bg-blue-600') || document.querySelector('#edit-transaction-modal .bg-slate-800'); const origText = btn ? btn.innerText : ''; if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה עודכנה!'); const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = origText; } }
}

async function deleteTransaction() {
    const id = val('edit-trans-id'); if(!confirm('האם אתה בטוח שברצונך למחוק פעולה זו לחלוטין? היתרה תתעדכן בהתאם.')) return;
    try {
        const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה נמחקה!'); const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function openLoanModal() { document.getElementById('loan-modal').classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); document.getElementById('loan-modal').classList.add('hidden'); showToast('success', 'בקשה נשלחה לאישור 📨'); fetchData(); fetchLoans(); }
async function approveLoan(loanId) { if (!confirm('לאשר בקשה זו? הכסף יועבר למשתמש.')) return; const res = await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); const data = await res.json(); if (data.success) { triggerConfetti(); showToast('success', 'הבקשה אושרה!'); fetchData(); fetchLoans(); } else showToast('error', data.error); }
async function rejectLoan(loanId) { if (!confirm('לדחות בקשה זו?')) return; await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); showToast('success', 'הבקשה נדחתה'); fetchLoans(); }

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id;
    const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); const data = await res.json();
    const list = document.getElementById('budget-list'); list.innerHTML = '';
    const baseCategories = CATEGORIES.expense.map(c => c.value);
    data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
    baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); }); const childrenCategories = ['allowance', 'tasks', 'academy']; childrenCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });
    let childrenTotalSpent = 0; let childrenTotalLimit = 0; let childrenItems = []; let otherItems = [];
    data.forEach(b => { if (childrenCategories.includes(b.category) || b.category === 'allocations') { childrenTotalSpent += parseFloat(b.spent) || 0; childrenTotalLimit += parseFloat(b.limit) || 0; childrenItems.push(b); } else { otherItems.push(b); } });

    const createRow = (category, spent, limit, isSub = false) => {
        const pct = limit > 0 ? (spent / limit) * 100 : 0; let color = 'bg-green-500'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
        const limitDisplay = limit > 0 ? `₪${limit}` : 'לא הוגדר'; const catName = BUDGET_LABELS[category] || category;
        const editBtn = (category !== 'allocations') ? `<button onclick="openBudgetModal('${category}', '${catName}', ${limit}); event.stopPropagation();" class="text-[10px] text-blue-600 font-bold ml-2 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition">ערוך יעד</button>` : '';
        const textSize = isSub ? 'text-sm' : 'text-base'; const containerClass = isSub ? 'pl-2 border-r-2 border-indigo-200 pr-2 mb-3' : 'mb-5';
        return `<div class="${containerClass}"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 ${textSize}">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-100 rounded-full ${isSub ? 'h-1.5' : 'h-2.5'} overflow-hidden shadow-inner"><div class="${color} ${isSub ? 'h-1.5' : 'h-2.5'} rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
    };

    if (childrenItems.length > 0) {
        const pct = childrenTotalLimit > 0 ? (childrenTotalSpent / childrenTotalLimit) * 100 : 0; let color = 'bg-indigo-500'; if (pct > 80) color = 'bg-indigo-400'; if (pct > 100) color = 'bg-purple-600';
        const limitDisplay = childrenTotalLimit > 0 ? `₪${childrenTotalLimit}` : 'לא הוגדר'; let subItemsHtml = ''; childrenItems.forEach(cb => { subItemsHtml += createRow(cb.category, cb.spent, cb.limit, true); });
        const childrenSectionTitle = currentUser.role === 'ADMIN' ? (currentGroup.type === 'BUSINESS' ? 'הוצאות כלליות/משתמשים' : 'הוצאות על הילדים') : 'הכנסות מההורים/צוות';
        list.innerHTML += `<div class="mb-8 bg-indigo-50/50 p-4 rounded-[1.5rem] border border-indigo-100/60 shadow-sm transition-all hover:bg-indigo-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-indigo-900 flex items-center gap-2"><i class="fa-solid fa-chart-pie text-indigo-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-indigo-100">${subItemsHtml}</div></div>`;
    }
    otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });
}

function openBudgetModal(catId, catName, currentLimit) { document.getElementById('budget-cat-name').innerText = catName; document.getElementById('budget-cat-id').value = catId; document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : ''; document.getElementById('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { const cat = val('budget-cat-id'); const limit = val('budget-limit'); const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); document.getElementById('budget-modal').classList.add('hidden'); fetchBudget(); }
function openAddBudgetCategoryModal() { document.getElementById('new-budget-cat-name').value = ''; document.getElementById('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { const catName = val('new-budget-cat-name'); if(!catName) return; const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); document.getElementById('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); }

function buildAndRenderFeed() {
    feedCache = [];
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'סביבת העבודה הוקמה בהצלחה! 🎉', amount: 0, status: 'welcome' }); }
    if(Array.isArray(allTransactions)) { allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || (currentUser ? currentUser.nickname : ''), date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); }); }
    if(Array.isArray(allTasks)) { allTasks.forEach(t => { if(t.status === 'approved') { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || (currentUser ? currentUser.nickname : ''), date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה/טיקט: ${t.title}`, amount: t.reward, status: t.status }); } }); }
    if(Array.isArray(bundlesCache)) { bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || (currentUser ? currentUser.id : 0)}`, user_id: b.user_id || b.assigned_to_user || (currentUser ? currentUser.id : 0), user_name: b.assignee_name || (currentUser ? currentUser.nickname : ''), date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `חפיפה/אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); }); }
    feedCache.sort((a, b) => (b.date && a.date) ? (b.date - a.date) : 0);
    const filterEl = document.getElementById('feed-user-filter');
    if (filterEl && currentUser) { if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); else filterEl.classList.add('hidden'); }
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const userFilter = document.getElementById('feed-user-filter') ? document.getElementById('feed-user-filter').value : 'all';
    const dateFilter = document.getElementById('feed-date-filter') ? document.getElementById('feed-date-filter').value : 'all';
    const list = document.getElementById('unified-feed-list'); if (!list) return;
    let filtered = feedCache;
    if (currentUser && currentUser.role !== 'ADMIN') { filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); } 
    else if (userFilter !== 'all' && userFilter !== '') { filtered = feedCache.filter(item => String(item.user_id) === String(userFilter) || item.type === 'system'); }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(item => item.date && item.date >= cutoffDate); }
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; return; }
    
    let html = '';
    filtered.forEach(item => {
        if(!item.date || isNaN(item.date.getTime())) return;
        const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); 
        const userNameDisplay = item.type !== 'system' && item.user_name ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${item.user_name}</span>` : '';
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

function updateAssignDetails() { const select = document.getElementById('assign-bundle-select'); if(!select) return; const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { const rew = document.getElementById('assign-reward'); if(rew) rew.value = bundle.reward; } }
function openAssignModal() {
    const cSelect = document.getElementById('assign-child-select'); if(cSelect) { cSelect.innerHTML = '<option value="" disabled selected>בחר משתמש להקצאה...</option>'; if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); } }
    const bSelect = document.getElementById('assign-bundle-select'); if(bSelect) { bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר/מבחן...</option>'; if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${b.title} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; } }
    const aRew = document.getElementById('assign-reward'); if(aRew) aRew.value = ''; const aDays = document.getElementById('assign-days'); if(aDays) aDays.value = ''; const mod = document.getElementById('assign-quiz-modal'); if(mod) mod.classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = document.getElementById('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); const reward = val('assign-reward'); const days = val('assign-days');
    if(!childId) return showToast('error', 'אנא בחר משתמש להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days }) });
    const mod = document.getElementById('assign-quiz-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData();
}

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || !currentUser || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים זמינה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • התאמה: ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה למשתמש</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבדקים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו מבחנים לאף משתמש עדיין.</p>'; } else {
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
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • התאמה: ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר מהיר'; } }
}

function renderMyAssignments(assignments) {
    const list = document.getElementById('my-assignments-list'); const histContainer = document.getElementById('academy-history-container'); const histList = document.getElementById('academy-history-list');
    if (!list || !histContainer || !histList) return;
    list.innerHTML = ''; histList.innerHTML = '';
    const pending = assignments.filter(a => a.status === 'assigned'); const history = assignments.filter(a => a.status !== 'assigned');
    
    if (pending.length === 0) { list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות למידה פתוחות</div>'; } else {
        pending.forEach(a => {
            const reward = (a.custom_reward !== null && a.custom_reward !== undefined) ? a.custom_reward : a.default_reward; let deadlineBadge = '';
            if (a.deadline) { const diff = Math.ceil((new Date(a.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימים</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
            list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800">${a.title} ${deadlineBadge}</p><p class="text-xs text-slate-500 mt-1">בונוס מעבר: ₪${reward} (דרוש ${a.threshold}%)</p></div><button onclick="startQuiz(${a.bundle_id})" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition">התחל</button></div>`;
        });
    }
    if (history.length > 0) {
        histContainer.classList.remove('hidden');
        history.forEach(a => {
            const reward = (a.custom_reward !== null && a.custom_reward !== undefined) ? a.custom_reward : a.default_reward; const passed = a.status === 'completed';
            const colorClass = passed ? 'text-green-500' : 'text-red-500'; const textLabel = passed ? `עברת (${a.score}%)` : `נכשלת (${a.score}%)`; const icon = passed ? '🏆' : '📚';
            histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-50 shadow-sm flex justify-between items-center opacity-80 mb-2"><div><p class="font-bold text-slate-700 text-sm">${icon} ${a.title}</p><p class="text-[10px] text-slate-500 mt-0.5">בונוס: ₪${reward}</p></div><span class="text-xs font-bold ${colorClass} bg-slate-50 px-2 py-1 rounded-lg">${textLabel}</span></div>`;
        });
    } else { histContainer.classList.add('hidden'); }
}

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    const qTitle = document.getElementById('quiz-title'); if(qTitle) qTitle.innerText = bundle.title; const btnTutor = document.getElementById('btn-tutor'); if(btnTutor) btnTutor.classList.add('hidden'); 
    const textContainer = document.getElementById('quiz-text-container');
    if(textContainer) {
        if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); }
    }
    const qrm = document.getElementById('quiz-runner-modal'); if(qrm) qrm.classList.remove('hidden'); renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    const qp = document.getElementById('q-progress'); if(qp) qp.innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; const qt = document.getElementById('q-text'); if(qt) qt.innerText = q.q;
    const optsContainer = document.getElementById('q-options'); if(!optsContainer) return; optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 font-medium hover:bg-slate-100 text-slate-700">${opt}</button>`; });
}

async function submitAnswer(selectedIdx) {
    const q = currentQuizData.questions[currentQuestionIndex]; const isCorrect = selectedIdx === q.correct; const btns = document.querySelectorAll('.quiz-option');
    if(btns[selectedIdx]) btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong');
    if(!isCorrect && btns[q.correct]) { btns[q.correct].classList.add('correct'); currentWrongAnswers.push({ q: q.q, wrong: q.options[selectedIdx], correct: q.options[q.correct] }); }
    if(isCorrect) quizScore++;
    setTimeout(async () => { currentQuestionIndex++; if (currentQuestionIndex < currentQuizData.questions.length) { renderQuestion(); } else { finishQuiz(); } }, 1000);
}

async function finishQuiz() {
    const total = currentQuizData.questions.length; const finalScore = Math.round((quizScore / total) * 100); const passed = finalScore >= currentQuizData.threshold;
    const qc = document.getElementById('question-container'); if(qc) qc.classList.add('hidden'); const qtc = document.getElementById('quiz-text-container'); if(qtc) qtc.classList.add('hidden'); const qr = document.getElementById('quiz-result'); if(qr) qr.classList.remove('hidden');
    const qi = document.getElementById('quiz-icon'); if(qi) qi.innerHTML = passed ? '🏆' : '📚'; const qmt = document.getElementById('quiz-msg-title'); if(qmt) qmt.innerText = passed ? 'כל הכבוד!' : 'לא נורא...'; const qmd = document.getElementById('quiz-msg-desc'); if(qmd) qmd.innerText = passed ? `עמדת ביעד וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; const qsd = document.getElementById('quiz-score-display'); if(qsd) qsd.innerText = `ציון: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) { const bt = document.getElementById('btn-tutor'); if(bt) bt.classList.remove('hidden'); }
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) });
    fetchData(); 
}

function closeQuiz() { const qrm = document.getElementById('quiz-runner-modal'); if(qrm) qrm.classList.add('hidden'); const qc = document.getElementById('question-container'); if(qc) qc.classList.remove('hidden'); const qr = document.getElementById('quiz-result'); if(qr) qr.classList.add('hidden'); }

function initAccessibility(){const s=localStorage.getItem('ofl_accessibility');if(s){try{accState=JSON.parse(s);applyAccessibility();}catch(e){}}}
function applyAccessibility(){Object.keys(accState).forEach(k=>{const b=el(`acc-${k}`);if(accState[k]){document.body.classList.add(`acc-${k}`);if(b){b.classList.add('border-blue-500','bg-blue-50','text-blue-700');b.classList.remove('border-slate-200','bg-slate-50','text-slate-700');}}else{document.body.classList.remove(`acc-${k}`);if(b){b.classList.remove('border-blue-500','bg-blue-50','text-blue-700');b.classList.add('border-slate-200','bg-slate-50','text-slate-700');}}});localStorage.setItem('ofl_accessibility',JSON.stringify(accState));}
function toggleAccess(k){accState[k]=!accState[k];applyAccessibility();}
function resetAccessibility(){Object.keys(accState).forEach(k=>accState[k]=false);applyAccessibility();showToast('success','אופס בהצלחה');closeAccessibilityModal();}
function openAccessibilityModal(){const m=el('accessibility-modal');if(m)m.classList.remove('hidden');}
function closeAccessibilityModal(){const m=el('accessibility-modal');if(m)m.classList.add('hidden');}
