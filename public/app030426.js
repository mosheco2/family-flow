// Oneflow Life - Family Logic Application

const introStyle = document.createElement('style');
introStyle.innerHTML = `.introjs-showElement{z-index:9999998!important;transform:none!important;}.introjs-fixParent{z-index:auto!important;opacity:1.0!important;transform:none!important;filter:none!important;}body.introjs-active .slider-container,body.introjs-active .slider-scroll,body.introjs-active .overflow-hidden{overflow:visible!important;}body.introjs-active header.sticky{z-index:1!important;}.introjs-overlay{z-index:9999996!important;}.introjs-helperLayer{z-index:9999997!important;}.introjs-tooltipReferenceLayer{z-index:9999998!important;}.introjs-tooltip{z-index:9999999!important;}@media (max-width:768px){.introjs-tooltipReferenceLayer{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;margin:0!important;right:auto!important;bottom:auto!important;width:90vw!important;}.introjs-tooltip{position:relative!important;max-width:350px!important;margin:0 auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;}.introjs-arrow{display:none!important;}}.introjs-tooltip{font-family:'Rubik',sans-serif!important;border-radius:2rem!important;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important;padding:1.5rem!important;border:none!important;overflow:hidden!important;text-align:center!important;}.introjs-tooltip::before{content:'';position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(to right,#3b82f6,#a855f7);}.introjs-tooltipbuttons{border-top:none!important;padding-top:1rem!important;display:flex;gap:0.5rem;justify-content:center;}.introjs-button{border-radius:0.75rem!important;text-shadow:none!important;font-weight:bold!important;font-family:'Rubik',sans-serif!important;padding:0.75rem 1.5rem!important;flex:1;text-align:center;}.introjs-nextbutton{background-color:#3b82f6!important;color:white!important;border:none!important;box-shadow:0 10px 15px -3px rgba(59,130,246,0.3)!important;}.introjs-prevbutton{color:#64748b!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;}.introjs-skipbutton{color:#94a3b8!important;font-weight:500!important;background:transparent!important;}.introjs-bullets ul li a.active{background:#3b82f6!important;}`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

const getEl = id => document.getElementById(id);
const val = id => getEl(id) ? getEl(id).value : '';
const safeStr = str => (str || '').toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");

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
    const section = getEl('pwa-install-section'); const iosDiv = getEl('pwa-ios-instructions'); const androidDiv = getEl('pwa-android-instructions'); const btnInstall = getEl('btn-install-pwa');
    if(!section || !iosDiv || !androidDiv || !btnInstall) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) { section.classList.add('hidden'); return; }
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
    "חטיפים ומתוקים 🍫": ["במבה", "ביסלי", "בייגלה", "עוגיות", "שוקולד"] 
};
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

const hidePreloaderAndShowAuth = (view = 'splash') => {
    getEl('auth-container').classList.remove('hidden'); switchView(view);
    const preloader = getEl('app-preloader');
    if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
};

window.onload = async () => { 
    initAccessibility();
    const btnMonthly = getEl('btn-forecast-monthly'); const btnYearly = getEl('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const failsafeTimer = setTimeout(() => { const preloader = getEl('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { hidePreloaderAndShowAuth('login'); } }, 7000);
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { getEl('join-code').value = inviteCode; if(inviteRole) getEl('join-role').value = inviteRole; clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; }
    
    const savedSAToken = localStorage.getItem('ofl_sa_token');
    if (savedSAToken) {
        saToken = savedSAToken; clearTimeout(failsafeTimer); getEl('auth-container').classList.add('hidden'); getEl('sa-dashboard-container').classList.remove('hidden');
        const preloader = getEl('app-preloader'); if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
        loadSAData(); return;
    }

    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.group) { 
                if (session.group.type === 'BUSINESS') { window.location.href = '/business.html'; return; }
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('splash');
};

function showToast(t,m) { const el=getEl('toast'); const icon = getEl('toast-icon'); el.classList.remove('hidden'); getEl('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = getEl(`btn-${a}-text`); const ldr = getEl(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }

async function handleSALogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) }); const data = await res.json();
        if(data.success) { saToken = data.token; localStorage.setItem('ofl_sa_token', saToken); getEl('auth-container').classList.add('hidden'); getEl('sa-dashboard-container').classList.remove('hidden'); loadSAData(); } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); }
}
function logoutSA() { saToken = null; localStorage.removeItem('ofl_sa_token'); getEl('sa-dashboard-container').classList.add('hidden'); getEl('auth-container').classList.remove('hidden'); switchView('login'); }

async function updateSACredentials() {
    const newUsername = val('sa-new-username'); const newPassword = val('sa-new-password');
    if(!newUsername || !newPassword) return showToast('error', 'יש להזין שם משתמש וסיסמה חדשים');
    if(!confirm('האם אתה בטוח שברצונך לשנות את פרטי הגישה של המנהל הראשי?')) return;
    try {
        const res = await fetch(`${API}/superadmin/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ newUsername, newPassword }) }); const data = await res.json();
        if(data.success) { showToast('success', 'פרטי ההתחברות שונו בהצלחה!'); getEl('sa-new-username').value = ''; getEl('sa-new-password').value = ''; } else { showToast('error', data.error || 'שגיאה בעדכון פרטים'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

async function saveAllBanners() {
    try {
        const res = await fetch(`${API}/superadmin/banners`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ topText: val('sa-banner-top-text'), topLink: val('sa-banner-top-link'), topImg: val('sa-banner-top-img'), bottomText: val('sa-banner-bottom-text'), bottomLink: val('sa-banner-bottom-link'), bottomImg: val('sa-banner-bottom-img'), bizTopText: val('sa-biz-banner-top-text'), bizTopLink: val('sa-biz-banner-top-link'), bizTopImg: val('sa-biz-banner-top-img'), bizBottomText: val('sa-biz-banner-bottom-text'), bizBottomLink: val('sa-biz-banner-bottom-link'), bizBottomImg: val('sa-biz-banner-bottom-img') }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'הבאנרים נשמרו בהצלחה!'); fetchBanners(); } else { showToast('error', 'שגיאה בשמירת הבאנרים'); }
    } catch(e) { showToast('error', 'תקלת רשת מול השרת'); }
}

function applyBannersToDOM(banners) {
    const appTop = getEl('app-banner-top'); const appBottom = getEl('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; if(img) { const imgSrc = img.startsWith('http') ? img : `/${img}`; html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } else { el.classList.add('hidden'); el.classList.remove('flex'); }
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

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const setVal = (id, v) => { const e = getEl(id); if(e) e.value = v || ''; };
        setVal('sa-welcome-msg', data.welcomeMsg); setVal('sa-biz-welcome-msg', data.businessWelcomeMsg);
        setVal('sa-banner-top-text', data.adBannerTextTop); setVal('sa-banner-top-link', data.adBannerLinkTop); setVal('sa-banner-top-img', data.adBannerImgTop);
        setVal('sa-banner-bottom-text', data.adBannerTextBottom); setVal('sa-banner-bottom-link', data.adBannerLinkBottom); setVal('sa-banner-bottom-img', data.adBannerImgBottom);
        setVal('sa-biz-banner-top-text', data.bizBannerTextTop); setVal('sa-biz-banner-top-link', data.bizBannerLinkTop); setVal('sa-biz-banner-top-img', data.bizBannerImgTop);
        setVal('sa-biz-banner-bottom-text', data.bizBannerTextBottom); setVal('sa-biz-banner-bottom-link', data.bizBannerLinkBottom); setVal('sa-biz-banner-bottom-img', data.bizBannerImgBottom);

        const setTxt = (id, v) => { const e = getEl(id); if(e) e.innerText = v || 0; };
        if(data.stats) { setTxt('sa-stat-families', data.stats.families); setTxt('sa-stat-businesses', data.stats.businesses); setTxt('sa-stat-family-users', data.stats.familyUsers); setTxt('sa-stat-biz-users', data.stats.businessUsers); }

        const actList = getEl('sa-activity-list');
        if(actList) {
            actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | ${safeStr(a.group_name)} | <span class="font-bold">${safeStr(a.user_name)}</span> | ${safeStr(a.description)}</div> ${amountHtml}</div>`; }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        }
        saAllGroups = data.groups; saAllUsers = data.users; renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

function renderSAGroups() {
    const groupsList = getEl('sa-groups-list'); let gHtml = ''; const term = val('sa-search-group').toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${safeStr(u.nickname)} <span class="text-[10px] text-slate-400">(${u.role === 'ADMIN' ? 'הורה/מנהל' : 'בן משפחה'})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים רשומים.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        const typeBadge = g.type === 'BUSINESS' ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200"><i class="fa-solid fa-briefcase mr-1"></i> עסק</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-emerald-200"><i class="fa-solid fa-house mr-1"></i> משפחה</span>';
        const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'לא ידוע';
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid ${g.type === 'BUSINESS' ? 'fa-building' : 'fa-users'}"></i></div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${safeStr(g.name)} ${isPro} ${typeBadge}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | <span class="font-sans text-[10px]">הוקם: ${createdDate}</span></p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2"><button onclick="open360Report(${g.id})" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-eye"></i> דוח 360</button>${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחיקה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { renderSAGroups(); }
async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('האם למחוק סביבה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'הסביבה נמחקה לחלוטין'); loadSAData(); }

async function saveWelcomeMsg(type = 'FAMILY') { 
    const body = type === 'BUSINESS' ? { businessWelcomeMsg: val('sa-biz-welcome-msg') } : { welcomeMsg: val('sa-welcome-msg') };
    try { await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify(body) }); showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!'); } catch(e) { showToast('error', 'שגיאה בשמירת ההודעה'); }
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=FAMILY`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { getEl('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); getEl('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { getEl('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { getEl('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 300); }

function openAlertModal(title, text) { const titleEl = getEl('generic-alert-title'); const textEl = getEl('generic-alert-text'); const modal = getEl('generic-alert-modal'); if(titleEl && textEl && modal) { titleEl.innerText = title; textEl.innerText = text; modal.classList.remove('hidden'); } }

function executeWithAIWarning(actionCallback) {
    if (currentGroup && currentGroup.is_premium) return actionCallback();
    const todayStr = new Date().toLocaleDateString(); const dismissedDate = localStorage.getItem('ofl_ai_warning_dismissed'); if (dismissedDate === todayStr) return actionCallback();
    const modal = getEl('ai-warning-modal'); const tokensLeft = currentGroup && currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
    const leftEl = getEl('ai-warning-left'); if (leftEl) leftEl.innerText = tokensLeft;
    const btnContinue = getEl('btn-ai-warning-continue'); const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue);
    newBtn.onclick = () => { const dontShow = getEl('ai-warning-dont-show').checked; if (dontShow) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } modal.classList.add('hidden'); actionCallback(); };
    modal.classList.remove('hidden');
}

function startAdminTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו המשפחה שלכם מתנהלת פיננסית." },
            { element: '#tour-header', title: "מרכז השליטה שלכם", intro: "כאן תמצאו את קוד המשפחה. לחיצה על תפריט תפתח את ההגדרות.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "המערכת מונעת ע\"י familAI. כאן תוכלו לראות את כמות הפעולות שנותרה.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תוכלו לראות את היתרה הפנויה של המשפחה בזמן אמת.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "רישום הוצאה או הכנסה מכל מקום באפליקציה.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "רשימת קניות משותפת לכולם. צלמו קבלה ו-familAI תזין את הנתונים!", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מזווה 📦", intro: "עקבו אחרי המלאי בבית והעבירו מוצרים חסרים לרשימת הקניות.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "הגדירו דמי כיס שבועיים אוטומטיים לילדים ולמדו אותם לנהל כסף.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות הבית ✅", intro: "הגדירו משימות, תמחרו אותן, והילדים יקבלו תגמול על ביצוע.", position: 'bottom' },
            { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "יצרו לילדים אתגרים חינוכיים בהתאמה אישית עם ה-AI.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות חודשיים. familAI תנתח ותספק טיפים לחיסכון.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "צפו בפעולות עתידיות ותכננו את התקציב קדימה.", position: 'bottom' },
            { element: '#tab-recipes', title: "השף הפרטי 👨‍🍳", intro: "ה-AI ירקח עבורכם מתכון מהמוצרים שיש במזווה!", position: 'bottom' },
            { element: '#tab-members', title: "הזמנת המשפחה 👨‍👩‍👧‍👦", intro: "שלחו הזמנה מהירה בוואטסאפ לילדים ולבן/בת הזוג.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = getEl('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startChildTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות: להרוויח כסף ולחסוך נכון." },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "הכירו את familAI - העוזרת החכמה והסודית שלנו!", position: 'bottom' },
            { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "כאן מופיע כל הכסף שהרווחת מביצוע משימות ומדמי הכיס.", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "בקש להוסיף דברים לרשימת הקניות כאן.", position: 'bottom' },
            { element: '#tab-pantry', title: "המזווה 📦", intro: "בדוק בקלות אילו ממתקים או מוצרים כבר מחכים לכם בבית.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "פתח 'קופת חיסכון' למטרה שאתה חולם עליה ותראה את הריבית מצטברת.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "בחר משימה, סיים אותה, וקבל תגמול ישר לארנק!", position: 'bottom' },
            { element: '#tab-academy', title: "האקדמיה 🎓", intro: "ענה על חידונים כיפיים ותרוויח בונוסים על תשובות נכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "ראה על מה בזבזת את הכסף ולמד לתכנן קניות חכם.", position: 'bottom' },
            { element: '#tab-forecast', title: "התשקיף שלי 📅", intro: "צפה בהכנסות והוצאות עתידיות.", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "בחר מוצרים מהמטבח, והשף ייתן לך מתכון מנצח וקל להכנה!", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = getEl('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) {
    ['splash','login','create','join', 'sa-login'].forEach(v => { const el = getEl(`view-${v}`); if(el) el.classList.add('hidden'); });
    const tg = getEl(`view-${view}`); if(tg) tg.classList.remove('hidden');
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = getEl('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = getEl('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) { window.location.href = '/business.html'; return; } 
            else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) { window.location.href = '/'; return; }
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); if(!getEl('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) { window.location.href = '/business.html'; return; } 
            else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) { window.location.href = '/'; return; }
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); if(!getEl('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { getEl('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    getEl(`content-${t}`).classList.remove('hidden'); getEl(`tab-${t}`).classList.add('tab-active'); 
    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); getEl('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    if (t === 'pantry') renderPantry(); if (t === 'recipes') renderRecipePantrySelection(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
}

function updateBatteryUI() {
    const indicator = getEl('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent'); } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = getEl('ai-battery-modal'); const upgradeSec = getEl('ai-upgrade-section');
        if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden');
        modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { getEl('ai-battery-modal').classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = getEl('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

async function loadDashboard() {
    const authContainer = getEl('auth-container'); if (authContainer) authContainer.classList.add('hidden');
    getEl('dashboard-container').classList.remove('hidden'); getEl('fab-container').classList.remove('hidden');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
    getEl('dash-group-name').innerHTML = `${safeStr(currentGroup.name)} ${codeBadge}`; getEl('dash-nickname').innerText = currentUser.nickname; 

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        const profileUp = getEl('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
        const profileUp = getEl('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        getEl('card-name').innerText = currentUser.nickname.toUpperCase(); getEl('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; getEl('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
        const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
    }
    const btnAddBudget = getEl('btn-add-budget-cat'); if(btnAddBudget) btnAddBudget.classList.remove('hidden'); updateBatteryUI();
    
    try {
        if(!pollInterval) { pollInterval = setInterval(() => { try{ fetchData(); } catch(e){} try{ fetchLoans(); } catch(e){} if(isAdmin) { try{ fetchPendingUsers(); } catch(e){} } }, 30000); }
        try { fetchBanners(); } catch(e){}
        try { await fetchMembers(); } catch(e){}
        if(isAdmin) { try { fetchPendingUsers(); } catch(e){} }
        try { await fetchData(); } catch(e){}
        try { await fetchLoans(); } catch(e){}
    } catch (e) {
        showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = getEl('app-preloader'); 
        const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
    }
}

window.openBalanceAdjustmentModal = function(id, name) { getEl('adjustment-user-id').value = id; getEl('adjustment-user-name').innerText = `עבור: ${name}`; getEl('adjustment-amount').value = ''; getEl('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); getEl('balance-adjustment-modal').classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מההורה' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); getEl('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = getEl('budget-filter'); const fF = getEl('feed-user-filter'); const gS = getEl('goal-target-user'); const cfF = getEl('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל הבית</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור מי היעד? (כללי/למשפחה)</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${safeStr(m.nickname)}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = getEl('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${safeStr(m.nickname) || 'משתמש'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = getEl('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים במשפחה עדיין.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(m.nickname) || 'ילד'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/שבוע • ${m.interest_rate || 0}% ריבית</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-blue-600">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="קנס/בונוס"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${safeStr(m.nickname)}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
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

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = getEl('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
        }

        if (currentUser.role === 'ADMIN') {
            const balEl = getEl('user-balance'); 
            if(balEl) {
                // הצגת היתרה הכללית שמחושבת על ידי השרת (הכנסות פחות הוצאות)
                const realBalance = data.group.admin_total_balance || 0;
                balEl.innerText = `₪${parseFloat(realBalance).toFixed(2)}`;
                balEl.className = `text-3xl font-bold font-mono tracking-tight mt-1 ${realBalance >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        } else {
            const balEl = getEl('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        try {
            const goalsList = getEl(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? getEl('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${safeStr(g.owner_name)}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${safeStr(g.title)}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${safeStr(g.title)}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = getEl('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = getEl('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = getEl('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); if (getEl('tab-cashflow').classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) {}
}

function showFamilAIModal(title, text) {
    getEl('familai-advisor-modal').classList.remove('hidden'); getEl('familai-modal-subtitle').innerText = title;
    if (text) { getEl('familai-advisor-loading').classList.add('hidden'); getEl('familai-advice-text').innerText = text; getEl('familai-advisor-content').classList.remove('hidden'); } 
    else { getEl('familai-advisor-loading').classList.remove('hidden'); getEl('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { getEl('ai-modal').classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); getEl('ai-modal').classList.add('hidden'); getEl('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת המבחן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית של המשפחה', null); getEl('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); fetchData(); } 
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסטית התקציב', null); getEl('familai-loading-text').innerText = 'בודקת על מה הוצאנו החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהלת המזווה', null); getEl('familai-loading-text').innerText = 'מחשבת כמויות ומרגלי קנייה...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהלת המזווה', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; getEl('btn-tutor').disabled = true; getEl('btn-tutor').innerText = 'מכינה הסבר... ⏳';
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('המורה הפרטית שלך', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { getEl('btn-tutor').disabled = false; getEl('btn-tutor').innerHTML = '<img src="logo.png" alt="AI" class="w-5 h-5 object-contain"> familAI, איפה טעיתי?'; }
    });
}

// === פונקציות השף (Recipes) ===
function renderRecipePantrySelection() {
    const list = getEl('recipe-pantry-items-list'); if (!list) return; list.innerHTML = '';
    if (!pantryCache || pantryCache.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400">המזווה ריק. הוסיפו מוצרים למזווה כדי שהשף יוכל להשתמש בהם.</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<label class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-100 transition"><input type="checkbox" class="recipe-pantry-cb w-3 h-3 accent-orange-500" value="${safeStr(p.item_name)}" checked><span class="text-[11px] text-slate-600 font-medium">${safeStr(p.item_name)}</span></label>`;
    });
}

function selectAllRecipePantry() {
    const cbs = document.querySelectorAll('.recipe-pantry-cb'); if(cbs.length === 0) return;
    const firstState = cbs[0].checked; cbs.forEach(cb => cb.checked = !firstState);
}

function toggleRecipeCustomInput() {
    const isCustom = getEl('recipe-ignore-pantry').checked; const customArea = getEl('recipe-custom-ingredients'); const pantryArea = getEl('recipe-pantry-selection');
    if (isCustom) { customArea.classList.remove('hidden'); pantryArea.classList.add('hidden'); } else { customArea.classList.add('hidden'); pantryArea.classList.remove('hidden'); }
}

async function generateRecipe() {
    executeWithAIWarning(async () => {
        const mealType = val('recipe-meal-type'); const diners = val('recipe-diners'); const ignorePantry = getEl('recipe-ignore-pantry').checked; const customIngredients = val('recipe-custom-ingredients');
        let pantryItems = [];
        if (!ignorePantry) {
            document.querySelectorAll('.recipe-pantry-cb:checked').forEach(cb => pantryItems.push(cb.value));
            if (pantryItems.length === 0) return showToast('error', 'יש לבחור לפחות מוצר אחד מהמזווה, או לסמן "התעלם מהמזווה"');
        } else { if (!customIngredients) return showToast('error', 'יש להקליד מצרכים חלופיים בתיבה'); }

        const btn = getEl('btn-generate-recipe'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> familAI רוקחת מתכון...';
        try {
            const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry, customIngredients, pantryItems: pantryItems.join(', ') }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if (data.success) {
                let formattedRecipe = data.recipe;
                formattedRecipe = formattedRecipe.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-orange-600 mt-4 mb-2">$1</h3>');
                formattedRecipe = formattedRecipe.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-800 mt-5 mb-3">$1</h2>');
                formattedRecipe = formattedRecipe.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');
                formattedRecipe = formattedRecipe.replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal font-bold text-slate-700"><span class="font-normal">$1</span></li>');
                formattedRecipe = formattedRecipe.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
                getEl('recipe-result-content').innerHTML = formattedRecipe; getEl('recipe-result-container').classList.remove('hidden'); getEl('recipe-result-container').scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
            } else { showToast('error', data.error || 'שגיאה ביצירת המתכון'); }
        } catch (e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור מתכון עכשיו'; }
    });
}

function copyRecipe() {
    const text = getEl('recipe-result-content').innerText;
    navigator.clipboard.writeText(text).then(() => { showToast('success', 'המתכון הועתק ללוח!'); }).catch(err => { showToast('error', 'שגיאה בהעתקה'); });
}
// ==========================

function setTaskMode(mode) {
    const mBtn = getEl('btn-mode-manual'); const aBtn = getEl('btn-mode-ai'); const mDiv = getEl('task-mode-manual'); const aDiv = getEl('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-purple-600 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-purple-600 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { getEl('task-modal').classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    getEl('task-modal').classList.remove('hidden'); getEl('task-is-self').value = isSelf; 
    getEl('task-days').value = ''; getEl('task-title').value = ''; getEl('task-reward').value = ''; getEl('ai-task-topic').value = ''; getEl('ai-task-results').classList.add('hidden');
    setTaskMode('manual'); const toggles = getEl('task-mode-toggles'); const assigneeContainer = getEl('task-assignee-container'); const rewardInput = getEl('task-reward'); const assigneeSelect = getEl('task-assignee');

    if(isSelf) { 
        getEl('task-modal-title').innerText = 'מעשה טוב'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardInput.placeholder = 'כמה מגיע לי? (₪)'; 
    } else { 
        getEl('task-modal-title').innerText = 'יצירת משימה'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardInput.placeholder = 'תגמול (₪)';
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין ילדים רשומים</option>';
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = val('task-is-self') === 'true'; 
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
                const resultsContainer = getEl('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
                data.tasks.forEach(task => { const safeTitle = safeStr(task.title); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${safeTitle}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; }
    });
}

function selectAITask(title, reward) { getEl('task-title').value = title; getEl('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = val('task-is-self') === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const btn = getEl('btn-submit-task'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const statusToSend = isSelf ? 'done' : 'pending';
    try {
        const res = await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend, groupId: currentGroup.id }) }); 
        const data = await res.json();
        if(data.success) { if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור ההורה!' : 'משימה נוצרה בהצלחה!'); fetchData(); } else showToast('error', data.error || 'שגיאה ביצירת משימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'צור משימה'; } }
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

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; getEl('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות', null); getEl('familai-loading-text').innerText = 'familAI בודקת את התמונה שלך...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('קופאית אוטומטית', null); getEl('familai-loading-text').innerText = 'familAI סורקת את הקבלה... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('קופאית אוטומטית', `סרקתי והוספתי ${data.count} פריטים מהקבלה לעגלה שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת החשבונית.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי מוצר חכם', null); getEl('familai-loading-text').innerText = 'familAI בודקת איזה מוצר צילמת...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    getEl('familai-advisor-modal').classList.add('hidden');
                    if (target === 'shop') { getEl('shop-item').value = data.productName; openShopModal(); } else { getEl('pantry-item').value = data.productName; openPantryModal(); }
                    showToast('success', 'המוצר זוהה בהצלחה!');
                } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר בתמונה.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת מול השרת.'); }
            event.target.value = '';
        });
    });
}

function closeBarcodeScanner() { const modal = getEl('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

// ======================================
// הוספה וגריעה חכמה מהמזווה (כולל שברים)
// ======================================

function renderPantry() {
    const list = getEl('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה/ארון ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        const n = safeStr(p.item_name); const u = safeStr(p.unit || "יח'");
        const packQty = parseFloat(p.quantity); const upp = parseInt(p.units_per_package) || 1;
        const totalSubUnits = Math.round(packQty * upp);
        
        let qtyDisplay = '';
        if (upp > 1) {
            qtyDisplay = `
            <div class="flex flex-col items-center px-3 min-w-[75px]">
                <span class="text-2xl font-black text-slate-800 leading-none">${packQty.toFixed(2)}</span>
                <span class="text-[10px] font-bold text-slate-400 mt-1">${u}</span>
                <span class="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full mt-1.5 w-max shadow-sm tracking-tight">${totalSubUnits} יחידות</span>
            </div>`;
        } else {
            qtyDisplay = `
            <div class="flex flex-col items-center px-3 min-w-[75px]">
                <span class="text-2xl font-black text-slate-800 leading-none">${packQty}</span>
                <span class="text-xs font-bold text-slate-400 mt-1">${u}</span>
            </div>`;
        }

        const minusAmount = packQty - (1 / upp);
        const plusAmount = packQty + (1 / upp);

        list.innerHTML += `
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col mb-3">
            <div class="flex justify-between items-center mb-3">
                <div class="flex-1 pr-2">
                    <h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4>
                    <p class="text-[10px] text-slate-400 mt-1">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${upp} יח'</p>
                </div>
                <div class="flex items-center bg-slate-50 px-2 py-2 rounded-xl border border-slate-100 shadow-inner">
                    <button onclick="updatePantryQty(${p.id}, ${minusAmount})" class="text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 transition"><i class="fa-solid fa-minus text-sm"></i></button>
                    ${qtyDisplay}
                    <button onclick="updatePantryQty(${p.id}, ${plusAmount})" class="text-slate-400 hover:text-green-500 w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 transition"><i class="fa-solid fa-plus text-sm"></i></button>
                </div>
            </div>
            <div class="flex gap-2 mt-1 border-t border-slate-100 pt-3">
                <button onclick="openPantryUseModal('${n}', '${u}', ${packQty}, ${upp})" class="flex-1 bg-orange-50 text-orange-600 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils text-orange-500"></i> השתמשתי</button>
                <button onclick="movePantryToCart(${p.id}, '${n}', '${u}')" class="flex-1 bg-pink-50 text-pink-600 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-pink-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down text-pink-500"></i> חסר (לקניות)</button>
            </div>
        </div>`;
    });
}

function openPantryModal() { getEl('pantry-modal').classList.remove('hidden'); }

async function submitPantryItem() {
    const name = val('pantry-item'); const qty = parseFloat(val('pantry-quantity')) || 1; const unit = val('pantry-unit') || "יח'"; const upp = parseInt(val('pantry-upp')) || 1; 
    if(!name) return showToast('error', 'יש להזין שם מוצר');
    const btn = getEl('btn-submit-pantry'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
        const data = await res.json();
        if (data.success) { getEl('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); getEl('pantry-unit').value = "יח'"; getEl('pantry-upp').value = 1; fetchData(); showToast('success', 'המוצר נקלט במלאי'); } 
        else { showToast('error', data.error || 'שגיאת שרת בהוספת הפריט'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף לבית'; } }
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר אזל מהמלאי. האם למחוק את הרישום? (ניתן להעביר לרכש במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}

function openPantryUseModal(name, unit, qty, upp) { 
    const totalSubUnits = Math.round(parseFloat(qty) * parseInt(upp || 1));
    getEl('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; 
    getEl('use-pantry-name').value = name; 
    
    let dynContainer = getEl('pantry-dyn-container');
    if (!dynContainer) {
        const origInput = getEl('use-pantry-qty');
        if(origInput && origInput.parentElement && origInput.parentElement.parentElement) {
            dynContainer = document.createElement('div');
            dynContainer.id = 'pantry-dyn-container';
            origInput.parentElement.parentElement.insertBefore(dynContainer, origInput.parentElement);
            origInput.parentElement.style.display = 'none';
        }
    }
    
    if (dynContainer) {
        dynContainer.innerHTML = `
            <div class="text-center mb-4 bg-orange-50 text-orange-700 py-2.5 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-1">
                <span class="font-bold text-sm">יתרה: ${parseFloat(qty).toFixed(2)} ${unit}</span>
                <span class="text-xs font-medium opacity-80">(סה"כ ${totalSubUnits} יחידות)</span>
            </div>
            
            <div class="space-y-3">
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">כמה יחידות לקחת?</label>
                    <input type="number" id="use-pantry-units-dyn" placeholder="יחידות בודדות" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-slate-800 text-center shadow-sm focus:border-orange-500 transition">
                </div>
                
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">או: שימוש לפי מארז / משקל שלם</label>
                    <input type="number" step="0.1" id="use-pantry-qty-dyn" placeholder="כמה ${unit} לקחת?" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-500 text-center text-sm focus:border-slate-400 transition">
                </div>
            </div>
        `;
    }
    
    const display = getEl('use-pantry-unit-display');
    if(display) display.innerText = unit || "יח'"; 
    getEl('pantry-use-modal').classList.remove('hidden'); 
}

async function submitPantryUse() {
    const name = val('use-pantry-name'); 
    const dynQty = val('use-pantry-qty-dyn');
    const origQty = val('use-pantry-qty');
    const qty = dynQty !== '' && dynQty !== undefined ? dynQty : origQty;
    
    const dynUnits = val('use-pantry-units-dyn');
    const origUnits = val('use-pantry-units');
    const units = dynUnits !== '' && dynUnits !== undefined ? dynUnits : origUnits;

    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: parseFloat(qty) || 0, usedUnits: parseFloat(units) || 0 }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); getEl('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id, groupId: currentGroup.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לבקשת רכש!'); fetchData(); }

function renderChildTodo() {
    const todoSection = getEl('child-todo-section'); const todoList = getEl('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-blue-50 transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(t.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • משימה • תגמול: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-purple-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • אתגר לימודי • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function openApproveTaskModal(id, title, currentReward) { getEl('approve-task-id').value = id; getEl('approve-task-title').innerText = title; getEl('approve-task-reward').value = currentReward || 0; getEl('approve-task-modal').classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = getEl('approve-task-id').value; const finalReward = getEl('approve-task-reward').value;
    getEl('approve-task-modal').classList.add('hidden'); triggerConfetti();
    const res = await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    const data = await res.json();
    if(data.success) { showToast('success', 'המשימה אושרה והתגמול הועבר!'); fetchData(); } else showToast('error', data.error);
}

function renderTasks(tasks) {
    const list = getEl('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${safeStr(t.title)}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${safeStr(t.title)}', ${t.reward})" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; } else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">אישי</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${safeStr(t.title)} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${safeStr(t.assignee_name)}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr;
}

async function updateTask(id, s) { if(s==='done' || s==='completed_self') triggerConfetti(); await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:s})}); fetchData(); }

function buildAndRenderFeed() {
    feedCache = [];
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח בהצלחה! 🎉', amount: 0, status: 'welcome' }); }
    if(Array.isArray(allTransactions)) { allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); }); }
    if(Array.isArray(allTasks)) { allTasks.forEach(t => { if(t.status === 'approved') { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה: ${t.title}`, amount: t.reward, status: t.status }); } }); }
    if(Array.isArray(bundlesCache)) { bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); }); }
    feedCache.sort((a, b) => (b.date && a.date) ? (b.date - a.date) : 0);
    const filterEl = getEl('feed-user-filter');
    if (filterEl) { if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); else filterEl.classList.add('hidden'); }
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const userFilter = val('feed-user-filter') || 'all'; const dateFilter = val('feed-date-filter') || 'all'; const list = getEl('unified-feed-list'); if (!list) return;
    let filtered = feedCache;
    if (currentUser.role !== 'ADMIN') { filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); } 
    else if (userFilter !== 'all' && userFilter !== '') { filtered = feedCache.filter(item => String(item.user_id) === String(userFilter) || item.type === 'system'); }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(item => item.date && item.date >= cutoffDate); }
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; return; }
    
    let html = '';
    filtered.forEach(item => {
        if(!item.date || isNaN(item.date.getTime())) return;
        const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); 
        const userNameDisplay = item.type !== 'system' && item.user_name ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${safeStr(item.user_name)}</span>` : '';
        const d = item.date; const today = new Date(); const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
        let contentHtml = '';
        if (item.type === 'transaction') {
            const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; const prefix = item.isIncome ? '+' : '-';
            contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        } else if (item.type === 'task') {
            const icon = '<i class="fa-solid fa-list-check text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'pending' ? 'הוקצתה' : (item.status === 'done' ? 'ממתין לאישור' : 'הושלמה'); let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'quiz') {
            const icon = '<i class="fa-solid fa-graduation-cap text-purple-500 bg-purple-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'assigned' ? 'הוקצה' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'נכשל/פג תוקף'); let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'system') {
            const icon = '<i class="fa-solid fa-house text-orange-500 bg-orange-100 p-1.5 rounded-full text-[10px]"></i>';
            contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div></div>`;
        }
        html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border transform transition hover:scale-[1.01] mb-2 flex items-center">${contentHtml}</div>`;
    });
    list.innerHTML = html;
}

function renderCashflow() {
    const list = getEl('cashflow-list'); if (!list) return;
    const userFilter = val('cashflow-user-filter') || 'all'; const dateFilter = val('cashflow-date-filter') || 'all';
    let filtered = allTransactions; 
    if (currentUser.role !== 'ADMIN') { filtered = allTransactions.filter(t => String(t.user_id) === String(currentUser.id)); const cfFilter = getEl('cashflow-user-filter'); if(cfFilter) cfFilter.classList.add('hidden'); } 
    else { const cfFilter = getEl('cashflow-user-filter'); if(cfFilter) cfFilter.classList.remove('hidden'); if (userFilter !== 'all' && userFilter !== '') { filtered = allTransactions.filter(t => String(t.user_id) === String(userFilter)); } }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(t => new Date(t.date) >= cutoffDate); }
    if (filtered.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין תנועות תזרים להצגה בתקופה זו.</p>'; return; }
    let html = '';
    filtered.forEach(t => {
        const isIncome = t.type === 'income'; const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
        const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
        const d = new Date(t.date); const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
        const userName = t.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${safeStr(t.user_name)}</span>` : '';
        const catLabel = BUDGET_LABELS[t.category] || t.category || ''; const catBadge = catLabel ? `<span class="text-[9px] text-slate-400 border border-slate-200 px-1.5 rounded-full mr-2">${catLabel}</span>` : '';
        const editBtn = currentUser.role === 'ADMIN' ? `<button onclick="openEditTransactionModal(${t.id}, ${t.amount}, '${safeStr(t.description)}', '${t.category}', '${t.type}')" class="text-blue-500 bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-100 transition"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
        html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between hover:border-blue-100 transition"><div class="flex-1 overflow-hidden pr-2"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${safeStr(t.description)}</span> ${userName}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} ${catBadge}</p></div><div class="flex items-center gap-3 pl-1"><span class="font-bold text-base ${amountClass} whitespace-nowrap" dir="ltr">${prefix}₪${t.amount}</span>${editBtn}</div></div>`;
    });
    list.innerHTML = html;
}

function openEditTransactionModal(id, amount, desc, cat, type) {
    getEl('edit-trans-id').value = id; getEl('edit-trans-old-amount').value = amount; getEl('edit-trans-type').value = type; getEl('edit-trans-amount').value = amount; getEl('edit-trans-desc').value = desc;
    const catSelect = getEl('edit-trans-cat'); catSelect.innerHTML = '';
    if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; }
    getEl('edit-transaction-modal').classList.remove('hidden');
}

async function submitEditTransaction() {
    const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat');
    if(!amount) return showToast('error', 'נא להזין סכום');
    const btn = getEl('btn-submit-edit-transaction'); if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה עודכנה!'); getEl('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'שמור שינויים'; } }
}

async function deleteTransaction() {
    const id = val('edit-trans-id'); if(!confirm('האם אתה בטוח שברצונך למחוק פעולה זו לחלוטין? היתרה תתעדכן בהתאם.')) return;
    try {
        const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה נמחקה!'); getEl('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function updateAssignDetails() { const select = getEl('assign-bundle-select'); const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { getEl('assign-reward').value = bundle.reward; } }
function openAssignModal() {
    const cSelect = getEl('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר ילד...</option>';
    if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; }); }
    const bSelect = getEl('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${safeStr(b.title)} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; }
    getEl('assign-reward').value = ''; getEl('assign-days').value = ''; getEl('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = getEl('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); const reward = val('assign-reward'); const days = val('assign-days');
    if(!childId) return showToast('error', 'אנא בחר ילד להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    const res = await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days, groupId: currentGroup.id }) });
    const data = await res.json();
    if(data.success) { getEl('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData(); } else showToast('error', data.error);
}

function renderAdminAcademy() {
    const list = getEl('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר familAI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה לילד</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבחנים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו מבחנים לאף ילד עדיין.</p>'; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${safeStr(b.assignee_name)}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    try {
        const libList = getEl('library-list'); if (!libList) return;
        const ageFilter = val('lib-age-filter') || 'all'; const catFilter = val('lib-cat-filter') || 'all';
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים להציג כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'math') return '<i class="fa-solid fa-calculator"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-chart-line"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

function renderMyAssignments(bundles) {
    const list = getEl('my-assignments-list'); const histList = getEl('academy-history-list'); const histCont = getEl('academy-history-container');
    if (!list) return; list.innerHTML = ''; if (histList) histList.innerHTML = ''; let histCount = 0; let actCount = 0;
    if(Array.isArray(bundles)) {
        bundles.forEach(b => {
            const reward = b.custom_reward !== null ? b.custom_reward : b.default_reward;
            if (b.status === 'assigned') {
                actCount++; let dMsg = ""; if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? `<span class="text-orange-500 font-bold bg-orange-50 px-1 rounded ml-2">עוד ${diff} ימים</span>` : `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-2">איחור!</span>`; }
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-3"><div class="flex-1"><h4 class="font-bold text-slate-800">${safeStr(b.title)}</h4><p class="text-xs text-slate-500 mt-1">תמריץ מעבר: ₪${reward} ${dMsg}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow hover:bg-blue-700 transition"><i class="fa-solid fa-play"></i> התחל</button></div>`;
            } else {
                histCount++; if(histList) { let sColor = b.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'; let sText = b.status === 'completed' ? 'הושלם' : 'נכשל';
                histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400 mt-1">ציון: ${b.score}% • תמריץ: ₪${b.status==='completed'?reward:0}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded ${sColor}">${sText}</span></div>`; }
            }
        });
    }
    if (actCount === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין מטלות למידה פתוחות.</p>';
    if (histCount > 0 && histCont) histCont.classList.remove('hidden'); else if(histCont) histCont.classList.add('hidden');
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'הלומדה שויכה בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר מהיר'; } }
}

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    getEl('quiz-title').innerText = bundle.title; getEl('btn-tutor').classList.add('hidden'); 
    const textContainer = getEl('quiz-text-container');
    if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); }
    getEl('quiz-runner-modal').classList.remove('hidden'); renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    getEl('q-progress').innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; getEl('q-text').innerText = q.q;
    const optsContainer = getEl('q-options'); optsContainer.innerHTML = '';
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
    getEl('question-container').classList.add('hidden'); getEl('quiz-text-container').classList.add('hidden'); getEl('quiz-result').classList.remove('hidden');
    getEl('quiz-icon').innerHTML = passed ? '🏆' : '📚'; getEl('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא, אפשר לנסות שוב...'; getEl('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; getEl('quiz-score-display').innerText = `ציון סופי: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) getEl('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore, groupId: currentGroup.id }) });
    fetchData(); 
}

function closeQuiz() { getEl('quiz-runner-modal').classList.add('hidden'); getEl('question-container').classList.remove('hidden'); getEl('quiz-result').classList.add('hidden'); }

function filterSuggestions(v) { const list = getEl('suggestions'); list.innerHTML = ''; if (!v) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(v)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { getEl('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = getEl('shop-item'); const btn = getEl('btn-submit-shop'); 
    const item = itemInput.value; const qty = parseFloat(val('shop-quantity')) || 1; const est = parseFloat(val('shop-est-price')) || 0; const unit = val('shop-unit') || "יח'"; const upp = parseInt(val('shop-upp')) || 1;
    if(!item) return; if (btn && btn.disabled) return; 
    if (btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, unitsPerPackage: upp, userId: currentUser.id, groupId: currentGroup.id}) }); 
        const data = await res.json(); 
        if (data.success) { 
            getEl('shop-modal').classList.add('hidden'); itemInput.value = ''; getEl('shop-est-price').value = ''; getEl('shop-quantity').value = 1; getEl('shop-unit').value = "יח'"; getEl('shop-upp').value = 1; getEl('suggestions').classList.add('hidden'); 
            if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; 
            showToast('success', 'נוסף לרשימה'); fetchData(); 
        } else { showToast('error', data.error || 'שגיאת שרת בהוספת פריט לרכש'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'הוסף'; } } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט דרישה זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק בהצלחה'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל בקשות הרכש? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה אופסה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement.classList.contains('price-input')) return;
    const list = getEl('shop-list'); const reqList = getEl('shop-requests-list'); const reqContainer = getEl('shop-requests-container');
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין להורה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${safeStr(i.item_name)}</span><span class="text-xs text-slate-500 block">בקשה מאת: ${safeStr(i.requester_name)}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    const isShopTabActive = getEl('tab-shop') && getEl('tab-shop').classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">רשימת ההזמנות ריקה</p>'; 
        const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = getEl('cart-footer'); if(f) f.classList.remove('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        
        if (i.best_price && i.best_price.price_per_unit > 0) { 
            const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); 
            const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL');
            const sourceText = i.best_price.is_local ? 'קנית בעבר' : 'חוכמת ההמונים';
            const badgeColor = i.best_price.is_local ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600';
            const icon = i.best_price.is_local ? 'fa-clock-rotate-left' : 'fa-users';
            bestPriceHtml = `<div class="text-[9px] font-bold ${badgeColor} px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid ${icon}"></i> ${sourceText}: ₪${bestP}/${i.unit || "יח'"} (${safeStr(i.best_price.store_name)}, ${dDate})</div>`; 
        }

        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-blue-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${safeStr(i.item_name)}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">ביקש/ה: ${safeStr(i.requester_name)}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${safeStr(i.unit || "יח'")}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-blue-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${safeStr(i.unit || "יח'")}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר בספק</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = getEl(`row-${id}`); const input = getEl(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = getEl(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: parseFloat(value) || 0})}); const data = await res.json(); const freshWisdomDiv = getEl(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = parseFloat(value) || 0; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = getEl(`row-${id}`); const btn = getEl(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; getEl(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר בספק'; } calcRunningTotal(); }

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
    getEl('cart-total-display').innerText = `₪${total.toFixed(2)}`; 
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
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום לאישור'); return; } 
    getEl('summ-count').innerText = count; getEl('summ-missing').innerText = missing; getEl('summ-total').innerText = `₪${total.toFixed(2)}`; getEl('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = val('checkout-store') || 'סופר כללי'; const branch = val('checkout-branch'); let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(getEl(`price-${id}`).value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    const res = await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const data = await res.json();
    if(data.success) { getEl('confirm-checkout-modal').classList.add('hidden'); showToast('success', 'הקניה בוצעה ואושרה למזווה!'); fetchData(); } else showToast('error', data.error);
}

async function copyList(tripId) { if(!confirm('האם לייבא את דרישת הרכש מחדש?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); getEl('history-modal').classList.add('hidden'); showToast('success', 'הדרישה הועתקה!'); fetchData(); }

function openInviteModal() { const codeSpan = getEl('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } getEl('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו בנק משפחתי ב-Oneflow Life 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו להתנהל עם Oneflow Life 🚀\n\nקוד המשפחה לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); getEl('invite-modal').classList.add('hidden'); 
}

function toggleFab() { getEl('fab-container').classList.toggle('fab-open'); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = getEl('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${safeStr(i.item_name)} (x${i.quantity} ${safeStr(i.unit || "יח'")})</span><span class="font-bold">₪${i.price_per_unit || 0}/${safeStr(i.unit || "יח'")}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${safeStr(t.store_name)} ${t.branch_name ? `(${safeStr(t.branch_name)})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • אישור: ${safeStr(t.nickname)}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700">יבא דרישה שוב</button></div></div>`; }); getEl('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { getEl('bank-user-id').value = id; getEl('bank-user-name').innerText = `תקציב דמי כיס: ${name}`; getEl('bank-allowance').value = allowance; getEl('bank-interest').value = interest; getEl('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); getEl('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לחלק דמי כיס וריבית לכל הילדים כעת?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { showToast('success', `חולקו ${data.totalDistributed} ש"ח לקופות הילדים!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה בשרת'); } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { getEl('goal-user-select-container').classList.remove('hidden'); } getEl('goal-title').value = ''; getEl('goal-target').value = ''; getEl('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { getEl('deposit-goal-id').value = id; getEl('deposit-goal-title').innerText = title; getEl('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = parseFloat(val('goal-target')) || 0; const select = getEl('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && getEl('goal-user-select-container').style.display !== 'none') ? select.value : null; const res = await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target, groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { getEl('goal-modal').classList.add('hidden'); fetchData(); showToast('success', 'יעד הוגדר בהצלחה'); } else showToast('error', data.error); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = parseFloat(val('deposit-amount')) || 0; if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount, groupId: currentGroup.id }) }); const data = await res.json(); if (data.success) { getEl('goal-deposit-modal').classList.add('hidden'); fetchData(); showToast('success', 'העברה בוצעה'); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    getEl('trans-type').value=t; getEl('trans-modal-title').innerText=t==='income'?'הכנסה':'הוצאה'; 
    const s=getEl('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    getEl('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); getEl('transaction-modal').classList.remove('hidden'); 
}

async function submitTransaction() { 
    const amount = parseFloat(val('trans-amount')) || 0; if(!amount) return showToast('error', 'נא להזין סכום תקין'); 
    const btn = getEl('btn-submit-transaction'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const isRecurring = val('trans-is-recurring') === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null, groupId: currentGroup.id }) }); 
        const data = await res.json();
        if (data.success) { getEl('transaction-modal').classList.add('hidden'); showToast('success', 'נרשם בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה ברישום הפעולה'); }
    } catch(e) { showToast('error', 'שגיאת שרת בשמירת פעולה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'רשום פעולה'; } }
}

function openShopModal() { getEl('shop-modal').classList.remove('hidden'); }
function openLoanModal() { getEl('loan-modal').classList.remove('hidden'); }

async function submitLoan() { 
    const amount = parseFloat(val('loan-amount')) || 0; if(amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    const btn = getEl('btn-submit-loan'); if (btn) { btn.disabled = true; btn.innerText = 'שולח...'; }
    try {
        const res = await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:amount, reason:val('loan-reason'), groupId: currentGroup.id})}); 
        const data = await res.json();
        if (data.success) { getEl('loan-modal').classList.add('hidden'); showToast('success', 'בקשת ההלוואה נשלחה להורה 📨'); fetchData(); fetchLoans(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בשליחת בקשה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'שלח'; } }
}

async function fetchLoans() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/loans?groupId=${currentGroup.id}`); const loans = await res.json();
        const myLoansList = getEl('my-loans-list'); const adminLoansList = getEl('admin-loans-list'); const adminPanel = getEl('admin-loans-panel');
        if (myLoansList) {
            myLoansList.innerHTML = ''; const myLoans = loans.filter(l => String(l.user_id) === String(currentUser.id));
            if(myLoans.length === 0) myLoansList.innerHTML = '<p class="text-sm text-slate-400 py-2">אין בקשות פעילות.</p>';
            myLoans.forEach(l => {
                let statusHtml = '';
                if(l.status === 'pending') statusHtml = '<span class="text-xs text-orange-500 font-bold bg-orange-100 px-2 py-1 rounded">ממתין לאישור</span>';
                else if(l.status === 'approved') statusHtml = '<span class="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">אושר</span>';
                else statusHtml = '<span class="text-xs text-red-500 font-bold bg-red-100 px-2 py-1 rounded">נדחה</span>';
                myLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm"><div><span class="font-bold text-slate-800">₪${l.amount}</span><p class="text-xs text-slate-500">${safeStr(l.reason)}</p></div>${statusHtml}</div>`;
            });
        }
        if (currentUser.role === 'ADMIN' && adminLoansList && adminPanel) {
            const pendingLoans = loans.filter(l => l.status === 'pending'); adminLoansList.innerHTML = '';
            if (pendingLoans.length > 0) {
                adminPanel.classList.remove('hidden');
                pendingLoans.forEach(l => { adminLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl mb-2 shadow-sm border border-orange-100"><div class="flex justify-between items-center mb-2"><span class="font-bold text-slate-800">${safeStr(l.nickname)} מבקש/ת ₪${l.amount}</span><span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</span></div><p class="text-xs text-slate-600 mb-3">${safeStr(l.reason)}</p><div class="flex gap-2"><button onclick="approveLoan(${l.id}, ${l.user_id}, ${l.amount})" class="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition">אשר בקשה</button><button onclick="rejectLoan(${l.id})" class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">דחה</button></div></div>`; });
            } else { adminPanel.classList.add('hidden'); }
        }
    } catch(e) {}
}

window.approveLoan = async function(loanId, userId, amount) {
    if(!confirm(`האם לאשר העברה ע"ס ₪${amount}?`)) return;
    try { await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, userId, amount, adminId: currentUser.id }) }); showToast('success', 'בקשה אושרה'); fetchLoans(); fetchData(); fetchMembers(); } catch(e) { showToast('error', 'שגיאה באיתור בקשה'); }
};

window.rejectLoan = async function(loanId) {
    if(!confirm('האם לדחות את הבקשה?')) return;
    try { await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId }) }); showToast('info', 'בקשה נדחתה'); fetchLoans(); } catch(e) { showToast('error', 'שגיאה בדחיית בקשה'); }
};

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id;
    try {
        const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); 
        let data = await res.json(); if (!Array.isArray(data)) data = []; 
        const list = getEl('budget-list'); list.innerHTML = '';
        const baseCategories = CATEGORIES.expense.map(c => c.value);
        data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
        baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); }); const childrenCategories = ['allowance', 'tasks', 'academy']; childrenCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });
        let childrenTotalSpent = 0; let childrenTotalLimit = 0; let childrenItems = []; let otherItems = [];
        data.forEach(b => { if (childrenCategories.includes(b.category) || b.category === 'allocations') { childrenTotalSpent += parseFloat(b.spent) || 0; childrenTotalLimit += parseFloat(b.limit) || 0; childrenItems.push(b); } else { otherItems.push(b); } });

        const createRow = (category, spent, limit, isSub = false) => {
            const pct = limit > 0 ? (spent / limit) * 100 : 0; let color = 'bg-slate-700'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
            const limitDisplay = limit > 0 ? `₪${limit}` : 'ללא יעד'; const catName = BUDGET_LABELS[category] || category;
            const editBtn = (category !== 'allocations') ? `<button onclick="openBudgetModal('${category}', '${catName}', ${limit}); event.stopPropagation();" class="text-[10px] text-blue-600 font-bold ml-2 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition">עדכון תקציב</button>` : '';
            const textSize = isSub ? 'text-sm' : 'text-base'; const containerClass = isSub ? 'pl-2 border-r-2 border-slate-300 pr-2 mb-3' : 'mb-5';
            return `<div class="${containerClass}"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 ${textSize}">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-200 rounded-full ${isSub ? 'h-1.5' : 'h-2.5'} overflow-hidden shadow-inner"><div class="${color} ${isSub ? 'h-1.5' : 'h-2.5'} rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
        };

        if (childrenItems.length > 0) {
            const pct = childrenTotalLimit > 0 ? (childrenTotalSpent / childrenTotalLimit) * 100 : 0; let color = 'bg-slate-600'; if (pct > 80) color = 'bg-slate-500'; if (pct > 100) color = 'bg-red-600';
            const limitDisplay = childrenTotalLimit > 0 ? `₪${childrenTotalLimit}` : 'לא הוגדר'; let subItemsHtml = ''; childrenItems.forEach(cb => { subItemsHtml += createRow(cb.category, cb.spent, cb.limit, true); });
            const childrenSectionTitle = currentUser.role === 'ADMIN' ? 'תקציבי ילדים ודמי כיס' : 'התקציב שלי';
            list.innerHTML += `<div class="mb-8 bg-slate-100 p-4 rounded-[1.5rem] border border-slate-200 shadow-sm transition-all hover:bg-slate-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-users-gear text-slate-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-slate-300 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-slate-200">${subItemsHtml}</div></div>`;
        }
        otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });
    } catch(e) {}
}

function openAddBudgetCategoryModal() { getEl('new-budget-cat-name').value = ''; getEl('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { 
    const catName = val('new-budget-cat-name'); if(!catName) return; 
    const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; 
    const btn = getEl('btn-submit-budget-cat'); if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try { await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); getEl('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); } catch(e) { showToast('error', 'שגיאה בשמירת סעיף'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף לתקציב'; } }
}

function openPasteListModal() { getEl('paste-list-text').value = ''; getEl('paste-list-modal').classList.remove('hidden'); }

async function submitPastedList() {
    const text = val('paste-list-text'); if (!text.trim()) return;
    const btn = getEl('btn-submit-paste'); btn.disabled = true; btn.innerText = 'קולט...';
    const lines = text.split('\n').filter(l => l.trim() !== '');
    try {
        for (let line of lines) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: line.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, unitsPerPackage: 1, userId: currentUser.id, groupId: currentGroup.id}) }); }
        getEl('paste-list-modal').classList.add('hidden'); showToast('success', `נקלטו ${lines.length} שורות!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטה'); } finally { btn.disabled = false; btn.innerText = 'קלוט רשימה'; }
}

function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*רשימת קניות מ-Oneflow Life:*\n\n`; activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openBudgetModal(catId, catName, currentLimit) { getEl('budget-cat-name').innerText = catName; getEl('budget-cat-id').value = catId; getEl('budget-limit').value = currentLimit > 0 ? currentLimit : ''; getEl('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { 
    const cat = val('budget-cat-id'); const limit = parseFloat(val('budget-limit')) || 0; 
    const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; 
    const btn = getEl('btn-submit-budget-update'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try { await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); getEl('budget-modal').classList.add('hidden'); fetchBudget(); } catch(e) { showToast('error', 'שגיאת בעדכון'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'עדכן יעד'; } }
}

// -------------------------------------
// פונקציות לתשקיף חכם (Forecast)
// -------------------------------------

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    getEl('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    getEl('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    getEl('forecast-month-filter').classList.toggle('hidden', mode !== 'monthly'); getEl('forecast-year-filter').classList.toggle('hidden', mode !== 'yearly');
    renderForecast();
};

function populateForecastPeriods() {
    const mSelect = getEl('forecast-month-filter'); const ySelect = getEl('forecast-year-filter');
    if (mSelect && mSelect.options.length === 0) { const now = new Date(); for(let i=0; i<12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); const monthStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); mSelect.innerHTML += `<option value="${monthStr}">${label}</option>`; } }
    if (ySelect && ySelect.options.length === 0) { const curYear = new Date().getFullYear(); for(let i=0; i<5; i++) { ySelect.innerHTML += `<option value="${curYear + i}">שנת ${curYear + i}</option>`; } }
}

async function renderForecast() {
    populateForecastPeriods();
    const list = getEl('forecast-list'); if(!list) return; if(!currentGroup || !currentGroup.id) return;
    const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
    const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
    
    let startDate, endDate;
    if (currentForecastMode === 'monthly') {
        if (!periodVal) { const now = new Date(); startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); } 
        else { const [year, month] = periodVal.split('-'); startDate = new Date(year, parseInt(month) - 1, 1); endDate = new Date(year, parseInt(month), 0, 23, 59, 59); }
    } else {
        const year = periodVal ? parseInt(periodVal) : new Date().getFullYear(); startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59);
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
                    for (let m = 0; m < 12; m++) { let checkStart = new Date(startDate.getFullYear(), m, 1); let checkEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59); let isActive = checkStart >= txStartMonth; if (endD && checkEnd > endD) isActive = false; if (isActive) monthsActive++; }
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
    
    if(itemsToRender.length === 0) { html = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">אין פעולות עתידיות או קבועות צפויות בתקופה זו</p>'; } 
    else {
        itemsToRender.forEach(item => {
            const isIncome = item.type === 'income'; const amt = parseFloat(item.amount); const itemDate = new Date(item.date); const isRecurring = item.is_recurring === true || String(item.is_recurring).toLowerCase() === 'true';
            if(isIncome) { totalIncome += amt; incomeData[item.category] = (incomeData[item.category] || 0) + amt; } else { totalExpense += amt; expenseData[item.category] = (expenseData[item.category] || 0) + amt; }
            if (isRecurring || itemDate > now) { if (isIncome) projectedNetChange += amt; else projectedNetChange -= amt; }
            const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
            const recBadge = isRecurring ? '<span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded-full font-bold ml-2 shadow-sm whitespace-nowrap">קבועה <i class="fa-solid fa-rotate text-[8px]"></i></span>' : '';
            const userName = currentUser.role === 'ADMIN' && item.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${safeStr(item.user_name)}</span>` : '';
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between text-right hover:border-slate-200 transition"><div class="flex-1 overflow-hidden"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${safeStr(item.description)}</span> ${userName} ${recBadge}</p><p class="text-[10px] text-slate-400 mt-1">${item.date_str}</p></div><span class="font-bold text-base ${amountClass} whitespace-nowrap shrink-0" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        });
    }
    list.innerHTML = html;
    const projectedBalance = parseFloat(forecastCache.startingBalance) + projectedNetChange;
    getEl('forecast-net-change').innerText = `₪${projectedNetChange.toFixed(2)}`;
    getEl('forecast-net-change').className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`;
    getEl('forecast-projected-balance').innerText = `₪${projectedBalance.toFixed(2)}`;
    
    drawForecastCharts({ income: totalIncome }, { expense: totalExpense }, totalIncome, totalExpense);
}

function drawForecastCharts(incomeData, expenseData, totalIncome, totalExpense) {
    const container = getEl('forecast-charts'); if(!container) return;
    container.className = "mt-6 border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-center gap-6";
    
    let sumsHtml = `
        <div class="flex flex-col gap-3 w-full md:w-auto text-center md:text-right">
            <div class="bg-green-50 border border-green-100 p-3 rounded-xl">
                <span class="text-[10px] text-green-600 font-bold block mb-1">סה"כ הכנסות צפויות:</span>
                <span class="text-lg font-black text-green-700">₪${totalIncome.toFixed(2)}</span>
            </div>
            <div class="bg-red-50 border border-red-100 p-3 rounded-xl">
                <span class="text-[10px] text-red-600 font-bold block mb-1">סה"כ הוצאות צפויות:</span>
                <span class="text-lg font-black text-red-700">₪${totalExpense.toFixed(2)}</span>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${sumsHtml}
        <div class="w-full max-w-[200px]">
            <h4 class="text-sm font-bold text-center text-slate-600 mb-2">יחס (הכנסות/הוצאות)</h4>
            <div class="relative h-40 w-full flex justify-center"><canvas id="ratioChart"></canvas></div>
        </div>
    `;
    const ctx = getEl('ratioChart'); if(!ctx) return;
    if(forecastRatioChart) forecastRatioChart.destroy();
    if(totalIncome > 0 || totalExpense > 0) {
        forecastRatioChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [totalIncome, totalExpense], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    } else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 w-full">אין פעולות עתידיות להצגת נתונים</p>'; }
}

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showAIModal('רואת העתידות', null); getEl('familai-loading-text').innerText = 'מחשבת את התזרים הצפוי...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showAIModal('רואת העתידות', data.insight); } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = getEl(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { getEl('accessibility-modal').classList.remove('hidden'); }
function closeAccessibilityModal() { getEl('accessibility-modal').classList.add('hidden'); }

async function fetchPendingUsers() { 
    try { 
        if(!currentGroup || !currentGroup.id) return; 
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json(); const list = getEl('pending-list'); const container = getEl('admin-panel'); 
        if (users && users.length > 0) { 
            container.classList.remove('hidden'); list.innerHTML = ''; 
            users.forEach(u => { list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${safeStr(u.nickname)}</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-700 transition">אשר צוות</button></div></div>`; }); 
        } else { if(container) container.classList.add('hidden'); } 
    } catch(e) {} 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'אושר כעובד בארגון!'); fetchPendingUsers(); fetchMembers(); }
function openProfileModal() { getEl('old-password').value = ''; getEl('new-password').value = ''; getEl('profile-modal').classList.remove('hidden'); }
async function submitChangePassword(e) { e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; try { const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); getEl('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'עדכון סיסמת גישה'; } }
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש לצמיתות?`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש הוסר בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }

async function open360Report(groupId) {
    showToast('info', 'מפיק דוח תמונת מצב, אנא המתן...');
    try {
        let url, headers = {};
        if (saToken) { url = `${API}/superadmin/group-360/${groupId}`; headers = { 'Authorization': saToken }; } 
        else { url = `${API}/group/${groupId}/report-360?adminId=${currentUser.id}`; }

        const res = await fetch(url, { headers }); const data = await res.json();
        if (!data.success) return showToast('error', data.error || 'שגיאה בהפקת הדוח');

        const typeStr = data.group.type === 'BUSINESS' ? 'עסק' : 'משפחה';
        getEl('report-360-group-name').innerText = safeStr(data.group.name);
        getEl('report-360-group-type').innerText = `${typeStr} ${data.group.is_premium ? '(PRO)' : ''}`;
        getEl('report-360-group-code').innerText = data.group.group_code;
        getEl('report-360-group-email').innerText = safeStr(data.group.admin_email);
        getEl('report-360-date').innerText = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const usersList = getEl('report-360-users-list');
        let usersHtml = ''; let totalBalances = 0;
        data.users.forEach(u => {
            const roleStr = u.role === 'ADMIN' ? (data.group.type === 'BUSINESS' ? 'הנהלה' : 'הורה/מנהל') : (data.group.type === 'BUSINESS' ? 'עובד צוות' : 'ילד/חבר');
            const bal = parseFloat(u.balance) || 0; totalBalances += bal;
            usersHtml += `<tr><td>${safeStr(u.nickname)}</td><td><span class="report-badge">${roleStr}</span></td><td class="font-bold font-mono">₪${bal.toFixed(2)}</td></tr>`;
        });
        usersHtml += `<tr class="bg-slate-100 font-bold border-t-2 border-slate-300"><td colspan="2">סה"כ יתרות:</td><td class="font-mono text-slate-800">₪${totalBalances.toFixed(2)}</td></tr>`;
        usersList.innerHTML = usersHtml;

        const txList = getEl('report-360-tx-list');
        let txHtml = '';
        if(data.transactions && data.transactions.length > 0) {
            data.transactions.forEach(t => {
                const dateStr = new Date(t.date).toLocaleDateString('he-IL'); const isInc = t.type === 'income';
                const amtStr = `<span dir="ltr" style="color: ${isInc ? '#16a34a' : '#dc2626'}">${isInc ? '+' : '-'}₪${t.amount}</span>`;
                txHtml += `<tr><td class="text-xs">${dateStr}</td><td>${safeStr(t.user_name) || 'מערכת'}</td><td class="text-xs">${safeStr(t.description)}</td><td class="font-bold text-left">${amtStr}</td></tr>`;
            });
        } else { txHtml = '<tr><td colspan="4" class="text-center text-slate-400 py-4">אין תנועות ב-30 הימים האחרונים</td></tr>'; }
        txList.innerHTML = txHtml;

        const tasksList = getEl('report-360-tasks-list');
        let tasksHtml = '';
        if(data.tasksSummary && data.tasksSummary.length > 0) {
            const statusMap = { 'pending': 'פתוחות (ממתין לביצוע)', 'done': 'ממתין לאישור הורה', 'approved': 'בוצעו בהצלחה' };
            data.tasksSummary.forEach(ts => { tasksHtml += `<li><strong>${statusMap[ts.status] || ts.status}:</strong> ${ts.count} משימות</li>`; });
        } else { tasksHtml = '<li>אין משימות מוגדרות במערכת.</li>'; }
        tasksList.innerHTML = tasksHtml;

        getEl('report-360-modal').classList.remove('hidden');
    } catch(e) { showToast('error', 'שגיאת תקשורת בהבאת נתוני הדוח'); }
}

function download360PDF() {
    const element = getEl('report-360-content'); const groupName = getEl('report-360-group-name').innerText;
    const opt = { margin: 10, filename: `Oneflow_Report_${groupName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save().then(() => { showToast('success', 'הדוח הורד בהצלחה למכשירך!'); }).catch(err => { showToast('error', 'שגיאה ביצירת קובץ ה-PDF'); });
}

// === פונקציות המזווה - תמיכה ביחידות ===
function openPantryUseModal(name, unit, qty, upp) { 
    const totalSubUnits = Math.round(parseFloat(qty) * parseInt(upp || 1));
    getEl('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; 
    getEl('use-pantry-name').value = name; 
    
    let dynContainer = getEl('pantry-dyn-container');
    if (!dynContainer) {
        const origInput = getEl('use-pantry-qty');
        if(origInput && origInput.parentElement && origInput.parentElement.parentElement) {
            dynContainer = document.createElement('div');
            dynContainer.id = 'pantry-dyn-container';
            origInput.parentElement.parentElement.insertBefore(dynContainer, origInput.parentElement);
            origInput.parentElement.style.display = 'none';
        }
    }
    
    if (dynContainer) {
        dynContainer.innerHTML = `
            <div class="text-center mb-4 bg-orange-50 text-orange-700 py-2.5 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-1">
                <span class="font-bold text-sm">יתרה: ${parseFloat(qty).toFixed(2)} ${unit}</span>
                <span class="text-xs font-medium opacity-80">(סה"כ ${totalSubUnits} יחידות)</span>
            </div>
            
            <div class="space-y-3">
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">כמה יחידות לקחת?</label>
                    <input type="number" id="use-pantry-units-dyn" placeholder="יחידות בודדות" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-slate-800 text-center shadow-sm focus:border-orange-500 transition">
                </div>
                
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">או: שימוש לפי מארז / משקל שלם</label>
                    <input type="number" step="0.1" id="use-pantry-qty-dyn" placeholder="כמה ${unit} לקחת?" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-500 text-center text-sm focus:border-slate-400 transition">
                </div>
            </div>
        `;
    }
    
    const display = getEl('use-pantry-unit-display');
    if(display) display.innerText = unit || "יח'"; 
    getEl('pantry-use-modal').classList.remove('hidden'); 
}

async function submitPantryUse() {
    const name = val('use-pantry-name'); 
    const dynQty = val('use-pantry-qty-dyn');
    const origQty = val('use-pantry-qty');
    const qty = dynQty !== '' && dynQty !== undefined ? dynQty : origQty;
    
    const dynUnits = val('use-pantry-units-dyn');
    const origUnits = val('use-pantry-units');
    const units = dynUnits !== '' && dynUnits !== undefined ? dynUnits : origUnits;

    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: parseFloat(qty) || 0, usedUnits: parseFloat(units) || 0 }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); getEl('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}
// ==========================================
// --- פונקציות שחזור קוד סביבה למייל ---
// ==========================================

function openForgotCodeModal() {
    getEl('forgot-code-email').value = '';
    getEl('forgot-code-modal').classList.remove('hidden');
}

async function submitForgotCode() {
    const email = val('forgot-code-email');
    if (!email) return showToast('error', 'נא להזין כתובת אימייל תקינה');
    
    const btn = getEl('btn-submit-forgot');
    btn.disabled = true;
    btn.innerText = 'שולח...';
    
    try {
        const res = await fetch(`${API}/forgot-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // לא מחזירים שגיאה אם המייל לא קיים כדי למנוע דליית מידע
            showToast('success', 'בקשתך התקבלה! אם המייל קיים במערכת, הקוד נשלח אליו עכשיו.');
            getEl('forgot-code-modal').classList.add('hidden');
        } else {
            showToast('error', data.error || 'אירעה שגיאה בשליחת המייל');
        }
    } catch (e) {
        showToast('error', 'שגיאת תקשורת מול השרת');
    } finally {
        btn.disabled = false;
        btn.innerText = 'שלח קוד';
    }
}
// === סוף הקובץ ===
