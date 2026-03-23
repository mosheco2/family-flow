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
            if(session && session.user && session.group) { 
                // בדיקת סוג החשבון להפניה אוטומטית לעסק
                if (session.group.type === 'BUSINESS') {
                    window.location.href = '/business.html';
                    return;
                }
                
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
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

async function saveAllBanners() {
    const safeVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    
    const topText = safeVal('sa-banner-top-text'); 
    const topLink = safeVal('sa-banner-top-link'); 
    const topImg = safeVal('sa-banner-top-img');
    const bottomText = safeVal('sa-banner-bottom-text'); 
    const bottomLink = safeVal('sa-banner-bottom-link'); 
    const bottomImg = safeVal('sa-banner-bottom-img');
    
    const bizTopText = safeVal('sa-biz-banner-top-text'); 
    const bizTopLink = safeVal('sa-biz-banner-top-link'); 
    const bizTopImg = safeVal('sa-biz-banner-top-img');
    const bizBottomText = safeVal('sa-biz-banner-bottom-text'); 
    const bizBottomLink = safeVal('sa-biz-banner-bottom-link'); 
    const bizBottomImg = safeVal('sa-biz-banner-bottom-img');
    
    try {
        const res = await fetch(`${API}/superadmin/banners`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ 
                topText, topLink, topImg, bottomText, bottomLink, bottomImg,
                bizTopText, bizTopLink, bizTopImg, bizBottomText, bizBottomLink, bizBottomImg 
            }) 
        });
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'הבאנרים נשמרו במערכת בהצלחה!'); 
            fetchBanners(); 
        } else { 
            showToast('error', 'שגיאה בשמירת הבאנרים'); 
        }
    } catch(e) { 
        showToast('error', 'תקלת רשת מול השרת בשמירת באנרים'); 
    }
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

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        // מילוי שדות ההודעות
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
        // מילוי שדות הבאנרים
        const topTextEl = document.getElementById('sa-banner-top-text');
        if(topTextEl) topTextEl.value = data.adBannerTextTop || '';
        const topLinkEl = document.getElementById('sa-banner-top-link');
        if(topLinkEl) topLinkEl.value = data.adBannerLinkTop || '';
        const topImgEl = document.getElementById('sa-banner-top-img');
        if(topImgEl) topImgEl.value = data.adBannerImgTop || '';
        
        const bottomTextEl = document.getElementById('sa-banner-bottom-text');
        if(bottomTextEl) bottomTextEl.value = data.adBannerTextBottom || '';
        const bottomLinkEl = document.getElementById('sa-banner-bottom-link');
        if(bottomLinkEl) bottomLinkEl.value = data.adBannerLinkBottom || '';
        const bottomImgEl = document.getElementById('sa-banner-bottom-img');
        if(bottomImgEl) bottomImgEl.value = data.adBannerImgBottom || '';

        // מילוי שדות הבאנרים - עסקים
        const bizTopText = document.getElementById('sa-biz-banner-top-text');
        const bizTopLink = document.getElementById('sa-biz-banner-top-link');
        const bizTopImg = document.getElementById('sa-biz-banner-top-img');
        const bizBottomText = document.getElementById('sa-biz-banner-bottom-text');
        const bizBottomLink = document.getElementById('sa-biz-banner-bottom-link');
        const bizBottomImg = document.getElementById('sa-biz-banner-bottom-img');
        
        if(bizTopText) bizTopText.value = data.bizBannerTextTop || '';
        if(bizTopLink) bizTopLink.value = data.bizBannerLinkTop || '';
        if(bizTopImg) bizTopImg.value = data.bizBannerImgTop || '';
        if(bizBottomText) bizBottomText.value = data.bizBannerTextBottom || '';
        if(bizBottomLink) bizBottomLink.value = data.bizBannerLinkBottom || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

        // עדכון כרטיסיות נתונים
        const statFamilies = document.getElementById('sa-stat-families');
        if (statFamilies && data.stats) statFamilies.innerText = data.stats.families || 0;
        const statBiz = document.getElementById('sa-stat-businesses');
        if (statBiz && data.stats) statBiz.innerText = data.stats.businesses || 0;
        const statFamUsers = document.getElementById('sa-stat-family-users');
        if (statFamUsers && data.stats) statFamUsers.innerText = data.stats.familyUsers || 0;
        const statBizUsers = document.getElementById('sa-stat-biz-users');
        if (statBizUsers && data.stats) statBizUsers.innerText = data.stats.businessUsers || 0;

        const actList = document.getElementById('sa-activity-list');
        if(actList) {
            actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | ${a.group_name} | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`; }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        }
        
        saAllGroups = data.groups; saAllUsers = data.users; renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); console.error(e); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); let gHtml = ''; const term = filterText.toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role === 'ADMIN' ? 'הורה/מנהל' : 'בן משפחה'})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים רשומים.</p>';
        
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        
        // התאמה לעסקים: הצגת סוג ותאריך
        const typeBadge = g.type === 'BUSINESS' 
            ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200"><i class="fa-solid fa-briefcase mr-1"></i> עסק</span>' 
            : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-emerald-200"><i class="fa-solid fa-house mr-1"></i> משפחה</span>';
            
        const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'לא ידוע';

        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid ${g.type === 'BUSINESS' ? 'fa-building' : 'fa-users'}"></i></div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${isPro} ${typeBadge}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | <span class="font-sans text-[10px]">הוקם: ${createdDate}</span></p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2"><button onclick="open360Report(${g.id})" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-eye"></i> דוח 360</button>${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחיקה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { const term = document.getElementById('sa-search-group').value; renderSAGroups(term); }
async function saDeleteUser(id) { if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return; await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'משתמש נמחק'); loadSAData(); }
async function saDeleteGroup(id) { if(!confirm('האם למחוק סביבה זו לצמיתות?')) return; await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); showToast('success', 'הסביבה נמחקה לחלוטין'); loadSAData(); }

async function saveWelcomeMsg(type = 'FAMILY') { 
    const valId = type === 'BUSINESS' ? 'sa-biz-welcome-msg' : 'sa-welcome-msg';
    const msg = val(valId);
    const body = type === 'BUSINESS' ? { businessWelcomeMsg: msg } : { welcomeMsg: msg };
    
    try {
        await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify(body) }); 
        showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!'); 
    } catch(e) {
        showToast('error', 'שגיאה בשמירת ההודעה');
    }
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=FAMILY`); const data = await res.json();
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

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); document.getElementById(`view-${view}`).classList.remove('hidden'); }
function selectType(t) { document.getElementById('create-type').value=t; document.getElementById('type-family').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; document.getElementById('type-group').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל המשפחה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // בדיקת סוג חשבון לאחר התחברות או יצירת סביבה חדשה
            if (currentGroup.type === 'BUSINESS') {
                window.location.href = '/business.html';
                return;
            }
            
            await loadDashboard(); 
        } else {
            showToast('error', data.error); 
        }
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
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
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
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
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${m.role === 'ADMIN' ? 'הורה/מנהל' : 'ילד/בן משפחה'})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
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

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
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
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); if (document.getElementById('tab-cashflow').classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) {}
}

function showFamilAIModal(title, text) {
    document.getElementById('familai-advisor-modal').classList.remove('hidden'); document.getElementById('familai-modal-subtitle').innerText = title;
    if (text) { document.getElementById('familai-advisor-loading').classList.add('hidden'); document.getElementById('familai-advice-text').innerText = text; document.getElementById('familai-advisor-content').classList.remove('hidden'); } 
    else { document.getElementById('familai-advisor-loading').classList.remove('hidden'); document.getElementById('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { document.getElementById('ai-modal').classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת המבחן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית של המשפחה', null); document.getElementById('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); fetchData(); } 
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
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

async function getPantryInsight() {
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
    
    const btn = document.getElementById('btn-submit-task');
    if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    
    const statusToSend = isSelf ? 'done' : 'pending';
    try {
        await fetch(`${API}/tasks`, { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend, groupId: currentGroup.id }) 
        }); 
        if(isSelf) triggerConfetti(); 
        closeTaskModal(); 
        showToast('success', isSelf ? 'נשלח לאישור ההורה!' : 'משימה נוצרה בהצלחה!'); 
        fetchData(); 
    } catch(e) {
        showToast('error', 'שגיאת שרת ביצירת משימה');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'צור משימה'; }
    }
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

function closeBarcodeScanner() { const modal = document.getElementById('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

function openPantryUseModal(name, unit) { document.getElementById('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; document.getElementById('use-pantry-name').value = name; document.getElementById('use-pantry-qty').value = ''; document.getElementById('use-pantry-unit-display').innerText = unit || "יח'"; document.getElementById('pantry-use-modal').classList.remove('hidden'); }

async function submitPantryUse() {
    const name = val('use-pantry-name'); const qty = val('use-pantry-qty'); const units = val('use-pantry-units');
    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: parseFloat(qty) || 0, usedUnits: parseFloat(units) || 0 }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); document.getElementById('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2"><div class="flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${p.units_per_package || 1} יח'</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity} ${p.unit || "יח'"}</span><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div></div></div><div class="flex gap-2 mt-1 border-t border-slate-50 pt-2"><button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-orange-50 text-orange-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-orange-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils"></i> השתמשתי</button><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-pink-50 text-pink-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-pink-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> חסר (לקניות)</button></div></div>`;
    });
}

function openPantryModal() { document.getElementById('pantry-modal').classList.remove('hidden'); }

async function submitPantryItem() {
    const name = val('pantry-item'); 
    const qty = parseFloat(val('pantry-quantity')) || 1; 
    const unit = val('pantry-unit') || "יח'"; 
    const upp = parseInt(val('pantry-upp')) || 1; 
    if(!name) return showToast('error', 'יש להזין שם מוצר');
    
    const btn = document.getElementById('btn-submit-pantry');
    if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    
    try {
        await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
        document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); document.getElementById('pantry-unit').value = "יח'"; document.getElementById('pantry-upp').value = 1; fetchData(); showToast('success', 'המוצר נוסף למזווה');
    } catch(e) {
        showToast('error', 'שגיאת שרת בהוספת פריט למזווה');
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'הוסף למלאי'; }
    }
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר נגמר! האם למחוק אותו מהמזווה? (מומלץ להוסיף לעגלת הקניות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}
async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id, groupId: currentGroup.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לרשימת הקניות!'); fetchData(); }

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

function openApproveTaskModal(id, title, currentReward) { document.getElementById('approve-task-id').value = id; document.getElementById('approve-task-title').innerText = title; document.getElementById('approve-task-reward').value = currentReward || 0; document.getElementById('approve-task-modal').classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = document.getElementById('approve-task-id').value; const finalReward = document.getElementById('approve-task-reward').value;
    document.getElementById('approve-task-modal').classList.add('hidden'); triggerConfetti();
    await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    showToast('success', 'המשימה אושרה והתגמול הועבר!'); fetchData();
}

function renderTasks(tasks) {
    const list = document.getElementById('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${t.title.replace(/'/g, "\\'")}', ${t.reward})" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; } else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">אישי</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${t.title} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${t.assignee_name}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
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
    const filterEl = document.getElementById('feed-user-filter');
    if (filterEl) { if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); else filterEl.classList.add('hidden'); }
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const userFilter = document.getElementById('feed-user-filter') ? document.getElementById('feed-user-filter').value : 'all';
    const dateFilter = document.getElementById('feed-date-filter') ? document.getElementById('feed-date-filter').value : 'all';
    const list = document.getElementById('unified-feed-list'); if (!list) return;
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
    if (filtered.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין תנועות תזרים להצגה בתקופה זו.</p>'; return; }
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
    document.getElementById('edit-trans-id').value = id; document.getElementById('edit-trans-old-amount').value = amount; document.getElementById('edit-trans-type').value = type; document.getElementById('edit-trans-amount').value = amount; document.getElementById('edit-trans-desc').value = desc;
    const catSelect = document.getElementById('edit-trans-cat'); catSelect.innerHTML = '';
    if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; }
    document.getElementById('edit-transaction-modal').classList.remove('hidden');
}

async function submitEditTransaction() {
    const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat');
    if(!amount) return showToast('error', 'נא להזין סכום');
    
    const btn = document.getElementById('btn-submit-edit-transaction');
    if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה עודכנה!'); document.getElementById('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'שמור שינויים'; } }
}

async function deleteTransaction() {
    const id = val('edit-trans-id'); if(!confirm('האם אתה בטוח שברצונך למחוק פעולה זו לחלוטין? היתרה תתעדכן בהתאם.')) return;
    try {
        const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה נמחקה!'); document.getElementById('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
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
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days, groupId: currentGroup.id }) });
    document.getElementById('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData();
}

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר familAI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה לילד</button></div>`;
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
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'הלומדה שויכה בהצלחה!'); fetchData(); } else showToast('error', data.error);
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
    document.getElementById('quiz-icon').innerHTML = passed ? '🏆' : '📚'; document.getElementById('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא, אפשר לנסות שוב...'; document.getElementById('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; document.getElementById('quiz-score-display').innerText = `ציון סופי: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) document.getElementById('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore, groupId: currentGroup.id }) });
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
    
    const btn = document.getElementById('btn-generate-recipe');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> השף חושב...'; }
    
    try {
        const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry: ignore, customIngredients: customIng, pantryItems: pantryItems.join(', ') }) }); const data = await res.json();
        if(!handleAIResponseCheck(data)) return;
        if(data.success) {
            const container = document.getElementById('recipe-result-container'); const content = document.getElementById('recipe-result-content');
            let html = data.recipe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); html = html.replace(/\n/g, '<br>');
            content.innerHTML = html; container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
        } else { showToast('error', data.error || 'שגיאה ביצירת מתכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור מתכון עכשיו'; } }
}

function copyRecipe() { const text = document.getElementById('recipe-result-content').innerText; navigator.clipboard.writeText(text); showToast('success', 'המתכון הועתק בהצלחה!'); }

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); const btn = document.getElementById('btn-submit-shop'); 
    const item = itemInput.value; 
    const qty = parseFloat(val('shop-quantity')) || 1; 
    const est = parseFloat(val('shop-est-price')) || 0; 
    const unit = val('shop-unit') || "יח'"; 
    const upp = parseInt(val('shop-upp')) || 1;
    
    if(!item) return; if (btn && btn.disabled) return; 
    if (btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, unitsPerPackage: upp, userId: currentUser.id, groupId: currentGroup.id}) }); const data = await res.json(); 
        if (data.success) { document.getElementById('shop-modal').classList.add('hidden'); itemInput.value = ''; document.getElementById('shop-est-price').value = ''; document.getElementById('shop-quantity').value = 1; document.getElementById('shop-unit').value = "יח'"; document.getElementById('suggestions').classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } 
    } catch(e) {
        showToast('error', 'שגיאת תקשורת מול השרת');
    } finally { 
        if (btn) { btn.disabled = false; btn.innerText = 'הוסף'; } 
    } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט דרישה זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק בהצלחה'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל בקשות הרכש? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה אופסה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
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
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין לאישור הורה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${i.item_name}</span><span class="text-xs text-slate-500 block">בקשה מאת: ${i.requester_name}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    const isShopTabActive = document.getElementById('tab-shop') && document.getElementById('tab-shop').classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">רשימת ההזמנות ריקה</p>'; 
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
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-blue-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">ביקש/ה: ${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-blue-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר בספק</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: parseFloat(value) || 0})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = parseFloat(value) || 0; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; document.getElementById(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר בספק'; } calcRunningTotal(); }

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
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום לאישור'); return; } 
    document.getElementById('summ-count').innerText = count; document.getElementById('summ-missing').innerText = missing; document.getElementById('summ-total').innerText = `₪${total.toFixed(2)}`; document.getElementById('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = document.getElementById('checkout-store').value || 'ספק כללי'; const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(document.getElementById(`price-${id}`).value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); showToast('success', 'הפקודה בוצעה ואושרה למלאי!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם לייבא את דרישת הרכש מחדש?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); document.getElementById('history-modal').classList.add('hidden'); showToast('success', 'הדרישה הועתקה!'); fetchData(); }

function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } document.getElementById('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו בנק משפחתי ב-Oneflow Life 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו להתנהל עם Oneflow Life 🚀\n\nקוד המשפחה לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); document.getElementById('invite-modal').classList.add('hidden'); 
}

function toggleFab() { document.getElementById('fab-container').classList.toggle('fab-open'); }
function val(id) { return document.getElementById(id).value; }
function showToast(t,m) { const el=document.getElementById('toast'); const icon = document.getElementById('toast-icon'); el.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • אישור: ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700">יבא דרישה שוב</button></div></div>`; }); document.getElementById('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `תקציב דמי כיס: ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = document.getElementById('bank-user-id').value; const allowance = document.getElementById('bank-allowance').value; const interest = document.getElementById('bank-interest').value; await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לחלק דמי כיס וריבית לכל הילדים כעת?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { showToast('success', `חולקו ${data.totalDistributed} ש"ח לקופות הילדים!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה בשרת'); } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { document.getElementById('goal-user-select-container').classList.remove('hidden'); } document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { document.getElementById('deposit-goal-id').value = id; document.getElementById('deposit-goal-title').innerText = title; document.getElementById('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = parseFloat(val('goal-target')) || 0; const select = document.getElementById('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && document.getElementById('goal-user-select-container').style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target, groupId: currentGroup.id }) }); document.getElementById('goal-modal').classList.add('hidden'); fetchData(); showToast('success', 'יעד הוגדר בהצלחה'); }
async function submitDeposit() { const goalId = document.getElementById('deposit-goal-id').value; const amount = parseFloat(document.getElementById('deposit-amount').value) || 0; if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount, groupId: currentGroup.id }) }); const data = await res.json(); if (data.success) { document.getElementById('goal-deposit-modal').classList.add('hidden'); fetchData(); showToast('success', 'העברה בוצעה'); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    document.getElementById('trans-type').value=t; 
    document.getElementById('trans-modal-title').innerText=t==='income'?'הכנסה':'הוצאה'; 
    const s=document.getElementById('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); document.getElementById('transaction-modal').classList.remove('hidden'); 
}

async function submitTransaction() { 
    const amount = parseFloat(val('trans-amount')) || 0; if(!amount) return showToast('error', 'נא להזין סכום תקין'); 
    
    const btn = document.getElementById('btn-submit-transaction');
    if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    
    const isRecurring = document.getElementById('trans-is-recurring').value === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    try {
        await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null, groupId: currentGroup.id }) }); 
        document.getElementById('transaction-modal').classList.add('hidden'); showToast('success', 'נרשם בהצלחה!'); fetchData(); 
    } catch(e) {
        showToast('error', 'שגיאת שרת בשמירת פעולה');
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'רשום פעולה'; }
    }
}

function openShopModal() { document.getElementById('shop-modal').classList.remove('hidden'); }
function openLoanModal() { document.getElementById('loan-modal').classList.remove('hidden'); }

async function submitLoan() { 
    const amount = parseFloat(val('loan-amount')) || 0;
    if(amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    const btn = document.getElementById('btn-submit-loan');
    if (btn) { btn.disabled = true; btn.innerText = 'שולח...'; }
    try {
        await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:amount, reason:val('loan-reason'), groupId: currentGroup.id})}); 
        document.getElementById('loan-modal').classList.add('hidden'); showToast('success', 'בקשת ההלוואה נשלחה להורה 📨'); fetchData(); fetchLoans(); 
    } catch(e) {
        showToast('error', 'שגיאה בשליחת בקשה');
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'שלח'; }
    }
}

async function fetchLoans() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/loans?groupId=${currentGroup.id}`);
        const loans = await res.json();
        const myLoansList = document.getElementById('my-loans-list');
        const adminLoansList = document.getElementById('admin-loans-list');
        const adminPanel = document.getElementById('admin-loans-panel');
        
        if (myLoansList) {
            myLoansList.innerHTML = '';
            const myLoans = loans.filter(l => String(l.user_id) === String(currentUser.id));
            if(myLoans.length === 0) myLoansList.innerHTML = '<p class="text-sm text-slate-400 py-2">אין בקשות פעילות.</p>';
            myLoans.forEach(l => {
                let statusHtml = '';
                if(l.status === 'pending') statusHtml = '<span class="text-xs text-orange-500 font-bold bg-orange-100 px-2 py-1 rounded">ממתין לאישור</span>';
                else if(l.status === 'approved') statusHtml = '<span class="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">אושר</span>';
                else statusHtml = '<span class="text-xs text-red-500 font-bold bg-red-100 px-2 py-1 rounded">נדחה</span>';
                
                myLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm"><div><span class="font-bold text-slate-800">₪${l.amount}</span><p class="text-xs text-slate-500">${l.reason}</p></div>${statusHtml}</div>`;
            });
        }
        
        if (currentUser.role === 'ADMIN' && adminLoansList && adminPanel) {
            const pendingLoans = loans.filter(l => l.status === 'pending');
            adminLoansList.innerHTML = '';
            if (pendingLoans.length > 0) {
                adminPanel.classList.remove('hidden');
                pendingLoans.forEach(l => {
                    adminLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl mb-2 shadow-sm border border-orange-100"><div class="flex justify-between items-center mb-2"><span class="font-bold text-slate-800">${l.nickname} מבקש/ת ₪${l.amount}</span><span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</span></div><p class="text-xs text-slate-600 mb-3">${l.reason}</p><div class="flex gap-2"><button onclick="approveLoan(${l.id}, ${l.user_id}, ${l.amount})" class="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition">אשר בקשה</button><button onclick="rejectLoan(${l.id})" class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">דחה</button></div></div>`;
                });
            } else {
                adminPanel.classList.add('hidden');
            }
        }
    } catch(e) {
        console.error('Error fetching loans:', e);
    }
}

window.approveLoan = async function(loanId, userId, amount) {
    if(!confirm(`האם לאשר החזר ע"ס ₪${amount}?`)) return;
    try {
        await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, userId, amount, adminId: currentUser.id }) });
        showToast('success', 'בקשה אושרה');
        fetchLoans(); fetchData(); fetchMembers();
    } catch(e) { showToast('error', 'שגיאה באיתור בקשה'); }
};

window.rejectLoan = async function(loanId) {
    if(!confirm('האם לדחות את הבקשה?')) return;
    try {
        await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId }) });
        showToast('info', 'בקשה נדחתה');
        fetchLoans();
    } catch(e) { showToast('error', 'שגיאה בדחיית בקשה'); }
};

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id;
    try {
        const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); 
        let data = await res.json();
        if (!Array.isArray(data)) data = []; // הגנה למקרה של תשובה ריקה/שגויה מהשרת
        
        const list = document.getElementById('budget-list'); list.innerHTML = '';
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
    } catch(e) {
        console.error('Error fetching budget:', e);
    }
}

function openAddBudgetCategoryModal() { document.getElementById('new-budget-cat-name').value = ''; document.getElementById('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { 
    const catName = document.getElementById('new-budget-cat-name').value; if(!catName) return; 
    const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; 
    
    const btn = document.getElementById('btn-submit-budget-cat');
    if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    
    try {
        await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); 
        document.getElementById('add-budget-cat-modal').classList.add('hidden'); 
        fetchBudget(); 
    } catch(e) {
        showToast('error', 'שגיאה בשמירת סעיף תקציבי');
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'הוסף לתקציב'; }
    }
}

function openPasteListModal() { document.getElementById('paste-list-text').value = ''; document.getElementById('paste-list-modal').classList.remove('hidden'); }

async function submitPastedList() {
    const text = document.getElementById('paste-list-text').value; if (!text.trim()) return;
    const btn = document.getElementById('btn-submit-paste'); btn.disabled = true; btn.innerText = 'קולט נתונים...';
    const lines = text.split('\n').filter(l => l.trim() !== '');
    try {
        for (let line of lines) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: line.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, unitsPerPackage: 1, userId: currentUser.id, groupId: currentGroup.id}) }); }
        document.getElementById('paste-list-modal').classList.add('hidden'); showToast('success', `נקלטו ${lines.length} שורות מהרשימה!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { btn.disabled = false; btn.innerText = 'קלוט רשימה'; }
}

function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*רשימת קניות מ-Oneflow Life:*\n\n`;
    activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openBudgetModal(catId, catName, currentLimit) { document.getElementById('budget-cat-name').innerText = catName; document.getElementById('budget-cat-id').value = catId; document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : ''; document.getElementById('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { 
    const cat = document.getElementById('budget-cat-id').value; const limit = parseFloat(document.getElementById('budget-limit').value) || 0; 
    const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; 
    
    const btn = document.getElementById('btn-submit-budget-update');
    if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    
    try {
        await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); 
        document.getElementById('budget-modal').classList.add('hidden'); 
        fetchBudget(); 
    } catch(e) {
        showToast('error', 'שגיאת רשת בעדכון תקציב');
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'עדכן יעד'; }
    }
}

// -------------------------------------
// פונקציות לתשקיף חכם (Forecast)
// -------------------------------------

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    document.getElementById('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
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
            const recBadge = isRecurring ? '<span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded-full font-bold ml-2 shadow-sm whitespace-nowrap">קבועה <i class="fa-solid fa-rotate text-[8px]"></i></span>' : '';
            const userName = currentUser.role === 'ADMIN' && item.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${item.user_name}</span>` : '';
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between text-right hover:border-slate-200 transition"><div class="flex-1 overflow-hidden"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${item.description}</span> ${userName} ${recBadge}</p><p class="text-[10px] text-slate-400 mt-1">${item.date_str}</p></div><span class="font-bold text-base ${amountClass} whitespace-nowrap shrink-0" dir="ltr">${prefix}₪${item.amount}</span></div>`;
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

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showAIModal('רואת העתידות', null); document.getElementById('familai-loading-text').innerText = 'מחשבת את התזרים הצפוי לתקופה...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? document.getElementById('forecast-month-filter').value : document.getElementById('forecast-year-filter').value;
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showAIModal('רואת העתידות', data.insight); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התשקיף'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

// -------------------------------------
// סיום - תשקיף חכם (Forecast)
// -------------------------------------


function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = document.getElementById(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { document.getElementById('accessibility-modal').classList.remove('hidden'); }
function closeAccessibilityModal() { document.getElementById('accessibility-modal').classList.add('hidden'); }
async function fetchPendingUsers() { try { if(!currentGroup || !currentGroup.id) return; const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json(); const list = document.getElementById('pending-list'); const container = document.getElementById('admin-panel'); if (users && users.length > 0) { container.classList.remove('hidden'); list.innerHTML = ''; users.forEach(u => { const age = new Date().getFullYear() - u.birth_year; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname}</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-700 transition">אשר צוות</button></div></div>`; }); } else { if(container) container.classList.add('hidden'); } } catch(e) { console.error(e); } }
async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'אושר כעובד בארגון!'); fetchPendingUsers(); fetchMembers(); }
function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }
async function submitChangePassword(e) { e.preventDefault(); const oldP = document.getElementById('old-password').value; const newP = document.getElementById('new-password').value; const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; try { const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'עדכון סיסמת גישה'; } }
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהארגון לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש הוסר בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }

// -------------------- פונקציות דוח 360 --------------------

async function open360Report(groupId) {
    showToast('info', 'מפיק דוח תמונת מצב, אנא המתן...');
    try {
        let url, headers = {};
        if (saToken) {
            url = `${API}/superadmin/group-360/${groupId}`;
            headers = { 'Authorization': saToken };
        } else {
            url = `${API}/group/${groupId}/report-360?adminId=${currentUser.id}`;
        }

        const res = await fetch(url, { headers });
        const data = await res.json();

        if (!data.success) {
            return showToast('error', data.error || 'שגיאה בהפקת הדוח');
        }

        // --- רינדור הנתונים למודל (מותאם לטרמינולוגיה של משפחה) ---
        
        const typeStr = data.group.type === 'BUSINESS' ? 'עסק' : 'משפחה';
        document.getElementById('report-360-group-name').innerText = data.group.name;
        document.getElementById('report-360-group-type').innerText = `${typeStr} ${data.group.is_premium ? '(PRO)' : ''}`;
        document.getElementById('report-360-group-code').innerText = data.group.group_code;
        document.getElementById('report-360-group-email').innerText = data.group.admin_email;
        document.getElementById('report-360-date').innerText = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        // טבלת משתמשים + סך יתרות/התחייבויות
        const usersList = document.getElementById('report-360-users-list');
        let usersHtml = '';
        let totalBalances = 0;
        data.users.forEach(u => {
            const roleStr = u.role === 'ADMIN' ? (data.group.type === 'BUSINESS' ? 'הנהלה' : 'הורה/מנהל') : (data.group.type === 'BUSINESS' ? 'עובד צוות' : 'ילד/חבר');
            const bal = parseFloat(u.balance) || 0;
            totalBalances += bal;
            usersHtml += `<tr>
                <td>${u.nickname}</td>
                <td><span class="report-badge">${roleStr}</span></td>
                <td class="font-bold font-mono">₪${bal.toFixed(2)}</td>
            </tr>`;
        });
        usersHtml += `<tr class="bg-slate-100 font-bold border-t-2 border-slate-300">
            <td colspan="2">סה"כ מאזן קופות ילדים:</td>
            <td class="font-mono text-slate-800">₪${totalBalances.toFixed(2)}</td>
        </tr>`;
        usersList.innerHTML = usersHtml;

        // טבלת תנועות
        const txList = document.getElementById('report-360-tx-list');
        let txHtml = '';
        if(data.transactions && data.transactions.length > 0) {
            data.transactions.forEach(t => {
                const dateStr = new Date(t.date).toLocaleDateString('he-IL');
                const isInc = t.type === 'income';
                const amtStr = `<span dir="ltr" style="color: ${isInc ? '#16a34a' : '#dc2626'}">${isInc ? '+' : '-'}₪${t.amount}</span>`;
                txHtml += `<tr>
                    <td class="text-xs">${dateStr}</td>
                    <td>${t.user_name || 'מערכת'}</td>
                    <td class="text-xs">${t.description}</td>
                    <td class="font-bold text-left">${amtStr}</td>
                </tr>`;
            });
        } else {
            txHtml = '<tr><td colspan="4" class="text-center text-slate-400 py-4">אין תנועות ב-30 הימים האחרונים</td></tr>';
        }
        txList.innerHTML = txHtml;

        // סיכום משימות
        const tasksList = document.getElementById('report-360-tasks-list');
        let tasksHtml = '';
        if(data.tasksSummary && data.tasksSummary.length > 0) {
            const statusMap = { 'pending': 'פתוחות (ממתין לביצוע)', 'done': 'ממתין לאישור הורה', 'approved': 'בוצעו בהצלחה' };
            data.tasksSummary.forEach(ts => {
                tasksHtml += `<li><strong>${statusMap[ts.status] || ts.status}:</strong> ${ts.count} משימות</li>`;
            });
        } else {
            tasksHtml = '<li>אין משימות מוגדרות במערכת.</li>';
        }
        tasksList.innerHTML = tasksHtml;

        // הצגת המודל
        document.getElementById('report-360-modal').classList.remove('hidden');

    } catch(e) {
        showToast('error', 'שגיאת תקשורת בהבאת נתוני הדוח');
        console.error(e);
    }
}

function download360PDF() {
    const element = document.getElementById('report-360-content');
    const groupName = document.getElementById('report-360-group-name').innerText;
    
    const opt = {
        margin:       10,
        filename:     `Oneflow_Report_${groupName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // שימוש בספריית html2pdf
    html2pdf().set(opt).from(element).save().then(() => {
        showToast('success', 'הדוח הורד בהצלחה למכשירך!');
    }).catch(err => {
        showToast('error', 'שגיאה ביצירת קובץ ה-PDF');
        console.error(err);
    });
}
