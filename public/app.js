// Oneflow Life - Family Logic Application

const introStyle = document.createElement('style');
introStyle.innerHTML = `.introjs-showElement{z-index:9999998!important;transform:none!important;}.introjs-fixParent{z-index:auto!important;opacity:1.0!important;transform:none!important;filter:none!important;}body.introjs-active .slider-container,body.introjs-active .slider-scroll,body.introjs-active .overflow-hidden{overflow:visible!important;}body.introjs-active header.sticky{z-index:1!important;}.introjs-overlay{z-index:9999996!important;}.introjs-helperLayer{z-index:9999997!important;}.introjs-tooltipReferenceLayer{z-index:9999998!important;}.introjs-tooltip{z-index:9999999!important;}@media (max-width:768px){.introjs-tooltipReferenceLayer{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;margin:0!important;right:auto!important;bottom:auto!important;width:90vw!important;}.introjs-tooltip{position:relative!important;max-width:350px!important;margin:0 auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;}.introjs-arrow{display:none!important;}}.introjs-tooltip{font-family:'Rubik',sans-serif!important;border-radius:2rem!important;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important;padding:1.5rem!important;border:none!important;overflow:hidden!important;text-align:center!important;}.introjs-tooltip::before{content:'';position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(to right,#3b82f6,#a855f7);}.introjs-tooltipbuttons{border-top:none!important;padding-top:1rem!important;display:flex;gap:0.5rem;justify-content:center;}.introjs-button{border-radius:0.75rem!important;text-shadow:none!important;font-weight:bold!important;font-family:'Rubik',sans-serif!important;padding:0.75rem 1.5rem!important;flex:1;text-align:center;}.introjs-nextbutton{background-color:#3b82f6!important;color:white!important;border:none!important;box-shadow:0 10px 15px -3px rgba(59,130,246,0.3)!important;}.introjs-prevbutton{color:#64748b!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;}.introjs-skipbutton{color:#94a3b8!important;font-weight:500!important;background:transparent!important;}.introjs-bullets ul li a.active{background:#3b82f6!important;}`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

const getEl = id => document.getElementById(id);
const val = id => getEl(id) ? getEl(id).value : '';
const safeStr = str => (str || '').toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");

let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {}; let categoryMapCache = {};
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

const hidePreloaderAndShowAuth = (view = 'login') => {
    getEl('auth-container').classList.remove('hidden'); 
    const mw = getEl('main-wrapper'); if(mw) mw.classList.remove('hidden');
    switchView(view);
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
    const savedSession = localStorage.getItem('ofl_session'); 

    // תמיכה בהשתלטות: אם יש סשן לקוח פעיל, נטען אותו קודם גם אם אנחנו סופר-אדמין
    if(savedSession) { 
        try { 
            const session = JSON.parse(savedSession); 
            if(session && session.user && session.group) { 
                if (session.group.type === 'BUSINESS') { window.location.href = '/business.html'; return; }
                currentUser = session.user; currentGroup = session.group; 
                if (savedSAToken) saToken = savedSAToken; 
                clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }

    // כניסה לסופר-אדמין (אם אין סשן לקוח פעיל)
    if (savedSAToken) {
        saToken = savedSAToken; clearTimeout(failsafeTimer); 
        getEl('auth-container').classList.add('hidden'); 
        const mw = getEl('main-wrapper'); if(mw) mw.classList.add('hidden');
        getEl('sa-dashboard-container').classList.remove('hidden');
        const preloader = getEl('app-preloader'); if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
        loadSAData(); return;
    }

    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

window.exitImpersonation = function() {
    localStorage.removeItem('ofl_session');
    window.location.reload();
};

window.impersonateGroup = async function(groupId) {
    try {
        const res = await fetch(`${API}/sa/impersonate`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json', 'Authorization': saToken},
            body: JSON.stringify({ groupId: groupId })
        });
        const data = await res.json();
        if(data.success) {
            localStorage.setItem('ofl_session', JSON.stringify({user: data.user, group: data.group}));
            window.location.reload(); 
        } else {
            showToast('error', data.error || 'שגיאה בהשתלטות');
        }
    } catch(e) { showToast('error', 'שגיאת רשת בהשתלטות'); }
};

window.exitImpersonation = function() {
    localStorage.removeItem('ofl_session');
    window.location.reload();
};

function showToast(t,m) { const el=getEl('toast'); const icon = getEl('toast-icon'); el.classList.remove('hidden'); getEl('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = getEl(`btn-${a}-text`); const ldr = getEl(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }

async function handleSALogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) }); const data = await res.json();
        if(data.success) { saToken = data.token; localStorage.setItem('ofl_sa_token', saToken); getEl('auth-container').classList.add('hidden'); const mw = getEl('main-wrapper'); if(mw) mw.classList.add('hidden'); getEl('sa-dashboard-container').classList.remove('hidden'); loadSAData(); } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); }
}

function logoutSA() { saToken = null; localStorage.removeItem('ofl_sa_token'); getEl('sa-dashboard-container').classList.add('hidden'); getEl('auth-container').classList.remove('hidden'); const mw = getEl('main-wrapper'); if(mw) mw.classList.remove('hidden'); switchView('login'); }

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
    const placeholder = getEl('app-banner-placeholder');
    
    const renderBanner = (el, text, link, img, isTop = false) => {
        if(!el) return;
        
        const formatImgSrc = (imgStr) => {
            if(!imgStr) return '';
            if(imgStr.startsWith('data:image') || imgStr.startsWith('http')) return imgStr;
            return '/' + imgStr;
        };

        if(text || img) { 
            let html = ''; 
            if(img) { 
                const imgSrc = formatImgSrc(img); 
                // Changed from object-cover to object-contain, adjusted sizes
                html += `<img src="${imgSrc}" alt="Ad" class="absolute inset-0 w-full h-full object-contain opacity-100 z-0 block">`; 
            }
            if(text) {
                const bgStyle = img ? 'bg-slate-900/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-white' : 'p-3 block w-full text-center text-slate-800';
                html += `<div class="relative z-10 ${bgStyle}">${text}</div>`; 
            }
            el.innerHTML = html; 
            el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex');
            if(isTop && placeholder) placeholder.classList.add('hidden');
        } else { 
            el.classList.add('hidden'); el.classList.remove('flex'); 
            if(isTop && placeholder) placeholder.classList.remove('hidden');
        }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img, true); 
    renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
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
        
        // כאן קוראים לטעינת הקהילות מיד כשהמנהל נכנס!
        loadSACommunityData();
        
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

function renderSAGroups() {
    const groupsList = getEl('sa-groups-list'); let gHtml = ''; const term = val('sa-search-group').toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }
    
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `
            <div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm">
                <span>${safeStr(u.nickname)} <span class="text-[10px] text-slate-400">(${u.role === 'ADMIN' ? 'הורה/מנהל' : 'בן משפחה/עובד'})</span></span>
                <div class="flex gap-1">
                    <button onclick="openSAEditUserModal(${u.id}, '${safeStr(u.nickname)}')" class="text-blue-400 hover:text-blue-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
        
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים רשומים.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        const typeBadge = g.type === 'BUSINESS' ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200"><i class="fa-solid fa-briefcase mr-1"></i> עסק</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-emerald-200"><i class="fa-solid fa-house mr-1"></i> משפחה</span>';
        const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'לא ידוע';
        
        gHtml += `
        <div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm">
            <div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid ${g.type === 'BUSINESS' ? 'fa-building' : 'fa-users'}"></i></div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm flex items-center">${safeStr(g.name)} ${isPro} ${typeBadge}</h3>
                        <p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | <span class="font-sans text-[10px]">הוקם: ${createdDate}</span></p>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-down text-slate-300"></i>
            </div>
            <div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                <div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap">
                    <h4 class="text-xs font-bold text-slate-600">משתמשים:</h4>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="impersonateGroup(${g.id})" class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-emerald-200 transition"><i class="fa-solid fa-right-to-bracket"></i> התחבר למשפחה</button>
                        <button onclick="openSAEditGroupModal(${g.id}, '${safeStr(g.name)}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-pen"></i> ערוך שם</button>
                        <button onclick="open360Report(${g.id})" class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-200 transition"><i class="fa-solid fa-eye"></i> דוח 360</button>
                        ${proToggleBtn}
                        <button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחיקה</button>
                    </div>
                </div>
                ${uHtml}
            </div>
        </div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

// פונקציות העריכה
function openSAEditGroupModal(id, name) {
    getEl('sa-edit-group-id').value = id;
    getEl('sa-edit-group-name').value = name;
    getEl('sa-edit-group-modal').classList.remove('hidden');
}

async function saveSAEditGroup() {
    const id = val('sa-edit-group-id');
    const name = val('sa-edit-group-name');
    if (!name) return showToast('error', 'שם לא יכול להיות ריק');
    try {
        const res = await fetch(`${API}/sa/groups/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) });
        if ((await res.json()).success) {
            showToast('success', 'שם עודכן בהצלחה');
            getEl('sa-edit-group-modal').classList.add('hidden');
            loadSAData();
        } else showToast('error', 'שגיאה בעדכון השם');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openSAEditUserModal(id, nickname) {
    getEl('sa-edit-user-id').value = id;
    getEl('sa-edit-user-name').value = nickname;
    getEl('sa-edit-user-pass').value = '';
    getEl('sa-edit-user-modal').classList.remove('hidden');
}

async function saveSAEditUser() {
    const id = val('sa-edit-user-id');
    const nickname = val('sa-edit-user-name');
    const password = val('sa-edit-user-pass');
    if (!nickname) return showToast('error', 'כינוי לא יכול להיות ריק');
    try {
        const res = await fetch(`${API}/sa/users/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nickname, password }) });
        if ((await res.json()).success) {
            showToast('success', 'המשתמש עודכן בהצלחה!');
            getEl('sa-edit-user-modal').classList.add('hidden');
            loadSAData();
        } else showToast('error', 'שגיאה בעדכון משתמש');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
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
    ['login','create','join', 'sa-login'].forEach(v => { const el = getEl(`view-${v}`); if(el) el.classList.add('hidden'); }); 
    const tg = getEl(`view-${view}`); if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e, docKey) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const modal = getEl('tos-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    const contentEl = getEl('tos-modal-content');
    if(!contentEl) return;
    const key = docKey || 'legal_tos_family';
    contentEl.innerHTML = '<p class="text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</p>';
    fetch(`${API}/public/legal/${key}`)
        .then(r => r.json())
        .then(data => {
            if(data.success && data.content) {
                contentEl.innerHTML = data.content;
            } else {
                contentEl.innerHTML = '<p class="text-slate-400 text-center py-4">לא נמצא תוכן למסמך זה.</p>';
            }
        })
        .catch(() => { contentEl.innerHTML = '<p class="text-red-400 text-center py-4">שגיאה בטעינת המסמך.</p>'; });
}
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
    e.preventDefault(); 
    if(!getEl('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) { window.location.href = '/business.html'; return; } 
            else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) { window.location.href = '/'; return; }
            try {
                await loadDashboard(); 
            } catch (dashErr) {
                console.error("Dashboard Load Error:", dashErr);
            }
        } else {
            showToast('error', data.error); 
        }
    } catch(e) { 
        console.error("Create Fetch Error:", e);
        showToast('error', 'שגיאה בטעינה המקומית: ' + e.message); 
    } finally { toggleLoader('login', false); } 
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
    ['feed','tasks','shop','myorders','bank','cashflow','community','academy','members','budget','pantry','recipes','forecast','home-maintenance'].forEach(x => { 
        const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const targetContent = getEl(`content-${t}`); if(targetContent) { targetContent.classList.remove('hidden','tab-anim'); void targetContent.offsetWidth; targetContent.classList.add('tab-anim'); }
    const targetBtn = getEl(`tab-${t}`); if(targetBtn) targetBtn.classList.add('tab-active');
    window._currentFamilyTab = t;

    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); const fab = getEl('fab-container'); if(fab) fab.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') try { renderPantry(); } catch(e) {}
    if (t === 'recipes') try { renderRecipePantrySelection(); } catch(e) {}
    if (t === 'forecast') try { renderForecast(); } catch(e) {}
    if (t === 'cashflow') try { renderCashflow(); } catch(e) {}
    if (t === 'community') try { fetchCommunityData(); } catch(e) {}
    if (t === 'myorders') try { fetchMyOrders(); loadFamilyServiceCalls(); } catch(e) {}
    if (t === 'home-maintenance') try { loadHomeMaintenance(); } catch(e) {}
}

let myOrdersCache = [];

async function fetchMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">טוען הזמנות מהעסקים... <i class="fa-solid fa-spinner fa-spin ml-1"></i></p>';
    
    const timeoutId = setTimeout(() => {
        if (list.querySelector('.fa-spinner')) {
            list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">לא הצלחנו לטעון נסה לרענן את הדף</p>';
        }
    }, 10000);
    
    try {
        const res = await fetch(`${API}/store/orders/my/${currentUser.id}`);
        const data = await res.json();
        clearTimeout(timeoutId);
        
        if (data.success) {
            myOrdersCache = data.orders || [];
            renderMyOrders();
        } else {
            list.innerHTML = `<p class="text-xs text-red-500 text-center py-10">${data.error || 'שגיאה בטעינת ההזמנות'}</p>`;
        }
    } catch (e) {
        clearTimeout(timeoutId);
        list.innerHTML = '<p class="text-xs text-red-500 text-center py-10">שגיאת תקשורת מול השרת</p>';
    }
}

window._myOrdersPage = window._myOrdersPage || 0;
window._myOrdersFilter = window._myOrdersFilter || 'orders';
window._myOrdersSearch = window._myOrdersSearch || '';
window._ordersFilter = window._ordersFilter || { search: '', period: 'all', sort: 'desc' };
window._scTypeFilter = window._scTypeFilter || 'all';

function _renderOrderItems(items) {
    let arr = items;
    if (!arr) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch(e) { return `<span class="text-slate-500 text-[11px]">${safeStr(arr)}</span>`; } }
    if (!Array.isArray(arr)) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    const visible = arr.filter(i => !i.is_quote_metadata && (i.name || i.item_name));
    if (!visible.length) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    return visible.map(i => {
        const name = i.name || i.item_name || '';
        const qty = parseFloat(i.quantity || i.qty || 1);
        const price = parseFloat(i.price || i.price_per_unit || 0);
        const lineTotal = qty * price;
        return `<div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0 gap-2">
            <span class="text-slate-700 text-[11px] flex-1 min-w-0">${safeStr(name)}</span>
            <span class="text-slate-400 text-[10px] shrink-0 dir-ltr">×${qty}${lineTotal > 0 ? ' · ₪' + lineTotal.toFixed(0) : ''}</span>
        </div>`;
    }).join('');
}

function applyOrdersFilter(orders) {
    const f = window._ordersFilter;
    let result = [...orders];
    if (f.search) {
        const q = f.search.toLowerCase();
        result = result.filter(o => (o.store_name||'').toLowerCase().includes(q) || (o.customer_name||'').toLowerCase().includes(q) || (o.notes||'').toLowerCase().includes(q));
    }
    if (f.period !== 'all') {
        const now = Date.now();
        const ms = { week: 7*864e5, month: 30*864e5, quarter: 90*864e5 }[f.period] || 0;
        if (ms) result = result.filter(o => now - new Date(o.created_at).getTime() <= ms);
    }
    if (f.sort === 'asc') result.sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    else result.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    return result;
}
function switchMyOrdersTab(tab) {
    ['orders','faults','quotes'].forEach(t => {
        const btn = getEl(`myorders-tab-${t}`);
        const sec = getEl(`myorders-section-${t}`);
        if (btn) btn.className = `flex-1 py-2 text-xs rounded-xl transition ${t === tab ? 'font-black bg-white text-slate-700 shadow-sm' : 'font-bold text-slate-500'}`;
        if (sec) sec.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'faults') renderBusinessServiceCallsTab();
    if (tab === 'quotes') loadFamilyQuotes();
}

async function renderMyFaultsAsServiceCalls() {
    const list = getEl('my-service-calls-list'); if (!list) return;
    // טען נתוני תקלות אם לא נטענו עדיין
    if (!hmFaults || !hmFaults.length) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
        try {
            const r = await fetch(`/api/equipment/faults/${currentGroup.id}`);
            const d = await r.json();
            if (d.success) hmFaults = d.faults || [];
        } catch(e) {}
    }
    const statusColors = { open: 'border-red-200 bg-red-50', in_progress: 'border-orange-200 bg-orange-50', resolved: 'border-green-200 bg-green-50' };
    const statusLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
    const sevColors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
    const sevLabels = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };
    const activeFaults = (hmFaults || []).filter(f => f.status !== 'resolved');
    if (!activeFaults.length) {
        list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-circle-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm">אין קריאות שירות פתוחות</p><p class="text-xs mt-1 px-4">לפתיחת קריאה חדשה — נהול הבית ← בעיות ← הוסף בעיה</p></div>`;
        return;
    }
    list.innerHTML = activeFaults.map(f => {
        const sc = statusColors[f.status] || 'border-slate-200 bg-white';
        const sl = statusLabels[f.status] || f.status;
        const sev = sevColors[f.severity] || 'bg-slate-100 text-slate-600';
        const sevL = sevLabels[f.severity] || f.severity;
        const dateStr = new Date(f.created_at).toLocaleDateString('he-IL');
        const phone = f.fault_tech_phone;
        return `<div class="bg-white border ${sc} rounded-2xl p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <span class="font-bold text-slate-800 text-sm">${safeStr(f.title)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sev}">${sevL}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.replace('bg-','text-').replace('-50','')}">${sl}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-1">${safeStr(f.equipment_name || '')} · ${dateStr}</p>
                    ${f.fault_tech_name ? `<p class="text-[11px] text-indigo-600"><i class="fa-solid fa-user-gear ml-1"></i>${safeStr(f.fault_tech_name)}${f.fault_tech_company ? ' — ' + safeStr(f.fault_tech_company) : ''}</p>` : ''}
                    ${f.scheduled_date ? `<p class="text-[10px] text-indigo-500 font-bold mt-0.5"><i class="fa-solid fa-calendar-check ml-1"></i>${new Date(f.scheduled_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}</p>` : ''}
                    ${phone ? `<div class="flex gap-1.5 mt-2 flex-wrap">
                        <a href="tel:${phone.replace(/\D/g,'')}" class="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg"><i class="fa-solid fa-phone"></i> חייג</a>
                        <a href="https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent('שלום, בנוגע לקריאה: ' + f.title)}" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>
                    </div>` : ''}
                </div>
                <button onclick="switchTab('home-maintenance'); setTimeout(()=>switchHomeMaintenanceTab('faults'),100)" class="text-[10px] text-indigo-500 font-bold shrink-0 bg-indigo-50 px-2 py-1 rounded-lg">פרטים →</button>
            </div>
        </div>`;
    }).join('');
}


function renderMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;

    // עדכון פאנל סינון
    const filterEl = getEl('orders-filter-panel');
    if (filterEl) {
        const f = window._ordersFilter;
        filterEl.querySelector('#orders-search-input').value = f.search || '';
        ['all','week','month','quarter'].forEach(p => {
            const btn = filterEl.querySelector(`[data-period="${p}"]`);
            if (btn) btn.className = `text-[10px] px-2.5 py-1 rounded-lg font-bold transition ${p === f.period ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`;
        });
        const sortBtn = filterEl.querySelector('#orders-sort-btn');
        if (sortBtn) sortBtn.innerHTML = f.sort === 'asc' ? '<i class="fa-solid fa-arrow-up-short-wide ml-1"></i>ישן→חדש' : '<i class="fa-solid fa-arrow-down-wide-short ml-1"></i>חדש→ישן';
    }

    const filtered = applyOrdersFilter(myOrdersCache);

    if (!filtered.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <i class="fa-solid fa-basket-shopping text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-500">${myOrdersCache.length ? 'אין הזמנות התואמות את הסינון.' : 'אין לכם הזמנות מעסקים מקומיים.'}</p>
            <p class="text-xs text-slate-400 mt-1">${myOrdersCache.length ? 'נסו לשנות את הסינון.' : 'כנסו לקהילה והתחילו להנות ממשלוחים והטבות!'}</p>
        </div>`;
        return;
    }

    let html = '';
    // הצעות מחיר (status='quote') אינן מוצגות כאן — יש להן טאב "הצעות מחיר" ייעודי
    filtered.filter(o => o.status !== 'quote').forEach(o => {
        let statusColor = '', statusText = '', statusIcon = '';
        switch(o.status) {
            case 'new':        statusColor='border-blue-200 bg-blue-50'; statusText='התקבל בעסק'; statusIcon='fa-clock'; break;
            case 'processing': statusColor='border-orange-200 bg-orange-50'; statusText='באריזה / הכנה'; statusIcon='fa-box'; break;
            case 'ready':      statusColor='border-purple-200 bg-purple-50'; statusText='מוכן לאיסוף'; statusIcon='fa-bag-shopping'; break;
            case 'shipped':    statusColor='border-indigo-200 bg-indigo-50'; statusText=o.is_delivery?'בדרך אליך! 🛵':'בדרך אלייך!'; statusIcon=o.is_delivery?'fa-motorcycle':'fa-truck-fast'; break;
            case 'completed':  statusColor='border-green-200 bg-green-50'; statusText='הושלם ונמסר'; statusIcon='fa-check-double'; break;
            default:           statusColor='border-slate-200 bg-slate-50'; statusText='בטיפול'; statusIcon='fa-hourglass-half';
        }
        const dateStr = new Date(o.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const borderCls = statusColor.split(' ')[0];
        // כאשר ההזמנה הומרה מהצעת מחיר — נציג מזהה הצעה מקורית
        const fromQuote = o.quote_status === 'approved' && o.quote_number ? `<span class="text-[9px] text-indigo-500 font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5 inline-block"><i class="fa-solid fa-file-invoice ml-0.5"></i>מ-${o.quote_number}</span>` : '';
        html += `<div class="bg-white rounded-2xl border ${borderCls} border-r-4 mb-2 cursor-pointer active:scale-[0.99] transition overflow-hidden" onclick="document.getElementById('order-details-${o.id}').classList.toggle('hidden')" style="touch-action:manipulation;">
            <div class="p-3 flex justify-between items-center gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5"><i class="fa-solid fa-store text-slate-400 text-[10px] shrink-0"></i><h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(o.store_name || 'עסק מקומי')}</h4></div>
                    <p class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid ${statusIcon} ml-1"></i> ${statusText} · ${dateStr}</p>
                    ${fromQuote}
                </div>
                <div class="flex flex-col items-end shrink-0">
                    <span class="font-black text-slate-800 dir-ltr text-sm">₪${parseFloat(o.total_amount||0).toFixed(0)}</span>
                    <span class="text-[9px] text-slate-400 font-mono">#${o.id}</span>
                </div>
            </div>
            <div id="order-details-${o.id}" class="hidden border-t border-slate-100 bg-slate-50 p-3">
                <div class="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                    ${_renderOrderItems(o.items)}
                    ${(o.notes && !o.quote_status) ? `<p class="mt-2 pt-2 border-t border-slate-200 text-[11px]"><strong>הערות:</strong> ${safeStr(o.notes)}</p>` : ''}
                </div>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function setOrdersSearch(val) {
    window._ordersFilter.search = val;
    renderMyOrders();
}
function setOrdersPeriod(p) {
    window._ordersFilter.period = p;
    renderMyOrders();
}
function toggleOrdersSort() {
    window._ordersFilter.sort = window._ordersFilter.sort === 'desc' ? 'asc' : 'desc';
    renderMyOrders();
}
function setScTypeFilter(t) {
    window._scTypeFilter = t;
    renderBusinessServiceCallsTab();
}

let familyQuotesCache = [];

async function loadFamilyQuotes() {
    const list = getEl('family-quotes-list');
    if (!list) return;
    if (!currentGroup) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">יש להתחבר תחילה לצפייה בהצעות מחיר.</p>';
        return;
    }
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-10"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען הצעות מחיר...</p>';
    try {
        const res = await fetch(`${API}/store/quotes/family/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) { familyQuotesCache = data.quotes || []; renderFamilyQuotesTab(); }
        else list.innerHTML = `<p class="text-xs text-red-500 text-center py-10">${data.error || 'שגיאה'}</p>`;
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-500 text-center py-10">שגיאת תקשורת</p>'; }
}

function renderFamilyQuotesTab() {
    const list = getEl('family-quotes-list');
    if (!list) return;
    if (!familyQuotesCache.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <i class="fa-solid fa-file-invoice-dollar text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-500">אין הצעות מחיר עדיין.</p>
            <p class="text-[11px] text-slate-400 mt-1">כאשר עסק ישלח לך הצעת מחיר דרך OneFlow, היא תופיע כאן.</p></div>`;
        return;
    }
    const statusMap = {
        draft: {label:'טיוטא', color:'bg-slate-100 text-slate-600'},
        waiting_customer: {label:'ממתין לתשובתך', color:'bg-amber-100 text-amber-700'},
        customer_approved: {label:'אישרת', color:'bg-green-100 text-green-700'},
        approved: {label:'אושרה', color:'bg-blue-100 text-blue-700'},
        cancelled: {label:'סורבה', color:'bg-red-100 text-red-700'}
    };
    const responseMap = {
        approved: {label:'אישרת', color:'text-green-600'},
        rejected: {label:'סירבת', color:'text-red-600'},
        discount_request: {label:'ביקשת הנחה', color:'text-blue-600'},
        items_request: {label:'ביקשת שינויים', color:'text-purple-600'},
        message: {label:'שלחת הודעה', color:'text-slate-600'}
    };
    let html = '';
    familyQuotesCache.forEach(q => {
        const qs = q.quote_status || 'draft';
        const st = statusMap[qs] || {label: qs, color: 'bg-slate-100 text-slate-600'};
        const dateStr = new Date(q.created_at).toLocaleDateString('he-IL');
        let metaTitle = ''; let metaNotes = ''; let metaValidity = '';
        try {
            const items = typeof q.items === 'string' ? JSON.parse(q.items||'[]') : (q.items||[]);
            const meta = items.find(i => i.is_quote_metadata);
            if (meta) { const m = JSON.parse(meta.data||'{}'); metaTitle=m.title||''; metaNotes=m.notes||''; metaValidity=m.validity||''; }
        } catch(e) {}
        const title = q.quote_title || metaTitle || `הצעה #${q.id}`;
        const bizName = q.business_name || 'עסק';
        const canRespond = qs === 'waiting_customer';
        const responseInfo = q.customer_response_type ? responseMap[q.customer_response_type] || {label:q.customer_response_type, color:'text-slate-600'} : null;
        html += `<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4 flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${st.color}">${st.label}</span>
                        ${responseInfo ? `<span class="text-[10px] font-semibold ${responseInfo.color}">${responseInfo.label}</span>` : ''}
                    </div>
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(title)}</h4>
                    <p class="text-[11px] text-slate-500 mt-0.5"><i class="fa-solid fa-store ml-1"></i>${safeStr(bizName)} • ${dateStr}</p>
                    ${metaValidity ? `<p class="text-[10px] text-slate-400 mt-0.5"><i class="fa-regular fa-calendar ml-1"></i>תוקף: ${safeStr(metaValidity)}</p>` : ''}
                </div>
                <div class="text-left shrink-0">
                    <span class="font-black text-slate-800 text-sm" dir="ltr">₪${parseFloat(q.total_amount||0).toFixed(2)}</span>
                    <p class="text-[9px] text-slate-400 font-mono mt-0.5">#${q.id}</p>
                </div>
            </div>
            <div class="border-t border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-600">
                <div class="space-y-1 mb-2">${_renderOrderItems(q.items)}</div>
                ${metaNotes ? `<p class="text-[10px] text-slate-500 pt-2 border-t border-slate-100"><i class="fa-solid fa-note-sticky ml-1"></i>${safeStr(metaNotes)}</p>` : ''}
                ${q.customer_response ? `<div class="mt-2 pt-2 border-t border-slate-100 bg-white rounded-xl p-2 text-[11px]"><span class="font-bold">ההודעה שלך: </span>${safeStr(q.customer_response)}</div>` : ''}
            </div>
            <div class="border-t border-slate-100 px-3 pb-3 pt-2">
                <button onclick="window.openFamilyQuoteView(${q.id})" class="w-full ${canRespond ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} text-xs font-bold rounded-xl py-2.5 transition">
                    ${canRespond ? '<i class="fa-solid fa-reply ml-1"></i>פתח הצעה ↙ נדרשת תגובה' : '<i class="fa-solid fa-eye ml-1"></i>צפה בהצעה'}
                </button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

window.openFamilyQuoteView = function(quoteId) {
    const q = familyQuotesCache.find(x => String(x.id) === String(quoteId));
    if (!q) return;
    document.getElementById('fqv-modal')?.remove();
    const items = typeof q.items === 'string' ? JSON.parse(q.items||'[]') : (q.items||[]);
    let title='', notes='', validity='', discount=0, vatRate=18, noVat=false, introText='';
    try {
        const meta = items.find(i => i.is_quote_metadata);
        if (meta) { const m = JSON.parse(meta.data||'{}'); title=m.title||''; notes=m.notes||''; validity=m.validity||''; discount=parseFloat(m.discount||0); vatRate=parseFloat(m.vatRate||18); noVat=!!m.noVat; introText=m.introText||''; }
    } catch(e) {}
    const visibleItems = items.filter(i => !i.is_quote_metadata && !i.is_delivery_metadata && (i.name||i.item_name));
    let subtotal = visibleItems.reduce((s,i) => s + (parseFloat(i.price||0)*parseFloat(i.quantity||i.qty||1)), 0);
    const discountAmt = subtotal * discount / 100;
    const beforeVat = subtotal - discountAmt;
    const vatAmt = noVat ? 0 : beforeVat * vatRate / 100;
    const total = beforeVat + vatAmt;
    const dateStr = new Date(q.created_at).toLocaleDateString('he-IL');
    const canRespond = (q.quote_status === 'waiting_customer');
    const alreadyResponded = !!q.customer_response_type;
    const itemsHtml = visibleItems.map(i => {
        const n = i.name||i.item_name||''; const qty = parseFloat(i.quantity||i.qty||1); const price = parseFloat(i.price||0);
        return `<div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span class="flex-1 text-slate-700 text-sm font-medium">${safeStr(n)}</span>
            <span class="text-slate-500 text-xs mx-3 shrink-0">×${qty}</span>
            <span class="text-slate-500 text-xs mx-2 shrink-0 dir-ltr">₪${price.toFixed(0)}</span>
            <span class="font-bold text-slate-800 text-sm dir-ltr shrink-0">₪${(qty*price).toFixed(2)}</span>
        </div>`;
    }).join('') || '<p class="text-slate-400 text-sm text-center py-3">ללא פריטים</p>';

    // כפתורי תגובה
    const responseMap = { approved:'✅ אישרת', rejected:'❌ סירבת', discount_request:'💬 ביקשת הנחה', items_request:'📋 ביקשת שינויים', message:'💬 שלחת הודעה' };
    const responseLabel = alreadyResponded ? (responseMap[q.customer_response_type]||q.customer_response_type) : '';
    let actionHtml = '';
    if (canRespond && !alreadyResponded) {
        actionHtml = `<div class="border-t border-slate-100 p-4 space-y-2 shrink-0 bg-white">
            <p class="text-[10px] font-bold text-slate-500 mb-2 text-center">מה תרצה לעשות עם ההצעה?</p>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window._fqvRespond(${quoteId},'approved','')" class="bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-600 transition"><i class="fa-solid fa-check"></i> אשר הצעה</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'discount_request')" class="bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-600 transition"><i class="fa-solid fa-percent"></i> בקש הנחה</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'items_request')" class="bg-purple-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-purple-600 transition"><i class="fa-solid fa-list-check"></i> בקש שינויים</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'message')" class="bg-slate-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-600 transition"><i class="fa-solid fa-comment"></i> שלח הודעה</button>
            </div>
            <button onclick="window._fqvRespond(${quoteId},'rejected','')" class="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition"><i class="fa-solid fa-xmark ml-1"></i>סרב להצעה</button>
        </div>`;
    } else if (alreadyResponded) {
        actionHtml = `<div class="border-t border-slate-100 p-3 shrink-0 bg-slate-50">
            <p class="text-xs text-center font-bold text-slate-500">${responseLabel}${q.customer_response ? `: ${safeStr(q.customer_response)}` : ''}</p>
        </div>`;
    }

    const html = `<div id="fqv-modal" class="fixed inset-0 bg-slate-900/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[93vh] overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 bg-indigo-600 text-white shrink-0">
                <div>
                    <h2 class="font-black text-base">${safeStr(title||'הצעת מחיר')}</h2>
                    <p class="text-[11px] text-indigo-200 mt-0.5"><i class="fa-solid fa-store ml-1"></i>${safeStr(q.business_name||'')} · ${dateStr}${validity ? ` · תוקף ${validity} יום` : ''}</p>
                </div>
                <button onclick="document.getElementById('fqv-modal').remove()" class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                ${introText ? `<div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-line border border-slate-200">${safeStr(introText)}</div>` : ''}
                <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div class="bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 border-b border-slate-200 grid grid-cols-12 gap-1">
                        <span class="col-span-6">תיאור</span><span class="col-span-2 text-center">כמות</span><span class="col-span-2 text-center">מחיר</span><span class="col-span-2 text-center">סה"כ</span>
                    </div>
                    <div class="px-3">${itemsHtml}</div>
                    <div class="px-3 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
                        <div class="flex justify-between text-xs text-slate-500"><span>סכום ביניים:</span><span dir="ltr">₪${subtotal.toFixed(2)}</span></div>
                        ${discount > 0 ? `<div class="flex justify-between text-xs text-red-500 font-bold"><span>הנחה (${discount}%):</span><span dir="ltr">-₪${discountAmt.toFixed(2)}</span></div>` : ''}
                        ${discount > 0 ? `<div class="flex justify-between text-xs text-slate-500"><span>לפני מע"מ:</span><span dir="ltr">₪${beforeVat.toFixed(2)}</span></div>` : ''}
                        ${!noVat && vatRate > 0 ? `<div class="flex justify-between text-xs text-slate-500"><span>מע"מ (${vatRate}%):</span><span dir="ltr">₪${vatAmt.toFixed(2)}</span></div>` : ''}
                        <div class="flex justify-between text-sm font-black border-t border-slate-200 pt-2 mt-1"><span>סה"כ לתשלום:</span><span dir="ltr" class="text-indigo-700">₪${total.toFixed(2)}</span></div>
                    </div>
                </div>
                ${notes ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"><strong>הערות ותנאי תשלום:</strong><br><span class="whitespace-pre-line mt-1 block">${safeStr(notes)}</span></div>` : ''}
            </div>
            ${actionHtml}
            <div id="fqv-request-panel" class="hidden border-t border-slate-100 p-4 bg-white shrink-0">
                <p id="fqv-request-label" class="text-xs font-bold text-slate-700 mb-2"></p>
                <textarea id="fqv-request-text" rows="3" placeholder="פרט את הבקשה שלך..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"></textarea>
                <div class="flex gap-2 mt-2">
                    <button onclick="window._fqvSubmitRequest(${quoteId})" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition">שלח</button>
                    <button onclick="document.getElementById('fqv-request-panel').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold">ביטול</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._fqvCurrentType = '';
window._fqvOpenRequest = function(quoteId, type) {
    const labels = { discount_request: 'פרט את הבקשה להנחה (סכום / אחוז / סיבה):', items_request: 'פרט אילו שינויים / תוספות תרצה:', message: 'כתוב הודעה לעסק:' };
    window._fqvCurrentType = type;
    const panel = document.getElementById('fqv-request-panel');
    const label = document.getElementById('fqv-request-label');
    if (panel && label) { label.textContent = labels[type] || 'פרט:'; panel.classList.remove('hidden'); document.getElementById('fqv-request-text')?.focus(); }
};
window._fqvSubmitRequest = function(quoteId) {
    const text = document.getElementById('fqv-request-text')?.value?.trim() || '';
    if (!text) { showToast('error','הוסף פירוט לבקשה'); return; }
    window._fqvRespond(quoteId, window._fqvCurrentType, text);
};
window._fqvRespond = async function(quoteId, responseType, responseText) {
    try {
        const res = await fetch(`${API}/store/quotes/${quoteId}/customer-response`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ responseType, responseText, familyGroupId: currentGroup ? currentGroup.id : null })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('fqv-modal')?.remove();
            showToast('success', responseType === 'approved' ? '✅ ההצעה אושרה!' : '📩 הבקשה נשלחה לעסק');
            await loadFamilyQuotes();
        } else showToast('error', data.error || 'שגיאה בשליחה');
    } catch(e) { showToast('error','שגיאת תקשורת'); }
};

window.openQuoteResponseModal = function(quoteId) {
    getEl('qrm-quote-id').value = quoteId;
    getEl('qrm-message').value = '';
    const radios = document.querySelectorAll('input[name="qrm-type"]');
    radios.forEach(r => r.checked = false);
    getEl('quote-response-modal').classList.remove('hidden');
};

window.closeQuoteResponseModal = function() {
    getEl('quote-response-modal').classList.add('hidden');
};

window.submitQuoteResponse = async function() {
    const quoteId = getEl('qrm-quote-id').value;
    const message = getEl('qrm-message').value.trim();
    const typeEl = document.querySelector('input[name="qrm-type"]:checked');
    if (!typeEl) { showToast('error','בחר סוג תשובה'); return; }
    const responseType = typeEl.value;
    if ((responseType === 'discount_request' || responseType === 'items_request' || responseType === 'message') && !message) {
        showToast('error','הוסף הודעה / פירוט הבקשה');
        return;
    }
    const btn = getEl('qrm-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1"></i> שולח...'; }
    try {
        const res = await fetch(`${API}/store/quotes/${quoteId}/customer-response`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ responseType, responseText: message, familyGroupId: currentGroup ? currentGroup.id : null })
        });
        const data = await res.json();
        if (data.success) {
            closeQuoteResponseModal();
            showToast('success','התשובה נשלחה לעסק');
            await loadFamilyQuotes();
        } else showToast('error', data.error || 'שגיאה בשליחה');
    } catch(e) { showToast('error','שגיאת תקשורת'); }
    finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane ml-1"></i> שלח תשובה'; } }
};




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
        if (currentUser && currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden');
        if (modal) modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { getEl('ai-battery-modal').classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = getEl('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

// ---- מודל אישור AI (ai-warning-modal) ----
let _pendingAIAction = null;

window.showAIWarning = function(callback) {
    if (!currentGroup) { if (callback) callback(); return; }
    const today = new Date().toDateString();
    if (localStorage.getItem('ofl_ai_skip_' + today) === '1') {
        if (callback) try { callback(); } catch(e) { showToast('error', 'שגיאה בפעולת AI'); }
        return;
    }
    const tokens = currentGroup.is_premium ? '∞' : (currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10);
    const leftEl = getEl('ai-warning-left');
    if (leftEl) leftEl.innerText = tokens;
    _pendingAIAction = callback;
    const modal = getEl('ai-warning-modal');
    if (modal) modal.classList.remove('hidden');
};

window.confirmAIWarning = function() {
    const dontShow = getEl('ai-warning-dont-show');
    if (dontShow && dontShow.checked) {
        localStorage.setItem('ofl_ai_skip_' + new Date().toDateString(), '1');
    }
    const modal = getEl('ai-warning-modal');
    if (modal) modal.classList.add('hidden');
    if (_pendingAIAction) {
        const cb = _pendingAIAction;
        _pendingAIAction = null;
        try { cb(); } catch(e) { console.error('AI action error:', e); showToast('error', 'שגיאה בפעולת ה-AI'); }
    }
};

let currentAIAction = null;
function executeWithAIWarning(actionFn) {
    if(currentGroup && currentGroup.is_premium) { actionFn(); return; }
    const tokens = currentGroup ? (currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10) : 0;
    if(tokens <= 0) {
        const modal = getEl('ai-battery-modal'); const upgradeSec = getEl('ai-upgrade-section');
        if (currentUser && currentUser.role === 'ADMIN' && upgradeSec) upgradeSec.classList.remove('hidden'); 
        else if(upgradeSec) upgradeSec.classList.add('hidden');
        if(modal) modal.classList.remove('hidden'); return;
    }
    
    if (localStorage.getItem('ofl_hide_ai_warning') === new Date().toLocaleDateString('he-IL')) { actionFn(); return; }
    
    currentAIAction = actionFn;
    const leftEl = getEl('ai-warning-left'); if(leftEl) leftEl.innerText = tokens;
    const warnModal = getEl('ai-warning-modal'); if(warnModal) warnModal.classList.remove('hidden');
    
    const btnContinue = getEl('btn-ai-warning-continue');
    if (btnContinue) {
        btnContinue.onclick = () => {
            const dontShow = getEl('ai-warning-dont-show');
            if (dontShow && dontShow.checked) localStorage.setItem('ofl_hide_ai_warning', new Date().toLocaleDateString('he-IL'));
            if(warnModal) warnModal.classList.add('hidden');
            if (currentAIAction) { currentAIAction(); currentAIAction = null; }
        };
    }
}
async function loadDashboard() {
    const authContainer = getEl('auth-container'); if (authContainer) authContainer.classList.add('hidden');
    const mw = getEl('main-wrapper'); if (mw) mw.classList.add('hidden');
    getEl('dashboard-container').classList.remove('hidden'); getEl('fab-container').classList.remove('hidden');

    // --- הזרקת באנר השתלטות דינמי ישירות ל-Body (בטוח 100%) ---
    const saTokenLocal = localStorage.getItem('ofl_sa_token');
    let dynamicBanner = document.getElementById('dynamic-sa-banner');
    
    if (saTokenLocal) {
        if (!dynamicBanner) {
            dynamicBanner = document.createElement('div');
            dynamicBanner.id = 'dynamic-sa-banner';
            // שימוש ב-Inline Styles כדי לעקוף את בעיית הרינדור של Tailwind
            dynamicBanner.style.cssText = "position: fixed; top: 0; left: 0; right: 0; z-index: 9999999; display: flex; justify-content: space-between; align-items: center; width: 100%; background-color: #dc2626; color: white; padding: 0.5rem 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);";
            dynamicBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-user-secret" style="font-size: 1.125rem;"></i>
                    <span style="font-size: 0.875rem; font-weight: bold;">מחובר כ-Super Admin (השתלטות)</span>
                </div>
                <button onclick="exitImpersonation()" style="background-color: white; color: #dc2626; padding: 0.375rem 1rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    התנתק וחזור לניהול
                </button>
            `;
            document.body.appendChild(dynamicBanner);
        }
        document.body.style.paddingTop = '55px'; // דוחף את המסך למטה
    } else {
        if (dynamicBanner) dynamicBanner.remove();
        document.body.style.paddingTop = '0px';
    }
    // -----------------------------------------------------------

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
        getEl('card-name').innerText = (currentUser.nickname || '').toUpperCase(); getEl('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; getEl('card-interest').innerText = `${currentUser.interest_rate || 0}%`;
        const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
        ['tab-members','tab-budget'].forEach(id => { const el=getEl(id); if(el) el.classList.add('hidden'); });
    }
    const btnAddBudget = getEl('btn-add-budget-cat'); if(btnAddBudget) btnAddBudget.classList.remove('hidden'); updateBatteryUI();
    
    try {
        if(!pollInterval) { pollInterval = setInterval(() => { try{ fetchData(); } catch(e){} try{ fetchLoans(); } catch(e){} if(isAdmin) { try{ fetchPendingUsers(); } catch(e){} } }, 30000); }
        setInterval(refreshBellBadge, 30000); refreshBellBadge();
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
            // עדכון המזהה למקרה שהקהילה השתנתה
            currentGroup.community_id = data.group.community_id;
        }

        if (currentUser.role === 'ADMIN') {
            const balEl = getEl('user-balance'); 
            if(balEl) {
                const realBalance = data.group.admin_total_balance || 0;
                balEl.innerText = `₪${parseFloat(realBalance).toFixed(2)}`;
                balEl.className = `text-3xl font-bold font-mono tracking-tight mt-1 ${realBalance >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        } else {
            const balEl = getEl('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;
        
        // שמירת עדכוני הקהילה והעסקים למטמון עבור הפיד והקהילות
        window.communityUpdatesCache = Array.isArray(data.community_updates) ? data.community_updates : [];
        window.communityBusinessesCache = Array.isArray(data.community_businesses) ? data.community_businesses : [];

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { loadCategoryMap(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        // קריאה לרינדור הקהילות ממש כאן!
        try { renderFamilyCommunities(window.communityBusinessesCache); } catch(e) {}
        try { fetchCashbackInfo(); } catch(e) {}
        
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
        try { renderQuickTiles(); } catch(e) {}
        try { renderFamilyUrgentItems(); } catch(e) {}
        try { renderChildDashboard(); } catch(e) {}
        try { updateFamilyNavBadges(); } catch(e) {}
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
       } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { 
            getEl('btn-tutor').disabled = false; 
            const logoSrc = window.currentFamilaiLogo ? window.currentFamilaiLogo : 'logo.png';
            getEl('btn-tutor').innerHTML = `<img src="${logoSrc}" alt="AI" class="w-5 h-5 object-contain rounded-full"> familAI, איפה טעיתי?`; 
        }
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
    const aiCheckEl = getEl('task-require-ai-check'); if (aiCheckEl) aiCheckEl.value = 'true';
    const knob = getEl('ai-check-knob');
    if (knob) { knob.classList.remove('translate-x-1'); knob.classList.add('translate-x-6'); }
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

function toggleAiCheck() {
    const current = getEl('task-require-ai-check').value === 'true';
    const newVal = !current;
    getEl('task-require-ai-check').value = newVal ? 'true' : 'false';
    const toggle = getEl('ai-check-toggle');
    const knob = getEl('ai-check-knob');
    const activeColor = toggle.classList.contains('bg-slate-800') ? 'bg-slate-800' : 'bg-purple-500';
    if (newVal) {
        toggle.classList.add(activeColor); toggle.classList.remove('bg-slate-300');
        knob.classList.remove('translate-x-1'); knob.classList.add('translate-x-6');
    } else {
        toggle.classList.remove('bg-purple-500', 'bg-slate-800'); toggle.classList.add('bg-slate-300');
        knob.classList.remove('translate-x-6'); knob.classList.add('translate-x-1');
    }
}

async function submitTask() {
    const isSelf = val('task-is-self') === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    const requireAiCheck = getEl('task-require-ai-check') ? getEl('task-require-ai-check').value === 'true' : true;
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const btn = getEl('btn-submit-task'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const statusToSend = isSelf ? 'done' : 'pending';
    try {
        const res = await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend, groupId: currentGroup.id, requireAiCheck }) });
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

function renderChildDashboard() {
    const isChild = currentUser && currentUser.role !== 'ADMIN';
    const header = getEl('child-home-header');
    const footer = getEl('child-home-footer');
    const balanceCard = getEl('tour-balance-card');
    const quickTiles = getEl('quick-tiles');

    if (!isChild) {
        if (header) header.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
        return;
    }

    // Show child sections, hide admin ones
    if (header) header.classList.remove('hidden');
    if (footer) footer.classList.remove('hidden');
    if (balanceCard) balanceCard.classList.add('hidden');
    if (quickTiles) quickTiles.classList.add('hidden');

    // Copy balance from the main balance element
    const mainBal = getEl('user-balance');
    const childBal = getEl('child-balance-display');
    if (childBal && mainBal) childBal.innerText = mainBal.innerText;

    // Greeting
    const greetEl = getEl('child-greeting-text');
    if (greetEl && currentUser.name) {
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
        greetEl.innerText = `${greet}, ${currentUser.name}! 👋`;
    }
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
    try {
        feedCache = [];
        
        // 1. הודעת מערכת (פתיחת משפחה)
        if (currentGroup && currentGroup.created_at) { 
            feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח בהצלחה! 🎉', amount: 0, status: 'welcome' }); 
        }
        
        // 2. תנועות עובר ושב
        if(Array.isArray(allTransactions)) { 
            allTransactions.forEach(t => { 
                feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); 
            }); 
        }
        
        // 3. משימות (רק מאושרות)
        if(Array.isArray(allTasks)) { 
            allTasks.forEach(t => { 
                if(t.status === 'approved') { 
                    feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה: ${t.title}`, amount: t.reward, status: t.status }); 
                } 
            }); 
        }
        
        // 4. חידונים (אקדמיה)
        if(Array.isArray(bundlesCache)) { 
            bundlesCache.forEach(b => { 
                feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); 
            }); 
        }
        
        // 5. עדכוני קהילה - טיפול בטוח באובייקטים המגיעים מהשרת
        if (window.communityUpdatesCache && Array.isArray(window.communityUpdatesCache)) {
            window.communityUpdatesCache.forEach(update => { 
                feedCache.push({
                    type: 'system',
                    id: update.id || ('comm_' + Math.random()),
                    user_id: 0,
                    user_name: 'קהילה',
                    date: update.date ? new Date(update.date) : new Date(),
                    title: update.description || update.title || 'עדכון מהקהילה',
                    amount: 0
                });
            });
        }

        // מיון לפי תאריך יורד בצורה בטוחה
        feedCache.sort((a, b) => {
            const dA = a.date instanceof Date && !isNaN(a.date) ? a.date.getTime() : 0;
            const dB = b.date instanceof Date && !isNaN(b.date) ? b.date.getTime() : 0;
            return dB - dA;
        });
        
        // טיפול בפילטר הראשי
        const filterEl = getEl('feed-user-filter');
        if (filterEl && currentUser) { 
            if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); 
            else filterEl.classList.add('hidden'); 
        }
        
        renderUnifiedFeed();
    } catch (err) {
        console.error("Error in buildAndRenderFeed:", err);
    }
}

function renderUnifiedFeed() {
    try {
        const list = getEl('unified-feed-list'); 
        if (!list) return;
        
        if (!currentUser) return;

        const userFilter = val('feed-user-filter') || 'all'; 
        const dateFilter = val('feed-date-filter') || 'all'; 
        
        let filtered = feedCache;
        
        // סינון לפי משתמש
        if (currentUser.role !== 'ADMIN') { 
            filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); 
        } else if (userFilter !== 'all' && userFilter !== '') { 
            filtered = feedCache.filter(item => String(item.user_id) === String(userFilter) || item.type === 'system'); 
        }
        
        // סינון לפי תאריך
        if (dateFilter !== 'all') { 
            const monthsBack = parseInt(dateFilter); 
            const cutoffDate = new Date(); 
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); 
            filtered = filtered.filter(item => item.date && item.date >= cutoffDate); 
        }
        
        // מקסימום 30 פעולות למניעת עומס
        filtered = filtered.slice(0, 30); 
        
        // אם אין פעולות
        if(filtered.length === 0) { 
            list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; 
            return; 
        }
        
        let html = '';
        const today = new Date();
        
        filtered.forEach(item => {
            // טיפול בטוח בתאריכים
            if(!item.date || !(item.date instanceof Date) || isNaN(item.date.getTime())) return;
            
            const userIdNum = parseInt(item.user_id) || 0;
            const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[userIdNum % userColors.length] || 'bg-white border-slate-50'); 
            
            const userNameDisplay = item.type !== 'system' && item.user_name ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${safeStr(item.user_name)}</span>` : '';
            
            const d = item.date; 
            const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); 
            const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
            
            let contentHtml = '';
            if (item.type === 'transaction') {
                const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
                const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; 
                const prefix = item.isIncome ? '+' : '-';
                contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${parseFloat(item.amount || 0).toFixed(2)}</span></div>`;
            } else if (item.type === 'task') {
                const icon = '<i class="fa-solid fa-list-check text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; 
                let statusLabel = item.status === 'pending' ? 'הוקצתה' : (item.status === 'done' ? 'ממתין לאישור' : 'הושלמה'); 
                let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600');
                contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
            } else if (item.type === 'quiz') {
                const icon = '<i class="fa-solid fa-graduation-cap text-purple-500 bg-purple-100 p-1.5 rounded-full text-[10px]"></i>'; 
                let statusLabel = item.status === 'assigned' ? 'הוקצה' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'נכשל/פג תוקף'); 
                let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
                contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
            } else if (item.type === 'system') {
                const icon = '<i class="fa-solid fa-house text-orange-500 bg-orange-100 p-1.5 rounded-full text-[10px]"></i>';
                contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div></div>`;
            }
            
            html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border transform transition hover:scale-[1.01] mb-2 flex items-center">${contentHtml}</div>`;
        });
        
        list.innerHTML = html;
    } catch (err) {
        console.error("Error in renderUnifiedFeed:", err);
    }
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

    if (totalPages > 1) {
        html += `<div class="flex items-center justify-between mt-3 px-1">
            <button onclick="window._myOrdersPage=Math.max(0,(window._myOrdersPage||0)-1);renderMyOrders();" class="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white transition" style="touch-action:manipulation;${safePageIdx===0?'opacity:0.4;pointer-events:none;':''}">→ הקודם</button>
            <span class="text-[11px] text-slate-500 font-bold">${safePageIdx+1} / ${totalPages}</span>
            <button onclick="window._myOrdersPage=Math.min(${totalPages-1},(window._myOrdersPage||0)+1);renderMyOrders();" class="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white transition" style="touch-action:manipulation;${safePageIdx===totalPages-1?'opacity:0.4;pointer-events:none;':''}">הבא ←</button>
        </div>`;
    }

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
    const item = itemInput.value.trim(); const qty = parseFloat(val('shop-quantity')) || 1; const est = parseFloat(val('shop-est-price')) || 0; const unit = val('shop-unit') || "יח'"; const upp = parseInt(val('shop-upp')) || 1;
    if(!item) return; if (btn && btn.disabled) return;
    const isKnown = FLAT_PRODUCTS.some(p => p.name === item) || categoryMapCache[item];
    if (!isKnown) {
        window._pendingShopItem = { item, qty, est, unit, upp };
        getEl('cat-picker-name').innerText = item;
        getEl('cat-picker-modal').classList.remove('hidden');
        return;
    }
    await _doSubmitShopItem(item, qty, est, unit, upp);
}

async function _doSubmitShopItem(item, qty, est, unit, upp) {
    const btn = getEl('btn-submit-shop');
    if (btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try {
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, unitsPerPackage: upp, userId: currentUser.id, groupId: currentGroup.id}) });
        const data = await res.json();
        if (data.success) {
            const itemInput = getEl('shop-item');
            getEl('shop-modal').classList.add('hidden'); itemInput.value = ''; getEl('shop-est-price').value = ''; getEl('shop-quantity').value = 1; getEl('shop-unit').value = "יח'"; getEl('shop-upp').value = 1; getEl('suggestions').classList.add('hidden');
            if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg;
            showToast('success', data.status === 'requested' ? 'הבקשה נשלחה להורה לאישור ⏳' : 'נוסף לרשימה'); fetchData();
        } else { showToast('error', data.error || 'שגיאת שרת בהוספת פריט לרכש'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'הוסף'; } }
}

async function confirmCustomCategory() {
    const input = getEl('cat-custom-input');
    const category = (input.value || '').trim();
    if (!category) return showToast('error', 'יש להזין שם קטגוריה');
    input.value = '';
    await confirmCategoryPick(category);
}

async function confirmCategoryPick(category) {
    getEl('cat-picker-modal').classList.add('hidden');
    const p = window._pendingShopItem;
    if (!p) return;
    categoryMapCache[p.item] = category;
    fetch(`${API}/shopping/category-map`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, normalizedName: p.item, category }) });
    if (p._fromSupermarket) {
        await _doSmQuickAdd(p.item);
    } else {
        await _doSubmitShopItem(p.item, p.qty, p.est, p.unit, p.upp);
    }
    window._pendingShopItem = null;
}

async function loadCategoryMap() {
    if (!currentGroup || !currentGroup.id) return;
    try {
        const res = await fetch(`${API}/shopping/category-map?groupId=${currentGroup.id}`);
        const data = await res.json();
        if (Array.isArray(data)) { data.forEach(r => { categoryMapCache[r.normalized_name] = r.category; }); }
    } catch(e) {}
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
        list.innerHTML = `<div class="text-center py-12 text-slate-400">
  <i class="fa-solid fa-cart-shopping text-4xl mb-3"></i>
  <p class="font-bold text-sm">העגלה ריקה</p>
  <p class="text-xs mt-1">הוסף מוצרים מהקטלוג</p>
</div>`; 
        const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = getEl('cart-footer'); if(f) f.classList.remove('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return categoryMapCache[name] || 'שונות'; };
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

        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-blue-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${safeStr(i.item_name)}</span><div class="flex gap-1"><button onclick="openEditShopItem(${i.id})" class="text-slate-300 hover:text-blue-500 text-xs px-1.5"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-1.5"><i class="fa-solid fa-trash"></i></button></div></div><span class="text-[10px] text-slate-400">ביקש/ה: ${safeStr(i.requester_name)}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${safeStr(i.unit || "יח'")}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-blue-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${safeStr(i.unit || "יח'")}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר בספק</button></div></div>`;
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
    if(data.success) {
        getEl('confirm-checkout-modal').classList.add('hidden');
        showToast('success', 'הקניה בוצעה ואושרה למזווה!');
        if (missingItems.length > 0) {
            window._pendingMissingItems = missingItems.map(mi => { const item = shoppingListCache.find(i => i.id == mi.id); return item ? { item_name: item.item_name, quantity: item.quantity, unit: item.unit, estimated_price: item.estimated_price, units_per_package: item.units_per_package } : null; }).filter(Boolean);
            getEl('missing-count-text').innerText = missingItems.length;
            getEl('missing-draft-modal').classList.remove('hidden');
        }
        fetchData();
    } else showToast('error', data.error);
}

async function copyList(tripId) { if(!confirm('האם לייבא את דרישת הרכש מחדש?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); getEl('history-modal').classList.add('hidden'); showToast('success', 'הדרישה הועתקה!'); fetchData(); }

function openInviteModal() { const codeSpan = getEl('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } getEl('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו בנק משפחתי ב-Oneflow Life 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו להתנהל עם Oneflow Life 🚀\n\nקוד המשפחה לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); getEl('invite-modal').classList.add('hidden'); 
}

function toggleFab() { getEl('fab-container').classList.toggle('fab-open'); }

// ============================================================
// --- SUPERMARKET MODE (Feature 2) ---
// ============================================================

function openSupermarketMode() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) { showToast('error', 'אין פריטים ברשימה להתחיל קניה'); return; }
    renderSupermarketList();
    getEl('supermarket-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSupermarketMode() {
    getEl('supermarket-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function renderSupermarketList() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return categoryMapCache[name] || 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let html = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name);
        if(cat !== currentCat) {
            html += `<div class="text-emerald-400 text-xs font-black uppercase tracking-wider px-2 pt-3 pb-1">${cat}</div>`;
            currentCat = cat;
        }
        const isChecked = i.status === 'in_cart';
        const isMissing = i._smMissing;
        html += `<div id="sm-row-${i.id}" class="flex items-center gap-3 p-4 rounded-2xl transition ${isChecked ? 'bg-emerald-800/60' : isMissing ? 'bg-red-900/40 opacity-60' : 'bg-emerald-900/60'} border ${isChecked ? 'border-emerald-500' : isMissing ? 'border-red-700' : 'border-emerald-800'}">
            <button onclick="smToggleItem(${i.id})" class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition ${isChecked ? 'bg-emerald-400 border-emerald-400 text-emerald-900' : 'border-emerald-600 text-transparent'}">${isChecked ? '<i class="fa-solid fa-check font-bold"></i>' : ''}</button>
            <div class="flex-1 min-w-0">
                <p class="text-white font-bold text-base truncate">${safeStr(i.item_name)}</p>
                <p class="text-emerald-400 text-xs">${i.quantity} ${safeStr(i.unit || "יח'")}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
                <input type="number" id="sm-price-${i.id}" value="${i.estimated_price > 0 ? i.estimated_price : ''}" placeholder="₪מחיר" oninput="smUpdatePrice(${i.id}, this.value)" class="w-20 bg-emerald-950 border border-emerald-700 text-white text-sm text-center rounded-xl px-2 py-1.5 outline-none focus:border-emerald-400 placeholder-emerald-700">
                <button onclick="smToggleMissing(${i.id})" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${isMissing ? 'bg-red-700 text-white' : 'text-red-400 hover:bg-red-900/40'}">${isMissing ? 'מבוטל ✕' : 'חסר'}</button>
            </div>
        </div>`;
    });
    getEl('sm-list').innerHTML = html;
    smCalcTotal();
}

let _smPriceModalItemId = null;

function smToggleItem(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    const isChecked = item.status === 'in_cart';
    const newStatus = isChecked ? 'pending' : 'in_cart';
    item.status = newStatus;
    item._smMissing = false;
    fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, status: newStatus})});
    renderSupermarketList();
    if (newStatus === 'in_cart') {
        _smPriceModalItemId = id;
        getEl('sm-price-modal-name').innerText = item.item_name;
        getEl('sm-price-modal-qty').innerText = `${item.quantity} ${item.unit || "יח'"}`;
        const inp = getEl('sm-price-modal-input');
        inp.value = item.estimated_price > 0 ? item.estimated_price : '';
        getEl('sm-price-modal').classList.remove('hidden');
        setTimeout(() => inp.focus(), 100);
    }
}

function smConfirmPrice() {
    const price = parseFloat(getEl('sm-price-modal-input').value) || 0;
    if (_smPriceModalItemId !== null) {
        smUpdatePrice(_smPriceModalItemId, price);
        const inp = getEl(`sm-price-${_smPriceModalItemId}`);
        if (inp) inp.value = price > 0 ? price : '';
    }
    getEl('sm-price-modal').classList.add('hidden');
    _smPriceModalItemId = null;
}

function smSkipPrice() {
    getEl('sm-price-modal').classList.add('hidden');
    _smPriceModalItemId = null;
}

function _getAllCategories() {
    const cats = new Set(Object.keys(PRODUCT_DB));
    Object.values(categoryMapCache).forEach(c => cats.add(c));
    return [...cats];
}

function openEditShopItem(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    getEl('edit-item-id').value = id;
    getEl('edit-item-name').value = item.item_name;
    getEl('edit-item-quantity').value = item.quantity;
    const unitSel = getEl('edit-item-unit');
    const unitVal = item.unit || "יח'";
    let found = false;
    for (let opt of unitSel.options) { if (opt.value === unitVal) { opt.selected = true; found = true; break; } }
    if (!found) { const opt = new Option(unitVal, unitVal, true, true); unitSel.add(opt); }
    getEl('edit-item-price').value = item.estimated_price > 0 ? item.estimated_price : '';
    const catSel = getEl('edit-item-category');
    catSel.innerHTML = '';
    const currentCat = (() => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(item.item_name)) return cat; } return categoryMapCache[item.item_name] || 'שונות'; })();
    _getAllCategories().concat(['שונות']).filter((v,i,a)=>a.indexOf(v)===i).forEach(cat => {
        const opt = new Option(cat, cat, false, cat === currentCat);
        catSel.add(opt);
    });
    getEl('edit-shop-item-modal').classList.remove('hidden');
}

async function saveEditShopItem() {
    const id = getEl('edit-item-id').value;
    const name = getEl('edit-item-name').value.trim();
    const qty = parseFloat(getEl('edit-item-quantity').value) || 1;
    const unit = getEl('edit-item-unit').value;
    const price = parseFloat(getEl('edit-item-price').value) || 0;
    const category = getEl('edit-item-category').value;
    if (!name) return showToast('error', 'שם הפריט חסר');
    try {
        const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: id, itemName: name, quantity: qty, unit, estimatedPrice: price})});
        const data = await res.json();
        if (data.success) {
            if (category) {
                categoryMapCache[name] = category;
                fetch(`${API}/shopping/category-map`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({groupId: currentGroup.id, normalizedName: name, category})});
            }
            getEl('edit-shop-item-modal').classList.add('hidden');
            showToast('success', 'הפריט עודכן');
            fetchData();
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function smQuickAdd() {
    const input = getEl('sm-quick-input');
    const name = (input.value || '').trim();
    if (!name) return;
    const isKnown = FLAT_PRODUCTS.some(p => p.name === name) || categoryMapCache[name];
    if (!isKnown) {
        input.value = '';
        window._pendingShopItem = { item: name, qty: 1, est: 0, unit: "יח'", upp: 1, _fromSupermarket: true };
        getEl('cat-picker-name').innerText = name;
        getEl('cat-custom-input').value = '';
        getEl('cat-picker-modal').classList.remove('hidden');
        return;
    }
    input.value = '';
    await _doSmQuickAdd(name);
}

async function _doSmQuickAdd(name) {
    try {
        const res = await fetch(`${API}/shopping/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: name, quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, groupId: currentGroup.id})});
        const data = await res.json();
        if (data.success) { await fetchData(); renderSupermarketList(); showToast('success', `${name} נוסף לרשימה`); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function smToggleMissing(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    item._smMissing = !item._smMissing;
    if (item._smMissing) { item.status = 'pending'; fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, status: 'pending'})}); }
    renderSupermarketList();
}

function smUpdatePrice(id, value) {
    const item = shoppingListCache.find(i => i.id == id);
    if (item) { item.estimated_price = parseFloat(value) || 0; }
    smCalcTotal();
    clearTimeout(window._smPriceTimer);
    window._smPriceTimer = setTimeout(() => {
        fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, estimatedPrice: parseFloat(value) || 0})});
    }, 800);
}

function smCalcTotal() {
    let total = 0; let found = 0; let all = shoppingListCache.filter(i => i.status !== 'requested').length;
    shoppingListCache.filter(i => i.status !== 'requested').forEach(i => {
        if (i.status === 'in_cart') { total += (parseFloat(i.estimated_price) || 0) * (parseFloat(i.quantity) || 1); found++; }
    });
    const smTotalEl = getEl('sm-total'); if (smTotalEl) smTotalEl.innerText = `₪${total.toFixed(2)}`;
    const smProgressEl = getEl('sm-progress-text'); if (smProgressEl) smProgressEl.innerText = `${found} מתוך ${all} פריטים נמצאו`;
}

// ============================================================
// --- SAVED SHOPPING LISTS (Feature 5) ---
// ============================================================

async function openSavedListsModal() {
    getEl('saved-lists-modal').classList.remove('hidden');
    await loadSavedLists();
}

async function loadSavedLists() {
    try {
        const res = await fetch(`${API}/shopping/saved?groupId=${currentGroup.id}`);
        const data = await res.json();
        const container = getEl('saved-lists-content');
        if (!data || data.length === 0) { container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">אין רשימות שמורות עדיין</p>'; return; }
        container.innerHTML = data.map(list => `
            <div class="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-700 text-sm truncate">${safeStr(list.name)}</p>
                    <p class="text-xs text-slate-400">${(list.items || []).length} פריטים · ${new Date(list.created_at).toLocaleDateString('he-IL')}</p>
                </div>
                <button onclick="loadSavedList(${list.id})" class="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition">טען</button>
                <button onclick="deleteSavedList(${list.id})" class="bg-red-50 text-red-500 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-100 transition"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        `).join('');
    } catch(e) { showToast('error', 'שגיאה בטעינת הרשימות'); }
}

async function saveCurrentList() {
    const name = (getEl('save-list-name').value || '').trim();
    if (!name) { showToast('error', 'יש לתת שם לרשימה'); return; }
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested' && i.status !== 'in_cart');
    if (activeItems.length === 0) { showToast('error', 'אין פריטים ברשימה לשמירה'); return; }
    const itemsToSave = activeItems.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, estimated_price: i.estimated_price, units_per_package: i.units_per_package }));
    try {
        const res = await fetch(`${API}/shopping/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupId: currentGroup.id, name, items: itemsToSave }) });
        const data = await res.json();
        if (data.success) { getEl('save-list-name').value = ''; showToast('success', 'הרשימה נשמרה!'); await loadSavedLists(); } else showToast('error', 'שגיאה בשמירת הרשימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function loadSavedList(listId) {
    if (!confirm('לטעון את הרשימה השמורה לרשימת הקניות הנוכחית?')) return;
    try {
        const res = await fetch(`${API}/shopping/load-saved`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ listId, userId: currentUser.id }) });
        const data = await res.json();
        if (data.success) { getEl('saved-lists-modal').classList.add('hidden'); showToast('success', `${data.count} פריטים נטענו לרשימה!`); fetchData(); } else showToast('error', data.error || 'שגיאה בטעינת הרשימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function deleteSavedList(listId) {
    if (!confirm('למחוק רשימה שמורה זו?')) return;
    try {
        await fetch(`${API}/shopping/saved/${listId}`, { method:'DELETE' });
        await loadSavedLists();
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

// ============================================================
// --- DRAFT FROM MISSING ITEMS (Feature 4) ---
// ============================================================

async function createDraftFromMissing() {
    const items = window._pendingMissingItems || [];
    if (items.length === 0) { getEl('missing-draft-modal').classList.add('hidden'); return; }
    try {
        for (const item of items) {
            await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemName: item.item_name, quantity: item.quantity, unit: item.unit, estimatedPrice: item.estimated_price, unitsPerPackage: item.units_per_package, userId: currentUser.id, groupId: currentGroup.id }) });
        }
        getEl('missing-draft-modal').classList.add('hidden');
        showToast('success', `${items.length} פריטים חסרים נוספו לרשימה חדשה!`);
        window._pendingMissingItems = [];
        fetchData();
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = getEl('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${safeStr(i.item_name)} (x${i.quantity} ${safeStr(i.unit || "יח'")})</span><span class="font-bold">₪${i.price_per_unit || 0}/${safeStr(i.unit || "יח'")}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${safeStr(t.store_name)} ${t.branch_name ? `(${safeStr(t.branch_name)})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • אישור: ${safeStr(t.nickname)}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700">יבא דרישה שוב</button></div></div>`; }); getEl('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { getEl('bank-user-id').value = id; getEl('bank-user-name').innerText = `תקציב דמי כיס: ${name}`; getEl('bank-allowance').value = allowance; getEl('bank-interest').value = interest; getEl('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); getEl('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
function openAdjustBalanceModal(id, name) { getEl('adjustment-user-id').value = id; getEl('adjustment-user-name').innerText = `עבור: ${name}`; getEl('adjustment-amount').value = ''; getEl('adjustment-reason').value = ''; toggleAdjustmentType('add'); getEl('balance-adjustment-modal').classList.remove('hidden'); }
function toggleAdjustmentType(type) { getEl('adjustment-type').value = type; const deductBtn = getEl('btn-adj-deduct'); const addBtn = getEl('btn-adj-add'); if (!deductBtn || !addBtn) return; if (type === 'deduct') { deductBtn.className = 'flex-1 py-1.5 text-sm font-bold bg-white text-red-600 rounded-lg shadow-sm transition'; addBtn.className = 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-green-600 rounded-lg transition'; } else { addBtn.className = 'flex-1 py-1.5 text-sm font-bold bg-white text-green-600 rounded-lg shadow-sm transition'; deductBtn.className = 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-red-600 rounded-lg transition'; } }
async function submitBalanceAdjustment() { const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const rawAmount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'הפרשת דמי כיס' : 'הפחתה'); if (!rawAmount || rawAmount <= 0) return showToast('error', 'נא להזין סכום תקין'); const btn = getEl('btn-submit-adjustment'); if (btn) { btn.disabled = true; btn.innerText = 'מעדכן...'; } try { const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type, amount: Math.abs(rawAmount), reason }) }); const data = await res.json(); if (data.success) { showToast('success', type === 'add' ? `₪${rawAmount} הועבר לחשבון הילד/ה` : `₪${rawAmount} הופחתו מחשבון הילד/ה`); getEl('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else { showToast('error', data.error || 'שגיאה בעדכון'); } } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'עדכן יתרה'; } } }
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

async function fetchMembers() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`);
        membersCache = await res.json();
        if (!Array.isArray(membersCache)) membersCache = [];

        // עדכון רשימות בחירה להורה/מנהל
        if (currentUser.role === 'ADMIN') {
            try {
                const bF = getEl('budget-filter');
                const fF = getEl('feed-user-filter');
                const gS = getEl('goal-target-user');
                const cfF = getEl('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if (cur) bF.value = cur; }
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל בני המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if (cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כל בני המשפחה</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if (cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור מי ביעד?</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${safeStr(m.nickname)}</option>`; }); if (cur) gS.value = cur; }
            } catch (err) {}
        }

        // רשימת בני המשפחה — גלויה לכולם
        try {
            const c = getEl('members-list');
            if (c) {
                c.innerHTML = '';
                membersCache.forEach(m => {
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?';
                    const roleLabel = m.role === 'ADMIN' ? 'הורה' : 'ילד';
                    const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                    const adminPermsBtn = currentUser.role === 'ADMIN' ? `<button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${m.role}', '${permsStr}')" class="mr-2 text-purple-600 hover:text-purple-800 bg-purple-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="הרשאות"><i class="fa-solid fa-user-shield text-sm"></i></button>` : '';
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="mr-2 text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="הסר מהמשפחה"><i class="fa-solid fa-trash text-sm"></i></button>` : '';
                    c.innerHTML += `<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${safeStr(m.nickname) || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${roleLabel})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg ml-2">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminPermsBtn}${adminDeleteBtn}</div></div>`;
                });
            }
        } catch (err) {}

        // חשבונות בנק של הילדים — גלוי להורה בלבד
        try {
            const a = getEl('bank-accounts-list');
            if (a && currentUser.role === 'ADMIN') {
                a.innerHTML = '';
                const children = membersCache.filter(m => m.role !== 'ADMIN');
                if (children.length === 0) {
                    a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים כרגע במשפחה.</p>';
                } else {
                    children.forEach(m => {
                        const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?';
                        const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                        a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(m.nickname) || 'ילד'}</h4><p class="text-[10px] text-slate-400">דמי כיס: ₪${m.allowance_amount || 0} • ריבית: ${m.interest_rate || 0}%</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-slate-800">₪${m.balance || 0}</span></p></div></div><div class="flex gap-1 sm:gap-2"><button onclick="openAdjustBalanceModal(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition" title="הפרש דמי כיס"><i class="fa-solid fa-coins text-sm"></i></button><button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${m.role}', '${permsStr}')" class="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center transition" title="הרשאות"><i class="fa-solid fa-user-shield text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${safeStr(m.nickname)}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`;
                    });
                }
            }
        } catch (err) {}

    } catch (e) {}
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return; 
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json(); const list = getEl('pending-list'); const container = getEl('admin-panel'); 
        if (users && users.length > 0) { 
            container.classList.remove('hidden'); list.innerHTML = ''; 
            users.forEach(u => { list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${safeStr(u.nickname)}</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-700 transition">אשר למשפחה</button></div></div>`; }); 
        } else { if(container) container.classList.add('hidden'); } 
    } catch(e) {} 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'אושר כבן משפחה!'); fetchPendingUsers(); fetchMembers(); }
async function openProfileModal() {
    getEl('old-password').value = '';
    getEl('new-password').value = '';
    getEl('profile-modal').classList.remove('hidden');
    loadFamilyAddress();
    // Load phone
    try {
        const r = await fetch(`${API}/users/${currentUser.id}/phone`);
        const d = await r.json();
        if (d.success && getEl('user-phone-input')) getEl('user-phone-input').value = d.phone || '';
    } catch(e) {}
}

async function saveUserPhone() {
    const phone = (getEl('user-phone-input')?.value || '').trim();
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/phone`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success) showToast('success', 'מספר הטלפון נשמר!');
        else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function saveFamilyAddress() {
    const city = (getEl('family-city-input')?.value || '').trim();
    const streetAddress = (getEl('family-address-input')?.value || '').trim();
    if (!city && !streetAddress) { showToast('error', 'יש למלא לפחות עיר או כתובת'); return; }
    try {
        const res = await fetch(`/api/groups/${currentGroup.id}/address`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ city, streetAddress })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הכתובת נשמרה!');
            if (currentGroup) { currentGroup.city = city; currentGroup.street_address = streetAddress; }
            // Persist to localStorage so address survives page refresh
            try {
                const session = JSON.parse(localStorage.getItem('ofl_session') || '{}');
                if (session.group) { session.group.city = city; session.group.street_address = streetAddress; localStorage.setItem('ofl_session', JSON.stringify(session)); }
            } catch(e) {}
        } else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function loadFamilyAddress() {
    if (!currentGroup) return;
    if (getEl('family-city-input')) getEl('family-city-input').value = currentGroup.city || '';
    if (getEl('family-address-input')) getEl('family-address-input').value = currentGroup.street_address || '';
}
async function submitChangePassword(e) { e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; try { const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); getEl('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'עדכון סיסמת גישה'; } }
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש לצמיתות?`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש הוסר בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }

window.open360Report = async function() {
    if (!currentGroup || !currentGroup.id) {
        showToast('error', 'קבוצה לא מוגדרת');
        return;
    }
    try {
        const modal = document.getElementById('report-360-modal');
        if (!modal) return;
        
        document.getElementById('report-360-group-name').innerText = currentGroup.name || '---';
        document.getElementById('report-360-group-type').innerText = 'משפחה';
        document.getElementById('report-360-group-code').innerText = currentGroup.group_code || currentGroup.code || '---';
        document.getElementById('report-360-group-email').innerText = currentGroup.admin_email || '---';
        
        const now = new Date();
        document.getElementById('report-360-date').innerText = `תאריך הפקה: ${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL')}`;

        // שימוש במשתנים הגלובליים ללא תלות ב-window
        let totalBalances = 0;
        let usersHtml = '';
        if(membersCache && membersCache.length > 0) {
            membersCache.forEach(u => {
                const roleStr = u.role === 'ADMIN' ? 'הורה / מנהל' : 'ילד / משתמש';
                const bal = parseFloat(u.balance) || 0;
                totalBalances += bal;
                usersHtml += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; border-right: none; border-left: none;"><b>${safeStr(u.nickname)}</b></td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; border-right: none; border-left: none;">${roleStr}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-family: monospace; border-right: none; border-left: none;" dir="ltr">₪${bal.toFixed(2)}</td>
                    </tr>`;
            });
            usersHtml += `
                <tr style="background-color: #f1f5f9; font-weight: bold;">
                    <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; border-right: none; border-left: none;">סה"כ יתרות פתוחות במערכת:</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; border-right: none; border-left: none;" dir="ltr">₪${totalBalances.toFixed(2)}</td>
                </tr>`;
        } else {
            usersHtml = '<tr><td colspan="3" style="padding: 15px; text-align: center; color: #94a3b8;">אין נתונים</td></tr>';
        }
        document.getElementById('report-360-users-list').innerHTML = usersHtml;

        let txHtml = '';
        if(allTransactions && allTransactions.length > 0) {
            allTransactions.slice(0, 30).forEach(t => {
                const d = new Date(t.date || t.created_at);
                const isInc = t.type === 'income';
                const color = isInc ? '#16a34a' : '#dc2626';
                const prefix = isInc ? '+' : '-';
                txHtml += `
                    <tr>
                        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${d.toLocaleDateString('he-IL')}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px;">${safeStr(t.user_name || 'כללי')}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">${safeStr(t.description)}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: left; color: ${color}; font-weight: bold; font-family: monospace; font-size: 12px;" dir="ltr">${prefix}₪${parseFloat(t.amount).toFixed(2)}</td>
                    </tr>`;
            });
        } else {
            txHtml = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #94a3b8;">אין תנועות תזרים מוקלטות ב-30 הימים האחרונים</td></tr>';
        }
        document.getElementById('report-360-tx-list').innerHTML = txHtml;

        let pCount = 0; let dCount = 0; let aReward = 0;
        if(allTasks && allTasks.length > 0) {
            allTasks.forEach(t => {
                if(t.status === 'pending') pCount++;
                else if(t.status === 'done') dCount++;
                else if(t.status === 'approved') aReward += parseFloat(t.reward) || 0;
            });
        }
        
        document.getElementById('report-360-tasks-list').innerHTML = `
            <li style="margin-bottom: 5px;"><strong>משימות פתוחות:</strong> ${pCount} משימות שממתינות לביצוע.</li>
            <li style="margin-bottom: 5px;"><strong>משימות בבדיקה:</strong> ${dCount} משימות שבוצעו וממתינות לאישור.</li>
            <li><strong>סה"כ שכר שחולק למשימות שבוצעו:</strong> ₪${aReward.toFixed(2)}</li>
        `;

        modal.classList.remove('hidden');
    } catch(e) {
        showToast('error', 'שגיאה ביצירת הדוח המקומי');
        console.error(e);
    }
};

// אפשרות הורדת PDF מדוח 360 הוסרה לטובת תצוגת UI נקייה ומהירה יותר

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
// ============================================================
// --- מודול הקהילה והעסקים המקומיים (רב קהילתי + יזמות מתוקן) ---
// ============================================================

let myConnectedCommunitiesCache = [];
let myCommunityBusinessesCache = [];
let myInitiativesCache = [];
let myCashbackCache = []; // [{community_id, community_name, balance, total_earned, is_community_manager}]

function switchFamCommunityTab(tab) {
    ['join', 'benefits', 'news'].forEach(t => {
        const view = document.getElementById(`fam-comm-view-${t}`);
        const btn = document.getElementById(`btn-fam-comm-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
    });
    const activeView = document.getElementById(`fam-comm-view-${tab}`);
    const activeBtn = document.getElementById(`btn-fam-comm-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl text-xs font-bold bg-orange-500 text-white shadow-md shadow-orange-200 transition';
}

async function fetchCommunityData() {
    if(!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/community/info/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success) {
            myConnectedCommunitiesCache = data.communities || [];
            myCommunityBusinessesCache = data.businesses || [];
            renderFamilyCommunities();
        }
        
        await fetchMyInitiatives();
        await fetchCashbackInfo();
    } catch(e) { console.error('Error fetching community data', e); }
}

async function fetchCashbackInfo() {
    if(!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/community/cashback-info/${currentGroup.id}`);
        const data = await res.json();
        if(data.success) {
            myCashbackCache = data.communities || [];
            renderFamilyCommunities(); // re-render now that cashback data is ready
        }
    } catch(e) {}
}

async function fetchMyInitiatives() {
    try {
        const res = await fetch(`${API}/community/my-initiatives/${currentGroup.id}`);
        const data = await res.json();
        if(data.success) {
            myInitiativesCache = data.initiatives || [];
            renderMyInitiatives();
        }
    } catch(e) { console.error('Error fetching initiatives', e); }
}

function openCreateCommunityModal() {
    if (!document.getElementById('create-community-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="create-community-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[90] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-slate-800"><i class="fa-solid fa-seedling text-green-500"></i> יזמות קהילתית</h3>
                    <button onclick="document.getElementById('create-community-modal').classList.add('hidden')" class="w-8 h-8 bg-slate-100 rounded-full text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <p class="text-sm text-slate-500 mb-6">פתחו קהילה חדשה באזור שלכם, הזמינו 30 משפחות, והקהילה תופעל באופן רשמי לקבלת הנחות מעסקים!</p>
                <div class="space-y-3 mb-6">
                    <div>
                        <label class="text-xs font-bold text-slate-500 block mb-1">שם הקהילה:</label>
                        <input type="text" id="init-comm-name" class="modern-input py-2.5 text-sm" placeholder="למשל: קהילת שכונת הפארק">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 block mb-1">אזורים (ניתן להפריד בפסיק לכמה ערים/שכונות):</label>
                        <input type="text" id="init-comm-city" class="modern-input py-2.5 text-sm" placeholder="למשל: רעננה, הרצליה, כפר סבא">
                    </div>
                </div>
                <button id="btn-submit-init-comm" onclick="submitNewInitiative()" class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition">צור קהילה</button>
            </div>
        </div>
        `);
    }
    getEl('init-comm-name').value = '';
    getEl('init-comm-city').value = '';
    getEl('create-community-modal').classList.remove('hidden');
}

async function submitNewInitiative() {
    const name = val('init-comm-name');
    const city = val('init-comm-city');
    if(!name || !city) return showToast('error', 'יש למלא שם וערים לקהילה');
    
    const btn = getEl('btn-submit-init-comm');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> פותח קהילה...';
    try {
        const res = await fetch(`${API}/community/user-create`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, city, groupId: currentGroup.id })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'הקהילה נפתחה כטיוטה! הזמינו חברים כדי להפעיל אותה.');
            getEl('create-community-modal').classList.add('hidden');
            fetchMyInitiatives();
        } else { showToast('error', data.error || 'שגיאה ביצירת קהילה'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
    finally { btn.disabled = false; btn.innerText = 'צור קהילה'; }
}

function renderMyInitiatives() {
    const container = document.getElementById('my-initiatives-container');
    if (!container) return;

    if (myInitiativesCache.length === 0) {
        container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 text-center mt-2 shadow-sm fade-in">
            <div class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-xl mx-auto mb-3 shadow-inner"><i class="fa-solid fa-seedling"></i></div>
            <h3 class="font-bold text-slate-800 mb-2">אין קהילה קיימת באזורכם?</h3>
            <p class="text-xs text-slate-500 mb-4 leading-relaxed">קחו יוזמה ופתחו קהילה מקומית דרכנו! צרפו 30 משפחות והקהילה שלכם תופעל לעסקים מקומיים.</p>
            <button onclick="openCreateCommunityModal()" class="w-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-5 py-3 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus mr-1"></i> פתיחת קהילה חדשה</button>
        </div>`;
        return;
    }

    let html = `<h3 class="font-bold text-slate-800 text-sm mt-6 mb-3 border-t border-slate-200 pt-4"><i class="fa-solid fa-seedling text-green-500"></i> הקהילות שיזמתי:</h3>`;
    
    myInitiativesCache.forEach(c => {
        const famCount = parseInt(c.family_count) || 0;
        const target = 30;
        const pct = Math.min(100, (famCount / target) * 100);
        const isReady = famCount >= target || c.status === 'active';
        const color = isReady ? 'green' : 'indigo';
        const statusText = isReady ? 'פעילה' : 'בגיוס חברים';
        
        const referralLink = `${window.location.origin}/?inviteCommunityCode=${c.code}`;
        const waText = encodeURIComponent(`היי! פתחתי קהילה מקומית ב-Oneflow: "${c.name}". אם נגיע ל-30 משפחות נקבל הנחות והטבות מעסקים באזור! להצטרפות בחינם: ${referralLink}`);

        html += `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-3 fade-in">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-slate-800">${safeStr(c.name)} <span class="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 rounded max-w-[150px] inline-block truncate align-bottom">${safeStr(c.city)}</span></h4>
                    <p class="text-[10px] text-${color}-600 font-bold bg-${color}-50 px-2 py-0.5 rounded-lg border border-${color}-100 inline-block mt-1">סטטוס: ${statusText}</p>
                </div>
                <button onclick="window.open('https://wa.me/?text=${waText}', '_blank')" class="bg-[#25D366] text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1ebd58] transition shadow-sm" title="שלח הזמנה לחברים בוואטסאפ"><i class="fa-brands fa-whatsapp"></i></button>
            </div>
            
            <div class="mt-3">
                <div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>${famCount} הצטרפו</span>
                    <span>יעד: ${target}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner border border-slate-200">
                    <div class="bg-${color}-500 h-2 rounded-full transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
                ${!isReady ? `<p class="text-[9px] text-slate-400 mt-1.5 text-center">חסרות ${target - famCount} משפחות להפעלת הקהילה</p>` : ''}
            </div>
        </div>
        `;
    });
    
    html += `<button onclick="openCreateCommunityModal()" class="w-full mt-2 bg-slate-50 text-slate-600 py-3 rounded-xl text-xs font-bold hover:bg-slate-100 transition border border-dashed border-slate-300"><i class="fa-solid fa-plus"></i> הקם קהילה נוספת</button>`;
    
    container.innerHTML = html;
}

function renderFamilyCommunities() {
    const tabContent = getEl('content-community');
    if (!tabContent) return;

    const isConnected = myConnectedCommunitiesCache.length > 0;

    // ── Join sub-view ──────────────────────────────────────────
    const joinView = getEl('fam-comm-view-join');
    if (joinView) {
        // Show/hide join form vs connected info
        const joinSection = getEl('community-join-section');
        const connectedInfo = getEl('community-connected-info');
        const nameDisplay = getEl('community-name-display');

        if (isConnected) {
            if (joinSection) joinSection.classList.add('hidden');
            if (connectedInfo) {
                connectedInfo.classList.remove('hidden');
                if (nameDisplay) {
                    const names = myConnectedCommunitiesCache.map(c => safeStr(c.name)).join(', ');
                    nameDisplay.textContent = names;
                }
            }
            // Build connected communities list inside join view (with cashback data)
            let commListHtml = `<div class="mb-4">
                <h3 class="font-bold text-slate-800 mb-3 text-sm"><i class="fa-solid fa-house-flag text-indigo-500"></i> הקהילות שלי (${myConnectedCommunitiesCache.length}/5)</h3>
                <div class="space-y-2">`;
            myConnectedCommunitiesCache.forEach(c => {
                const cbInfo = myCashbackCache.find(x => String(x.community_id) === String(c.id)) || {};
                const walletBal = parseFloat(cbInfo.balance || 0).toFixed(2);
                const isManager = cbInfo.is_community_manager;
                const walletBadge = `<span class="text-[9px] font-bold ${parseFloat(walletBal) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'} border px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-wallet mr-0.5"></i> ₪${walletBal}</span>`;
                const managerBadge = isManager ? `<span class="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-star mr-0.5"></i> מנהל קהילה</span>` : '';
                commListHtml += `
                <div class="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl shadow-sm fade-in">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            ${isManager ? `<button onclick="openCommunityManagerPanel(${c.id})" class="text-[10px] font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition border border-transparent hover:border-purple-200"><i class="fa-solid fa-gear mr-1"></i>ניהול</button>` : ''}
                            <button onclick="leaveCommunity(${c.id}, '${safeStr(c.name)}')" class="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition border border-transparent hover:border-red-200">התנתק</button>
                        </div>
                        <div class="text-right">
                            <h4 class="font-bold text-indigo-900 text-sm">${safeStr(c.name)}</h4>
                            <p class="text-[10px] text-indigo-700">אזורים: ${safeStr(c.city || 'כללי')}</p>
                            <div class="flex gap-1 mt-1 justify-end">${walletBadge}${managerBadge}</div>
                        </div>
                    </div>
                </div>`;
            });
            commListHtml += `</div>`;
            if (myConnectedCommunitiesCache.length < 5) {
                commListHtml += `<button onclick="document.getElementById('dyn-extra-join-section').classList.toggle('hidden')" class="w-full mt-3 bg-white border border-dashed border-slate-300 text-slate-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition fade-in"><i class="fa-solid fa-plus"></i> הצטרפות לקהילה נוספת</button>
                <div id="dyn-extra-join-section" class="hidden mt-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center fade-in">
                    <div class="flex gap-2">
                        <input type="text" id="community-code-input-dyn" class="modern-input py-2 text-sm text-center font-mono uppercase tracking-widest flex-1" placeholder="קוד קהילה">
                        <button onclick="joinCommunityDyn()" class="bg-slate-900 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition text-sm">התחבר</button>
                    </div>
                </div>`;
            }
            commListHtml += `</div>`;

            let dynContainer = getEl('join-dyn-comm-list');
            if (!dynContainer) {
                dynContainer = document.createElement('div');
                dynContainer.id = 'join-dyn-comm-list';
                joinView.appendChild(dynContainer);
            }
            dynContainer.innerHTML = commListHtml;
        } else {
            if (joinSection) joinSection.classList.remove('hidden');
            if (connectedInfo) connectedInfo.classList.add('hidden');
            // Show the intro banner
            let dynContainer = getEl('join-dyn-comm-list');
            if (!dynContainer) {
                dynContainer = document.createElement('div');
                dynContainer.id = 'join-dyn-comm-list';
                joinView.appendChild(dynContainer);
            }
            dynContainer.innerHTML = `
            <div class="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 mb-4 mt-2 shadow-sm fade-in flex items-center gap-4 text-right">

                <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500 text-2xl shrink-0">
                    <i class="fa-solid fa-users-rays"></i>
                </div>
                <div>
                    <h3 class="font-bold text-indigo-900 text-sm mb-0.5">הכוח של הקהילה בידיים שלכם</h3>
                    <p class="text-[10px] text-indigo-700 font-medium leading-tight">
                        התחברו לקהילות קיימות באזורכם או צרו קהילה חדשה בעצמכם כדי לקבל מידע חשוב, הטבות והנחות מעסקים מקומיים ועסקים אחרים!
                    </p>
                </div>
            </div>`;
        }
    }

    // ── Benefits sub-view ─────────────────────────────────────
    const bizList = getEl('community-businesses-list');
    if (bizList) {
        if (myCommunityBusinessesCache.length > 0) {
            let bizHtml = '';
            myCommunityBusinessesCache.forEach(biz => {
                const storeLink = `${window.location.origin}/storefront.html?store=${biz.group_code}&communityId=${biz.community_id}`;
                const minFam = parseInt(biz.min_families) || 30;
                const famCount = parseInt(biz.family_count) || 0;
                const discountActive = famCount >= minFam;
                const discountBadge = discountActive
                    ? `<span class="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">${biz.discount_pct}% הנחה</span>`
                    : `<span class="text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100"><i class="fa-solid fa-clock-rotate-left"></i> ${biz.discount_pct}% הנחה ב-${famCount}/${minFam} משפחות</span>`;
                bizHtml += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between hover:border-emerald-100 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(biz.business_name)}</h4>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${discountBadge}
                                <span class="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                                    מקהילת ${safeStr(biz.comm_name)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <a href="${storeLink}" target="_blank" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm shrink-0">
                        לחנות
                    </a>
                </div>`;
            });
            bizList.innerHTML = bizHtml;
        } else {
            bizList.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">אין עסקים בקהילות שלכם כרגע.</p>';
        }
    }

    // ── Initiatives (appended inside join view) ───────────────
    let initContainer = getEl('my-initiatives-container');
    if (!initContainer) {
        initContainer = document.createElement('div');
        initContainer.id = 'my-initiatives-container';
        const joinViewEl = getEl('fam-comm-view-join');
        if (joinViewEl) joinViewEl.appendChild(initContainer);
        else tabContent.appendChild(initContainer);
    }

    // קריאה קריטית לרינדור יוזמות
    renderMyInitiatives();

    // Auto-switch to benefits tab when connected and there are businesses
    if (isConnected && myCommunityBusinessesCache.length > 0) {
        switchFamCommunityTab('benefits');
    }
}

async function joinCommunity() {
    return joinCommunityDyn();
}

async function joinCommunityDyn() {
    const inputEl = getEl('community-code-input-dyn') || getEl('community-code-input');
    const code = inputEl ? inputEl.value : '';
    if(!code) return showToast('error', 'יש להזין קוד קהילה');
    
    try {
        const res = await fetch(`${API}/community/join`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, code })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', `הצטרפתם בהצלחה לקהילת: ${data.community.name}`);
            fetchCommunityData();
        } else { showToast('error', data.error || 'שגיאה. ודאו שהקוד נכון וטרם הגעתם ל-5 קהילות.'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function leaveCommunity(commId, commName) {
    if(!confirm(`האם אתם בטוחים שברצונכם להתנתק מקהילת ${commName}? לא תוכלו לקבל הנחות מעסקים בקהילה זו.`)) return;
    try {
        const res = await fetch(`${API}/community/leave/${currentGroup.id}/${commId}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            showToast('success', `התנתקתם מקהילת ${commName}`);
            fetchCommunityData();
        } else { showToast('error', data.error || 'אירעה שגיאה בניתוק מהקהילה'); }
    } catch (e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

const familyOriginalSwitchTab = window.switchTab;
if (familyOriginalSwitchTab && !window.familySwitchTabOverridden) {
    window.switchTab = function(tabId) {
        familyOriginalSwitchTab(tabId);
        if (tabId === 'community') fetchCommunityData();
    };
    window.familySwitchTabOverridden = true;
}
// ============================================================
// --- פאנל מנהל קהילה ---
// ============================================================

async function openCommunityManagerPanel(commId) {
    try {
        const res = await fetch(`${API}/community/manager-data/${currentGroup.id}`);
        const data = await res.json();
        if (!data.success) return showToast('error', 'שגיאה בטעינת נתוני קהילה');

        const comm = data.managed_communities.find(c => c.community_id === commId);
        const wallet = data.wallets.find(w => w.community_id === commId) || { balance: 0, total_earned: 0 };
        const pending = (data.pending_businesses || []).filter(b => b.community_id === commId && b.status === 'pending');
        const approved = (data.pending_businesses || []).filter(b => b.community_id === commId && b.status === 'approved');
        const txs = (data.transactions || []).filter(t => t.community_id === commId).slice(0, 10);

        let modal = document.getElementById('comm-manager-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'comm-manager-modal';
            modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }

        const pendingHtml = pending.length ? pending.map(b => `
            <div class="bg-orange-50 border border-orange-100 p-3 rounded-xl flex justify-between items-center mb-2">
                <div class="flex gap-2">
                    <button onclick="saApproveBizFromManager(${b.community_id}, ${b.business_id})" class="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-600">אשר</button>
                    <button onclick="saRejectBizFromManager(${b.community_id}, ${b.business_id})" class="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200">דחה</button>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${safeStr(b.business_name)}</p>
                    <p class="text-[10px] text-slate-500">הנחה מוצעת: ${b.discount_pct}%</p>
                </div>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-4">אין בקשות ממתינות</p>';

        const approvedHtml = approved.length ? approved.map(b => `
            <div class="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center mb-2">
                <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">${b.discount_pct}% הנחה</span>
                <span class="font-bold text-slate-700 text-sm">${safeStr(b.business_name)}</span>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-2">אין עסקים פעילים</p>';

        const txHtml = txs.length ? txs.map(t => `
            <div class="flex justify-between items-center border-b border-slate-50 py-2">
                <span class="text-emerald-600 font-bold text-sm">+₪${parseFloat(t.amount).toFixed(2)}</span>
                <div class="text-right">
                    <p class="text-xs text-slate-700">${safeStr(t.description || '')}</p>
                    <p class="text-[10px] text-slate-400">${new Date(t.created_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-4">אין תנועות עדיין</p>';

        modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto modal-scroll relative" dir="rtl">
            <button onclick="document.getElementById('comm-manager-modal').remove()" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="text-xl font-bold mb-1 text-slate-800"><i class="fa-solid fa-star text-purple-500 mr-2"></i> ניהול קהילה</h3>
            <p class="text-sm text-slate-500 mb-5">${safeStr(comm?.community_name || '')}</p>

            <!-- ארנק -->
            <div class="bg-gradient-to-l from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 mb-5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[10px] text-amber-600 font-bold">סה"כ נצבר</p>
                        <p class="text-2xl font-black text-amber-800">₪${parseFloat(wallet.total_earned).toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-amber-600 font-bold"><i class="fa-solid fa-wallet mr-1"></i> ארנק קהילה</p>
                        <p class="text-3xl font-black text-amber-700">₪${parseFloat(wallet.balance).toFixed(2)}</p>
                        <p class="text-[10px] text-amber-500">יתרה זמינה</p>
                    </div>
                </div>
            </div>

            <!-- אישורי עסקים -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-store text-orange-500"></i> בקשות הצטרפות ממתינות</h4>
                ${pendingHtml}
            </div>

            <!-- שותפים -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-handshake text-blue-500"></i> עסקים פעילים בקהילה</h4>
                ${approvedHtml}
            </div>

            <!-- הודעות ממנהל האזור -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-inbox text-indigo-500"></i> הודעות ממנהל האזור</h4>
                <button onclick="openCommunityManagerInbox(${commId})" class="w-full py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition">
                    <i class="fa-solid fa-inbox mr-2"></i>פתח תיבת הודעות
                </button>
            </div>

            <!-- תנועות ארנק -->
            <div>
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-clock-rotate-left text-emerald-500"></i> היסטוריית קאשבק</h4>
                ${txHtml}
            </div>
        </div>`;
        modal.classList.remove('hidden');
    } catch(e) { showToast('error', 'שגיאה בטעינת פאנל קהילה'); }
}

async function saApproveBizFromManager(communityId, businessId) {
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'העסק אושר!'); document.getElementById('comm-manager-modal')?.remove(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function saRejectBizFromManager(communityId, businessId) {
    try {
        const res = await fetch(`${API}/sa/community-business/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'הבקשה נדחתה'); document.getElementById('comm-manager-modal')?.remove(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

// ============================================================
// --- COMMUNITY MANAGER INBOX ---
// ============================================================

let cmInboxCurrentThreadId = null;
let cmInboxCurrentCommunityId = null;

async function openCommunityManagerInbox(communityId) {
    cmInboxCurrentCommunityId = communityId;
    cmInboxCurrentThreadId = null;
    let modal = document.getElementById('cm-inbox-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cm-inbox-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9995] flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" dir="rtl" style="font-family:'Rubik',sans-serif">
        <div class="p-5 border-b border-slate-100 flex justify-between items-center">
            <button onclick="document.getElementById('cm-inbox-modal').remove()" class="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-black text-slate-800"><i class="fa-solid fa-inbox text-indigo-500 mr-2"></i>הודעות ממנהל האזור</h3>
        </div>
        <div id="cm-inbox-view" class="flex-1 overflow-y-auto p-4">
            <div class="text-center text-slate-400 py-6">טוען...</div>
        </div>
        <div id="cm-inbox-reply-bar" class="hidden p-4 border-t border-slate-100 space-y-2">
            <div class="flex gap-2">
                <button onclick="sendCMReply()" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600 transition whitespace-nowrap">שלח</button>
                <textarea id="cm-reply-input" class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" rows="2" placeholder="כתוב תשובה..."></textarea>
            </div>
            <button onclick="showCMThreadList()" class="text-xs text-slate-400 hover:text-slate-600 font-bold">← חזרה לרשימה</button>
        </div>
        <div class="p-4 border-t border-slate-100 flex gap-2" id="cm-inbox-footer">
            <button onclick="openCMNewThread()" class="flex-1 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition">
                <i class="fa-solid fa-pen mr-1.5"></i>שלח הודעה למנהל האזור
            </button>
        </div>
    </div>`;
    modal.classList.remove('hidden');
    showCMThreadList();
}

async function showCMThreadList() {
    cmInboxCurrentThreadId = null;
    document.getElementById('cm-inbox-reply-bar').classList.add('hidden');
    document.getElementById('cm-inbox-footer').classList.remove('hidden');
    const view = document.getElementById('cm-inbox-view');
    view.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/community/inbox/${currentGroup.id}`);
        const data = await res.json();
        const threads = data.threads || [];
        if (!threads.length) {
            view.innerHTML = '<div class="text-center text-slate-400 py-10"><i class="fa-solid fa-inbox text-4xl text-slate-200 mb-3 block"></i>אין הודעות עדיין</div>';
            return;
        }
        view.innerHTML = threads.map(t => {
            const unread = parseInt(t.unread_count || 0);
            return `
            <div class="flex items-center gap-3 rounded-2xl px-4 py-3.5 border mb-2 cursor-pointer hover:shadow-sm transition ${unread > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}" onclick="openCMThread(${t.id})">
                <div class="w-9 h-9 rounded-xl ${unread > 0 ? 'bg-indigo-200' : 'bg-slate-200'} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-comment-dots ${unread > 0 ? 'text-indigo-600' : 'text-slate-500'} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0 text-right">
                    <div class="flex justify-between">
                        <span class="text-[10px] text-slate-400">${new Date(t.last_message_at).toLocaleDateString('he-IL')}</span>
                        <p class="font-bold text-slate-700 text-sm truncate">${t.zone_manager_name || '—'}</p>
                    </div>
                    <p class="text-xs text-slate-500 truncate">${t.last_message || ''}</p>
                </div>
                ${unread > 0 ? `<span class="bg-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">${unread}</span>` : ''}
            </div>`;
        }).join('');
    } catch(e) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאת תקשורת</div>'; }
}

async function openCMThread(threadId) {
    cmInboxCurrentThreadId = threadId;
    const view = document.getElementById('cm-inbox-view');
    view.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    document.getElementById('cm-inbox-reply-bar').classList.remove('hidden');
    document.getElementById('cm-inbox-footer').classList.add('hidden');
    document.getElementById('cm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/community/inbox/thread/${threadId}/${currentGroup.id}`);
        const data = await res.json();
        if (!data.success) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאה</div>'; return; }
        view.innerHTML = `
            <p class="text-xs font-bold text-slate-400 text-center mb-3">${data.thread.subject || ''} · ${data.thread.zone_manager_name || ''}</p>
            <div class="space-y-3">
                ${(data.messages || []).map(m => {
                    const isCommunity = m.sender_type === 'community';
                    return `<div class="flex ${isCommunity ? 'justify-start' : 'justify-end'}">
                        <div class="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isCommunity ? 'bg-slate-200 text-slate-700 rounded-bl-sm' : 'bg-indigo-500 text-white rounded-br-sm'}">
                            <p>${m.content}</p>
                            <p class="text-[10px] mt-1 ${isCommunity ? 'text-slate-400' : 'text-indigo-200'} text-left">${new Date(m.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        view.scrollTop = view.scrollHeight;
    } catch(e) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאת תקשורת</div>'; }
}

async function sendCMReply() {
    const content = document.getElementById('cm-reply-input').value.trim();
    if (!content || !cmInboxCurrentThreadId) return;
    document.getElementById('cm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/community/inbox/thread/${cmInboxCurrentThreadId}/reply`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, content })
        });
        const data = await res.json();
        if (data.success) openCMThread(cmInboxCurrentThreadId);
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function openCMNewThread() {
    const communityId = cmInboxCurrentCommunityId;
    if (!communityId) { showToast('error', 'שגיאה בזיהוי הקהילה'); return; }
    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4" dir="rtl" style="font-family:'Rubik',sans-serif">
        <div class="flex justify-between items-center">
            <button onclick="this.closest('.fixed').remove()" class="text-slate-400 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-black text-slate-800">שלח הודעה למנהל האזור</h3>
        </div>
        <div>
            <label class="text-xs font-bold text-slate-500 block mb-1.5">נושא</label>
            <input type="text" id="cm-new-subject" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" placeholder="נושא ההודעה">
        </div>
        <div>
            <label class="text-xs font-bold text-slate-500 block mb-1.5">הודעה</label>
            <textarea id="cm-new-content" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" rows="4" placeholder="כתוב את הודעתך..."></textarea>
        </div>
        <p id="cm-new-err" class="text-red-500 text-xs text-center hidden"></p>
        <div class="flex gap-2">
            <button onclick="this.closest('.fixed').remove()" class="flex-1 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition">ביטול</button>
            <button onclick="submitCMNewThread(${communityId}, this)" class="flex-1 py-2 text-sm font-bold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition">שלח</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function submitCMNewThread(communityId, btn) {
    const subject = document.getElementById('cm-new-subject').value.trim();
    const content = document.getElementById('cm-new-content').value.trim();
    const err = document.getElementById('cm-new-err');
    err.classList.add('hidden');
    if (!content) { err.textContent = 'תוכן ההודעה חובה'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = 'שולח...';
    try {
        const res = await fetch(`${API}/community/inbox/new`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, communityId, subject, content })
        });
        const data = await res.json();
        if (data.success) {
            btn.closest('.fixed').remove();
            showCMThreadList();
        } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; }
}

// ============================================================
// --- ניהול קהילות דרך ממשק אדמין ראשי (Super Admin) ---
// ============================================================

let saCommunitiesCache = [];
let saBusinessesCache = [];
let saBizConnectionsCache = []; // שומר את כל החיבורים בין עסק לקהילה
let currentCommFamiliesCache = []; 

// מנגנון תגיות ערים
let createCityTags = [];
let editCityTags = [];

function updateCityTagsDisplay(type) {
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    const container = getEl(type === 'create' ? 'sa-comm-city-tags' : 'sa-edit-comm-city-tags');
    const dataInput = getEl(type === 'create' ? 'sa-comm-city-data' : 'sa-edit-comm-city-data');
    if (!container || !dataInput) return;

    if (tagsArr.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-slate-400 w-full text-center my-auto">לא נבחרו ערים. חובה לבחור לפחות עיר אחת.</p>';
        dataInput.value = '';
        return;
    }

    container.innerHTML = tagsArr.map((city, index) => `
        <div class="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-orange-200 shadow-sm animate-bounce-in">
            ${city}
            <button onclick="removeCityTag('${type}', ${index})" class="text-orange-500 hover:text-red-500 transition focus:outline-none"><i class="fa-solid fa-times"></i></button>
        </div>
    `).join('');
    dataInput.value = tagsArr.join(', ');
}

function addCityTag(type) {
    const input = getEl(type === 'create' ? 'sa-comm-city-input' : 'sa-edit-comm-city-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    if (!tagsArr.includes(val)) {
        tagsArr.push(val);
        updateCityTagsDisplay(type);
    }
    input.value = '';
}

// המרת תמונה לקהילה
function handleCommImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width; let height = img.height;
            const maxSize = 600; // נקטין קצת כדי לחסוך מקום בשרת
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            
            if (type === 'create') {
                getEl('sa-comm-image-base64').value = base64;
                getEl('sa-comm-img-preview').src = base64;
                getEl('sa-comm-img-preview-container').classList.remove('hidden');
            } else {
                getEl('sa-edit-comm-image-base64').value = base64;
                getEl('sa-edit-comm-img-preview').src = base64;
                getEl('sa-edit-comm-img-preview').classList.remove('hidden');
                const placeholder = getEl('sa-edit-comm-img-placeholder');
                if(placeholder) placeholder.classList.add('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function switchSATab(tabId) {
    ['stats', 'comm', 'content', 'users', 'biz', 'finance'].forEach(t => {
        const view = document.getElementById(`sa-view-${t}`);
        const btn = document.getElementById(`btn-sa-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 py-3 px-4 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition';
    });
    
    const activeView = document.getElementById(`sa-view-${tabId}`);
    const activeBtn = document.getElementById(`btn-sa-tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold bg-white text-slate-800 rounded-xl shadow-sm transition';
    if (tabId === 'finance') loadSAFinanceData();
}

async function loadSAFinanceData() {
    try {
        // טעינת אחוזים
        const ratesRes = await fetch(`${API}/sa/settings/rates`, { headers: { 'Authorization': saToken || '' } });
        const ratesData = await ratesRes.json();
        if (ratesData.success) {
            const commInput = document.getElementById('sa-commission-pct');
            const cashbackInput = document.getElementById('sa-cashback-pct');
            if (commInput) commInput.value = ratesData.platform_commission_pct;
            if (cashbackInput) cashbackInput.value = ratesData.community_cashback_pct;
            updateRatesExample(ratesData.platform_commission_pct, ratesData.community_cashback_pct);
        }
        // טעינת חובות עסקים
        const duesRes = await fetch(`${API}/sa/business-dues`, { headers: { 'Authorization': saToken || '' } });
        const duesData = await duesRes.json();
        const duesTbody = document.getElementById('sa-dues-table-body');
        if (duesTbody && duesData.success) {
            if (!duesData.dues.length) {
                duesTbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">אין נתונים עדיין. נתונים יצברו כשהזמנות יסומנו כ"נמסר".</td></tr>';
            } else {
                duesTbody.innerHTML = duesData.dues.map(d => `<tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-slate-800">${safeStr(d.business_name)}<br><span class="text-[10px] text-slate-400">${safeStr(d.group_code)}</span></td>
                    <td class="px-4 py-3 text-center font-mono">₪${parseFloat(d.total_sales||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono text-blue-700">₪${parseFloat(d.total_commission||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono text-amber-600">₪${parseFloat(d.total_cashback||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-red-600">₪${parseFloat(d.pending_commission||0).toFixed(2)}</td>
                </tr>`).join('');
            }
        }
        // טעינת ארנקים
        const walletsRes = await fetch(`${API}/sa/community-wallets`, { headers: { 'Authorization': saToken || '' } });
        const walletsData = await walletsRes.json();
        const walletsTbody = document.getElementById('sa-wallets-table-body');
        if (walletsTbody && walletsData.success) {
            if (!walletsData.wallets.length) {
                walletsTbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">אין קהילות רשומות</td></tr>';
            } else {
                walletsTbody.innerHTML = walletsData.wallets.map(w => `<tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-slate-800">${safeStr(w.name)}</td>
                    <td class="px-4 py-3 text-slate-500 text-sm">${safeStr(w.city||'כללי')}</td>
                    <td class="px-4 py-3 text-center">${w.family_count||0}</td>
                    <td class="px-4 py-3 text-center font-mono text-amber-700">₪${parseFloat(w.total_earned||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-emerald-700">₪${parseFloat(w.balance||0).toFixed(2)}</td>
                </tr>`).join('');
            }
        }
    } catch(e) { console.error('Finance load error:', e); }
}

function updateRatesExample(commPct, cashbackPct) {
    const commEl = document.getElementById('sa-example-comm');
    const cashEl = document.getElementById('sa-example-cashback');
    if (commEl) commEl.textContent = '₪' + (1000 * commPct / 100).toFixed(2);
    if (cashEl) cashEl.textContent = '₪' + (1000 * commPct / 100 * cashbackPct / 100).toFixed(2);
}

async function savePlatformRates() {
    const commPct = parseFloat(document.getElementById('sa-commission-pct')?.value || 3);
    const cashbackPct = parseFloat(document.getElementById('sa-cashback-pct')?.value || 30);
    try {
        const res = await fetch(`${API}/sa/settings/rates`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ platform_commission_pct: commPct, community_cashback_pct: cashbackPct })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'ההגדרות נשמרו בהצלחה!'); updateRatesExample(commPct, cashbackPct); }
        else showToast('error', data.error || 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function loadSACommunityData() {
    try {
        const tbody = getEl('sa-communities-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> מפענח נתוני קהילות...</td></tr>`;

        // 1. קהילות
        try {
            const commRes = await fetch(`${API}/sa/communities`, { headers: { 'Authorization': saToken || '' } });
            const commData = await commRes.json();
            
            if(commData.success) {
                saCommunitiesCache = commData.communities || [];
                
                const totalCommunities = saCommunitiesCache.length;
                const totalCommMembers = saCommunitiesCache.reduce((sum, c) => sum + parseInt(c.family_count || 0), 0);
                
                // סכימה של סך כל החיבורים המאושרים מתוך הקהילות ששלפנו!
                const totalApprovedConnections = saCommunitiesCache.reduce((sum, c) => sum + parseInt(c.business_count || 0), 0);

                if (getEl('sa-stat-communities')) getEl('sa-stat-communities').innerText = totalCommunities;
                if (getEl('sa-stat-community-members')) getEl('sa-stat-community-members').innerText = totalCommMembers;
                // עדכון הקובייה ה-6
                if (getEl('sa-stat-connections')) getEl('sa-stat-connections').innerText = totalApprovedConnections;

                if(typeof filterSACommSelect === 'function') filterSACommSelect();
                renderSACommunitiesTable();
            } else {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-500 bg-red-50 rounded-xl">שגיאת שרת: ${commData.error}</td></tr>`;
            }
        } catch(e) { 
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">שגיאת תקשורת בטעינת קהילות</td></tr>`;
        }

        // 2. עסקים
        try {
            let bizRes = await fetch(`${API}/sa/businesses`, { headers: { 'Authorization': saToken || '' } });
            if (!bizRes.ok) bizRes = await fetch(`${API}/store/coupons/all`); 
            
            if (bizRes.ok) {
                const bizData = await bizRes.json();
                if(bizData.success) {
                    saBusinessesCache = bizData.businesses || [];
                    if(typeof filterSABizSelect === 'function') filterSABizSelect();
                    renderSABusinessesTable();
                }
            }
        } catch(e) {}

        // 3. בקשות ממתינות לאישור
        loadSAPendingRequests();

    } catch(e) { console.error('General error in loadSACommunityData:', e); }
}

// -- חיפוש חכם (Live Search) שיוך עסקים לקהילות (דרישה 4) --

function handleSmartCommSearch() {
    const input = getEl('sa-smart-comm-search');
    const resultsContainer = getEl('sa-smart-comm-results');
    const query = input.value.toLowerCase().trim();
    
    if (!query) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const filtered = saCommunitiesCache.filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.city && c.city.toLowerCase().includes(query)) ||
        (String(c.family_count) === query)
    ).slice(0, 10); // מציג עד 10 תוצאות

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">לא נמצאו קהילות תואמות.</div>';
    } else {
        resultsContainer.innerHTML = filtered.map(c => `
            <div onclick="selectSmartComm(${c.id}, '${safeStr(c.name)}')" class="p-3 border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition">
                <div class="font-bold text-slate-800 text-sm flex justify-between">
                    <span>${safeStr(c.name)}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 rounded-full flex items-center gap-1"><i class="fa-solid fa-house"></i> ${c.family_count || 0} משפחות</span>
                </div>
                <div class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-location-dot text-indigo-400"></i> אזורים: ${safeStr(c.city || 'כללי')}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

function selectSmartComm(id, name) {
    getEl('sa-link-comm').value = id;
    getEl('sa-smart-comm-search').value = '';
    getEl('sa-smart-comm-search').classList.add('hidden');
    getEl('sa-smart-comm-results').classList.add('hidden');
    
    const display = getEl('sa-selected-comm-display');
    display.querySelector('span').innerText = `קהילה נבחרה: ${name}`;
    display.classList.remove('hidden');
    
    loadCommunityBusinesses(); // מרנדר את העסקים המחוברים לקהילה זו למטה
}

function clearSmartCommSelection() {
    getEl('sa-link-comm').value = '';
    getEl('sa-selected-comm-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-comm-search');
    searchInput.classList.remove('hidden');
    searchInput.focus();
    getEl('sa-comm-biz-list').innerHTML = 'יש לבחור קהילה ממעל';
}

function handleSmartBizSearch() {
    const input = getEl('sa-smart-biz-search');
    const resultsContainer = getEl('sa-smart-biz-results');
    const query = input.value.toLowerCase().trim();
    
    if (!query) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const filtered = saBusinessesCache.filter(b => 
        (b.name && b.name.toLowerCase().includes(query)) ||
        (b.store_type && b.store_type.toLowerCase().includes(query)) // (בהנחה שנוסיף סוג בהמשך, כרגע סינון רגיל)
    ).slice(0, 10);

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">לא נמצאו עסקים תואמים.</div>';
    } else {
        resultsContainer.innerHTML = filtered.map(b => `
            <div onclick="selectSmartBiz(${b.id}, '${safeStr(b.name)}')" class="p-3 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition">
                <div class="font-bold text-slate-800 text-sm flex items-center gap-2"><i class="fa-solid fa-store text-emerald-500"></i> ${safeStr(b.name)}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

function selectSmartBiz(id, name) {
    getEl('sa-link-biz').value = id;
    getEl('sa-smart-biz-search').value = '';
    getEl('sa-smart-biz-search').classList.add('hidden');
    getEl('sa-smart-biz-results').classList.add('hidden');
    
    const display = getEl('sa-selected-biz-display');
    display.querySelector('span').innerText = `עסק נבחר: ${name}`;
    display.classList.remove('hidden');
}

function clearSmartBizSelection() {
    getEl('sa-link-biz').value = '';
    getEl('sa-selected-biz-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-biz-search');
    searchInput.classList.remove('hidden');
    searchInput.focus();
}

// -- טיפול בבקשות ממתינות --
async function loadSAPendingRequests() {
    const container = getEl('sa-pending-biz-container');
    const list = getEl('sa-pending-biz-list');
    if(!container || !list) return;

    try {
        const res = await fetch(`${API}/sa/communities/pending-businesses`);
        const data = await res.json();
        
        if (data.success && data.pending && data.pending.length > 0) {
            container.classList.remove('hidden');
            list.innerHTML = data.pending.map(p => `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex justify-between items-center hover:shadow-md transition mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">העסק: ${safeStr(p.biz_name)}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">מבקש להצטרף לקהילת: <strong>${safeStr(p.comm_name)}</strong></p>
                        <p class="text-[11px] text-green-700 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block border border-green-200">מוכן לתת ${p.discount_pct}% הנחה לחברי הקהילה</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="approveSABizRequest(${p.community_id}, ${p.business_id})" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition shadow-sm border border-slate-700"><i class="fa-solid fa-check mr-1"></i> אשר וצרף</button>
                        <button onclick="rejectSABizRequest(${p.community_id}, ${p.business_id})" class="bg-red-50 text-red-600 px-5 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition shadow-sm border border-red-100"><i class="fa-solid fa-xmark mr-1"></i> דחה בקשה</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.classList.add('hidden');
        }
    } catch(e) { console.error('Error loading pending requests', e); }
}

async function approveSABizRequest(communityId, businessId) {
    if(!confirm('האם לאשר את הצטרפות העסק לקהילה? הלקוחות יראו אותו מיד.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('success', 'העסק אושר וצורף לקהילה!'); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectSABizRequest(communityId, businessId) {
    if(!confirm('האם לדחות ולהסיר את הבקשה של העסק?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('info', 'הבקשה נדחתה והוסרה מהרשימה.'); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

// -- טבלת קהילות כולל עיר --
function renderSACommunitiesTable() {
    const tbody = getEl('sa-communities-table-body');
    if (!tbody) return;
    
    const query = getEl('sa-search-comm') ? getEl('sa-search-comm').value.toLowerCase() : '';
    const countFilter = getEl('sa-filter-comm-count') ? getEl('sa-filter-comm-count').value : 'all';
    const multiFilter = getEl('sa-filter-comm-multi') ? getEl('sa-filter-comm-multi').checked : false; 
    
    let filtered = [...saCommunitiesCache];
    
    if (query) {
        filtered = filtered.filter(c => 
            (c.name && c.name.toLowerCase().includes(query)) || 
            (c.code && c.code.toLowerCase().includes(query)) ||
            (c.city && c.city.toLowerCase().includes(query))
        );
    }
    
    if (countFilter === 'with_families') {
        filtered = filtered.filter(c => parseInt(c.family_count || 0) > 0);
    } else if (countFilter === 'empty') {
        filtered = filtered.filter(c => parseInt(c.family_count || 0) === 0);
    } else if (countFilter === 'sort_desc') {
        filtered.sort((a, b) => parseInt(b.family_count || 0) - parseInt(a.family_count || 0));
    }

    if (multiFilter) {
        filtered = filtered.filter(c => c.city && c.city.split(',').filter(x => x.trim()).length >= 2);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">לא נמצאו קהילות שמתאימות לסינון.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(c => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3">
                ${c.image_url ? `<img src="${c.image_url}" class="w-8 h-8 rounded-lg object-cover shadow-sm shrink-0">` : `<div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><i class="fa-solid fa-users"></i></div>`}
                <div>
                    ${safeStr(c.name || 'ללא שם')}
                    <div class="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1 max-w-[200px] overflow-hidden">
                        ${(c.city || 'לא הוגדר').split(',').map(city => `<span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid fa-location-dot text-orange-400"></i> ${city.trim()}</span>`).join('')}
                    </div>
                </div>
            </td>
            <td class="px-4 py-4 font-mono text-orange-600 font-bold tracking-widest text-right">${safeStr(c.code || '---')}</td>
            <td class="px-4 py-4 text-right">
                <div class="text-xs text-slate-600 mb-1"><span class="text-slate-400 font-bold ml-1">מייל:</span> ${safeStr(c.manager_email || '---')}</div>
                <div class="text-xs text-slate-600"><span class="text-slate-400 font-bold ml-1">סיסמה:</span> ${safeStr(c.manager_password || '---')}</div>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="משפחות מחוברות"><i class="fa-solid fa-house text-[10px]"></i> ${c.family_count || 0} משפחות</span>
                <span class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1" title="נפשות / משתמשים"><i class="fa-solid fa-user text-[10px]"></i> ${c.users_count || 0} משתמשים</span>
                <span class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1" title="עסקים"><i class="fa-solid fa-briefcase text-[10px]"></i> ${c.business_count || 0}</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="openSACommunityModal(${c.id})" class="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> מחיקה וניהול</button>
            </td>
        </tr>
    `).join('');
}

function filterSACommunities() { renderSACommunitiesTable(); }

async function openSACommunityModal(id) {
    const comm = saCommunitiesCache.find(c => c.id == id);
    if(!comm) return;
    
    getEl('sa-edit-comm-id').value = comm.id;
    getEl('sa-edit-comm-title').innerText = comm.name;
    getEl('sa-edit-comm-name').value = comm.name;
    getEl('sa-edit-comm-code').value = comm.code;
    getEl('sa-edit-comm-email').value = comm.manager_email;
    getEl('sa-edit-comm-pass').value = comm.manager_password;
    
    editCityTags = comm.city ? comm.city.split(',').map(c => c.trim()).filter(c => c) : [];
    updateCityTagsDisplay('edit');

    getEl('sa-edit-comm-image-base64').value = '';
    const imgPreview = getEl('sa-edit-comm-img-preview');
    const placeholder = getEl('sa-edit-comm-img-placeholder');
    if (comm.image_url) {
        imgPreview.src = comm.image_url;
        imgPreview.classList.remove('hidden');
        if(placeholder) placeholder.classList.add('hidden');
    } else {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
        if(placeholder) placeholder.classList.remove('hidden');
    }
    
    getEl('sa-edit-comm-fam-count').innerText = comm.family_count || 0;
    getEl('sa-edit-comm-biz-count').innerText = comm.business_count || 0;
    
    const searchInput = getEl('sa-search-comm-fam');
    if (searchInput) searchInput.value = '';
    
    const famList = getEl('sa-edit-comm-families');
    const bizList = getEl('sa-edit-comm-businesses');
    famList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    bizList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    
    getEl('sa-community-modal').classList.remove('hidden');
    
    try {
        const res = await fetch(`${API}/sa/communities/${id}/details`);
        const data = await res.json();
        if(data.success) {
            currentCommFamiliesCache = data.families || [];
            renderSACommFamilies();
            
            if(data.businesses.length === 0) {
                bizList.innerHTML = '<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">אין עסקים נותני הנחה.</p>';
            } else {
                bizList.innerHTML = data.businesses.map(b => `<div class="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm mb-1.5 text-xs flex justify-between items-center"><span class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-store text-slate-300"></i> ${safeStr(b.name)}</span><span class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">${b.discount_pct}% הנחה</span></div>`).join('');
            }
        }
    } catch(e) {
        famList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה בטעינה</p>';
        bizList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה בטעינה</p>';
    }
}

function renderSACommFamilies(query = '') {
    const famList = getEl('sa-edit-comm-families');
    if (!famList) return;
    
    let filtered = currentCommFamiliesCache;
    if (query) {
        const q = query.toLowerCase();
        filtered = currentCommFamiliesCache.filter(f => 
            (f.name && f.name.toLowerCase().includes(q)) || 
            (f.group_code && f.group_code.toLowerCase().includes(q))
        );
    }
    
    if (filtered.length === 0) {
        famList.innerHTML = `<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">${query ? 'לא נמצאו משפחות תואמות לחיפוש' : 'אין משפחות מחוברות לקהילה זו.'}</p>`;
        return;
    }
    
    famList.innerHTML = filtered.map(f => {
        const usersHtml = f.users && f.users.length > 0
            ? f.users.map(u => `<div class="text-[10px] text-slate-500 pl-2 pr-1 py-1.5 border-t border-slate-100 flex justify-between bg-slate-50/50 hover:bg-slate-100 transition"><span><i class="fa-solid ${u.role === 'ADMIN' ? 'fa-user-tie text-blue-400' : 'fa-user text-slate-400'} ml-1"></i> ${safeStr(u.nickname)}</span><span class="bg-white px-1.5 rounded shadow-sm">${u.role === 'ADMIN' ? 'מנהל/הורה' : 'חבר/ילד'}</span></div>`).join('')
            : '<div class="text-[10px] text-slate-400 pl-2 py-1.5 border-t border-slate-100 bg-slate-50/50">אין משתמשים פנימיים.</div>';

        const commId = getEl('sa-edit-comm-id') ? getEl('sa-edit-comm-id').value : '';
        const isManagerFamily = f.is_community_manager;
        return `
        <div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm">
            <div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')">
                <div class="flex items-center gap-2">
                    ${isManagerFamily ? '' : `<button onclick="event.stopPropagation();setSACommunityManager(${commId}, ${f.id}, true)" class="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-200 transition whitespace-nowrap">הגדר מנהל</button>`}
                    ${isManagerFamily ? `<button onclick="event.stopPropagation();setSACommunityManager(${commId}, ${f.id}, false)" class="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded hover:bg-red-100 hover:text-red-600 transition whitespace-nowrap">הסר מנהל</button>` : ''}
                </div>
                <div class="font-bold text-slate-700 flex items-center gap-2">
                    ${isManagerFamily ? '<i class="fa-solid fa-star text-purple-400 text-[10px]"></i>' : ''}
                    <i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}
                </div>
            </div>
            <div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">
                ${usersHtml}
            </div>
        </div>`;
    }).join('');
}

async function setSACommunityManager(commId, groupId, isManager) {
    try {
        const res = await fetch(`${API}/sa/communities/${commId}/set-manager`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ groupId, isManager })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', isManager ? 'המשפחה הוגדרה כמנהלת קהילה!' : 'הוסרה הרשאת מנהל קהילה');
            openSACommunityModal(commId);
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function filterSACommFamilies() {
    const query = getEl('sa-search-comm-fam') ? getEl('sa-search-comm-fam').value : '';
    renderSACommFamilies(query);
}

async function saveSACommunityEdit() {
    const id = val('sa-edit-comm-id');
    const name = val('sa-edit-comm-name');
    const code = val('sa-edit-comm-code');
    const email = val('sa-edit-comm-email');
    const pass = val('sa-edit-comm-pass');
    const cityData = val('sa-edit-comm-city-data'); 
    const imageUrl = val('sa-edit-comm-image-base64'); // משיכת התמונה אם עודכנה
    
    if(!name || !code) return showToast('error', 'שם וקוד חובה');
    if(!cityData) return showToast('error', 'חובה להגדיר לפחות אזור גאוגרפי אחד לקהילה');

    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl}) });
        if((await res.json()).success) {
            showToast('success', 'הקהילה עודכנה בהצלחה!');
            getEl('sa-community-modal').classList.add('hidden');
            loadSACommunityData();
        } else showToast('error', 'שגיאה בעדכון הקהילה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteSACommunity() {
    const id = val('sa-edit-comm-id');
    if(!confirm('אזהרה: מחיקת הקהילה תנתק את כל המשפחות והעסקים המקושרים אליה. פעולה זו בלתי הפיכה! האם להמשיך?')) return;
    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
        if((await res.json()).success) {
            showToast('success', 'הקהילה נמחקה לחלוטין!');
            getEl('sa-community-modal').classList.add('hidden');
            loadSACommunityData();
        } else showToast('error', 'שגיאה במחיקת הקהילה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function createSACommunity() {
    const name = val('sa-comm-name'); 
    const code = val('sa-comm-code'); 
    const email = val('sa-comm-email'); 
    const pass = val('sa-comm-pass');
    const cityData = val('sa-comm-city-data'); 
    const imageUrl = val('sa-comm-image-base64'); // משיכת התמונה
    
    if(!name || !code || !cityData) return showToast('error', 'שם הקהילה, ערים וקוד - שדות חובה.');
    
    const btn = document.querySelector('button[onclick="createSACommunity()"]');
    if(btn) { btn.disabled = true; btn.innerText = 'מקים...'; }
    
    try {
        const res = await fetch(`${API}/sa/communities`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl})});
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'קהילה הוקמה בהצלחה!'); 
            getEl('sa-comm-name').value=''; getEl('sa-comm-city-input').value=''; getEl('sa-comm-code').value=''; getEl('sa-comm-email').value=''; getEl('sa-comm-pass').value=''; 
            getEl('sa-comm-image-base64').value=''; const prevCont = getEl('sa-comm-img-preview-container'); if(prevCont) prevCont.classList.add('hidden');
            createCityTags = []; updateCityTagsDisplay('create');
            loadSACommunityData(); 
        } else { 
            showToast('error', data.error || 'שגיאה ביצירת הקהילה'); 
        }
    } catch(e) { 
        showToast('error', 'שגיאת תקשורת מול השרת'); 
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'הקמת קהילה'; }
    }
}
async function deleteSACommunity() {
    const id = val('sa-edit-comm-id');
    if(!confirm('אזהרה: מחיקת הקהילה תנתק את כל המשפחות והעסקים המקושרים אליה. פעולה זו בלתי הפיכה! האם להמשיך?')) return;
    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
        if((await res.json()).success) {
            showToast('success', 'הקהילה נמחקה לחלוטין!');
            getEl('sa-community-modal').classList.add('hidden');
            loadSACommunityData();
        } else showToast('error', 'שגיאה במחיקת הקהילה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function saveWelcomeMsg(type = 'FAMILY') { 
    const body = type === 'BUSINESS' ? { businessWelcomeMsg: val('sa-biz-welcome-msg') } : { welcomeMsg: val('sa-welcome-msg') };
    const btn = document.querySelector(`button[onclick="saveWelcomeMsg('${type}')"]`);
    if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try { 
        const res = await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify(body) }); 
        if ((await res.json()).success) {
            showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!'); 
        } else {
            showToast('error', 'שגיאה בשמירת ההודעה');
        }
    } catch(e) { 
        showToast('error', 'תקלת תקשורת בשמירת ההודעה'); 
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'שמור הודעה'; }
    }
}
async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=FAMILY`);
        const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) {
                getEl('welcome-modal-text').innerText = data.message;
                setupPwaInstallSection();
                getEl('welcome-modal').classList.remove('hidden');
                window.pendingWelcomeMsg = data.message;
                return true;
            }
        }
    } catch(e) {}
    return false;
}

function closeWelcomeModal() {
    getEl('welcome-modal').classList.add('hidden');
    if (window.pendingWelcomeMsg) {
        localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg);
    }
    checkAndStartTour(forceTourStart);
    forceTourStart = false;
}

function checkAndStartTour(force = false) {
    setTimeout(() => {
        try {
            const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`;
            if (force || !localStorage.getItem(tourKey)) {
                localStorage.setItem(tourKey, 'true');
                switchTab('feed');
                if (currentUser.role === 'ADMIN') startAdminTour();
                else startChildTour();
            }
        } catch(e) {}
    }, 1000);
}

function triggerManualTour() {
    getEl('profile-modal').classList.add('hidden');
    setTimeout(() => {
        switchTab('feed');
        if (currentUser.role === 'ADMIN') startAdminTour();
        else startChildTour();
    }, 300);
}

function openAlertModal(title, text) {
    const titleEl = getEl('generic-alert-title');
    const textEl = getEl('generic-alert-text');
    const modal = getEl('generic-alert-modal');
    if(titleEl && textEl && modal) {
        titleEl.innerText = title;
        textEl.innerText = text;
        modal.classList.remove('hidden');
    }
}
async function linkBizToCommunity() {
    const communityId = val('sa-link-comm'); 
    const businessId = val('sa-link-biz'); 
    let discountPct = val('sa-link-discount');
    discountPct = discountPct ? parseFloat(discountPct) : 0;
    
    if(!communityId || !businessId) return showToast('error', 'חובה לבחור קהילה ועסק');
    
    try {
        const res = await fetch(`${API}/sa/community-business`, { 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': typeof saToken !== 'undefined' ? saToken : (localStorage.getItem('saToken') || '')
            }, 
            body: JSON.stringify({ communityId, businessId, discountPct })
        });
        
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'העסק שויך לקהילה!'); 
            if(typeof loadCommunityBusinesses === 'function') loadCommunityBusinesses(); 
            if(typeof loadSACommunityData === 'function') loadSACommunityData(); 
            if(typeof clearSmartBizSelection === 'function') clearSmartBizSelection(); 
        } else { 
            showToast('error', data.error || 'שגיאה בחיבור העסק'); 
        }
    } catch(e) { 
        console.error('Network Error linking biz:', e);
        showToast('error', 'שגיאת תקשורת מול השרת'); 
    }
}

async function loadCommunityBusinesses() {
    const communityId = val('sa-link-comm');
    const list = getEl('sa-comm-biz-list');
    if(!communityId) { list.innerHTML = 'יש לבחור קהילה ממעל'; return; }
    
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2"><i class="fa-solid fa-spinner fa-spin"></i> טוען עסקים...</p>';
    try {
        const res = await fetch(`${API}/sa/community-business/${communityId}`);
        const data = await res.json();
        if(data.success) {
            if(data.connections.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">אין עסקים שנותנים הנחות לקהילה זו.</p>'; return; }
            list.innerHTML = data.connections.map(c => `
                <div class="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <span class="text-xs font-bold text-slate-700">${safeStr(c.business_name)} <span class="text-green-700 bg-green-100 px-1.5 py-0.5 rounded ml-1 text-[10px]">${c.discount_pct}% הנחה</span><span class="text-slate-400 text-[10px] pr-2">(${c.status === 'approved' ? 'אושר' : 'ממתין'})</span></span>
                    <button onclick="removeBizFromCommunity(${c.community_id}, ${c.business_id})" class="text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center transition bg-slate-50 rounded"><i class="fa-solid fa-times"></i></button>
                </div>
            `).join('');
        }
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-400 text-center py-2">שגיאה בטעינת עסקים</p>'; }
}

async function removeBizFromCommunity(commId, bizId) {
    if(!confirm('להסיר את העסק מהקהילה? הלקוחות לא יקבלו יותר את ההנחה של העסק הזה.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { showToast('success', 'העסק הוסר מהקהילה.'); loadCommunityBusinesses(); loadSACommunityData(); }
    } catch(e) {}
}

// -- ניהול עסקים כולל (דרישה 5) --
function renderSABusinessesTable() {
    const tbody = getEl('sa-businesses-table-body');
    if (!tbody) return;

    const query = getEl('sa-search-businesses') ? getEl('sa-search-businesses').value.toLowerCase() : '';
    let filtered = [...saBusinessesCache];
    
    if (query) {
        filtered = filtered.filter(b => 
            (b.name && b.name.toLowerCase().includes(query)) || 
            (b.group_code && b.group_code.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400">לא נמצאו עסקים.</td></tr>`;
        return;
    }

    // מאחר ואין לנו Endpoint שמחזיר את כל החיבורים יחד, נצטרך לעשות Fetch פר עסק בעת פתיחת המודאל.
    // בטבלה נציג נתונים כלליים ונגישות לחלון הניהול
    tbody.innerHTML = filtered.map(b => `
        <tr class="hover:bg-emerald-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right">
                ${safeStr(b.name)}
                <div class="text-[10px] text-slate-500 mt-1 font-mono">קוד: ${safeStr(b.group_code)}</div>
            </td>
            <td class="px-4 py-4 text-right">
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">עסק רשום</span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="חיבורים מנוהלים פנימה"><i class="fa-solid fa-link"></i> בדיקה בניהול</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="openSABusinessModal(${b.id})" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> ניהול חיבורים</button>
            </td>
        </tr>
    `).join('');
}

function filterSABusinessesTable() { renderSABusinessesTable(); }

async function openSABusinessModal(bizId) {
    const biz = saBusinessesCache.find(b => b.id == bizId);
    if (!biz) return;
    
    getEl('sa-edit-biz-title').innerText = biz.name;
    getEl('sa-edit-biz-code').innerText = biz.group_code;
    
    const list = getEl('sa-edit-biz-communities-list');
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> מנתח נתונים בשרת...</p>';
    
    getEl('sa-business-modal').classList.remove('hidden');

    try {
        // מכיוון שאנחנו כאדמין ראשי, יש לנו גישה לנתיב החיבורים של העסק (Biz App route)
        const res = await fetch(`${API}/biz/communities/my/${bizId}`);
        const data = await res.json();
        
        if (data.success && data.communities) {
            if (data.communities.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-white rounded-lg border border-dashed">העסק לא מחובר לאף קהילה כרגע.</p>';
            } else {
                list.innerHTML = data.communities.map(c => `
                    <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center mb-2">
                        <div>
                            <span class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</span>
                            <p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-house"></i> ${c.families_count || 0} משפחות | <span class="font-bold text-green-600">${c.discount_pct}% הנחה</span></p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-[10px] ${c.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'} px-2 py-0.5 rounded font-bold">${c.status === 'approved' ? 'מחובר ופעיל' : 'ממתין לאישור'}</span>
                            <button onclick="removeBizFromCommunityInModal(${c.id}, ${bizId})" class="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"><i class="fa-solid fa-trash"></i> נתק עסק</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch(e) {
        list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">שגיאה בטעינת נתונים</p>';
    }
}

async function removeBizFromCommunityInModal(commId, bizId) {
    if(!confirm('להסיר את העסק מהקהילה? הלקוחות לא יראו יותר את ההנחה.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { 
            showToast('success', 'העסק נותק מהקהילה בהצלחה.'); 
            openSABusinessModal(bizId); // טעינה מחדש של החלון
            loadSACommunityData(); // רענון נתוני הרקע
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

const originalLoadSADashboard = window.loadSADashboard;
if(originalLoadSADashboard && !window.saCommLoaded) {
    window.loadSADashboard = async function() {
        const userDash = document.getElementById('dashboard-container');
        if (userDash) userDash.classList.add('hidden');
        
        await originalLoadSADashboard();
        loadSACommunityData();
        
        setTimeout(() => {
            if (userDash) userDash.classList.add('hidden');
        }, 100);
    };
window.saCommLoaded = true;
}

// ==========================================
// --- ONBOARDING WIZARD (אשף הקמה למשפחה) ---
// ==========================================
let currentWizardStep = 1;
let wizardProducts = [];

function showOnboardingWizard() {
    if (document.getElementById('onboarding-wizard-modal')) {
        document.getElementById('onboarding-wizard-modal').classList.remove('hidden');
        return;
    }

    const modalHtml = `
    <div id="onboarding-wizard-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-4">
        <div class="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
            
            <div class="w-full bg-slate-100 h-1.5 shrink-0">
                <div id="wizard-progress" class="bg-indigo-600 h-1.5 transition-all duration-500" style="width: 25%;"></div>
            </div>

            <div class="bg-indigo-50 p-4 sm:p-6 text-center border-b border-indigo-100 shrink-0">
                <h2 class="text-xl sm:text-2xl font-black text-indigo-900 mb-1">ברוכים הבאים ל-Oneflow Life! 🎉</h2>
                <p class="text-indigo-600 text-xs sm:text-sm font-bold">בואו נקים את הבנק המשפחתי ב-4 צעדים קלילים</p>
            </div>

            <div class="flex-1 overflow-y-auto modal-scroll p-4 sm:p-6 bg-slate-50/50">
                <div id="wizard-step-1" class="fade-in max-w-md mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-4 text-center"><i class="fa-solid fa-house-chimney text-indigo-500"></i> המשפחה שלנו</h3>
                    <div class="space-y-4">
                        <div class="flex flex-col items-center justify-center mb-6">
                            <label class="text-xs font-bold text-slate-500 mb-2">תמונה משפחתית (אופציונלי):</label>
                            <div class="relative w-24 h-24 bg-white rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition shadow-sm overflow-hidden" onclick="document.getElementById('wizard-logo-upload').click()">
                                <img id="wizard-logo-preview" class="w-full h-full object-cover hidden">
                                <i id="wizard-logo-icon" class="fa-solid fa-camera text-2xl text-indigo-300"></i>
                            </div>
                            <input type="file" id="wizard-logo-upload" accept="image/*" class="hidden" onchange="handleWizardLogo(event)">
                            <input type="hidden" id="wizard-logo-base64">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 block mb-1">משפט מפתח / מוטו משפחתי:</label>
                            <input type="text" id="wizard-slogan" class="modern-input py-3 w-full bg-white" placeholder="משפחה שכזאת / המשפחה הכי טובה בעולם">
                        </div>
                    </div>
                </div>

                <div id="wizard-step-2" class="hidden fade-in max-w-md mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-4 text-center"><i class="fa-solid fa-piggy-bank text-indigo-500"></i> תקציב חודשי</h3>
                    <p class="text-xs text-slate-500 text-center mb-6">הגדירו מהו התקציב הפנוי או ההכנסה המשותפת שתרצו לנהל ולעקוב אחריה החודש באפליקציה.</p>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <label class="text-sm font-bold text-slate-700 block mb-2">התקציב החודשי (₪):</label>
                        <input type="number" id="wizard-initial-budget" class="modern-input py-4 text-2xl font-black text-center dir-ltr text-indigo-600 bg-indigo-50/30" placeholder="0" value="0">
                        <p class="text-[10px] text-slate-400 mt-3">* אל דאגה, תוכלו לשנות או לאפס את זה בכל רגע.</p>
                    </div>
                </div>

                <div id="wizard-step-3" class="hidden fade-in max-w-xl mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-2 text-center"><i class="fa-solid fa-boxes-stacked text-indigo-500"></i> בניית המזווה המשפחתי</h3>
                    <p class="text-xs text-slate-500 text-center mb-4">נוסיף עכשיו את המוצרים שתמיד צריכים להיות בבית. אפשר לתת ל-AI שלנו לנחש בשבילכם!</p>
                    
                    <div class="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-6">
                        <label class="text-xs font-bold text-indigo-800 block mb-2">✨ מילוי מזווה אוטומטי ב-AI</label>
                        <div class="flex gap-2">
                            <input type="text" id="wizard-ai-prompt" class="modern-input py-2.5 text-sm flex-1 bg-white" placeholder="תארו אתכם (למשל: משפחה טבעונית, או משפחה עם תינוק)">
                            <button id="btn-wizard-ai" onclick="generateWizardCatalog()" class="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm text-sm shrink-0">מלא מזווה</button>
                        </div>
                    </div>

                    <div class="bg-white border border-slate-200 p-4 rounded-2xl mb-4 shadow-sm">
                        <label class="text-xs font-bold text-slate-700 block mb-2">✍️ הוספה ידנית</label>
                        <div class="flex gap-2">
                            <input type="text" id="wiz-add-name" placeholder="שם מוצר (חלב 3%)" class="modern-input py-2 text-xs flex-1">
                            <input type="text" id="wiz-add-cat" placeholder="קטגוריה" class="modern-input py-2 text-xs w-24 shrink-0">
                            <button onclick="addWizardProduct()" class="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition text-xs shrink-0">הוסף</button>
                        </div>
                    </div>

                    <div class="flex justify-between items-center mb-2 px-1">
                        <h4 class="font-bold text-slate-700 text-sm">מוצרים במזווה (<span id="wiz-prod-count">0</span>/25):</h4>
                        <button onclick="wizardProducts=[]; renderWizardProducts();" class="text-xs text-red-500 hover:underline font-bold">נקה הכל</button>
                    </div>
                    <div id="wizard-products-list" class="space-y-2 max-h-48 overflow-y-auto modal-scroll pr-1">
                        <p class="text-xs text-slate-400 text-center py-4">אין מוצרים במזווה עדיין.</p>
                    </div>
                </div>

                <div id="wizard-step-4" class="hidden fade-in text-center max-w-md mx-auto pt-4">
                    <div class="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm border border-green-200 mx-auto">
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-xl mb-2">מזמינים את המשפחה</h3>
                    <p class="text-sm text-slate-500 mb-8">הסביבה מוכנה! שלחו עכשיו הזמנה לשאר בני הבית כדי שיתחילו לקבל דמי כיס ולעזור במשימות.</p>
                    
                    <button onclick="sendWhatsAppInvite('MEMBER')" class="w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-[#1ebd58] transition flex items-center justify-center gap-2 mb-3">
                        <i class="fa-brands fa-whatsapp text-lg"></i> הזמנת ילד/ה בוואטסאפ
                    </button>
                    <button onclick="sendWhatsAppInvite('ADMIN')" class="w-full bg-slate-100 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 mb-3">
                        <i class="fa-solid fa-user-tie text-slate-400"></i> הוספת הורה שותף
                    </button>
                </div>
            </div>

            <div class="p-4 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                <button id="wizard-btn-skip" onclick="skipWizardStep()" class="text-xs text-slate-400 font-bold hover:text-slate-600 transition underline px-2">דלג על שלב זה</button>
                <div class="flex gap-2">
                    <button id="wizard-btn-prev" onclick="prevWizardStep()" class="px-4 sm:px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition hidden">חזור</button>
                    <button id="wizard-btn-next" onclick="nextWizardStep()" class="px-6 sm:px-8 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-700 transition">המשך</button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleWizardLogo(event) {
    const file = event.target.files[0]; if(!file) return;
    compressImage(file, 300, 300, 0.8, (base64) => {
        getEl('wizard-logo-preview').src = base64;
        getEl('wizard-logo-preview').classList.remove('hidden');
        getEl('wizard-logo-icon').classList.add('hidden');
        getEl('wizard-logo-base64').value = base64;
    });
}

function addWizardProduct() {
    if (wizardProducts.length >= 25) return showToast('error', 'ניתן להוסיף עד 25 מוצרים בבת אחת.');
    const name = val('wiz-add-name'); const cat = val('wiz-add-cat') || 'כללי';
    if (!name) return showToast('error', 'יש להזין שם מוצר');
    wizardProducts.push({ name, category: cat });
    getEl('wiz-add-name').value = ''; getEl('wiz-add-cat').value = '';
    renderWizardProducts();
}

function removeWizardProduct(idx) { wizardProducts.splice(idx, 1); renderWizardProducts(); }

function renderWizardProducts() {
    const list = getEl('wizard-products-list');
    getEl('wiz-prod-count').innerText = wizardProducts.length;
    if (wizardProducts.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">המזווה ריק.</p>'; return; }
    list.innerHTML = wizardProducts.map((p, idx) => `
        <div class="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
            <div class="flex-1 pr-2 overflow-hidden">
                <div class="font-bold text-slate-700 text-sm truncate">${safeStr(p.name)}</div>
                <div class="text-[10px] text-slate-400 truncate">${safeStr(p.category)}</div>
            </div>
            <button onclick="removeWizardProduct(${idx})" class="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
    `).join('');
}

async function generateWizardCatalog() {
    const prompt = val('wizard-ai-prompt');
    if(!prompt) return showToast('error', 'רשמו למשל: משפחה של 5 נפשות שומרת כשרות');
    const btn = getEl('btn-wizard-ai'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const res = await fetch(`${API}/ai/generate-catalog`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ promptText: prompt, type: 'FAMILY', groupId: currentGroup.id })
        });
        const data = await res.json();
        if (data.success && data.items) {
            data.items.forEach(i => { if (wizardProducts.length < 25) wizardProducts.push(i); });
            renderWizardProducts(); showToast('success', 'המזווה התמלא!');
        } else { showToast('error', data.error || 'שגיאה ביצירת מזווה'); }
    } catch(e) { showToast('error', 'שגיאת רשת מול ה-AI'); }
    finally { btn.disabled = false; btn.innerText = 'מלא מזווה'; }
}

function updateWizardUI() {
    [1, 2, 3, 4].forEach(s => getEl(`wizard-step-${s}`).classList.add('hidden'));
    getEl(`wizard-step-${currentWizardStep}`).classList.remove('hidden');
    getEl('wizard-progress').style.width = `${(currentWizardStep / 4) * 100}%`;
    
    getEl('wizard-btn-prev').classList.toggle('hidden', currentWizardStep === 1);
    const btnNext = getEl('wizard-btn-next');
    if (currentWizardStep === 4) {
        btnNext.innerText = 'סיום והתחלת עבודה 🚀';
        btnNext.classList.remove('bg-slate-800'); btnNext.classList.add('bg-indigo-600');
    } else {
        btnNext.innerText = 'המשך';
        btnNext.classList.add('bg-slate-800'); btnNext.classList.remove('bg-indigo-600');
    }
}

async function nextWizardStep() {
    const btnNext = getEl('wizard-btn-next');
    
    if (currentWizardStep === 1) { // שמירת לוגו וסלוגן
        btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            // משתמש ב-Settings Store סתם כדי לשמור את התמונה והסלוגן המשפחתי גם אם זה Family
            await fetch(`${API}/store/settings`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ groupId: currentGroup.id, isActive: false, slogan: val('wizard-slogan'), logoUrl: val('wizard-logo-base64') || null })
            });
        } catch(e) {}
    }
    
    else if (currentWizardStep === 2) { // שמירת תקציב התחלתי
        const budget = parseFloat(val('wizard-initial-budget')) || 0;
        if (budget > 0) {
            btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                await fetch(`${API}/transaction`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId: currentUser.id, amount: budget, description: 'תקציב התחלתי פנוי', category: 'salary', type: 'income', groupId: currentGroup.id })
                });
            } catch(e) {}
        }
    }
    
    else if (currentWizardStep === 3) { // העלאת מוצרי מזווה
        if (wizardProducts.length > 0) {
            btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ממלא מזווה...';
            try {
                for (let p of wizardProducts) {
                    await fetch(`${API}/pantry/add`, {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ groupId: currentGroup.id, itemName: p.name, quantity: 1, unit: "יח'", unitsPerPackage: 1 })
                    });
                }
            } catch(e) {}
        }
    }
    
   else if (currentWizardStep === 4) { // סיום
        btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מסיים...';
        try {
            await fetch(`${API}/groups/onboard`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) });
            currentGroup.is_onboarded = true;
            localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup})); // <-- התיקון למניעת קפיצה!
            getEl('onboarding-wizard-modal').classList.add('hidden');
            triggerConfetti(); fetchData();
        } catch(e) {}
        return;
    }
    currentWizardStep++;
    updateWizardUI();
}

function prevWizardStep() {
    if (currentWizardStep > 1) { currentWizardStep--; updateWizardUI(); }
}

function skipWizardStep() {
    if (currentWizardStep === 4) nextWizardStep(); // סיום
    else { currentWizardStep++; updateWizardUI(); }
}

// --- ניהול תמונת זהות משפחתית ---
window.handleFamilyPhotoUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showToast('info', 'מעלה ומעבד תמונה...');
    compressImage(file, 600, 600, 0.8, async (base64) => {
        
        // 1. תצוגה מיידית למשתמש ושמירה במטמון לפני תשובת שרת
        if (currentGroup) currentGroup.logo_url = base64;
        const headerImg = getEl('header-group-img');
        const headerFallback = getEl('header-group-icon-fallback');
        const mgmtImg = getEl('mgmt-group-logo-preview');
        const mgmtIcon = getEl('mgmt-group-logo-icon');

        if (headerImg) { headerImg.src = base64; headerImg.classList.remove('hidden'); }
        if (headerFallback) headerFallback.classList.add('hidden');
        if (mgmtImg) { mgmtImg.src = base64; mgmtImg.classList.remove('hidden'); }
        if (mgmtIcon) mgmtIcon.classList.add('hidden');

        // 2. שמירה בשרת
        try {
            const res = await fetch(`${API}/store/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: currentGroup.id,
                    logoUrl: base64,
                    isActive: true
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', 'תמונת המשפחה עודכנה בהצלחה!');
            } else {
                showToast('error', 'שגיאה בשמירת התמונה בשרת');
            }
        } catch (e) {
            showToast('error', 'תקלת רשת בעדכון תמונה');
        }
    });
};

// =====================================
// ניהול הרשאות ופיצ'רים (Feature Flags)
// =====================================
const ALL_TABS = [
    { id: 'feed', name: 'ראשי 🏠' },
    { id: 'tasks', name: 'משימות הבית ✅' },
    { id: 'shop', name: 'רשימת סופר 🛒' },
    { id: 'myorders', name: 'משלוחים 🛵' },
    { id: 'bank', name: 'הבנק המשפחתי 🏦' },
    { id: 'cashflow', name: 'תזרים עו"ש 💸' },
    { id: 'community', name: 'קהילה מקומית 🏘️' },
    { id: 'academy', name: 'לומדות חינוך 🎓' },
    { id: 'members', name: 'ניהול משפחה 👨‍👩‍👧‍👦' },
    { id: 'budget', name: 'ניהול תקציב 📊' },
    { id: 'pantry', name: 'ניהול מזווה 📦' },
    { id: 'recipes', name: 'שף פרטי 👨‍🍳' },
    { id: 'forecast', name: 'תשקיף כלכלי 📅' },
    { id: 'home-maintenance', name: 'ניהול הבית 🔧' }
];

const ROLE_DEFAULTS = {
    'ADMIN': ALL_TABS.map(t => t.id),
    'MANAGER': ['feed', 'tasks', 'shop', 'pantry', 'academy', 'recipes', 'home-maintenance'],
    'SENIOR': ['feed', 'tasks', 'shop', 'pantry', 'academy'],
    'MEMBER': ['feed', 'tasks', 'shop', 'academy']
};

function enforcePermissions() {
    if (!currentUser || !currentGroup) return;
    const isAdmin = currentUser.role === 'ADMIN';
    let userTabs = [];
    try {
        const perms = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
        userTabs = perms.tabs || ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER'];
    } catch(e) { userTabs = ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER']; }

    // קריאת הרשאות הפיצ'רים מהסופר-אדמין (Feature Flags)
    // במערכת המשפחתית שמות המודולים טיפה שונים, אנחנו עושים תאימות:
    let features = { store: true, academy: true, calendar: true, finance: true, inventory: true, crm: true, deliveries: true, ai: true, cashflow: true, budget: true, forecast: true, tasks: true, community: true, members: true, recipes: true };
    
    if (currentGroup.features) {
        try { features = typeof currentGroup.features === 'string' ? JSON.parse(currentGroup.features) : currentGroup.features; } catch(e) {}
    }

    // 1. הסתרה מוחלטת לפי תפקיד הילד/הורה (Role) - מבוצע רק עבור מי שאינו הורה מנהל
    ALL_TABS.forEach(tab => {
        const btn = getEl(`tab-${tab.id}`);
        if(btn) {
            if (userTabs.includes(tab.id) || isAdmin) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    });

    // 2. אכיפת מנעולים (Feature Flags) שנסגרו ע"י הסופר-אדמין לכלל המשפחה
    const enforceModule = (flag, tabId, moduleName) => {
        const btn = getEl(`tab-${tabId}`);
        if (!btn || btn.style.display === 'none') return; 
        
        const isModuleActive = flag !== undefined ? flag : true;

        if (!isModuleActive) {
            // המודול ננעל - הופכים לאפור ושמים מנעול
            btn.classList.add('locked-module', 'opacity-60', 'grayscale');
            btn.dataset.lockedName = moduleName;
            if (!btn.querySelector('.fa-lock')) {
                btn.innerHTML = `<i class="fa-solid fa-lock text-red-500 ml-1"></i> ` + btn.innerHTML;
            }
        } else {
            // שחרור מנעול
            btn.classList.remove('locked-module', 'opacity-60', 'grayscale');
            const lockIcon = btn.querySelector('.fa-lock');
            if (lockIcon) lockIcon.remove();
        }
    };

    // הפעלת האכיפה לפי המודולים במסך העריכה באדמין:
    enforceModule(features.store, 'shop', 'רשימת קניות חכמה');
    enforceModule(features.academy, 'academy', 'מרכז הכשרות ואתגרים');
    enforceModule(features.finance, 'bank', 'הבנק המשפחתי ודמי כיס');
    enforceModule(features.inventory, 'pantry', 'ניהול מלאי בבית');
    enforceModule(features.crm, 'myorders', 'הזמנות מקהילות'); 
    enforceModule(features.cashflow, 'cashflow', 'מעקב תזרים הוצאות');
    enforceModule(features.budget, 'budget', 'תקציבים ויעדים לילדים');
    enforceModule(features.forecast, 'forecast', 'תשקיף משפחתי עתידי');
    enforceModule(features.tasks, 'tasks', 'ניהול משימות וצ\'ופרים');
    enforceModule(features.community, 'community', 'חיבור לקהילות שכונתיות');
    enforceModule(features.members, 'members', 'ניהול משתמשי המשפחה');
    // פוד קוסט של עסקים, מתורגם למתכונים אצל משפחות:
    enforceModule(features.foodcost, 'recipes', 'מתכונים חכמים ממלאי'); 
 
    // הגבלת אלמנטים של העוזרת הווירטואלית AI
    const aiBtnMain = getEl('btn-global-ai');
    if (features.ai !== undefined && !features.ai) {
        if (aiBtnMain) aiBtnMain.style.display = 'none';
        document.querySelectorAll('.fa-wand-magic-sparkles').forEach(icon => {
            const parentBtn = icon.closest('button');
            if (parentBtn && !parentBtn.classList.contains('locked-module')) {
                parentBtn.classList.add('opacity-50', 'grayscale', 'cursor-not-allowed');
                parentBtn.onclick = (e) => { e.stopPropagation(); openLockedModuleModal('כלי בינה מלאכותית חכמים'); };
            }
        });
    }

    // וידוא שהמשתמש לא תקוע בטאב נעול
    const activeTabs = document.querySelectorAll('.tab-active');
    activeTabs.forEach(activeBtn => {
        if (activeBtn.style.display === 'none' || activeBtn.classList.contains('locked-module')) {
            if(activeBtn.id !== 'tab-feed') switchTab('feed');
        }
    });
    try { updateFamilyGroupNavVisibility(); } catch(e) {}
}

// =====================================
// מודול Upsell וחלון מודול נעול
// =====================================
window.openLockedModuleModal = function(moduleName) {
    let modal = getEl('locked-module-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'locked-module-modal';
        modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative text-center border border-slate-100">
                <button onclick="document.getElementById('locked-module-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 bg-slate-50 rounded-full transition border border-slate-100"><i class="fa-solid fa-xmark"></i></button>
                <div class="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl shadow-inner border border-slate-200">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">פיצ'ר נעול 🔒</h3>
                <p class="text-sm text-slate-500 mb-8 leading-relaxed">היכולת להשתמש ב-<strong id="locked-module-name" class="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"></strong> סגורה בחבילה הנוכחית שלכם.<br>רוצים לפתוח את הנעילה ולהרחיב את המערכת?</p>
                <button id="btn-req-unlock" class="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                    שליחת בקשה לשדרוג חבילה <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    getEl('locked-module-name').innerText = moduleName;
    const btn = getEl('btn-req-unlock');
    btn.onclick = () => requestModuleUnlock(moduleName);
    
    modal.classList.remove('hidden');
};

window.requestModuleUnlock = async function(moduleName) {
    const btn = getEl('btn-req-unlock');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח פנייה...';
    
    try {
        const payload = {
            groupId: currentGroup.id,
            groupName: currentGroup.name,
            userId: currentUser.id,
            userName: currentUser.nickname,
            userEmail: currentGroup.admin_email || 'לא ידוע',
            subject: `בקשת שדרוג חבילה / משפחה: פתיחת ${moduleName}`,
            description: `היי צוות, אשמח לקבל פרטים ועלויות לגבי הוספת המודול "${moduleName}" למערכת המשפחתית שלנו. אנא צרו איתי קשר.`
        };

        const res = await fetch(`${API}/support/ticket`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('success', 'מעולה! שלחנו פנייה לצוות. נחזור אליכם בהקדם האפשרי.');
            getEl('locked-module-modal').classList.add('hidden');
            try { triggerConfetti(); } catch(e){}
        } else {
            showToast('error', data.error || 'שגיאה בשליחת הפנייה');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת. נסו שוב מאוחר יותר.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת בקשה לשדרוג חבילה <i class="fa-solid fa-paper-plane"></i>';
    }
};

// יירוט לחיצות על טאבים נעולים (כדי שלא יכנסו לעמוד ריק)
if (!window.switchTabOverridden) {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        const targetBtn = document.getElementById(`tab-${tabId}`);
        if (targetBtn && targetBtn.classList.contains('locked-module')) {
            const modName = targetBtn.dataset.lockedName || 'מודול נעול';
            if(typeof openLockedModuleModal === 'function') openLockedModuleModal(modName);
            return; // מונע כניסה למסך
        }
        originalSwitchTab(tabId);
        setTimeout(enforcePermissions, 50);
    };
    window.switchTabOverridden = true;
}

// קריאה ראשונית כשכל הדף נטען
setTimeout(enforcePermissions, 1500);

// ============================================================
// --- FAMILY GROUP NAV ---
// ============================================================
const FAMILY_GNAV_GROUPS = {
    home:   ['shop', 'myorders', 'pantry', 'recipes', 'home-maintenance'],
    money:  ['bank', 'cashflow', 'budget', 'forecast'],
    family: ['tasks', 'academy', 'community', 'members']
};

const _fgnavOriginalParents = {};

window.toggleFamilyNavDropdown = function(group) {
    const dd = document.getElementById(`fgnav-dropdown-${group}`);
    if (!dd) return;
    const isOpen = !dd.classList.contains('hidden');
    window.closeFamilyNavDropdowns();
    if (isOpen) return;

    const btn = document.getElementById(`fgnav-group-${group}`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    if (!_fgnavOriginalParents[group]) _fgnavOriginalParents[group] = dd.parentElement;
    document.body.appendChild(dd);

    const ddWidth = 170;
    let leftPos = rect.left;
    if (leftPos + ddWidth > window.innerWidth - 8) leftPos = window.innerWidth - ddWidth - 8;
    if (leftPos < 8) leftPos = 8;

    dd.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${leftPos}px; right:auto; z-index:99999;`;
    dd.classList.remove('hidden');
};

window.closeFamilyNavDropdowns = function() {
    Object.keys(FAMILY_GNAV_GROUPS).forEach(g => {
        const dd = document.getElementById(`fgnav-dropdown-${g}`);
        if (!dd) return;
        dd.classList.add('hidden');
        dd.removeAttribute('style');
        const orig = _fgnavOriginalParents[g];
        if (orig && dd.parentElement !== orig) orig.appendChild(dd);
    });
};

function updateFamilyGroupNavActiveState(tabId) {
    const feedBtn = document.getElementById('fgnav-btn-feed');
    if (feedBtn) {
        feedBtn.className = tabId === 'feed'
            ? 'fgnav-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 transition-all duration-150'
            : 'fgnav-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150';
    }
    let activeGroup = null;
    for (const [g, tabs] of Object.entries(FAMILY_GNAV_GROUPS)) {
        if (tabs.includes(tabId)) { activeGroup = g; break; }
    }
    Object.keys(FAMILY_GNAV_GROUPS).forEach(g => {
        const btn = document.getElementById(`fgnav-btn-${g}`);
        if (!btn) return;
        btn.classList.toggle('bg-indigo-600', g === activeGroup);
        btn.classList.toggle('text-white', g === activeGroup);
        btn.classList.toggle('text-slate-400', g !== activeGroup);
    });
}

function updateFamilyGroupNavVisibility() {
    Object.entries(FAMILY_GNAV_GROUPS).forEach(([g, tabs]) => {
        const groupEl = document.getElementById(`fgnav-group-${g}`);
        if (!groupEl) return;
        const hasVisible = tabs.some(id => {
            const btn = document.getElementById(`tab-${id}`);
            return btn && btn.style.display !== 'none';
        });
        groupEl.style.display = hasVisible ? '' : 'none';
    });
}

function syncFamilyBellBadge() {
    const src  = document.getElementById('bell-badge');
    const dest = document.getElementById('fgnav-bell-badge');
    if (!src || !dest) return;
    const hidden = src.classList.contains('hidden');
    dest.classList.toggle('hidden', hidden);
    if (!hidden) dest.textContent = src.textContent;
}

function updateFamilyNavBadges() {
    const isAdmin = currentUser?.role === 'ADMIN';
    const homeCount = isAdmin
        ? (shoppingListCache || []).filter(i => i.status === 'pending_approval').length
        : (allTasks || []).filter(t => t.status === 'pending' && String(t.assigned_to) === String(currentUser?.id)).length;
    const homeBadge = document.getElementById('fgnav-badge-home');
    if (homeBadge) { homeBadge.textContent = homeCount > 9 ? '9+' : homeCount; homeBadge.classList.toggle('hidden', homeCount === 0); }

    const familyCount = isAdmin
        ? (allTasks || []).filter(t => t.status === 'completed' || t.status === 'done').length
        : (bundlesCache || []).filter(b => b.status === 'assigned').length;
    const familyBadge = document.getElementById('fgnav-badge-family');
    if (familyBadge) { familyBadge.textContent = familyCount > 9 ? '9+' : familyCount; familyBadge.classList.toggle('hidden', familyCount === 0); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// סגירת dropdown בלחיצה מחוץ לנאב
document.addEventListener('click', function(e) {
    if (e.target.closest('#family-group-nav')) return;
    const inDropdown = Object.keys(FAMILY_GNAV_GROUPS).some(g => {
        const dd = document.getElementById(`fgnav-dropdown-${g}`);
        return dd && !dd.classList.contains('hidden') && dd.contains(e.target);
    });
    if (!inDropdown) window.closeFamilyNavDropdowns?.();
});

// עטיפת switchTab לעדכון group nav
(function() {
    const _prev = window.switchTab;
    window.switchTab = function(tabId) {
        _prev(tabId);
        try { updateFamilyGroupNavActiveState(tabId); closeFamilyNavDropdowns(); syncFamilyBellBadge(); } catch(e) {}
    };
})();

// הוספת מזהה גרסה בתחתית המסך
(function addVersionBadge() {
    if (!document.getElementById('oneflow-version-badge')) {
        const badge = document.createElement('div');
        badge.id = 'oneflow-version-badge';
        badge.innerHTML = 'גרסה 2.1.8 (סנכרון מלא לסופר-אדמין ושליטה בחבילות)';
        badge.className = 'w-full text-center mt-8 pb-4 text-slate-400 text-xs font-mono';
        document.body.appendChild(badge);
    }
})();
// =========================================================
// --- מנגנון מיתוג גלובלי ומסך התחברות חכם ---
// =========================================================

window.loginSliderInterval = null;
window.currentLoginSlideIndex = 0;

window.initPublicConfig = async function() {
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/system/public-config`);
        const data = await res.json();
        
        if (data.success) {
            if (data.globalAiLogo) {
                // 1. שמירה במשתנה גלובלי לכל המערכת
                window.currentFamilaiLogo = data.globalAiLogo;

                // 2. עדכון סמל הדפדפן (Favicon)
                const link = document.querySelector("link[rel~='icon']");
                if (link) link.href = data.globalAiLogo;
                document.querySelectorAll("link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach(l => l.href = data.globalAiLogo);

                // 2b. עדכון og:image לשיתוף וואצאפ/סושיאל
                ['og:image','og:image:secure_url'].forEach(prop => {
                    const m = document.querySelector(`meta[property="${prop}"]`);
                    if (m) m.content = data.globalAiLogo;
                });

                // 3. עדכון בועת העוזרת החכמה המרחפת!
                // מאתרים את כל הכפתורים שמפעילים את מודאל ה-AI
                const aiTriggers = document.querySelectorAll('[onclick*="openFamilaiChatModal"]');
                aiTriggers.forEach(trigger => {
                    // מחפשים את תגית התמונה שבתוך הבועה (כרגע logo.png) ומחליפים אותה
                    const img = trigger.querySelector('img');
                    if (img) {
                        img.src = data.globalAiLogo;
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '50%';
                    }
                });
            }

            // בניית קרוסלת ההתחברות (Login Slider)
            if (data.loginSlides && data.loginSlides.length > 0) {
                const scroll = document.getElementById('login-slider-scroll');
                const dots = document.getElementById('login-slider-dots');
                
                if (scroll && dots) {
                    scroll.classList.remove('overflow-x-auto');
                    scroll.classList.add('overflow-hidden');
                    scroll.style.overflow = 'hidden';
                    scroll.style.touchAction = 'none'; 
                    
                    let slidesHtml = '';
                    let dotsHtml = '';
                    
                    data.loginSlides.forEach((slide, idx) => {
                        slidesHtml += `
                        <div class="min-w-full w-full h-full shrink-0 snap-center relative flex justify-center items-center">
                            <img src="${slide.image}" class="w-full h-full object-cover z-0 pointer-events-none select-none">
                        </div>`;
                        dotsHtml += `<button onclick="window.goToLoginSlide(${idx}, ${data.loginSlides.length})" id="login-dot-${idx}" class="rounded-full transition-all duration-300 ${idx === 0 ? 'bg-white w-5 h-2' : 'bg-white/40 hover:bg-white/80 w-2 h-2'} shadow-sm backdrop-blur-sm border border-black/10 z-30 relative focus:outline-none"></button>`;
                    });
                    
                    scroll.innerHTML = slidesHtml;
                    dots.innerHTML = data.loginSlides.length > 1 ? dotsHtml : ''; 
                    
                    if (data.loginSlides.length > 1) {
                        window.startLoginAutoScroll(data.loginSlides.length);
                    }
                }
            }
        }
    } catch(e) { console.error('Failed to load public config', e); }
};
window.startLoginAutoScroll = function(total) {
    if (window.loginSliderInterval) clearInterval(window.loginSliderInterval);
    window.loginSliderInterval = setInterval(() => {
        window.currentLoginSlideIndex++;
        if (window.currentLoginSlideIndex >= total) {
            window.currentLoginSlideIndex = 0;
        }
        window.goToLoginSlide(window.currentLoginSlideIndex, total);
    }, 4500); 
};

window.goToLoginSlide = function(index, totalSlides) {
    window.currentLoginSlideIndex = index;
    const scroll = document.getElementById('login-slider-scroll');
    if (scroll) {
        const w = scroll.clientWidth;
        const isRTL = window.getComputedStyle(scroll).direction === 'rtl';
        scroll.scrollTo({ left: index * w * (isRTL ? -1 : 1), behavior: 'smooth' });
    }
    
    const dotsDiv = document.getElementById('login-slider-dots');
    const total = totalSlides || (dotsDiv ? dotsDiv.children.length : 0);
    window.updateLoginDots(total);
    
    if (total > 1) {
        window.startLoginAutoScroll(total);
    }
};

window.updateLoginDots = function(total) {
    for (let i = 0; i < total; i++) {
        const dot = document.getElementById(`login-dot-${i}`);
        if (dot) {
            dot.className = `rounded-full transition-all duration-300 shadow-sm backdrop-blur-sm border border-black/10 z-30 relative focus:outline-none ${i === window.currentLoginSlideIndex ? 'bg-white w-5 h-2' : 'bg-white/40 hover:bg-white/80 w-2 h-2'}`;
        }
    }
};

// הפעלה בעת טעינת החלון
window.addEventListener('load', () => {
    setTimeout(() => {
        window.initPublicConfig();
    }, 200);
});

// ==========================================
// פניות שירות ותמונות משפחה - גרסה סופית ותקינה
// ==========================================
window.renderGroupInfo = function() {
    if (!currentGroup) return;
    
    const nameEl = document.getElementById('dash-group-name');
    if (nameEl) {
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
        nameEl.innerHTML = `${safeStr(currentGroup.name)} ${codeBadge}`;
    }

    const logo = currentGroup.logo || currentGroup.logo_url || currentGroup.image_url;
    const headerImg = document.getElementById('header-group-img');
    const headerFallback = document.getElementById('header-group-icon-fallback');
    const mgmtPreview = document.getElementById('mgmt-group-logo-preview');
    const mgmtIcon = document.getElementById('mgmt-group-logo-icon');

    // התיקון: בדיקה הרבה יותר סלחנית כדי שהתמונה תוצג תמיד
    if (logo && logo.length > 50) { 
        if (headerImg) { headerImg.src = logo; headerImg.classList.remove('hidden'); }
        if (headerFallback) headerFallback.classList.add('hidden');
        if (mgmtPreview) { mgmtPreview.src = logo; mgmtPreview.classList.remove('hidden'); }
        if (mgmtIcon) mgmtIcon.classList.add('hidden');
    } else {
        if (headerImg) headerImg.classList.add('hidden');
        if (headerFallback) headerFallback.classList.remove('hidden');
        if (mgmtPreview) mgmtPreview.classList.add('hidden');
        if (mgmtIcon) mgmtIcon.classList.remove('hidden');
    }
};

window.openTicketsModal = function() {
    const modal = document.getElementById('tickets-modal');
    if (modal) modal.classList.remove('hidden');
    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!token || !currentGroup) return;

        const res = await fetch(`${API}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;

        if (data.success) {
            if (!data.tickets || data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-lg border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-slate-800 text-sm">${t.subject}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2">${t.content}</p>
                    ${t.admin_reply ? `<div class="bg-slate-50 p-2 rounded text-xs border border-slate-100"><strong class="text-blue-600">תשובת צוות:</strong> ${t.admin_reply}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets', err);
    }
};

window.submitTicket = async function() {
    const subjectEl = document.getElementById('ticket-subject');
    const contentEl = document.getElementById('ticket-content');
    
    if (!subjectEl || !contentEl) return;

    const subject = subjectEl.value;
    const content = contentEl.value;
    
    if (!subject || !content) {
        if (typeof showToast === 'function') showToast('error', 'נא למלא נושא ותוכן פנייה');
        return;
    }
    
    try {
        const token = localStorage.getItem('ofl_token');
        const res = await fetch(`${API}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ 
                groupId: currentGroup.id, 
                userId: currentUser.id, 
                subject: subject, 
                content: content 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            if (typeof showToast === 'function') showToast('success', 'הפנייה נשלחה בהצלחה!');
            subjectEl.value = '';
            contentEl.value = '';
            const modal = document.getElementById('tickets-modal');
            if (modal) modal.classList.add('hidden');
            if (typeof fetchMyTickets === 'function') fetchMyTickets();
        }
    } catch (err) { 
        console.error('Error submitting ticket:', err); 
    }
};
window.previewFamilyPhoto = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    compressImage(file, 600, 600, 0.8, (base64) => {
        window.tempFamilyLogoBase64 = base64;
        
        // תצוגה מקדימה חיה
        const confirmPreview = document.getElementById('photo-confirm-preview');
        if (confirmPreview) confirmPreview.src = base64;
        
        const confirmModal = document.getElementById('photo-confirm-modal');
        if (confirmModal) confirmModal.classList.remove('hidden');
    });
    event.target.value = '';
};

window.cancelFamilyPhoto = function() {
    window.tempFamilyLogoBase64 = null;
    document.getElementById('photo-confirm-modal').classList.add('hidden');
};

window.saveFamilyPhoto = async function() {
    if (!window.tempFamilyLogoBase64) return;
    const btn = document.getElementById('btn-modal-save-photo');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שומר...'; }
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/groups/${currentGroup.id}/logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ logo: window.tempFamilyLogoBase64 })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', 'התמונה נשמרה בהצלחה!');
            const modal = document.getElementById('photo-confirm-modal');
            if (modal) modal.classList.add('hidden');
            
            currentGroup.logo = window.tempFamilyLogoBase64;
            currentGroup.image_url = window.tempFamilyLogoBase64;
            
            // גיבוי קשיח ואגרסיבי לזיכרון המקומי כדי שהתמונה תשרוד גם אם השרת לא מחזיר אותה
            localStorage.setItem(`ofl_hard_logo_${currentGroup.id}`, window.tempFamilyLogoBase64);
            localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup}));
            
            if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo(); 
        } else {
            showToast('error', 'שגיאה בשמירה בשרת');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'שמור תמונה'; }
    }
};

window.openPermissionsModal = function(userId, userName, encodedPermsStr) {
    document.getElementById('perms-user-id').value = userId;
    document.getElementById('perms-user-name').innerText = userName;
    
    let userTabs = [];
    try {
        const decodedStr = decodeURIComponent(encodedPermsStr);
        const p = JSON.parse(decodedStr);
        userTabs = p.tabs || [];
    } catch(e) {
        userTabs = ['feed']; 
    }
    
    const container = document.getElementById('perms-checkboxes');
    container.innerHTML = ALL_TABS.map(tab => {
        const isFeed = tab.id === 'feed';
        const isChecked = isFeed || userTabs.includes(tab.id);
        return `
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 transition">
            <input type="checkbox" value="${tab.id}" class="perm-cb w-4 h-4 accent-blue-600 rounded" ${isChecked ? 'checked' : ''} ${isFeed ? 'disabled' : ''}>
            <span class="text-sm font-bold text-slate-700">${tab.name}</span>
        </label>
        `;
    }).join('');
    
    document.getElementById('permissions-modal').classList.remove('hidden');
};

window.savePermissions = async function() {
    const userId = document.getElementById('perms-user-id').value;
    const cbs = document.querySelectorAll('.perm-cb');
    const selectedTabs = Array.from(cbs).filter(cb => cb.checked || cb.disabled).map(cb => cb.value);
    
    const btn = document.getElementById('btn-save-perms');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שומר...';
    
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/users/${userId}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ tabs: selectedTabs })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הרשאות עודכנו בהצלחה!');
            document.getElementById('permissions-modal').classList.add('hidden');
            fetchMembers(); 
        } else {
            showToast('error', data.error || 'שגיאה בעדכון הרשאות');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerText = 'שמור הרשאות';
    }
};
// ==========================================
// OVERRIDE: תצוגת קריאות שירות (תמיכה) למשפחה
// ==========================================

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!token || !currentGroup) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-lg border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-slate-800 text-sm">${t.subject}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2">${t.content}</p>
                    ${t.admin_reply ? `<div class="bg-slate-50 p-2 rounded text-xs border border-slate-100"><strong class="text-blue-600">תשובת צוות:</strong> ${t.admin_reply}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets:', err);
    }
};

window.submitTicket = async function(event) {
    if (event) event.preventDefault();
    const subjectEl = document.getElementById('ticket-subject');
    const contentEl = document.getElementById('ticket-content');
    
    if (!subjectEl || !contentEl) return;
    const subject = subjectEl.value;
    const content = contentEl.value;
    
    if (!subject || !content) {
        if (typeof showToast === 'function') showToast('error', 'נא למלא נושא ותוכן פנייה');
        return;
    }

    const btn = event && event.currentTarget ? event.currentTarget : document.querySelector('#tickets-modal button.bg-blue-600');
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';
        btn.disabled = true;
    }
    
    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ 
                group_id: currentGroup.id, 
                user_id: currentUser.id, 
                subject: subject, 
                content: content 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            if (typeof showToast === 'function') showToast('success', 'הפנייה נשלחה בהצלחה!');
            subjectEl.value = '';
            contentEl.value = '';
            fetchMyTickets(); // רענן מיד את הרשימה להצגת הקריאה החדשה למשפחה
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch (err) { 
        console.error('Error submitting ticket:', err); 
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// האזנה חכמה לפתיחת המודאל מכל מקום במסך - מושך את הקריאות מיד עם פתיחת החלונית
document.addEventListener('click', (e) => {
    if (e.target.closest('[onclick*="tickets-modal"]')) {
        setTimeout(() => {
            const modal = document.getElementById('tickets-modal');
            if(modal && !modal.classList.contains('hidden')) {
                if (typeof fetchMyTickets === 'function') fetchMyTickets();
            }
        }, 100);
    }
});
// ==========================================
// OVERRIDE FINAL: פתרון תצוגת הקריאות למשפחה בחלונית
// ==========================================

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        // בחירת נתיב API מדויק כדי למנוע שגיאות ניתוב (404) גם בלוקאל וגם בפרודקשן
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            // בניית ה-HTML של הקריאות והזרקתן לחלונית
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-xl border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'} mb-2 shadow-sm transition hover:shadow-md">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm"><i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> ${safeStr(t.subject)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed">${safeStr(t.content)}</p>
                    ${t.admin_reply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> תשובת צוות תמיכה:</strong>${safeStr(t.admin_reply)}</div>` : ''}
                </div>
            `).join('');
        } else {
             list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

// וידוא שהרשימה נטענת אוטומטית ברגע שהלקוח לוחץ על כפתור פתיחת מודאל התמיכה (האוזניות)
const _originalOpenTicketsModal = window.openTicketsModal;
window.openTicketsModal = function() {
    if (typeof _originalOpenTicketsModal === 'function') _originalOpenTicketsModal();
    else {
        const modal = document.getElementById('tickets-modal');
        if (modal) modal.classList.remove('hidden');
    }
    // קריאה לרענון הרשימה מיד עם פתיחת החלון
    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};
// ==========================================
// OVERRIDE FINAL: ניהול פניות מתקדם למשפחות (נושאים + שרשור צ'אט)
// ==========================================

// משכתב את פונקציית פתיחת המודאל כדי להזריק רשימת בחירת נושאים במקום טקסט חופשי
window.openTicketsModal = function() {
    const modal = document.getElementById('tickets-modal');
    if (modal) modal.classList.remove('hidden');
    
    const subjInput = document.getElementById('ticket-subject');
    if (subjInput && subjInput.tagName === 'INPUT') {
        const select = document.createElement('select');
        select.id = 'ticket-subject';
        select.className = subjInput.className;
        select.innerHTML = `
            <option value="" disabled selected>בחרו נושא פנייה...</option>
            <option value="בעיה טכנית / באג">בעיה טכנית / באג</option>
            <option value="שאלה לגבי שימוש באפליקציה">שאלה לגבי שימוש באפליקציה</option>
            <option value="בקשה להוספת פיצ'ר">בקשה להוספת פיצ'ר</option>
            <option value="ניהול מנוי ותשלומים">ניהול מנוי ותשלומים</option>
            <option value="אחר">אחר</option>
        `;
        subjInput.parentNode.replaceChild(select, subjInput);
    }

    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        // מושכים מהנתיב המלא של support_tickets שמחזיר גם את הלוג של השיחה!
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            // שומרים זמנית את הפניות כדי שנוכל לפתוח אותן בפירוט
            window.familyTicketsCache = data.tickets; 
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                // מחפשים תגובה אחרונה של איש צוות
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm"><i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> ${safeStr(t.subject)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        } else {
             list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden')" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה למנהלי המערכת..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    // גוללים למטה כדי לראות את ההודעה האחרונה
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
};

window.replyFamilyTicket = async function(id) {
    const input = document.getElementById('family-ticket-reply-text');
    const text = input.value.trim();
    if(!text) return typeof showToast === 'function' ? showToast('error', 'נא לכתוב תגובה') : alert('נא לכתוב תגובה');
    
    const btn = document.getElementById('btn-family-ticket-reply');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
            body: JSON.stringify({ 
                message: text, 
                userName: currentUser ? currentUser.nickname : 'לקוח', 
                isStaff: false 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            input.value = '';
            if (typeof showToast === 'function') showToast('success', 'התגובה נשלחה לצוות');
            await fetchMyTickets(); 
            openFamilyTicket(id); 
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i>';
    }
};
// ==========================================
// OVERRIDE FINAL: מנגנון התראות על תגובות מצוות התמיכה (משפחות)
// ==========================================

// פונקציות עזר לשמירת מצב הקריאה בדפדפן (מי קרא איזו קריאה וכמה הודעות היו בה)
window.getReadTicketsState = function() {
    try { return JSON.parse(localStorage.getItem('ofl_tickets_read_state')) || {}; } 
    catch(e) { return {}; }
};

window.markTicketAsRead = function(ticketId, logLength) {
    const state = window.getReadTicketsState();
    state[ticketId] = logLength;
    localStorage.setItem('ofl_tickets_read_state', JSON.stringify(state));
    window.updateTicketsBadgeUI(); 
};

window.checkIfUnread = function(ticket) {
    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    if (parsedLog.length > 0) {
        const lastMsg = parsedLog[parsedLog.length - 1];
        if (lastMsg.isStaff) {
            const state = window.getReadTicketsState();
            const savedLength = state[ticket.id] || 0;
            if (parsedLog.length > savedLength) {
                return true;
            }
        }
    }
    return false;
};

// עדכון בועת ההתראה על אייקון האוזניות מחוץ למודאל
window.updateTicketsBadgeUI = function() {
    if (!window.familyTicketsCache) return;
    const unreadCount = window.familyTicketsCache.filter(t => window.checkIfUnread(t)).length;
    
    const triggerBtns = document.querySelectorAll('[onclick*="openTicketsModal"]');
    triggerBtns.forEach(btn => {
        const existingBadge = btn.querySelector('.ticket-unread-badge');
        if (existingBadge) existingBadge.remove();
        
        if (unreadCount > 0) {
            btn.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'ticket-unread-badge absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-pulse';
            badge.innerText = unreadCount;
            btn.appendChild(badge);
        }
    });
};

// שכתוב הפונקציה כדי שתתמוך ב-Silent Load (משיכת נתונים ברקע בלי לשבש את המסך)
window.fetchMyTickets = async function(silent = false) {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        if (data.success && data.tickets) {
            window.familyTicketsCache = data.tickets; 
            window.updateTicketsBadgeUI(); // עדכון הבועה על האייקון מיד לאחר המשיכה
            
            const list = document.getElementById('user-tickets-list');
            if (!list || silent) return;
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                const isUnread = window.checkIfUnread(t);
                const unreadBadge = isUnread ? `<span class="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm animate-pulse">תגובה חדשה!</span>` : '';
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${isUnread ? 'border-red-300 shadow-md bg-red-50/10' : (t.status === 'resolved' ? 'border-green-200' : 'border-slate-200')} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300 relative">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm flex items-center">
                            <i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> 
                            <span class="truncate max-w-[120px] inline-block mr-1">${safeStr(t.subject)}</span>
                            ${unreadBadge}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        } else {
             const list = document.getElementById('user-tickets-list');
             if(list && !silent) list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    // סימון הקריאה כנקראה (מעדכן את מונה ההודעות עבור ה-ID הזה ומכבה התראות)
    window.markTicketAsRead(id, parsedLog.length);

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden'); window.fetchMyTickets();" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה לצוות התמיכה..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
    
    // רענון הרשימה מאחורי הקלעים כדי להעלים את תגית "תגובה חדשה!" מהרשימה עצמה באופן מיידי
    fetchMyTickets(true); 
};

// משלבים קריאה שקטה לקבלת הפניות ברקע, כדי להציג את בועת ההתראה מיד כשהמשתמש פותח את האפליקציה!
const _origFetchDataForTicketsBadge = window.fetchData;
if (_origFetchDataForTicketsBadge && !window.hookedTicketsBadge) {
    window.fetchData = async function() {
        await _origFetchDataForTicketsBadge();
        // מושכים קריאות באופן שקט (Silent) פעם בכמה זמן כדי לעדכן רק את ה-Badge באייקון האוזניות
        if (typeof window.fetchMyTickets === 'function') window.fetchMyTickets(true);
    };
    window.hookedTicketsBadge = true;
}
// ==========================================
// OVERRIDE FINAL: התראות קריאות שירות בזמן אמת (פולינג עצמאי)
// ==========================================

// פונקציות עזר לשמירת מצב הקריאה בדפדפן
window.getReadTicketsState = function() {
    try { return JSON.parse(localStorage.getItem('ofl_tickets_read_state')) || {}; } 
    catch(e) { return {}; }
};

window.markTicketAsRead = function(ticketId, logLength) {
    const state = window.getReadTicketsState();
    state[ticketId] = logLength;
    localStorage.setItem('ofl_tickets_read_state', JSON.stringify(state));
    window.updateTicketsBadgeUI(); 
};

window.checkIfUnread = function(ticket) {
    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    if (parsedLog.length > 0) {
        const lastMsg = parsedLog[parsedLog.length - 1];
        if (lastMsg.isStaff) {
            const state = window.getReadTicketsState();
            const savedLength = state[ticket.id] || 0;
            if (parsedLog.length > savedLength) {
                return true;
            }
        }
    }
    return false;
};

// עדכון בועת ההתראה על אייקון האוזניות מחוץ למודאל
window.updateTicketsBadgeUI = function() {
    if (!window.familyTicketsCache) return;
    const unreadCount = window.familyTicketsCache.filter(t => window.checkIfUnread(t)).length;
    
    const triggerBtns = document.querySelectorAll('[onclick*="openTicketsModal"]');
    triggerBtns.forEach(btn => {
        const existingBadge = btn.querySelector('.ticket-unread-badge');
        if (existingBadge) existingBadge.remove();
        
        if (unreadCount > 0) {
            btn.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'ticket-unread-badge absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-pulse z-50';
            badge.innerText = unreadCount;
            btn.appendChild(badge);
        }
    });
};

// שכתוב הפונקציה כדי שתתמוך ב-Silent Load (משיכת נתונים ברקע)
window.fetchMyTickets = async function(silent = false) {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        if (data.success && data.tickets) {
            window.familyTicketsCache = data.tickets; 
            window.updateTicketsBadgeUI(); // עדכון הבועה על האייקון מיד לאחר המשיכה
            
            const list = document.getElementById('user-tickets-list');
            const modal = document.getElementById('tickets-modal');
            const isModalOpen = modal && !modal.classList.contains('hidden');
            
            // אם המשיכה שקטה והמודאל בכלל סגור, אפשר לעצור פה ולחסוך רינדור HTML מיותר
            if (silent && !isModalOpen) return;
            
            if (!list) return;
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                const isUnread = window.checkIfUnread(t);
                const unreadBadge = isUnread ? `<span class="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm animate-pulse">תגובה חדשה!</span>` : '';
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${isUnread ? 'border-red-300 shadow-md bg-red-50/10' : (t.status === 'resolved' ? 'border-green-200' : 'border-slate-200')} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300 relative">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm flex items-center">
                            <i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> 
                            <span class="truncate max-w-[120px] inline-block mx-1">${safeStr(t.subject)}</span>
                            ${unreadBadge}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    // סימון הקריאה כנקראה - מאפס את בועת ההתראה
    window.markTicketAsRead(id, parsedLog.length);

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden'); window.fetchMyTickets(false);" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה לצוות התמיכה..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
    
    // רענון שקט כדי להעלים את התגית מהרשימה מאחור
    window.fetchMyTickets(true); 
};

window.replyFamilyTicket = async function(id) {
    const input = document.getElementById('family-ticket-reply-text');
    const text = input.value.trim();
    if(!text) return typeof showToast === 'function' ? showToast('error', 'נא לכתוב תגובה') : alert('נא לכתוב תגובה');
    
    const btn = document.getElementById('btn-family-ticket-reply');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
            body: JSON.stringify({ 
                message: text, 
                userName: currentUser ? currentUser.nickname : 'לקוח', 
                isStaff: false 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            input.value = '';
            if (typeof showToast === 'function') showToast('success', 'התגובה נשלחה לצוות');
            await fetchMyTickets(true); 
            openFamilyTicket(id); 
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i>';
    }
};

// ==========================================
// OVERRIDE FINAL: מודול תיבת הודעות (Inbox) למשפחות בזמן אמת
// ==========================================

window.familyInboxCache = [];

window.fetchInboxMessages = async function(silent = false) {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/inbox/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success && data.messages) {
            window.familyInboxCache = data.messages;
            window.updateInboxBadgeUI();
            
            const modal = document.getElementById('inbox-modal');
            const isModalOpen = modal && !modal.classList.contains('hidden');
            
            // נרנדר את הרשימה רק אם המודאל פתוח או אם זו קריאה יזומה מהמשתמש
            if (!silent || isModalOpen) {
                window.renderInboxList();
            }
        }
    } catch(e) {
        console.error('Error fetching inbox:', e);
    }
};

window.updateInboxBadgeUI = function() {
    const unreadCount = window.familyInboxCache.filter(m => !m.is_read).length;
    const badge = document.getElementById('unread-inbox-badge');
    if (!badge) return;
    
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.classList.remove('hidden');
        badge.classList.add('animate-pulse');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
    }
};

window.openInboxModal = function() {
    const modal = document.getElementById('inbox-modal');
    if (modal) {
        modal.classList.remove('hidden');
        window.fetchInboxMessages(false);
    }
};

window.renderInboxList = function() {
    const list = document.getElementById('inbox-messages-list');
    if (!list) return;
    
    if (window.familyInboxCache.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">אין הודעות בתיבה.</p>';
        return;
    }
    
    list.innerHTML = window.familyInboxCache.map(m => {
        const isUnread = !m.is_read;
        const bgClass = isUnread ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-100 shadow-sm opacity-80';
        const iconClass = isUnread ? 'fa-envelope text-blue-500' : 'fa-envelope-open text-slate-400';
        const d = new Date(m.created_at);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        
        return `
        <div onclick="openInboxMessage(${m.id})" class="p-3 rounded-xl border cursor-pointer transition hover:shadow-md mb-2 ${bgClass}">
            <div class="flex justify-between items-start mb-1">
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${iconClass}"></i>
                    <h4 class="font-bold text-sm ${isUnread ? 'text-slate-800' : 'text-slate-600'}">${safeStr(m.subject)}</h4>
                </div>
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-sm animate-pulse"></span>' : ''}
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-[10px] text-slate-500 bg-white/50 px-2 py-0.5 rounded-md border border-slate-200">מאת: ${safeStr(m.sender_name)}</span>
                <span class="text-[10px] text-slate-400">${dateStr}</span>
            </div>
        </div>
        `;
    }).join('');
};

window.openInboxMessage = async function(id) {
    const msg = window.familyInboxCache.find(m => m.id === id);
    if (!msg) return;
    
    if (!msg.is_read) {
        msg.is_read = true;
        window.updateInboxBadgeUI();
        window.renderInboxList(); 
        
        try {
            const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
            await fetch(`${apiPath}/inbox/${id}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true })
            });
        } catch(e) { console.error('Error marking as read', e); }
    }
    
    let msgModal = document.getElementById('inbox-read-modal');
    if (!msgModal) {
        msgModal = document.createElement('div');
        msgModal.id = 'inbox-read-modal';
        msgModal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(msgModal);
    }
    
    const d = new Date(msg.created_at);
    const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
    
    // זיהוי החתימה הדיגיטלית המעודכנת מהסופר אדמין
    const isRichHtml = msg.content && (msg.content.includes('') || (msg.content.includes('<div') && msg.content.includes('style=')));
    
    const displayContent = isRichHtml 
        ? `<div class="w-full overflow-y-auto max-h-[65vh] bg-slate-50">${msg.content}</div>`
        : `<div class="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">${safeStr(msg.content)}</div>`;
    
    msgModal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
            <div class="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-start shrink-0">
                <div class="pr-8">
                    <h3 class="font-bold text-slate-800 text-lg leading-tight mb-2">${safeStr(msg.subject)}</h3>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <span class="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><i class="fa-solid fa-user-circle text-blue-400"></i> ${safeStr(msg.sender_name)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </div>
                </div>
                <button onclick="document.getElementById('inbox-read-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            ${displayContent}
            
            <div class="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                <button onclick="document.getElementById('inbox-read-modal').classList.add('hidden')" class="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition w-full text-sm">הבנתי וקראתי</button>
            </div>
        </div>
    `;
    
    msgModal.classList.remove('hidden');
};

// --- הפעלת מנוע פולינג (Polling) עצמאי משולב ---
if (window.ticketPollIntervalId) {
    clearInterval(window.ticketPollIntervalId);
}
// נריץ בדיקה שקטה כל 15 שניות, באופן בלתי תלוי
window.ticketPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        if (typeof window.fetchMyTickets === 'function') window.fetchMyTickets(true);
        if (typeof window.fetchInboxMessages === 'function') window.fetchInboxMessages(true);
    }
}, 15000);

// משיכה ראשונית בעליית המערכת (לאחר טעינת היוזר)
const _origFetchDataForInbox = window.fetchData;
if (_origFetchDataForInbox && !window.hookedInboxFetch) {
    window.fetchData = async function() {
        await _origFetchDataForInbox();
        if (typeof window.fetchInboxMessages === 'function') window.fetchInboxMessages(true);
    };
    window.hookedInboxFetch = true;
}
// ==========================================
// OVERRIDE: מודול צ'אט משפחתי משופר (מהירות מירבית + באנר קבוע)
// ==========================================

window.teamChatCache = [];
window.lastReadChatCount = parseInt(localStorage.getItem('ofl_chat_read_count') || '0');

window.openTeamChatModal = function() {
    const modal = document.getElementById('team-chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        window.loadTeamChat(false);
    }
};

window.loadTeamChat = async function(silent = true) {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/chat/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success && data.messages) {
            const newMessages = data.messages;
            if (newMessages.length > window.lastReadChatCount) {
                const unread = newMessages.length - window.lastReadChatCount;
                const badge = document.getElementById('team-chat-unread-badge');
                if (badge) { badge.innerText = unread; badge.classList.remove('hidden'); }
            }
            const modal = document.getElementById('team-chat-modal');
            const isChatOpen = modal && !modal.classList.contains('hidden');
            if (isChatOpen) {
                window.lastReadChatCount = newMessages.length;
                localStorage.setItem('ofl_chat_read_count', window.lastReadChatCount.toString());
                const badge = document.getElementById('team-chat-unread-badge');
                if (badge) badge.classList.add('hidden');
                if (newMessages.length !== window.teamChatCache.length || !silent) {
                    window.teamChatCache = newMessages;
                    window.renderTeamChat();
                }
            } else { window.teamChatCache = newMessages; }
        }
    } catch(e) { console.error('Error fetching chat:', e); }
};

window.renderTeamChat = function() {
    const container = document.getElementById('team-chat-messages');
    if (!container) return;
    
    // 1. טיפול בבאנר מקובע (Sticky) מחוץ לאזור הגלילה
    let stickyBanner = document.getElementById('team-chat-sticky-banner');
    if (!stickyBanner) {
        stickyBanner = document.createElement('div');
        stickyBanner.id = 'team-chat-sticky-banner';
        // עיצוב שמשתלב עם כותרת המודאל ומונע גלילה
        stickyBanner.className = 'shrink-0 z-10 bg-emerald-50 px-4 pb-2 border-b border-emerald-100';
        container.parentNode.insertBefore(stickyBanner, container);
    }

    if (currentUser.role === 'ADMIN') {
        stickyBanner.innerHTML = `
            <div class="bg-indigo-900 text-indigo-100 text-[10px] py-1.5 px-3 rounded-xl text-center shadow-sm">
                <i class="fa-solid fa-clock-rotate-left mr-1 text-indigo-300"></i> ההיסטוריה נמחקת אוטומטית אחרי 3 חודשים
            </div>
        `;
    } else {
        stickyBanner.innerHTML = '';
        stickyBanner.className = 'hidden';
    }

    // 2. רינדור הודעות הצ'אט עצמן
    if (window.teamChatCache.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10 mt-10"><i class="fa-regular fa-comments text-4xl mb-3 opacity-50"></i><p class="text-sm">אין הודעות עדיין.<br>תהיו הראשונים לכתוב!</p></div>';
        return;
    }
    
    let html = '';
    window.teamChatCache.forEach(msg => {
        const isMe = String(msg.user_id) === String(currentUser.id);
        const alignWrapper = isMe ? 'justify-end' : 'justify-start';
        
        const userColorIndex = parseInt(msg.user_id) % userColors.length;
        const colorClasses = userColors[userColorIndex].split(' '); 
        const bubbleBg = isMe ? 'bg-emerald-500 text-white shadow-emerald-200' : colorClasses[0] + ' text-slate-800 border ' + colorClasses[1] + ' shadow-sm';
        
        const nameColor = isMe ? 'text-emerald-100' : 'text-slate-400';
        const d = new Date(msg.created_at);
        const timeStr = d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        
        html += `
            <div class="flex w-full ${alignWrapper} mb-3 fade-in">
                <div class="max-w-[85%] flex flex-col ${isMe ? 'items-end text-left' : 'items-start text-right'}">
                    <span class="text-[9px] font-bold ${nameColor} mb-0.5 px-1">${isMe ? 'אני' : safeStr(msg.user_name)}</span>
                    <div class="px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-tight shadow-sm ${bubbleBg} ${isMe ? 'rounded-tl-none' : 'rounded-tr-none'}">
                        ${safeStr(msg.message)}
                    </div>
                    <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${timeStr}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
};

window.sendTeamChatMessage = async function() {
    const input = document.getElementById('team-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById('btn-send-team-chat');
    btn.disabled = true;
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ groupId: currentGroup.id, userId: currentUser.id, message: text })
        });
        if ((await res.json()).success) { 
            input.value = ''; 
            await window.loadTeamChat(false); 
        }
    } catch(e) {} finally { btn.disabled = false; input.focus(); }
};

window.downloadChatHistory = function() {
    if (window.teamChatCache.length === 0) return showToast('info', 'אין הודעות לייצוא');
    let text = `היסטוריית צ'אט משפחתית - ${currentGroup.name}\n`;
    text += `הופק בתאריך: ${new Date().toLocaleString('he-IL')}\n`;
    text += `------------------------------------------\n\n`;
    
    window.teamChatCache.forEach(m => {
        const d = new Date(m.created_at);
        const time = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL')}`;
        text += `[${time}] ${m.user_name}: ${m.message}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FamilyChat_${currentGroup.name}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'הקובץ מוכן להורדה!');
};

// --- מערכת סנכרון צ'אט מהירה במיוחד (זמן אמת) ---
if (window.chatFastPollIntervalId) clearInterval(window.chatFastPollIntervalId);
window.chatFastPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        const modal = document.getElementById('team-chat-modal');
        // אם הצ'אט פתוח, משוך נתונים כל שנייה אחת (1000ms)!
        if (modal && !modal.classList.contains('hidden')) {
            window.loadTeamChat(true); 
        }
    }
}, 1000);

// טיימר נפרד לעדכון הבועה כשהצ'אט סגור (3 שניות לחסוך סוללה)
if (window.chatSlowPollIntervalId) clearInterval(window.chatSlowPollIntervalId);
window.chatSlowPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        const modal = document.getElementById('team-chat-modal');
        if (!modal || modal.classList.contains('hidden')) {
            window.loadTeamChat(true); 
        }
    }
}, 3000);

const _origFetchDataForChat = window.fetchData;
if (_origFetchDataForChat && !window.hookedChatFetch) {
    window.fetchData = async function() {
        await _origFetchDataForChat();
        if (typeof window.loadTeamChat === 'function') window.loadTeamChat(true);
    };
    window.hookedChatFetch = true;
}
// ==========================================
// OVERRIDE FINAL: מודול העוזרת החכמה של המשפחה (FamilAI)
// ==========================================

// פונקציית הפתיחה מחוברת לבועה של העוזרת שבנית ב-HTML
window.openFamilaiChatModal = function() {
    const modal = document.getElementById('familai-chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('familai-chat-input');
        if (input) setTimeout(() => input.focus(), 100);
        
        const container = document.getElementById('familai-chat-messages');
        if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
    }
};

window.sendFamilaiChatMessage = async function() {
    const input = document.getElementById('familai-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    const container = document.getElementById('familai-chat-messages');
    const btn = document.getElementById('btn-send-familai-chat');
    const indicator = document.getElementById('familai-typing-indicator');
    
    // ציור הודעת המשתמש בצד שמאל
    const timeStr = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    container.innerHTML += `
        <div class="flex w-full justify-end fade-in mt-2">
            <div class="max-w-[85%] flex flex-col items-end text-left">
                <span class="text-[9px] font-bold text-slate-400 mb-1 px-1">אני</span>
                <div class="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tl-none">
                    ${safeStr(text)}
                </div>
                <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${timeStr}</span>
            </div>
        </div>
    `;
    
    input.value = '';
    btn.disabled = true;
    indicator.classList.remove('hidden');
    indicator.classList.add('flex');
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);

    try {
        const contextData = {
            family_name: currentGroup.name,
            user_name: currentUser.nickname,
            user_role: currentUser.role,
            members: membersCache.map(m => ({name: m.nickname, role: m.role, balance: m.balance})),
            pantry: pantryCache.map(p => ({item: p.item_name, qty: p.quantity, unit: p.unit, updated: p.updated_at})),
            shopping_list: shoppingListCache.map(s => ({item: s.item_name, qty: s.quantity, status: s.status})),
            tasks: allTasks.filter(t => t.status !== 'approved').map(t => ({title: t.title, assigned_to: t.assignee_name, reward: t.reward, status: t.status})),
            recent_transactions: allTransactions.slice(0, 40).map(tx => ({desc: tx.description, amount: tx.amount, type: tx.type, date: tx.date}))
        };
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/family/chat-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ 
                groupId: currentGroup.id, 
                userId: currentUser.id, 
                query: text,
                context: JSON.stringify(contextData)
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            let formattedAns = data.answer;
            formattedAns = formattedAns.replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-700">$1</strong>');
            formattedAns = formattedAns.replace(/\n/g, '<br>');
            
            const aiTime = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
            // כאן מתבצעת הזרקת תמונת העוזרת במקום אייקון רובוט גנרי
            const aiAvatarHtml = window.currentFamilaiLogo ? `<img src="${window.currentFamilaiLogo}" class="w-4 h-4 rounded-full object-cover shadow-sm inline-block">` : `<i class="fa-solid fa-robot"></i>`;
            
            container.innerHTML += `
                <div class="flex w-full justify-start mt-2 fade-in">
                    <div class="max-w-[85%] flex flex-col items-start text-right">
                        <span class="text-[10px] font-bold text-purple-600 mb-1 px-1 flex items-center gap-1">${aiAvatarHtml} FamilAI</span>
                        <div class="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm bg-white border border-purple-100 text-slate-800 rounded-tr-none">
                            ${formattedAns}
                        </div>
                        <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${aiTime}</span>
                    </div>
                </div>
            `;
            fetchData();
        } else {
            if (data.error === 'BATTERY_EMPTY') {
                showToast('error', 'נגמרה סוללת ה-AI שלכם!');
            } else {
                showToast('error', data.error || 'שגיאה בקבלת תשובה מ-FamilAI');
            }
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת מול ה-AI');
    } finally {
        btn.disabled = false;
        indicator.classList.remove('flex');
        indicator.classList.add('hidden');
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
        input.focus();
    }
};
// מנגנון הגנה עליון: שומר על ההרשאות ועל התמונה מלהימחק בריענון!
const _originalFetchDataForPermsAndLogo = window.fetchData;
if (_originalFetchDataForPermsAndLogo && !window.hookedPermsAndLogoFetch) {
    window.fetchData = async function() {
        await _originalFetchDataForPermsAndLogo();
        
        try {
            // 1. שחזור התמונה מהגיבוי הקשיח המקומי (פותר את היעלמות התמונה בריענון!)
            if (currentGroup && currentGroup.id) {
                const hardLogo = localStorage.getItem(`ofl_hard_logo_${currentGroup.id}`);
                if (hardLogo && hardLogo.length > 50) {
                    currentGroup.logo = hardLogo;
                    currentGroup.logo_url = hardLogo;
                    currentGroup.image_url = hardLogo;
                    if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo();
                }
            }
            
            // 2. עדכון הרשאות רציף מול השרת לילדים / בדיקת גיבוי תמונה מהשרת
            if (currentUser && currentUser.id) {
                const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
                const res = await fetch(`${apiPath}/data/${currentUser.id}`); 
                const data = await res.json();
                
                // גיבוי תמונה מהשרת למקרה שאין לנו במטמון המקומי
                if (data && data.group && (data.group.image_url || data.group.logo || data.group.logo_url)) {
                    const sLogo = data.group.image_url || data.group.logo || data.group.logo_url;
                    if (sLogo.length > 50) {
                        currentGroup.logo = sLogo;
                        localStorage.setItem(`ofl_hard_logo_${currentGroup.id}`, sLogo);
                        if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo();
                    }
                }

                // סידור הרשאות ילדים חיות
                if (data && data.user && data.user.permissions !== undefined) {
                    currentUser.permissions = data.user.permissions;
                    localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup}));
                    if(typeof enforcePermissions === 'function') enforcePermissions();
                }
            }
        } catch(e) {}
    };
    window.hookedPermsAndLogoFetch = true;
}
// ==========================================
// OVERRIDE FINAL: BRUTE FORCE IMPERSONATION BANNER (V3 - UNIFIED GHOST DESIGN)
// מנגנון אוטונומי לסביבת משפחות - תואם ויזואלית לעסקים וסוגר טאב בניתוק
// ==========================================

window.exitImpersonation = function() {
    localStorage.removeItem('ofl_session');
    // סגירת הטאב הנוכחי שבו בוצעה ההשתלטות
    window.close();
    // ליתר ביטחון, אם הדפדפן חוסם סגירה אוטומטית, נרענן לדף הבית
    setTimeout(() => { window.location.href = '/'; }, 100);
};

setInterval(() => {
    const saTokenLocal = localStorage.getItem('ofl_sa_token');
    let bruteBanner = document.getElementById('brute-force-sa-banner');
    
    if (saTokenLocal) {
        if (document.body.style.paddingTop !== '45px') {
            document.body.style.paddingTop = '45px';
        }
        
        if (!bruteBanner) {
            // שליפת שם הלקוח (המשפחה) מהסשן
            let customerName = 'לקוח';
            try {
                const session = JSON.parse(localStorage.getItem('ofl_session'));
                if (session && session.group) customerName = session.group.name;
            } catch(e) {}

            bruteBanner = document.createElement('div');
            bruteBanner.id = 'brute-force-sa-banner';
            
            // עיצוב Ghost אדום - זהה לחלוטין לעסקים
            bruteBanner.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 2147483647 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; background-color: #dc2626 !important; color: white !important; padding: 0 20px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; font-family: 'Rubik', sans-serif !important; direction: rtl !important; height: 45px !important; box-sizing: border-box !important;";
            
            bruteBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-ghost animate-pulse" style="font-size: 18px;"></i>
                    <span style="font-size: 13px; font-weight: bold; letter-spacing: 0.3px;">מצב תמיכה והשתלטות! אתה צופה כרגע בנתוני הלקוח: ${customerName}</span>
                </div>
                <button onclick="exitImpersonation()" style="background-color: white !important; color: #dc2626 !important; padding: 5px 15px !important; border-radius: 8px !important; font-size: 11px !important; font-weight: 900 !important; border: 2px solid rgba(255,255,255,0.2) !important; cursor: pointer !important; text-transform: uppercase !important; transition: all 0.2s !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;">
                    התנתקות
                </button>
            `;
            
            document.documentElement.appendChild(bruteBanner);
        }
    } else {
        if (bruteBanner) bruteBanner.remove();
        if (document.body.style.paddingTop === '45px') {
            document.body.style.paddingTop = '0px';
        }
    }
}, 500);

// ── ACTIVITY FEED ──────────────────────────────────────────────
const ACTION_ICONS = { finance:'💰', task:'✅', shopping:'🛒', pantry:'📦', business:'🏪', user:'👤' };

async function openActivityPanel() {
  getEl('activity-panel').classList.remove('hidden');
  if (currentUser?.role === 'ADMIN') {
    getEl('activity-filters').classList.remove('hidden');
    const sel = getEl('filter-user');
    sel.innerHTML = '<option value="">כל המשתמשים</option>';
    if (membersCache) membersCache.forEach(m => sel.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`);
  }
  ['filter-days','filter-type','filter-user'].forEach(id => {
    const el = getEl(id);
    if (el) el.addEventListener('change', loadActivityFeed);
  });
  await loadActivityFeed();
}

function closeActivityPanel() {
  getEl('activity-panel').classList.add('hidden');
  const badge = getEl('bell-badge');
  if (badge) badge.classList.add('hidden');
}

async function loadActivityFeed() {
  const days = getEl('filter-days')?.value || 30;
  const type = getEl('filter-type')?.value || 'all';
  const filterUser = getEl('filter-user')?.value || '';
  const list = getEl('activity-list');
  list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">טוען...</div>';
  try {
    let url = `${API}/activity?userId=${currentUser.id}&days=${days}`;
    if (type !== 'all') url += `&actionType=${type}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success || !data.activities.length) {
      list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין פעולות להצגה</div>';
      return;
    }
    let acts = data.activities;
    if (filterUser) acts = acts.filter(a => String(a.user_id) === String(filterUser));
    list.innerHTML = acts.map(a => {
      const icon = ACTION_ICONS[a.action_type] || '•';
      const time = new Date(a.created_at).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const who = a.nickname || a.user_name || 'מערכת';
      return `<div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <div class="flex items-start gap-2">
          <span class="text-lg flex-shrink-0">${icon}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-700 leading-snug">${safeStr(a.description)}</p>
            <p class="text-xs text-slate-400 mt-1">${safeStr(who)} · ${time}</p>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { list.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">שגיאה בטעינה</div>'; }
}

async function refreshBellBadge() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/activity?userId=${currentUser.id}&days=1&limit=1`);
    const data = await res.json();
    const badge = getEl('bell-badge');
    if (!badge) return;
    const count = data.unreadCount || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch(e) {}
}

// ── QUICK ACCESS TILES ─────────────────────────────────────────
function renderQuickTiles() {
  const container = getEl('quick-tiles');
  if (!container) return;
  const shopCount = (shoppingListCache || []).filter(i => i.status === 'pending' || i.status === 'in_cart').length;
  const pantryCount = (pantryCache || []).length;
  const taskCount = (allTasks || []).filter(t => t.status === 'pending').length;
  const tiles = [
    { fa:'fa-cart-shopping',  label:'קניות',        badge: shopCount,   tab:'shop',      bg:'#ecfdf5', grad:'linear-gradient(135deg,#34d399,#0d9488)', badge_bg:'#059669' },
    { fa:'fa-box-open',       label:'מזווה',         badge: pantryCount, tab:'pantry',    bg:'#fff7ed', grad:'linear-gradient(135deg,#fb923c,#ea580c)', badge_bg:'#c2410c' },
    { fa:'fa-chart-pie',      label:'תקציב',         badge: null,        tab:'cashflow',  bg:'#eff6ff', grad:'linear-gradient(135deg,#60a5fa,#4f46e5)', badge_bg:'#2563eb' },
    { fa:'fa-people-group',   label:'הקהילה שלי',    badge: null,        tab:'community', bg:'#faf5ff', grad:'linear-gradient(135deg,#c084fc,#db2777)', badge_bg:'#7c3aed' },
    { fa:'fa-list-check',     label:'משימות',        badge: taskCount,   tab:'tasks',     bg:'#f0fdf4', grad:'linear-gradient(135deg,#4ade80,#16a34a)', badge_bg:'#15803d' },
    { fa:'fa-clipboard-list', label:'הזמנות שלי',    badge: null,        tab:'myorders',  bg:'#fff1f2', grad:'linear-gradient(135deg,#fb7185,#e11d48)', badge_bg:'#be123c' },
  ];
  container.innerHTML = tiles.map(t => `
    <button onclick="switchTab('${t.tab}')"
      style="background:${t.bg};border:1.5px solid rgba(0,0,0,0.06)"
      class="relative rounded-2xl p-3.5 flex flex-col items-center gap-2 shadow-sm hover:shadow-lg hover:scale-[1.04] active:scale-95 transition-all duration-200 cursor-pointer">
      <div style="background:${t.grad}" class="w-11 h-11 rounded-xl flex items-center justify-center shadow-md mb-0.5">
        <i class="fa-solid ${t.fa} text-white text-lg"></i>
      </div>
      <span class="text-[11px] font-bold text-slate-600 text-center leading-tight">${t.label}</span>
      ${t.badge !== null && t.badge > 0 ? `<span style="background:${t.badge_bg}" class="absolute -top-1.5 -right-1.5 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">${t.badge}</span>` : ''}
    </button>
  `).join('');
}

// ── FAMILY URGENT ITEMS — "מה מחכה לך" ──────────────────────
async function renderFamilyUrgentItems() {
    const section = document.getElementById('family-urgent-section');
    const list    = document.getElementById('family-urgent-list');
    const badge   = document.getElementById('family-urgent-badge');
    if (!section || !list || !currentGroup) return;

    const isAdmin = currentUser?.role === 'ADMIN';
    const now     = new Date();
    const todayStr = now.toDateString();
    const items   = [];

    const C = {
        high:   { bg:'bg-red-50',   border:'border-red-100',   ibg:'bg-red-100',   txt:'text-red-600' },
        medium: { bg:'bg-amber-50', border:'border-amber-100', ibg:'bg-amber-100', txt:'text-amber-700' },
        low:    { bg:'bg-slate-50', border:'border-slate-100', ibg:'bg-slate-100', txt:'text-slate-500' }
    };

    if (isAdmin) {
        // ─ משימות ממתינות לאישור ─
        const pendingApproval = (allTasks || []).filter(t => t.status === 'completed' || t.status === 'done');
        if (pendingApproval.length > 0)
            items.push({ icon:'✅', urgency:'high',
                title:`${pendingApproval.length} משימות ממתינות לאישורך`,
                sub: pendingApproval.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'אשר' });

        // ─ פריטי קניות ממתינים לאישור ─
        const pendingShop = (shoppingListCache || []).filter(i => i.status === 'pending_approval');
        if (pendingShop.length > 0)
            items.push({ icon:'🛒', urgency:'high',
                title:`${pendingShop.length} בקשות קניה ממתינות`,
                sub: pendingShop.slice(0,2).map(i => i.name).join(', '),
                tab:'shop', actionLabel:'בדוק' });

        // ─ משימות שעברו דד-ליין ─
        const overdue = (allTasks || []).filter(t =>
            t.status === 'pending' && t.deadline && new Date(t.deadline) < now
        );
        if (overdue.length > 0)
            items.push({ icon:'⏰', urgency:'medium',
                title:`${overdue.length} משימות שעברו דד-ליין`,
                sub: overdue.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'ראה' });

        // ─ מלאי מזווה נמוך ─
        const lowPantry = (pantryCache || []).filter(p => parseFloat(p.quantity) <= 1);
        if (lowPantry.length > 0)
            items.push({ icon:'📦', urgency:'low',
                title:`${lowPantry.length} פריטים במזווה כמעט נגמרו`,
                sub: lowPantry.slice(0,3).map(p => p.item_name).join(', '),
                tab:'pantry', actionLabel:'עדכן' });

        // ─ תחזוקה ותקלות בבית ─
        try {
            const [hmMRes, hmFRes] = await Promise.all([
                fetch(`/api/equipment/maintenance/${currentGroup.id}`),
                fetch(`/api/equipment/faults/${currentGroup.id}`)
            ]);
            const hmMData = await hmMRes.json();
            const hmFData = await hmFRes.json();
            if (hmMData.success) {
                const today2 = new Date(); today2.setHours(0,0,0,0);
                const in7 = new Date(today2); in7.setDate(today2.getDate() + 7);
                const urgMaint = hmMData.records.filter(m => {
                    if (m.status === "completed" || !m.scheduled_date) return false;
                    const sd = new Date(m.scheduled_date); sd.setHours(0,0,0,0);
                    return sd <= in7;
                });
                if (urgMaint.length > 0) {
                    const late = urgMaint.filter(m => new Date(m.scheduled_date) < today2);
                    items.push({ icon:"🔧", urgency: late.length > 0 ? "high" : "medium",
                        title:`${urgMaint.length} תחזוקות בית ממתינות${late.length > 0 ? " (" + late.length + " באיחור)" : ""}`,
                        sub: urgMaint[0].description || "", tab:"home-maintenance", actionLabel:"טפל" });
                }
            }
            if (hmFData.success) {
                const openF = hmFData.faults.filter(f => f.status !== "resolved");
                if (openF.length > 0) {
                    const crit = openF.filter(f => f.severity === "critical" || f.severity === "high");
                    items.push({ icon:"⚠️", urgency: crit.length > 0 ? "high" : "medium",
                        title:`${openF.length} תקלות בית פתוחות`,
                        sub: openF[0].title || "", tab:"home-maintenance", actionLabel:"טפל" });
                }
            }
        } catch(e) {}

    } else {
        // ─ ילד/חבר משפחה ─
        // משימות אישיות לסגירה
        const myTasks = (allTasks || []).filter(t => {
            if (t.status === 'approved' || t.status === 'cancelled') return false;
            if (t.assigned_to && String(t.assigned_to) !== String(currentUser?.id)) return false;
            return t.status === 'pending';
        });
        if (myTasks.length > 0) {
            const overdue = myTasks.filter(t => t.deadline && new Date(t.deadline) < now);
            items.push({ icon:'✅', urgency: overdue.length > 0 ? 'high' : 'medium',
                title:`${myTasks.length} משימות שלך ממתינות`,
                sub: myTasks.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'בצע' });
        }

        // אתגרי אקדמיה ממתינים
        const myAcademy = (bundlesCache || []).filter(b => b.status === 'assigned');
        if (myAcademy.length > 0)
            items.push({ icon:'🎓', urgency:'medium',
                title:`${myAcademy.length} אתגרי אקדמיה ממתינים לך`,
                sub: myAcademy.slice(0,2).map(b => b.title).join(', '),
                tab:'academy', actionLabel:'התחל' });
    }

    if (items.length === 0) { section.classList.add('hidden'); return; }

    list.innerHTML = items.map((item, i) => {
        const c = C[item.urgency] || C.low;
        const sep = i < items.length - 1 ? `border-b ${c.border}` : '';
        return `<div class="flex items-center gap-3 px-4 py-3 ${c.bg} ${sep} cursor-pointer active:opacity-70 transition-opacity"
                     onclick="switchTab('${item.tab}')">
          <div class="w-9 h-9 rounded-xl ${c.ibg} flex items-center justify-center flex-shrink-0 text-base">${item.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold text-slate-800 leading-tight">${item.title}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 truncate">${item.sub}</div>
          </div>
          <span class="text-[10px] font-bold ${c.txt} bg-white border ${c.border} rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap">${item.actionLabel} →</span>
        </div>`;
    }).join('');

    if (badge) badge.textContent = items.length;
    section.classList.remove('hidden');
}

// ════════════════════════════════════════════════
// ★ HELP SYSTEM — תוכן עזרה לכל מודול (משפחה)
// ════════════════════════════════════════════════
window._currentFamilyTab = 'feed';

const FAMILY_HELP_CONTENT = {
    feed: {
        icon: '🏠', title: 'לוח ראשי',
        what: 'דשבורד משפחתי — תצוגת יתרה, משימות פתוחות ופעולות דחופות לטיפול מיידי.',
        tips: [
            '💰 הכרטיס הגדול מציג את יתרת הכסף האישית שלך',
            '⚡ "מה מחכה לך" — פעולות דחופות הדורשות תשומת לב',
            '🎯 הכרטיסים הקטנים — קישורים מהירים לפעולות נפוצות',
            '👨‍👩‍👧 הורה רואה סיכום כלל המשפחה; ילד רואה רק את שלו',
            '🔔 לחץ על הפעמון לצפייה בכל הפעילות האחרונה',
        ]
    },
    shop: {
        icon: '🛒', title: 'בקשות קנייה',
        what: 'שלח בקשות לרכישת מוצרים, ועקוב אחר הסטטוס עד לאישור.',
        tips: [
            '➕ לחץ "+ בקשה" לפתיחת בקשת קנייה חדשה',
            '📝 ציין את שם המוצר, כמות ומחיר משוער',
            '⏳ הבקשה נשלחת לאישור ההורה',
            '✅ לאחר אישור — המוצר יירכש ויגיע!',
            '🛍️ ניתן לעקוב אחר סטטוס כל בקשה',
        ]
    },
    myorders: {
        icon: '🛵', title: 'הזמנות מעסקים',
        what: 'עקוב אחר הזמנות שביצעת מעסקים מקומיים בקהילה — מזון, מוצרים ומשלוחים.',
        tips: [
            '🏪 הזמנות נוצרות כשמזמינים מחנות עסק מקומי בקהילה',
            '🟡 "התקבל בעסק" — ההזמנה נקלטה ובטיפול',
            '📦 "באריזה / הכנה" — העסק מכין את ההזמנה',
            '🛵 "בדרך אליך" — השליח בדרך, מגיע בקרוב!',
            '✅ "נמסר" — ההזמנה הושלמה בהצלחה',
        ]
    },
    bank: {
        icon: '🐷', title: 'הארנק שלי',
        what: 'ארנק כספי אישי — יתרה, היסטוריה ויעדי חיסכון. הורה רואה את כלל המשפחה.',
        tips: [
            '💰 יתרתך הנוכחית — כסף שהצטבר ממשימות ולימוד',
            '🎯 הגדר יעד חיסכון — לאיזה מטרה אתה חוסך?',
            '📈 הפס מציג את ההתקדמות לקראת היעד',
            '💸 ניתן לבקש מקדמה — ממתינה לאישור ההורה',
            '🏆 הגע ליעד וקבל בונוס!',
        ]
    },
    cashflow: {
        icon: '📜', title: 'היסטוריה',
        what: 'צפייה בכל הפעולות הכספיות שלך — הכנסות, הוצאות ותגמולים.',
        tips: [
            '📋 ראה את כל הפעולות הכספיות לפי תאריך',
            '🟢 ירוק = כסף שנכנס (שכר, בונוס, תגמול)',
            '🔴 אדום = כסף שיצא (רכישה, הוצאה)',
            '🔍 חפש פעולה ספציפית לפי שם או סכום',
            '📊 ראה סיכום הכנסות/הוצאות לחודש',
        ]
    },
    academy: {
        icon: '🎓', title: 'אקדמיה',
        what: 'למד, ענה על שאלות נכון — ותרוויח כסף אמיתי! אתגרים מותאמים אישית.',
        tips: [
            '🎲 לחץ "הגרל אתגר מהיר" לאתגר רנדומלי',
            '📚 הספרייה — אלפי מבחנים לפי גיל ונושא',
            '💰 כל תשובה נכונה = כסף לארנק שלך',
            '🏆 השלם את כל שאלות האתגר לקבלת הבונוס המלא',
            '📖 ניתן לחזור על אתגרים שהוקצו לך',
        ]
    },
    tasks: {
        icon: '✅', title: 'משימות',
        what: 'המשימות שהוקצו לך — בצע, דווח וקבל תגמול!',
        tips: [
            '📋 ראה את כל המשימות הפעילות שלך',
            '📸 לחץ "דיווח סיום" + צלם הוכחת ביצוע',
            '⏰ שים לב לתאריכי יעד — אל תפספס!',
            '💰 לאחר אישור ההורה — הבונוס נזקף לארנק',
            '📋 משימת SOP = בצע שלב אחר שלב לפי הנוהל',
        ]
    },
    community: {
        icon: '👥', title: 'קהילה',
        what: 'קהילות מקומיות — צפה בעסקים בשכונה, הזמן משלוחים ונצל הטבות בלעדיות לחברים.',
        tips: [
            '🏪 ראה עסקים מקומיים שמציעים הטבות לחברי הקהילה',
            '🛒 לחץ על עסק \u2192 "הזמן" לביצוע הזמנה ממנו',
            '🏷️ הטבות ומבצעים זמינים רק לחברי הקהילה',
            '📢 קרא עדכונים ואירועים שפרסמו עסקים ושכנים',
            '📦 הזמנות מהעסק מופיעות ב"הזמנות מעסקים" שלך',
        ]
    },
    members: {
        icon: '👨‍👩‍👧', title: 'ניהול משפחה',
        what: 'ניהול חברי המשפחה — נגיש להורה/מנהל בלבד. הוספת ילדים, תפקידים ומעקב.',
        tips: [
            '➕ לחץ "הוסף חבר" לצירוף בן/בת משפחה (הורה בלבד)',
            '👦 הגדר שם, גיל ותפקיד לכל חבר משפחה',
            '💰 ראה את יתרת הכסף ופעילות כל ילד',
            '📊 עקוב אחר ביצועי כל ילד — משימות, לימוד ותגמולים',
            '⚙️ קבע מה כל ילד רואה ומה מוסתר ממנו',
        ]
    },
    budget: {
        icon: '📊', title: 'תקציב משפחתי',
        what: 'הגדר יעדי הוצאות משפחתיים ועקוב בזמן אמת אחרי עמידה בתקציב (נגיש להורה).',
        tips: [
            '➕ הגדר קטגוריות הוצאה — מזון, בידור, לימודים...',
            '🎯 הגדר תקציב חודשי לכל קטגוריה',
            '📈 המערכת מחשבת אוטומטית את ההוצאות בפועל',
            '🔴 קטגוריות שחרגו מסומנות באדום — פעל מייד',
            '📅 עבור בין תצוגה חודשית לשנתית להשוואה',
        ]
    },
    pantry: {
        icon: '📦', title: 'מזווה',
        what: 'מעקב אחר מה יש בבית — מזון, ניקיון ומוצרים נחוצים.',
        tips: [
            '➕ הוסף מוצר למזווה עם כמות ותאריך תפוגה',
            '🔴 מוצרים שאזלו מסומנים להשלמה',
            '📅 שים לב לתאריכי תפוגה — הימנע מבזבוז',
            '🛒 ניתן לשלוח מוצרים ישירות לרשימת הקנייה',
            '✨ familAI יכולה להמליץ מתכונים לפי מה שיש',
        ]
    },
    recipes: {
        icon: '🍳', title: 'מתכונים',
        what: 'מצא וצור מתכונים מהמרכיבים שיש לך בבית — עם עזרת AI.',
        tips: [
            '✨ לחץ "צור מתכון" ו-familAI תבנה מתכון מהמזווה שלך',
            '🥕 בחר מרכיבים ספציפיים שרוצים להשתמש בהם',
            '👨‍👩‍👧 ציין כמה סועדים לכוונון הכמויות',
            '📋 העתק את המתכון לשמירה או שיתוף',
            '🔄 ניסית מתכון? ניתן לבקש גרסה משופרת',
        ]
    },
    forecast: {
        icon: '📅', title: 'תחזית',
        what: 'תכנון הוצאות עתידיות — ראה לאן הולך הכסף המשפחתי.',
        tips: [
            '➕ הוסף הוצאה עתידית צפויה (חופשה, ציוד לבית...)',
            '📆 עבור בין תצוגה חודשית לשנתית',
            '📊 הגרף מציג תחזית תזרים לחודשים הבאים',
            '🎯 תכנן רכישות גדולות מראש',
            '💡 עזר לכל המשפחה לחסוך ביחד ליעד משותף',
        ]
    },
};

function openFamilyHelp() {
    const tab = window._currentFamilyTab || 'feed';
    const help = FAMILY_HELP_CONTENT[tab];
    const sheet = document.getElementById('family-help-sheet');
    if (!sheet) return;
    if (!help) {
        document.getElementById('family-help-icon').textContent = '❓';
        document.getElementById('family-help-title').textContent = 'עזרה';
        document.getElementById('family-help-what').textContent = 'לפרטים נוספים פנה להורה או למנהל המשפחה.';
        document.getElementById('family-help-tips').innerHTML = '';
        sheet.classList.remove('hidden');
        return;
    }
    document.getElementById('family-help-icon').textContent = help.icon;
    document.getElementById('family-help-title').textContent = help.title;
    document.getElementById('family-help-what').textContent = help.what;
    document.getElementById('family-help-tips').innerHTML = help.tips
        .map(t => `<li class="flex items-start gap-2 text-sm text-slate-700 bg-white border border-slate-100 rounded-xl p-3 shadow-sm leading-relaxed">${t}</li>`)
        .join('');
    sheet.classList.remove('hidden');
}

function closeFamilyHelp() {
    const sheet = document.getElementById('family-help-sheet');
    if (sheet) sheet.classList.add('hidden');
}

// ============================================================
// === ניהול הבית — HOME MAINTENANCE MODULE ==================
// ============================================================

let hmItems = [], hmMaintenance = [], hmFaults = [], hmContacts = [];
let hmMaintenanceFilter = 'all', hmFaultsFilter = 'all';
let hmFaultNotes = {};

const HM_CAT_COLORS = { 'מקרר/הקפאה':'bg-blue-100 text-blue-700','תנור/אפייה':'bg-orange-100 text-orange-700','מזגן':'bg-cyan-100 text-cyan-700','חשמל':'bg-yellow-100 text-yellow-700','אינסטלציה':'bg-indigo-100 text-indigo-700','רכב':'bg-violet-100 text-violet-700','כללי':'bg-slate-100 text-slate-600' };
const HM_STATUS_COLORS = { 'active':'bg-emerald-100 text-emerald-700','inactive':'bg-amber-100 text-amber-700','disposed':'bg-red-100 text-red-700' };
const HM_STATUS_LABELS = { 'active':'פעיל','inactive':'לא פעיל','disposed':'הושלך' };
const HM_MTYPE_LABELS = { 'periodic':'תקופתי','repair':'תיקון','inspection':'בדיקה' };
const HM_MTYPE_COLORS = { 'periodic':'bg-blue-100 text-blue-700','repair':'bg-orange-100 text-orange-700','inspection':'bg-violet-100 text-violet-700' };
const HM_SEV_COLORS = { 'low':'bg-slate-100 text-slate-600','medium':'bg-amber-100 text-amber-700','high':'bg-orange-100 text-orange-700','critical':'bg-red-100 text-red-700' };
const HM_SEV_LABELS = { 'low':'נמוכה','medium':'בינונית','high':'גבוהה','critical':'קריטית' };
const HM_FSTATUS_LABELS = { 'open':'פתוח','in_progress':'בטיפול','resolved':'נסגר' };
const HM_FSTATUS_COLORS = { 'open':'bg-red-100 text-red-700','in_progress':'bg-blue-100 text-blue-700','resolved':'bg-emerald-100 text-emerald-700' };

async function loadHomeMaintenance() {
    if (!currentGroup) return;
    loadFamilyServiceCalls().catch(()=>{});
    await Promise.all([fetchHMItems(), fetchHMMaintenance(), fetchHMFaults(), fetchHMContacts()]);
    switchHomeMaintenanceTab('items');
    checkHMNotifications();
}

async function checkHMNotifications() {
    try {
        const res = await fetch(`/api/equipment/notifications/check/${currentGroup.id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success && data.created > 0) {
            const badge = document.getElementById('fgnav-bell-badge');
            if (badge) { badge.textContent = (parseInt(badge.textContent)||0) + data.created; badge.classList.remove('hidden'); }
        }
    } catch(e) {}
}

async function fetchHMItems() {
    try { const r = await fetch(`/api/equipment/items/${currentGroup.id}`); const d = await r.json(); if (d.success) hmItems = d.items; renderHMItems(); } catch(e) {}
}
async function fetchHMMaintenance() {
    try { const r = await fetch(`/api/equipment/maintenance/${currentGroup.id}`); const d = await r.json(); if (d.success) hmMaintenance = d.records; renderHMMaintenance(); updateHMBadge(); } catch(e) {}
}
async function fetchHMFaults() {
    try { const r = await fetch(`/api/equipment/faults/${currentGroup.id}`); const d = await r.json(); if (d.success) hmFaults = d.faults; renderHMFaults(); updateHMBadge(); } catch(e) {}
}
async function fetchHMContacts() {
    try {
        const r = await fetch(`/api/equipment/technicians/${currentGroup.id}`);
        const d = await r.json();
        if (d.success) hmContacts = d.technicians || [];
        renderHMContacts();
    } catch(e) { console.error('fetchHMContacts error:', e); }
}

function updateHMBadge() {
    const badge = getEl('tab-home-maintenance-badge');
    if (!badge) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const urgMaint = hmMaintenance.filter(m => !m.status === 'completed' && m.scheduled_date && new Date(m.scheduled_date) <= in7).length;
    const openFaults = hmFaults.filter(f => f.status !== 'resolved').length;
    const total = urgMaint + openFaults;
    if (total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}

function switchHomeMaintenanceTab(tab) {
    ['items','maintenance','faults','contacts'].forEach(t => {
        const v = getEl(`hm-view-${t}`); if (v) v.classList.toggle('hidden', t !== tab);
        const b = getEl(`hm-tab-${t}`);
        if (b) b.className = `flex-1 py-2 text-xs font-bold rounded-xl transition ${t === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`;
    });
    if (tab === 'items') renderHMItems();
    if (tab === 'maintenance') renderHMMaintenance();
    if (tab === 'faults') renderHMFaults();
    if (tab === 'contacts') renderHMContacts();
}

// --- ITEMS ---
function renderHMItems() {
    const list = getEl('hm-items-list'); if (!list) return;
    if (!hmItems.length) { list.innerHTML = `<div class="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-screwdriver-wrench text-4xl mb-3 opacity-30 block"></i><p class="text-sm font-medium">אין ציוד רשום עדיין</p></div>`; return; }
    list.innerHTML = hmItems.map(item => {
        const catColor = HM_CAT_COLORS[item.category] || 'bg-slate-100 text-slate-600';
        const stColor = HM_STATUS_COLORS[item.status] || '';
        const stLabel = HM_STATUS_LABELS[item.status] || item.status;
        const mCount = hmMaintenance.filter(m => m.equipment_id === item.id && m.status !== 'completed').length;
        const fCount = hmFaults.filter(f => f.equipment_id === item.id && f.status !== 'resolved').length;
        let warrantyHtml = '';
        if (item.warranty_expiry) {
            const exp = new Date(item.warranty_expiry);
            const diff = Math.ceil((exp - new Date()) / 86400000);
            warrantyHtml = `<span class="text-[10px] ${diff < 0 ? 'text-red-500' : diff < 30 ? 'text-amber-500' : 'text-slate-400'}"><i class="fa-regular fa-calendar ml-1"></i>${diff < 0 ? 'אחריות פגה' : 'אחריות עד ' + exp.toLocaleDateString('he-IL')}</span>`;
        }
        return `<div class="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(item.name)}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${catColor}">${safeStr(item.category)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${stColor}">${stLabel}</span>
                    </div>
                    ${item.serial_number ? `<p class="text-[11px] text-slate-400">מ"ס: ${safeStr(item.serial_number)}</p>` : ''}
                    ${warrantyHtml}
                    <div class="flex gap-2 mt-2 flex-wrap">
                        ${mCount > 0 ? `<span class="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><i class="fa-solid fa-wrench ml-1"></i>${mCount} תחזוקה</span>` : ''}
                        ${fCount > 0 ? `<span class="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><i class="fa-solid fa-triangle-exclamation ml-1"></i>${fCount} תקלות</span>` : ''}
                    </div>
                </div>
                <div class="flex gap-2 mr-2 shrink-0">
                    <button onclick="openHMHistory(${item.id})" title="היסטוריה" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-indigo-50 transition text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-clock-rotate-left text-xs"></i></button>
                    <button onclick="openHMItemModal(${item.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition text-slate-500"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMItem(${item.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 transition text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openHMItemModal(id = null) {
    let modal = getEl('hm-item-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-item-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmitem-modal-title" class="font-black text-slate-800 text-base">הוספת ציוד</h3>
                    <button onclick="getEl('hm-item-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmitem-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם הציוד / המכשיר *</label><input id="hmitem-name" type="text" placeholder="למשל: מקרר סמסונג, מזגן ביתי..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">קטגוריה</label>
                        <select id="hmitem-category" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="מקרר/הקפאה">מקרר/הקפאה</option><option value="תנור/אפייה">תנור/אפייה</option><option value="מזגן">מזגן</option><option value="חשמל">חשמל</option><option value="אינסטלציה">אינסטלציה</option><option value="רכב">רכב</option><option value="כללי" selected>כללי</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">מספר סידורי / דגם</label><input id="hmitem-serial" type="text" placeholder="אופציונלי" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך רכישה</label><input id="hmitem-purchase" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">פקיעת אחריות</label><input id="hmitem-warranty" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס</label>
                        <select id="hmitem-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="active">פעיל</option><option value="inactive">לא פעיל</option><option value="disposed">הושלך</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">איש קשר לתיקון</label><select id="hmitem-technician" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"><option value="">ללא שיוך</option></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערות</label><textarea id="hmitem-notes" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMItem()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-item-modal');
    }
    const item = id ? hmItems.find(x => x.id === id) : null;
    getEl('hmitem-modal-title').textContent = item ? 'עריכת ציוד' : 'הוספת ציוד';
    getEl('hmitem-id').value = item ? item.id : '';
    getEl('hmitem-name').value = item ? item.name : '';
    getEl('hmitem-category').value = item ? item.category : 'כללי';
    getEl('hmitem-serial').value = item ? (item.serial_number || '') : '';
    getEl('hmitem-purchase').value = item?.purchase_date ? item.purchase_date.split('T')[0] : '';
    getEl('hmitem-warranty').value = item?.warranty_expiry ? item.warranty_expiry.split('T')[0] : '';
    getEl('hmitem-status').value = item ? item.status : 'active';
    getEl('hmitem-notes').value = item ? (item.notes || '') : '';
    const techSel = getEl('hmitem-technician');
    techSel.innerHTML = '<option value="">ללא שיוך</option>' + hmContacts.map(t => `<option value="${t.id}">${safeStr(t.name)}${t.company_name ? ' — ' + safeStr(t.company_name) : ''}</option>`).join('');
    techSel.value = item ? (item.technician_id || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMItem() {
    const id = getEl('hmitem-id').value;
    const name = getEl('hmitem-name').value.trim();
    if (!name) { showToast('error', 'שם הציוד חובה'); return; }
    try {
        const res = await fetch('/api/equipment/items', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, name,
                category: getEl('hmitem-category').value, serialNumber: getEl('hmitem-serial').value||null,
                purchaseDate: getEl('hmitem-purchase').value||null, warrantyExpiry: getEl('hmitem-warranty').value||null,
                status: getEl('hmitem-status').value, notes: getEl('hmitem-notes').value||null,
                technicianId: getEl('hmitem-technician').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-item-modal').classList.add('hidden'); await fetchHMItems(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMItem(id) {
    if (!confirm('למחוק ציוד זה?')) return;
    try { await fetch(`/api/equipment/items/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMItems(); } catch(e) {}
}

// --- MAINTENANCE ---
function filterHMMaintenance(f) {
    hmMaintenanceFilter = f;
    ['all','pending','overdue','completed'].forEach(x => {
        const btn = getEl(`hmf-maint-${x}`);
        if (btn) btn.className = `shrink-0 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${x === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`;
    });
    renderHMMaintenance();
}

function renderHMMaintenance() {
    const list = getEl('hm-maintenance-list'); if (!list) return;
    const today = new Date(); today.setHours(0,0,0,0);
    let filtered = hmMaintenance.map(m => {
        let cs = m.status;
        if (m.status === 'pending' && m.scheduled_date && new Date(m.scheduled_date) < today) cs = 'overdue';
        return { ...m, cs };
    });
    if (hmMaintenanceFilter !== 'all') filtered = filtered.filter(m => m.cs === hmMaintenanceFilter);
    if (!filtered.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><p class="text-sm">אין רשומות תחזוקה</p></div>`; return; }
    list.innerHTML = filtered.map(m => {
        const tColor = HM_MTYPE_COLORS[m.maintenance_type] || 'bg-slate-100 text-slate-600';
        const tLabel = HM_MTYPE_LABELS[m.maintenance_type] || m.maintenance_type;
        let statusBadge;
        if (m.cs === 'completed') statusBadge = '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">בוצע ✓</span>';
        else if (m.cs === 'overdue') statusBadge = '<span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">פג תוקף ⚠</span>';
        else statusBadge = '<span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">ממתין</span>';
        const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('he-IL') : '—';
        return `<div class="bg-white border ${m.cs === 'overdue' ? 'border-red-200 bg-red-50/20' : 'border-slate-100'} rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="font-bold text-slate-800 text-sm">${safeStr(m.equipment_name)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${tColor}">${tLabel}</span>
                        ${statusBadge}
                    </div>
                    ${m.description ? `<p class="text-xs text-slate-500 mb-1">${safeStr(m.description)}</p>` : ''}
                    <div class="flex items-center gap-3 flex-wrap text-[10px] text-slate-400">
                        <span><i class="fa-regular fa-calendar ml-1"></i>${dateStr}</span>
                        ${m.technician_name ? `<span><i class="fa-solid fa-user-gear ml-1"></i>${safeStr(m.technician_name)}</span>` : ''}
                        ${m.cost ? `<span class="text-slate-600 font-bold">₪${parseFloat(m.cost).toLocaleString()}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col gap-2 mr-2 shrink-0">
                    ${m.cs !== 'completed' ? `<button onclick="completeHMMaintenance(${m.id})" class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg font-bold hover:bg-emerald-100 transition">✓ בצע</button>` : ''}
                    <button onclick="openHMMaintenanceModal(${m.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMMaintenance(${m.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openHMMaintenanceModal(id = null) {
    let modal = getEl('hm-maint-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-maint-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmmaint-modal-title" class="font-black text-slate-800 text-base">הוספת תחזוקה</h3>
                    <button onclick="getEl('hm-maint-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmmaint-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">ציוד *</label><select id="hmmaint-equipment" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סוג</label>
                        <select id="hmmaint-type" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="periodic">תקופתי</option><option value="repair">תיקון</option><option value="inspection">בדיקה</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">תיאור</label><textarea id="hmmaint-desc" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך מתוכנן</label><input id="hmmaint-date" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">עלות</label><input id="hmmaint-cost" type="number" placeholder="₪" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">חזרה אוטומטית (ימים)</label><input id="hmmaint-interval" type="number" placeholder="ריק = ללא חזרה" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div id="hmmaint-tech-row"><label class="text-xs font-bold text-slate-500 mb-1 block">איש קשר לתיקון</label>
                        <div class="flex gap-2">
                            <input id="hmmaint-tech-name" type="text" placeholder="שם" class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <input id="hmmaint-tech-phone" type="tel" placeholder="טלפון" class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                        </div>
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMMaintenance()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-maint-modal');
    }
    const rec = id ? hmMaintenance.find(x => x.id === id) : null;
    getEl('hmmaint-modal-title').textContent = rec ? 'עריכת תחזוקה' : 'הוספת תחזוקה';
    getEl('hmmaint-id').value = rec ? rec.id : '';
    const eqSel = getEl('hmmaint-equipment');
    eqSel.innerHTML = '<option value="">בחר ציוד...</option>' + hmItems.map(i => `<option value="${i.id}">${safeStr(i.name)}</option>`).join('');
    eqSel.value = rec ? rec.equipment_id : '';
    getEl('hmmaint-type').value = rec ? rec.maintenance_type : 'periodic';
    getEl('hmmaint-desc').value = rec ? (rec.description || '') : '';
    getEl('hmmaint-date').value = rec?.scheduled_date ? rec.scheduled_date.split('T')[0] : '';
    getEl('hmmaint-cost').value = rec ? (rec.cost || '') : '';
    getEl('hmmaint-interval').value = rec ? (rec.interval_days || '') : '';
    getEl('hmmaint-tech-name').value = rec ? (rec.technician_name || '') : '';
    getEl('hmmaint-tech-phone').value = rec ? (rec.technician_phone || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMMaintenance() {
    const id = getEl('hmmaint-id').value;
    const equipmentId = getEl('hmmaint-equipment').value;
    if (!equipmentId) { showToast('error', 'יש לבחור ציוד'); return; }
    try {
        const res = await fetch('/api/equipment/maintenance', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, equipmentId,
                maintenanceType: getEl('hmmaint-type').value, description: getEl('hmmaint-desc').value||null,
                scheduledDate: getEl('hmmaint-date').value||null, cost: getEl('hmmaint-cost').value||null,
                technicianName: getEl('hmmaint-tech-name').value||null, technicianPhone: getEl('hmmaint-tech-phone').value||null,
                intervalDays: getEl('hmmaint-interval').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-maint-modal').classList.add('hidden'); await fetchHMMaintenance(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function completeHMMaintenance(id) {
    try {
        const res = await fetch(`/api/equipment/maintenance/${id}/complete`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
        const data = await res.json();
        if (data.success) { showToast('success', data.nextScheduled ? 'בוצע! תחזוקה הבאה תוזמנה' : 'בוצע!'); await fetchHMMaintenance(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) {}
}

async function deleteHMMaintenance(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/maintenance/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMMaintenance(); } catch(e) {}
}

// --- FAULTS ---
function filterHMFaults(f) {
    hmFaultsFilter = f;
    ['all','open','in_progress','resolved'].forEach(x => {
        const btn = getEl(`hmf-fault-${x}`);
        if (btn) btn.className = `shrink-0 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${x === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`;
    });
    renderHMFaults();
}

function renderHMFaults() {
    const list = getEl('hm-faults-list'); if (!list) return;
    let filtered = hmFaultsFilter === 'all' ? hmFaults : hmFaults.filter(f => f.status === hmFaultsFilter);
    // קריאות שירות מהעסק — מוצגות תמיד בראש הרשימה
    const activeSC = (familyServiceCalls || []).filter(c => c.status !== 'cancelled' && c.status !== 'done');
    const scHtml = activeSC.map(c => {
        const SC_ST = { new:'ממתינה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים' };
        const sc_bg = { new:'border-blue-300 bg-blue-50', seen:'border-indigo-300 bg-indigo-50', in_progress:'border-amber-300 bg-amber-50', pending_parts:'border-purple-300 bg-purple-50' };
        const createdStr = c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
        const scheduledStr = c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : null;
        const borderBg = sc_bg[c.status] || 'border-slate-200 bg-white';
        return `<div onclick="openFamilyCallModal(${c.id})" class="border-r-4 ${borderBg} rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span class="text-[9px] font-black text-indigo-600 bg-white border border-indigo-200 px-1.5 py-0.5 rounded-full">🏢 קריאת שירות מהעסק</span>
                        ${c.business_name ? `<span class="text-[9px] text-slate-500">${safeStr(c.business_name)}</span>` : ''}
                    </div>
                    <div class="text-sm font-bold text-slate-800 truncate">${safeStr(c.title)}</div>
                    ${createdStr ? `<div class="text-[10px] text-slate-400">${createdStr}</div>` : ''}
                    ${scheduledStr ? `<div class="text-[10px] text-blue-600 font-bold">📅 ${scheduledStr}</div>` : '<div class="text-[10px] text-amber-600 font-bold">⚠️ ללא תאריך טיפול</div>'}
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current shrink-0">${SC_ST[c.status]||c.status}</span>
            </div>
        </div>`;
    }).join('');
    if (!filtered.length && !activeSC.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-circle-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm">אין תקלות</p></div>`; return; }
    if (!filtered.length) { list.innerHTML = scHtml; return; }
    list.innerHTML = scHtml + filtered.map(f => {
        const sColor = HM_SEV_COLORS[f.severity] || 'bg-slate-100 text-slate-600';
        const sLabel = HM_SEV_LABELS[f.severity] || f.severity;
        const stColor = HM_FSTATUS_COLORS[f.status] || 'bg-slate-100 text-slate-600';
        const stLabel = HM_FSTATUS_LABELS[f.status] || f.status;
        const dateStr = new Date(f.created_at).toLocaleDateString('he-IL');
        const notesCount = parseInt(f.notes_count) || 0;
        return `<div class="bg-white border ${f.severity === 'critical' ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start gap-3">
                ${f.image_url ? `<img src="${f.image_url}" class="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100 cursor-pointer" onclick="window.open('${f.image_url}','_blank')">` : ''}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(f.title)}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sColor}">${sLabel}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${stColor}">${stLabel}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-2">${safeStr(f.equipment_name)} · ${dateStr}</p>
                    <div class="flex gap-1 border-b border-slate-100 mb-2">
                        <button onclick="showHMFaultTab(${f.id},'details')" id="hmftab-details-${f.id}" class="text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50">פרטים</button>
                        <button onclick="showHMFaultTab(${f.id},'notes')" id="hmftab-notes-${f.id}" class="text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600">הערות${notesCount ? ` <span class="bg-indigo-100 text-indigo-700 rounded-full px-1.5">${notesCount}</span>` : ''}</button>
                    </div>
                    <div id="hmftab-content-details-${f.id}">
                        ${f.scheduled_date ? `<p class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg mb-1.5 flex items-center gap-1"><i class="fa-solid fa-calendar-check"></i> מתוזמן ל: ${new Date(f.scheduled_date).toLocaleString('he-IL', {dateStyle:'short',timeStyle:'short'})}</p>` : ''}
                        ${f.description ? `<p class="text-xs text-slate-500">${safeStr(f.description)}</p>` : ''}
                        ${f.resolution_notes ? `<p class="text-xs text-emerald-700 mt-1 bg-emerald-50 px-2 py-1 rounded-lg"><i class="fa-solid fa-check-circle ml-1"></i>${safeStr(f.resolution_notes)}</p>` : ''}
                        ${f.fault_tech_name ? `<p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-user-gear text-slate-400 ml-1"></i> ${safeStr(f.fault_tech_name)}${f.fault_tech_company ? ' — ' + safeStr(f.fault_tech_company) : ''}</p>` : ''}
                        ${(() => {
                            const phone = f.fault_tech_phone || (() => { const item = hmItems.find(i => i.id === f.equipment_id); return item?.technician_phone; })();
                            if (!phone || f.status === 'resolved') return '';
                            const techName = f.fault_tech_name || 'איש קשר';
                            const waMsg = encodeURIComponent(`שלום ${techName}, יש לנו בעיה: "${f.title}"${f.scheduled_date ? '. תאריך מבוקש: ' + new Date(f.scheduled_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}) : ''}`);
                            return `<div class="flex gap-1.5 mt-2 flex-wrap">
                                <a href="tel:${phone.replace(/\D/g,'')}" class="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100"><i class="fa-solid fa-phone"></i> חייג</a>
                                <a href="https://wa.me/${phone.replace(/\D/g,'')}?text=${waMsg}" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>
                                <a href="https://waze.com/ul?q=${encodeURIComponent(techName)}&navigate=yes" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100"><i class="fa-solid fa-location-arrow"></i> Waze</a>
                            </div>`;
                        })()}
                    </div>
                    <div id="hmftab-content-notes-${f.id}" class="hidden">
                        <div id="hm-fnotes-list-${f.id}" class="space-y-1.5 mb-2 max-h-40 overflow-y-auto"></div>
                        <button onclick="openHMAddNote(${f.id})" class="w-full text-[11px] font-bold text-indigo-600 border border-dashed border-indigo-200 rounded-xl py-1.5 hover:bg-indigo-50 transition">+ הוסף הערה</button>
                    </div>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="openHMFaultStatusPopup(${f.id})" title="שינוי סטטוס" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-arrows-rotate text-xs"></i></button>
                    <button onclick="openHMFaultModal(${f.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMFault(${f.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function showHMFaultTab(faultId, tab) {
    const dBtn = getEl(`hmftab-details-${faultId}`), nBtn = getEl(`hmftab-notes-${faultId}`);
    const dDiv = getEl(`hmftab-content-details-${faultId}`), nDiv = getEl(`hmftab-content-notes-${faultId}`);
    if (!dBtn) return;
    const active = 'text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50';
    const inactive = 'text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600';
    if (tab === 'details') { dBtn.className = active; nBtn.className = inactive; dDiv.classList.remove('hidden'); nDiv.classList.add('hidden'); }
    else { nBtn.className = active; dBtn.className = inactive; nDiv.classList.remove('hidden'); dDiv.classList.add('hidden'); await fetchAndRenderHMFaultNotes(faultId); }
}

async function fetchAndRenderHMFaultNotes(faultId) {
    const container = getEl(`hm-fnotes-list-${faultId}`); if (!container) return;
    try {
        const res = await fetch(`/api/equipment/faults/${faultId}/notes`);
        const data = await res.json();
        if (!data.success) return;
        hmFaultNotes[faultId] = data.notes;
        const stColors = { open: 'bg-orange-100 text-orange-700', in_progress: 'bg-blue-100 text-blue-700', resolved: 'bg-emerald-100 text-emerald-700' };
        const stLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
        if (!data.notes.length) { container.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-2">אין הערות עדיין</p>`; return; }
        container.innerHTML = data.notes.map(n => `<div class="bg-slate-50 rounded-xl px-3 py-2 text-xs">
            <div class="flex items-center justify-between gap-2 mb-0.5">
                <span class="text-slate-400 text-[10px]">${new Date(n.created_at).toLocaleDateString('he-IL')}</span>
                ${n.status_to ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stColors[n.status_to]||''}">${stLabels[n.status_to]||n.status_to}</span>` : ''}
            </div>
            <p class="text-slate-600">${safeStr(n.note)}</p>
        </div>`).join('');
    } catch(e) {}
}

function openHMFaultModal(id = null) {
    let modal = getEl('hm-fault-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-fault-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmfault-modal-title" class="font-black text-slate-800 text-base">דיווח בעיה</h3>
                    <button onclick="getEl('hm-fault-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmfault-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">ציוד *</label><select id="hmfault-equipment" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">כותרת הבעיה *</label><input id="hmfault-title" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">פירוט</label><textarea id="hmfault-desc" rows="3" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שלח לאיש קשר (איש מקצוע)</label>
                        <select id="hmfault-technician" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="">ללא שיוך לאיש קשר</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך ושעה מבוקשים (אופציונלי)</label>
                        <input id="hmfault-scheduled" type="datetime-local" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                    </div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">דחיפות</label>
                            <select id="hmfault-severity" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                                <option value="low">נמוכה</option><option value="medium" selected>בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option>
                            </select>
                        </div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס</label>
                            <select id="hmfault-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                                <option value="open">פתוח</option><option value="in_progress">בטיפול</option><option value="resolved">טופל</option>
                            </select>
                        </div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הוספת תמונה</label>
                        <label class="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                            <i class="fa-solid fa-camera text-slate-400"></i>
                            <span id="hmfault-img-label" class="text-xs text-slate-400">לחץ להוספת תמונה</span>
                            <input type="file" accept="image/*" class="hidden" onchange="handleHMFaultImage(this)">
                        </label>
                        <img id="hmfault-img-preview" class="hidden w-full max-h-40 object-contain rounded-xl border border-slate-100 mt-2">
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMFault()" class="w-full bg-red-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-red-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-fault-modal');
    }
    const fault = id ? hmFaults.find(x => x.id === id) : null;
    getEl('hmfault-modal-title').textContent = fault ? 'עריכת בעיה' : 'דיווח בעיה';
    getEl('hmfault-id').value = fault ? fault.id : '';
    const eqSel = getEl('hmfault-equipment');
    eqSel.innerHTML = '<option value="">בחר ציוד...</option>' + hmItems.map(i => `<option value="${i.id}">${safeStr(i.name)}</option>`).join('');
    eqSel.value = fault ? fault.equipment_id : '';
    getEl('hmfault-title').value = fault ? fault.title : '';
    getEl('hmfault-desc').value = fault ? (fault.description || '') : '';
    getEl('hmfault-severity').value = fault ? fault.severity : 'medium';
    getEl('hmfault-status').value = fault ? fault.status : 'open';
    // בורר איש קשר
    const techSel = getEl('hmfault-technician');
    techSel.innerHTML = '<option value="">ללא שיוך לאיש קשר</option>' + (hmContacts||[]).map(t => `<option value="${t.id}">${safeStr(t.name)}${t.company_name ? ' — ' + safeStr(t.company_name) : ''}</option>`).join('');
    techSel.value = fault ? (fault.technician_id || '') : '';
    // תאריך מבוקש
    const schedEl = getEl('hmfault-scheduled');
    if (schedEl) schedEl.value = fault?.scheduled_date ? new Date(fault.scheduled_date).toISOString().slice(0,16) : '';
    window._hmFaultImageData = fault ? (fault.image_url || null) : null;
    const preview = getEl('hmfault-img-preview');
    if (fault?.image_url) { preview.src = fault.image_url; preview.classList.remove('hidden'); getEl('hmfault-img-label').textContent = 'תמונה קיימת'; }
    else { preview.classList.add('hidden'); getEl('hmfault-img-label').textContent = 'לחץ להוספת תמונה'; }
    modal.classList.remove('hidden');
}

function handleHMFaultImage(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { window._hmFaultImageData = e.target.result; const p = getEl('hmfault-img-preview'); p.src = e.target.result; p.classList.remove('hidden'); getEl('hmfault-img-label').textContent = file.name; };
    reader.readAsDataURL(file);
}

async function submitHMFault() {
    const id = getEl('hmfault-id').value;
    const equipmentId = getEl('hmfault-equipment').value;
    const title = getEl('hmfault-title').value.trim();
    if (!equipmentId) { showToast('error', 'יש לבחור ציוד'); return; }
    if (!title) { showToast('error', 'כותרת חובה'); return; }
    const statusVal = getEl('hmfault-status').value;
    const technicianId = getEl('hmfault-technician')?.value || null;
    const scheduledDate = getEl('hmfault-scheduled')?.value || null;
    let resolvedDate = null;
    if (statusVal === 'resolved') {
        const existing = id ? hmFaults.find(x => x.id === parseInt(id)) : null;
        resolvedDate = existing?.resolved_date ? existing.resolved_date.split('T')[0] : new Date().toISOString().split('T')[0];
    }
    try {
        const res = await fetch('/api/equipment/faults', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, equipmentId, title,
                description: getEl('hmfault-desc').value||null, imageUrl: window._hmFaultImageData||null,
                severity: getEl('hmfault-severity').value, status: statusVal, resolvedDate,
                technicianId: technicianId||null, scheduledDate: scheduledDate||null }) });
        const data = await res.json();
        if (data.success) {
            showToast('success', id ? 'עודכן' : 'נרשם');
            getEl('hm-fault-modal').classList.add('hidden');
            await fetchHMFaults();
            // אם נבחר איש קשר — הצע שליחת וואצאפ
            if (!id && technicianId) {
                const tech = (hmContacts||[]).find(t => t.id == technicianId);
                if (tech?.phone) {
                    const msg = `שלום ${safeStr(tech.name)}, יש לנו בעיה ב"${title}". ${getEl('hmfault-desc').value ? 'פירוט: ' + getEl('hmfault-desc').value : ''} ${scheduledDate ? 'תאריך מבוקש: ' + new Date(scheduledDate).toLocaleString('he-IL') : ''}`;
                    if (confirm(`לשלוח וואצאפ ל-${tech.name}?`)) {
                        window.open(`https://wa.me/${tech.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }
                }
            }
        }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMFault(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/faults/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMFaults(); } catch(e) {}
}

function openHMFaultStatusPopup(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    let modal = getEl('hm-fault-status-popup');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-fault-status-popup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 class="font-black text-slate-800 text-sm">שינוי סטטוס</h3>
                    <button onclick="getEl('hm-fault-status-popup').classList.add('hidden')" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <div class="p-4 space-y-3">
                    <input type="hidden" id="hmfsp-id">
                    <p id="hmfsp-title" class="text-xs font-bold text-slate-500 truncate"></p>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס חדש</label>
                        <select id="hmfsp-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="open">פתוח</option><option value="in_progress">בטיפול</option><option value="resolved">טופל</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערה</label>
                        <textarea id="hmfsp-note" rows="3" placeholder="מה עודכן?" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMFaultStatus()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition">עדכן סטטוס</button></div>
            </div>
        </div>`);
        modal = getEl('hm-fault-status-popup');
    }
    getEl('hmfsp-id').value = fault.id;
    getEl('hmfsp-title').textContent = fault.title;
    getEl('hmfsp-status').value = fault.status;
    getEl('hmfsp-note').value = '';
    modal.classList.remove('hidden');
}

async function submitHMFaultStatus() {
    const id = getEl('hmfsp-id').value;
    const status = getEl('hmfsp-status').value;
    const note = getEl('hmfsp-note').value.trim();
    try {
        const res = await fetch(`/api/equipment/faults/${id}/status`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status, note, groupId: currentGroup.id }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'סטטוס עודכן'); getEl('hm-fault-status-popup').classList.add('hidden'); await fetchHMFaults(); setTimeout(() => showHMFaultTab(parseInt(id), 'notes'), 50); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openHMAddNote(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    let modal = getEl('hm-add-note-popup');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-add-note-popup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 class="font-black text-slate-800 text-sm">הוספת הערה</h3>
                    <button onclick="getEl('hm-add-note-popup').classList.add('hidden')" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <div class="p-4 space-y-3">
                    <input type="hidden" id="hmanp-id">
                    <p id="hmanp-title" class="text-xs font-bold text-slate-500 truncate"></p>
                    <textarea id="hmanp-note" rows="4" placeholder="כתוב הערה..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMNote()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition">שמור הערה</button></div>
            </div>
        </div>`);
        modal = getEl('hm-add-note-popup');
    }
    getEl('hmanp-id').value = faultId;
    getEl('hmanp-title').textContent = fault.title;
    getEl('hmanp-note').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => getEl('hmanp-note').focus(), 100);
}

async function submitHMNote() {
    const faultId = getEl('hmanp-id').value;
    const note = getEl('hmanp-note').value.trim();
    if (!note) { showToast('error', 'יש לכתוב הערה'); return; }
    try {
        const res = await fetch(`/api/equipment/faults/${faultId}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ note, groupId: currentGroup.id }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'הערה נשמרה'); getEl('hm-add-note-popup').classList.add('hidden'); await fetchHMFaults(); setTimeout(() => showHMFaultTab(parseInt(faultId), 'notes'), 50); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function sendHMFaultWhatsApp(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    const item = hmItems.find(i => i.id === fault.equipment_id); if (!item?.technician_phone) return;
    const msg = `שלום, יש לנו בעיה בבית:\n*${fault.title}*\nציוד: ${item.name}\n${fault.description ? 'פירוט: ' + fault.description : ''}`;
    window.open(`https://wa.me/${item.technician_phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- CONTACTS (אנשי קשר לתיקונים) ---
function renderHMContacts() {
    const list = getEl('hm-contacts-list'); if (!list) return;
    if (!hmContacts.length) { list.innerHTML = `<div class="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-address-book text-4xl mb-3 opacity-30 block"></i><p class="text-sm font-medium">אין אנשי קשר עדיין</p></div>`; return; }
    list.innerHTML = hmContacts.map(t => {
        const oneflowBadge = t.oneflow_verified ? `<span class="inline-flex items-center gap-1 text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200"><i class="fa-solid fa-circle-check"></i> ONEFLOW LIFE</span>` : '';
        const sendCallBtn = t.business_group_id ? `<button onclick="openServiceCallWizard(${t.id})" class="flex items-center gap-1 text-[10px] text-orange-700 font-black bg-orange-50 px-2 py-1 rounded-lg border border-orange-200 active:scale-95 transition" style="touch-action:manipulation;"><i class="fa-solid fa-wrench"></i> שלח קריאה</button>` : '';
        const linkBtn = !t.business_group_id ? `<button onclick="openLinkBusinessModal(${t.id})" class="flex items-center gap-1 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 active:scale-95 transition" style="touch-action:manipulation;"><i class="fa-solid fa-link"></i> קשר ל-ONEFLOW LIFE</button>` : '';
        return `<div class="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-0.5">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(t.name)}</h4>
                    ${oneflowBadge}                </div>
                ${t.company_name ? `<p class="text-[11px] text-indigo-600 font-medium">${safeStr(t.company_name)}</p>` : ''}
                ${t.specialty ? `<p class="text-[11px] text-slate-400">${safeStr(t.specialty)}</p>` : ''}
                <div class="flex gap-2 mt-2 flex-wrap">
                    ${t.phone ? `<a href="tel:${safeStr(t.phone)}" class="flex items-center gap-1 text-[10px] text-slate-600 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-200"><i class="fa-solid fa-phone text-emerald-500"></i> ${safeStr(t.phone)}</a>` : ''}
                    ${t.phone ? `<a href="https://wa.me/${t.phone.replace(/\D/g,'')}" target="_blank" class="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-2 py-1 rounded-lg border border-green-200"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>` : ''}
                    ${sendCallBtn}${linkBtn}
                </div>
            </div>
            <div class="flex gap-2 mr-2 shrink-0">
                <button onclick="openHMContactModal(${t.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteHMContact(${t.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>
    </div>`;
    }).join('');
}

// ─── SERVICE CALL WIZARD (Family side) ──────────────────────────────────────
let familyServiceCalls = [];

async function loadFamilyServiceCalls() {
    try {
        const r = await fetch(`/api/service-calls/family/${currentGroup.id}`);
        const d = await r.json();
        familyServiceCalls = d.calls || [];
        renderBusinessServiceCallsTab();
        try { renderHMFaults(); } catch(e) {}
    } catch(e) {}
}

function renderBusinessServiceCallsTab() {
    const list = getEl('my-service-calls-list');
    if (!list) return;
    const ST_LABEL = { new:'ממתינה לטיפול', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
    const ST_COLOR = { new:'border-blue-400', seen:'border-indigo-400', in_progress:'border-amber-400', pending_parts:'border-purple-400', done:'border-green-400', cancelled:'border-slate-300' };
    const ST_BG   = { new:'bg-blue-50', seen:'bg-indigo-50', in_progress:'bg-amber-50', pending_parts:'bg-purple-50', done:'bg-green-50', cancelled:'bg-slate-50' };
    const ST_TEXT = { new:'text-blue-700', seen:'text-indigo-700', in_progress:'text-amber-700', pending_parts:'text-purple-700', done:'text-green-700', cancelled:'text-slate-500' };
    const typeFilter = window._scTypeFilter || 'all';
    // עדכן כפתורי סינון
    ['all','external','internal'].forEach(t => {
        const btn = getEl(`sc-type-filter-${t}`);
        if (btn) btn.className = `text-[10px] px-2.5 py-1 rounded-lg font-bold transition ${t === typeFilter ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`;
    });
    const allActive = (familyServiceCalls || []).filter(c => c.status !== 'cancelled');
    const allFaults = (hmFaults || []).filter(f => f.status !== 'resolved');
    const active = typeFilter === 'internal' ? [] : allActive;
    const openFaults = typeFilter === 'external' ? [] : allFaults;
    if (!active.length && !openFaults.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <i class="fa-solid fa-wrench text-3xl text-slate-300 mb-2 block"></i>
            <p class="text-sm font-bold text-slate-500">${(allActive.length || allFaults.length) ? 'אין קריאות התואמות את הסינון.' : 'אין קריאות שירות פעילות'}</p>
            <p class="text-xs text-slate-400 mt-1">${(allActive.length || allFaults.length) ? '' : 'לפתיחת קריאה — כנסו לאיש קשר ובחרו "קריאת שירות"'}</p>
        </div>`;
        return;
    }
    const faultsHtml = openFaults.map(f => {
        const sev = { low:'🟢', normal:'🔵', medium:'🟠', high:'🔴', critical:'🚨' }[f.severity] || '⚠️';
        const stF = { open:'פתוחה', in_progress:'בטיפול' }[f.status] || f.status;
        return `<div onclick="switchTab('home-maintenance');setTimeout(()=>{switchHomeMaintenanceTab('faults')},150)" class="border-r-4 border-orange-300 bg-orange-50 rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="text-[9px] font-black text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-full">🏠 תקלה בבית</span>
                    </div>
                    <div class="text-sm font-bold text-slate-800 truncate">${sev} ${safeStr(f.title)}</div>
                    <div class="text-[10px] text-slate-500">${safeStr(f.equipment_name||'')} · ${stF}</div>
                </div>
                <span class="text-[9px] font-bold text-orange-600 bg-white border border-orange-200 px-2 py-0.5 rounded-full shrink-0">פרטים →</span>
            </div>
        </div>`;
    }).join('');
    const scHtml = active.map(c => {
        const borderCls = ST_COLOR[c.status] || 'border-slate-300';
        const bgCls = ST_BG[c.status] || 'bg-white';
        const textCls = ST_TEXT[c.status] || 'text-slate-600';
        const stLabel = ST_LABEL[c.status] || c.status;
        const createdStr = c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
        const scheduledStr = c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : null;
        const noDateFlag = (c.status !== 'done' && c.status !== 'cancelled' && !c.scheduled_at) ? `<span class="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">⚠️ ללא תאריך</span>` : '';
        const partsFlag = c.parts_status === 'parts_ready' ? `<span class="text-[9px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">✅ חלקים מוכנים</span>`
                        : (c.parts_status === 'pending_parts' || c.parts_status === 'waiting_delivery') ? `<span class="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold">📦 ממתין לחלקים</span>` : '';
        return `<div onclick="openFamilyCallModal(${c.id})" class="border-r-4 ${borderCls} ${bgCls} rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition bg-white shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-800 truncate">${safeStr(c.title)}</div>
                    <div class="text-[10px] text-slate-500">${c.business_name ? safeStr(c.business_name) : 'בעל מקצוע'}${createdStr ? ' · ' + createdStr : ''}</div>
                    ${scheduledStr ? `<div class="text-[10px] text-blue-600 font-bold mt-0.5">📅 ${scheduledStr}</div>` : ''}
                    ${(noDateFlag || partsFlag) ? `<div class="flex gap-1 flex-wrap mt-1">${noDateFlag}${partsFlag}</div>` : ''}
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border ${borderCls} ${textCls}">${stLabel}</span>
                    ${c.price_quote ? `<span class="text-[9px] text-indigo-700 font-bold">₪${parseFloat(c.price_quote).toFixed(0)}</span>` : ''}
                    ${c.rating ? `<span class="text-[10px]">${'⭐'.repeat(c.rating)}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
    list.innerHTML = scHtml + faultsHtml;
}

window.openFamilyCallModal = async function(callId) {
    const call = familyServiceCalls.find(c => c.id === callId);
    if (!call) return;
    let messages = [];
    try { const r = await fetch(`/api/service-calls/${callId}/messages`); const d = await r.json(); messages = d.messages||[]; } catch(e) {}
    document.getElementById('fam-sc-modal')?.remove();
    const SC_STATUS_LABELS_FAM = { new:'ממתינה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
    const msgHtml = messages.map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2">
        <div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs">
            <div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>
            ${safeStr(m.message)}
        </div>
    </div>`).join('');

    const partsHtml = call.parts_status ? (() => {
        const partsLabels = { pending_parts:'⏳ ממתין לחלקים', waiting_delivery:'🚚 חלקים בדרך', parts_ready:'✅ חלקים מוכנים' };
        const partsBgs = { pending_parts:'bg-purple-50 border-purple-200 text-purple-700', waiting_delivery:'bg-blue-50 border-blue-200 text-blue-700', parts_ready:'bg-green-50 border-green-200 text-green-700' };
        return `<div class="rounded-2xl p-3 border ${partsBgs[call.parts_status]||'bg-slate-50 border-slate-200 text-slate-600'}">
            <div class="text-[10px] font-bold mb-1">מצב חלקים</div>
            <div class="text-xs font-bold">${partsLabels[call.parts_status]||call.parts_status}</div>
        </div>`;
    })() : '';

    const canCancel = call.status === 'new' || call.status === 'seen';
    const canRate = call.status === 'done' && !call.rating;
    const alreadyRated = call.status === 'done' && call.rating;

    const rateHtml = canRate ? `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
        <div class="text-[10px] font-bold text-amber-700 mb-2">⭐ דרג את השירות</div>
        <div class="flex gap-2 justify-center" id="fam-sc-stars-${callId}">
            ${[1,2,3,4,5].map(n => `<button onclick="rateFamilyServiceCall(${callId},${n})" class="text-2xl text-slate-300 hover:text-amber-400 active:scale-90 transition" style="touch-action:manipulation;">★</button>`).join('')}
        </div>
    </div>` : alreadyRated ? `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
        <span class="text-sm font-bold text-amber-700">הדירוג שלך: ${'⭐'.repeat(call.rating)}</span>
    </div>` : '';

    const html = `<div id="fam-sc-modal" class="fixed inset-0 bg-white z-[9990] flex flex-col" style="direction:rtl;">
        <div class="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white shrink-0">
            <button onclick="document.getElementById('fam-sc-modal').remove()" class="text-xl"><i class="fa-solid fa-xmark"></i></button>
            <div class="flex-1 min-w-0">
                <div class="font-black text-sm truncate">${safeStr(call.title)}</div>
                <div class="text-[10px] opacity-80">${call.business_name ? safeStr(call.business_name) : 'בעל מקצוע'}</div>
            </div>
            <span class="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-lg">${SC_STATUS_LABELS_FAM[call.status]||call.status}</span>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div class="bg-slate-50 rounded-2xl p-3 text-sm space-y-1.5">
                ${call.created_at ? `<p class="text-[10px] text-slate-400">נפתחה: ${new Date(call.created_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
                ${call.description ? `<p class="text-slate-700 mt-1">${safeStr(call.description)}</p>` : ''}
                ${call.address ? `<p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot ml-1 text-indigo-400"></i>${safeStr(call.address)}</p>` : ''}
                ${call.requested_date ? `<p class="text-xs text-slate-500"><i class="fa-solid fa-calendar ml-1 text-amber-400"></i>תאריך מבוקש: ${new Date(call.requested_date).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
                ${call.scheduled_at ? `<p class="text-xs font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1 inline-flex items-center gap-1"><i class="fa-solid fa-calendar-check"></i> תאריך טיפול מתוזמן: ${new Date(call.scheduled_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>` : `<p class="text-[10px] text-amber-600 font-bold">⚠️ טרם תוזמן תאריך טיפול</p>`}
                ${call.price_quote ? `<div class="p-2 bg-indigo-50 rounded-xl text-xs font-bold text-indigo-800">הצעת מחיר מהעסק: ₪${parseFloat(call.price_quote).toFixed(0)}</div>` : ''}
            </div>
            ${partsHtml}
            ${rateHtml}
            <div class="bg-slate-50 rounded-2xl p-3">
                <div class="text-[10px] font-bold text-slate-500 mb-2">💬 שיחה עם בעל המקצוע</div>
                <div id="fam-sc-chat-${callId}" class="min-h-[80px] max-h-48 overflow-y-auto mb-2">${msgHtml || '<p class="text-center text-slate-400 text-xs py-4">אין הודעות עדיין</p>'}</div>
                ${call.status !== 'done' && call.status !== 'cancelled' ? `<div class="flex gap-2">
                    <input type="text" id="fam-sc-msg-${callId}" placeholder="כתוב הודעה..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <button onclick="sendFamilyScMessage(${callId})" class="bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-black active:scale-95 transition"><i class="fa-solid fa-paper-plane"></i></button>
                </div>` : ''}
            </div>
            ${canCancel ? `<button onclick="cancelFamilyServiceCall(${callId})" class="w-full border border-red-200 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-50 transition active:scale-95" style="touch-action:manipulation;">ביטול קריאה</button>` : ''}
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Chat polling every 10s
    if (window._famScChatInterval) clearInterval(window._famScChatInterval);
    window._famScChatInterval = setInterval(async () => {
        const chatEl = document.getElementById(`fam-sc-chat-${callId}`);
        if (!chatEl || !document.getElementById('fam-sc-modal')) { clearInterval(window._famScChatInterval); return; }
        try {
            const r2 = await fetch(`/api/service-calls/${callId}/messages`);
            const d2 = await r2.json();
            chatEl.innerHTML = (d2.messages||[]).map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2"><div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs"><div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>${safeStr(m.message)}</div></div>`).join('') || '<p class="text-center text-slate-400 text-xs py-4">אין הודעות עדיין</p>';
            chatEl.scrollTop = chatEl.scrollHeight;
        } catch(e) {}
    }, 10000);
};

window.sendFamilyScMessage = async function(callId) {
    const input = document.getElementById(`fam-sc-msg-${callId}`);
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    try {
        await fetch(`/api/service-calls/${callId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ senderType: 'family', senderName: currentUser?.nickname || 'משפחה', message: msg }) });
        const r = await fetch(`/api/service-calls/${callId}/messages`);
        const d = await r.json();
        const chatEl = document.getElementById(`fam-sc-chat-${callId}`);
        if (chatEl) {
            chatEl.innerHTML = (d.messages||[]).map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2">
                <div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs">
                    <div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>
                    ${safeStr(m.message)}
                </div>
            </div>`).join('');
            chatEl.scrollTop = chatEl.scrollHeight;
        }
    } catch(e) {}
};

window.cancelFamilyServiceCall = async function(callId) {
    if (!confirm('לבטל את הקריאה?')) return;
    try {
        const r = await fetch(`/api/service-calls/${callId}`, { method:'DELETE' });
        if (r.ok) {
            document.getElementById('fam-sc-modal')?.remove();
            await loadFamilyServiceCalls();
            if (typeof showToast === 'function') showToast('success', 'הקריאה בוטלה');
        }
    } catch(e) {}
};

window.rateFamilyServiceCall = async function(callId, rating) {
    try {
        const r = await fetch(`/api/service-calls/${callId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating }) });
        if (r.ok) {
            const idx = familyServiceCalls.findIndex(c => c.id === callId);
            if (idx >= 0) familyServiceCalls[idx].rating = rating;
            const starsEl = document.getElementById(`fam-sc-stars-${callId}`);
            if (starsEl) starsEl.parentElement.outerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center"><span class="text-sm font-bold text-amber-700">הדירוג שלך: ${'⭐'.repeat(rating)}</span></div>`;
            renderBusinessServiceCallsTab();
            if (typeof showToast === 'function') showToast('success', 'תודה על הדירוג!');
        }
    } catch(e) {}
};

window.openServiceCallWizard = function(technicianId) {
    const tech = hmContacts.find(t => t.id === technicianId);
    if (!tech) return;
    document.getElementById('sc-wizard-modal')?.remove();
    const html = `<div id="sc-wizard-modal" class="fixed inset-0 bg-slate-900/60 z-[9992] flex items-end justify-center sm:items-center sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-gradient-to-l from-indigo-50">
                <div>
                    <h3 class="font-black text-slate-800 text-base">🔧 קריאת שירות חדשה</h3>
                    <p class="text-xs text-indigo-600 font-medium mt-0.5">אל: ${safeStr(tech.name)}${tech.company_name ? ' · ' + safeStr(tech.company_name) : ''} <span class="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-black">ONEFLOW LIFE</span></p>
                </div>
                <button onclick="document.getElementById('sc-wizard-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"><i class="fa-solid fa-xmark text-slate-500"></i></button>
            </div>
            <div class="p-4 space-y-3 overflow-y-auto max-h-[65vh]">
                <input type="hidden" id="scw-tech-id" value="${technicianId}">
                <input type="hidden" id="scw-biz-id" value="${tech.business_group_id}">
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">תיאור הבעיה *</label>
                    <textarea id="scw-title" rows="2" placeholder="למשל: המזגן לא מקרר, ברז דולף..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">כתובת הטיפול</label>
                    <input id="scw-address" type="text" value="${[currentGroup?.city, currentGroup?.street_address].filter(Boolean).join(', ')}" placeholder="הרחוב שלך..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">פרטים נוספים (אופציונלי)</label>
                    <textarea id="scw-desc" rows="2" placeholder="הוסף מידע שיעזור לבעל המקצוע..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך מועדף לטיפול (אופציונלי)</label>
                    <input id="scw-requested-date" type="datetime-local" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">עדיפות</label>
                    <div class="grid grid-cols-4 gap-2">
                        ${[['low','נמוכה','🟢'],['normal','רגילה','🔵'],['high','גבוהה','🟠'],['urgent','דחוף','🔴']].map(([v,l,e]) =>
                            `<button type="button" onclick="scwSetPriority('${v}',this)" id="scwp-${v}" class="scwp-btn border rounded-xl py-2 text-xs font-bold text-slate-600 transition ${v==='normal'?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-slate-200'}" style="touch-action:manipulation;">${e}<br>${l}</button>`).join('')}
                    </div>
                    <input type="hidden" id="scw-priority" value="normal">
                </div>
            </div>
            <div class="p-4 border-t border-slate-100">
                <button onclick="submitServiceCallWizard()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition shadow-md">שלח קריאה → ${safeStr(tech.name)}</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.scwSetPriority = function(val, btn) {
    document.getElementById('scw-priority').value = val;
    document.querySelectorAll('.scwp-btn').forEach(b => b.className = b.className.replace('border-indigo-400 bg-indigo-50 text-indigo-700','border-slate-200').replace('border-indigo-400','border-slate-200'));
    btn.classList.remove('border-slate-200'); btn.classList.add('border-indigo-400','bg-indigo-50','text-indigo-700');
};

window.submitServiceCallWizard = async function() {
    const title = document.getElementById('scw-title')?.value?.trim();
    if (!title) { if(typeof showToast==='function') showToast('error','נא לתאר את הבעיה'); return; }
    const address = document.getElementById('scw-address')?.value?.trim();
    const desc = document.getElementById('scw-desc')?.value?.trim();
    const priority = document.getElementById('scw-priority')?.value || 'normal';
    const bizIdRaw = document.getElementById('scw-biz-id')?.value;
    const businessGroupId = (bizIdRaw && bizIdRaw !== 'null' && bizIdRaw !== 'undefined') ? parseInt(bizIdRaw) || null : null;
    const techIdRaw = document.getElementById('scw-tech-id')?.value;
    const techId = (techIdRaw && techIdRaw !== 'null' && techIdRaw !== 'undefined') ? parseInt(techIdRaw) || null : null;
    const requestedDate = document.getElementById('scw-requested-date')?.value || null;
    const customerName = currentUser?.nickname || currentUser?.name || null;
    try {
        const r = await fetch('/api/service-calls', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ familyGroupId: currentGroup.id, businessGroupId, technicianContactId: techId, title, description: desc||null, address: address||null, priority, createdByUserId: currentUser?.id, customerName, requestedDate }) });
        const d = await r.json();
        if (!r.ok) { if(typeof showToast==='function') showToast('error', d.error || 'שגיאה בשליחת הקריאה'); return; }
        document.getElementById('sc-wizard-modal')?.remove();
        if (typeof showToast === 'function') showToast('success', 'הקריאה נשלחה! 🎉');
        await loadFamilyServiceCalls();
        if (typeof switchTab === 'function') switchTab('myorders');
    } catch(e) { if(typeof showToast==='function') showToast('error','שגיאה בשליחת הקריאה'); }
};

window.openLinkBusinessModal = async function(techId) {
    document.getElementById('hm-link-biz-modal')?.remove();
    const isNew = (techId === null || techId === undefined);
    const subtitle = isNew
        ? 'חפש עסק ONEFLOW LIFE — אם נמצא, ייצור קשר חדש אוטומטית ותוכל לשלוח קריאות ישירות.'
        : 'חפש את שם העסק של בעל המקצוע ב-ONEFLOW LIFE כדי לאפשר שליחת קריאות ישירות.';
    const html = `<div id="hm-link-biz-modal" class="fixed inset-0 bg-slate-900/60 z-[9993] flex items-end justify-center sm:items-center sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-4 border-b border-slate-100">
                <h3 class="font-black text-slate-800 text-base">🔍 חיפוש עסק ONEFLOW LIFE</h3>
                <button onclick="document.getElementById('hm-link-biz-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"><i class="fa-solid fa-xmark text-slate-500"></i></button>
            </div>
            <div class="p-4 space-y-3">
                <p class="text-xs text-slate-500">${subtitle}</p>
                <input type="hidden" id="hm-link-tech-id" value="${techId ?? ''}">
                <select id="hm-link-type" onchange="searchBusinessForLink(document.getElementById('hm-link-search').value)" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none mb-1">
                    <option value="">כל סוגי העסקים</option>
                    <option value="electrician">חשמלאי</option>
                    <option value="plumber">אינסטלטור</option>
                    <option value="ac_tech">מיזוג אוויר</option>
                    <option value="carpenter">נגר</option>
                    <option value="painter">צבעי</option>
                    <option value="locksmith">מנעולן</option>
                    <option value="cleaner">ניקיון</option>
                    <option value="restaurant">מסעדה</option>
                    <option value="other">אחר</option>
                </select>
                <input id="hm-link-search" type="text" placeholder="שם עסק, טלפון..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none" oninput="searchBusinessForLink(this.value)" autofocus>
                <div id="hm-link-results" class="space-y-2 max-h-48 overflow-y-auto"></div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('hm-link-search')?.focus(), 100);
};

window.searchBusinessForLink = async function(q) {
    const el = document.getElementById('hm-link-results');
    if (!el || q.length < 2) { if(el) el.innerHTML = ''; return; }
    try {
        const bizType = document.getElementById('hm-link-type')?.value || '';
        const typeParam = bizType ? `&type=${encodeURIComponent(bizType)}` : '';
        const r = await fetch(`/api/groups/search-business?q=${encodeURIComponent(q)}${typeParam}`);
        const d = await r.json();
        if (!d.groups?.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">לא נמצאו עסקים</p>'; return; }
        const techIdVal = document.getElementById('hm-link-tech-id')?.value || '';
        el.innerHTML = d.groups.map(g => `<button onclick="linkTechToBusiness(${techIdVal||'null'}, ${g.id}, '${safeStr(g.name).replace(/'/g,"\\'")}', '${safeStr(g.phone||'').replace(/'/g,"\\'")}')" class="w-full text-right border border-slate-200 rounded-xl px-3 py-2.5 text-sm hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center gap-2 active:scale-[0.98]" style="touch-action:manipulation;">
            <i class="fa-solid fa-store text-indigo-400 shrink-0"></i>
            <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 text-xs">${safeStr(g.name)}</div><div class="text-[10px] text-slate-400">${g.business_type||'עסק'}${g.phone ? ' · ' + safeStr(g.phone) : ''}</div></div>
            <i class="fa-solid fa-link text-indigo-400 text-xs shrink-0"></i>
        </button>`).join('');
    } catch(e) {}
};

window.linkTechToBusiness = async function(techId, bizGroupId, bizName, bizPhone) {
    try {
        let newTech = null;
        if (!techId) {
            const r = await fetch('/api/equipment/technicians', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ groupId: currentGroup.id, name: bizName || 'בעל מקצוע', phone: bizPhone || null, businessGroupId: bizGroupId }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'שגיאת שרת');
            newTech = d.technician;
        } else {
            const r = await fetch(`/api/equipment/technicians/${techId}/link-business`, { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ businessGroupId: bizGroupId }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'שגיאה בקישור');
            newTech = d.technician;
        }
        // Immediately update local cache so contact appears even if fetchHMContacts is slow
        if (newTech && typeof hmContacts !== 'undefined') {
            hmContacts = [...(hmContacts||[]).filter(c => c.id !== newTech.id), newTech];
            if (typeof renderHMContacts === 'function') renderHMContacts();
        }
        document.getElementById('hm-link-biz-modal')?.remove();
        switchHomeMaintenanceTab('contacts');
        if(typeof showToast==='function') showToast('success', 'הוקשר בהצלחה! 🎉');
        fetchHMContacts(); // refresh in background without awaiting
    } catch(e) { console.error('linkTechToBusiness error:', e); if(typeof showToast==='function') showToast('error', e.message || 'שגיאה'); }
};

function openHMContactModal(id = null) {
    let modal = getEl('hm-contact-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-contact-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmcontact-modal-title" class="font-black text-slate-800 text-base">הוספת איש קשר לתיקון</h3>
                    <button onclick="getEl('hm-contact-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmcontact-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם *</label><input id="hmcontact-name" type="text" placeholder="למשל: יוסי האינסטלטור" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם חברה</label><input id="hmcontact-company" type="text" placeholder="אופציונלי" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">התמחות</label><input id="hmcontact-specialty" type="text" placeholder="למשל: אינסטלציה, חשמל, מזגנים..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">טלפון</label><input id="hmcontact-phone" type="tel" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">מייל</label><input id="hmcontact-email" type="email" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערות</label><textarea id="hmcontact-notes" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMContact()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-contact-modal');
    }
    const contact = id ? hmContacts.find(x => x.id === id) : null;
    getEl('hmcontact-modal-title').textContent = contact ? 'עריכת איש קשר' : 'הוספת איש קשר לתיקון';
    getEl('hmcontact-id').value = contact ? contact.id : '';
    getEl('hmcontact-name').value = contact ? contact.name : '';
    getEl('hmcontact-company').value = contact ? (contact.company_name || '') : '';
    getEl('hmcontact-specialty').value = contact ? (contact.specialty || '') : '';
    getEl('hmcontact-phone').value = contact ? (contact.phone || '') : '';
    getEl('hmcontact-email').value = contact ? (contact.email || '') : '';
    getEl('hmcontact-notes').value = contact ? (contact.notes || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMContact() {
    const id = getEl('hmcontact-id').value;
    const name = getEl('hmcontact-name').value.trim();
    if (!name) { showToast('error', 'שם חובה'); return; }
    try {
        const res = await fetch('/api/equipment/technicians', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, name,
                companyName: getEl('hmcontact-company').value||null, specialty: getEl('hmcontact-specialty').value||null,
                phone: getEl('hmcontact-phone').value||null, email: getEl('hmcontact-email').value||null,
                notes: getEl('hmcontact-notes').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-contact-modal').classList.add('hidden'); await fetchHMContacts(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMContact(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/technicians/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMContacts(); } catch(e) {}
}

// --- HISTORY ---
let hmHistItemId = null, hmHistData = [], hmHistTypeFilter = 'all', hmHistPeriodFilter = 'all';

async function openHMHistory(itemId) {
    const item = hmItems.find(x => x.id === itemId); if (!item) return;
    hmHistItemId = itemId; hmHistTypeFilter = 'all'; hmHistPeriodFilter = 'all';
    let modal = getEl('hm-history-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-history-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height:88vh">
                <div class="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div><h3 id="hmhist-title" class="font-black text-slate-800 text-base">היסטוריה</h3><p id="hmhist-subtitle" class="text-xs text-slate-400 mt-0.5"></p></div>
                    <button onclick="getEl('hm-history-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-4 border-b border-slate-100 space-y-2 shrink-0">
                    <input id="hmhist-search" type="text" placeholder="חיפוש..." oninput="renderHMHistFiltered()" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                    <div class="flex gap-2 flex-wrap">
                        <div class="flex gap-0.5 bg-slate-100 rounded-xl p-1">
                            <button onclick="setHMHistFilter('type','all')" id="hmhf-type-all" class="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 shadow-sm">הכל</button>
                            <button onclick="setHMHistFilter('type','maintenance')" id="hmhf-type-maintenance" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">🔧 תחזוקה</button>
                            <button onclick="setHMHistFilter('type','fault')" id="hmhf-type-fault" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">⚠️ בעיות</button>
                        </div>
                        <div class="flex gap-0.5 bg-slate-100 rounded-xl p-1">
                            <button onclick="setHMHistFilter('period','all')" id="hmhf-period-all" class="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 shadow-sm">הכל</button>
                            <button onclick="setHMHistFilter('period','month')" id="hmhf-period-month" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">חודש</button>
                            <button onclick="setHMHistFilter('period','3months')" id="hmhf-period-3months" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">3 חודשים</button>
                            <button onclick="setHMHistFilter('period','year')" id="hmhf-period-year" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">שנה</button>
                        </div>
                    </div>
                </div>
                <div id="hmhist-list" class="overflow-y-auto flex-1 p-4"></div>
            </div>
        </div>`);
        modal = getEl('hm-history-modal');
    }
    getEl('hmhist-title').textContent = `היסטוריה: ${item.name}`;
    getEl('hmhist-subtitle').textContent = 'טוען...';
    getEl('hmhist-search').value = '';
    modal.classList.remove('hidden');
    try {
        const res = await fetch(`/api/equipment/items/${itemId}/history?groupId=${currentGroup.id}`);
        const data = await res.json();
        if (data.success) { hmHistData = data.history; getEl('hmhist-subtitle').textContent = `${hmHistData.length} רשומות`; renderHMHistFiltered(); }
    } catch(e) { getEl('hmhist-subtitle').textContent = 'שגיאה בטעינה'; }
}

function setHMHistFilter(filterType, value) {
    if (filterType === 'type') { hmHistTypeFilter = value; ['all','maintenance','fault'].forEach(v => { const b = getEl(`hmhf-type-${v}`); if (b) b.className = `text-[11px] px-2.5 py-1 rounded-lg font-bold ${v === value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`; }); }
    else { hmHistPeriodFilter = value; ['all','month','3months','year'].forEach(v => { const b = getEl(`hmhf-period-${v}`); if (b) b.className = `text-[11px] px-2.5 py-1 rounded-lg font-bold ${v === value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`; }); }
    renderHMHistFiltered();
}

function renderHMHistFiltered() {
    const list = getEl('hmhist-list'); if (!list) return;
    const search = (getEl('hmhist-search')?.value || '').trim().toLowerCase();
    const periodMs = { month: 30, '3months': 90, year: 365 };
    const now = new Date();
    let filtered = hmHistData.filter(r => {
        if (hmHistTypeFilter !== 'all' && r.type !== hmHistTypeFilter) return false;
        if (hmHistPeriodFilter !== 'all') { const d = periodMs[hmHistPeriodFilter]; const c = new Date(now); c.setDate(c.getDate() - d); if (!r.event_date || new Date(r.event_date) < c) return false; }
        if (search) { const h = `${r.title} ${r.description||''} ${r.technician_name||''} ${r.resolution_notes||''}`.toLowerCase(); if (!h.includes(search)) return false; }
        return true;
    });
    if (!filtered.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-magnifying-glass text-2xl mb-2 opacity-30 block"></i><p class="text-sm">אין רשומות התואמות</p></div>`; return; }
    const mStatusLabels = { pending:'ממתין', completed:'בוצע', overdue:'באיחור' };
    const mStatusColors = { pending:'bg-amber-100 text-amber-700', completed:'bg-emerald-100 text-emerald-700', overdue:'bg-red-100 text-red-700' };
    list.innerHTML = filtered.map(r => {
        const dateStr = r.event_date ? new Date(r.event_date).toLocaleDateString('he-IL') : '';
        if (r.type === 'maintenance') {
            const stColor = mStatusColors[r.status] || 'bg-slate-100 text-slate-600';
            return `<div class="flex gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-sm">🔧</div>
                <div class="flex-1 bg-blue-50 rounded-xl p-3">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5"><span class="font-bold text-xs text-slate-800">${safeStr(r.title)}</span>${r.maintenance_type ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">${HM_MTYPE_LABELS[r.maintenance_type]||r.maintenance_type}</span>` : ''}<span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stColor}">${mStatusLabels[r.status]||r.status}</span></div>
                    <p class="text-[10px] text-slate-400">${dateStr}${r.technician_name ? ' · ' + safeStr(r.technician_name) : ''}${r.cost ? ' · ₪' + r.cost : ''}</p>
                    ${r.description && r.description !== r.title ? `<p class="text-[11px] text-slate-500 mt-0.5">${safeStr(r.description)}</p>` : ''}
                </div></div>`;
        } else {
            return `<div class="flex gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 text-sm">⚠️</div>
                <div class="flex-1 bg-red-50 rounded-xl p-3">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5"><span class="font-bold text-xs text-slate-800">${safeStr(r.title)}</span><span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${HM_SEV_COLORS[r.severity]||''}">${HM_SEV_LABELS[r.severity]||''}</span><span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${HM_FSTATUS_COLORS[r.status]||''}">${HM_FSTATUS_LABELS[r.status]||r.status}</span></div>
                    <p class="text-[10px] text-slate-400">${dateStr}</p>
                    ${r.description ? `<p class="text-[11px] text-slate-500">${safeStr(r.description)}</p>` : ''}
                    ${r.resolution_notes ? `<p class="text-[11px] text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded-lg">${safeStr(r.resolution_notes)}</p>` : ''}
                </div></div>`;
        }
    }).join('');
}
