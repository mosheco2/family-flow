// --- סגנונות מערכת הסיור וההדרכה וסגנונות דינמיים ---
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
    income: [ {value:'salary',label:'💼 משכורת/שכר'}, {value:'allowance',label:'💰 תקציב/דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 הכנסה עסקית'}, {value:'other',label:'💸 אחר'} ], 
    expense: [ {value:'food',label:'🍔 אוכל ומסעדות'}, {value:'groceries',label:'🛒 סופר ורכש'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור/שכירות ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך/השתלמויות'}, {value:'vacation',label:'✈️ חופשות'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} ] 
};
const BUDGET_LABELS = { 'food': '🍔 אוכל ומסעדות', 'groceries': '🛒 סופר ורכש', 'transport': '🚌 תחבורה ודלק', 'home': '🏠 דיור/שכירות ותחזוקה', 'bills': '📄 חשבונות ותקשורת', 'fun': '🎉 פנאי ובילויים', 'clothes': '👕 ביגוד והנעלה', 'health': '💊 בריאות וביטוחים', 'education': '📚 חינוך/השתלמויות', 'vacation': '✈️ חופשות', 'pets': '🐶 חיות מחמד', 'gifts': '🎁 מתנות ותרומות', 'other': '💸 אחר', 'allocations': '👶 תקציבים אישיים', 'allowance': '💰 הקצאות קבועות', 'tasks': '✅ בונוס משימות', 'academy': '🎓 תמריצי למידה', 'savings': '🐖 הפקדות לחיסכון' };
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

    const failsafeTimer = setTimeout(() => { const preloader = document.getElementById('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { console.warn('Preloader Failsafe Executed'); hidePreloaderAndShowAuth('login'); } }, 7000);
    
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
        if(data.success) { showToast('success', 'פרטים עודכנו!'); val('sa-new-username',''); val('sa-new-password',''); } else { showToast('error', data.error); }
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

// --- התחברות וניתוב ---
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
            const reqTitle = document.getElementById('req-title'); if (reqTitle && !isBiz) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${isBiz ? 'ארגון משודרג ל-Enterprise' : 'המשפחה משודרגת ל-Pro'}</p>`; }
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

window.openBalanceAdjustmentModal = function(id, name) { const uIdEl = document.getElementById('adjustment-user-id'); if(uIdEl) uIdEl.value = id; const uNameEl = document.getElementById('adjustment-user-name'); if(uNameEl) uNameEl.innerText = `עבור: ${name}`; const amtEl = document.getElementById('adjustment-amount'); if(amtEl) amtEl.value = ''; const reasonEl = document.getElementById('adjustment-reason'); if(reasonEl) reasonEl.value = ''; window.toggleAdjustmentType('deduct'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מנהל' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};
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
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל/רמה ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר אקראי'; } }
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

// ================= SHOPPING & PANTRY FUNCTIONS =================
function renderRecipePantrySelection() {
    const list = document.getElementById('recipe-pantry-items-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400">המלאי ריק. הוסיפו משאבים קודם בטאב המלאי.</p>'; return; }
    pantryCache.forEach(p => { list.innerHTML += `<label class="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 transition"><input type="checkbox" value="${p.item_name}" class="recipe-pantry-cb w-3 h-3 accent-orange-500"><span class="text-xs text-slate-700">${p.item_name}</span></label>`; });
}

function toggleRecipeCustomInput() {
    const ignoreEl = document.getElementById('recipe-ignore-pantry'); const ignore = ignoreEl ? ignoreEl.checked : false; const customInput = document.getElementById('recipe-custom-ingredients'); const pantrySel = document.getElementById('recipe-pantry-selection');
    if(ignore) { if(customInput) customInput.classList.remove('hidden'); if(pantrySel) pantrySel.classList.add('opacity-50', 'pointer-events-none'); } else { if(customInput) customInput.classList.add('hidden'); if(pantrySel) pantrySel.classList.remove('opacity-50', 'pointer-events-none'); }
}

function selectAllRecipePantry() { const cbs = document.querySelectorAll('.recipe-pantry-cb'); let allChecked = true; cbs.forEach(cb => { if(!cb.checked) allChecked = false; }); cbs.forEach(cb => cb.checked = !allChecked); }

async function generateRecipe() {
    const mealType = val('recipe-meal-type'); const diners = val('recipe-diners'); const ignoreEl = document.getElementById('recipe-ignore-pantry'); const ignore = ignoreEl ? ignoreEl.checked : false; const customIng = val('recipe-custom-ingredients');
    let pantryItems = []; document.querySelectorAll('.recipe-pantry-cb:checked').forEach(cb => pantryItems.push(cb.value));
    if(!ignore && pantryItems.length === 0) return showToast('error', 'יש לבחור מוצרים או לסמן התעלמות ולהקליד ידנית');
    if(ignore && !customIng) return showToast('error', 'יש להקליד ידנית בתיבה');
    const btn = document.getElementById('btn-generate-recipe'); if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעבד בקשה...'; }
    try {
        const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry: ignore, customIngredients: customIng, pantryItems: pantryItems.join(', ') }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) {
            const container = document.getElementById('recipe-result-container'); const content = document.getElementById('recipe-result-content');
            if(container && content) {
                let html = data.recipe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); html = html.replace(/\n/g, '<br>');
                content.innerHTML = html; container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
            }
        } else { showToast('error', data.error || 'שגיאה ביצירת פלט'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור הצעות עכשיו'; } }
}

function copyRecipe() { const c = document.getElementById('recipe-result-content'); if(c) { navigator.clipboard.writeText(c.innerText); showToast('success', 'הפלט הועתק בהצלחה!'); } }

function filterSuggestions(v) { const list = document.getElementById('suggestions'); if(!list) return; list.innerHTML = ''; if (!v) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(v)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); const btn = document.querySelector('#shop-modal button.bg-slate-800') || document.querySelector('#shop-modal button.bg-pink-500'); 
    const item = itemInput ? itemInput.value : ''; const qty = val('shop-quantity'); const est = val('shop-est-price'); const unit = val('shop-unit') || "יח'"; 
    if(!item) return; if (btn && btn.disabled) return; if(btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); 
        if (data.success) { const sm = document.getElementById('shop-modal'); if(sm) sm.classList.add('hidden'); if(itemInput) itemInput.value = ''; const estP = document.getElementById('shop-est-price'); if(estP) estP.value = ''; const sQ = document.getElementById('shop-quantity'); if(sQ) sQ.value = 1; const sU = document.getElementById('shop-unit'); if(sU) sU.value = "יח'"; const sug = document.getElementById('suggestions'); if(sug) sug.classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } 
    } finally { if(btn) { btn.disabled = false; btn.innerText = currentGroup && currentGroup.type === 'BUSINESS' ? 'הוסף לרשימה' : 'הוסף'; } } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל הפריטים מהרשימה? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה רוקנה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); if(cb) cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); if(inp) inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
    const list = document.getElementById('shop-list'); const reqList = document.getElementById('shop-requests-list'); const reqContainer = document.getElementById('shop-requests-container');
    if(!list || !reqList || !reqContainer) return;
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין לאישור</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${i.item_name}</span><span class="text-xs text-slate-500 block">ביקש/ה: ${i.requester_name}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    const ts = document.getElementById('tab-shop'); const isShopTabActive = ts && ts.classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">הרשימה ריקה</p>'; 
        const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = document.getElementById('cart-footer'); if(f) f.classList.remove('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    const accentColor = currentGroup && currentGroup.type === 'BUSINESS' ? 'slate-800' : 'pink-500';

    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-${accentColor} rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-${accentColor} font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); if(input) input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; const s = freshWisdomDiv.querySelector('span'); if(s) s.innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); if(!row || !btn) return; const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); const cb = row.querySelector('input[type="checkbox"]'); if(cb) { cb.checked = false; cb.disabled = true; } const pr = document.getElementById(`price-${id}`); if(pr) pr.disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); const cb = row.querySelector('input[type="checkbox"]'); if(cb) cb.disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const cb = row.querySelector('input[type="checkbox"]');
        const isChecked = cb ? cb.checked : false; const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const pInput = row.querySelector('.price-input'); const unitPrice = pInput ? (parseFloat(pInput.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    const d = document.getElementById('cart-total-display'); if(d) d.innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) { 
                count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
                const pInput = row.querySelector('.price-input'); const unitPrice = pInput ? (parseFloat(pInput.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
            } 
        }
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סומן אף פריט'); return; } 
    const sC = document.getElementById('summ-count'); if(sC) sC.innerText = count; const sM = document.getElementById('summ-missing'); if(sM) sM.innerText = missing; const sT = document.getElementById('summ-total'); if(sT) sT.innerText = `₪${total.toFixed(2)}`; const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.remove('hidden'); 
}

function openPasteListModal() { const el = document.getElementById('paste-list-text'); if(el) el.value = ''; const mod = document.getElementById('paste-list-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitPastedList() {
    const textEl = document.getElementById('paste-list-text'); const text = textEl ? textEl.value : '';
    if (!text.trim()) return showToast('error', 'אנא הדביקו רשימה כדי להמשיך');
    const items = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const btn = document.getElementById('btn-submit-paste'); if(btn) { btn.disabled = true; btn.innerText = 'קולט נתונים...'; }
    try {
        for (let itemName of items) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id}) }); }
        const mod = document.getElementById('paste-list-modal'); if(mod) mod.classList.add('hidden'); showToast('success', `נקלטו ${items.length} רשומות בהצלחה!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'קליטת נתונים'; } }
}

async function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה, אין מה לשתף.');
    let text = `*רשימת הדרישות שלנו מ-Oneflow:*\n\n`;
    activeItems.forEach(i => { text += `• ${i.item_name} - ${i.quantity} ${i.unit || "יח'"}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function submitFinalCheckout() {
    const stEl = document.getElementById('checkout-store'); const store = stEl ? stEl.value || 'ספק/חנות' : 'ספק/חנות'; const brEl = document.getElementById('checkout-branch'); const branch = brEl ? brEl.value : ''; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const pr = document.getElementById(`price-${id}`); const unitPrice = pr ? (parseFloat(pr.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
                boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
            }
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.add('hidden'); triggerConfetti(); showToast('success', 'הביצוע הושלם והמלאי עודכן!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); const mod = document.getElementById('history-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

async function openHistoryModal() { 
    const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); 
    const list = document.getElementById('history-list'); if(!list) return; list.innerHTML = ''; 
    if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; 
    trips.forEach(t => { 
        let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); 
        list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">העתק רשימה זו</button></div></div>`; 
    }); 
    const mod = document.getElementById('history-modal'); if(mod) mod.classList.remove('hidden'); 
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
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל/רמה ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר אקראי'; } }
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

// ================= SHOPPING & PANTRY FUNCTIONS =================
function renderRecipePantrySelection() {
    const list = document.getElementById('recipe-pantry-items-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400">המלאי ריק. הוסיפו משאבים קודם בטאב המלאי.</p>'; return; }
    pantryCache.forEach(p => { list.innerHTML += `<label class="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 transition"><input type="checkbox" value="${p.item_name}" class="recipe-pantry-cb w-3 h-3 accent-orange-500"><span class="text-xs text-slate-700">${p.item_name}</span></label>`; });
}

function toggleRecipeCustomInput() {
    const ignoreEl = document.getElementById('recipe-ignore-pantry'); const ignore = ignoreEl ? ignoreEl.checked : false; const customInput = document.getElementById('recipe-custom-ingredients'); const pantrySel = document.getElementById('recipe-pantry-selection');
    if(ignore) { if(customInput) customInput.classList.remove('hidden'); if(pantrySel) pantrySel.classList.add('opacity-50', 'pointer-events-none'); } else { if(customInput) customInput.classList.add('hidden'); if(pantrySel) pantrySel.classList.remove('opacity-50', 'pointer-events-none'); }
}

function selectAllRecipePantry() { const cbs = document.querySelectorAll('.recipe-pantry-cb'); let allChecked = true; cbs.forEach(cb => { if(!cb.checked) allChecked = false; }); cbs.forEach(cb => cb.checked = !allChecked); }

async function generateRecipe() {
    const mealType = val('recipe-meal-type'); const diners = val('recipe-diners'); const ignoreEl = document.getElementById('recipe-ignore-pantry'); const ignore = ignoreEl ? ignoreEl.checked : false; const customIng = val('recipe-custom-ingredients');
    let pantryItems = []; document.querySelectorAll('.recipe-pantry-cb:checked').forEach(cb => pantryItems.push(cb.value));
    if(!ignore && pantryItems.length === 0) return showToast('error', 'יש לבחור מוצרים או לסמן התעלמות ולהקליד ידנית');
    if(ignore && !customIng) return showToast('error', 'יש להקליד ידנית בתיבה');
    const btn = document.getElementById('btn-generate-recipe'); if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעבד בקשה...'; }
    try {
        const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry: ignore, customIngredients: customIng, pantryItems: pantryItems.join(', ') }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) {
            const container = document.getElementById('recipe-result-container'); const content = document.getElementById('recipe-result-content');
            if(container && content) {
                let html = data.recipe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); html = html.replace(/\n/g, '<br>');
                content.innerHTML = html; container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
            }
        } else { showToast('error', data.error || 'שגיאה ביצירת פלט'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור הצעות עכשיו'; } }
}

function copyRecipe() { const c = document.getElementById('recipe-result-content'); if(c) { navigator.clipboard.writeText(c.innerText); showToast('success', 'הפלט הועתק בהצלחה!'); } }

function filterSuggestions(v) { const list = document.getElementById('suggestions'); if(!list) return; list.innerHTML = ''; if (!v) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(v)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); const btn = document.querySelector('#shop-modal button.bg-slate-800') || document.querySelector('#shop-modal button.bg-pink-500'); 
    const item = itemInput ? itemInput.value : ''; const qty = val('shop-quantity'); const est = val('shop-est-price'); const unit = val('shop-unit') || "יח'"; 
    if(!item) return; if (btn && btn.disabled) return; if(btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); 
        if (data.success) { const sm = document.getElementById('shop-modal'); if(sm) sm.classList.add('hidden'); if(itemInput) itemInput.value = ''; const estP = document.getElementById('shop-est-price'); if(estP) estP.value = ''; const sQ = document.getElementById('shop-quantity'); if(sQ) sQ.value = 1; const sU = document.getElementById('shop-unit'); if(sU) sU.value = "יח'"; const sug = document.getElementById('suggestions'); if(sug) sug.classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } 
    } finally { if(btn) { btn.disabled = false; btn.innerText = currentGroup && currentGroup.type === 'BUSINESS' ? 'הוסף לרשימה' : 'הוסף'; } } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל הפריטים מהרשימה? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה רוקנה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); if(cb) cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); if(inp) inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
    const list = document.getElementById('shop-list'); const reqList = document.getElementById('shop-requests-list'); const reqContainer = document.getElementById('shop-requests-container');
    if(!list || !reqList || !reqContainer) return;
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין לאישור</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${i.item_name}</span><span class="text-xs text-slate-500 block">ביקש/ה: ${i.requester_name}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    const ts = document.getElementById('tab-shop'); const isShopTabActive = ts && ts.classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">הרשימה ריקה</p>'; 
        const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = document.getElementById('cart-footer'); if(f) f.classList.remove('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    const accentColor = currentGroup && currentGroup.type === 'BUSINESS' ? 'slate-800' : 'pink-500';

    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-${accentColor} rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-${accentColor} font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); if(input) input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; const s = freshWisdomDiv.querySelector('span'); if(s) s.innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); if(!row || !btn) return; const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); const cb = row.querySelector('input[type="checkbox"]'); if(cb) { cb.checked = false; cb.disabled = true; } const pr = document.getElementById(`price-${id}`); if(pr) pr.disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); const cb = row.querySelector('input[type="checkbox"]'); if(cb) cb.disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const cb = row.querySelector('input[type="checkbox"]');
        const isChecked = cb ? cb.checked : false; const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const pInput = row.querySelector('.price-input'); const unitPrice = pInput ? (parseFloat(pInput.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    const d = document.getElementById('cart-total-display'); if(d) d.innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) { 
                count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
                const pInput = row.querySelector('.price-input'); const unitPrice = pInput ? (parseFloat(pInput.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
            } 
        }
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סומן אף פריט'); return; } 
    const sC = document.getElementById('summ-count'); if(sC) sC.innerText = count; const sM = document.getElementById('summ-missing'); if(sM) sM.innerText = missing; const sT = document.getElementById('summ-total'); if(sT) sT.innerText = `₪${total.toFixed(2)}`; const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.remove('hidden'); 
}

function openPasteListModal() { const el = document.getElementById('paste-list-text'); if(el) el.value = ''; const mod = document.getElementById('paste-list-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitPastedList() {
    const textEl = document.getElementById('paste-list-text'); const text = textEl ? textEl.value : '';
    if (!text.trim()) return showToast('error', 'אנא הדביקו רשימה כדי להמשיך');
    const items = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const btn = document.getElementById('btn-submit-paste'); if(btn) { btn.disabled = true; btn.innerText = 'קולט נתונים...'; }
    try {
        for (let itemName of items) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id}) }); }
        const mod = document.getElementById('paste-list-modal'); if(mod) mod.classList.add('hidden'); showToast('success', `נקלטו ${items.length} רשומות בהצלחה!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'קליטת נתונים'; } }
}

async function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה, אין מה לשתף.');
    let text = `*רשימת הדרישות שלנו מ-Oneflow:*\n\n`;
    activeItems.forEach(i => { text += `• ${i.item_name} - ${i.quantity} ${i.unit || "יח'"}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function submitFinalCheckout() {
    const stEl = document.getElementById('checkout-store'); const store = stEl ? stEl.value || 'ספק/חנות' : 'ספק/חנות'; const brEl = document.getElementById('checkout-branch'); const branch = brEl ? brEl.value : ''; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const pr = document.getElementById(`price-${id}`); const unitPrice = pr ? (parseFloat(pr.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
                boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
            }
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.add('hidden'); triggerConfetti(); showToast('success', 'הביצוע הושלם והמלאי עודכן!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); const mod = document.getElementById('history-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

async function openHistoryModal() { 
    const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); 
    const list = document.getElementById('history-list'); if(!list) return; list.innerHTML = ''; 
    if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; 
    trips.forEach(t => { 
        let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); 
        list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">העתק רשימה זו</button></div></div>`; 
    }); 
    const mod = document.getElementById('history-modal'); if(mod) mod.classList.remove('hidden'); 
}
