// Oneflow Life - Main Family Logic (Part 1)

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
let forecastCache = { startingBalance: 0, items: [] };
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false;

let forecastRatioChart = null;
let currentForecastMode = 'monthly';
let currentScanTarget = ''; 

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
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

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

    const failsafeTimer = setTimeout(() => { const preloader = document.getElementById('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { console.warn('Failsafe triggered'); hidePreloaderAndShowAuth('login'); } }, 7000);
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
            if(session && session.user && session.user.id) { 
                // *** ניתוב שקט ומהיר לעסקים ***
                if(session.group && session.group.type === 'BUSINESS') { window.location.href = '/business.html'; return; }
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); document.getElementById(`view-${view}`).classList.remove('hidden'); }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    const btn = document.getElementById('btn-login-text'); const ldr = document.getElementById('btn-login-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            // *** ניתוב בזמן התחברות לעסקים ***
            if(data.group && data.group.type === 'BUSINESS') {
                localStorage.setItem('ofl_session', JSON.stringify({user:data.user, group:data.group}));
                window.location.href = '/business.html';
                return;
            }
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } } 
}

async function handleCreate(e) { 
    e.preventDefault(); const tos = document.getElementById('create-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; 
    const btn = document.getElementById('btn-create-text'); const ldr = document.getElementById('btn-create-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            // *** ניתוב בזמן יצירת עסק ***
            if(data.group && data.group.type === 'BUSINESS') {
                localStorage.setItem('ofl_session', JSON.stringify({user:data.user, group:data.group}));
                window.location.href = '/business.html';
                return;
            }
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    const tos = document.getElementById('join-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const btn = document.getElementById('btn-join-text'); const ldr = document.getElementById('btn-join-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d = await res.json(); 
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } }
}

async function handleSALogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salogin-text'); const ldr = document.getElementById('btn-salogin-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) }); const data = await res.json();
        if(data.success) { saToken = data.token; localStorage.setItem('ofl_sa_token', saToken); document.getElementById('auth-container').classList.add('hidden'); document.getElementById('sa-dashboard-container').classList.remove('hidden'); loadSAData(); } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } }
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
        
        if(data.stats) {
            const fEl = document.getElementById('sa-stat-families'); if(fEl) fEl.innerText = data.stats.families;
            const bEl = document.getElementById('sa-stat-businesses'); if(bEl) bEl.innerText = data.stats.businesses;
            const fuEl = document.getElementById('sa-stat-fam-users'); if(fuEl) fuEl.innerText = data.stats.familyUsers;
            const buEl = document.getElementById('sa-stat-biz-users'); if(buEl) buEl.innerText = data.stats.businessUsers;
        }

        const wMsg = document.getElementById('sa-welcome-msg'); if(wMsg) wMsg.value = data.welcomeMsg || '';
        const bwMsg = document.getElementById('sa-business-welcome-msg'); if(bwMsg) bwMsg.value = data.businessWelcomeMsg || '';
        
        const tText = document.getElementById('sa-banner-top-text'); if(tText) tText.value = data.adBannerTextTop || '';
        const tLink = document.getElementById('sa-banner-top-link'); if(tLink) tLink.value = data.adBannerLinkTop || '';
        const tImg = document.getElementById('sa-banner-top-img'); if(tImg) tImg.value = data.adBannerImgTop || '';
        const bText = document.getElementById('sa-banner-bottom-text'); if(bText) bText.value = data.adBannerTextBottom || '';
        const bLink = document.getElementById('sa-banner-bottom-link'); if(bLink) bLink.value = data.adBannerLinkBottom || '';
        const bImg = document.getElementById('sa-banner-bottom-img'); if(bImg) bImg.value = data.adBannerImgBottom || '';

        const bizTText = document.getElementById('sa-biz-banner-top-text'); if(bizTText) bizTText.value = data.bizBannerTextTop || '';
        const bizTLink = document.getElementById('sa-biz-banner-top-link'); if(bizTLink) bizTLink.value = data.bizBannerLinkTop || '';
        const bizTImg = document.getElementById('sa-biz-banner-top-img'); if(bizTImg) bizTImg.value = data.bizBannerImgTop || '';
        const bizBText = document.getElementById('sa-biz-banner-bottom-text'); if(bizBText) bizBText.value = data.bizBannerTextBottom || '';
        const bizBLink = document.getElementById('sa-biz-banner-bottom-link'); if(bizBLink) bizBLink.value = data.bizBannerLinkBottom || '';
        const bizBImg = document.getElementById('sa-biz-banner-bottom-img'); if(bizBImg) bizBImg.value = data.bizBannerImgBottom || '';

        const actList = document.getElementById('sa-activity-list');
        if(actList) {
            actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | קבוצה: <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`; }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        }
        
        saAllGroups = data.groups; saAllUsers = data.users; renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); if(!groupsList) return;
    let gHtml = ''; const term = filterText.toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים בסביבה זו.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const typeBadge = g.type === 'BUSINESS' ? '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] ml-2">עסק</span>' : '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] ml-2">משפחה</span>';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid fa-users"></i></div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${typeBadge} ${isPro}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens}</p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2">${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק סביבה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { const term = document.getElementById('sa-search-group').value; renderSAGroups(term); }
async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('האם למחוק סביבה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'קבוצה נמחקה לחלוטין'); loadSAData(); }

async function saveWelcomeMsg() { 
    try {
        await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ welcomeMsg: val('sa-welcome-msg'), businessWelcomeMsg: val('sa-business-welcome-msg') }) }); 
        showToast('success', 'הודעות הפתיחה נשמרו!'); 
    } catch(e) { showToast('error', 'שגיאה בשמירת הודעות'); }
}

async function saveBanners() {
    const topText = val('sa-banner-top-text'); const topLink = val('sa-banner-top-link'); const topImg = val('sa-banner-top-img');
    const bottomText = val('sa-banner-bottom-text'); const bottomLink = val('sa-banner-bottom-link'); const bottomImg = val('sa-banner-bottom-img');
    const bizTopText = val('sa-biz-banner-top-text'); const bizTopLink = val('sa-biz-banner-top-link'); const bizTopImg = val('sa-biz-banner-top-img');
    const bizBottomText = val('sa-biz-banner-bottom-text'); const bizBottomLink = val('sa-biz-banner-bottom-link'); const bizBottomImg = val('sa-biz-banner-bottom-img');
    
    try {
        const res = await fetch(`${API}/superadmin/banners`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ topText, topLink, topImg, bottomText, bottomLink, bottomImg, bizTopText, bizTopLink, bizTopImg, bizBottomText, bizBottomLink, bizBottomImg }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'הבאנרים נשמרו בהצלחה!'); loadSAData(); } else { showToast('error', 'שגיאה בשמירת הבאנרים'); }
    } catch(e) { showToast('error', 'תקלת רשת מול השרת'); }
}

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { let html = ''; if(img) html += `<img src="/${img}" alt="Banner" class="w-full object-cover block">`; if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; el.innerHTML = html; el.href = link || '#'; if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } el.classList.remove('hidden'); el.classList.add('flex'); } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=FAMILY`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=FAMILY`); const data = await res.json();
        const modalText = document.getElementById('welcome-modal-text');
        if (data.message && data.message.trim() !== '' && modalText) {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { modalText.innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
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
    const modal = document.getElementById('ai-warning-modal'); if(!modal) return actionCallback();
    const tokensLeft = currentGroup && currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
    const leftEl = document.getElementById('ai-warning-left'); if (leftEl) leftEl.innerText = tokensLeft;
    const btnContinue = document.getElementById('btn-ai-warning-continue'); if(btnContinue) { const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue); newBtn.onclick = () => { const dontShow = document.getElementById('ai-warning-dont-show'); if (dontShow && dontShow.checked) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } modal.classList.add('hidden'); actionCallback(); }; }
    modal.classList.remove('hidden');
}

function startAdminTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו המשפחה שלכם מתנהלת פיננסית. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "מרכז השליטה שלכם", intro: "כאן תמצאו את קוד המשפחה שאיתו תזמינו את הילדים.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תוכלו לראות בזמן אמת את היתרה הפנויה של המשפחה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "לחיצה קטנה על כפתור הפלוס מאפשרת לכם לרשום הוצאה או הכנסה מכל מקום.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "הסוף לקבוצות וואטסאפ מבולגנות! רשימת קניות משותפת לכולם.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "הגדירו דמי כיס שבועיים אוטומטיים לילדים, חלקו ריביות על חסכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות חודשיים לכל קטגוריה.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "מבט לעתיד! כאן תוכלו לראות את כל הפעולות העתידיות והקבועות שלכם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startChildTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות: להרוויח כסף, לחסוך נכון, ולעזור בבית." },
            { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "כאן מופיע כל הכסף שהרווחת מביצוע משימות ומדמי הכיס.", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "מתחשק לך חטיף או ארטיק? פשוט בקש להוסיף את זה לרשימת הקניות כאן.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "המקום שבו הכסף שלך צומח! פתח 'קופת חיסכון' למטרה שאתה חולם עליה.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}
function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { const s = document.getElementById('slider-scroll'); if(s) s.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const tContent = document.getElementById(`content-${t}`); if(tContent) tContent.classList.remove('hidden'); 
    const tBtn = document.getElementById(`tab-${t}`); if(tBtn) tBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') { try { renderPantry(); } catch(e) {} } 
    if (t === 'recipes') { try { renderRecipePantrySelection(); } catch(e) {} } 
    if (t === 'forecast') { try { renderForecast(); } catch(e) {} } 
    if (t === 'cashflow') { try { renderCashflow(); } catch(e) {} }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { 
        indicator.innerHTML = '⚡ ∞ (Pro)'; 
        indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent');
    } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = document.getElementById('ai-battery-modal'); const upgradeSec = document.getElementById('ai-upgrade-section');
        if(!modal) return false;
        if (currentUser.role === 'ADMIN' && upgradeSec) upgradeSec.classList.remove('hidden'); else if(upgradeSec) upgradeSec.classList.add('hidden');
        modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { const m = document.getElementById('ai-battery-modal'); if(m) m.classList.add('hidden'); }

async function loadDashboard() {
    const authCont = document.getElementById('auth-container'); if(authCont) authCont.classList.add('hidden'); 
    const dashCont = document.getElementById('dashboard-container'); if(dashCont) dashCont.classList.remove('hidden'); 
    const fabCont = document.getElementById('fab-container'); if(fabCont) fabCont.classList.remove('hidden');

    const dashGroupName = document.getElementById('dash-group-name');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד משפחה: ${currentGroup.group_code}</span>` : '';
    if (dashGroupName) dashGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
    
    const dashNickname = document.getElementById('dash-nickname');
    if (dashNickname) dashNickname.innerText = currentUser.nickname; 

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור`;
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>`; }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        const cardName = document.getElementById('card-name'); if (cardName) cardName.innerText = currentUser.nickname.toUpperCase(); 
        const cardAllow = document.getElementById('card-allowance'); if (cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
        const cardInt = document.getElementById('card-interest'); if (cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות`;
    }
    const btnAddBud = document.getElementById('btn-add-budget-cat'); if(btnAddBud) btnAddBud.classList.remove('hidden'); 
    updateBatteryUI();
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(currentUser.role === 'ADMIN') fetchPendingUsers(); }, 30000);
        
        fetchBanners(); 
        await fetchMembers(); 
        if(currentUser.role === 'ADMIN') fetchPendingUsers(); 
        await fetchData(); 
        fetchLoans(); 
    } catch (e) {
        console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
    }
}

window.openBalanceAdjustmentModal = function(id, name) { document.getElementById('adjustment-user-id').value = id; const nEl=document.getElementById('adjustment-user-name'); if(nEl) nEl.innerText = `עבור: ${name}`; document.getElementById('adjustment-amount').value = ''; document.getElementById('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); const modal=document.getElementById('balance-adjustment-modal'); if(modal) modal.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מההורה' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); const modal=document.getElementById('balance-adjustment-modal'); if(modal) modal.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user'); const cfF = document.getElementById('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">כל הבית</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">כל המשפחה</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">כל המשפחה</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">עבור מי היעד? (כללי/למשפחה)</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = document.getElementById('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 text-slate-500 border-2 border-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = document.getElementById('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = `<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים במשפחה עדיין.</p>`;
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'ילד'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/שבוע • ${m.interest_rate || 0}% ריבית</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-blue-600">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="קנס/בונוס"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות של בני המשפחה למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח למייל...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchPendingUsers() { 
    try { 
        if(!currentGroup || !currentGroup.id) return; 
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); 
        const users = await res.json(); 
        const list = document.getElementById('pending-list'); 
        const container = document.getElementById('admin-panel'); 
        if (users && users.length > 0) { 
            if(container) container.classList.remove('hidden'); 
            if(list) {
                list.innerHTML = ''; 
                users.forEach(u => { 
                    const age = new Date().getFullYear() - u.birth_year; 
                    list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md transition">אשר</button></div></div>`; 
                }); 
            }
        } else { 
            if(container) container.classList.add('hidden'); 
        } 
    } catch(e) { console.error(e); } 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

function openProfileModal() { const op = document.getElementById('old-password'); if(op) op.value = ''; const np = document.getElementById('new-password'); if(np) np.value = ''; const pm = document.getElementById('profile-modal'); if(pm) pm.classList.remove('hidden'); }

async function submitChangePassword(e) { 
    e.preventDefault(); const oldP = document.getElementById('old-password').value; const newP = document.getElementById('new-password').value; const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; 
    try { 
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); 
        if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } 
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; } 
}

async function deleteUser(id, name) { 
    if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהמערכת לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return; 
    try { 
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); 
        if(data.success) { showToast('success', 'המשתמש נמחק בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } 
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } 
}

async function fetchLoans() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        let url; if (currentUser.role === 'ADMIN') { url = `${API}/loans?groupId=${currentGroup.id}`; } else { url = `${API}/loans?userId=${currentUser.id}`; }
        const res = await fetch(url); const loans = await res.json(); renderLoans(loans);
    } catch(e) { console.error('fetchLoans error:', e); }
}

function renderLoans(loans) {
    if (currentUser.role === 'ADMIN') {
        const panel = document.getElementById('admin-loans-panel'); const list = document.getElementById('admin-loans-list');
        if (!panel || !list) return;
        const pending = loans.filter(l => l.status === 'pending');
        if (pending.length === 0) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');
        list.innerHTML = pending.map(l => `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">${l.nickname} – ₪${l.original_amount}</p><p class="text-xs text-slate-500">${l.reason || 'ללא סיבה'}</p></div><div class="flex gap-2"><button onclick="approveLoan(${l.id})" class="bg-green-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-green-600 transition">אשר</button><button onclick="rejectLoan(${l.id})" class="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-200 transition">דחה</button></div></div>`).join('');
    } else {
        const list = document.getElementById('my-loans-list'); if (!list) return;
        if (!loans || loans.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-xs py-3">אין הלוואות פעילות</p>'; return; }
        list.innerHTML = loans.map(l => {
            const statusMap = { pending: { label: 'ממתין לאישור', cls: 'bg-orange-100 text-orange-600' }, approved: { label: 'אושרה ✓', cls: 'bg-green-100 text-green-700' }, rejected: { label: 'נדחתה', cls: 'bg-red-100 text-red-600' } };
            const s = statusMap[l.status] || { label: l.status, cls: 'bg-slate-100 text-slate-600' };
            return `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">₪${l.original_amount}</p><p class="text-xs text-slate-500">${l.reason || ''} • ${new Date(l.created_at).toLocaleDateString('he-IL')}</p></div><span class="text-xs font-bold px-2 py-1 rounded-lg ${s.cls}">${s.label}</span></div>`;
        }).join('');
    }
}

async function approveLoan(loanId) {
    if (!confirm('לאשר הלוואה זו ולהעביר את הכסף לילד?')) return;
    const res = await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); const data = await res.json();
    if (data.success) { triggerConfetti(); showToast('success', 'ההלוואה אושרה!'); fetchData(); fetchLoans(); } else showToast('error', data.error);
}

async function rejectLoan(loanId) {
    if (!confirm('לדחות בקשת הלוואה זו?')) return;
    await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) });
    showToast('success', 'הבקשה נדחתה'); fetchLoans();
}

async function saTogglePremium(groupId, enable) {
    const label = enable ? 'להפעיל' : 'לבטל'; if (!confirm(`האם ${label} מנוי Pro למשפחה זו?`)) return;
    try {
        const res = await fetch(`${API}/superadmin/groups/${groupId}/premium`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ enable }) }); const data = await res.json();
        if (data.success) { showToast('success', enable ? 'מנוי Pro הופעל!' : 'מנוי Pro בוטל'); loadSAData(); } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    const bfm = document.getElementById('btn-forecast-monthly'); if(bfm) bfm.className = mode === 'monthly' ? `flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition` : `flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-indigo-600 rounded-lg transition`;
    const bfy = document.getElementById('btn-forecast-yearly'); if(bfy) bfy.className = mode === 'yearly' ? `flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition` : `flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-indigo-600 rounded-lg transition`;
    const fmf = document.getElementById('forecast-month-filter'); if(fmf) fmf.classList.toggle('hidden', mode !== 'monthly');
    const fyf = document.getElementById('forecast-year-filter'); if(fyf) fyf.classList.toggle('hidden', mode !== 'yearly');
    renderForecast();
};

function populateForecastPeriods() {
    const mSelect = document.getElementById('forecast-month-filter'); const ySelect = document.getElementById('forecast-year-filter');
    if (mSelect && mSelect.options.length === 0) { const now = new Date(); for(let i=0; i<12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); const monthStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); mSelect.innerHTML += `<option value="${monthStr}">${label}</option>`; } }
    if (ySelect && ySelect.options.length === 0) { const curYear = new Date().getFullYear(); for(let i=0; i<5; i++) { ySelect.innerHTML += `<option value="${curYear + i}">שנת ${curYear + i}</option>`; } }
}

async function renderForecast() {
    populateForecastPeriods();
    const list = document.getElementById('forecast-list');
    if(!list) return;
    if(!currentGroup || !currentGroup.id) return;
    const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
    const fmf = document.getElementById('forecast-month-filter'); const fyf = document.getElementById('forecast-year-filter');
    const periodVal = currentForecastMode === 'monthly' ? (fmf ? fmf.value : '') : (fyf ? fyf.value : '');
    
    let startDate, endDate;
    if (currentForecastMode === 'monthly') {
        if (!periodVal) {
            const now = new Date(); startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else {
            const [year, month] = periodVal.split('-'); startDate = new Date(year, parseInt(month) - 1, 1); endDate = new Date(year, parseInt(month), 0, 23, 59, 59);
        }
    } else {
        const year = periodVal ? parseInt(periodVal) : new Date().getFullYear();
        startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59);
    }
    
    let startingBalance = 0;
    if (targetUserId === 'all') { startingBalance = membersCache.reduce((sum, m) => sum + (parseFloat(m.balance) || 0), 0); } 
    else { const user = membersCache.find(m => String(m.id) === String(targetUserId)); if (user) startingBalance = parseFloat(user.balance) || 0; }
    
    const items = [];
    let txList = targetUserId !== 'all' ? allTransactions.filter(t => String(t.user_id) === String(targetUserId)) : allTransactions;
    
    txList.forEach(t => {
        const txDate = new Date(t.date); const amt = parseFloat(t.amount); const isRecurring = t.is_recurring === true || String(t.is_recurring).toLowerCase() === 'true';
        if (!isRecurring) {
            if (txDate >= startDate && txDate <= endDate) items.push({ ...t, amount: amt, date_str: txDate.toLocaleDateString('he-IL') });
        } else {
            let txStartMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1); let validEnd = true; let endD = null;
            if (t.end_month) { const [endYear, endMonth] = t.end_month.split('-'); endD = new Date(endYear, parseInt(endMonth), 0, 23, 59, 59); if (startDate > endD) validEnd = false; }
            if (endDate < txStartMonth) validEnd = false;
            if (validEnd) {
                if (currentForecastMode === 'monthly') { items.push({ ...t, amount: amt, date_str: 'קבוע (חודשי)' }); } 
                else if (currentForecastMode === 'yearly') {
                    let monthsActive = 0;
                    for (let m = 0; m < 12; m++) {
                        let checkStart = new Date(startDate.getFullYear(), m, 1); let checkEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59); let isActive = checkStart >= txStartMonth;
                        if (endD && checkEnd > endD) isActive = false; if (isActive) monthsActive++;
                    }
                    if (monthsActive > 0) items.push({ ...t, amount: amt * monthsActive, description: `${t.description} (x${monthsActive} ח')`, date_str: 'קבוע (שנתי)' });
                }
            }
        }
    });
    forecastCache = { startingBalance, items };
    const itemsToRender = forecastCache.items || [];
    let totalIncome = 0; let totalExpense = 0; let projectedNetChange = 0;
    const incomeData = {}; const expenseData = {};
    let html = ''; const now = new Date();
    
    if(itemsToRender.length === 0) {
        html = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">אין פעולות עתידיות או קבועות צפויות בתקופה זו</p>';
    } else {
        itemsToRender.forEach(item => {
            const isIncome = item.type === 'income'; const amt = parseFloat(item.amount); const itemDate = new Date(item.date); const isRecurring = item.is_recurring === true || String(item.is_recurring).toLowerCase() === 'true';
            if(isIncome) { totalIncome += amt; incomeData[item.category] = (incomeData[item.category] || 0) + amt; } else { totalExpense += amt; expenseData[item.category] = (expenseData[item.category] || 0) + amt; }
            
            if (isRecurring || itemDate > now) { if (isIncome) projectedNetChange += amt; else projectedNetChange -= amt; }
            
            const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
            const recBadge = isRecurring ? '<span class="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 rounded-full font-bold ml-2 shadow-sm whitespace-nowrap">קבועה <i class="fa-solid fa-rotate text-[8px]"></i></span>' : '';
            const userName = currentUser.role === 'ADMIN' && item.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${item.user_name}</span>` : '';
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between text-right hover:border-indigo-100 transition"><div class="flex-1 overflow-hidden"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${item.description}</span> ${userName} ${recBadge}</p><p class="text-[10px] text-slate-400 mt-1">${item.date_str}</p></div><span class="font-bold text-base ${amountClass} whitespace-nowrap shrink-0" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        });
    }
    list.innerHTML = html;
    const startBalance = parseFloat(forecastCache.startingBalance) || 0;
    const projectedBalance = startBalance + projectedNetChange;
    const fnc = document.getElementById('forecast-net-change'); if(fnc) { fnc.innerText = `₪${projectedNetChange.toFixed(2)}`; fnc.className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`; }
    const fpb = document.getElementById('forecast-projected-balance'); if(fpb) fpb.innerText = `₪${projectedBalance.toFixed(2)}`;
    drawForecastCharts({ income: totalIncome }, { expense: totalExpense });
}

function drawForecastCharts(incomeData, expenseData) {
    const container = document.getElementById('forecast-charts'); if(!container) return;
    container.className = "mt-6 border-t border-slate-100 pt-6 flex justify-center";
    container.innerHTML = `<div class="w-full max-w-[250px]"><h4 class="text-sm font-bold text-center text-slate-600 mb-2">הכנסות מול הוצאות</h4><div class="relative h-48 w-full flex justify-center"><canvas id="ratioChart"></canvas></div></div>`;
    const ctx = document.getElementById('ratioChart'); if(!ctx) return;
    if(forecastRatioChart) forecastRatioChart.destroy();
    const totalInc = Object.values(incomeData).reduce((a, b) => a + b, 0); const totalExp = Object.values(expenseData).reduce((a, b) => a + b, 0);
    if(totalInc > 0 || totalExp > 0) {
        forecastRatioChart = new Chart(ctx, {
            type: 'doughnut', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [totalInc, totalExp], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { family: 'Rubik' } } }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += '₪' + context.parsed.toFixed(1); } return label; } } } } }
        });
    } else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">אין פעולות עתידיות להצגת גרף</p>'; }
}

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('רואת העתידות', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מחשבת את התזרים הצפוי לתקופה...';
        try {
            const fmf = document.getElementById('forecast-month-filter'); const fyf = document.getElementById('forecast-year-filter');
            const periodVal = currentForecastMode === 'monthly' ? (fmf ? fmf.value : '') : (fyf ? fyf.value : '');
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { const fModal = document.getElementById('familai-advisor-modal'); if(fModal) fModal.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('רואת העתידות', data.insight); }
            else { const fModal = document.getElementById('familai-advisor-modal'); if(fModal) fModal.classList.add('hidden'); showToast('error', 'שגיאה בניתוח התשקיף'); }
        } catch(e) { const fModal = document.getElementById('familai-advisor-modal'); if(fModal) fModal.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function fetchPendingUsers() { 
    try { 
        if(!currentGroup || !currentGroup.id) return; 
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); 
        const users = await res.json(); 
        const list = document.getElementById('pending-list'); 
        const container = document.getElementById('admin-panel'); 
        if (users && users.length > 0) { 
            if(container) container.classList.remove('hidden'); 
            if(list) {
                list.innerHTML = ''; 
                users.forEach(u => { 
                    const age = new Date().getFullYear() - u.birth_year; 
                    list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md transition">אשר</button></div></div>`; 
                }); 
            }
        } else { 
            if(container) container.classList.add('hidden'); 
        } 
    } catch(e) { console.error(e); } 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }
function openProfileModal() { const op = document.getElementById('old-password'); if(op) op.value = ''; const np = document.getElementById('new-password'); if(np) np.value = ''; const pm = document.getElementById('profile-modal'); if(pm) pm.classList.remove('hidden'); }
async function submitChangePassword(e) { e.preventDefault(); const oldP = document.getElementById('old-password').value; const newP = document.getElementById('new-password').value; const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; try { const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); const pm = document.getElementById('profile-modal'); if(pm) pm.classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; } }
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהמערכת לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש נמחק בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }

async function fetchLoans() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        let url; if (currentUser.role === 'ADMIN') { url = `${API}/loans?groupId=${currentGroup.id}`; } else { url = `${API}/loans?userId=${currentUser.id}`; }
        const res = await fetch(url); const loans = await res.json(); renderLoans(loans);
    } catch(e) { console.error('fetchLoans error:', e); }
}

function renderLoans(loans) {
    if (currentUser.role === 'ADMIN') {
        const panel = document.getElementById('admin-loans-panel'); const list = document.getElementById('admin-loans-list');
        if (!panel || !list) return;
        const pending = loans.filter(l => l.status === 'pending');
        if (pending.length === 0) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');
        list.innerHTML = pending.map(l => `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">${l.nickname} – ₪${l.original_amount}</p><p class="text-xs text-slate-500">${l.reason || 'ללא סיבה'}</p></div><div class="flex gap-2"><button onclick="approveLoan(${l.id})" class="bg-green-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-green-600 transition">אשר</button><button onclick="rejectLoan(${l.id})" class="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-200 transition">דחה</button></div></div>`).join('');
    } else {
        const list = document.getElementById('my-loans-list'); if (!list) return;
        if (!loans || loans.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-xs py-3">אין הלוואות פעילות</p>'; return; }
        list.innerHTML = loans.map(l => {
            const statusMap = { pending: { label: 'ממתין לאישור', cls: 'bg-orange-100 text-orange-600' }, approved: { label: 'אושרה ✓', cls: 'bg-green-100 text-green-700' }, rejected: { label: 'נדחתה', cls: 'bg-red-100 text-red-600' } };
            const s = statusMap[l.status] || { label: l.status, cls: 'bg-slate-100 text-slate-600' };
            return `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">₪${l.original_amount}</p><p class="text-xs text-slate-500">${l.reason || ''} • ${new Date(l.created_at).toLocaleDateString('he-IL')}</p></div><span class="text-xs font-bold px-2 py-1 rounded-lg ${s.cls}">${s.label}</span></div>`;
        }).join('');
    }
}

async function approveLoan(loanId) {
    if (!confirm('לאשר הלוואה זו ולהעביר את הכסף לילד?')) return;
    const res = await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); const data = await res.json();
    if (data.success) { triggerConfetti(); showToast('success', 'ההלוואה אושרה!'); fetchData(); fetchLoans(); } else showToast('error', data.error);
}

async function rejectLoan(loanId) {
    if (!confirm('לדחות בקשת הלוואה זו?')) return;
    await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) });
    showToast('success', 'הבקשה נדחתה'); fetchLoans();
}

async function saTogglePremium(groupId, enable) {
    const label = enable ? 'להפעיל' : 'לבטל'; if (!confirm(`האם ${label} מנוי Pro למשפחה זו?`)) return;
    try {
        const res = await fetch(`${API}/superadmin/groups/${groupId}/premium`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ enable }) }); const data = await res.json();
        if (data.success) { showToast('success', enable ? 'מנוי Pro הופעל!' : 'מנוי Pro בוטל'); loadSAData(); } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function fetchBundles() { try { const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json(); if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles; } catch(e) {} }

function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() {
    Object.keys(accState).forEach(key => {
        const btn = document.getElementById(`acc-${key}`);
        if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } 
        else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } }
    });
    localStorage.setItem('ofl_accessibility', JSON.stringify(accState));
}
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { const m = document.getElementById('accessibility-modal'); if(m) m.classList.remove('hidden'); }
function closeAccessibilityModal() { const m = document.getElementById('accessibility-modal'); if(m) m.classList.add('hidden'); }

// --- סוף הקובץ ---
