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

// --- נגישות ---
function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = getEl(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { getEl('accessibility-modal').classList.remove('hidden'); }
function closeAccessibilityModal() { getEl('accessibility-modal').classList.add('hidden'); }

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
    const btn = document.querySelector('button[onclick="saveAllBanners()"]');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> שומר נתונים...'; }
    try {
        await fetch(`${API}/superadmin/settings`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ 
                welcomeMsg: val('sa-welcome-msg'), 
                businessWelcomeMsg: val('sa-biz-welcome-msg') 
            }) 
        });

        const res = await fetch(`${API}/superadmin/banners`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ 
                topText: val('sa-banner-top-text'), topLink: val('sa-banner-top-link'), topImg: val('sa-banner-top-img'), 
                bottomText: val('sa-banner-bottom-text'), bottomLink: val('sa-banner-bottom-link'), bottomImg: val('sa-banner-bottom-img'), 
                bizTopText: val('sa-biz-banner-top-text'), bizTopLink: val('sa-biz-banner-top-link'), bizTopImg: val('sa-biz-banner-top-img'), 
                bizBottomText: val('sa-biz-banner-bottom-text'), bizBottomLink: val('sa-biz-banner-bottom-link'), bizBottomImg: val('sa-biz-banner-bottom-img') 
            }) 
        });
        
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'הודעות הפתיחה והבאנרים נשמרו בהצלחה!'); 
            fetchBanners(); 
        } else { 
            showToast('error', data.error || 'שגיאה בשמירת הבאנרים'); 
        }
    } catch(e) { 
        showToast('error', 'תקלת רשת מול השרת'); 
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save mr-2"></i> שמור נתונים ופרסם באנרים למערכת'; }
    }
}

async function saveWelcomeMsg(type = 'BUSINESS') { 
    const body = type === 'BUSINESS' ? { businessWelcomeMsg: val('sa-biz-welcome-msg') } : { welcomeMsg: val('sa-welcome-msg') };
    try { 
        await fetch(`${API}/superadmin/settings`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify(body) 
        }); 
        showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!'); 
    } catch(e) { 
        showToast('error', 'שגיאה בשמירת ההודעה'); 
    }
}

function applyBannersToDOM(banners) {
    const appTop = getEl('app-banner-top'); const appBottom = getEl('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img && img.trim() !== '') { 
                const imgSrc = img.startsWith('http') ? img : `/${img}`; 
                html += `<img src="${imgSrc}" alt="Banner" class="w-full h-auto max-h-32 object-cover block">`; 
            }
            if(text && text.trim() !== '') { 
                html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            }
            el.innerHTML = html; 
            el.href = (link && link.trim() !== '') ? link : '#'; 
            if(!link || link.trim() === '') { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); 
    renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_biz_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_biz_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
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

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { getEl('welcome-modal-text').innerText = data.message; setupPwaInstallSection(); getEl('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
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
                if (currentUser.role === 'ADMIN') {
                    if (typeof startManagerTour === 'function') startManagerTour(); else startEmployeeTour();
                } else {
                    startEmployeeTour(); 
                }
            } else {
                switchTab('feed');
            }
        } catch(e) { switchTab('feed'); } 
    }, 1000); 
}

function triggerManualTour() { getEl('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') { if(typeof startManagerTour === 'function') startManagerTour(); else startEmployeeTour(); } else startEmployeeTour(); }, 300); }

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
}

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflowlife Pro! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו העסק שלכם מתנהל." },
            { element: '#tour-header', title: "מרכז השליטה שלכם", intro: "כאן תמצאו את קוד הארגון. לחיצה על תפריט תפתח את ההגדרות.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "המערכת מונעת ע\"י familAI. כאן תוכלו לראות את כמות הפעולות שנותרה.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק הארגוני 💳", intro: "כאן תוכלו לראות את היתרה הפנויה של העסק בזמן אמת.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "רישום הוצאה או הכנסה מכל מקום באפליקציה.", position: 'top' },
            { element: '#tab-shop', title: "רכש ארגוני 🛒", intro: "ריכוז דרישות הרכש של העובדים, סריקת קבלות חכמה ואישור הזמנות מספקים.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "מעקב בזמן אמת אחרי ציוד משרדי וחומרי גלם. ה-AI יזהיר אתכם כשמשהו עומד להיגמר.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים והחזרים 🏦", intro: "סגירת חודש בקליק, הגדרת תקציבי פעילות לצוות ואישור החזרי הוצאות.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות וטיקטים ✅", intro: "הגדירו פרויקטים, וה-AI יעזור לפרק אותם למשימות. קבלו דיווחי ביצוע מצולמים.", position: 'bottom' },
            { element: '#tab-academy', title: "מרכז הכשרות 🎓", intro: "צרו חפיפות מבוססות AI, רעננו נהלים וקבעו תמריצים למצטיינים.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות מחלקתיים. familAI תנתח ותספק תובנות עסקיות לחיסכון.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "צפו בהכנסות והוצאות עתידיות קבועות ותכננו את תזרים המזומנים קדימה.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות 👨‍👩‍👧‍👦", intro: "נהלו את הצוות, קבעו הרשאות צפייה מדויקות לכל עובד ושלחו הזמנות בוואטסאפ.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
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
    ['feed','timeclock','shifts','shop','sales','pantry','bank','cashflow','budget','forecast','tasks','academy','community','members'].forEach(x => { 
        const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const targetContent = getEl(`content-${t}`); if(targetContent) targetContent.classList.remove('hidden'); 
    const targetBtn = getEl(`tab-${t}`); if(targetBtn) targetBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); const fab = getEl('fab-container'); if(fab) fab.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
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
            console.warn("No active user or group found, redirecting to login...");
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.classList.remove('hidden');
            return;
        }

        const authContainer = getEl('auth-container'); if (authContainer) authContainer.classList.add('hidden');
        try { if(typeof injectBusinessUI === 'function') injectBusinessUI(); } catch(e) {}
        
        const dashContainer = getEl('dashboard-container'); if(dashContainer) dashContainer.classList.remove('hidden'); 
        const fabContainer = getEl('fab-container'); if(fabContainer) fabContainer.classList.remove('hidden');
        
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
        
        // טעינת באנרים במסך העסק!
        try { fetchBanners(); } catch(e){}

        if(!pollInterval) { pollInterval = setInterval(() => { try{ fetchData(); } catch(e){} try{ if(typeof fetchLoans === 'function') fetchLoans(); } catch(e){} if(isAdmin) { try{ if(typeof fetchPendingUsers === 'function') fetchPendingUsers(); } catch(e){} } }, 30000); }
        
        try { if(typeof fetchMembers === 'function') await fetchMembers(); } catch(e){}
        if(isAdmin) { try { if(typeof fetchPendingUsers === 'function') fetchPendingUsers(); } catch(e){} }
        try { await fetchData(); } catch(e){}
        try { if(typeof fetchLoans === 'function') await fetchLoans(); } catch(e){}
        try { if(typeof checkTimeclockStatus === 'function') await checkTimeclockStatus(); } catch(e){}

    } catch (e) {
        console.error("Dashboard error:", e);
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => { 
            try {
                const showedWelcome = await checkGlobalWelcome(); 
                if (!showedWelcome) { 
                    checkAndStartTour(forceTourStart); 
                    forceTourStart = false; 
                }
            } catch(e) {
                checkAndStartTour(forceTourStart);
            }
        };
        if (preloader && !preloader.classList.contains('hidden')) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => { 
                preloader.classList.add('hidden'); 
                finalizeLoad(); 
            }, 700); 
        } else { 
            finalizeLoad(); 
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
        // רענון אוטומטי של הרשימה למטה בכל פעם שהסטטוס נבדק
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
        const res = await fetch(reqUrl); let data = await res.json();
        
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

function exportTimeclockPDF() {
    const element = getEl('pdf-report-content');
    if(!element) return showToast('error', 'אין נתונים לייצוא');
    
    showToast('info', 'מייצר קובץ PDF...');
    const period = getEl('tc-month-filter') ? getEl('tc-month-filter').options[getEl('tc-month-filter').selectedIndex].text : 'כל התקופה';
    const userName = currentUser.role === 'ADMIN' ? (getEl('tc-user-filter') ? getEl('tc-user-filter').options[getEl('tc-user-filter').selectedIndex].text : 'כל העובדים') : currentUser.nickname;
    const filename = `Report_${userName}_${period}.pdf`.replace(/ /g, '_');
    
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
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        
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
                    
                    c.innerHTML += `<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${safeStr(m.nickname) || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${m.role === 'ADMIN' ? 'מנהל' : 'עובד'})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg ml-2">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminPermsBtn}${adminDeleteBtn}</div></div>`; 
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
                    
                    a.innerHTML += `
                    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-sm">${safeStr(m.nickname) || 'עובד'}</h4>
                                <p class="text-[10px] text-slate-400">תעריף: ₪${m.allowance_amount || 0}/שעה • מינימום: ${m.interest_rate || 0} ש'</p>
                                <p class="text-xs font-bold text-slate-700 mt-1">תקציב נוכחי: <span class="text-slate-800">₪${m.balance || 0}</span></p>
                            </div>
                        </div>
                        <div class="flex gap-1 sm:gap-2">
                            <button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${m.role}', '${permsStr}')" class="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center transition" title="הרשאות וגישה"><i class="fa-solid fa-user-shield text-sm"></i></button>
                            
                            <button onclick="openBalanceAdjustmentModal(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="תיקון/בונוס"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button>
                            <button onclick="openBankSettings(${m.id}, '${safeStr(m.nickname)}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button>
                            <button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button>
                        </div>
                    </div>`; 
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

        const res = await fetch(`${API}/data/${currentUser.id}`);
        
        let data;
        try { data = await res.json(); } catch(err) { console.error("Failed to parse JSON", err); return; }
        
        if (!res.ok) { console.error("Backend Error:", data.error); return; }
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
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
                const realBalance = data.group.admin_total_balance || 0;
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

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { if(typeof renderTasks === 'function') renderTasks(allTasks); if(typeof renderPantry === 'function') renderPantry(); if(typeof renderShifts === 'function') renderShifts(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; if(typeof renderShopList === 'function') renderShopList(); } catch(e) {}
        try { if(typeof fetchBudget === 'function') fetchBudget(); } catch(e) {}
        try { if(typeof renderForecast === 'function') renderForecast(); } catch(e) {}
        
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
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { if (typeof renderEmployeeTodo === 'function') renderEmployeeTodo(); if (typeof buildAndRenderFeed === 'function') buildAndRenderFeed(); const cashTab = document.getElementById('tab-cashflow'); if (cashTab && cashTab.classList.contains('tab-active') && typeof renderCashflow === 'function') renderCashflow(); } catch(e){}
        try { if (typeof loadBizCommunities === 'function') loadBizCommunities(); } catch(e) {} 

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

// ======================================
// הוספה וגריעה חכמה מהמזווה (כולל שברים)
// ======================================

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
    if(subTab === 'marketing') fetchStoreCoupons();
    if(subTab === 'settings') fetchStoreSettings();
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
    if (preset) { currentModifiersUI.push(JSON.parse(JSON.stringify(preset))); renderModifiersUI(); } // Deep copy
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
        getEl('sp-id').value = p.id; getEl('sp-name').value = p.name; getEl('sp-price').value = p.price; getEl('sp-category').value = p.category || ''; getEl('sp-desc').value = p.description || ''; getEl('sp-image-base64').value = p.image_url || '';
        
        if(getEl('sp-badge-text')) getEl('sp-badge-text').value = p.badge_text || ''; 
        if(getEl('sp-badge-color')) getEl('sp-badge-color').value = p.badge_color || 'red';
        
        if (p.image_url) { getEl('sp-image-preview').src = p.image_url; getEl('sp-image-preview').classList.remove('hidden'); getEl('sp-image-placeholder').classList.add('hidden'); } else { getEl('sp-image-preview').classList.add('hidden'); getEl('sp-image-placeholder').classList.remove('hidden'); }
        
        if (p.options_text) {
            try { currentModifiersUI = JSON.parse(p.options_text); } catch(e) { currentModifiersUI = []; }
        }
    } else {
        getEl('sp-id').value = ''; getEl('sp-name').value = ''; getEl('sp-price').value = ''; getEl('sp-category').value = ''; getEl('sp-desc').value = ''; getEl('sp-image-base64').value = ''; getEl('sp-image-preview').src = ''; getEl('sp-image-preview').classList.add('hidden'); getEl('sp-image-placeholder').classList.remove('hidden');
        
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
            groupId: currentGroup.id, name, price, category: val('sp-category'), description: val('sp-desc'), optionsText: finalOptionsText, imageUrl: val('sp-image-base64') || null,
            badgeText: val('sp-badge-text') || '', badgeColor: val('sp-badge-color') || 'red'
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
    } catch(e) { console.error("Error loading SA Communities", e); }
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
// === סוף הקובץ ===
