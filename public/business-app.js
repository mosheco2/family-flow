// Oneflow 360 Pro - Business Logic Application (PART 1)

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
    
    /* IntroJS Overrides for modern modal look */
    .introjs-tooltip { 
        font-family: 'Rubik', sans-serif !important; 
        border-radius: 2rem !important; 
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; 
        padding: 1.5rem !important; 
        border: none !important; 
        overflow: hidden !important; 
        text-align: center !important; 
    }
    .introjs-tooltip::before { 
        content: ''; 
        position: absolute; 
        top: 0; left: 0; right: 0; height: 8px; 
        background: linear-gradient(to right, #3b82f6, #a855f7); 
    }
    .introjs-tooltipbuttons { 
        border-top: none !important; 
        padding-top: 1rem !important; 
        display: flex; 
        gap: 0.5rem; 
        justify-content: center; 
    }
    .introjs-button { 
        border-radius: 0.75rem !important; 
        text-shadow: none !important; 
        font-weight: bold !important; 
        font-family: 'Rubik', sans-serif !important; 
        padding: 0.75rem 1.5rem !important; 
        flex: 1; 
        text-align: center; 
    }
    .introjs-nextbutton { 
        background-color: #3b82f6 !important; 
        color: white !important; 
        border: none !important; 
        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3) !important; 
    }
    .introjs-prevbutton { 
        color: #64748b !important; 
        background: #f8fafc !important; 
        border: 1px solid #e2e8f0 !important; 
    }
    .introjs-skipbutton { 
        color: #94a3b8 !important; 
        font-weight: 500 !important; 
        background: transparent !important; 
    }
    .introjs-bullets ul li a.active { background: #3b82f6 !important; }
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

// משתנה שמירת סטטוס שעון נוכחות אישי
let isPunchedIn = false;

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

const userColors = ['bg-slate-100 border-slate-200', 'bg-blue-50 border-blue-100', 'bg-indigo-50 border-indigo-100', 'bg-emerald-50 border-emerald-100', 'bg-amber-50 border-amber-100'];
const CATEGORIES = { 
    income: [ {value:'sales',label:'📈 מכירות והכנסות'}, {value:'investment',label:'💰 השקעה / מימון'}, {value:'refund',label:'🔄 זיכוי / החזר'}, {value:'other',label:'💸 אחר'} ], 
    expense: [ {value:'office',label:'📎 ציוד משרדי'}, {value:'software',label:'💻 תוכנה ושירותים'}, {value:'marketing',label:'🎯 שיווק ופרסום'}, {value:'salary',label:'💼 משכורות'}, {value:'travel',label:'✈️ נסיעות ורכבים'}, {value:'rent',label:'🏢 שכירות ותחזוקה'}, {value:'food',label:'☕ כיבוד ומטבחון'}, {value:'other',label:'💸 הוצאה תפעולית אחרת'} ] 
};
const BUDGET_LABELS = { 'office': '📎 ציוד משרדי', 'software': '💻 תוכנה ורישיונות', 'marketing': '🎯 שיווק', 'salary': '💼 שכר ובונוסים', 'travel': '✈️ נסיעות', 'rent': '🏢 שכירות', 'food': '☕ מטבחון', 'other': '💸 שונות', 'allowance': '💰 תקציב מחלקות', 'tasks': '✅ תגמול פרויקטים', 'academy': '🎓 הכשרות', 'savings': '🐖 עתודות' };
const PRODUCT_DB = { 
    "ציוד משרדי 📎": ["נייר צילום A4", "עטים", "קלסרים", "מרקרים", "שדכן", "סיכות לשדכן", "דפדפות", "מעטפות", "פתקיות ממו"], 
    "מחשוב וטכנולוגיה 💻": ["עכבר אלחוטי", "מקלדת", "מסך מחשב", "כבל HDMI", "כבל רשת", "מטען למחשב נייד", "אוזניות", "דיסק און קי"], 
    "מטבחון וכיבוד ☕": ["קפה שחור", "קפה נמס", "קפסולות קפה", "חלב", "חלב סויה", "חלב שיבולת שועל", "סוכר", "סוכרזית", "תה", "עוגיות", "כוסות נייר"], 
    "ניקיון ותחזוקה 🧻": ["נייר טואלט", "נייר סופג", "נוזל כלים", "סבון ידיים", "מטליות לניקוי", "שקיות זבל"], 
    "שונות / חומרי גלם 📦": ["מארז קרטונים", "סלוטייפ", "מספריים"] 
};
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

const hidePreloaderAndShowAuth = () => {
    window.location.href = '/';
};

window.onload = async () => { 
    initAccessibility();
    const btnMonthly = document.getElementById('btn-forecast-monthly'); const btnYearly = document.getElementById('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const failsafeTimer = setTimeout(() => { const preloader = document.getElementById('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { hidePreloaderAndShowAuth(); } }, 7000);
    
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { 
        window.location.href = `/?code=${inviteCode}&role=${inviteRole}`; 
        return; 
    }
    
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
                currentUser = session.user; currentGroup = session.group; 
                clearTimeout(failsafeTimer); 
                
                if(currentGroup.type !== 'BUSINESS') {
                    window.location.href = '/'; 
                    return; 
                }
                loadDashboard(); 
                return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth();
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
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { document.getElementById('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון, המלאי והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר שיעשה לכם סדר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות הפרופיל והמנוי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "כוח עיבוד AI ⚡", intro: "המערכת מונעת ע\"י בינה מלאכותית מתקדמת. כאן תוכלו לראות את כמות הפעולות היומיות שנותרו בחבילה שלכם.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "נוכחות ⏱️", intro: "כאן תוכלו לעקוב אחר דוחות הנוכחות (שעות כניסה ויציאה) של כלל העובדים בארגון.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "הסוף לבלאגן בהזמנות ציוד! עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "עקבו אחר ציוד משרדי וחומרי גלם. עובד יכול לדווח ניצול מלאי, וכשפריט אוזל הוא מועבר אוטומטית לרכש.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים, ואשרו בקשות להחזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול משימות ופרויקטים ✅", intro: "הקצו טיקטים ומשימות לעובדים. העובד יכול לדווח ביצוע בצירוף תמונה, וה-AI יאשר את הביצוע והבונוס אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "הכשרות ונהלים 🎓", intro: "בנו חפיפות ומבחני בטיחות לעובדים בלחיצת כפתור באמצעות ה-AI, ותגמלו עובדים על הצטיינות.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב תפעולי 📊", intro: "הגדירו יעדי הוצאות חודשיים לפי סעיף (למשל מחשוב, שיווק, שכירות). ה-AI ינתח ויספק דוח מנהלים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "תכנון פיננסי קדימה! מעקב על הוצאות תפעול קבועות (כמו שכר ומיסים) מול הכנסות צפויות.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות צוות 👥", intro: "הזמינו עובדים חדשים דרך וואטסאפ, אשרו כניסה למערכת, ונהלו את פרטי הגישה של כולם.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "כאן אפשר לבדוק איזה ציוד קיים בחברה. אם לקחת משהו מהמלאי, לחץ 'דיווח ניצול' כדי שהמערכת תתעדכן.", position: 'bottom' },
            { element: '#tab-bank', title: "החזרי הוצאות 🏦", intro: "שילמת על דלק או חניה פגישת לקוח? הגש בקשה להחזר הוצאות כאן.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "רשימת המטלות הפתוחות שלך. סיימת? דווח ביצוע וצרף תמונה - ה-AI יאשר וייתכן שתקבל בונוס!", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "רענון נהלים וחפיפות מקצועיות נמצאים כאן. השלמת הכשרות יכולה לזכות אותך בתמריצים.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף פעילות 📅", intro: "צפייה בפעולות והחזרים עתידיים הצפויים להיכנס לתקציב שלך.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const tg = document.getElementById(`view-${view}`);
    if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 

            // בדיקת סוג חשבון לאחר התחברות
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            
            // במידה ויצרנו עסק דרך דף עסקים - אין סיבה לרפרש לדף אחר, נטען ישירות.
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) {
                window.location.href = '/business.html';
                return;
            } else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) {
                window.location.href = '/';
                return;
            }
            
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow();
    if (t === 'timeclock') {
        if (currentUser.role === 'ADMIN') fetchTimeclockReport();
        checkTimeclockStatus();
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) {
                const imgSrc = img.startsWith('http') ? img : `/${img}`;
                html += `<img src="${imgSrc}" alt="Banner" class="w-full object-cover block">`; 
            }
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const familyMsgEl = document.getElementById('sa-welcome-msg');
        if (familyMsgEl) familyMsgEl.value = data.welcomeMsg || '';
        
        const bizMsgEl = document.getElementById('sa-biz-welcome-msg');
        if (bizMsgEl) bizMsgEl.value = data.businessWelcomeMsg || '';
        
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
        if(bizBottomLink) bizBottomLink.value = data.bizBottomLink || '';
        if(bizBottomImg) bizBottomImg.value = data.bizBannerImgBottom || '';

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
            actList.innerHTML = data.activity.map(a => { const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`; return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he
