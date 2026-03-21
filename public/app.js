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
                // *** נתוב לעסקים ***
                if(session.group && session.group.type === 'BUSINESS') { window.location.href = '/business.html'; return; }
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

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
            // *** נתוב לעסקים ***
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
            // *** נתוב לעסקים ***
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
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל המשפחה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
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

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'recipes') renderRecipePantrySelection(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent'); } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = document.getElementById('ai-battery-modal'); const upgradeSec = document.getElementById('ai-upgrade-section');
        if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden');
        modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { document.getElementById('ai-battery-modal').classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = document.getElementById('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden'); document.getElementById('dashboard-container').classList.remove('hidden'); document.getElementById('fab-container').classList.remove('hidden');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד משפחה: ${currentGroup.group_code}</span>` : '';
    document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} ${codeBadge}`; document.getElementById('dash-nickname').innerText = currentUser.nickname; 

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase(); document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
    }
    document.getElementById('btn-add-budget-cat').classList.remove('hidden'); updateBatteryUI();
    
    try {
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

window.openBalanceAdjustmentModal = function(id, name) { document.getElementById('adjustment-user-id').value = id; document.getElementById('adjustment-user-name').innerText = `עבור: ${name}`; document.getElementById('adjustment-amount').value = ''; document.getElementById('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); document.getElementById('balance-adjustment-modal').classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מההורה' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); document.getElementById('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
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
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל הבית</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
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
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 text-slate-500 border-2 border-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
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
            container.classList.remove('hidden'); list.innerHTML = ''; 
            users.forEach(u => { 
                const age = new Date().getFullYear() - u.birth_year; 
                list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md transition">אשר</button></div></div>`; 
            }); 
        } else { 
            if(container) container.classList.add('hidden'); 
        } 
    } catch(e) { console.error(e); } 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }

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
    document.getElementById('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('forecast-month-filter').classList.toggle('hidden', mode !== 'monthly');
    document.getElementById('forecast-year-filter').classList.toggle('hidden', mode !== 'yearly');
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
    const periodVal = currentForecastMode === 'monthly' ? document.getElementById('forecast-month-filter').value : document.getElementById('forecast-year-filter').value;
    
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
    document.getElementById('forecast-net-change').innerText = `₪${projectedNetChange.toFixed(2)}`;
    document.getElementById('forecast-net-change').className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`;
    document.getElementById('forecast-projected-balance').innerText = `₪${projectedBalance.toFixed(2)}`;
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
    const btnContinue = document.getElementById('btn-ai-warning-continue'); const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue);
    newBtn.onclick = () => { const dontShow = document.getElementById('ai-warning-dont-show').checked; if (dontShow) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } modal.classList.add('hidden'); actionCallback(); };
    modal.classList.remove('hidden');
}

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
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "מבט לעתיד! כאן תוכלו לראות את כל הפעולות העתידיות והקבועות שלכם, ולתכנן את התקציב קדימה בצורה חכמה.", position: 'bottom' },
            { element: '#tab-recipes', title: "השף הפרטי שלכם 👨‍🍳", intro: "נתקעתם בלי רעיון לארוחת ערב? סמנו אילו מוצרים יש לכם במזווה, וה-AI שלנו ירקח עבורכם מתכון מושלם תוך שניות!", position: 'bottom' },
            { element: '#tab-members', title: "הזמנת המשפחה 👨‍👩‍👧‍👦", intro: "מכאן תוכלו לשלוח הזמנה מהירה בוואטסאפ לילדים ולבן/בת הזוג להצטרף. שיהיה בהצלחה!", position: 'bottom' }
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
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות: להרוויח כסף, לחסוך נכון, ולעזור בבית כמו גדולים. בואו נתחיל!" },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "הכירו את familAI - העוזרת החכמה והסודית שלנו! כאן אפשר לראות את מד האנרגיה שלה להיום.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "כאן מופיע כל הכסף שהרווחת מביצוע משימות ומדמי הכיס. זה הזמן לחשוב על מה כדאי לחסוך!", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "מתחשק לך חטיף או ארטיק? אין צורך לשגע את ההורים, פשוט בקש להוסיף את זה לרשימת הקניות כאן.", position: 'bottom' },
            { element: '#tab-pantry', title: "המזווה 📦", intro: "בא לך לנשנש משהו? כאן אפשר לבדוק בקלות אילו ממתקים או מוצרים טעימים כבר מחכים לכם בבית.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "המקום שבו הכסף שלך צומח! פתח 'קופת חיסכון' למטרה שאתה חולם עליה, ותראה את הריבית מצטברת.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "רוצה להרוויח כסף? בחר משימה, סיים אותה, צלם הוכחה - וקבל את התגמול ישר לארנק!", position: 'bottom' },
            { element: '#tab-academy', title: "האקדמיה 🎓", intro: "מי אמר שללמוד זה משעמם? היכנס לכאן כדי לענות על חידונים כיפיים ותרוויח בונוסים על תשובות נכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "כאן תוכל לראות על מה בזבזת את דמי הכיס החודש, וללמוד לתכנן קניות חכם יותר.", position: 'bottom' },
            { element: '#tab-forecast', title: "התשקיף שלי 📅", intro: "כאן אפשר לראות אילו הכנסות והוצאות מתוכננות לך בהמשך התקופה, ולתכנן כמה כסף יישאר לך!", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "רוצה להפתיע את המשפחה? בחר מוצרים שיש במטבח, והשף החכם ייתן לך מתכון מנצח וקל להכנה!", position: 'bottom' }
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

function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסטית התקציב', null); document.getElementById('familai-loading-text').innerText = 'בודקת על מה הוצאנו החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהלת המזווה', null); document.getElementById('familai-loading-text').innerText = 'מחשבת כמויות ומרגלי קנייה...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהלת המזווה', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; document.getElementById('btn-tutor').disabled = true; document.getElementById('btn-tutor').innerText = 'מכינה הסבר... ⏳';
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('המורה הפרטית שלך', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { document.getElementById('btn-tutor').disabled = false; document.getElementById('btn-tutor').innerHTML = '<img src="logo.png" alt="AI" class="w-5 h-5 object-contain"> familAI, איפה טעיתי?'; }
    });
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
    setTaskMode('manual'); const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardInput = document.getElementById('task-reward'); const assigneeSelect = document.getElementById('task-assignee');

    if(isSelf) { 
        document.getElementById('task-modal-title').innerText = 'מעשה טוב'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardInput.placeholder = 'כמה מגיע לי? (₪)'; 
    } else { 
        document.getElementById('task-modal-title').innerText = 'יצירת משימה'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardInput.placeholder = 'תגמול (₪)';
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין ילדים רשומים</option>';
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
    });
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור ההורה!' : 'משימה נוצרה בהצלחה!'); fetchData(); 
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

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; document.getElementById('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות', null); document.getElementById('familai-loading-text').innerText = 'familAI בודקת את התמונה שלך...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('קופאית אוטומטית', null); document.getElementById('familai-loading-text').innerText = 'familAI סורקת את הקבלה... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('קופאית אוטומטית', `סרקתי והוספתי ${data.count} פריטים מהקבלה לעגלה שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת הקבלה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי מוצר חכם', null); document.getElementById('familai-loading-text').innerText = 'familAI בודקת איזה מוצר צילמת...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    document.getElementById('familai-advisor-modal').classList.add('hidden');
                    if (target === 'shop') { document.getElementById('shop-item').value = data.productName; openShopModal(); } else { document.getElementById('pantry-item').value = data.productName; openPantryModal(); }
                    showToast('success', 'המוצר זוהה בהצלחה!');
                } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר בתמונה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת מול השרת.'); }
            event.target.value = '';
        });
    });
}

function closeBarcodeScanner() { document.getElementById('barcode-scanner-modal').classList.add('hidden'); }

function openPantryUseModal(name, unit) { document.getElementById('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; document.getElementById('use-pantry-name').value = name; document.getElementById('use-pantry-qty').value = ''; document.getElementById('use-pantry-unit-display').innerText = unit || "יח'"; document.getElementById('pantry-use-modal').classList.remove('hidden'); }

async function submitPantryUse() {
    const name = val('use-pantry-name'); const qty = val('use-pantry-qty'); const units = val('use-pantry-units');
    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty, usedUnits: units }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי עודכן בהצלחה'); document.getElementById('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2"><div class="flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${p.units_per_package || 1} יח'</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity} ${p.unit || "יח'"}</span><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div></div></div><div class="flex gap-2 mt-1 border-t border-slate-50 pt-2"><button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-orange-50 text-orange-600 hover:bg-orange-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils"></i> השתמשתי</button><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-pink-50 text-pink-600 hover:bg-pink-100 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> חסר (לקניות)</button></div></div>`;
    });
}

function openPantryModal() { document.getElementById('pantry-modal').classList.remove('hidden'); }
async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); const unit = val('pantry-unit') || "יח'"; const upp = val('pantry-upp') || 1; if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
    document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); document.getElementById('pantry-unit').value = "יח'"; document.getElementById('pantry-upp').value = 1; fetchData(); showToast('success', 'המוצר נוסף למזווה');
}
async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר נגמר! האם למחוק אותו מהמזווה? (מומלץ להוסיף לעגלת הקניות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}
async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לרשימת הקניות!'); fetchData(); }

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר AI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'financial' ? '📈' : (type === 'reading' ? '📖' : '🧠'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">הקצה לילד</button></div>`;
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
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים להצגה כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'financial') return '<i class="fa-solid fa-chart-line"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-brain"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

function renderMyAssignments(bundles) {
    const list = document.getElementById('my-assignments-list'); const histList = document.getElementById('academy-history-list'); const histCont = document.getElementById('academy-history-container');
    if (!list) return; list.innerHTML = ''; if (histList) histList.innerHTML = ''; let histCount = 0; let actCount = 0;
    if(Array.isArray(bundles)) {
        bundles.forEach(b => {
            const reward = b.custom_reward !== null ? b.custom_reward : b.default_reward;
            if (b.status === 'assigned') {
                actCount++; let dMsg = ""; if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? `<span class="text-orange-500 font-bold bg-orange-50 px-1 rounded ml-2">עוד ${diff} ימים</span>` : `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-2">איחור!</span>`; }
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-3"><div class="flex-1"><h4 class="font-bold text-slate-800">${b.title}</h4><p class="text-xs text-slate-500 mt-1">תמריץ מעבר: ₪${reward} ${dMsg}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow hover:bg-blue-700 transition"><i class="fa-solid fa-play"></i> התחל</button></div>`;
            } else {
                histCount++; if(histList) { let sColor = b.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'; let sText = b.status === 'completed' ? 'הושלם' : 'נכשל';
                histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400 mt-1">ציון: ${b.score}% • תמריץ: ₪${b.status==='completed'?reward:0}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded ${sColor}">${sText}</span></div>`; }
            }
        });
    }
    if (actCount === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין מטלות למידה פתוחות.</p>';
    if (histCount > 0 && histCont) histCont.classList.remove('hidden'); else if(histCont) histCont.classList.add('hidden');
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'המבחן נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '🙋‍♂️ הגרל אתגר מהיר'; } }
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

function renderRecipePantrySelection() {
    const list = document.getElementById('recipe-pantry-items-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400">המזווה ריק. הוסיפו מוצרים קודם בטאב המזווה.</p>'; return; }
    pantryCache.forEach(p => { list.innerHTML += `<label class="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 transition"><input type="checkbox" value="${p.item_name}" class="recipe-pantry-cb w-3 h-3 accent-orange-500"><span class="text-xs text-slate-700">${p.item_name}</span></label>`; });
}

function toggleRecipeCustomInput() {
    const ignore = document.getElementById('recipe-ignore-pantry').checked; const customInput = document.getElementById('recipe-custom-ingredients'); const pantrySel = document.getElementById('recipe-pantry-selection');
    if(ignore) { customInput.classList.remove('hidden'); pantrySel.classList.add('opacity-50', 'pointer-events-none'); } else { customInput.classList.add('hidden'); pantrySel.classList.remove('opacity-50', 'pointer-events-none'); }
}

function selectAllRecipePantry() { const cbs = document.querySelectorAll('.recipe-pantry-cb'); let allChecked = true; cbs.forEach(cb => { if(!cb.checked) allChecked = false; }); cbs.forEach(cb => cb.checked = !allChecked); }

async function generateRecipe() {
    const mealType = val('recipe-meal-type'); const diners = val('recipe-diners'); const ignore = document.getElementById('recipe-ignore-pantry').checked; const customIng = val('recipe-custom-ingredients');
    let pantryItems = []; document.querySelectorAll('.recipe-pantry-cb:checked').forEach(cb => pantryItems.push(cb.value));
    if(!ignore && pantryItems.length === 0) return showToast('error', 'יש לבחור מוצרים מהמזווה או לסמן התעלמות ולהקליד ידנית');
    if(ignore && !customIng) return showToast('error', 'יש להקליד מצרכים ידנית בתיבה');
    const btn = document.getElementById('btn-generate-recipe'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> השף חושב...';
    try {
        const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry: ignore, customIngredients: customIng, pantryItems: pantryItems.join(', ') }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) {
            const container = document.getElementById('recipe-result-container'); const content = document.getElementById('recipe-result-content');
            let html = data.recipe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); html = html.replace(/\n/g, '<br>');
            content.innerHTML = html; container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
        } else { showToast('error', data.error || 'שגיאה ביצירת מתכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור מתכון עכשיו'; }
}

function copyRecipe() { const text = document.getElementById('recipe-result-content').innerText; navigator.clipboard.writeText(text); showToast('success', 'המתכון הועתק בהצלחה!'); }

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); const btn = document.querySelector('#shop-modal button.bg-pink-500'); 
    const item = itemInput.value; const qty = val('shop-quantity'); const est = val('shop-est-price'); const unit = val('shop-unit') || "יח'"; 
    if(!item) return; if (btn.disabled) return; btn.disabled = true; btn.innerText = 'מוסיף...'; 
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); 
        if (data.success) { document.getElementById('shop-modal').classList.add('hidden'); itemInput.value = ''; document.getElementById('shop-est-price').value = ''; document.getElementById('shop-quantity').value = 1; document.getElementById('shop-unit').value = "יח'"; document.getElementById('suggestions').classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } 
    } finally { btn.disabled = false; btn.innerText = 'הוסף'; } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל הפריטים (הפעילים והחסרים) מרשימת הקניות? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה רוקנה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

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

    const isShopTabActive = document.getElementById('tab-shop') && document.getElementById('tab-shop').classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">העגלה ריקה</p>'; 
        const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = document.getElementById('cart-footer'); if(f) f.classList.remove('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-pink-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-pink-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`;
    });
    if(list) list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; document.getElementById(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const isChecked = row.querySelector('input[type="checkbox"]').checked; const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    document.getElementById('cart-total-display').innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else if (row.querySelector('input[type="checkbox"]').checked) { 
            count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
        } 
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום'); return; } 
    document.getElementById('summ-count').innerText = count; document.getElementById('summ-missing').innerText = missing; document.getElementById('summ-total').innerText = `₪${total.toFixed(2)}`; document.getElementById('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = document.getElementById('checkout-store').value || 'סופר כללי'; const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(document.getElementById(`price-${id}`).value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); triggerConfetti(); showToast('success', 'הקנייה הושלמה!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); document.getElementById('history-modal').classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

function openPasteListModal() { const pt = document.getElementById('paste-list-text'); if(pt) pt.value = ''; const pm = document.getElementById('paste-list-modal'); if(pm) pm.classList.remove('hidden'); }
async function submitPastedList() {
    const pt = document.getElementById('paste-list-text'); if(!pt) return; const text = pt.value; if (!text.trim()) return;
    const btn = document.getElementById('btn-submit-paste'); if(btn) { btn.disabled = true; btn.innerText = 'קולט נתונים...'; }
    const lines = text.split('\n').filter(l => l.trim() !== '');
    try {
        for (let line of lines) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: line.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, unitsPerPackage: 1}) }); }
        const pm = document.getElementById('paste-list-modal'); if(pm) pm.classList.add('hidden'); showToast('success', `נקלטו ${lines.length} שורות לרשימה!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'קלוט רשימה'; } }
}

function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*רשימת קניות מ-Oneflow Life:*\n\n`;
    activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } document.getElementById('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nהגדרתי אותך כשותף/מנהל (כמוני).\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nלחץ על הקישור להצטרפות:\n🔗 ${joinLink}` : `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להצטרף למשפחה שלנו ולפתוח לעצמך חשבון אישי:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); document.getElementById('invite-modal').classList.add('hidden'); 
}

function toggleFab() { const fc = document.getElementById('fab-container'); if(fc) fc.classList.toggle('fab-open'); }
function showToast(t,m) { const el=document.getElementById('toast'); const icon = document.getElementById('toast-icon'); if(!el || !icon) return; el.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { try{ confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch(e){} }
function triggerShake() { const app = document.getElementById('main-wrapper'); if(app){ app.classList.add('shake-effect'); setTimeout(() => app.classList.remove('shake-effect'), 500); } }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded-xl text-xs font-bold">העתק רשימה זו</button></div></div>`; }); document.getElementById('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { const ui = document.getElementById('bank-user-id'); if(ui) ui.value = id; const un = document.getElementById('bank-user-name'); if(un) un.innerText = `הגדרות עבור ${name}`; const ba = document.getElementById('bank-allowance'); if(ba) ba.value = allowance; const bi = document.getElementById('bank-interest'); if(bi) bi.value = interest; const bsm = document.getElementById('bank-settings-modal'); if(bsm) bsm.classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); const bsm = document.getElementById('bank-settings-modal'); if(bsm) bsm.classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע חלוקת דמי כיס וריבית לכל הילדים?')) return; const btn = document.querySelector('.btn-payday'); if(!btn) return; const origText = btn.innerHTML; btn.disabled=true; btn.innerHTML='מבצע...'; try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } finally { btn.disabled=false; btn.innerHTML=origText; } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { const gc = document.getElementById('goal-user-select-container'); if(gc) gc.classList.remove('hidden'); } const gt = document.getElementById('goal-title'); if(gt) gt.value = ''; const gta = document.getElementById('goal-target'); if(gta) gta.value = ''; const gm = document.getElementById('goal-modal'); if(gm) gm.classList.remove('hidden'); }
function openDepositModal(id, title) { const dgi = document.getElementById('deposit-goal-id'); if(dgi) dgi.value = id; const dgt = document.getElementById('deposit-goal-title'); if(dgt) dgt.innerText = title; const gdm = document.getElementById('goal-deposit-modal'); if(gdm) gdm.classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = document.getElementById('goal-target-user'); const guc = document.getElementById('goal-user-select-container'); const targetUserId = (currentUser.role === 'ADMIN' && guc && guc.style.display !== 'none' && select) ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); const gm = document.getElementById('goal-modal'); if(gm) gm.classList.add('hidden'); fetchData(); showToast('success', 'יעד נוצר!'); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = val('deposit-amount'); if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); const gdm = document.getElementById('goal-deposit-modal'); if(gdm) gdm.classList.add('hidden'); fetchData(); showToast('success', 'הפקדה בוצעה'); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    const tt = document.getElementById('trans-type'); if(tt) tt.value=t; 
    const tmt = document.getElementById('trans-modal-title'); if(tmt) tmt.innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s=document.getElementById('trans-cat'); 
    if(s) {
        s.innerHTML=''; 
        if(CATEGORIES[t]) CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    }
    const td = document.getElementById('trans-date'); if(td) td.value = new Date().toISOString().split('T')[0]; 
    if(typeof window.toggleTransType === 'function') window.toggleTransType('onetime'); 
    const tm = document.getElementById('transaction-modal'); if(tm) tm.classList.remove('hidden'); 
}

window.toggleTransType = function(type) {
    const isRecurring = type === 'recurring'; 
    const tir = document.getElementById('trans-is-recurring'); if(tir) tir.value = isRecurring;
    const btnOne = document.getElementById('btn-trans-onetime');
    if(btnOne) btnOne.className = isRecurring ? 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition' : 'flex-1 py-1.5 text-sm font-bold bg-white text-blue-600 rounded-lg shadow-sm transition';
    const btnRec = document.getElementById('btn-trans-recurring');
    if(btnRec) btnRec.className = isRecurring ? 'flex-1 py-1.5 text-sm font-bold bg-white text-blue-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    const edc = document.getElementById('trans-end-date-container');
    if(edc) {
        if (isRecurring) { edc.classList.remove('hidden'); } else { edc.classList.add('hidden'); const tem = document.getElementById('trans-end-month'); if(tem) tem.value = ''; }
    }
};

async function submitTransaction() { 
    const amount = val('trans-amount'); if(!amount) return; if(val('trans-type') === 'expense') triggerShake(); else triggerConfetti(); 
    const isRecurring = val('trans-is-recurring') === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null }) }); 
    const tm = document.getElementById('transaction-modal'); if(tm) tm.classList.add('hidden'); showToast('success', 'נשמר!'); fetchData(); 
}

function openShopModal() { const sm = document.getElementById('shop-modal'); if(sm) sm.classList.remove('hidden'); }
function openLoanModal() { const lm = document.getElementById('loan-modal'); if(lm) lm.classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); const lm = document.getElementById('loan-modal'); if(lm) lm.classList.add('hidden'); showToast('success', 'בקשת ההלוואה נשלחה להורה 📨'); fetchData(); fetchLoans(); }

// --- סוף הקובץ ---
