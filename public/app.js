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
    ['feed','tasks','shop','myorders','bank','cashflow','community','academy','members','budget','pantry','recipes','forecast'].forEach(x => { 
        const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const targetContent = getEl(`content-${t}`); if(targetContent) targetContent.classList.remove('hidden'); 
    const targetBtn = getEl(`tab-${t}`); if(targetBtn) targetBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); const fab = getEl('fab-container'); if(fab) fab.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') try { renderPantry(); } catch(e) {}
    if (t === 'recipes') try { renderRecipePantrySelection(); } catch(e) {}
    if (t === 'forecast') try { renderForecast(); } catch(e) {}
    if (t === 'cashflow') try { renderCashflow(); } catch(e) {}
    if (t === 'community') try { fetchCommunityData(); } catch(e) {}
    if (t === 'myorders') try { fetchMyOrders(); } catch(e) {}
}

let myOrdersCache = [];

async function fetchMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">טוען הזמנות מהעסקים... <i class="fa-solid fa-spinner fa-spin ml-1"></i></p>';
    
    try {
        const res = await fetch(`${API}/store/orders/my/${currentUser.id}`);
        const data = await res.json();
        
        if (data.success) {
            myOrdersCache = data.orders || [];
            renderMyOrders();
        } else {
            list.innerHTML = `<p class="text-xs text-red-500 text-center py-10">${data.error || 'שגיאה בטעינת ההזמנות'}</p>`;
        }
    } catch (e) {
        list.innerHTML = '<p class="text-xs text-red-500 text-center py-10">שגיאת תקשורת מול השרת</p>';
    }
}

function renderMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;
    
    if (myOrdersCache.length === 0) {
        list.innerHTML = `
        <div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <i class="fa-solid fa-basket-shopping text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-500">אין לכם הזמנות פעילות מעסקים מקומיים.</p>
            <p class="text-xs text-slate-400 mt-1">כנסו לקהילה והתחילו להנות ממשלוחים והטבות!</p>
        </div>`;
        return;
    }

    let html = '';
    myOrdersCache.forEach(o => {
        let statusColor = '';
        let statusText = '';
        let progressPct = 0;
        let statusIcon = '';
        
        switch(o.status) {
            case 'quote':
                statusColor = 'border-slate-300 bg-slate-100'; 
                statusText = o.quote_status === 'approved' ? 'הצעת מחיר אושרה' : 'הצעת מחיר'; 
                progressPct = 10; 
                statusIcon = 'fa-file-invoice';
                break;
            case 'new': 
                statusColor = 'border-blue-200 bg-blue-50'; 
                statusText = 'התקבל בעסק'; 
                progressPct = 25; 
                statusIcon = 'fa-clock';
                break;
            case 'processing': 
                statusColor = 'border-orange-200 bg-orange-50'; 
                statusText = 'באריזה / הכנה'; 
                progressPct = 50; 
                statusIcon = 'fa-box';
                break;
            case 'ready': 
                statusColor = 'border-purple-200 bg-purple-50'; 
                statusText = 'מוכן לאיסוף'; 
                progressPct = 75; 
                statusIcon = 'fa-bag-shopping';
                break;
            case 'shipped': 
                statusColor = 'border-indigo-200 bg-indigo-50'; 
                statusText = o.is_delivery ? 'בדרך אליך! 🛵' : 'בדרך אלייך!'; 
                progressPct = 90; 
                statusIcon = o.is_delivery ? 'fa-motorcycle' : 'fa-truck-fast';
                break;
            case 'completed': 
                statusColor = 'border-green-200 bg-green-50'; 
                statusText = 'הושלם ונמסר'; 
                progressPct = 100; 
                statusIcon = 'fa-check-double';
                break;
            default: 
                statusColor = 'border-slate-200 bg-slate-50'; 
                statusText = 'בטיפול'; 
                progressPct = 10;
                statusIcon = 'fa-spinner fa-spin';
        }

        const dateStr = new Date(o.created_at).toLocaleDateString('he-IL', {hour: '2-digit', minute:'2-digit'});
        
        html += `
        <div class="bg-white rounded-2xl shadow-sm border ${statusColor} overflow-hidden transition-all hover:shadow-md cursor-pointer" onclick="document.getElementById('order-details-${o.id}').classList.toggle('hidden')">
            <div class="p-4 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm shrink-0 border border-slate-100">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(o.store_name || 'עסק מקומי')}</h4>
                        <p class="text-[10px] text-slate-500"><i class="fa-solid ${statusIcon} ml-1"></i> ${statusText} • ${dateStr}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="font-black text-slate-800 dir-ltr text-sm">₪${parseFloat(o.total_amount).toFixed(2)}</span>
                    <span class="text-[9px] text-slate-400 font-mono tracking-widest mt-0.5">#${o.id}</span>
                </div>
            </div>
            
            <div id="order-details-${o.id}" class="hidden border-t border-slate-100/50 bg-white/50 p-4">
                <div class="mb-4 ${o.status === 'quote' ? 'hidden' : ''}">
                    <div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>התקבל</span>
                        <span>בהכנה</span>
                        <span>במשלוח</span>
                        <span>נמסר</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden shadow-inner">
                        <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000" style="width: ${progressPct}%"></div>
                    </div>
                </div>
                <div class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="font-bold mb-2">פירוט ההזמנה/ההצעה:</p>
                    <div class="whitespace-pre-line leading-relaxed">${safeStr(o.items_json || o.items)}</div>
                    ${o.notes ? `<p class="mt-2 pt-2 border-t border-slate-200"><strong>הערות:</strong> ${safeStr(o.notes)}</p>` : ''}
                </div>
            </div>
        </div>
        `;
    });
    list.innerHTML = html;
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

    // הצגת באנר השתלטות
    const saTokenLocal = localStorage.getItem('ofl_sa_token');
    const impBanner = document.getElementById('sa-impersonation-banner');
    
    if (saTokenLocal && impBanner) {
        impBanner.classList.remove('hidden');
        impBanner.classList.add('flex'); // חשוב לתצוגה נכונה עם Tailwind
    } else if (impBanner) {
        impBanner.classList.add('hidden');
        impBanner.classList.remove('flex');
    }

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
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        // קריאה לרינדור הקהילות ממש כאן!
        try { renderFamilyCommunities(window.communityBusinessesCache); } catch(e) {}
        
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
                contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${item.amount}</span></div>`;
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
            users.forEach(u => { list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${safeStr(u.nickname)}</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-700 transition">אשר למשפחה</button></div></div>`; }); 
        } else { if(container) container.classList.add('hidden'); } 
    } catch(e) {} 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'אושר כבן משפחה!'); fetchPendingUsers(); fetchMembers(); }
function openProfileModal() { getEl('old-password').value = ''; getEl('new-password').value = ''; getEl('profile-modal').classList.remove('hidden'); }
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
    } catch(e) { console.error('Error fetching community data', e); }
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

    // מנקה אלמנטים ישנים של הממשק הקודם מה-DOM במידה וקיימים
    const oldJoin = getEl('community-join-section');
    const oldBiz = getEl('community-businesses-section');
    if (oldJoin) oldJoin.style.display = 'none';
    if (oldBiz) oldBiz.style.display = 'none';

    let container = getEl('multi-comm-dynamic-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'multi-comm-dynamic-container';
        const topBanner = tabContent.querySelector('.bg-gradient-to-r');
        if (topBanner) {
            topBanner.insertAdjacentElement('afterend', container);
        } else {
            tabContent.prepend(container);
        }
    }

    let html = '';

    // 1. הקהילות שלי (או הבאנר הראשי המאוחד במידה ואין קהילות)
    if (myConnectedCommunitiesCache.length > 0) {
        html += `<div class="mb-6">
                    <h3 class="font-bold text-slate-800 mb-3"><i class="fa-solid fa-house-flag text-indigo-500"></i> הקהילות שלי (${myConnectedCommunitiesCache.length}/5)</h3>
                    <div class="space-y-2">`;
        myConnectedCommunitiesCache.forEach(c => {
            html += `
            <div class="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex justify-between items-center shadow-sm fade-in">
                <div>
                    <h4 class="font-bold text-indigo-900 text-sm">${safeStr(c.name)}</h4>
                    <p class="text-[10px] text-indigo-700">אזורים: ${safeStr(c.city || 'כללי')}</p>
                </div>
                <button onclick="leaveCommunity(${c.id}, '${safeStr(c.name)}')" class="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition border border-transparent hover:border-red-200">התנתק</button>
            </div>`;
        });
        html += `</div>`;
        
        if (myConnectedCommunitiesCache.length < 5) {
            html += `<button onclick="document.getElementById('dynamic-join-section').classList.toggle('hidden')" class="w-full mt-3 bg-white border border-dashed border-slate-300 text-slate-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition fade-in"><i class="fa-solid fa-plus"></i> הצטרפות לקהילה נוספת</button>`;
        }
        html += `</div>`;
    } else {
        // הבאנר הקומפקטי שביקשת
        html += `
            <div class="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 mb-6 mt-2 shadow-sm fade-in flex items-center gap-4 text-right">
                <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500 text-2xl shrink-0">
                    <i class="fa-solid fa-users-rays"></i>
                </div>
                <div>
                    <h3 class="font-bold text-indigo-900 text-sm mb-0.5">הכוח של הקהילה בידיים שלכם</h3>
                    <p class="text-[10px] text-indigo-700 font-medium leading-tight">
                        התחברו לקהילות קיימות באזורכם או צרו קהילה חדשה בעצמכם כדי לקבל מידע חשוב, הטבות והנחות מעסקים מקומיים ועסקים אחרים!
                    </p>
                </div>
            </div>
        `;
    }

    // 2. טופס הצטרפות קבוע ויפה
    const hideJoin = myConnectedCommunitiesCache.length > 0 ? 'hidden' : '';
    html += `
    <div id="dynamic-join-section" class="${hideJoin} mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-center fade-in">
        <h3 class="font-bold text-slate-800 text-sm mb-1"><i class="fa-solid fa-plug text-slate-400 mr-1"></i> התחברות לקהילה קיימת</h3>
        <p class="text-[11px] text-slate-500 mb-4">הזינו את קוד הקהילה שקיבלתם מחבר כדי להצטרף אליה.</p>
        <div class="flex gap-2">
            <input type="text" id="community-code-input-dyn" class="modern-input py-2 text-sm text-center font-mono uppercase tracking-widest flex-1" placeholder="למשל: C-XYZ123">
            <button onclick="joinCommunityDyn()" class="bg-slate-900 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition text-sm">התחבר</button>
        </div>
    </div>`;

    // 3. עסקים בקהילות שלנו
    if (myCommunityBusinessesCache.length > 0) {
        html += `
        <div class="mb-6 fade-in">
            <div class="flex items-center justify-between mb-4 px-1">
                <h2 class="text-lg font-black text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-shop text-emerald-500"></i>
                    עסקים בקהילות שלנו
                </h2>
            </div>
            <div class="space-y-3">
        `;
        myCommunityBusinessesCache.forEach(biz => {
            const storeLink = `${window.location.origin}/storefront.html?store=${biz.group_code}&communityId=${biz.community_id}`;
            html += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between hover:border-emerald-100 transition-colors">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(biz.business_name)}</h4>
                        <div class="flex flex-wrap gap-1 mt-1">
                            <span class="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                ${biz.discount_pct}% הנחה
                            </span>
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
        html += `</div></div>`;
    }

    // 4. מיכל שבו נצייר את מודול "יזמות קהילתית" שלנו
    html += `<div id="my-initiatives-container"></div>`;
    
    container.innerHTML = html;

    // קריאה קריטית לרינדור יוזמות כדי שלא ימחקו לעולם!
    renderMyInitiatives();
}

async function joinCommunityDyn() {
    const code = getEl('community-code-input-dyn').value;
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
    ['stats', 'comm', 'content', 'users', 'biz'].forEach(t => {
        const view = document.getElementById(`sa-view-${t}`);
        const btn = document.getElementById(`btn-sa-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 py-3 px-4 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition';
    });
    
    const activeView = document.getElementById(`sa-view-${tabId}`);
    const activeBtn = document.getElementById(`btn-sa-tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold bg-white text-slate-800 rounded-xl shadow-sm transition';
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

        return `
        <div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm">
            <div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')">
                <div class="font-bold text-slate-700 flex items-center gap-2">
                    <i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-widest border border-slate-200">קוד: ${safeStr(f.group_code || '---')}</span>
                    <i class="fa-solid fa-chevron-down text-[10px] text-slate-300"></i>
                </div>
            </div>
            <div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">
                ${usersHtml}
            </div>
        </div>`;
    }).join('');
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
    { id: 'forecast', name: 'תשקיף כלכלי 📅' }
];

const ROLE_DEFAULTS = {
    'ADMIN': ALL_TABS.map(t => t.id),
    'MANAGER': ['feed', 'tasks', 'shop', 'pantry', 'academy', 'recipes'],
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
            // החלפת סמל הדפדפן (Favicon) - אם מוגדר
            if (data.globalAiLogo) {
                const link = document.querySelector("link[rel~='icon']");
                if (link) link.href = data.globalAiLogo;
            }

            // בניית קרוסלת ההתחברות (Login Slider)
            if (data.loginSlides && data.loginSlides.length > 0) {
                const scroll = document.getElementById('login-slider-scroll');
                const dots = document.getElementById('login-slider-dots');
                
                if (scroll && dots) {
                    // מעלימים את הגלילה הידנית
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
    
    // סימון הקריאה כנקראה מיידית כדי להוריד את בועת ההתראה
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
    
    // בניית מסך הקריאה
    let msgModal = document.getElementById('inbox-read-modal');
    if (!msgModal) {
        msgModal = document.createElement('div');
        msgModal.id = 'inbox-read-modal';
        msgModal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(msgModal);
    }
    
    const d = new Date(msg.created_at);
    const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
    
    msgModal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
            <div class="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-start">
                <div class="pr-8">
                    <h3 class="font-bold text-slate-800 text-lg leading-tight mb-2">${safeStr(msg.subject)}</h3>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <span class="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><i class="fa-solid fa-user-circle text-blue-400"></i> ${safeStr(msg.sender_name)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </div>
                </div>
                <button onclick="document.getElementById('inbox-read-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                ${safeStr(msg.content)}
            </div>
            
            <div class="p-4 bg-slate-50 border-t border-slate-100 text-center">
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
        // בניה מורחבת של קונטקסט (כדי לספק ל-AI מספיק היסטוריה לחיזוי ולפעולות מורכבות)
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
                userId: currentUser.id, // הוספנו את המזהה כדי שהשרת יוכל לרשום פעולות על שמו
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
            container.innerHTML += `
                <div class="flex w-full justify-start mt-2 fade-in">
                    <div class="max-w-[85%] flex flex-col items-start text-right">
                        <span class="text-[10px] font-bold text-purple-600 mb-1 px-1 flex items-center gap-1"><i class="fa-solid fa-robot"></i> FamilAI</span>
                        <div class="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm bg-white border border-purple-100 text-slate-800 rounded-tr-none">
                            ${formattedAns}
                        </div>
                        <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${aiTime}</span>
                    </div>
                </div>
            `;
            // רענון מיידי של נתוני הרקע! אם ה-AI פתחה משימה, היא תופיע מיד בטאבים.
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
