// --- סגנונות מערכת הסיור וההדרכה ---
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
    /* סגנונות דינמיים לממשק עסקים */
    body.is-business #tour-balance-card { background: linear-gradient(135deg, #1e293b, #0f172a); }
    body.is-business .tab-active { background: #0f172a; border-color: #0f172a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4); color: white; }
    body.is-business #app-banner-top, body.is-business #app-banner-bottom { background: linear-gradient(to right, #0f172a, #334155); }
    body.is-business .fab-open #fab-menu button { border: 1px solid #475569; }
    
    /* סגנונות לשעון נוכחות */
    .punch-btn-in { background-color: #10b981; color: white; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4); }
    .punch-btn-out { background-color: #ef4444; color: white; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.4); }
    .punch-pulse { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
`;
document.head.appendChild(introStyle);

// --- הגדרות ומשתנים גלובליים ---
const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let forecastCache = { startingBalance: 0, items: [] };
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false; let forecastRatioChart = null; let currentForecastMode = 'monthly'; let currentScanTarget = ''; 
let currentPunchStatus = null; let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

function setupPwaInstallSection() {
    const section = document.getElementById('pwa-install-section'); const iosDiv = document.getElementById('pwa-ios-instructions'); const androidDiv = document.getElementById('pwa-android-instructions'); const btnInstall = document.getElementById('btn-install-pwa');
    if(!section || !iosDiv || !androidDiv || !btnInstall) return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
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
    "חטיפים ומתוקים 🍫": ["במבה", "ביסלי", "בייגלה", "עוגיות", "שוקולד"],
    "ציוד משרדי 📎": ["דפי מדפסת", "עטים שחורים", "עטים כחולים", "קלסרים", "שדכן"],
    "מטבחון ☕": ["קפה שחור", "קפסולות קפה", "חלב סויה", "תה ירוק", "סוכרזית"]
};
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

// --- כלים ועזרים ---
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function showToast(t,m) { const el=document.getElementById('toast'); const icon = document.getElementById('toast-icon'); if(!el || !icon) return; el.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { if(typeof confetti !== 'undefined') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
function triggerShake() { const app = document.getElementById('main-wrapper'); if(app) { app.classList.add('shake-effect'); setTimeout(() => app.classList.remove('shake-effect'), 500); } }
function toggleFab() { const fc = document.getElementById('fab-container'); if(fc) fc.classList.toggle('fab-open'); }

const hidePreloaderAndShowAuth = (view = 'login') => {
    const authC = document.getElementById('auth-container'); if(authC) authC.classList.remove('hidden'); switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
};

// --- טעינת המערכת ---
window.onload = async () => { 
    initAccessibility();
    const btnMonthly = document.getElementById('btn-forecast-monthly'); const btnYearly = document.getElementById('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const failsafeTimer = setTimeout(() => { const preloader = document.getElementById('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { console.warn('Preloader Stuck Failsafe Executed'); hidePreloaderAndShowAuth('login'); } }, 7000);
    
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { const elJC = document.getElementById('join-code'); if(elJC) elJC.value = inviteCode; const elJR = document.getElementById('join-role'); if(inviteRole && elJR) elJR.value = inviteRole; clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; }
    
    const savedSAToken = localStorage.getItem('ofl_sa_token');
    if (savedSAToken) {
        saToken = savedSAToken; clearTimeout(failsafeTimer); const authC = document.getElementById('auth-container'); if(authC) authC.classList.add('hidden'); const saDash = document.getElementById('sa-dashboard-container'); if(saDash) saDash.classList.remove('hidden');
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

// --- Super Admin ---
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
    if(!confirm('האם לשנות את פרטי הגישה של המנהל הראשי?')) return;
    try {
        const res = await fetch(`${API}/superadmin/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ newUsername, newPassword }) }); const data = await res.json();
        if(data.success) { showToast('success', 'פרטים עודכנו!'); document.getElementById('sa-new-username').value=''; document.getElementById('sa-new-password').value=''; } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function loadSAData() {
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        const welMsgEl = document.getElementById('sa-welcome-msg'); if(welMsgEl) welMsgEl.value = data.welcomeMsg || '';
        
        if (data.stats) {
            const setStat = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
            setStat('sa-stat-family-groups', data.stats.familyGroups); setStat('sa-stat-business-groups', data.stats.businessGroups);
            setStat('sa-stat-family-users', data.stats.familyUsers); setStat('sa-stat-business-users', data.stats.businessUsers);
        }

        const fillBanner = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        fillBanner('sa-banner-top-text', data.adBannerTextTop); fillBanner('sa-banner-top-link', data.adBannerLinkTop); fillBanner('sa-banner-top-img', data.adBannerImgTop);
        fillBanner('sa-banner-bottom-text', data.adBannerTextBottom); fillBanner('sa-banner-bottom-link', data.adBannerLinkBottom); fillBanner('sa-banner-bottom-img', data.adBannerImgBottom);
        fillBanner('sa-biz-banner-top-text', data.bizBannerTextTop); fillBanner('sa-biz-banner-top-link', data.bizBannerLinkTop); fillBanner('sa-biz-banner-top-img', data.bizBannerImgTop);
        fillBanner('sa-biz-banner-bottom-text', data.bizBannerTextBottom); fillBanner('sa-biz-banner-bottom-link', data.bizBannerLinkBottom); fillBanner('sa-biz-banner-bottom-img', data.bizBannerImgBottom);

        const actList = document.getElementById('sa-activity-list');
        if(actList) {
            actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">מערכת</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`; }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות במערכת...</p>';
        }
        saAllGroups = data.groups; saAllUsers = data.users; renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתונים'); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); if(!groupsList) return;
    let gHtml = ''; const term = filterText.toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות.</p>'; return; }
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים בקבוצה זו.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        const iconType = g.type === 'BUSINESS' ? '<i class="fa-solid fa-briefcase text-indigo-500"></i>' : '<i class="fa-solid fa-house text-blue-500"></i>';
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center ml-3">${iconType}</div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${isPro}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | ${g.type}</p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2">${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק קבוצה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { const el = document.getElementById('sa-search-group'); if(el) renderSAGroups(el.value); }
async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('למחוק קבוצה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'קבוצה נמחקה'); loadSAData(); }
async function saveWelcomeMsg() { await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ welcomeMsg: val('sa-welcome-msg') }) }); showToast('success', 'הודעת הפתיחה נשמרה!'); }

function applyDynamicTerminology() {
    if (!currentGroup || currentGroup.type !== 'BUSINESS') return;
    document.body.classList.add('is-business');
    document.title = 'Oneflow | מערכת ניהול לעסקים';
    
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

function executeWithAIWarning(actionCallback) {
    if (currentGroup && currentGroup.is_premium) return actionCallback();
    const todayStr = new Date().toLocaleDateString(); const dismissedDate = localStorage.getItem('ofl_ai_warning_dismissed'); if (dismissedDate === todayStr) return actionCallback();
    const modal = document.getElementById('ai-warning-modal'); const tokensLeft = currentGroup && currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
    const leftEl = document.getElementById('ai-warning-left'); if (leftEl) leftEl.innerText = tokensLeft;
    const btnContinue = document.getElementById('btn-ai-warning-continue'); if(btnContinue) { const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue); newBtn.onclick = () => { const ds = document.getElementById('ai-warning-dont-show'); if (ds && ds.checked) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } if(modal) modal.classList.add('hidden'); actionCallback(); }; }
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
    intro.onbeforechange(function(tE) { if(!tE) return; const id = tE.id; if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); if (tE.classList && tE.classList.contains('tab-btn')) { const sC = document.getElementById('slider-scroll'); if (sC) { sC.style.scrollBehavior = 'auto'; sC.scrollLeft = tE.offsetLeft - (sC.offsetWidth / 2) + (tE.offsetWidth / 2); setTimeout(() => { sC.style.scrollBehavior = 'smooth'; }, 50); } } return new Promise(r => setTimeout(() => { intro.refresh(); r(); }, 150)); });
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
        { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "הכסף שהרווחת מביצוע משימות.", position: 'bottom' },
        { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "בקשות להוספת מוצרים לקניות.", position: 'bottom' },
        { element: '#tab-pantry', title: "המזווה 📦", intro: "מה יש בבית עכשיו.", position: 'bottom' },
        { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "חסכונות והלוואות.", position: 'bottom' },
        { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "משימות לביצוע ותגמול כספי.", position: 'bottom' },
        { element: '#tab-academy', title: "האקדמיה 🎓", intro: "חידונים ולמידה נושאת פרסים.", position: 'bottom' },
        { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "מעקב על מה בזבזת את הכסף.", position: 'bottom' },
        { element: '#tab-forecast', title: "התשקיף שלי 📅", intro: "הכנסות והוצאות מתוכננות.", position: 'bottom' },
        { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "יצירת מתכונים.", position: 'bottom' }
    ];
    intro.setOptions({ nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true, steps: steps });
    intro.onbeforechange(function(tE) { if(!tE) return; const id = tE.id; if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); if (tE.classList && tE.classList.contains('tab-btn')) { const sC = document.getElementById('slider-scroll'); if (sC) { sC.style.scrollBehavior = 'auto'; sC.scrollLeft = tE.offsetLeft - (sC.offsetWidth / 2) + (tE.offsetWidth / 2); setTimeout(() => { sC.style.scrollBehavior = 'smooth'; }, 50); } } return new Promise(r => setTimeout(() => { intro.refresh(); r(); }, 150)); });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const el = document.getElementById(`view-${v}`); if(el) el.classList.add('hidden'); }); const target = document.getElementById(`view-${view}`); if(target) target.classList.remove('hidden'); }
function selectType(t) { const ct = document.getElementById('create-type'); if(ct) ct.value=t; const tf = document.getElementById('type-family'); if(tf) tf.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; const tb = document.getElementById('type-business'); if(tb) tb.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='BUSINESS'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); const tos = document.getElementById('create-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { 
    e.preventDefault(); 
    const tos = document.getElementById('join-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; toggleLoader('join', true);
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d=await res.json(); 
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
    } catch(err) { showToast('error', 'שגיאת תקשורת'); } finally { toggleLoader('join', false); }
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); toggleLoader('create', true);
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); await loadDashboard(); } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); toggleLoader('create', false); } 
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

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = document.getElementById('ai-battery-modal'); const upgradeSec = document.getElementById('ai-upgrade-section');
        if(upgradeSec) { if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden'); }
        if(modal) modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { const m = document.getElementById('ai-battery-modal'); if(m) m.classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = document.getElementById('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

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
            const reqTitle = document.getElementById('req-title'); if (reqTitle && !isBiz) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
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
    } catch(e) { console.error('UI Setup Error:', e); }
    
    try {
        const isAdmin = currentUser.role === 'ADMIN';
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
        fetchBanners(); await fetchMembers(); if(isAdmin) fetchPendingUsers(); await fetchData(); fetchLoans();
    } catch (e) {
        console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
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
    const btn = document.getElementById('btn-punch'); if(btn.classList.contains('cursor-not-allowed')) return;
    btn.classList.add('cursor-not-allowed', 'opacity-70');
    try {
        const res = await fetch(`${API}/timeclock/punch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', data.isPunchedIn ? 'החתמת כניסה בהצלחה!' : 'החתמת יציאה נרשמה בהצלחה.'); checkPunchStatus(); fetchTimeclockReport(); } else { showToast('error', data.error || 'שגיאה בדיווח נוכחות'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { btn.classList.remove('cursor-not-allowed', 'opacity-70'); }
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
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> העבר תקציב</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חריגה ביעד!' : 'עמידה ביעדים'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); const tcTab = document.getElementById('tab-cashflow'); if (tcTab && tcTab.classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) {}
}

function showFamilAIModal(title, text) {
    const mod = document.getElementById('familai-advisor-modal'); const sub = document.getElementById('familai-modal-subtitle');
    if(mod) mod.classList.remove('hidden'); if(sub) sub.innerText = title;
    const load = document.getElementById('familai-advisor-loading'); const textEl = document.getElementById('familai-advice-text'); const cont = document.getElementById('familai-advisor-content');
    if (text) { if(load) load.classList.add('hidden'); if(textEl) textEl.innerText = text; if(cont) cont.classList.remove('hidden'); } 
    else { if(load) load.classList.remove('hidden'); if(cont) cont.classList.add('hidden'); }
}

function openAIModal() { const mod = document.getElementById('ai-modal'); if(mod) mod.classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); if(btn) { btn.disabled = true; btn.innerText = 'מייצר מערך... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'ההכשרה מוכנה!'); const mod = document.getElementById('ai-modal'); if(mod) mod.classList.add('hidden'); const topicEl = document.getElementById('ai-topic'); if(topicEl) topicEl.value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת האתגר');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'צור אתגר'; } }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית', data.advice); triggerConfetti(); fetchData(); } 
            else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסטית התקציב', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'בודקת את הנתונים...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
            else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהלת המלאי', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מחשבת כמויות...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהלת המלאי', data.insight); fetchData(); }
            else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בניתוח'); }
        } catch(e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; const btn = document.getElementById('btn-tutor'); if(btn) { btn.disabled = true; btn.innerText = 'מכינה הסבר... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('חונך דיגיטלי', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> הצג ניתוח שגיאה (AI)'; } }
    });
}

function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    if (mode === 'manual') { if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; if(mDiv) mDiv.classList.remove('hidden'); if(aDiv) aDiv.classList.add('hidden'); } 
    else { if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; if(aDiv) aDiv.classList.remove('hidden'); if(mDiv) mDiv.classList.add('hidden'); }
}

function closeTaskModal() { const mod = document.getElementById('task-modal'); if(mod) mod.classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    const mod = document.getElementById('task-modal'); if(mod) mod.classList.remove('hidden'); const tIs = document.getElementById('task-is-self'); if(tIs) tIs.value = isSelf; 
    const tDays = document.getElementById('task-days'); if(tDays) tDays.value = ''; const tTitle = document.getElementById('task-title'); if(tTitle) tTitle.value = ''; const tRew = document.getElementById('task-reward'); if(tRew) tRew.value = ''; const aiTop = document.getElementById('ai-task-topic'); if(aiTop) aiTop.value = ''; const aiRes = document.getElementById('ai-task-results'); if(aiRes) aiRes.classList.add('hidden');
    setTaskMode('manual'); const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const assigneeSelect = document.getElementById('task-assignee');

    const modTitle = document.getElementById('task-modal-title');
    if(isSelf) { 
        if(modTitle) modTitle.innerText = 'ביצוע טיקט/יעד'; if(toggles) toggles.classList.add('hidden'); if(assigneeContainer) assigneeContainer.classList.add('hidden'); if(tRew) tRew.placeholder = 'כמה מגיע לי? (₪)'; 
    } else { 
        if(modTitle) modTitle.innerText = 'יצירת משימה'; if(toggles) toggles.classList.remove('hidden'); if(assigneeContainer) assigneeContainer.classList.remove('hidden'); if(tRew) tRew.placeholder = 'תגמול (₪)';
        if(membersCache && assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו חבר...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין משתמשים להקצאה</option>';
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = document.getElementById('task-is-self').value === 'true'; 
        let age;
        if (isSelf) age = new Date().getFullYear() - currentUser.birth_year;
        else {
             if(!assigneeId) return showToast('error', 'קודם כל בחרו למעלה עבור מי המשימה 👆');
             const child = membersCache.find(m => String(m.id) === String(assigneeId)); if(!child) return showToast('error', 'שגיאה במציאת גיל המשתמש');
             age = new Date().getFullYear() - child.birth_year;
        }
        if(!topic) return showToast('error', 'כתבו באיזה נושא לעזור');
        if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> חושבת...'; }
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = document.getElementById('ai-task-results'); 
                if(resultsContainer) {
                    resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
                    data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                    resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchData();
                }
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפש רעיונות'; } }
    });
}

function selectAITask(title, reward) { const tt = document.getElementById('task-title'); if(tt) tt.value = title; const tr = document.getElementById('task-reward'); if(tr) tr.value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור משתמש למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור מנהל!' : 'משימה נוצרה בהצלחה!'); fetchData(); 
}

function compressImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas'); let width = img.width; let height = img.height;
            if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; const tu = document.getElementById('task-proof-upload'); if(tu) tu.click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'בודקת את הביצוע...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('סורק מסמכים', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'מפענחת את הקבלה... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('סורק מסמכים', `סרקתי והוספתי ${data.count} רשומות מהמסמך!`); triggerConfetti(); fetchData(); } else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בקריאת הקבלה.'); }
            } catch(err) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי אוטומטי', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'מפענחת את התמונה...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden');
                    if (target === 'shop') { const el = document.getElementById('shop-item'); if(el) el.value = data.productName; openShopModal(); } else { const el = document.getElementById('pantry-item'); if(el) el.value = data.productName; openPantryModal(); }
                    showToast('success', 'האובייקט זוהה בהצלחה!');
                } else { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר בתמונה.'); }
            } catch(err) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאת תקשורת מול השרת.'); }
            event.target.value = '';
        });
    });
}

function closeBarcodeScanner() { const modal = document.getElementById('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

function openPantryUseModal(name, unit) { const title = document.getElementById('use-pantry-title'); if(title) title.innerText = `דיווח ניצול על: ${name}?`; const uName = document.getElementById('use-pantry-name'); if(uName) uName.value = name; const uQty = document.getElementById('use-pantry-qty'); if(uQty) uQty.value = ''; const uUnit = document.getElementById('use-pantry-unit-display'); if(uUnit) uUnit.innerText = unit || "יח'"; const mod = document.getElementById('pantry-use-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitPantryUse() {
    const name = val('use-pantry-name'); const qty = val('use-pantry-qty'); if(!qty || parseFloat(qty) <= 0) return showToast('error', 'נא להזין כמות תקינה');
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי עודכן בהצלחה'); const mod = document.getElementById('pantry-use-modal'); if(mod) mod.classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המלאי ריק. הוסיפו משאבים כדי לעקוב אחריהם!</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2"><div class="flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity} ${p.unit || "יח'"}</span><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div></div></div><div class="flex gap-2 mt-1 border-t border-slate-50 pt-2"><button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-orange-50 text-orange-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-orange-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils"></i> השתמשתי</button><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-pink-50 text-pink-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-pink-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> חסר (לדרישה)</button></div></div>`;
    });
}

function openPantryModal() { const mod = document.getElementById('pantry-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); const unit = val('pantry-unit') || "יח'"; if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit}) });
    const mod = document.getElementById('pantry-modal'); if(mod) mod.classList.add('hidden'); const pItem = document.getElementById('pantry-item'); if(pItem) pItem.value = ''; const pQty = document.getElementById('pantry-quantity'); if(pQty) pQty.value = 1; const pUnit = document.getElementById('pantry-unit'); if(pUnit) pUnit.value = "יח'"; fetchData(); showToast('success', 'האובייקט נוסף למלאי');
}
async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המשאב נגמר! האם למחוק אותו מהמלאי? (מומלץ להוסיף לרשימת הדרישות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}
async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'האובייקט הועבר לרשימת הדרישות!'); fetchData(); }

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
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-purple-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • חפיפה/אתגר • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function openApproveTaskModal(id, title, currentReward) { const aId = document.getElementById('approve-task-id'); if(aId) aId.value = id; const aTitle = document.getElementById('approve-task-title'); if(aTitle) aTitle.innerText = title; const aRew = document.getElementById('approve-task-reward'); if(aRew) aRew.value = currentReward || 0; const mod = document.getElementById('approve-task-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = document.getElementById('approve-task-id').value; const finalReward = document.getElementById('approve-task-reward').value;
    const mod = document.getElementById('approve-task-modal'); if(mod) mod.classList.add('hidden'); triggerConfetti();
    await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    showToast('success', 'המשימה אושרה והתגמול הועבר!'); fetchData();
}

function renderTasks(tasks) {
    const list = document.getElementById('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין למשתמש</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${t.title.replace(/'/g, "\\'")}', ${t.reward})" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר</button>`; } else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">ללא</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${t.title} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${t.assignee_name}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr;
}

async function updateTask(id, s) { if(s==='done' || s==='completed_self') triggerConfetti(); await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:s})}); fetchData(); }

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

function renderCashflow() {
    const list = document.getElementById('cashflow-list'); if (!list) return;
    const userFilter = document.getElementById('cashflow-user-filter') ? document.getElementById('cashflow-user-filter').value : 'all';
    const dateFilter = document.getElementById('cashflow-date-filter') ? document.getElementById('cashflow-date-filter').value : 'all';
    let filtered = allTransactions; 
    if (currentUser.role !== 'ADMIN') {
        filtered = allTransactions.filter(t => String(t.user_id) === String(currentUser.id)); const cfFilter = document.getElementById('cashflow-user-filter'); if(cfFilter) cfFilter.classList.add('hidden');
    } else {
        const cfFilter = document.getElementById('cashflow-user-filter'); if(cfFilter) cfFilter.classList.remove('hidden');
        if (userFilter !== 'all' && userFilter !== '') { filtered = allTransactions.filter(t => String(t.user_id) === String(userFilter)); }
    }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(t => new Date(t.date) >= cutoffDate); }
    if (filtered.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין פעולות להצגה בתקופה זו.</p>'; return; }
    let html = '';
    filtered.forEach(t => {
        const isIncome = t.type === 'income'; const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
        const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
        const d = new Date(t.date); const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
        const userName = t.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${t.user_name}</span>` : '';
        const catLabel = BUDGET_LABELS[t.category] || t.category || ''; const catBadge = catLabel ? `<span class="text-[9px] text-slate-400 border border-slate-200 px-1.5 rounded-full mr-2">${catLabel}</span>` : '';
        const safeDesc = t.description ? t.description.replace(/'/g, "\\'") : '';
        const editBtn = currentUser.role === 'ADMIN' ? `<button onclick="openEditTransactionModal(${t.id}, ${t.amount}, '${safeDesc}', '${t.category}', '${t.type}')" class="text-blue-500 bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-100 transition"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
        html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between hover:border-blue-100 transition"><div class="flex-1 overflow-hidden pr-2"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${t.description}</span> ${userName}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} ${catBadge}</p></div><div class="flex items-center gap-3 pl-1"><span class="font-bold text-base ${amountClass} whitespace-nowrap" dir="ltr">${prefix}₪${t.amount}</span>${editBtn}</div></div>`;
    });
    list.innerHTML = html;
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

async function submitEdit
