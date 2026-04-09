// Oneflow life BIZ - Business Logic Application

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
let isPunchedIn = false;

// משתני החנות
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

const hidePreloaderAndShowAuth = (view = 'login') => {
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
                if (session.group.type !== 'BUSINESS') { window.location.href = '/'; return; }
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
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
            let html = ''; 
            if(img) { 
                const imgSrc = img.startsWith('http') ? img : `/${img}`; 
                html += `<img src="${imgSrc}" alt="Banner" class="absolute inset-0 w-full h-full object-cover z-0">`; 
            }
            if(text) {
                html += `<div class="absolute inset-0 bg-black/20 z-0"></div>`; 
                html += `<span class="relative z-10 py-3 px-4 block w-full text-center drop-shadow-md text-white font-bold">${text}</span>`; 
            }
            el.innerHTML = html; el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); el.style.width = '100%'; 

            if (el.id === 'app-banner-bottom') {
                setTimeout(() => {
                    const h = el.offsetHeight || 60;
                    const cf = getEl('cart-footer'); if(cf) cf.style.bottom = h + 'px';
                    const b2bf = getEl('b2b-cart-floating'); if(b2bf) b2bf.style.bottom = h + 'px';
                }, 100);
            }
        } else { 
            el.classList.add('hidden'); el.classList.remove('flex'); 
            if (el.id === 'app-banner-bottom') {
                const cf = getEl('cart-footer'); if(cf) cf.style.bottom = '0px';
                const b2bf = getEl('b2b-cart-floating'); if(b2bf) b2bf.style.bottom = '0px';
            }
        }
    };

    const topText = banners.biz_banner_text_top || banners.bizBannerTextTop || banners.biz_banner_top_text || banners.banner_top_text;
    const topLink = banners.biz_banner_link_top || banners.bizBannerLinkTop || banners.biz_banner_top_link || banners.banner_top_link;
    const topImg = banners.biz_banner_img_top || banners.bizBannerImgTop || banners.biz_banner_top_img || banners.banner_top_img;
    const bottomText = banners.biz_banner_text_bottom || banners.bizBannerTextBottom || banners.biz_banner_bottom_text || banners.banner_bottom_text;
    const bottomLink = banners.biz_banner_link_bottom || banners.bizBannerLinkBottom || banners.biz_banner_bottom_link || banners.banner_bottom_link;
    const bottomImg = banners.biz_banner_img_bottom || banners.bizBannerImgBottom || banners.biz_banner_bottom_img || banners.banner_bottom_img;

    renderBanner(appTop, topText, topLink, topImg); 
    renderBanner(appBottom, bottomText, bottomLink, bottomImg);
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
        
        // טעינת נתוני הקהילות לאדמין
        if (typeof loadSACommunityData === 'function') {
            loadSACommunityData();
        }
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
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { getEl('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); getEl('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { getEl('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { getEl('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startManagerTour(); else startEmployeeTour(); }, 300); }

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

function injectBusinessUI() {
    // 1. הזרקת משמרות
    if(!getEl('content-shifts')) {
        const contentFeed = getEl('content-feed');
        if(contentFeed) {
            contentFeed.insertAdjacentHTML('afterend', `
            <div id="content-shifts" class="hidden">
                <div class="flex justify-between items-center mb-4 px-2 mt-2">
                    <h3 class="font-bold text-slate-700 text-lg">סידור עבודה ומשמרות 🗓️</h3>
                    <button onclick="openShiftModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-indigo-700 transition"><i class="fa-solid fa-plus mr-1"></i> שיבוץ מנהל</button>
                </div>
                <div id="shifts-list" class="space-y-3 pb-20"></div>
            </div>
            `);
        }
    }

    // 2. הזרקת חנות ומכירות (היה חסר)
    if(!getEl('content-sales')) {
        const contentShifts = getEl('content-shifts') || getEl('content-feed');
        if(contentShifts) {
            contentShifts.insertAdjacentHTML('afterend', `
            <div id="content-sales" class="hidden">
                <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden mb-4">
                    <h3 class="font-bold text-slate-800 text-lg mb-4">ניהול חנות ומכירות 🛍️</h3>
                    
                    <div class="flex bg-slate-100 p-1.5 rounded-xl mb-6 overflow-x-auto modal-scroll whitespace-nowrap">
                        <button id="btn-sales-orders" onclick="switchSalesTab('orders')" class="flex-1 py-2 px-3 text-xs font-bold bg-white text-slate-800 rounded-lg shadow-sm transition">הזמנות</button>
                        <button id="btn-sales-catalog" onclick="switchSalesTab('catalog')" class="flex-1 py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg transition">קטלוג מוצרים</button>
                        <button id="btn-sales-marketing" onclick="switchSalesTab('marketing')" class="flex-1 py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg transition">שיווק וקופונים</button>
                        <button id="btn-sales-settings" onclick="switchSalesTab('settings')" class="flex-1 py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg transition">הגדרות חנות</button>
                    </div>

                    <div id="sales-view-orders" class="space-y-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-slate-700 text-sm">הזמנות מהלקוחות</h4>
                            <select id="store-orders-filter" onchange="renderStoreOrders()" class="modern-input py-1 px-2 text-xs bg-slate-50 w-auto h-auto">
                                <option value="all">כל ההזמנות</option>
                                <option value="new">חדשות</option>
                                <option value="processing">בהכנה</option>
                                <option value="ready">מוכנות</option>
                                <option value="shipped">במשלוח</option>
                                <option value="completed">הושלמו</option>
                            </select>
                        </div>
                        <div id="store-orders-list" class="space-y-3 pb-8"></div>
                    </div>

                    <div id="sales-view-catalog" class="hidden space-y-4">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-bold text-slate-700 text-sm">מוצרים בחנות</h4>
                            <button onclick="openStoreProductModal()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition"><i class="fa-solid fa-plus"></i> מוצר חדש</button>
                        </div>
                        <div id="store-catalog-list" class="space-y-3 pb-8"></div>
                    </div>

                    <div id="sales-view-marketing" class="hidden space-y-6">
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 class="font-bold text-slate-700 text-sm mb-3">יצירת קופון חדש</h4>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 block mb-1">קוד קופון:</label>
                                    <input type="text" id="coupon-code" class="modern-input py-2 text-sm font-mono uppercase text-left dir-ltr" placeholder="SUMMER20">
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 block mb-1">אחוז הנחה (%):</label>
                                    <input type="number" id="coupon-discount" class="modern-input py-2 text-sm text-center" placeholder="10">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="text-[10px] font-bold text-slate-500 block mb-1">תוקף (אופציונלי):</label>
                                <input type="date" id="coupon-date" class="modern-input py-2 text-sm bg-white">
                            </div>
                            <button onclick="createStoreCoupon()" class="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition">צור קופון</button>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-700 text-sm mb-3">קופונים פעילים</h4>
                            <div id="store-coupons-list" class="space-y-2 pb-8"></div>
                        </div>
                    </div>

                    <div id="sales-view-settings" class="hidden space-y-5 pb-8">
                        <div class="flex items-center gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <input type="checkbox" id="store-is-active" class="w-5 h-5 accent-indigo-600">
                            <label class="font-bold text-indigo-800 text-sm cursor-pointer" for="store-is-active">חנות פעילה ופתוחה להזמנות</label>
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-slate-500 block mb-1.5">הודעת פתיחה בחנות:</label>
                            <textarea id="store-welcome-msg" class="modern-input py-2 text-sm h-16" placeholder="ברוכים הבאים לחנות שלנו!"></textarea>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">סוג חנות:</label><select id="store-type" class="modern-input py-2 text-sm bg-white"><option value="retail">קמעונאות / מוצרים</option><option value="food">מסעדה / מזון</option><option value="services">שירותים</option></select></div>
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">מינימום הזמנה (₪):</label><input type="number" id="store-min-order" class="modern-input py-2 text-sm text-center" placeholder="0"></div>
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-slate-500 block mb-1.5">סלוגן / תיאור קצר:</label>
                            <input type="text" id="store-slogan" class="modern-input py-2 text-sm" placeholder="המוצרים הכי טובים בעיר">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">טלפון לעסק:</label><input type="tel" id="store-phone" class="modern-input py-2 text-sm text-left dir-ltr" placeholder="050-0000000"></div>
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">וואטסאפ להזמנות:</label><input type="tel" id="store-whatsapp" class="modern-input py-2 text-sm text-left dir-ltr" placeholder="972500000000"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">שעת פתיחה:</label><input type="time" id="store-open-time" class="modern-input py-2 text-sm bg-white"></div>
                            <div><label class="text-xs font-bold text-slate-500 block mb-1.5">שעת סגירה:</label><input type="time" id="store-close-time" class="modern-input py-2 text-sm bg-white"></div>
                        </div>

                        <div>
                            <label class="text-xs font-bold text-slate-500 block mb-1.5">לוגו העסק:</label>
                            <div class="flex items-center gap-3">
                                <div id="store-logo-preview-container" class="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 text-slate-300">
                                    <i class="fa-solid fa-store text-2xl" id="store-logo-placeholder"></i>
                                    <img id="store-logo-preview" src="" class="w-full h-full object-cover hidden">
                                </div>
                                <button type="button" onclick="document.getElementById('store-logo-upload').click()" class="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 transition border border-slate-200"><i class="fa-solid fa-camera mr-1"></i> העלה לוגו</button>
                                <input type="file" id="store-logo-upload" accept="image/*" class="hidden" onchange="handleStoreLogoUpload(event)">
                                <input type="hidden" id="store-logo-base64">
                            </div>
                        </div>

                        <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <label class="text-xs font-bold text-blue-800 block mb-1.5">קישור לחנות הציבורית שלכם:</label>
                            <div class="flex gap-2">
                                <input type="text" id="store-public-link" class="modern-input py-2 text-xs font-mono text-left dir-ltr flex-1 bg-white text-slate-500" readonly>
                                <button onclick="copyStoreLink()" class="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-sm"><i class="fa-regular fa-copy"></i></button>
                            </div>
                        </div>

                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <label class="text-xs font-bold text-slate-700 block mb-1.5"><i class="fa-solid fa-list-check"></i> תבניות תוספות (Modifiers):</label>
                            <select id="preset-selector" onchange="loadPreset(this.value)" class="modern-input py-2 text-sm bg-white mb-2 hidden"></select>
                        </div>

                        <button id="btn-save-store-settings" onclick="saveStoreSettings()" class="w-full bg-slate-800 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-700 transition mt-4">שמור הגדרות חנות</button>
                    </div>
                </div>
            </div>
            `);
        }
    }
    
    // 3. הוספת כפתורי ניווט (טאבים עליונים) אם חסרים
    if(!getEl('tab-shifts')) {
        const tabPantry = getEl('tab-pantry');
        if(tabPantry) tabPantry.insertAdjacentHTML('beforebegin', `<button onclick="switchTab('shifts')" id="tab-shifts" class="tab-btn">משמרות 🗓️</button>`);
    }
    if(!getEl('tab-sales')) {
        const tabBank = getEl('tab-bank');
        if(tabBank) tabBank.insertAdjacentHTML('beforebegin', `<button onclick="switchTab('sales')" id="tab-sales" class="tab-btn bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent">מכירות וחנות 🛍️</button>`);
    }

    // 4. הזרקת חלונות הפופ-אפ החסרים (כדי שההרשאות לא יקרסו)
    if(!getEl('shift-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="shift-modal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden z-[60] flex items-center justify-center p-4">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl modal-scroll max-h-[90vh] overflow-y-auto">
                <div class="bg-indigo-50 p-6 text-center relative border-b border-indigo-100">
                    <button onclick="getEl('shift-modal').classList.add('hidden')" class="absolute top-4 right-4 w-8 h-8 bg-white rounded-full text-slate-400 flex items-center justify-center hover:text-slate-600 shadow-sm"><i class="fa-solid fa-xmark"></i></button>
                    <h3 class="text-xl font-black text-slate-800 mt-2">פרטי משמרת</h3>
                </div>
                <div class="p-6 space-y-4">
                    <div><label class="text-xs font-bold text-slate-500">עובד/ת:</label><select id="shift-user" class="modern-input py-3 text-sm bg-white"></select></div>
                    <div><label class="text-xs font-bold text-slate-500">תאריך:</label><input type="date" id="shift-date" class="modern-input py-3 text-sm"></div>
                    <div class="flex gap-2">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500">משעה:</label><input type="time" id="shift-start" class="modern-input py-3 text-sm"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500">עד שעה:</label><input type="time" id="shift-end" class="modern-input py-3 text-sm"></div>
                    </div>
                    <div class="flex gap-3 mt-4">
                        <button onclick="getEl('shift-modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3.5 font-bold hover:bg-slate-200 transition">ביטול</button>
                        <button id="btn-submit-shift" onclick="submitShift()" class="flex-1 bg-indigo-600 text-white rounded-xl py-3.5 font-bold shadow-md hover:bg-indigo-700 transition">שמור משמרת</button>
                    </div>
                </div>
            </div>
        </div>
        `);
    }

    if(!getEl('manual-punch-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="manual-punch-modal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden z-[60] flex items-center justify-center p-4">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl modal-scroll max-h-[90vh] overflow-y-auto">
                <div class="bg-indigo-50 p-6 text-center relative border-b border-indigo-100">
                    <button onclick="getEl('manual-punch-modal').classList.add('hidden')" class="absolute top-4 right-4 w-8 h-8 bg-white rounded-full text-slate-400 flex items-center justify-center hover:text-slate-600 shadow-sm"><i class="fa-solid fa-xmark"></i></button>
                    <h3 class="text-xl font-black text-slate-800 mt-2">דיווח נוכחות ידני</h3>
                </div>
                <div class="p-6 space-y-4">
                    <div><label class="text-xs font-bold text-slate-500">עובד:</label><select id="mp-user" class="modern-input py-3 text-sm bg-white"></select></div>
                    <div><label class="text-xs font-bold text-slate-500">תאריך:</label><input type="date" id="mp-date" class="modern-input py-3 text-sm"></div>
                    <div class="flex gap-2">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500">כניסה:</label><input type="time" id="mp-start" class="modern-input py-3 text-sm"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500">יציאה:</label><input type="time" id="mp-end" class="modern-input py-3 text-sm"></div>
                    </div>
                    <div class="flex gap-3 mt-4">
                        <button onclick="getEl('manual-punch-modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3.5 font-bold hover:bg-slate-200 transition">ביטול</button>
                        <button id="btn-submit-mp" onclick="submitManualPunch()" class="flex-1 bg-indigo-600 text-white rounded-xl py-3.5 font-bold shadow-md hover:bg-indigo-700 transition">שמור דיווח</button>
                    </div>
                </div>
            </div>
        </div>
        `);
    }

    if(!getEl('permissions-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="permissions-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[60] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto modal-scroll">
                <h3 class="text-xl font-bold mb-2 text-center text-slate-800">סיווג וגישה למערכת 🔐</h3>
                <p id="perm-user-name" class="text-center text-slate-500 mb-4 text-sm"></p>
                <input type="hidden" id="perm-user-id">
                <div class="mb-4">
                    <label class="text-xs font-bold text-slate-500 block mb-2">סיווג העובד/ת (משנה תבנית אוטומטית):</label>
                    <select id="perm-role-select" onchange="applyRoleDefaults(this.value)" class="modern-input py-2 text-sm bg-indigo-50 border-indigo-100 text-indigo-800 font-bold">
                        <option value="MEMBER">עובד רגיל / איש צוות</option>
                        <option value="SENIOR">עובד בכיר / אחראי</option>
                        <option value="MANAGER">מנהל משמרת (אחמ"ש)</option>
                        <option value="ADMIN">בעלים / מנהל ראשי (הרשאה מלאה)</option>
                    </select>
                </div>
                <label class="text-xs font-bold text-slate-500 block mb-2">טאבים מורשים למשתמש (התאמה אישית):</label>
                <div id="perm-tabs-container" class="grid grid-cols-2 gap-2 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100"></div>
                <div class="flex gap-3">
                    <button onclick="document.getElementById('permissions-modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">ביטול</button>
                    <button id="btn-submit-permissions" onclick="submitPermissions()" class="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-700 transition">שמור הרשאות</button>
                </div>
            </div>
        </div>
        `);
    }
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflowlife Pro! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shifts', title: "משמרות 🗓️", intro: "כאן אפשר לראות את סידור העבודה שלך ולהגיש בקשות שיבוץ להנהלה.", position: 'bottom' },
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
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else if(id === 'tab-shifts') switchTab('shifts'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = getEl('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startEmployeeTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow life BIZ! 🎉", intro: "פורטל העובדים שלך מוכן. כאן תוכל לנהל את המשימות, לבקש ציוד ולעקוב אחרי הבונוסים שלך." },
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים והכשרות.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "הגעת למשרד? לחץ כאן כדי להיכנס למשמרת. אל תשכח לסמן יציאה בסוף היום!", position: 'bottom' },
            { element: '#tab-shifts', title: "משמרות 🗓️", intro: "כאן אפשר לראות את סידור העבודה שלך ולהגיש בקשות שיבוץ להנהלה.", position: 'bottom' },
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
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-timeclock') switchTab('timeclock'); else if(id === 'tab-shifts') switchTab('shifts'); else switchTab('feed'); 
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
            loadDashboard(); // תיקון קריטי: טעינת הנתונים והעברה מיידית לדשבורד
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
            loadDashboard(); // תיקון קריטי: טעינת הנתונים והעברה מיידית לדשבורד
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

// נוספה פונקציית בחירת סוג שחשובה למסך ההרשמה שלא היתה
function handleTypeSelection(type) {
    const typeInput = getEl('create-type'); if(typeInput) typeInput.value = type;
    const btnBiz = getEl('type-business'); const btnFam = getEl('type-family'); const nameInput = getEl('create-group-name');
    if(type === 'BUSINESS') {
        if(btnBiz) { btnBiz.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600'); btnBiz.classList.remove('border-slate-100', 'text-slate-400'); }
        if(btnFam) { btnFam.classList.add('border-slate-100', 'text-slate-400'); btnFam.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600'); }
        if(nameInput) nameInput.placeholder = 'שם העסק';
    } else {
        if(btnFam) { btnFam.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600'); btnFam.classList.remove('border-slate-100', 'text-slate-400'); }
        if(btnBiz) { btnBiz.classList.add('border-slate-100', 'text-slate-400'); btnBiz.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600'); }
        if(nameInput) nameInput.placeholder = 'שם המשפחה';
    }
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
    ['feed','timeclock','shifts','shop','sales','pantry','bank','cashflow','budget','forecast','tasks','academy','community','members'].forEach(x => { 
        const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const targetContent = getEl(`content-${t}`); if(targetContent) targetContent.classList.remove('hidden'); 
    const targetBtn = getEl(`tab-${t}`); if(targetBtn) targetBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); const fab = getEl('fab-container'); if(fab) fab.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'feed') try { renderUnifiedFeed(); } catch(e) {} // תיקון לטעינת הפיד המרכזי
    if (t === 'cashflow') try { renderCashflow(); } catch(e) {} 
    if (t === 'community') try { loadBizCommunities(); } catch(e) {}
    if (t === 'pantry') try { renderPantry(); } catch(e) {}
    if (t === 'forecast') try { renderForecast(); } catch(e) {}
    if (t === 'timeclock') { try { if (currentUser && currentUser.role === 'ADMIN') fetchTimeclockReport(); checkTimeclockStatus(); } catch(e) {} }
    if (t === 'shifts') try { renderShifts(); } catch(e) {}
    if (t === 'sales') { try { switchSalesTab('orders'); } catch(e) {} }
    if (t === 'budget') { try { fetchBudget(); } catch(e) {} }
    if (t === 'academy') { try { if(currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {} }
    if (t === 'bank') { try { fetchLoans(); } catch(e) {} }
    if (t === 'tasks') { try { renderTasks(allTasks); } catch(e) {} }
    if (t === 'members') { try { fetchMembers(); } catch(e) {} }
}
function updateBatteryUI() {
    const indicator = getEl('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
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
    try {
        if (!currentUser || !currentUser.id || !currentGroup || !currentGroup.id) {
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.classList.remove('hidden');
            return;
        }

        const authContainer = getEl('auth-container'); if (authContainer) authContainer.classList.add('hidden');
        try { if(typeof injectBusinessUI === 'function') injectBusinessUI(); } catch(e) {}
        
        const dashContainer = getEl('dashboard-container'); if(dashContainer) dashContainer.classList.remove('hidden'); 
        
        // חשיפת כפתורי פעולה לאחר כניסה
        const fabContainer = getEl('fab-container'); if(fabContainer) fabContainer.classList.remove('hidden');
        const aiAssistant = document.querySelector('.fixed.bottom-40.right-6.animate-pulse'); if(aiAssistant) aiAssistant.classList.remove('hidden');
        const waButton = document.querySelector('a[href^="https://wa.me/"]'); if(waButton) waButton.classList.remove('hidden');
        
        fetchBanners(); 
        
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד ארגון: ${currentGroup.group_code}</span>` : '';
        const dashGroupName = getEl('dash-group-name'); if(dashGroupName) dashGroupName.innerHTML = `${safeStr(currentGroup.name)} ${codeBadge}`; 
        const dashNick = getEl('dash-nickname'); if(dashNick) dashNick.innerText = currentUser.nickname; 

        const isAdmin = currentUser.role === 'ADMIN';
        if(isAdmin) { 
            ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools', 'timeclock-admin-view'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
            const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש לאישור';
            const profileUp = getEl('profile-upgrade-section');
            if (profileUp && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-slate-800 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> מנוי PRO פעיל</p>'; }
            
            const tcHeader = getEl('timeclock-admin-view');
            if(tcHeader && !getEl('tc-month-filter')) {
                tcHeader.insertAdjacentHTML('afterbegin', `
                    <select id="tc-month-filter" onchange="if(typeof fetchTimeclockReport === 'function') fetchTimeclockReport()" class="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none font-bold mb-2 ml-2"><option value="all">כל החודשים</option></select>
                    <button onclick="if(typeof exportTimeclockPDF === 'function') exportTimeclockPDF()" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-sm font-bold mb-2 shadow-sm border border-red-100 hover:bg-red-100 transition ml-2"><i class="fa-solid fa-file-pdf"></i> ייצא PDF</button>
                    <button onclick="if(typeof openManualPunchModal === 'function') openManualPunchModal()" class="bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-sm font-bold mb-2 shadow-sm border border-indigo-100 hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> דיווח נוכחות ידני</button>
                `);
                for(let i=0; i<12; i++) {
                    let d = new Date(); d.setMonth(d.getMonth()-i);
                    getEl('tc-month-filter').innerHTML += `<option value="${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}">${d.getMonth()+1}/${d.getFullYear()}</option>`;
                }
            }
        } else { 
            ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
            const profileUp = getEl('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
            const cardName = getEl('card-name'); if(cardName) cardName.innerText = currentUser.nickname.toUpperCase(); 
            const cardAllowance = getEl('card-allowance'); if(cardAllowance) cardAllowance.innerText = `₪${currentUser.allowance_amount || 0}`; 
            const cardInt = getEl('card-interest'); if(cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}`; 
            const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
            
            const tcUserHeader = getEl('timeclock-user-view');
            if(tcUserHeader && !getEl('btn-export-pdf-user')) {
                 tcUserHeader.insertAdjacentHTML('beforeend', `<button id="btn-export-pdf-user" onclick="if(typeof exportTimeclockPDF === 'function') exportTimeclockPDF()" class="mt-4 w-full max-w-[200px] mx-auto bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-red-100 hover:bg-red-100 transition flex items-center justify-center gap-2"><i class="fa-solid fa-file-pdf"></i> ייצא דוח חודשי ל-PDF</button>`);
            }
        }
        
        const tcView = getEl('timeclock-user-view'); if(tcView) tcView.classList.remove('hidden');
        const btnAddBudget = getEl('btn-add-budget-cat'); if(btnAddBudget) btnAddBudget.classList.remove('hidden'); 
        try { if(typeof updateBatteryUI === 'function') updateBatteryUI(); } catch(e){}
        
        if(!pollInterval) { pollInterval = setInterval(() => { try{ fetchData(); } catch(e){} try{ if(typeof fetchLoans === 'function') fetchLoans(); } catch(e){} if(isAdmin) { try{ if(typeof fetchPendingUsers === 'function') fetchPendingUsers(); } catch(e){} } }, 30000); }
        
        try { if(typeof fetchMembers === 'function') await fetchMembers(); } catch(e){}
        if(isAdmin) { try { if(typeof fetchPendingUsers === 'function') fetchPendingUsers(); } catch(e){} }
        try { await fetchData(); } catch(e){}
        try { if(typeof fetchLoans === 'function') await fetchLoans(); } catch(e){}
        try { if(typeof checkTimeclockStatus === 'function') await checkTimeclockStatus(); } catch(e){}

        // התיקון הקריטי להצגת הנתונים: פתיחת הטאב הראשי ובדיקת הודעת פתיחה
        switchTab('feed');
        try { await checkGlobalWelcome(); } catch(e) {}

    } catch (e) {
        console.error("Dashboard error:", e);
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        if (preloader) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => { preloader.classList.add('hidden'); }, 700); 
        }
    }
}
       
// -------------------- שעון נוכחות --------------------
async function setBusinessLocation() {
    if (!navigator.geolocation) { return showToast('error', 'הדפדפן שלך לא תומך בשירותי מיקום'); }
    if (!confirm('האם להגדיר את המיקום הנוכחי שלך כמיקום העסק? עובדים יוכלו לדווח נוכחות רק ברדיוס ממיקום זה.')) return;
    showToast('info', 'מאתר מיקום נוכחי...');
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude; const lng = position.coords.longitude;
        try {
            const res = await fetch(`${API}/timeclock/set-location`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id, lat, lng }) });
            const data = await res.json();
            if(data.success) showToast('success', 'מיקום העסק הוגדר בהצלחה במערכת!'); else showToast('error', data.error || 'שגיאה בשמירת המיקום');
        } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
    }, (error) => {
        if (error.code === 1) showToast('error', 'יש לאשר גישה למיקום (GPS) בהגדרות הדפדפן'); else showToast('error', 'שגיאה באיתור המיקום הנוכחי');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function checkTimeclockStatus() {
    try {
        const res = await fetch(`${API}/timeclock/status?userId=${currentUser.id}`); const data = await res.json();
        const btn = getEl('btn-punch'); const icon = getEl('tc-icon'); const text = getEl('tc-btn-text'); const info = getEl('tc-active-info'); const startTime = getEl('tc-start-time');
        if(!btn) return;
        isPunchedIn = data.isPunchedIn;
        if (isPunchedIn) {
            btn.className = "punch-btn w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-[0_10px_40px_-10px_rgba(239,68,68,0.4)] transition-all duration-300 bg-red-500 text-white hover:bg-red-600";
            icon.className = "fa-solid fa-arrow-right-from-bracket text-5xl mb-2"; text.innerText = "יציאה"; info.classList.remove('hidden');
            const d = new Date(data.punchInTime); startTime.innerText = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        } else {
            btn.className = "punch-btn w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-[0_10px_40px_-10px_rgba(59,130,246,0.4)] transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700";
            icon.className = "fa-solid fa-fingerprint text-5xl mb-2"; text.innerText = "כניסה"; info.classList.add('hidden');
        }
        // רענון אוטומטי של הרשימה למטה בכל פעם שהסטטוס נבדק (פותר את הבעיה שלא רואים יציאה/כניסה)
        fetchTimeclockReport();
    } catch(e) {}
}

async function handlePunch() {
    const btn = getEl('btn-punch'); if(!btn || btn.disabled) return;
    if (!navigator.geolocation) return showToast('error', 'הדפדפן שלך לא תומך בשירותי מיקום, חובה שירותי מיקום לדיווח נוכחות.');
    btn.disabled = true; 
    
    const icon = getEl('tc-icon'); const text = getEl('tc-btn-text');
    if (icon && text) {
        icon.className = 'fa-solid fa-location-crosshairs fa-spin text-5xl mb-2';
        text.innerText = 'מדווח...';
    }
    
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude; const lng = position.coords.longitude;
        try {
            const res = await fetch(`${API}/timeclock/punch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id, lat, lng }) });
            const data = await res.json();
            if(data.success) { 
                triggerConfetti(); 
                showToast('success', data.status === 'in' ? 'נרשמה כניסה למשמרת! עבודה נעימה' : 'נרשמה יציאה, תודה ולהתראות!'); 
                await checkTimeclockStatus(); 
                fetchData(); 
            } 
            else { 
                showToast('error', data.error || 'שגיאה בדיווח'); 
                checkTimeclockStatus(); 
            }
        } catch(e) { 
            showToast('error', 'שגיאת תקשורת עם השרת'); 
            checkTimeclockStatus(); 
        } finally {
            btn.disabled = false;
        }
    }, (error) => {
        if (error.code === 1) showToast('error', 'חובה לאשר גישה למיקום (GPS) כדי לדווח נוכחות!'); else showToast('error', 'שגיאה באיתור המיקום הנוכחי, נסה שוב');
        checkTimeclockStatus();
        btn.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

function openManualPunchModal() {
    getEl('manual-punch-modal').classList.remove('hidden');
    const uSelect = getEl('mp-user'); uSelect.innerHTML = '';
    membersCache.forEach(m => { if(m.role !== 'ADMIN') uSelect.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; });
}

async function submitManualPunch() {
    const uid = val('mp-user'); const date = val('mp-date'); const start = val('mp-start'); const end = val('mp-end');
    if(!uid || !date || !start || !end) return showToast('error', 'נא למלא את כל השדות');
    
    const punchIn = `${date}T${start}:00`; const punchOut = `${date}T${end}:00`;
    const diffMins = Math.round((new Date(punchOut) - new Date(punchIn)) / 60000);
    if(diffMins <= 0) return showToast('error', 'שעת יציאה חייבת להיות אחרי שעת כניסה');
    
    getEl('btn-submit-mp').disabled = true;
    try {
        await fetch(`${API}/timeclock/manual`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({groupId: currentGroup.id, userId: uid, punchIn, punchOut, totalMins: diffMins}) });
        showToast('success', 'דווח בהצלחה!');
        getEl('manual-punch-modal').classList.add('hidden');
        // רענון אוטומטי של הרשימה
        fetchTimeclockReport();
    } catch(e) {
        showToast('error', 'נדרש עדכון קל בשרת כדי לתמוך בהזנה ידנית!');
    } finally { getEl('btn-submit-mp').disabled = false; }
}

async function fetchTimeclockReport() {
    try {
        const filterEl = getEl('tc-user-filter');
        const monthFilter = getEl('tc-month-filter') ? getEl('tc-month-filter').value : 'all';
        if(filterEl && filterEl.options.length === 0) { filterEl.innerHTML = '<option value="all">כלל העובדים</option>'; membersCache.forEach(m => { if(m.role !== 'ADMIN') filterEl.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; }); }
        
        const userFilter = currentUser.role === 'ADMIN' && filterEl ? filterEl.value : currentUser.id;
        
        let reqUrl = `${API}/timeclock/report?groupId=${currentGroup.id}&userId=${userFilter}`;
        const res = await fetch(reqUrl); 
        let rawData = await res.json();
        
        // הגנה קריטית: חילוץ המערך למקרה והשרת עוטף אותו באובייקט
        let data = Array.isArray(rawData) ? rawData : (rawData.data || rawData.report || rawData.records || []);
        
        if (monthFilter !== 'all') {
            const [y, m] = monthFilter.split('-');
            data = data.filter(r => { const d = new Date(r.punch_in); return d.getFullYear() == y && (d.getMonth() + 1) == m; });
        }
        
        const list = getEl('timeclock-report-list'); if(!list) return;
        if(!data || data.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-10">אין דיווחי נוכחות לתקופה זו</p>'; return; }
        
        let html = ''; let userSummaries = {};
        
        data.forEach(r => {
            const inTime = new Date(r.punch_in); 
            const dateStr = inTime.toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year:'2-digit'});
            const inStr = inTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
            let outStr = '...'; 
            let totalStr = '-'; 
            let costStr = '';
            
            const user = membersCache.find(m => m.nickname === r.nickname) || {};
            const hourlyRate = parseFloat(user.allowance_amount) || 0;
            
            if(r.punch_out) { 
                const outTime = new Date(r.punch_out); outStr = outTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); 
                const hours = Math.floor(r.total_minutes / 60); const mins = r.total_minutes % 60; 
                totalStr = `${hours}:${mins < 10 ? '0'+mins : mins} ש'`;
                const cost = (r.total_minutes / 60) * hourlyRate;
                if(currentUser.role === 'ADMIN') costStr = `<span class="text-[10px] text-slate-400 ml-2">₪${cost.toFixed(1)}</span>`;
                
                if(!userSummaries[r.nickname]) userSummaries[r.nickname] = { minutes: 0, cost: 0, minHours: parseFloat(user.interest_rate)||0 };
                userSummaries[r.nickname].minutes += r.total_minutes; userSummaries[r.nickname].cost += cost;
            } else {
                outStr = '<span class="text-[10px] text-orange-500 font-bold animate-pulse">פעיל</span>';
            }
            
            const nameDisp = currentUser.role === 'ADMIN' ? `<span class="font-bold text-slate-700 text-xs w-20 truncate">${safeStr(r.nickname)}</span>` : '';
            html += `<div class="flex justify-between items-center px-3 py-2 hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
                        <div class="flex items-center gap-2">
                            ${nameDisp}
                            <span class="text-xs text-slate-500 font-mono">${dateStr}</span>
                            <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">${inStr} - ${outStr}</span>
                        </div>
                        <div class="flex items-center">
                            ${costStr}
                            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">${totalStr}</span>
                        </div>
                     </div>`;
        });
        
        let summaryHtml = '';
        if(currentUser.role === 'ADMIN' && Object.keys(userSummaries).length > 0) {
            summaryHtml = `<div class="bg-indigo-50 p-4 rounded-2xl mb-4 border border-indigo-100"><h4 class="font-black text-indigo-800 text-sm mb-2">סיכום עלויות שכר (תקופה נבחרת):</h4><div class="space-y-2">`;
            for(let name in userSummaries) {
                const s = userSummaries[name]; const h = (s.minutes / 60).toFixed(1); const minH = s.minHours;
                const minWarning = (minH > 0 && (s.minutes/60) < minH) ? `<span class="text-[9px] text-red-500 bg-red-50 px-1 rounded ml-1">חסרות ${ (minH - (s.minutes/60)).toFixed(1) } שעות למינימום</span>` : '';
                summaryHtml += `<div class="flex justify-between text-sm"><span class="font-bold text-slate-700">${name} ${minWarning}</span><span class="font-mono font-bold text-indigo-700">₪${s.cost.toFixed(0)} (${h} ש')</span></div>`;
            }
            summaryHtml += `</div></div>`;
        }
        
        list.innerHTML = `
            ${summaryHtml}
            <div id="pdf-report-content" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                ${html}
            </div>
        `;
    } catch(e) { showToast('error', 'שגיאה בטעינת דוח נוכחות'); }
}

const ALL_TABS = [
    { id: 'feed', name: 'ראשי 🏠' },
    { id: 'timeclock', name: 'נוכחות ⏱️' },
    { id: 'shifts', name: 'משמרות 🗓️' },
    { id: 'shop', name: 'רכש ארגוני 🛒' },
    { id: 'pantry', name: 'ניהול מלאי 📦' },
    { id: 'sales', name: 'מכירות / חנות 🛍️' },
    { id: 'bank', name: 'כספים 💳' },
    { id: 'cashflow', name: 'תזרים מזומנים 💸' },
    { id: 'budget', name: 'תקציבים 📊' },
    { id: 'forecast', name: 'תשקיף 📅' },
    { id: 'tasks', name: 'פרויקטים ומשימות ✅' },
    { id: 'academy', name: 'מרכז הכשרות 🎓' },
    { id: 'community', name: 'קהילות מחוברות 🏘️' },
    { id: 'members', name: 'ניהול צוות 👥' }
];

const ROLE_DEFAULTS = {
    'ADMIN': ALL_TABS.map(t => t.id),
    'MANAGER': ['feed', 'timeclock', 'shifts', 'shop', 'pantry', 'tasks', 'academy', 'sales'],
    'SENIOR': ['feed', 'timeclock', 'shifts', 'pantry', 'tasks', 'academy'],
    'MEMBER': ['feed', 'timeclock', 'shifts', 'tasks', 'academy']
};

function enforcePermissions() {
    if (!currentUser || !currentGroup) return;
    const isAdmin = currentUser.role === 'ADMIN';
    let userTabs = [];
    try {
        const perms = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
        userTabs = perms.tabs || ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER'];
    } catch(e) { userTabs = ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER']; }

    ALL_TABS.forEach(tab => {
        const btn = getEl(`tab-${tab.id}`);
        if(btn) {
            if (userTabs.includes(tab.id) || isAdmin) btn.style.display = 'inline-block';
            else btn.style.display = 'none';
        }
    });

    const activeTabs = document.querySelectorAll('.tab-active');
    activeTabs.forEach(activeBtn => {
        if (activeBtn.style.display === 'none') switchTab('feed');
    });
    
    if (!isAdmin) {
        if(getEl('bank-admin-view')) getEl('bank-admin-view').classList.add('hidden');
        if(getEl('admin-loans-panel')) getEl('admin-loans-panel').classList.add('hidden');
        if(getEl('admin-members-tools')) getEl('admin-members-tools').classList.add('hidden');
        if(getEl('timeclock-admin-view')) getEl('timeclock-admin-view').classList.add('hidden');
        if(getEl('academy-admin-view')) getEl('academy-admin-view').classList.add('hidden');
        if(getEl('admin-shop-tools')) getEl('admin-shop-tools').classList.add('hidden');
        if(getEl('shop-requests-container')) getEl('shop-requests-container').classList.add('hidden');
        if(getEl('btn-sales-catalog')) getEl('btn-sales-catalog').classList.add('hidden');
        if(getEl('btn-sales-settings')) getEl('btn-sales-settings').classList.add('hidden');
    } else {
        if(getEl('bank-admin-view')) getEl('bank-admin-view').classList.remove('hidden');
        if(getEl('admin-members-tools')) getEl('admin-members-tools').classList.remove('hidden');
        if(getEl('timeclock-admin-view')) getEl('timeclock-admin-view').classList.remove('hidden');
        if(getEl('academy-admin-view')) getEl('academy-admin-view').classList.remove('hidden');
        if(getEl('btn-sales-catalog')) getEl('btn-sales-catalog').classList.remove('hidden');
        if(getEl('btn-sales-settings')) getEl('btn-sales-settings').classList.remove('hidden');
    }
}

function openPermissionsModal(id, name, role, permissionsStr) {
    getEl('perm-user-id').value = id;
    getEl('perm-user-name').innerText = `עריכת הרשאות לעובד: ${name}`;
    let perms = {};
    try { perms = JSON.parse(permissionsStr); } catch(e) {}
    const userTabs = perms.tabs || ROLE_DEFAULTS[role] || ROLE_DEFAULTS['MEMBER'];
    const selectEl = getEl('perm-role-select');
    if (selectEl) {
        selectEl.value = role === 'ADMIN' ? 'ADMIN' : (role || 'MEMBER');
        selectEl.className = role === 'ADMIN' ? 'modern-input py-2 text-sm bg-purple-50 border-purple-200 text-purple-800 font-bold' : 'modern-input py-2 text-sm bg-indigo-50 border-indigo-100 text-indigo-800 font-bold';
    }
    renderTabsCheckboxes(userTabs);
    getEl('permissions-modal').classList.remove('hidden');
}

function applyRoleDefaults(role) {
    const selectEl = getEl('perm-role-select');
    if (selectEl) {
        selectEl.className = role === 'ADMIN' ? 'modern-input py-2 text-sm bg-purple-50 border-purple-200 text-purple-800 font-bold' : 'modern-input py-2 text-sm bg-indigo-50 border-indigo-100 text-indigo-800 font-bold';
    }
    renderTabsCheckboxes(ROLE_DEFAULTS[role] || ROLE_DEFAULTS['MEMBER']);
}

function renderTabsCheckboxes(activeTabs) {
    const container = getEl('perm-tabs-container');
    if(!container) return;
    container.innerHTML = ALL_TABS.map(tab => {
        const isChecked = activeTabs.includes(tab.id) ? 'checked' : '';
        const isDisabled = tab.id === 'feed' ? 'disabled' : ''; 
        const opacity = isDisabled ? 'opacity-50' : '';
        return `
        <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition ${opacity}">
            <input type="checkbox" value="${tab.id}" class="perm-tab-cb w-4 h-4 accent-indigo-600" ${isChecked} ${isDisabled}>
            <span class="text-xs font-bold text-slate-700">${tab.name}</span>
        </label>
        `;
    }).join('');
}

async function submitPermissions() {
    const id = val('perm-user-id');
    const role = val('perm-role-select');
    const checkedTabs = Array.from(document.querySelectorAll('.perm-tab-cb:checked')).map(cb => cb.value);
    if (!checkedTabs.includes('feed')) checkedTabs.push('feed');

    const btn = getEl('btn-submit-permissions');
    if(btn) { btn.disabled = true; btn.innerText = 'שומר בשרת...'; }
    
    try {
        const res = await fetch(`${API}/users/${id}/permissions`, { 
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ tabs: checkedTabs, role: role }) 
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'הרשאות וסיווג עודכנו בהצלחה!');
            getEl('permissions-modal').classList.add('hidden');
            fetchMembers(); 
            
            if (String(id) === String(currentUser.id)) {
                currentUser.role = role;
                currentUser.permissions = { tabs: checkedTabs };
                enforcePermissions();
            }
        } else {
            showToast('error', data.error);
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
    finally { if(btn) { btn.disabled = false; btn.innerText = 'שמור הרשאות'; } }
}

const originalSwitchTab = window.switchTab;
if (originalSwitchTab && !window.switchTabOverridden) {
    window.switchTab = function(tabId) {
        originalSwitchTab(tabId);
        setTimeout(enforcePermissions, 50);
    };
    window.switchTabOverridden = true;
}
setTimeout(enforcePermissions, 1500);

// פונקציה חדשה: ייצוא ל-PDF (סעיף 5 ו-6)
function exportTimeclockPDF() {
    const element = getEl('pdf-report-content');
    if(!element) return showToast('error', 'אין נתונים לייצוא');
    
    showToast('info', 'מייצר קובץ PDF...');
    const period = getEl('tc-month-filter') ? getEl('tc-month-filter').options[getEl('tc-month-filter').selectedIndex].text : 'כל התקופה';
    const userName = currentUser.role === 'ADMIN' ? (getEl('tc-user-filter') ? getEl('tc-user-filter').options[getEl('tc-user-filter').selectedIndex].text : 'כל העובדים') : currentUser.nickname;
    const filename = `Report_${userName}_${period}.pdf`.replace(/ /g, '_');
    
    // מעטפת נקייה ל-PDF כדי שהעיצוב יראה טוב בהדפסה
    const pdfWrapper = document.createElement('div');
    pdfWrapper.style.padding = '20px';
    pdfWrapper.style.direction = 'rtl';
    pdfWrapper.style.fontFamily = 'sans-serif';
    pdfWrapper.innerHTML = `
        <h2 style="font-size: 18px; margin-bottom: 5px; color: #1e293b;">דוח נוכחות - ${safeStr(currentGroup.name)}</h2>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">עובד: ${userName} | תקופה: ${period} | הופק ב: ${new Date().toLocaleDateString('he-IL')}</p>
        <div style="font-size: 12px;">${element.innerHTML}</div>
    `;

    const opt = { 
        margin: 10, 
        filename: filename, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(pdfWrapper).save().then(() => {
        showToast('success', 'דוח נשמר בהצלחה!');
    }).catch(err => {
        showToast('error', 'שגיאה ביצירת ה-PDF');
    });
}

window.openBalanceAdjustmentModal = function(id, name) { getEl('adjustment-user-id').value = id; getEl('adjustment-user-name').innerText = `עבור: ${name}`; getEl('adjustment-amount').value = ''; getEl('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); getEl('balance-adjustment-modal').classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס/מענק' : 'הפחתה תפעולית');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'המאזן עודכן בהצלחה!'); getEl('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        let json = await res.json(); 
        // תיקון: הגנה ממצב שבו השרת מחזיר אובייקט במקום מערך ישיר
        membersCache = json.members || (Array.isArray(json) ? json : []);
        
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = getEl('budget-filter'); const fF = getEl('feed-user-filter'); const gS = getEl('goal-target-user'); const cfF = getEl('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כלל הארגון</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל העובדים</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כל העובדים</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`); if(cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור איזה צוות/עובד?</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${safeStr(m.nickname)}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        
       try {
            const c = getEl('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                    const adminPermsBtn = currentUser.role === 'ADMIN' ? `<button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${m.role}', '${permsStr}')" class="mr-2 text-purple-600 hover:text-purple-800 bg-purple-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="סיווג והרשאות"><i class="fa-solid fa-user-shield text-sm"></i></button>` : '';
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="mr-2 text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="מחיקת עובד"><i class="fa-solid fa-trash text-sm"></i></button>` : '';
                    c.innerHTML += `<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${safeStr(m.nickname) || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${m.role === 'ADMIN' ? 'מנהל' : 'עובד'})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg ml-2">${m.balance !== null && m.balance !== undefined ? `₪${m.balance}` : '🔒'}</span>${adminPermsBtn}${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        
        try {
            const a = getEl('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין עובדים רשומים כרגע בארגון.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(m.nickname) || 'עובד'}</h4><p class="text-[10px] text-slate-400">תעריף: ₪${m.allowance_amount || 0}/שעה • מינימום: ${m.interest_rate || 0} ש'</p><p class="text-xs font-bold text-slate-700 mt-1">תקציב נוכחי: <span class="text-slate-800">₪${m.balance || 0}</span></p></div></div><div class="flex gap-1 sm:gap-2"><button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${m.role}', '${permsStr}')" class="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center transition" title="הרשאות וגישה"><i class="fa-solid fa-user-shield text-sm"></i></button><button onclick="openBalanceAdjustmentModal(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="תיקון/בונוס"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${safeStr(m.nickname)}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}
async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות של העובדים למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעבד ושולח...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'דוח הגישה נשלח בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchData() {
    try {
        if (!currentUser || !currentUser.id || !currentGroup || !currentGroup.id) return;
        if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('price-input')) return;

        const res = await fetch(`${API}/data/${currentUser.id}?groupId=${currentGroup.id}`);
        let parsed = {};
        try { parsed = await res.json(); } catch(err) { console.warn("JSON Error, continuing with empty data", err); }
        
        let data = parsed.data || parsed || {};
        
        if (data && data.user) {
            currentUser.balance = data.user.balance || 0; 
        }
        
        if(data && data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; 
            currentGroup.is_premium = data.group.is_premium;
            currentGroup.community_id = data.group.community_id;
            try { if(typeof updateBatteryUI === 'function') updateBatteryUI(); } catch(e){}
            
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-slate-800 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> מסלול PRO פעיל</p>'; }
        }

        if (currentUser.role === 'ADMIN') {
            const balEl = document.getElementById('user-balance'); 
            if(balEl) {
                const realBalance = (data.group && data.group.admin_total_balance) ? data.group.admin_total_balance : 0;
                balEl.innerText = `₪${parseFloat(realBalance).toFixed(2)}`;
                balEl.className = `text-3xl font-bold font-mono tracking-tight mt-1 ${realBalance >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        } else {
            const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; 
        bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; 
        pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try {
            if (currentUser.role === 'ADMIN') {
                if(typeof renderAdminAcademy === 'function') renderAdminAcademy();
            } else {
                if(typeof renderMyAssignments === 'function') renderMyAssignments(bundlesCache);
                if(typeof renderLibrary === 'function') renderLibrary();
            }
        } catch(e) { console.warn(e); }
        
        try { if(typeof renderTasks === 'function') renderTasks(allTasks); } catch(e) { console.warn(e); }
        try { if(typeof renderPantry === 'function') renderPantry(); } catch(e) { console.warn(e); }
        try { if(typeof renderShifts === 'function') renderShifts(); } catch(e) { console.warn(e); }
        
        shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : [];
        try { if(typeof renderShopList === 'function') renderShopList(); } catch(e) { console.warn(e); }
        
        try { if(typeof fetchBudget === 'function') fetchBudget(); } catch(e) { console.warn(e); }
        try { if(typeof renderForecast === 'function') renderForecast(); } catch(e) { console.warn(e); }
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${safeStr(g.owner_name)}</span>` : ''; const adviseBtn = `<button onclick="if(typeof getBusinessAIAdvice === 'function') getBusinessAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> המלצת AI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${safeStr(g.title)}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="if(typeof openDepositModal === 'function') openDepositModal(${g.id}, '${safeStr(g.title)}')" class="mt-2 bg-slate-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-700 transition"><i class="fa-solid fa-plus"></i> העברה ליעד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים מוגדרים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהתקציב שאושר!' : 'עמידה ביעדי התקציב מזכה בבונוס!'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { 
                let transData = await transRes.json(); 
                allTransactions = transData.transactions || (Array.isArray(transData) ? transData : []); 
            }
        } catch(e) { allTransactions = []; }

        try { if (typeof renderEmployeeTodo === 'function') renderEmployeeTodo(); } catch(e) {}
try { if (typeof buildAndRenderFeed === 'function') buildAndRenderFeed(); } catch(e) {}
        
        try {
            const cashTab = document.getElementById('tab-cashflow'); 
            if (cashTab && cashTab.classList.contains('tab-active') && typeof renderCashflow === 'function') renderCashflow();
        } catch(e) {}
        
        try { if (typeof loadBizCommunities === 'function') loadBizCommunities(); } catch(e) {} 
        
        // טעינת נתוני רכש מראש כדי למנוע טאבים ריקים בפתיחה ראשונה
        try { if (typeof fetchSuppliers === 'function') fetchSuppliers(); } catch(e) {}
        try { if (typeof fetchB2BCatalog === 'function') fetchB2BCatalog(); } catch(e) {}
        try { if (typeof fetchB2BOrders === 'function') fetchB2BOrders(); } catch(e) {}

    } catch(e) {
        console.error("Fetch data error:", e);
    }
}
function showAIModal(title, text) {
    getEl('familai-advisor-modal').classList.remove('hidden'); getEl('familai-modal-subtitle').innerText = title;
    if (text) { getEl('familai-advisor-loading').classList.add('hidden'); getEl('familai-advice-text').innerText = text; getEl('familai-advisor-content').classList.remove('hidden'); } 
    else { getEl('familai-advisor-loading').classList.remove('hidden'); getEl('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { getEl('ai-modal').classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא להכשרה'); btn.disabled = true; btn.innerText = 'ה-AI מעבד... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic') + " (בסביבה עסקית ארגונית)", groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'הכשרת ה-AI מוכנה!'); getEl('ai-modal').classList.add('hidden'); getEl('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת התוכן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור חפיפה'; }
    });
}

async function getBusinessAIAdvice(employeeId, goalId) {
    executeWithAIWarning(async () => {
        showAIModal('היועץ העסקי של הארגון', null); getEl('familai-loading-text').innerText = 'מנתח ביצועים ויעדים...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: employeeId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showAIModal('היועץ העסקי של הארגון', data.advice); triggerConfetti(); fetchData(); } 
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערים, לא הצלחנו לייצר אנליזה כרגע.'); }
        } catch (e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showAIModal('אנליסט התקציב AI', null); getEl('familai-loading-text').innerText = 'מנתח חריגות ושימושים החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showAIModal('אנליסט התקציב AI', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showAIModal('מנהל הרכש והמלאי AI', null); getEl('familai-loading-text').innerText = 'מחשב כמויות מול צריכה בפועל...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showAIModal('מנהל הרכש והמלאי AI', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; getEl('btn-tutor').disabled = true; getEl('btn-tutor').innerText = 'מייצר הסבר... ⏳';
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showAIModal('ניתוח שגיאה מקצועי (AI)', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { getEl('btn-tutor').disabled = false; getEl('btn-tutor').innerHTML = '<i class="fa-solid fa-brain"></i> ניתוח שגיאה ע"י AI'; }
    });
}

function setTaskMode(mode) {
    const mBtn = getEl('btn-mode-manual'); const aBtn = getEl('btn-mode-ai'); const mDiv = getEl('task-mode-manual'); const aDiv = getEl('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { getEl('task-modal').classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    getEl('task-modal').classList.remove('hidden'); getEl('task-is-self').value = isSelf; 
    getEl('task-days').value = ''; getEl('task-title').value = ''; getEl('task-reward').value = ''; getEl('ai-task-topic').value = ''; getEl('ai-task-results').classList.add('hidden');
    setTaskMode('manual'); const toggles = getEl('task-mode-toggles'); const assigneeContainer = getEl('task-assignee-container'); const rewardInput = getEl('task-reward'); const assigneeSelect = getEl('task-assignee');

    if(isSelf) { 
        getEl('task-modal-title').innerText = 'דיווח ביצוע / יוזמה'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardInput.placeholder = 'תמריץ מבוקש? (₪)'; 
    } else { 
        getEl('task-modal-title').innerText = 'מטלה חדשה / פרויקט'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardInput.placeholder = 'תגמול בונוס (₪) - אופציונלי';
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחר/י עובד...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין אנשי צוות רשומים</option>';
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = val('task-is-self') === 'true'; 
        let age = 30; // גיל פיקטיבי לעובד בוגר
        if (!isSelf) {
             if(!assigneeId) return showToast('error', 'קודם כל בחרו למעלה עבור איזה עובד המשימה 👆');
        }
        if(!topic) return showToast('error', 'תארו בקצרה את הפרויקט...');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מפרק למשימות...';
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic + " (בסביבת עבודה ארגונית)", groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = getEl('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על הטיקט שתרצו להוסיף לצוות:</p>';
                data.tasks.forEach(task => { const t = safeStr(task.title); resultsContainer.innerHTML += `<div onclick="selectAITask('${t}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-slate-200 hover:bg-slate-50 transition"><span class="text-sm font-bold text-slate-700">${safeStr(task.title)}</span><span class="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                resultsContainer.classList.remove('hidden'); fetchData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> הצע תכנית עבודה'; }
    });
}

function selectAITask(title, reward) { getEl('task-title').value = title; getEl('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = val('task-is-self') === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור עובד לטיקט'); if(!title) return showToast('error', 'נא לפרט את תוכן המשימה');
    const btn = getEl('btn-submit-task'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const statusToSend = isSelf ? 'done' : 'pending';
    try {
        await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend, groupId: currentGroup.id }) }); 
        if(isSelf) triggerConfetti(); 
        closeTaskModal(); 
        showToast('success', isSelf ? 'נשלח לאישור מנהל!' : 'טיקט נפתח בהצלחה!'); 
        fetchData(); 
    } catch(e) { showToast('error', 'שגיאת שרת ביצירת משימה'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'הקצה משימה'; } }
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
        showAIModal('בקרת איכות אוטומטית (QA)', null); getEl('familai-loading-text').innerText = 'ה-AI סורק את ההוכחה שצורפה...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showAIModal('בקרת איכות (QA)', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showAIModal('רואה חשבון אוטומטי', null); getEl('familai-loading-text').innerText = 'סורק את החשבונית... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showAIModal('רואה חשבון אוטומטי', `סרקתי והוספתי ${data.count} פריטים מהחשבונית לדרישות הרכש שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת החשבונית.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showAIModal('זיהוי ציוד ומק"ט חכם', null); getEl('familai-loading-text').innerText = 'בודק איזה מוצר צולם...';
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

function renderEmployeeTodo() {
    const todoSection = getEl('child-todo-section'); const todoList = getEl('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        // הוספת ההגנה t.title && 
        if(t.title && t.title.startsWith('SHIFT|')) return;
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">נותרו ${diff} ימים</span>` : ` • <span class="text-red-500">חריגת זמנים!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(t.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • טיקט / משימה • בונוס: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">נותרו ${diff} ימים</span>` : ` • <span class="text-red-500">חריגת זמנים!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center"><i class="fa-solid fa-book-open"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • לומדה • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function openApproveTaskModal(id, title, currentReward) { getEl('approve-task-id').value = id; getEl('approve-task-title').innerText = title; getEl('approve-task-reward').value = currentReward || 0; getEl('approve-task-modal').classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = getEl('approve-task-id').value; const finalReward = getEl('approve-task-reward').value;
    getEl('approve-task-modal').classList.add('hidden'); triggerConfetti();
    const res = await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    const data = await res.json();
    if(data.success) { showToast('success', 'המשימה אושרה והבונוס שוחרר לעובד!'); fetchData(); } else showToast('error', data.error);
}

function renderTasks(tasks) {
    const list = getEl('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        // הוספת ההגנה t.title &&
        if(t.title && t.title.startsWith('SHIFT|')) return;
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-100'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${safeStr(t.title)}')" class="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-slate-700 transition flex items-center gap-1"><i class="fa-solid fa-check"></i> דיווח סיום</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לביצוע</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-amber-50 border-amber-100'; if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${safeStr(t.title)}', ${t.reward})" class="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700">אישור סופי</button>`; } else { statusBadge = `<span class="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-1 rounded-lg">בבקרת מנהל</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check-double"></i> סגור</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 rounded">בונוס ₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">שגרה</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> ${diff} ימים</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> חריגה!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> נפתח: ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${safeStr(t.title)} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${safeStr(t.assignee_name)}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין פרויקטים פעילים</div>'; else list.innerHTML = htmlStr;
}

function renderShifts() {
    // הוספת ההגנה t.title &&
    const shiftTasks = allTasks.filter(t => t.title && t.title.startsWith('SHIFT|'));
    const list = getEl('shifts-list'); if(!list) return;
    let html = '';
    shiftTasks.forEach(t => {
        const parts = t.title.split('|'); const date = parts[1]; const start = parts[2]; const end = parts[3];
        const isMyShift = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN';
        if (!isMyShift && !isAdmin) return;
        
        let statusBadge = t.status === 'pending' ? '<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">ממתין לאישור</span>' : '<span class="text-xs bg-green-100 text-green-600 px-2 py-1 rounded font-bold">משובץ</span>';
        let actions = '';
        if (isAdmin && t.status === 'pending') { actions = `<button onclick="updateTask(${t.id}, 'approved')" class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700">אשר</button> <button onclick="deleteTask(${t.id})" class="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-200">סרב</button>`; }
        if (isAdmin || isMyShift) { actions += ` <button onclick="deleteTask(${t.id})" class="text-slate-300 hover:text-red-500 mr-2"><i class="fa-solid fa-trash text-xs"></i></button>`; }

        html += `<div class="bg-white p-4 rounded-2xl border ${t.status === 'pending' ? 'border-orange-200' : 'border-slate-100'} shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-lg">${date}</p><p class="text-sm font-bold text-indigo-600">${start} - ${end} | <span class="text-slate-500 font-normal">${safeStr(t.assignee_name)}</span></p></div><div class="flex flex-col items-end gap-2">${statusBadge}<div class="flex gap-1 items-center">${actions}</div></div></div>`;
    });
    list.innerHTML = html || '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין משמרות משובצות במערכת</p>';
}

function openShiftModal() {
    getEl('shift-modal').classList.remove('hidden'); const userSel = getEl('shift-user');
    if(userSel) {
        userSel.innerHTML = '';
        if(currentUser.role === 'ADMIN') { membersCache.forEach(m => { if(m.role !== 'ADMIN') userSel.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; }); } 
        else { userSel.innerHTML = `<option value="${currentUser.id}">${currentUser.nickname}</option>`; }
    }
}

async function submitShift() {
    const date = val('shift-date'); const start = val('shift-start'); const end = val('shift-end'); const userId = val('shift-user');
    if(!date || !start || !end || !userId) return showToast('error', 'נא למלא את כל השדות');
    const title = `SHIFT|${date}|${start}|${end}`; const status = currentUser.role === 'ADMIN' ? 'approved' : 'pending';
    const btn = getEl('btn-submit-shift'); btn.disabled = true; btn.innerText = 'שומר...';
    try {
        await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: 0, assignedTo: userId, days: null, status: status, groupId: currentGroup.id }) });
        getEl('shift-modal').classList.add('hidden'); showToast('success', status === 'approved' ? 'המשמרת שובצה!' : 'בקשתך נשלחה למנהל!'); fetchData();
    } catch(e) { showToast('error', 'שגיאה בשמירת המשמרת'); } finally { btn.disabled = false; btn.innerText = 'שמור משמרת'; }
}

async function updateTask(id, s) { if(s==='done' || s==='completed_self') triggerConfetti(); await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:s})}); fetchData(); }
async function deleteTask(id) { if(!confirm('האם למחוק/לסרב לבקשה?')) return; await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:'deleted'})}); fetchData(); } 

function buildAndRenderFeed() {
    feedCache = [];
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'סביבת עבודה נפתחה בהצלחה! 🎉', amount: 0, status: 'welcome' }); }
    if(Array.isArray(allTransactions)) { allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); }); }
    if(Array.isArray(allTasks)) { 
        allTasks.forEach(t => { 
            // תיקון: הגנה מקריסה אם למשימה אין כותרת
            if(t.status === 'approved' && (!t.title || !t.title.startsWith('SHIFT|'))) { 
                feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `טיקט: ${t.title || 'ללא שם'}`, amount: t.reward, status: t.status }); 
            } 
        }); 
    }
    if(Array.isArray(bundlesCache)) { bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `הכשרה: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); }); }
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
        const colorClass = item.type === 'system' ? 'bg-blue-50 border-blue-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); 
        const userNameDisplay = item.type !== 'system' && item.user_name ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${safeStr(item.user_name)}</span>` : '';
        const d = item.date; const today = new Date(); const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
        let contentHtml = '';
        if (item.type === 'transaction') {
            const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; const prefix = item.isIncome ? '+' : '-';
            contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        } else if (item.type === 'task') {
            const icon = '<i class="fa-solid fa-list-check text-slate-600 bg-slate-200 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'pending' ? 'פתוח' : (item.status === 'done' ? 'ממתין לאישור' : 'סגור'); let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'quiz') {
            const icon = '<i class="fa-solid fa-book-open text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'assigned' ? 'נשלח לעובד' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'לא עבר'); let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'system') {
            const icon = '<i class="fa-solid fa-building text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>';
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
        const editBtn = currentUser.role === 'ADMIN' ? `<button onclick="openEditTransactionModal(${t.id}, ${t.amount}, '${safeStr(t.description)}', '${t.category}', '${t.type}')" class="text-slate-500 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 transition"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
        html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between hover:border-slate-200 transition"><div class="flex-1 overflow-hidden pr-2"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${safeStr(t.description)}</span> ${userName}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} ${catBadge}</p></div><div class="flex items-center gap-3 pl-1"><span class="font-bold text-base ${amountClass} whitespace-nowrap" dir="ltr">${prefix}₪${t.amount}</span>${editBtn}</div></div>`;
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
    const cSelect = getEl('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר עובד...</option>';
    if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`; }); }
    const bSelect = getEl('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר לומדה...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'financial' ? '📈' : (b.type === 'reading' ? '📖' : '🧠')}] ${safeStr(b.title)} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין הדרכות זמינות</option>'; }
    getEl('assign-reward').value = ''; getEl('assign-days').value = ''; getEl('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = getEl('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); const reward = val('assign-reward'); const days = val('assign-days');
    if(!childId) return showToast('error', 'אנא בחר איש צוות לשיוך'); if(!bundleId) return showToast('error', 'אנא בחר הכשרה');
    const res = await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days, groupId: currentGroup.id }) });
    const data = await res.json();
    if(data.success) { getEl('assign-quiz-modal').classList.add('hidden'); showToast('success', 'השיוך בוצע בהצלחה'); fetchData(); } else showToast('error', data.error);
}

function renderAdminAcademy() {
    const list = getEl('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3"><i class="fa-solid fa-swatchbook"></i> מאגר חפיפות נהלים</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין הכשרות זמינות. לחץ על "יצירת הכשרה AI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'financial' ? '📈' : (type === 'reading' ? '📖' : '🧠'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-slate-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • קהל: ${b.age_group} • תמריץ: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition">שיוך לעובד</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6"><i class="fa-solid fa-list-check"></i> מעקב ביצוע</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">טרם בוצעו שיוכים לאנשי צוות.</p>'; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם בהצטיינות' : (b.status === 'failed' ? 'נכשל / לפסילה' : 'טרם בוצע'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
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
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין חומר למידה חדש להצגה כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'financial') return '<i class="fa-solid fa-chart-line"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-brain"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-slate-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • קהל: ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition shadow-sm">התחל</button></div>`;
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
    getEl('quiz-icon').innerHTML = passed ? '🏆' : '📚'; getEl('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא, אפשר לנסות שוב...'; getEl('quiz-msg-desc').innerText = passed ? `השלמת את חפיפת הנהלים וזכית בתמריץ של ₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `יש להגיע לציון של ${currentQuizData.threshold}% כדי לעבור את ההכשרה.`; getEl('quiz-score-display').innerText = `ציון סופי: ${finalScore}%`;
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
    if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
    const list = getEl('shop-list'); const reqList = getEl('shop-requests-list'); const reqContainer = getEl('shop-requests-container');
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        if(reqContainer) reqContainer.classList.remove('hidden'); // הגנה קריטית
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין להנהלה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${safeStr(i.item_name)}</span><span class="text-xs text-slate-500 block">דרישה מאת: ${safeStr(i.requester_name)}</span></div>${actions}</div>`;
        });
        if(reqList) reqList.innerHTML = reqHtml;
    } else { if(reqContainer) reqContainer.classList.add('hidden'); }

    const isShopTabActive = getEl('tab-shop') && getEl('tab-shop').classList.contains('tab-active');

const footerEl = getEl('cart-footer');
    if (footerEl) footerEl.style.display = 'none'; // השבתה מוחלטת של הפס הישן

    if(activeItems.length === 0) { 
        if(list) list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">רשימת ההזמנות ריקה</p>'; 
        const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    const fc = getEl('fab-container');
    if (isShopTabActive) { 
        if(fc) fc.classList.add('fab-lifted'); 
    } else { 
        if(fc) fc.classList.remove('fab-lifted'); 
    }
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
    if(list) list.innerHTML = shopHtml; 
    calcRunningTotal();
}
async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = getEl(`row-${id}`); const input = getEl(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => String(i.id) === String(id)); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = getEl(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: parseFloat(value) || 0})}); const data = await res.json(); const freshWisdomDiv = getEl(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => String(i.id) === String(id)); if(cachedItem) cachedItem.estimated_price = parseFloat(value) || 0; } 
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
    const store = val('checkout-store') || 'ספק כללי'; const branch = val('checkout-branch'); let total = 0; const boughtItems = []; const missingItems = [];
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
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד ארגון לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/business.html?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו פורטל ארגוני ב-Oneflowlife Pro 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד הכניסה שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו להתנהל עם Oneflowlife Pro 🚀\n\nקוד הארגון לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); getEl('invite-modal').classList.add('hidden'); 
}

function toggleFab() { getEl('fab-container').classList.toggle('fab-open'); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = getEl('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${safeStr(i.item_name)} (x${i.quantity} ${safeStr(i.unit || "יח'")})</span><span class="font-bold">₪${i.price_per_unit || 0}/${safeStr(i.unit || "יח'")}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${safeStr(t.store_name)} ${t.branch_name ? `(${safeStr(t.branch_name)})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • אישור: ${safeStr(t.nickname)}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700">יבא דרישה שוב</button></div></div>`; }); getEl('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { 
    getEl('bank-user-id').value = id; 
    getEl('bank-user-name').innerText = `תנאי העסקה: ${name}`; 
    getEl('bank-allowance').value = allowance; 
    getEl('bank-allowance').placeholder = "תעריף שעתי (₪)";
    getEl('bank-interest').value = interest; 
    getEl('bank-interest').placeholder = "יעד שעות מינימום לחודש";
    getEl('bank-settings-modal').classList.remove('hidden'); 
}
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); getEl('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לאשר תשלום תקציבים ובונוסים לעובדים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { showToast('success', `חולקו ${data.totalDistributed} ש"ח לעובדים!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה בשרת'); } }
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
        if (data.success) { getEl('loan-modal').classList.add('hidden'); showToast('success', 'בקשת ההחזר נשלחה להנהלה 📨'); fetchData(); fetchLoans(); } else showToast('error', data.error);
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
        const list = getEl('budget-list'); 
        if(!list) return; // הגנה קריטית: אם הטאב לא קיים אל תקרוס
        list.innerHTML = '';
        
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
            const childrenSectionTitle = currentUser.role === 'ADMIN' ? 'תקציבי יעדים ובונוסים' : 'התקציב שלי';
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
    let text = `*רשימת רכש ארגונית:*\n\n`; activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
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
    container.className = "mt-6 border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-center gap-6 w-full";
    
    let sumsHtml = `
        <div class="flex flex-col gap-3 w-full md:w-auto text-center md:text-right shrink-0">
            <div class="bg-green-50 border border-green-100 p-3 rounded-xl flex flex-col items-center sm:items-start">
                <span class="text-[10px] text-green-600 font-bold block mb-1">סה"כ הכנסות צפויות:</span>
                <span class="text-lg font-black text-green-700 dir-ltr">₪${totalIncome.toFixed(2)}</span>
            </div>
            <div class="bg-red-50 border border-red-100 p-3 rounded-xl flex flex-col items-center sm:items-start">
                <span class="text-[10px] text-red-600 font-bold block mb-1">סה"כ הוצאות צפויות:</span>
                <span class="text-lg font-black text-red-700 dir-ltr">₪${totalExpense.toFixed(2)}</span>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${sumsHtml}
        <div class="w-full flex flex-col items-center" style="max-width: 250px;">
            <h4 class="text-sm font-bold text-center text-slate-600 mb-2">יחס תזרים צפוי</h4>
            <div class="relative h-48 w-full flex justify-center"><canvas id="ratioChart"></canvas></div>
        </div>
    `;
    const ctx = getEl('ratioChart'); if(!ctx) return;
    if(forecastRatioChart) forecastRatioChart.destroy();
    
    // מארגנים את הנתונים - גם אם אין נתונים מציגים עוגה אפורה ריקה
    const hasData = totalIncome > 0 || totalExpense > 0;
    const chartData = hasData ? [totalIncome, totalExpense] : [1];
    const chartBg = hasData ? ['#22c55e', '#ef4444'] : ['#e2e8f0'];
    const chartLabels = hasData ? [`הכנסות (₪${totalIncome.toFixed(0)})`, `הוצאות (₪${totalExpense.toFixed(0)})`] : ['אין נתונים לחודש זה'];

    forecastRatioChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: chartLabels, 
            datasets: [{ 
                data: chartData, 
                backgroundColor: chartBg, 
                borderWidth: 2, 
                hoverOffset: 4 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { family: 'Rubik', size: 11 },
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    enabled: hasData // מכבה טולטיפ כשאין נתונים
                }
            } 
        } 
    });
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

function initAccessibility() { 
    const saved = localStorage.getItem('ofl_accessibility'); 
    if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } 
    
    // יצירת חלון נגישות במידה ולא קיים ב-HTML
    if(!getEl('accessibility-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="accessibility-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[9999] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                <button onclick="closeAccessibilityModal()" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full transition"><i class="fa-solid fa-xmark"></i></button>
                <h3 class="text-xl font-bold mb-4 text-center text-slate-800"><i class="fa-solid fa-universal-access text-blue-500"></i> תפריט נגישות</h3>
                <div class="space-y-3 mb-6">
                    <button id="acc-text-lg" onclick="toggleAccess('text-lg')" class="w-full p-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition text-right flex justify-between items-center">טקסט מוגדל <i class="fa-solid fa-text-height"></i></button>
                    <button id="acc-grayscale" onclick="toggleAccess('grayscale')" class="w-full p-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition text-right flex justify-between items-center">גווני אפור <i class="fa-solid fa-droplet-slash"></i></button>
                    <button id="acc-contrast" onclick="toggleAccess('contrast')" class="w-full p-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition text-right flex justify-between items-center">ניגודיות גבוהה <i class="fa-solid fa-circle-half-stroke"></i></button>
                    <button id="acc-readable-font" onclick="toggleAccess('readable-font')" class="w-full p-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition text-right flex justify-between items-center">גופן קריא <i class="fa-solid fa-font"></i></button>
                    <button id="acc-highlight-links" onclick="toggleAccess('highlight-links')" class="w-full p-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition text-right flex justify-between items-center">הדגשת קישורים <i class="fa-solid fa-link"></i></button>
                </div>
                <button onclick="resetAccessibility()" class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition">איפוס הגדרות נגישות</button>
            </div>
        </div>
        `);
    }
}function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = getEl(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
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
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את העובד לצמיתות?`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש הוסר בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }

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
        usersHtml += `<tr class="bg-slate-100 font-bold border-t-2 border-slate-300"><td colspan="2">סה"כ התחייבויות קופה (יתרות צוות):</td><td class="font-mono text-slate-800">₪${totalBalances.toFixed(2)}</td></tr>`;
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
            const statusMap = { 'pending': 'פרויקטים בעבודה', 'done': 'ממתינים לאישור מנהל', 'approved': 'הושלמו ושולמו' };
            data.tasksSummary.forEach(ts => { tasksHtml += `<li><strong>${statusMap[ts.status] || ts.status}:</strong> ${ts.count} משימות</li>`; });
        } else { tasksHtml = '<li>אין משימות או פרויקטים פעילים במערכת.</li>'; }
        tasksList.innerHTML = tasksHtml;

        getEl('report-360-modal').classList.remove('hidden');
    } catch(e) { showToast('error', 'שגיאת תקשורת בהבאת נתוני הדוח'); }
}

function download360PDF() {
    const element = getEl('report-360-content'); const groupName = getEl('report-360-group-name').innerText;
    const opt = { margin: 10, filename: `OneflowBIZ_Report_${groupName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save().then(() => { showToast('success', 'הדוח הורד בהצלחה למכשירך!'); }).catch(err => { showToast('error', 'שגיאה ביצירת קובץ ה-PDF'); });
}

// === פונקציות ניהול יחידות למזווה ===
// פונקציות המזווה הותאמו לתמוך בשברים ויחידות בודדות

function renderPantry() {
    const list = getEl('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המלאי ריק. קלטו ציוד וחומרי גלם כדי לעקוב אחרי המלאי בעסק!</p>'; return; }
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
                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full mt-1.5 w-max shadow-sm tracking-tight">${totalSubUnits} יחידות</span>
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
                <button onclick="openPantryUseModal('${n}', '${u}', ${packQty}, ${upp})" class="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-dolly text-slate-500"></i> דיווח שימוש</button>
                <button onclick="movePantryToCart(${p.id}, '${n}', '${u}')" class="flex-1 bg-slate-800 text-white py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down text-slate-300"></i> העבר לרכש</button>
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
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף למאגר'; } }
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר אזל מהמלאי. האם למחוק את הרישום? (ניתן להעביר לרכש במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}

function openPantryUseModal(name, unit, qty, upp) { 
    const totalSubUnits = Math.round(parseFloat(qty) * parseInt(upp || 1));
    getEl('use-pantry-title').innerText = `גריעה מהמלאי: ${name}`; 
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
            <div class="text-center mb-4 bg-indigo-50 text-indigo-700 py-2.5 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-1">
                <span class="font-bold text-sm">יתרה: ${parseFloat(qty).toFixed(2)} ${unit}</span>
                <span class="text-xs font-medium opacity-80">(סה"כ ${totalSubUnits} יחידות לשימוש)</span>
            </div>
            
            <div class="space-y-3">
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">גריעה ביחידות בודדות</label>
                    <input type="number" id="use-pantry-units-dyn" placeholder="כמה יחידות לקחת?" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-slate-800 text-center shadow-sm focus:border-indigo-500 transition">
                </div>
                
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">או: גריעה לפי מארז / משקל שלם</label>
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
// --- מודול חנות ומכירות (Store / E-commerce B2B/B2C) ---
// ============================================================

let storeCatalogCache = [];
let storeOrdersCache = [];
let currentModifiersUI = []; 
let storeModifierPresets = [];
let currentStoreOrderId = null;

function switchSalesTab(subTab) {
    ['orders', 'catalog', 'marketing', 'settings'].forEach(t => {
        const view = getEl(`sales-view-${t}`); if(view) view.classList.add('hidden');
        const btn = getEl(`btn-sales-${t}`); if(btn) btn.className = 'flex-1 py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    });
    const targetView = getEl(`sales-view-${subTab}`); if(targetView) targetView.classList.remove('hidden');
    const targetBtn = getEl(`btn-sales-${subTab}`); if(targetBtn) targetBtn.className = 'flex-1 py-2 px-3 text-xs font-bold bg-white text-slate-800 rounded-lg shadow-sm transition';

    if(subTab === 'orders') fetchStoreOrders();
    if(subTab === 'catalog') fetchStoreCatalog();
    if(subTab === 'marketing') fetchStoreMarketing(); 
    if(subTab === 'settings') fetchStoreSettings();
}

// === Marketing (Promotions & Coupons) ===
let storePromotionsCache = [];

async function fetchStoreMarketing() {
    fetchStoreCoupons();
    fetchStorePromotions();
}

async function fetchStorePromotions() {
    try {
        const res = await fetch(`${API}/store/promotions/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            storePromotionsCache = data.promotions || [];
            renderStorePromotions();
        }
    } catch(e) { console.error(e); }
}

function renderStorePromotions() {
    const list = getEl('store-promotions-list');
    if(!list) return;
    
    if (storePromotionsCache.length === 0) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">לא מוגדרים מבצעים פעילים.</p>';
        return;
    }
    
    let html = '';
    storePromotionsCache.forEach(p => {
        let desc = '';
        if (p.promo_type === 'discount_pct') desc = `${p.promo_value}% הנחה`;
        else if (p.promo_type === 'bogo') desc = `1+1 מתנה (עד ₪${p.promo_value})`;
        else if (p.promo_type === 'fixed_price') desc = `ב-₪${p.promo_value} בלבד`;

        let targetArray = [];
        if(Array.isArray(p.target_ids)) targetArray = p.target_ids;
        else if(typeof p.target_ids === 'string') { try { targetArray = JSON.parse(p.target_ids); } catch(e){} }
        
        let targetDesc = p.target_type === 'all' ? 'חל על כל החנות' : `קטגוריה: ${targetArray.length > 0 ? targetArray[0] : ''}`;
        const activeColor = p.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-500 bg-slate-100 border-slate-200';
        
        const createdStr = p.created_at ? new Date(p.created_at).toLocaleDateString('he-IL') : '';
        const startStr = p.start_date ? new Date(p.start_date).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) : 'מיידי';
        const endStr = p.end_date ? new Date(p.end_date).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) : 'ללא הגבלת זמן';
        
        // תצוגה באדמין איפה המבצע מופיע (באנר / טאב)
        const isBanner = p.show_in_banner === true || String(p.show_in_banner) === 'true';
        const isTab = p.show_in_tab === true || String(p.show_in_tab) === 'true';

        html += `
        <div class="flex flex-col bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3 relative hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="bg-pink-50 text-pink-500 w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"><i class="fa-solid fa-gift"></i></div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(p.title)} <span class="text-[10px] text-pink-600 bg-pink-100 px-1.5 rounded-md mr-1">${desc}</span></h4>
                        <p class="text-[10px] text-slate-500 mt-0.5 font-medium">${targetDesc}</p>
                        <p class="text-[9px] text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> תוקף: ${startStr} - ${endStr}</p>
                        <div class="flex gap-2 mt-1">
                            ${isBanner ? '<span class="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded border border-blue-100"><i class="fa-regular fa-eye"></i> באנר עליון</span>' : ''}
                            ${isTab ? '<span class="text-[9px] bg-purple-50 text-purple-600 px-1.5 rounded border border-purple-100"><i class="fa-solid fa-layer-group"></i> טאב מבצעים</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                    <button onclick="toggleStorePromotion(${p.id}, ${!p.is_active})" class="text-[10px] font-bold px-3 py-1 rounded-lg border transition ${activeColor}">${p.is_active ? 'פעיל' : 'מושהה'}</button>
                    <div class="text-[9px] text-slate-400">נוצר: ${createdStr}</div>
                </div>
            </div>
            <div class="flex gap-2 border-t border-slate-50 pt-3">
                <button onclick="openPromotionModal(${p.id})" class="flex-1 text-slate-500 bg-slate-50 hover:bg-slate-100 py-1.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-1.5"><i class="fa-solid fa-pen"></i> עריכה</button>
                <button onclick="deleteStorePromotion(${p.id})" class="w-10 text-slate-400 bg-slate-50 hover:text-red-500 hover:bg-red-50 py-1.5 rounded-lg text-xs transition flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function openPromotionModal(id = null) {
    const modal = getEl('promotion-modal');
    if (!modal) return;
    
    if (!getEl('promo-id')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = 'promo-id';
        modal.querySelector('.space-y-4').prepend(input);
    }

    if (id) {
        const p = storePromotionsCache.find(x => x.id === id);
        if (p) {
            getEl('promo-id').value = p.id;
            getEl('promo-title').value = p.title;
            getEl('promo-type').value = p.promo_type;
            getEl('promo-value').value = p.promo_value || '';
            getEl('promo-target-type').value = p.target_type;
            
            let targetArray = [];
            if(Array.isArray(p.target_ids)) targetArray = p.target_ids;
            else if(typeof p.target_ids === 'string') { try { targetArray = JSON.parse(p.target_ids); } catch(e){} }
            getEl('promo-target-category').value = targetArray.length > 0 ? targetArray[0] : '';
            
            getEl('promo-start-date').value = p.start_date ? new Date(new Date(p.start_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
            getEl('promo-end-date').value = p.end_date ? new Date(new Date(p.end_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
            
            if(getEl('promo-show-banner')) getEl('promo-show-banner').checked = p.show_in_banner === true || String(p.show_in_banner) === 'true';
            if(getEl('promo-show-tab')) getEl('promo-show-tab').checked = p.show_in_tab === true || String(p.show_in_tab) === 'true';
            if(getEl('promo-bg-color')) getEl('promo-bg-color').value = p.bg_color || 'pink';
        }
    } else {
        getEl('promo-id').value = '';
        getEl('promo-title').value = '';
        getEl('promo-type').value = 'discount_pct';
        getEl('promo-value').value = '';
        getEl('promo-target-type').value = 'all';
        getEl('promo-target-category').value = '';
        getEl('promo-start-date').value = '';
        getEl('promo-end-date').value = '';
        if(getEl('promo-show-banner')) getEl('promo-show-banner').checked = true;
        if(getEl('promo-show-tab')) getEl('promo-show-tab').checked = true;
        if(getEl('promo-bg-color')) getEl('promo-bg-color').value = 'pink';
    }
    
    togglePromoValueInput();
    togglePromoTargetInput();
    modal.classList.remove('hidden');
}

function togglePromoValueInput() {
    const type = val('promo-type');
    const label = getEl('promo-value-label');
    const input = getEl('promo-value');
    if(!label || !input) return;

    if (type === 'bogo') {
        label.innerText = 'שווי ההטבה (המקסימלי לפריט):';
        input.placeholder = 'למשל: עד 50 ש"ח למנה מתנה';
    } else if (type === 'discount_pct') {
        label.innerText = 'ערך המבצע באחוזים:';
        input.placeholder = 'למשל: 20 (%)';
    } else {
        label.innerText = 'המחיר הקבוע למבצע (פיקס):';
        input.placeholder = 'למשל: 99 (₪)';
    }
}

function togglePromoTargetInput() {
    const type = val('promo-target-type');
    const container = getEl('promo-target-category-container');
    if (type === 'category') container.classList.remove('hidden');
    else container.classList.add('hidden');
}

async function submitPromotion() {
    const id = val('promo-id');
    const title = val('promo-title');
    const promoType = val('promo-type');
    const promoValue = val('promo-value');
    const targetType = val('promo-target-type');
    const targetCategory = val('promo-target-category');
    
    if (!title) return showToast('error', 'נא להזין שם למבצע');
    if (!promoValue) return showToast('error', 'נא להזין את ערך המבצע');
    if (targetType === 'category' && !targetCategory) return showToast('error', 'נא להזין את שם הקטגוריה');

    const btn = getEl('btn-submit-promo'); btn.disabled = true; btn.innerText = 'שומר...';
    try {
        const showBanner = getEl('promo-show-banner') ? getEl('promo-show-banner').checked : true;
        const showTab = getEl('promo-show-tab') ? getEl('promo-show-tab').checked : true;
        const bgColor = getEl('promo-bg-color') ? val('promo-bg-color') : 'pink';

        const payload = { 
            groupId: currentGroup.id, title, promoType, promoValue, targetType, 
            targetIds: targetType === 'category' ? [targetCategory] : [],
            startDate: val('promo-start-date') || null, endDate: val('promo-end-date') || null,
            showInBanner: showBanner, showInTab: showTab, bgColor: bgColor
        };
        
        const url = id ? `${API}/store/promotions/${id}` : `${API}/store/promotions`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method, headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', id ? 'המבצע עודכן בהצלחה!' : 'המבצע נוצר ופעיל!');
            getEl('promotion-modal').classList.add('hidden');
            fetchStorePromotions();
        } else { showToast('error', data.error || 'שגיאה בשמירת המבצע'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { btn.disabled = false; btn.innerText = 'שמור והפעל'; }
}

async function deleteStorePromotion(id) {
    if(!confirm('האם למחוק מבצע זה?')) return;
    try { await fetch(`${API}/store/promotions/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchStorePromotions(); } catch(e) {}
}

async function toggleStorePromotion(id, isActive) {
    try { await fetch(`${API}/store/promotions/toggle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({isActive}) }); fetchStorePromotions(); } catch(e) {}
}

async function fetchStoreSettings() {
    fetchStoreCoupons();
    fetchStorePromotions();
}

async function fetchStorePromotions() {
    try {
        const res = await fetch(`${API}/store/promotions/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            storePromotionsCache = data.promotions || [];
            renderStorePromotions();
        }
    } catch(e) { console.error(e); }
}

function renderStorePromotions() {
    const list = getEl('store-promotions-list');
    if(!list) return;
    
    if (storePromotionsCache.length === 0) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">לא מוגדרים מבצעים פעילים.</p>';
        return;
    }
    
    let html = '';
    storePromotionsCache.forEach(p => {
        let desc = '';
        if (p.promo_type === 'discount_pct') desc = `${p.promo_value}% הנחה`;
        else if (p.promo_type === 'bogo') desc = `1+1 מתנה (עד ₪${p.promo_value})`;
        else if (p.promo_type === 'fixed_price') desc = `ב-₪${p.promo_value} בלבד`;

        let targetArray = [];
        if(Array.isArray(p.target_ids)) targetArray = p.target_ids;
        else if(typeof p.target_ids === 'string') { try { targetArray = JSON.parse(p.target_ids); } catch(e){} }
        
        let targetDesc = p.target_type === 'all' ? 'חל על כל החנות' : `קטגוריה: ${targetArray.length > 0 ? targetArray[0] : ''}`;
        const activeColor = p.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-500 bg-slate-100 border-slate-200';
        
        // יצירת מחרוזות תאריך יפות
        const createdStr = p.created_at ? new Date(p.created_at).toLocaleDateString('he-IL') : '';
        const startStr = p.start_date ? new Date(p.start_date).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) : 'מיידי';
        const endStr = p.end_date ? new Date(p.end_date).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) : 'ללא הגבלת זמן';

        html += `
        <div class="flex flex-col bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3 relative hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="bg-pink-50 text-pink-500 w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"><i class="fa-solid fa-gift"></i></div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(p.title)} <span class="text-[10px] text-pink-600 bg-pink-100 px-1.5 rounded-md mr-1">${desc}</span></h4>
                        <p class="text-[10px] text-slate-500 mt-0.5 font-medium">${targetDesc}</p>
                        <p class="text-[9px] text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> תוקף: ${startStr} - ${endStr}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                    <button onclick="toggleStorePromotion(${p.id}, ${!p.is_active})" class="text-[10px] font-bold px-3 py-1 rounded-lg border transition ${activeColor}">${p.is_active ? 'פעיל' : 'מושהה'}</button>
                    <div class="text-[9px] text-slate-400">נוצר: ${createdStr}</div>
                </div>
            </div>
            <div class="flex gap-2 border-t border-slate-50 pt-3">
                <button onclick="openPromotionModal(${p.id})" class="flex-1 text-slate-500 bg-slate-50 hover:bg-slate-100 py-1.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-1.5"><i class="fa-solid fa-pen"></i> עריכה</button>
                <button onclick="deleteStorePromotion(${p.id})" class="w-10 text-slate-400 bg-slate-50 hover:text-red-500 hover:bg-red-50 py-1.5 rounded-lg text-xs transition flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function openPromotionModal(id = null) {
    const modal = getEl('promotion-modal');
    if (!modal) return;
    
    if (!getEl('promo-id')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = 'promo-id';
        modal.querySelector('.space-y-4').prepend(input);
    }

    if (id) {
        const p = storePromotionsCache.find(x => x.id === id);
        if (p) {
            getEl('promo-id').value = p.id;
            getEl('promo-title').value = p.title;
            getEl('promo-type').value = p.promo_type;
            getEl('promo-value').value = p.promo_value || '';
            getEl('promo-target-type').value = p.target_type;
            
            let targetArray = [];
            if(Array.isArray(p.target_ids)) targetArray = p.target_ids;
            else if(typeof p.target_ids === 'string') { try { targetArray = JSON.parse(p.target_ids); } catch(e){} }
            getEl('promo-target-category').value = targetArray.length > 0 ? targetArray[0] : '';
            
            getEl('promo-start-date').value = p.start_date ? new Date(new Date(p.start_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
            getEl('promo-end-date').value = p.end_date ? new Date(new Date(p.end_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
            
            getEl('promo-show-banner').checked = p.show_in_banner !== false;
            getEl('promo-show-tab').checked = p.show_in_tab !== false;
            getEl('promo-bg-color').value = p.bg_color || 'pink';
        }
    } else {
        getEl('promo-id').value = '';
        getEl('promo-title').value = '';
        getEl('promo-type').value = 'discount_pct';
        getEl('promo-value').value = '';
        getEl('promo-target-type').value = 'all';
        getEl('promo-target-category').value = '';
        getEl('promo-start-date').value = '';
        getEl('promo-end-date').value = '';
        getEl('promo-show-banner').checked = true;
        getEl('promo-show-tab').checked = true;
        getEl('promo-bg-color').value = 'pink';
    }
    
    togglePromoValueInput();
    togglePromoTargetInput();
    modal.classList.remove('hidden');
}

function togglePromoValueInput() {
    const type = val('promo-type');
    const label = getEl('promo-value-label');
    const input = getEl('promo-value');
    if(!label || !input) return;

    if (type === 'bogo') {
        label.innerText = 'שווי ההטבה (המקסימלי לפריט):';
        input.placeholder = 'למשל: עד 50 ש"ח למנה מתנה';
    } else if (type === 'discount_pct') {
        label.innerText = 'ערך המבצע באחוזים:';
        input.placeholder = 'למשל: 20 (%)';
    } else {
        label.innerText = 'המחיר הקבוע למבצע (פיקס):';
        input.placeholder = 'למשל: 99 (₪)';
    }
}

function togglePromoTargetInput() {
    const type = val('promo-target-type');
    const container = getEl('promo-target-category-container');
    if (type === 'category') container.classList.remove('hidden');
    else container.classList.add('hidden');
}

async function submitPromotion() {
    const id = val('promo-id');
    const title = val('promo-title');
    const promoType = val('promo-type');
    const promoValue = val('promo-value');
    const targetType = val('promo-target-type');
    const targetCategory = val('promo-target-category');
    
    if (!title) return showToast('error', 'נא להזין שם למבצע');
    if (!promoValue) return showToast('error', 'נא להזין את ערך המבצע');
    if (targetType === 'category' && !targetCategory) return showToast('error', 'נא להזין את שם הקטגוריה');

    const btn = getEl('btn-submit-promo'); btn.disabled = true; btn.innerText = 'שומר...';
    try {
        const payload = { 
            groupId: currentGroup.id, title, promoType, promoValue, targetType, 
            targetIds: targetType === 'category' ? [targetCategory] : [],
            startDate: val('promo-start-date') || null, endDate: val('promo-end-date') || null,
            showInBanner: getEl('promo-show-banner').checked, showInTab: getEl('promo-show-tab').checked, bgColor: val('promo-bg-color')
        };
        
        const url = id ? `${API}/store/promotions/${id}` : `${API}/store/promotions`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method, headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', id ? 'המבצע עודכן בהצלחה!' : 'המבצע נוצר ופעיל!');
            getEl('promotion-modal').classList.add('hidden');
            fetchStorePromotions();
        } else { showToast('error', data.error || 'שגיאה בשמירת המבצע'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { btn.disabled = false; btn.innerText = 'שמור והפעל'; }
}

async function deleteStorePromotion(id) {
    if(!confirm('האם למחוק מבצע זה?')) return;
    try { await fetch(`${API}/store/promotions/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchStorePromotions(); } catch(e) {}
}

async function toggleStorePromotion(id, isActive) {
    try { await fetch(`${API}/store/promotions/toggle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({isActive}) }); fetchStorePromotions(); } catch(e) {}
}
async function fetchStoreSettings() {
    try {
        const res = await fetch(`${API}/store/settings/${currentGroup.id}`);
        const data = await res.json();
        if (data.success && data.settings) {
            getEl('store-is-active').checked = data.settings.is_active;
            getEl('store-welcome-msg').value = data.settings.welcome_message || '';
            getEl('store-phone').value = data.settings.phone || '';
            getEl('store-min-order').value = data.settings.min_order || '';
            getEl('store-slogan').value = data.settings.slogan || '';
            getEl('store-type').value = data.settings.store_type || 'retail';
            getEl('store-open-time').value = data.settings.open_time || '';
            getEl('store-close-time').value = data.settings.close_time || '';
            getEl('store-whatsapp').value = data.settings.whatsapp_number || '';
            getEl('store-public-link').value = `${window.location.origin}/storefront.html?store=${currentGroup.group_code}`;
            
            if (data.settings.logo_url) {
                getEl('store-logo-preview').src = data.settings.logo_url;
                getEl('store-logo-preview').classList.remove('hidden');
                getEl('store-logo-placeholder').classList.add('hidden');
                getEl('store-logo-base64').value = data.settings.logo_url;
            }

            if (data.settings.modifier_presets) {
                try { storeModifierPresets = JSON.parse(data.settings.modifier_presets); } catch(e) { storeModifierPresets = []; }
                renderPresetSelector();
            }
        }
    } catch(e) { console.error(e); }
}

async function saveStoreSettings() {
    const btn = getEl('btn-save-store-settings');
    btn.disabled = true; btn.innerText = 'שומר...';
    try {
        await fetch(`${API}/store/settings`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                groupId: currentGroup.id, isActive: getEl('store-is-active').checked, welcomeMessage: val('store-welcome-msg'), 
                phone: val('store-phone'), minOrder: val('store-min-order'), slogan: val('store-slogan'), storeType: val('store-type'), 
                logoUrl: val('store-logo-base64') || null,
                openTime: val('store-open-time'), closeTime: val('store-close-time'), whatsappNumber: val('store-whatsapp')
            })
        });
        showToast('success', 'הגדרות החנות נשמרו בהצלחה!');
    } catch(e) { showToast('error', 'תקלת רשת בשמירת הגדרות'); }
    finally { btn.disabled = false; btn.innerText = 'שמור הגדרות חנות'; }
}

function copyStoreLink() {
    const link = val('store-public-link');
    if(!link) return;
    navigator.clipboard.writeText(link).then(() => showToast('info', 'לינק החנות הועתק!'));
}

async function fetchStoreCatalog() {
    try { const res = await fetch(`${API}/store/catalog/${currentGroup.id}`); storeCatalogCache = await res.json(); renderStoreCatalog(); } catch(e) {}
}

function renderStoreCatalog() {
    const list = getEl('store-catalog-list');
    if(!storeCatalogCache || storeCatalogCache.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין מוצרים בקטלוג. לחצו על "מוצר חדש" כדי להתחיל.</p>'; return;
    }
    let html = '';
    storeCatalogCache.forEach(p => {
        let badgeHtml = '';
        if (p.badge_text) {
            const colors = { 'red':'bg-red-500', 'green':'bg-green-500', 'blue':'bg-blue-500', 'yellow':'bg-yellow-500 text-yellow-900' };
            const bgClass = colors[p.badge_color] || 'bg-red-500';
            badgeHtml = `<div class="absolute -top-2 -right-2 ${bgClass} text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10 border border-white">${safeStr(p.badge_text)}</div>`;
        }
        
        const imgHtml = p.image_url ? `<div class="relative shrink-0">${badgeHtml}<img src="${p.image_url}" class="w-14 h-14 rounded-xl object-cover border border-slate-100 shadow-sm"></div>` : `<div class="relative shrink-0">${badgeHtml}<div class="w-14 h-14 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center border border-slate-200 shadow-sm"><i class="fa-solid fa-box text-xl"></i></div></div>`;
        const activeColor = p.is_available ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-500 bg-slate-100 border-slate-200';
        
        html += `<div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2"><div class="flex items-center gap-3 min-w-0 flex-1">${imgHtml}<div class="min-w-0 flex-1"><h4 class="font-bold text-slate-800 text-sm truncate pr-1">${safeStr(p.name)}</h4><p class="text-xs font-bold text-indigo-600 mt-0.5">₪${p.price} <span class="font-normal text-slate-400 text-[10px] ml-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">(${safeStr(p.category || 'כללי')})</span></p></div></div><div class="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-100"><button onclick="toggleStoreProduct(${p.id}, ${!p.is_available})" class="text-[10px] font-bold px-3 py-1.5 rounded-lg border transition ${activeColor}">${p.is_available ? 'זמין' : 'מוסתר'}</button><button onclick="openStoreProductModal(${p.id})" class="text-slate-500 hover:text-indigo-600 bg-white shadow-sm w-8 h-8 rounded-lg flex items-center justify-center transition border border-slate-100"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deleteStoreProduct(${p.id})" class="text-slate-400 hover:text-red-500 bg-white shadow-sm w-8 h-8 rounded-lg flex items-center justify-center transition border border-slate-100"><i class="fa-solid fa-trash text-xs"></i></button></div></div>`;
    }); list.innerHTML = html;
}
function renderPresetSelector() {
    const sel = getEl('preset-selector'); if (!sel) return;
    if (storeModifierPresets.length > 0) {
        sel.innerHTML = '<option value="">טען תבנית שמורה...</option>';
        storeModifierPresets.forEach((p, idx) => { sel.innerHTML += `<option value="${idx}">${safeStr(p.name)}</option>`; });
        sel.classList.remove('hidden');
    } else { sel.classList.add('hidden'); }
}

function loadPreset(idx) {
    if (idx === '') return; const preset = storeModifierPresets[idx];
    if (preset) { currentModifiersUI.push(JSON.parse(JSON.stringify(preset))); renderModifiersUI(); } 
    getEl('preset-selector').value = '';
}

async function saveModifierAsPreset(index) {
    const mod = currentModifiersUI[index];
    if (!mod.name || mod.options.length === 0) return showToast('error', 'יש למלא שם לפחות אפשרות אחת לשמירה');
    storeModifierPresets.push(JSON.parse(JSON.stringify(mod)));
    
    const btn = getEl(`btn-save-preset-${index}`); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await fetch(`${API}/store/settings/presets`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, presets: JSON.stringify(storeModifierPresets) }) });
        renderPresetSelector(); showToast('success', 'התבנית נשמרה לשימוש עתידי!');
    } catch(e) { showToast('error', 'שגיאה בשמירה'); } finally { btn.innerHTML = '<i class="fa-solid fa-save text-xs"></i>'; }
}

function renderModifiersUI() {
    const container = getEl('modifiers-builder-container');
    if (!container) return;
    if (currentModifiersUI.length === 0) {
        container.innerHTML = '<p class="text-[11px] text-slate-500 text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 font-medium">לא הוגדרו תוספות / מנות למארז זה.<br>לחצו על "הוסף קבוצה" או בחרו מתבנית שמורה.</p>';
        return;
    }
    
    let html = '';
    currentModifiersUI.forEach((mod, groupIndex) => {
        const typeSingle = mod.type === 'single' ? 'selected' : ''; const typeMulti = mod.type === 'multiple' ? 'selected' : '';
        
        let optionsHtml = '';
        mod.options.forEach((opt, optIndex) => {
            optionsHtml += `
            <div class="flex gap-2 items-center mb-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <input type="text" class="flex-1 bg-white border border-slate-200 rounded text-xs px-2 py-1.5 outline-none focus:border-indigo-400 text-slate-700" value="${safeStr(opt.name)}" onchange="updateModOptionName(${groupIndex}, ${optIndex}, this.value)" placeholder="שם (למשל: צ'יפס / XL)">
                <div class="w-20 relative">
                    <input type="number" class="w-full bg-white border border-slate-200 rounded text-xs pl-2 pr-5 py-1.5 outline-none focus:border-indigo-400 text-slate-700 text-left dir-ltr" value="${opt.price}" onchange="updateModOptionPrice(${groupIndex}, ${optIndex}, this.value)" placeholder="0">
                    <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₪+</span>
                </div>
                <button onclick="removeModifierOption(${groupIndex}, ${optIndex})" class="text-slate-300 hover:text-red-500 w-6 h-6 flex items-center justify-center transition"><i class="fa-solid fa-times text-xs"></i></button>
            </div>`;
        });

        html += `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative flex flex-col gap-3 fade-in">
            <div class="absolute top-2 left-2 flex gap-2">
                <button id="btn-save-preset-${groupIndex}" onclick="saveModifierAsPreset(${groupIndex})" class="text-blue-500 hover:text-blue-700 w-7 h-7 flex items-center justify-center transition bg-blue-50 rounded-lg border border-blue-100" title="שמור כתבנית לשימוש עתידי"><i class="fa-solid fa-save text-xs"></i></button>
                <button onclick="removeModifierGroup(${groupIndex})" class="text-slate-400 hover:text-red-500 w-7 h-7 flex items-center justify-center transition bg-slate-50 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-100"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>
            
            <div class="flex gap-3 w-[80%] pr-1 mb-2 border-b border-slate-100 pb-3">
                <div class="flex-1">
                    <label class="text-[10px] font-bold text-slate-500 block mb-1">שם הקבוצה:</label>
                    <input type="text" class="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold px-3 py-2 outline-none focus:border-indigo-400 text-slate-800 transition" value="${safeStr(mod.name)}" onchange="updateModName(${groupIndex}, this.value)" placeholder="למשל: בחירת שתייה">
                </div>
                <div class="w-[45%]">
                    <label class="text-[10px] font-bold text-slate-500 block mb-1">סוג בחירה:</label>
                    <select onchange="updateModType(${groupIndex}, this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs px-2 py-2.5 outline-none focus:border-indigo-400 text-slate-700">
                        <option value="single" ${typeSingle}>בחירה 1 (חובה)</option>
                        <option value="multiple" ${typeMulti}>בחירה מרובה</option>
                    </select>
                </div>
            </div>
            
            <div class="space-y-1">
                ${optionsHtml}
                <button onclick="addModifierOption(${groupIndex})" class="mt-1 w-full bg-slate-50 border border-dashed border-slate-300 text-slate-500 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition"><i class="fa-solid fa-plus"></i> הוסף אפשרות לשורה זו</button>
            </div>
        </div>`;
    }); container.innerHTML = html;
}

function addModifierGroup() { currentModifiersUI.push({ name: '', type: 'single', options: [{name: '', price: 0}] }); renderModifiersUI(); }
function removeModifierGroup(index) { currentModifiersUI.splice(index, 1); renderModifiersUI(); }
function updateModName(index, v) { currentModifiersUI[index].name = v; }
function updateModType(index, v) { currentModifiersUI[index].type = v; }
function addModifierOption(gIndex) { currentModifiersUI[gIndex].options.push({name: '', price: 0}); renderModifiersUI(); }
function removeModifierOption(gIndex, optIndex) { currentModifiersUI[gIndex].options.splice(optIndex, 1); renderModifiersUI(); }
function updateModOptionName(gIndex, optIndex, v) { currentModifiersUI[gIndex].options[optIndex].name = v; }
function updateModOptionPrice(gIndex, optIndex, v) { currentModifiersUI[gIndex].options[optIndex].price = parseFloat(v) || 0; }

function openStoreProductModal(id = null) {
    currentModifiersUI = []; 
    if (id) {
        const p = storeCatalogCache.find(item => item.id === id); if(!p) return;
        getEl('sp-id').value = p.id; 
        getEl('sp-name').value = p.name; 
        getEl('sp-price').value = p.price; 
        getEl('sp-category').value = p.category || ''; 
        getEl('sp-desc').value = p.description || ''; 
        
        // טעינת שדות חדשים: סוג מוצר ותיאור מורחב
        if(getEl('sp-product-type')) getEl('sp-product-type').value = p.product_type || 'retail';
        if(getEl('sp-long-desc')) getEl('sp-long-desc').value = p.long_description || '';
        
        getEl('sp-image-base64').value = p.image_url || '';
        
        if(getEl('sp-badge-text')) getEl('sp-badge-text').value = p.badge_text || ''; 
        if(getEl('sp-badge-color')) getEl('sp-badge-color').value = p.badge_color || 'red';
        
        if (p.image_url) { getEl('sp-image-preview').src = p.image_url; getEl('sp-image-preview').classList.remove('hidden'); getEl('sp-image-placeholder').classList.add('hidden'); } else { getEl('sp-image-preview').classList.add('hidden'); getEl('sp-image-placeholder').classList.remove('hidden'); }
        
        if (p.options_text) {
            try { currentModifiersUI = JSON.parse(p.options_text); } catch(e) { currentModifiersUI = []; }
        }
    } else {
        getEl('sp-id').value = ''; 
        getEl('sp-name').value = ''; 
        getEl('sp-price').value = ''; 
        getEl('sp-category').value = ''; 
        getEl('sp-desc').value = ''; 
        
        // איפוס השדות החדשים
        if(getEl('sp-product-type')) getEl('sp-product-type').value = 'retail';
        if(getEl('sp-long-desc')) getEl('sp-long-desc').value = '';

        getEl('sp-image-base64').value = ''; getEl('sp-image-preview').src = ''; getEl('sp-image-preview').classList.add('hidden'); getEl('sp-image-placeholder').classList.remove('hidden');
        
        if(getEl('sp-badge-text')) getEl('sp-badge-text').value = ''; 
        if(getEl('sp-badge-color')) getEl('sp-badge-color').value = 'red';
    }
    renderModifiersUI(); getEl('store-product-modal').classList.remove('hidden');
}

async function submitStoreProduct() {
    const id = val('sp-id'); const name = val('sp-name'); const price = val('sp-price');
    if(!name || !price) return showToast('error', 'שם ומחיר הם שדות חובה');
    
    let validOptions = [];
    currentModifiersUI.forEach(mod => { 
        if (mod.name.trim()) {
            const cleanOpts = mod.options.filter(o => o.name.trim() !== '');
            if (cleanOpts.length > 0) validOptions.push({ name: mod.name.trim(), type: mod.type, options: cleanOpts });
        }
    });
    const finalOptionsText = validOptions.length > 0 ? JSON.stringify(validOptions) : '';
    
    const btn = getEl('btn-submit-sp'); btn.disabled = true; btn.innerText = 'שומר...';
    try {
        const payload = { 
            groupId: currentGroup.id, 
            name, 
            price, 
            category: val('sp-category'), 
            description: val('sp-desc'), 
            optionsText: finalOptionsText, 
            imageUrl: val('sp-image-base64') || null,
            badgeText: val('sp-badge-text') || '', 
            badgeColor: val('sp-badge-color') || 'red',
            productType: val('sp-product-type') || 'retail', 
            longDescription: val('sp-long-desc') || ''
        };
        const res = await fetch(id ? `${API}/store/catalog/${id}` : `${API}/store/catalog`, { method: id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'המוצר התעדכן!' : 'המוצר נוסף לקטלוג!'); getEl('store-product-modal').classList.add('hidden'); fetchStoreCatalog(); } else { showToast('error', data.error || 'שגיאה בשמירה'); }
    } catch(e) { showToast('error', 'שגיאה בתקשורת מול השרת'); } finally { btn.disabled = false; btn.innerText = 'שמור מוצר'; }
}
async function toggleStoreProduct(id, isAvailable) { await fetch(`${API}/store/catalog/toggle`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ itemId: id, isAvailable }) }); fetchStoreCatalog(); }
async function deleteStoreProduct(id) { if(!confirm('למחוק מוצר זה לחלוטין?')) return; await fetch(`${API}/store/catalog/${id}`, { method: 'DELETE' }); showToast('info', 'המוצר נמחק מהחנות'); fetchStoreCatalog(); }

async function fetchStoreOrders() { try { const res = await fetch(`${API}/store/orders/${currentGroup.id}`); const data = await res.json(); storeOrdersCache = Array.isArray(data) ? data : []; renderStoreOrders(); } catch(e) {} }

function renderStoreOrders() {
    const list = getEl('store-orders-list'); const filter = val('store-orders-filter') || 'all'; let filteredOrders = storeOrdersCache;
    if (filter !== 'all') filteredOrders = filteredOrders.filter(o => o.status === filter);
    if(!filteredOrders || filteredOrders.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין הזמנות התואמות לחיפוש.</p>'; return; }
    let html = '';
    const statusMap = { 
        'new': { text: 'חדשה 🚨', color: 'bg-red-100 text-red-700 border-red-200' }, 
        'processing': { text: 'בהכנה 📦', color: 'bg-blue-100 text-blue-700 border-blue-200' }, 
        'ready': { text: 'מוכן 🛍️', color: 'bg-orange-100 text-orange-700 border-orange-200' }, 
        'shipped': { text: 'במשלוח 🚚', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        'completed': { text: 'סופק ✅', color: 'bg-green-100 text-green-700 border-green-200 opacity-60' } 
    };
    filteredOrders.forEach(o => {
        const st = statusMap[o.status] || statusMap['new'];
        html += `<div onclick="openStoreOrderModal(${o.id})" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between mb-3 cursor-pointer hover:bg-slate-50 transition"><div class="flex-1 pr-2"><h4 class="font-bold text-slate-800 text-sm">הזמנה #${o.id} <span class="font-black text-indigo-600 ml-2">₪${o.total_amount}</span></h4><p class="text-xs text-slate-500 mt-1"><i class="fa-regular fa-user mr-1"></i> ${safeStr(o.customer_name)} | ${new Date(o.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</p></div><span class="text-[10px] font-bold ${st.color} px-2.5 py-1.5 rounded-lg border whitespace-nowrap shadow-sm">${st.text}</span></div>`;
    }); list.innerHTML = html;
}

// --- מערכת קופונים ---
let storeCouponsCache = [];

async function fetchStoreCoupons() {
    try {
        const res = await fetch(`${API}/store/coupons/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            storeCouponsCache = data.coupons || [];
            renderStoreCoupons();
        }
    } catch(e) { console.error(e); }
}

function renderStoreCoupons() {
    const list = getEl('store-coupons-list');
    if (storeCouponsCache.length === 0) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">לא הוגדרו קופונים בחנות.</p>';
        return;
    }
    
    let html = '';
    storeCouponsCache.forEach(c => {
        const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
        const dateStr = c.valid_until ? new Date(c.valid_until).toLocaleDateString('he-IL') : 'ללא תפוגה';
        const expiredTag = isExpired ? '<span class="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-2">פג תוקף</span>' : '';
        
        html += `
        <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm ${isExpired ? 'opacity-60' : ''}">
            <div class="flex items-center gap-3">
                <div class="bg-indigo-50 text-indigo-700 font-mono font-bold px-3 py-1.5 rounded-lg text-sm border border-indigo-100">${safeStr(c.code)}</div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-800">${c.discount_pct}% הנחה ${expiredTag}</span>
                    <span class="text-[10px] text-slate-500">תוקף: ${dateStr}</span>
                </div>
            </div>
            <button onclick="deleteStoreCoupon(${c.id})" class="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>`;
    });
    list.innerHTML = html;
}

async function createStoreCoupon() {
    const code = val('coupon-code');
    const discountPct = val('coupon-discount');
    const validUntil = val('coupon-date');
    
    if (!code || !discountPct) return showToast('error', 'חובה להזין קוד ואחוז הנחה');
    
    try {
        const res = await fetch(`${API}/store/coupons`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, code, discountPct, validUntil })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'קופון נוצר בהצלחה!');
            getEl('coupon-code').value = ''; getEl('coupon-discount').value = ''; getEl('coupon-date').value = '';
            fetchStoreCoupons();
        } else { showToast('error', data.error || 'שגיאה ביצירת קופון'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteStoreCoupon(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק את הקופון?')) return;
    try {
        await fetch(`${API}/store/coupons/${id}`, { method: 'DELETE' });
        showToast('success', 'קופון נמחק');
        fetchStoreCoupons();
    } catch(e) { showToast('error', 'שגיאה במחיקה'); }
}

function openStoreOrderModal(orderId) {
    currentStoreOrderId = orderId; const order = storeOrdersCache.find(o => o.id === orderId); if(!order) return;
    getEl('so-modal-id').innerText = order.id; getEl('so-modal-date').innerText = new Date(order.created_at).toLocaleString('he-IL'); getEl('so-modal-total').innerText = order.total_amount; getEl('so-modal-customer').innerText = order.customer_name; getEl('so-modal-phone').innerText = order.customer_phone || 'לא הוזן טלפון';
    let itemsHtml = '';
    if(order.items) order.items.forEach(i => { itemsHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 mb-2 shadow-sm"><span class="font-bold text-slate-700 text-sm">${safeStr(i.item_name)} <span class="text-xs font-black text-indigo-500 ml-1 bg-indigo-50 px-2 py-0.5 rounded-full">x${i.quantity}</span></span><span class="font-bold text-slate-600 text-sm">₪${i.price_at_order}</span></div>`; });
    getEl('so-modal-items').innerHTML = itemsHtml; getEl('store-order-modal').classList.remove('hidden');
}

async function updateStoreOrderStatus(status) {
    if(!currentStoreOrderId) return;
    try { await fetch(`${API}/store/orders/status`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ orderId: currentStoreOrderId, status }) }); showToast('success', 'סטטוס ההזמנה עודכן!'); getEl('store-order-modal').classList.add('hidden'); fetchStoreOrders(); } catch(e) { showToast('error', 'שגיאה בעדכון הסטטוס'); }
}

async function generateStoreProductAI() {
    const name = val('sp-name'); if(!name) return showToast('error', 'נא להזין קודם את שם המוצר בשדה למעלה');
    executeWithAIWarning(async () => {
        const btn = getEl('btn-sp-ai'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מנסח...';
        try {
            const res = await fetch(`${API}/store/ai-desc`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ productName: name, groupId: currentGroup.id }) }); const data = await res.json();
            if(data.success && data.description) { getEl('sp-desc').value = data.description; showToast('success', 'ה-AI ניסח תיאור בהצלחה!'); } else { showToast('error', data.error || 'שגיאה בניסוח'); }
        } catch(e) { showToast('error', 'שגיאת תקשורת מול שרת ה-AI'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> נסח לי ע"י AI'; }
    });
}

function handleStoreLogoUpload(event) {
    const file = event.target.files[0]; if(!file) return; showToast('info', 'מכווץ תמונה...');
    compressImage(file, 300, 300, 0.8, (compressedDataUrl) => { getEl('store-logo-preview').src = compressedDataUrl; getEl('store-logo-preview').classList.remove('hidden'); getEl('store-logo-placeholder').classList.add('hidden'); getEl('store-logo-base64').value = compressedDataUrl; showToast('success', 'הלוגו הועלה ומוכן לשמירה!'); });
}

function handleProductImageBase64(event) {
    const file = event.target.files[0]; if(!file) return; showToast('info', 'מכווץ תמונת מוצר...');
    compressImage(file, 600, 600, 0.8, (compressedDataUrl) => { getEl('sp-image-preview').src = compressedDataUrl; getEl('sp-image-preview').classList.remove('hidden'); getEl('sp-image-placeholder').classList.add('hidden'); getEl('sp-image-base64').value = compressedDataUrl; showToast('success', 'התמונה הועלתה ומוכנה לשמירה!'); });
}

function openGlobalAIAssistant() { getEl('global-ai-input').value = ''; getEl('global-ai-modal').classList.remove('hidden'); }
async function submitGlobalAI() {
    const inputEl = getEl('global-ai-input'); const query = inputEl.value.trim(); if (!query) return;
    const chatBox = getEl('global-ai-chat'); chatBox.innerHTML += `<div class="bg-indigo-600 text-white p-3 rounded-xl rounded-tl-none shadow-sm text-sm self-end max-w-[85%] fade-in">${safeStr(query)}</div>`; inputEl.value = '';
    const btn = getEl('btn-global-ai-submit'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    const systemContext = { active_orders: storeOrdersCache.filter(o => o.status !== 'completed'), employees: membersCache.map(m => ({name: m.nickname, role: m.role, budget: m.balance})), pantry_inventory: pantryCache.map(p => ({item: p.item_name, qty: p.quantity})), recent_expenses: allTransactions.filter(t => t.type === 'expense').slice(0, 10).map(t => ({desc: t.description, amount: t.amount})) };
    try {
        const res = await fetch(`${API}/biz/chat-assistant`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ query: query, context: JSON.stringify(systemContext), groupId: currentGroup.id }) }); const data = await res.json();
        if (!handleAIResponseCheck(data)) { getEl('global-ai-modal').classList.add('hidden'); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>'; return; }
        if (data.success && data.answer) { chatBox.innerHTML += `<div class="bg-white p-3 rounded-xl rounded-tr-none shadow-sm border border-slate-100 text-sm text-slate-700 self-start max-w-[85%] fade-in">${data.answer.replace(/\n/g, '<br>')}</div>`; chatBox.scrollTop = chatBox.scrollHeight; } else { showToast('error', 'שגיאה בתשובת ה-AI'); }
    } catch(e) { showToast('error', 'תקלת רשת מול מנוע ה-AI'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>'; }
}

// ============================================================
// --- BIZ COMMUNITY & SA MANAGEMENT ---
// ============================================================

let saCommunitiesCache = [];
let saBusinessesCache = [];

async function loadSACommunityData() {
    try {
        const [commRes, bizRes] = await Promise.all([
            fetch(`${API}/sa/communities`),
            fetch(`${API}/sa/businesses`)
        ]);
        const commData = await commRes.json();
        const bizData = await bizRes.json();
        
        if(commData.success) {
            saCommunitiesCache = commData.communities;
            if (typeof filterSACommSelect === 'function') filterSACommSelect();
            if (typeof renderSACommunitiesTable === 'function') renderSACommunitiesTable();
        }
        if(bizData.success) {
            saBusinessesCache = bizData.businesses;
            if (typeof filterSABizSelect === 'function') filterSABizSelect();
        }
        
        // קריאה קריטית להבאת הבקשות הממתינות!
        if (typeof loadSAPendingRequests === 'function') {
            loadSAPendingRequests();
        }
    } catch(e) { console.error("Error loading SA Communities", e); }
}

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
function filterSACommSelect() {
    const queryInput = getEl('sa-search-comm-select');
    const query = queryInput ? queryInput.value.toLowerCase() : '';
    const select = getEl('sa-link-comm');
    if (!select) return;
    select.innerHTML = '<option value="">בחר קהילה...</option>' + 
        saCommunitiesCache
            .filter(c => c.name.toLowerCase().includes(query) || (c.code && c.code.toLowerCase().includes(query)))
            .map(c => `<option value="${c.id}">${safeStr(c.name)} (${c.code})</option>`)
            .join('');
}

function filterSABizSelect() {
    const queryInput = getEl('sa-search-biz-select');
    const query = queryInput ? queryInput.value.toLowerCase() : '';
    const select = getEl('sa-link-biz');
    if (!select) return;
    select.innerHTML = '<option value="">בחר עסק לחיבור...</option>' + 
        saBusinessesCache
            .filter(b => b.name.toLowerCase().includes(query))
            .map(b => `<option value="${b.id}">${safeStr(b.name)}</option>`)
            .join('');
}

function renderSACommunitiesTable() {
    const tbody = getEl('sa-communities-table-body');
    if (!tbody) return;
    
    const query = getEl('sa-search-comm') ? getEl('sa-search-comm').value.toLowerCase() : '';
    const countFilter = getEl('sa-filter-comm-count') ? getEl('sa-filter-comm-count').value : 'all';
    
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
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">לא נמצאו קהילות שמתאימות לסינון.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(c => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800">
                ${safeStr(c.name || 'ללא שם (תקלה קודמת)')}
                <div class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-location-dot text-red-400"></i> ${safeStr(c.city || 'לא הוגדר')}</div>
            </td>
            <td class="px-4 py-4 font-mono text-orange-600 font-bold tracking-widest">${safeStr(c.code || '---')}</td>
            <td class="px-4 py-4">
                <div class="text-xs text-slate-600 mb-1"><span class="text-slate-400 font-bold ml-1">מייל:</span> ${safeStr(c.manager_email || '---')}</div>
                <div class="text-xs text-slate-600"><span class="text-slate-400 font-bold ml-1">סיסמה:</span> ${safeStr(c.manager_password || '---')}</div>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="משפחות"><i class="fa-solid fa-house text-[10px]"></i> ${c.family_count || 0}</span>
                <span class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1" title="עסקים"><i class="fa-solid fa-briefcase text-[10px]"></i> ${c.business_count || 0}</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="openSACommunityModal(${c.id})" class="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> ניהול / מחיקה</button>
            </td>
        </tr>
    `).join('');
}

function filterSACommunities() { renderSACommunitiesTable(); }

async function createSACommunity() {
    const name = val('sa-comm-name'); const city = val('sa-comm-city'); const code = val('sa-comm-code'); const email = val('sa-comm-email'); const pass = val('sa-comm-pass');
    if(!name || !code || !city) return showToast('error', 'שם, עיר וקוד קהילה הם חובה');
    
    const btn = document.querySelector('button[onclick="createSACommunity()"]');
    if(btn) { btn.disabled = true; btn.innerText = 'מקים...'; }
    try {
        const res = await fetch(`${API}/sa/communities`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, city, code, managerEmail: email, managerPassword: pass})});
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'קהילה הוקמה!'); 
            getEl('sa-comm-name').value=''; getEl('sa-comm-city').value=''; getEl('sa-comm-code').value=''; getEl('sa-comm-email').value=''; getEl('sa-comm-pass').value=''; 
            loadSACommunityData(); 
        } else {
            showToast('error', data.error || 'שגיאה בהקמת קהילה');
        }
    } catch(e) { showToast('error', 'שגיאת רשת מול השרת'); }
    finally { if(btn) { btn.disabled = false; btn.innerText = 'הקמת קהילה'; } }
}

async function linkBizToCommunity() {
    const communityId = val('sa-link-comm'); const businessId = val('sa-link-biz'); const discountPct = val('sa-link-discount');
    if(!communityId || !businessId) return showToast('error', 'חובה לבחור קהילה ועסק');
    try {
        const res = await fetch(`${API}/sa/community-business`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({communityId, businessId, discountPct})});
        if((await res.json()).success) { showToast('success', 'העסק חובר בהצלחה!'); loadCommunityBusinesses(); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function loadCommunityBusinesses() {
    const communityId = val('sa-link-comm');
    const list = getEl('sa-comm-biz-list');
    if(!communityId) { if(list) list.innerHTML = 'יש לבחור קהילה מהרשימה'; return; }
    try {
        const res = await fetch(`${API}/sa/community-business/${communityId}`);
        const data = await res.json();
        if(data.success && list) {
            if(data.connections.length === 0) { list.innerHTML = 'אין עסקים מקושרים'; return; }
            list.innerHTML = data.connections.map(c => `<div class="flex justify-between items-center bg-white p-2 rounded border text-xs shadow-sm"><span>${safeStr(c.business_name)} (${c.discount_pct}%)</span><button onclick="removeBizFromCommunity(${c.community_id}, ${c.business_id})" class="text-red-400"><i class="fa-solid fa-times"></i></button></div>`).join('');
        }
    } catch(e) {}
}

async function removeBizFromCommunity(commId, bizId) {
    if(!confirm('להסיר את העסק?')) return;
    await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
    loadCommunityBusinesses(); loadSACommunityData();
}

async function deleteSACommunity(id) {
    if(!confirm('למחוק את הקהילה לצמיתות?')) return;
    await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
    loadSACommunityData();
}

async function deleteSACommunity(id) {
    if(!confirm('למחוק את הקהילה לצמיתות?')) return;
    await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
    loadSACommunityData();
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

async function loadBizCommunities() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/biz/communities/my/${currentGroup.id}`);
        
        let data;
        try { data = await res.json(); } catch(err) { return; }
        
        if (!res.ok) { return; }
        
        if (data.success && data.communities) {
            const list = document.getElementById('biz-my-communities-list');
            if (list) {
                if (data.communities.length === 0) {
                    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">העסק אינו מחובר לאף קהילה כרגע.</p>';
                } else {
                    list.innerHTML = data.communities.map(c => {
                        let statusHtml = c.status === 'approved' ? '<span class="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] border border-green-100">מאושר</span>' : '<span class="text-orange-500 bg-orange-50 px-2 py-0.5 rounded text-[10px] border border-orange-100">ממתין לאישור</span>';
                        const imgHtml = c.image_url ? `<img src="${c.image_url}" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0">` : `<div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0"><i class="fa-solid fa-users-rays"></i></div>`;
                        
                        return `<div class="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center mb-2"><div class="flex items-center gap-3">${imgHtml}<div><h4 class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</h4><p class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-location-dot text-red-400"></i> ${safeStr(c.city || 'כללי')} • <i class="fa-solid fa-house ml-1"></i> ${c.families_count || 0} משפחות (${c.users_count || 0} משתמשים)</p><p class="text-[10px] text-slate-500 mt-0.5">הצעת הנחה: <span class="font-bold text-slate-700">${c.discount_pct}%</span></p></div></div><div class="flex flex-col items-end gap-2">${statusHtml}<button onclick="leaveBizCommunity(${c.id})" class="text-[10px] font-bold text-red-500 hover:underline">התנתק</button></div></div>`;
                    }).join('');
                }
            }
        }

        await loadBizAvailableCommunities();
        
    } catch(e) { console.error("Error loading biz communities", e); }
}

let bizAvailableCommCache = [];

async function loadBizAvailableCommunities() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/biz/communities/available/${currentGroup.id}`);
        const data = await res.json();
        if (data.success && data.communities) {
            bizAvailableCommCache = data.communities;
            filterBizAvailableCommunities();
        }
    } catch(e) { console.error("Error loading available communities", e); }
}

function filterBizAvailableCommunities() {
    const list = document.getElementById('biz-available-communities-list');
    if (!list) return;

    const cityFilter = (val('biz-filter-city') || '').toLowerCase();
    const sizeFilter = val('biz-filter-size') || 'all';
    const multiFilter = getEl('biz-filter-multi') ? getEl('biz-filter-multi').checked : false;

    let filtered = [...bizAvailableCommCache];

    if (cityFilter) {
        filtered = filtered.filter(c => c.city && c.city.toLowerCase().includes(cityFilter));
    }
    
    if (sizeFilter !== 'all') {
        const minSize = parseInt(sizeFilter);
        filtered = filtered.filter(c => parseInt(c.families_count || 0) >= minSize);
    }

    if (multiFilter) {
        filtered = filtered.filter(c => c.city && c.city.split(',').filter(x => x.trim()).length >= 2);
    }

    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl w-full sm:col-span-2 border border-dashed border-slate-200">לא נמצאו קהילות פתוחות התואמות לחיפוש.</p>';
        return;
    }

    list.innerHTML = filtered.map(c => {
        const imgHtml = c.image_url ? `<img src="${c.image_url}" class="w-10 h-10 rounded-full object-cover shadow-sm mb-2 border border-slate-100">` : '';
        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
                <div>
                    ${imgHtml}
                    <h4 class="font-bold text-slate-800">${safeStr(c.name)}</h4>
                    <p class="text-[10px] text-slate-500 mt-1 max-w-[150px] truncate"><i class="fa-solid fa-location-dot text-red-400"></i> ${safeStr(c.city || 'כללי')}</p>
                </div>
                <div class="flex flex-col gap-1 items-end">
                    <span class="bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold text-[10px]"><i class="fa-solid fa-house"></i> ${c.families_count || 0} משפחות</span>
                    <span class="bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold text-[10px]"><i class="fa-solid fa-user"></i> ${c.users_count || 0} משתמשים</span>
                </div>
            </div>
            <button onclick="openBizJoinModal(${c.id}, '${safeStr(c.name)}')" class="w-full bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition mt-2">בקשת הצטרפות</button>
        </div>
        `;
    }).join('');
}

function openBizJoinModal(id, name) {
    const idEl = getEl('biz-join-comm-id');
    const nameEl = getEl('biz-join-comm-name');
    const modal = getEl('biz-join-community-modal');
    if (idEl && nameEl && modal) {
        idEl.value = id;
        nameEl.innerText = `בקשת הצטרפות ל: ${name}`;
        getEl('biz-join-discount').value = '';
        modal.classList.remove('hidden');
    }
}

async function submitBizCommunityJoin() {
    const commId = getEl('biz-join-comm-id').value;
    const discount = parseFloat(getEl('biz-join-discount').value);
    
    if (isNaN(discount) || discount < 0) return showToast('error', 'יש להזין אחוז הנחה תקין (אפשרי 0)');
    
    try {
        const res = await fetch(`${API}/biz/communities/join`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ communityId: commId, businessId: currentGroup.id, discountPct: discount })
        });
        const data = await res.json();
        
        if(data.success) {
            showToast('success', 'בקשת ההצטרפות נשלחה לניהול הקהילה!');
            getEl('biz-join-community-modal').classList.add('hidden');
            loadBizCommunities();
        } else {
            showToast('error', data.error || 'שגיאה בשליחת הבקשה');
        }
    } catch(e) { showToast('error', 'תקלת רשת'); }
}

async function leaveBizCommunity(commId) {
    if(!confirm('האם אתה בטוח שברצונך להתנתק מקהילה זו? לקוחות הקהילה לא יוכלו ליהנות יותר מההטבות בחנות שלך.')) return;
    
    try {
        const res = await fetch(`${API}/biz/communities/leave/${commId}/${currentGroup.id}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'התנתקת מהקהילה בהצלחה.');
            loadBizCommunities();
        } else {
            showToast('error', 'שגיאה בהתנתקות מהקהילה');
        }
    } catch(e) { showToast('error', 'תקלת רשת'); }
}

const originalLoadSADashboard = window.loadSADashboard;
if(originalLoadSADashboard && !window.saCommLoaded) {
    window.loadSADashboard = async function() {
        const userDash = document.getElementById('dashboard-container');
        if (userDash) userDash.classList.add('hidden');
        
        await originalLoadSADashboard();
        try { loadSACommunityData(); } catch(e) {}
        
        setTimeout(() => {
            if (userDash) userDash.classList.add('hidden');
        }, 100);
    };
    window.saCommLoaded = true;
}
// ==========================================
// --- ניהול רכש וספקים מורחב (B2B Procurement) ---
// ==========================================
let suppliersList = [];
let currentSupplierProducts = [];
let b2bCatalogCache = [];
let b2bCart = {}; // מבנה: { productId: quantity }
let b2bOrdersHistory = [];

function switchProcurementTab(tab) {
    ['list', 'rfq', 'suppliers'].forEach(t => {
        const view = getEl(`proc-view-${t}`);
        const btn = getEl(`btn-proc-${t}`);
        if(view) view.classList.add('hidden');
        if(btn) {
            btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.add('text-slate-500', 'hover:text-slate-700');
        }
    });
    
    const targetView = getEl(`proc-view-${tab}`);
    const targetBtn = getEl(`btn-proc-${tab}`);
    if(targetView) targetView.classList.remove('hidden');
    if(targetBtn) {
        targetBtn.classList.remove('text-slate-500', 'hover:text-slate-700');
        targetBtn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
    }

    if (tab === 'suppliers') fetchSuppliers();
    if (tab === 'list') fetchB2BCatalog();
    if (tab === 'rfq') fetchB2BOrders();
}

// -----------------------------------------
// ניהול ספקים
// -----------------------------------------
async function fetchSuppliers() {
    try {
        const res = await fetch(`${API}/suppliers/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            suppliersList = data.suppliers || [];
            renderSuppliers();
        }
    } catch(e) { console.error("Error fetching suppliers:", e); }
}

function renderSuppliers() {
    const list = getEl('suppliers-list');
    if (!list) return;
    
    if (suppliersList.length === 0) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 col-span-full">טרם הוזנו ספקים למערכת. הוסף ספק והתחל לנהל את הקטלוג שלו.</p>';
        return;
    }
    
    let html = '';
    suppliersList.forEach(s => {
        const minOrderStr = s.min_order > 0 ? `₪${s.min_order}` : 'ללא מינימום';
        const cutoffStr = s.cutoff_time ? s.cutoff_time.substring(0, 5) : 'לא מוגדר';
        
        let daysHtml = '';
        if (s.delivery_days) {
            let daysArr = [];
            try { daysArr = typeof s.delivery_days === 'string' ? JSON.parse(s.delivery_days) : s.delivery_days; } catch(e){}
            const daysMap = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
            if (daysArr && daysArr.length > 0) {
                daysHtml = daysArr.map(d => `<span class="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold ml-0.5">${daysMap[d]}</span>`).join('');
            } else { daysHtml = '<span class="text-[9px] text-slate-400">לא הוגדרו ימים</span>'; }
        }

        html += `
        <div class="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div>
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(s.name)}</h4>
                    <button onclick="openSupplierModal(${s.id})" class="text-slate-400 hover:text-indigo-600 bg-slate-50 w-7 h-7 flex items-center justify-center rounded-lg transition border border-slate-100"><i class="fa-solid fa-pen text-xs"></i></button>
                </div>
                <div class="space-y-1 mt-2 mb-3 pb-3 border-b border-slate-50">
                    ${s.phone ? `<p class="text-[10px] text-slate-600 flex items-center gap-2"><i class="fa-solid fa-phone w-3 text-slate-400"></i> <span class="dir-ltr font-medium">${s.phone}</span></p>` : ''}
                    <div class="grid grid-cols-2 gap-1 mt-2">
                        <p class="text-[9px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span class="font-bold block text-slate-700">מינימום הזמנה:</span> ${minOrderStr}</p>
                        <p class="text-[9px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span class="font-bold block text-slate-700">Cut-off:</span> ${cutoffStr}</p>
                    </div>
                    <div class="mt-2"><p class="text-[9px] font-bold text-slate-700 mb-1">ימי חלוקה:</p><div class="flex flex-wrap">${daysHtml}</div></div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="openSupplierCatalog(${s.id}, '${safeStr(s.name)}')" class="flex-[2] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-indigo-100 shadow-sm"><i class="fa-solid fa-boxes-stacked"></i> קטלוג מוצרים</button>
                <button onclick="deleteSupplier(${s.id})" class="flex-1 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 py-2 rounded-xl text-xs transition flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function openSupplierModal(id = null) {
    if (!getEl('supplier-customer-number')) {
        const minOrderDiv = getEl('supplier-min-order').parentNode;
        minOrderDiv.insertAdjacentHTML('afterend', `<div><label class="text-xs font-bold text-slate-500 block mb-1.5">מספר לקוח (אצל הספק):</label><input type="text" id="supplier-customer-number" class="modern-input py-2 text-sm text-left dir-ltr" placeholder="למשל: 102938"></div>`);
    }

    if (id) {
        const s = suppliersList.find(x => x.id === id);
        if (!s) return;
        getEl('supplier-id').value = s.id;
        getEl('supplier-name').value = s.name;
        getEl('supplier-contact').value = s.contact_person || '';
        getEl('supplier-phone').value = s.phone || '';
        getEl('supplier-email').value = s.email || '';
        getEl('supplier-category').value = s.category || 'כללי';
        getEl('supplier-min-order').value = s.min_order || 0;
        getEl('supplier-cutoff').value = s.cutoff_time ? s.cutoff_time.substring(0, 5) : '12:00';
        getEl('supplier-customer-number').value = s.customer_number || '';
        
        let daysArr = [];
        try { daysArr = typeof s.delivery_days === 'string' ? JSON.parse(s.delivery_days) : s.delivery_days; } catch(e){}
        document.querySelectorAll('#supplier-delivery-days input[type="checkbox"]').forEach(cb => { cb.checked = daysArr && daysArr.includes(parseInt(cb.value)); });
    } else {
        getEl('supplier-id').value = '';
        getEl('supplier-name').value = '';
        getEl('supplier-contact').value = '';
        getEl('supplier-phone').value = '';
        getEl('supplier-email').value = '';
        getEl('supplier-category').value = 'כללי';
        getEl('supplier-min-order').value = 0;
        getEl('supplier-cutoff').value = '12:00';
        getEl('supplier-customer-number').value = '';
        document.querySelectorAll('#supplier-delivery-days input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
    getEl('supplier-modal').classList.remove('hidden');
}

async function submitSupplier() {
    const id = val('supplier-id');
    const name = val('supplier-name');
    if (!name) return showToast('error', 'חובה להזין שם ספק / חברה');
    
    const deliveryDays = [];
    document.querySelectorAll('#supplier-delivery-days input[type="checkbox"]:checked').forEach(cb => { deliveryDays.push(parseInt(cb.value)); });
    
    const payload = {
        id: id || null, 
        groupId: currentGroup.id, 
        name: name, 
        contactPerson: val('supplier-contact'), 
        phone: val('supplier-phone'), 
        email: val('supplier-email'),
        category: val('supplier-category'),
        minOrder: parseFloat(val('supplier-min-order')) || 0, 
        cutoffTime: val('supplier-cutoff') || '12:00', 
        deliveryDays: deliveryDays,
        customerNumber: val('supplier-customer-number')
    };

    const btn = getEl('btn-submit-supplier'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> שומר...';
    try {
        const res = await fetch(`${API}/suppliers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן בהצלחה!' : 'הספק נוסף בהצלחה למאגר!'); getEl('supplier-modal').classList.add('hidden'); fetchSuppliers(); } else { showToast('error', data.error); }
    } catch (e) { showToast('error', 'שגיאת רשת'); } finally { btn.disabled = false; btn.innerText = 'שמור פרטי ספק'; }
}

async function deleteSupplier(id) {
    if(!confirm('האם למחוק ספק זה? יימחקו גם כל המוצרים בקטלוג שלו! לא ניתן לבטל.')) return;
    try { await fetch(`${API}/suppliers/${id}`, { method: 'DELETE' }); showToast('success', 'הספק והקטלוג שלו נמחקו בהצלחה'); fetchSuppliers(); } catch(e) {}
}
// -----------------------------------------
// קטלוג מוצרים ספציפי (במודאל מנהל) + תמיכה במק"ט
// -----------------------------------------
function resetCatalogForm() { 
    const idEl = getEl('catalog-product-id'); if(idEl) idEl.value = ''; 
    const nameEl = getEl('cat-prod-name'); if(nameEl) nameEl.value = ''; 
    const skuEl = getEl('cat-prod-sku'); if(skuEl) skuEl.value = ''; 
    const priceEl = getEl('cat-prod-price'); if(priceEl) priceEl.value = ''; 
    const unitEl = getEl('cat-prod-unit'); if(unitEl) unitEl.value = "יח'"; 
    const uppEl = getEl('cat-prod-upp'); if(uppEl) uppEl.value = 1; 
    const descEl = getEl('cat-prod-desc'); if(descEl) descEl.value = ''; 
    const titleEl = getEl('catalog-form-title'); if(titleEl) titleEl.innerText = 'הוספת מוצר לקטלוג'; 
    const btnEl = getEl('btn-submit-cat-prod'); if(btnEl) btnEl.innerText = 'הוסף מוצר'; 
}

function renderSupplierProducts() {
    const list = getEl('supplier-products-list'); const countEl = getEl('cat-prod-count'); if(countEl) countEl.innerText = currentSupplierProducts.length;
    if (currentSupplierProducts.length === 0) { list.innerHTML = '<div class="text-center py-12"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3"></i><p class="text-slate-500 text-sm">הקטלוג ריק.</p></div>'; return; }
    let html = '';
    currentSupplierProducts.forEach(p => {
        let sku = '';
        try { if(p.properties) { const props = typeof p.properties === 'string' ? JSON.parse(p.properties) : p.properties; sku = props.sku ? `מק"ט: ${props.sku}` : ''; } } catch(e){}
        
        const uppStr = p.units_per_package > 1 ? `<span class="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 rounded font-bold ml-1">${p.units_per_package} יח' במארז</span>` : '';
        const skuStr = sku ? `<span class="bg-slate-100 text-slate-500 text-[9px] px-1.5 rounded font-bold ml-1 dir-ltr inline-block">${sku}</span>` : '';
        const descStr = p.description ? `<p class="text-[10px] text-slate-500 mt-0.5 truncate">${safeStr(p.description)}</p>` : '';
        html += `<div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-indigo-300 transition group"><div class="flex-1 pr-2 overflow-hidden"><h5 class="font-bold text-slate-800 text-sm truncate">${safeStr(p.name)} ${uppStr} ${skuStr}</h5>${descStr}<div class="text-xs font-black text-slate-700 mt-1">₪${p.price} <span class="font-normal text-[10px] text-slate-400">ל-${safeStr(p.unit_type)}</span></div></div><div class="flex flex-col gap-2 shrink-0"><button onclick="editSupplierProduct(${p.id})" class="text-slate-400 hover:text-blue-600 w-7 h-7 bg-slate-50 rounded flex items-center justify-center transition border border-slate-100"><i class="fa-solid fa-pen text-[10px]"></i></button><button onclick="deleteSupplierProduct(${p.id})" class="text-slate-400 hover:text-red-600 w-7 h-7 bg-slate-50 rounded flex items-center justify-center transition border border-slate-100"><i class="fa-solid fa-trash-can text-[10px]"></i></button></div></div>`;
    }); list.innerHTML = html;
}

function openSupplierCatalog(supplierId, supplierName) {
    if (!getEl('supplier-catalog-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="supplier-catalog-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[80] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-4xl rounded-[2rem] p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <button onclick="document.getElementById('supplier-catalog-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full transition z-10"><i class="fa-solid fa-xmark"></i></button>
                <div class="mb-4 pr-10 border-b border-slate-100 pb-3">
                    <h3 class="text-xl font-black text-slate-800"><i class="fa-solid fa-boxes-stacked text-indigo-500 ml-2"></i> קטלוג ספק: <span id="catalog-supplier-name" class="text-indigo-600"></span></h3>
                </div>
                <div class="flex flex-col md:flex-row gap-6 overflow-hidden flex-1 min-h-0">
                    <div class="w-full md:w-1/3 bg-slate-50 p-4 rounded-2xl border border-slate-100 overflow-y-auto modal-scroll shrink-0">
                        <h4 id="catalog-form-title" class="font-bold text-slate-700 text-sm mb-4">הוספת מוצר</h4>
                        <input type="hidden" id="catalog-supplier-id">
                        <input type="hidden" id="catalog-product-id">
                        <div class="space-y-3">
                            <div><label class="text-[10px] font-bold text-slate-500">שם מוצר:</label><input type="text" id="cat-prod-name" class="modern-input py-2 text-sm bg-white w-full"></div>
                            <div><label class="text-[10px] font-bold text-slate-500">מק"ט (אופציונלי):</label><input type="text" id="cat-prod-sku" class="modern-input py-2 text-sm bg-white w-full dir-ltr text-left" placeholder="SKU"></div>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="text-[10px] font-bold text-slate-500">מחיר (₪):</label><input type="number" step="0.1" id="cat-prod-price" class="modern-input py-2 text-sm bg-white dir-ltr text-right w-full"></div>
                                <div><label class="text-[10px] font-bold text-slate-500">סוג יחידה:</label><input type="text" id="cat-prod-unit" value="יח'" class="modern-input py-2 text-sm bg-white text-center w-full"></div>
                            </div>
                            <div><label class="text-[10px] font-bold text-slate-500">כמות במארז:</label><input type="number" id="cat-prod-upp" value="1" class="modern-input py-2 text-sm bg-white text-center w-full"></div>
                            <div><label class="text-[10px] font-bold text-slate-500">תיאור (אופציונלי):</label><textarea id="cat-prod-desc" class="modern-input py-2 text-sm bg-white h-16 w-full"></textarea></div>
                            <button id="btn-submit-cat-prod" onclick="submitSupplierProduct()" class="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 transition mt-2">הוסף לקטלוג</button>
                            <button onclick="resetCatalogForm()" class="w-full bg-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition mt-2">נקה טופס</button>
                        </div>
                    </div>
                    <div class="w-full md:w-2/3 flex flex-col overflow-hidden min-h-[300px]">
                        <div class="flex justify-between items-center mb-3 px-1">
                            <h4 class="font-bold text-slate-700 text-sm">רשימת מוצרים (<span id="cat-prod-count">0</span>)</h4>
                        </div>
                        <div id="supplier-products-list" class="flex-1 overflow-y-auto space-y-2 pr-1 pb-4 modal-scroll"></div>
                    </div>
                </div>
            </div>
        </div>`);
    }
    
    getEl('catalog-supplier-id').value = supplierId; 
    getEl('catalog-supplier-name').innerText = supplierName; 
    resetCatalogForm(); 
    getEl('supplier-catalog-modal').classList.remove('hidden');
    getEl('supplier-products-list').innerHTML = '<div class="flex justify-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500"></i></div>';
    
    fetch(`${API}/suppliers/${supplierId}/products`)
        .then(res => res.json())
        .then(data => {
            if (data.success) { currentSupplierProducts = data.products || []; renderSupplierProducts(); }
        })
        .catch(e => showToast('error', 'שגיאה בטעינת קטלוג'));
}

function editSupplierProduct(id) { 
    const p = currentSupplierProducts.find(x => x.id === id); if (!p) return; 
    getEl('catalog-product-id').value = p.id; 
    getEl('cat-prod-name').value = p.name; 
    getEl('cat-prod-price').value = p.price; 
    getEl('cat-prod-unit').value = p.unit_type; 
    getEl('cat-prod-upp').value = p.units_per_package || 1; 
    getEl('cat-prod-desc').value = p.description || ''; 
    
    let sku = '';
    try { if(p.properties) { const props = typeof p.properties === 'string' ? JSON.parse(p.properties) : p.properties; sku = props.sku || ''; } } catch(e){}
    const skuEl = getEl('cat-prod-sku'); if(skuEl) skuEl.value = sku;
    
    getEl('catalog-form-title').innerText = 'עריכת מוצר'; 
    getEl('btn-submit-cat-prod').innerText = 'שמור שינויים'; 
}

async function submitSupplierProduct() {
    const supplierId = val('catalog-supplier-id'); const id = val('catalog-product-id'); const name = val('cat-prod-name'); const price = val('cat-prod-price'); const sku = val('cat-prod-sku');
    if(!name || !price) return showToast('error', 'שם מוצר ומחיר הם חובה');
    const btn = getEl('btn-submit-cat-prod'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שומר...';
    try {
        const payload = { id: id || null, groupId: currentGroup.id, supplierId: supplierId, name: name, price: parseFloat(price) || 0, unitType: val('cat-prod-unit'), unitsPerPackage: parseInt(val('cat-prod-upp')) || 1, description: val('cat-prod-desc'), properties: { sku: sku } };
        const res = await fetch(`${API}/suppliers/products`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); const data = await res.json();
        if (data.success) { showToast('success', id ? 'מוצר עודכן' : 'מוצר נוסף'); resetCatalogForm(); openSupplierCatalog(supplierId, getEl('catalog-supplier-name').innerText); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { btn.disabled = false; btn.innerText = 'שמור מוצר'; }
}

async function deleteSupplierProduct(id) { if(!confirm('למחוק מוצר מהקטלוג?')) return; try { await fetch(`${API}/suppliers/products/${id}`, { method: 'DELETE' }); showToast('success', 'המוצר הוסר'); openSupplierCatalog(getEl('catalog-supplier-id').value, getEl('catalog-supplier-name').innerText); } catch(e) {} }

function handleAICatalogUpload(event) { showToast('info', 'הסריקה החכמה תהיה זמינה בקרוב!'); event.target.value = ''; }

// -----------------------------------------
// מערכת המרקטפלייס B2B (עגלת קניות)
// -----------------------------------------
async function fetchB2BCatalog() {
    try {
        const res = await fetch(`${API}/b2b/catalog/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            b2bCatalogCache = data.catalog || [];
            updateSupplierFilterDropdown();
            renderB2BCatalog();
        }
    } catch(e) { console.error("Error fetching B2B catalog:", e); }
}

function updateSupplierFilterDropdown() {
    const select = getEl('b2b-supplier-filter');
    if (!select) return;
    const uniqueSuppliers = [...new Set(b2bCatalogCache.map(p => p.supplier_id))];
    select.innerHTML = '<option value="all">כל הספקים</option>';
    uniqueSuppliers.forEach(id => {
        const p = b2bCatalogCache.find(x => x.supplier_id === id);
        if (p) select.innerHTML += `<option value="${p.supplier_id}">${safeStr(p.supplier_name)}</option>`;
    });
}

function renderB2BCatalog() {
    const list = getEl('b2b-catalog-list');
    if (!list) return;
    
    const search = val('b2b-search').toLowerCase();
    const supplierId = val('b2b-supplier-filter');
    
    let filtered = b2bCatalogCache;
    if (supplierId !== 'all') filtered = filtered.filter(p => String(p.supplier_id) === String(supplierId));
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || (p.description && p.description.toLowerCase().includes(search)));

    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-12"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3"></i><p class="text-slate-500 font-bold">לא נמצאו מוצרים</p><p class="text-xs text-slate-400 mt-1">נסו לחפש משהו אחר או שנו את הספק</p></div>';
        return;
    }

    let html = '';
    let currentSupplier = '';

    filtered.forEach(p => {
        if (p.supplier_name !== currentSupplier) {
            const minOrderHtml = p.min_order > 0 ? `<span class="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">מינימום: ₪${p.min_order}</span>` : '';
            html += `<h4 class="font-black text-slate-800 text-sm mt-5 mb-2 px-1 flex justify-between items-center"><span class="flex items-center gap-2"><i class="fa-solid fa-truck-fast text-indigo-500"></i> ${safeStr(p.supplier_name)}</span> ${minOrderHtml}</h4>`;
            currentSupplier = p.supplier_name;
        }

        const qty = b2bCart[p.id] || 0;
        let actionHtml = '';
        if (qty > 0) {
            actionHtml = `
            <div class="flex items-center justify-between gap-1 bg-indigo-50 border border-indigo-100 rounded-lg p-1 w-24 shrink-0">
                <button onclick="updateB2BCart(${p.id}, -1)" class="w-7 h-7 rounded bg-white shadow-sm flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition"><i class="fa-solid fa-minus text-[10px]"></i></button>
                <span class="font-bold text-indigo-900 text-xs px-1">${qty}</span>
                <button onclick="updateB2BCart(${p.id}, 1)" class="w-7 h-7 rounded bg-indigo-600 text-white shadow-sm flex items-center justify-center hover:bg-indigo-700 transition"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </div>`;
        } else {
            actionHtml = `<button onclick="updateB2BCart(${p.id}, 1)" class="bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-slate-200 shadow-sm w-24 shrink-0"><i class="fa-solid fa-plus"></i> הוסף</button>`;
        }

        const descHtml = p.description ? `<p class="text-[10px] text-slate-500 truncate mt-0.5">${safeStr(p.description)}</p>` : '';
        const uppHtml = p.units_per_package > 1 ? `<span class="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 rounded font-bold ml-1 border border-indigo-100">${p.units_per_package} יח' במארז</span>` : '';
        
        let sku = '';
        try { if(p.properties) { const props = typeof p.properties === 'string' ? JSON.parse(p.properties) : p.properties; sku = props.sku ? `מק"ט: ${props.sku}` : ''; } } catch(e){}
        const skuStr = sku ? `<span class="bg-slate-100 text-slate-500 text-[9px] px-1.5 rounded font-bold ml-1 dir-ltr inline-block">${sku}</span>` : '';

        html += `
        <div class="bg-white p-3 rounded-2xl border ${qty>0 ? 'border-indigo-400 shadow-md' : 'border-slate-200 shadow-sm'} flex justify-between items-center mb-2 transition-all group">
            <div class="flex-1 pr-1 overflow-hidden">
                <h5 class="font-bold text-slate-800 text-sm truncate">${safeStr(p.name)} ${uppHtml} ${skuStr}</h5>
                ${descHtml}
                <div class="text-xs font-black text-slate-700 mt-1">₪${p.price} <span class="font-normal text-[10px] text-slate-400">ל-${safeStr(p.unit_type)}</span></div>
            </div>
            ${actionHtml}
        </div>`;
    });
    list.innerHTML = html;
    updateB2BCartUI();
}

function updateB2BCart(productId, delta) {
    b2bCart[productId] = (b2bCart[productId] || 0) + delta;
    if (b2bCart[productId] <= 0) delete b2bCart[productId];
    renderB2BCatalog(); 
}

function updateB2BCartUI() {
    const floating = getEl('b2b-cart-floating');
    if (!floating) return;
    
    if (!getEl('close-b2b-cart-btn')) {
        floating.insertAdjacentHTML('beforeend', `<button id="close-b2b-cart-btn" onclick="b2bCart={}; updateB2BCartUI(); renderB2BCatalog();" style="position:absolute; top:-10px; right:10px; background:#ef4444; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2); border:2px solid white; z-index:50;" title="מחק סל"><i class="fa-solid fa-times"></i></button>`);
    }
    
    let count = 0;
    let total = 0;
    Object.keys(b2bCart).forEach(id => {
        const qty = b2bCart[id];
        const p = b2bCatalogCache.find(x => String(x.id) === String(id));
        if (p) { count += qty; total += (p.price * qty); } else { count += qty; }
    });

    const appBottom = getEl('app-banner-bottom');
    let bottomOffset = 16; 
    if (appBottom && !appBottom.classList.contains('hidden')) { bottomOffset += appBottom.offsetHeight || 60; }
    floating.style.bottom = `${bottomOffset}px`;

    if (count > 0) {
        const countEl = getEl('b2b-cart-count'); if(countEl) countEl.innerText = count;
        const totalEl = getEl('b2b-cart-total'); if(totalEl) totalEl.innerText = `₪${total.toFixed(2)}`;
        floating.classList.remove('translate-y-full');
        floating.classList.add('opacity-100');
        floating.style.visibility = 'visible';
    } else {
        floating.classList.add('translate-y-full');
        floating.classList.remove('opacity-100');
        setTimeout(() => { if (Object.keys(b2bCart).length === 0) floating.style.visibility = 'hidden'; }, 300);
    }
}

// סיכום קופה ושיגור למספר ספקים במקביל
function openB2BCheckout() {
    const splitOrders = {};
    let grandTotal = 0;

    Object.keys(b2bCart).forEach(id => {
        const qty = b2bCart[id];
        const p = b2bCatalogCache.find(x => String(x.id) === String(id));
        if (p) {
            if (!splitOrders[p.supplier_id]) {
                splitOrders[p.supplier_id] = { supplierName: p.supplier_name, minOrder: parseFloat(p.min_order) || 0, items: [], total: 0 };
            }
            const rowTotal = p.price * qty;
            let sku = '';
            try { if(p.properties) { const props = typeof p.properties === 'string' ? JSON.parse(p.properties) : p.properties; sku = props.sku || ''; } } catch(e){}
            
            splitOrders[p.supplier_id].items.push({ id: p.id, sku: sku, name: p.name, quantity: qty, unit: p.unit_type, price_per_unit: p.price, row_total: rowTotal });
            splitOrders[p.supplier_id].total += rowTotal;
            grandTotal += rowTotal;
        }
    });

    const listEl = getEl('b2b-checkout-suppliers-list');
    listEl.innerHTML = '';
    let hasErrors = false;

    Object.keys(splitOrders).forEach(supId => {
        const order = splitOrders[supId];
        const isBelowMin = order.minOrder > 0 && order.total < order.minOrder;
        if (isBelowMin) hasErrors = true;

        const headerColor = isBelowMin ? 'text-red-800 bg-red-50 border-red-200' : 'text-indigo-800 bg-indigo-50 border-indigo-100';
        const alertHtml = isBelowMin ? `<div class="text-[10px] font-bold text-red-600 mt-1 bg-white inline-block px-2 py-0.5 rounded-full border border-red-100"><i class="fa-solid fa-triangle-exclamation"></i> לא הגעת למינימום הזמנה (₪${order.minOrder})</div>` : '';

        let itemsHtml = order.items.map(i => `
            <div class="flex justify-between items-center text-xs py-2 border-b border-slate-100 last:border-0">
                <span class="text-slate-700 font-medium">${safeStr(i.name)} <span class="text-indigo-600 bg-indigo-50 px-1.5 rounded-md font-bold text-[10px] ml-1">x${i.quantity} ${safeStr(i.unit)}</span></span>
                <span class="font-bold text-slate-800 dir-ltr">₪${i.row_total.toFixed(2)}</span>
            </div>
        `).join('');

        listEl.innerHTML += `
        <div class="bg-white rounded-2xl border ${isBelowMin ? 'border-red-300 shadow-sm' : 'border-slate-200'} overflow-hidden mb-4">
            <div class="${headerColor} p-3 border-b flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-sm"><i class="fa-solid fa-box-open opacity-60 ml-1"></i> ספק: ${safeStr(order.supplierName)}</h4>
                    ${alertHtml}
                </div>
                <span class="font-black text-lg dir-ltr">₪${order.total.toFixed(2)}</span>
            </div>
            <div class="p-3 bg-white">${itemsHtml}</div>
        </div>`;
    });

    getEl('b2b-checkout-grand-total').innerText = `₪${grandTotal.toFixed(2)}`;
    
    const btnSubmit = getEl('btn-submit-b2b-orders');
    if (hasErrors) {
        btnSubmit.disabled = true;
        btnSubmit.className = "w-full mt-4 bg-slate-200 text-slate-500 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 cursor-not-allowed border border-slate-300";
        btnSubmit.innerHTML = 'יש לתקן חריגות מינימום כדי להמשיך <i class="fa-solid fa-ban"></i>';
    } else {
        btnSubmit.disabled = false;
        btnSubmit.className = "w-full mt-4 bg-slate-800 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-700 transition flex justify-center items-center gap-2";
        btnSubmit.innerHTML = 'שגר הזמנות מפוצלות <i class="fa-solid fa-paper-plane"></i>';
    }

    getEl('b2b-checkout-modal').classList.remove('hidden');
}
// -----------------------------------------
// פונקציות ליצירת PDF (תצוגה מקדימה והורדה)
// -----------------------------------------

// טעינה דינמית של ספריית יצירת ה-PDF
async function loadHtml2Pdf() {
    if (window.html2pdf) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => { showToast('error', 'שגיאה בטעינת מערכת ה-PDF'); resolve(false); };
        document.head.appendChild(script);
    });
}
// תבנית ה-HTML ל-PDF - גרסה 1.0.9 (תיקון כיווניות עברית מלא ופריסה)
function getOrderHtmlTemplate(orderInfo) {
    let itemsArr = [];
    try {
        if (Array.isArray(orderInfo.items)) itemsArr = orderInfo.items;
        else if (typeof orderInfo.items === 'string') itemsArr = JSON.parse(orderInfo.items);
    } catch(e) { itemsArr = []; }

    let itemsHtml = '';
    if (itemsArr.length === 0) {
        itemsHtml = '<tr><td colspan="5" style="text-align:center; padding:12px;" dir="rtl">אין פריטים להצגה</td></tr>';
    } else {
        itemsHtml = itemsArr.map((i, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;" dir="rtl">
                <td style="padding: 9px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;" dir="ltr">${safeStr(i.sku || '-')}</td>
                <td style="padding: 9px 6px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">
                    ${safeStr(i.name).replace(/ /g, '&nbsp;')}
                </td>
                <td style="padding: 9px 6px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #4f46e5;" dir="rtl">${i.quantity}&nbsp;${safeStr(i.unit)}</td>
                <td style="padding: 9px 6px; text-align: left; border: 1px solid #cbd5e1;" dir="ltr">₪${parseFloat(i.price_per_unit || 0).toFixed(2)}</td>
                <td style="padding: 9px 6px; font-weight: bold; text-align: left; border: 1px solid #cbd5e1; color: #0f172a;" dir="ltr">₪${parseFloat(i.row_total || 0).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    // פונקציית עזר מתוקנת לסידור הנקודתיים בעברית - עוטפת את כל בלוק המידע ב-RTL קשיח
    const fixLabel = (label) => `<span style="font-weight: bold; color: #334155;">${label.replace(/ /g, '&nbsp;')}</span>`;

    const customerNumHtml = orderInfo.customerNumber ? `<div style="margin-bottom: 7px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">${fixLabel('מספר לקוח:')}&nbsp;<span dir="ltr" style="background-color: #eef2ff; padding: 3px 9px; border-radius: 5px; color: #4f46e5; font-weight: bold;">${safeStr(orderInfo.customerNumber)}</span></div>` : '';
    const branchHtml = orderInfo.branchName ? `<div style="margin-bottom: 7px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">${fixLabel('עבור סניף/מחלקה:')}&nbsp;<span>${safeStr(orderInfo.branchName).replace(/ /g, '&nbsp;')}</span></div>` : '';
    const phoneHtml = orderInfo.supplierPhone ? `<div style="margin-bottom: 7px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">${fixLabel('טלפון:')}&nbsp;<span dir="ltr">${safeStr(orderInfo.supplierPhone)}</span></div>` : '';
    const emailHtml = orderInfo.supplierEmail ? `<div style="margin-bottom: 7px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">${fixLabel('דוא"ל:')}&nbsp;<span>${safeStr(orderInfo.supplierEmail).replace(/ /g, '&nbsp;')}</span></div>` : '';

    return `
        <div style="direction: rtl; font-family: Arial, sans-serif; color: #1e293b; background: white; width: 100%; box-sizing: border-box; padding: 18px 22px; text-align: right; margin: 0 auto; unicode-bidi: bidi-override;" dir="rtl">
            
            <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 4px solid #4f46e5; margin-bottom: 18px; direction: rtl; text-align: right;" dir="rtl">
                <tr>
                    <td style="vertical-align: middle; text-align: right; width: 52%;" dir="rtl">
                        <h1 style="margin: 0 0 6px 0; font-size: 27px; color: #334155; direction: rtl; unicode-bidi: bidi-override;">הזמנת רכש <span dir="ltr" style="font-size: 17px; color:#64748b;">(Purchase Order)</span></h1>
                        <div style="font-size: 15px; color: #0f172a; background: #f8fafc; display: inline-block; padding: 5px 13px; border-radius: 6px; border: 1px solid #e2e8f0; direction: rtl; unicode-bidi: bidi-override;">מספר הזמנה:&nbsp;<b dir="ltr" style="color: #4f46e5;">#${orderInfo.orderId || 'חדש'}</b></div>
                    </td>
                    <td style="vertical-align: middle; text-align: left; width: 48%;" dir="ltr">
                        <span style="font-size: 28px; font-weight: 900; color: #4f46e5; font-family: 'Arial Black', sans-serif;">ONEFLOW <span style="color: #0f172a;">LIFE</span> <span style="font-weight: 300;">BIZ</span></span>
                        <img src="/logo.png" style="height: 46px; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">
                    </td>
                </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; direction: rtl; text-align: right;" dir="rtl">
                <tr>
                    <td style="width: 48%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top; text-align: right;" dir="rtl">
                        <h3 style="margin: 0 0 10px 0; color: #4f46e5; font-size: 16px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">פרטי הלקוח (המזמין):</h3>
                        <div style="margin-bottom: 6px; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">${fixLabel('שם העסק:')}&nbsp;<span>${safeStr(currentGroup.name).replace(/ /g, '&nbsp;')}</span></div>
                        <div style="margin-bottom: 6px; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">${fixLabel('איש קשר:')}&nbsp;<span>${safeStr(currentUser.nickname).replace(/ /g, '&nbsp;')}</span></div>
                        ${branchHtml}
                        ${customerNumHtml}
                        <div style="margin-top: 12px; font-size: 13px; color: #64748b; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">${fixLabel('הופק ב:')}&nbsp;<span dir="ltr">${new Date().toLocaleDateString('he-IL')}&nbsp;${new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span></div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 48%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top; text-align: right;" dir="rtl">
                        <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px; text-align: right; direction: rtl; unicode-bidi: bidi-override;">פרטי הספק:</h3>
                        <div style="margin-bottom: 6px; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">${fixLabel('לכבוד:')}&nbsp;<span>${safeStr(orderInfo.supplierName).replace(/ /g, '&nbsp;')}</span></div>
                        ${phoneHtml}
                        ${emailHtml}
                    </td>
                </tr>
            </table>

            <div style="margin-bottom: 18px; font-size: 14.5px; line-height: 1.6; color: #334155; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">
                <strong>שלום רב,</strong><br>
                מצ"ב פירוט הזמנת רכש מאושרת ממערכת ההזמנות שלנו. נא לספק את הסחורה המפורטת מטה בהקדם האפשרי ולפי תנאי הסחר והמחירון שסוכמו.
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px; font-size: 13.5px; border: 1px solid #cbd5e1; direction: rtl; text-align: right;" dir="rtl">
                <thead>
                    <tr style="background-color: #4f46e5; color: white;">
                        <th style="padding: 10px 6px; border: 1px solid #cbd5e1; text-align: center; width: 12%;">מק"ט</th>
                        <th style="padding: 10px 6px; border: 1px solid #cbd5e1; text-align: right; width: 43%;">תיאור פריט</th>
                        <th style="padding: 10px 6px; border: 1px solid #cbd5e1; text-align: center; width: 15%;">כמות</th>
                        <th style="padding: 10px 6px; border: 1px solid #cbd5e1; text-align: left; width: 15%;">מחיר יח'</th>
                        <th style="padding: 10px 6px; border: 1px solid #cbd5e1; text-align: left; width: 15%;">סה"כ שורה</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div style="border-top: 3px solid #cbd5e1; padding-top: 15px; text-align: right; direction: rtl; unicode-bidi: bidi-override;" dir="rtl">
                <h2 style="margin: 0; font-size: 21px; color: #0f172a; direction: rtl; unicode-bidi: bidi-override;">סה"כ לתשלום משוער:&nbsp;<span dir="ltr" style="color: #4f46e5;">₪${(orderInfo.totalAmount || orderInfo.total || 0).toFixed(2)}</span></h2>
                <div style="color: #64748b; font-size: 11px; margin-top: 5px;">* ייתכנו שינויים במחיר הסופי בהתאם לשקילה ולמחירון העדכני בעת האספקה.</div>
            </div>
        </div>
    `;
}

// יצירת PDF לשליחה במייל (מוסתר) בפריסה לרוחב (Landscape) 
async function generateOrderPDFBase64(orderInfo) {
    return new Promise(async (resolve) => {
        try {
            const isLoaded = await loadHtml2Pdf();
            if (!isLoaded) { resolve(null); return; }

            const htmlContent = getOrderHtmlTemplate(orderInfo);
            
            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            
            // שינוי הגדרות מיקום כדי למנוע את "זריקת" המסמך הצידה ולוודא פריסה מלאה
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.right = '0';
            container.style.margin = 'auto';
            container.style.width = '1040px'; 
            container.style.zIndex = '-100'; 
            container.style.opacity = '0.99';
            container.style.backgroundColor = '#ffffff';
            container.style.height = 'max-content'; // מבטיח שהאלמנט נפתח במלואו לפני הצילום
            document.body.appendChild(container);

            const opt = { 
                margin: [10, 10, 10, 10], 
                filename: 'order.pdf', 
                image: { type: 'jpeg', quality: 1 }, 
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    width: container.offsetWidth, // הגדרה קריטית כדי לתפוס את הרוחב האמיתי המרוכז
                    scrollY: 0,
                    height: container.scrollHeight, 
                    windowHeight: container.scrollHeight 
                }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }, 
                pagebreak: { mode: ['css', 'legacy'] } 
            };

            setTimeout(() => {
                html2pdf().set(opt).from(container).outputPdf('datauristring').then(base64Str => {
                    if(document.body.contains(container)) document.body.removeChild(container);
                    if (base64Str && base64Str.includes('base64,')) resolve(base64Str.split('base64,')[1]);
                    else resolve(null);
                }).catch(err => { 
                    if(document.body.contains(container)) document.body.removeChild(container);
                    resolve(null); 
                });
            }, 500); 
        } catch(err) { resolve(null); }
    });
}

// שיגור הזמנה מפוצלת לספקים
async function submitB2BOrders() {
    const branchNameVal = val('checkout-branch') || ''; 
    const splitOrders = [];
    
    Object.keys(b2bCart).forEach(id => {
        const qty = b2bCart[id]; const p = b2bCatalogCache.find(x => String(x.id) === String(id));
        if (p) {
            let existing = splitOrders.find(o => o.supplierId === p.supplier_id);
            if (!existing) {
                const supData = suppliersList.find(s => s.id === p.supplier_id) || {};
                existing = { 
                    orderId: 'חדש',
                    supplierId: p.supplier_id, 
                    supplierName: p.supplier_name, 
                    supplierPhone: supData.phone || '',
                    supplierEmail: supData.email || '',
                    branchName: branchNameVal, 
                    customerNumber: supData.customer_number || '', 
                    items: [], 
                    totalAmount: 0 
                };
                splitOrders.push(existing);
            }
            const rowTotal = p.price * qty;
            
            let sku = '';
            try { if(p.properties) { const props = typeof p.properties === 'string' ? JSON.parse(p.properties) : p.properties; sku = props.sku || ''; } } catch(e){}
            
            existing.items.push({ id: p.id, sku: sku, name: p.name, quantity: qty, unit: p.unit_type, price_per_unit: p.price, row_total: rowTotal });
            existing.totalAmount += rowTotal;
        }
    });

    const btn = getEl('btn-submit-b2b-orders'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מכין מסמכים...';

    try {
        for (let order of splitOrders) { 
            try { order.pdfBase64 = await generateOrderPDFBase64(order); } catch(pdfErr) { order.pdfBase64 = null; } 
        }
        
        const res = await fetch(`${API}/b2b/orders`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, userId: currentUser.id, orders: splitOrders }) });
        const data = await res.json();
        
        if (data.success) {
            triggerConfetti(); showToast('success', 'ההזמנה שוגרה בהצלחה לספקים!'); getEl('b2b-checkout-modal').classList.add('hidden');
            b2bCart = {}; updateB2BCartUI(); renderB2BCatalog(); switchProcurementTab('rfq'); 
        } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { btn.disabled = false; btn.innerHTML = 'שגר הזמנות לספקים <i class="fa-solid fa-paper-plane"></i>'; }
}

// היסטוריית הזמנות רכש מפוצלות
async function fetchB2BOrders() {
    try {
        const res = await fetch(`${API}/b2b/orders/${currentGroup.id}`);
        const data = await res.json();
        if (data.success) {
            b2bOrdersHistory = data.orders || [];
            renderB2BOrders();
        }
    } catch(e) { console.error(e); }
}

function renderB2BOrders() {
    const list = getEl('b2b-orders-list'); if (!list) return;
    
    if (!getEl('b2b-orders-filters-bar')) {
        let supOpts = '<option value="all">כל הספקים</option>';
        suppliersList.forEach(s => supOpts += `<option value="${s.id}">${safeStr(s.name)}</option>`);
        list.insertAdjacentHTML('beforebegin', `
            <div id="b2b-orders-filters-bar" class="flex flex-wrap gap-2 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-sm">
                <select id="filter-order-sup" onchange="renderB2BOrders()" class="modern-input py-1.5 text-xs flex-1 min-w-[120px] bg-white">${supOpts}</select>
                <select id="filter-order-status" onchange="renderB2BOrders()" class="modern-input py-1.5 text-xs flex-1 min-w-[120px] bg-white">
                    <option value="all">כל הסטטוסים</option><option value="sent">נשלח</option><option value="processing">בטיפול</option><option value="shipped">במשלוח</option><option value="delivered">סופק</option><option value="cancelled">בוטל</option>
                </select>
                <select id="filter-order-date" onchange="renderB2BOrders()" class="modern-input py-1.5 text-xs flex-1 min-w-[120px] bg-white">
                    <option value="all">כל הזמן</option><option value="30">30 יום אחרונים</option><option value="90">3 חודשים אחרונים</option>
                </select>
            </div>
        `);
    }

    const fSup = val('filter-order-sup') || 'all'; 
    const fStat = val('filter-order-status') || 'all'; 
    const fDate = val('filter-order-date') || 'all';
    
    let filteredOrders = b2bOrdersHistory;
    if(fSup !== 'all') filteredOrders = filteredOrders.filter(o => String(o.supplier_id) === fSup);
    if(fStat !== 'all') filteredOrders = filteredOrders.filter(o => o.status === fStat);
    if(fDate !== 'all') { 
        const cutoff = new Date(); 
        cutoff.setDate(cutoff.getDate() - parseInt(fDate)); 
        filteredOrders = filteredOrders.filter(o => new Date(o.created_at) >= cutoff); 
    }

    if (filteredOrders.length === 0) { 
        list.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-receipt text-4xl text-slate-200 mb-3"></i><p class="text-[11px] text-slate-400 font-bold">אין הזמנות התואמות לסינון.</p></div>'; 
        return; 
    }
    
    let html = '';
    const statusMap = { 
        'sent': { t: 'נשלח לספק', c: 'bg-blue-100 text-blue-700' }, 
        'processing': { t: 'בטיפול אצל הספק', c: 'bg-orange-100 text-orange-700' }, 
        'shipped': { t: 'בדרך אלינו', c: 'bg-purple-100 text-purple-700' }, 
        'delivered': { t: 'סופק במלואו', c: 'bg-green-100 text-green-700 opacity-80' }, 
        'cancelled': { t: 'בוטל', c: 'bg-red-100 text-red-700' } 
    };

    filteredOrders.forEach(o => {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        const dateStr = new Date(o.created_at).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'});
        const st = statusMap[o.status] || { t: o.status, c: 'bg-slate-100 text-slate-600' };
        const supData = suppliersList.find(s => String(s.id) === String(o.supplier_id)) || {};

        let itemsHtml = items.map(i => {
            const skuStr = i.sku ? `<span class="text-[9px] bg-slate-200 px-1 rounded ml-1 dir-ltr text-slate-500">${i.sku}</span>` : '';
            return `<div class="flex justify-between text-xs border-b border-slate-100 py-2 last:border-0 hover:bg-slate-100 transition px-1"><span class="text-slate-700">${safeStr(i.name)} ${skuStr} <span class="text-[10px] font-bold text-slate-400 ml-1">x${i.quantity}</span></span><span class="font-bold text-slate-800">₪${parseFloat(i.row_total||0).toFixed(2)}</span></div>`;
        }).join('');

        let contactHtml = '';
        if (supData.phone) {
            let cleanPhone = supData.phone.replace(/\D/g,'');
            if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.substring(1);
            contactHtml = `
            <div class="flex gap-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="flex-1 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"><i class="fa-brands fa-whatsapp"></i> וואטסאפ</a>
                <a href="tel:${supData.phone}" class="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"><i class="fa-solid fa-phone"></i> חייג לספק</a>
            </div>`;
        }

        let statusSelectHtml = '';
        if (currentUser.role === 'ADMIN') {
            const statuses = [
                {val: 'sent', label: 'נשלח לספק'},
                {val: 'processing', label: 'בטיפול אצל הספק'},
                {val: 'shipped', label: 'בדרך אלינו'},
                {val: 'delivered', label: 'סופק במלואו'},
                {val: 'cancelled', label: 'בוטל'}
            ];
            let opts = statuses.map(s => `<option value="${s.val}" ${o.status === s.val ? 'selected' : ''}>${s.label}</option>`).join('');
            statusSelectHtml = `<select onchange="updateB2BOrderStatus(${o.id}, this.value)" class="modern-input py-1 px-2 text-[10px] font-bold bg-white border border-slate-200 mt-2 w-full text-center outline-none focus:border-indigo-400 rounded-lg shadow-sm">${opts}</select>`;
        }

        let actionsHtml = `<div class="flex gap-2 mt-3 pt-3 border-t border-slate-100"><button onclick="downloadOrderPDFManual(${o.id})" class="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold transition shadow-sm border border-slate-200"><i class="fa-solid fa-eye"></i> צפה והורד PDF</button>`;
        if (currentUser.role === 'ADMIN' && o.status !== 'delivered' && o.status !== 'cancelled') {
            actionsHtml += `<button onclick="openReceiveGoodsModal(${o.id})" class="flex-[1.5] bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm"><i class="fa-solid fa-box-open"></i> קבלת סחורה</button>`;
        }
        actionsHtml += `</div>`;

        html += `<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4 hover:shadow-md transition">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1 pr-2">
                    <h4 class="font-bold text-slate-800 text-sm flex items-center gap-2"><i class="fa-solid fa-file-invoice text-indigo-400"></i> ${safeStr(o.supplier_name)}</h4>
                    <p class="text-[10px] text-slate-500 mt-1"><i class="fa-regular fa-calendar mr-1"></i> ${dateStr}</p>
                </div>
                <div class="flex flex-col items-end gap-1 w-[140px] shrink-0">
                    <span class="font-black text-slate-900 text-lg dir-ltr">₪${parseFloat(o.total_amount).toFixed(2)}</span>
                    <span class="text-[10px] font-bold ${st.c} px-2 py-1 rounded-md shadow-sm w-full text-center truncate">${st.t}</span>
                    ${statusSelectHtml}
                </div>
            </div>
            <div class="flex justify-start mt-3">
                <button onclick="document.getElementById('b2b-order-items-${o.id}').classList.toggle('hidden'); this.querySelector('i').classList.toggle('fa-chevron-down'); this.querySelector('i').classList.toggle('fa-chevron-up');" 
                        class="px-5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm border border-indigo-100">
                    לחץ לפרטים <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div id="b2b-order-items-${o.id}" class="hidden">
                ${contactHtml}
                <div class="bg-slate-50/50 p-2 rounded-xl border border-slate-100 mt-1 mb-1">${itemsHtml}</div>
                ${actionsHtml}
            </div>
        </div>`;
    });
    
    list.innerHTML = html;
}

async function updateB2BOrderStatus(orderId, status) {
    try {
        const res = await fetch(`${API}/b2b/orders/status`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ orderId, status })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'סטטוס הזמנה עודכן בהצלחה');
            fetchB2BOrders();
        } else {
            showToast('error', data.error || 'שגיאה בעדכון סטטוס');
        }
    } catch(e) { showToast('error', 'שגיאת רשת בעדכון סטטוס'); }
}

// הורדת PDF ידנית מהתצוגה המקדימה 
async function downloadOrderPDFManual(orderId) {
    showToast('info', 'טוען תצוגה מקדימה...');
    const order = b2bOrdersHistory.find(o => String(o.id) === String(orderId)); 
    if(!order) { showToast('error', 'ההזמנה לא נמצאה במאגר'); return; }
    
    const supData = suppliersList.find(s => String(s.id) === String(order.supplier_id)) || {};
    let items = [];
    try { items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; } catch(e) {}
    
    const orderInfo = {
        orderId: order.id,
        supplierName: order.supplier_name || 'ספק כללי', 
        supplierPhone: supData.phone || '',
        supplierEmail: supData.email || '',
        customerNumber: supData.customer_number || '',
        branchName: order.branch_name || '', 
        items: items, 
        totalAmount: parseFloat(order.total_amount) || 0
    };
    
    if (!document.getElementById('pdf-preview-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="pdf-preview-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm hidden z-[100] flex items-center justify-center p-2 sm:p-4">
            <div class="bg-slate-100 w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden border border-slate-200">
                <div class="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
                    <h3 class="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-file-pdf text-red-500"></i> צפייה והורדת הזמנה</h3>
                    <button onclick="document.getElementById('pdf-preview-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-sm border border-slate-200 transition"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center modal-scroll" style="direction: rtl; background-color: #f1f5f9;">
                    <div id="pdf-preview-content" class="bg-white shadow-xl border border-slate-300 w-full max-w-[1040px] mx-auto origin-top transition-all" style="padding: 20px;">
                    </div>
                </div>
                <div class="p-4 sm:p-5 border-t border-slate-200 bg-white flex gap-3 justify-end items-center shrink-0" style="direction: rtl;">
                    <button onclick="document.getElementById('pdf-preview-modal').classList.add('hidden')" class="px-4 sm:px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition text-sm sm:text-base">ביטול</button>
                    <button id="btn-actual-download-pdf" class="px-5 sm:px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 text-sm sm:text-base">הורד מסמך <i class="fa-solid fa-download"></i></button>
                </div>
            </div>
        </div>
        `);
    }

    const contentDiv = document.getElementById('pdf-preview-content');
    contentDiv.innerHTML = getOrderHtmlTemplate(orderInfo);
    
    document.getElementById('pdf-preview-modal').classList.remove('hidden');

    const btnDownload = document.getElementById('btn-actual-download-pdf');
    
    btnDownload.onclick = async () => {
        btnDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מכין קובץ...';
        btnDownload.disabled = true;
        
        try {
            const isLoaded = await loadHtml2Pdf();
            if (!isLoaded) throw new Error('PDF library failed to load');

            const safeSupplierName = safeStr(order.supplier_name).replace(/[^a-zA-Zא-ת0-9]/g, '_');
            const safeClientName = safeStr(currentGroup.name).replace(/[^a-zA-Zא-ת0-9]/g, '_');
            const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
            
            const pdfContainer = document.createElement('div');
            pdfContainer.innerHTML = getOrderHtmlTemplate(orderInfo);
            
            // שינוי הגדרות מיקום כדי למנוע את זריקת המסמך הצידה ב-PDF
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.top = '0';
            pdfContainer.style.left = '0';
            pdfContainer.style.right = '0';
            pdfContainer.style.margin = 'auto';
            pdfContainer.style.width = '1040px'; 
            pdfContainer.style.zIndex = '-100'; 
            pdfContainer.style.opacity = '0.99';
            pdfContainer.style.backgroundColor = '#ffffff';
            pdfContainer.style.height = 'max-content';
            document.body.appendChild(pdfContainer);

            const opt = { 
                margin: [10, 10, 10, 10], 
                filename: `הזמנת_רכש_מס_${order.id}_${safeClientName}_${safeSupplierName}_${dateStr}.pdf`, 
                image: { type: 'jpeg', quality: 1 }, 
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    width: pdfContainer.offsetWidth, // קריטי ליישור נכון
                    scrollY: 0,
                    height: pdfContainer.scrollHeight, 
                    windowHeight: pdfContainer.scrollHeight 
                }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            setTimeout(() => {
                html2pdf().set(opt).from(pdfContainer).save().then(() => {
                    if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
                    showToast('success', 'הורדת המסמך הושלמה בהצלחה!');
                    document.getElementById('pdf-preview-modal').classList.add('hidden');
                    btnDownload.innerHTML = 'הורד מסמך <i class="fa-solid fa-download"></i>';
                    btnDownload.disabled = false;
                }).catch(err => {
                    if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
                    showToast('error', 'שגיאה ביצירת מסמך PDF. נסה שוב.');
                    btnDownload.innerHTML = 'הורד מסמך <i class="fa-solid fa-download"></i>';
                    btnDownload.disabled = false;
                });
            }, 500);
            
        } catch(e) {
            console.error('PDF Error:', e);
            showToast('error', 'שגיאה כללית בהפקה.');
            btnDownload.innerHTML = 'הורד מסמך <i class="fa-solid fa-download"></i>';
            btnDownload.disabled = false;
        }
    };
}

// הוספת מזהה גרסה בתחתית המסך (ללא fixed)
(function addVersionBadge() {
    if (!document.getElementById('oneflow-version-badge')) {
        const badge = document.createElement('div');
        badge.id = 'oneflow-version-badge';
        badge.innerHTML = 'גרסה 1.0.9 (תיקון כיווניות עברית)';
        // שינינו ל-relative כדי שלא ידבק (סטטי בתחתית המסמך)
        badge.className = 'w-full text-center mt-8 pb-4 text-slate-400 text-xs font-mono';
        document.body.appendChild(badge);
    }
})();
