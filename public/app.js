// Oneflow Life - Unified Engine (Families & Businesses)

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
let timeclockReportCache = [];
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

const isBizApp = () => currentGroup && currentGroup.type === 'BUSINESS';

const famCATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'}, {value:'other',label:'💸 אחר'} ], 
    expense: [ {value:'food',label:'🍔 מסעדות וטייקאווי'}, {value:'groceries',label:'🛒 סופר ופארם'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך וחוגים'}, {value:'vacation',label:'✈️ חופשות וטיולים'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} ] 
};
const bizCATEGORIES = { 
    income: [ {value:'sales',label:'📈 מכירות והכנסות'}, {value:'investment',label:'💰 השקעה / מימון'}, {value:'refund',label:'🔄 זיכוי / החזר'}, {value:'other',label:'💸 אחר'} ], 
    expense: [ {value:'office',label:'📎 ציוד משרדי'}, {value:'software',label:'💻 תוכנה ושירותים'}, {value:'marketing',label:'🎯 שיווק ופרסום'}, {value:'salary',label:'💼 שכר ומשכורות'}, {value:'travel',label:'✈️ נסיעות ורכבים'}, {value:'rent',label:'🏢 שכירות ותחזוקה'}, {value:'food',label:'☕ כיבוד ומטבחון'}, {value:'other',label:'💸 הוצאה תפעולית אחרת'} ] 
};

const famBUDGET_LABELS = { 'food': '🍔 מסעדות', 'groceries': '🛒 סופר ופארם', 'transport': '🚌 תחבורה ודלק', 'home': '🏠 דיור ותחזוקה', 'bills': '📄 חשבונות ותקשורת', 'fun': '🎉 פנאי ובילויים', 'clothes': '👕 ביגוד והנעלה', 'health': '💊 בריאות וביטוחים', 'education': '📚 חינוך וחוגים', 'vacation': '✈️ חופשות', 'pets': '🐶 חיות מחמד', 'gifts': '🎁 מתנות ותרומות', 'other': '💸 אחר', 'allocations': '👶 הפרשות כלליות', 'allowance': '💰 דמי כיס לילדים', 'tasks': '✅ תגמול על משימות', 'academy': '🎓 אתגרי אקדמיה', 'savings': '🐖 הפקדות לחיסכון' };
const bizBUDGET_LABELS = { 'office': '📎 ציוד משרדי', 'software': '💻 תוכנה ורישיונות', 'marketing': '🎯 שיווק', 'salary': '💼 שכר ובונוסים', 'travel': '✈️ נסיעות', 'rent': '🏢 שכירות', 'food': '☕ מטבחון', 'other': '💸 שונות', 'allowance': '💰 תקציב מחלקות', 'tasks': '✅ תגמול פרויקטים', 'academy': '🎓 הכשרות', 'savings': '🐖 עתודות וחיסכון' };

const famPRODUCT_DB = { 
    "ירקות ופירות 🍎": ["עגבניות", "מלפפונים", "פלפל אדום", "בצל יבש", "תפוחי אדמה", "בננות", "לימון", "תפוח עץ", "אבוקדו"], 
    "חלב וביצים 🥛": ["חלב 3%", "קוטג' 5%", "גבינה לבנה 5%", "גבינה צהובה", "ביצים L", "יוגורט", "חמאה", "שמנת"], 
    "לחם ומאפים 🍞": ["לחם אחיד", "לחם מלא", "פיתות", "לחמניות"], 
    "מזווה ובישול 🍝": ["אורז", "פסטה", "פתיתים", "עדשים", "שמן זית", "שמן קנולה", "סוכר", "מלח", "קמח", "קפה", "תה"], 
    "בשר ודגים 🍗": ["חזה עוף", "בשר טחון", "שניצל", "נקניקיות", "סלמון"], 
    "ניקיון וטואלטיקה 🧻": ["נייר טואלט", "מגבונים", "נוזל כלים", "אבקת כביסה", "שמפו", "משחת שיניים"], 
    "חטיפים ומתוקים 🍫": ["במבה", "ביסלי", "בייגלה", "עוגיות", "שוקולד"] 
};
const bizPRODUCT_DB = { 
    "ציוד משרדי 📎": ["נייר צילום A4", "עטים", "קלסרים", "מרקרים", "שדכן", "סיכות לשדכן", "דפדפות", "מעטפות", "פתקיות ממו"], 
    "מחשוב וטכנולוגיה 💻": ["עכבר אלחוטי", "מקלדת", "מסך מחשב", "כבל HDMI", "כבל רשת", "מטען למחשב נייד", "אוזניות", "דיסק און קי"], 
    "מטבחון וכיבוד ☕": ["קפה שחור", "קפה נמס", "קפסולות קפה", "חלב", "חלב סויה", "חלב שיבולת שועל", "סוכר", "סוכרזית", "תה", "עוגיות", "כוסות נייר"], 
    "ניקיון ותחזוקה 🧻": ["נייר טואלט", "נייר סופג", "נוזל כלים", "סבון ידיים", "מטליות לניקוי", "שקיות זבל"], 
    "שונות / חומרי גלם 📦": ["מארז קרטונים", "סלוטייפ", "מספריים"] 
};

const getCategories = () => isBizApp() ? bizCATEGORIES : famCATEGORIES;
const getBudgetLabels = () => isBizApp() ? bizBUDGET_LABELS : famBUDGET_LABELS;
const getProductDB = () => isBizApp() ? bizPRODUCT_DB : famPRODUCT_DB;
const getFlatProducts = () => { const db = getProductDB(); const flat = []; for (const [cat, items] of Object.entries(db)) { items.forEach(i => flat.push({ name: i, category: cat })); } return flat; };

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
                currentUser = session.user; currentGroup = session.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

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
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid fa-users"></i></div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${typeBadge} ${isPro}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens}</p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2">${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק משפחה/ארגון</button></div></div>${uHtml}</div></div>`;
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
        const type = currentGroup ? currentGroup.type : 'FAMILY';
        const cached = localStorage.getItem(`ofl_banners_${type}`); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=${type}`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem(`ofl_banners_${type}`, JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function checkGlobalWelcome() {
    try {
        const type = currentGroup ? currentGroup.type : 'FAMILY';
        const res = await fetch(`${API}/settings/welcome?type=${type}`); const data = await res.json();
        const modalText = document.getElementById('welcome-modal-text');
        if (data.message && data.message.trim() !== '' && modalText) {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { modalText.innerText = data.message; setupPwaInstallSection(); document.getElementById('welcome-modal').classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') { if(isBizApp()) startManagerTour(); else startAdminTour(); } else { if(isBizApp()) startEmployeeTour(); else startChildTour(); } } } catch(e) {} }, 1000); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') { if(isBizApp()) startManagerTour(); else startAdminTour(); } else { if(isBizApp()) startEmployeeTour(); else startChildTour(); } }, 300); }

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
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תוכלו לראות בזמן אמת את היתרה הפנויה של המשפחה, כך שתמיד תדעו בדיוק איפה אתם עומדים.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "לחיצה קטנה על כפתור הפלוס מאפשרת לכם לרשום הוצאה או הכנסה מכל מקום באפליקציה.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "הסוף לקבוצות וואטסאפ מבולגנות! רשימת קניות משותפת לכולם.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "הגדירו דמי כיס שבועיים אוטומטיים לילדים, חלקו ריביות על חסכונות ולמדו אותם לנהל כסף.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות חודשיים לכל קטגוריה. familAI תנתח את ההוצאות שלכם.", position: 'bottom' },
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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים.", position: 'bottom' },
            { element: '#user-balance', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "לחיצה על כפתור הפלוס מאפשרת לכם לרשום הוצאה, הכנסה או לאשר בקשת רכש מכל מקום.", position: 'top' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "ניהול ומעקב אחר שעות עבודה של הצוות, כולל הפקת דוחות חודשיים.", position: 'bottom' },
            { element: '#tab-shop', title: "ניהול רכש 🛒", intro: "עובדים פותחים דרישות רכש, והמנהל מאשר, מפיק הזמנה ומעדכן את התקציב.", position: 'bottom' },
            { element: '#tab-bank', title: "תקציבים ובונוסים 🏦", intro: "נהלו תקציבי מחלקות, קופות קטנות ובונוסים לעובדים.", position: 'bottom' }
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
            { element: '#user-balance', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים.", position: 'bottom' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "החתמת כניסה ויציאה ממשמרת בפורטל שלך מתבצעת כאן.", position: 'bottom' },
            { element: '#tab-shop', title: "בקשות רכש 🛒", intro: "חסר ציוד משרדי או מחשוב? פתח דרישת רכש כאן, והיא תעבור לאישור ההנהלה.", position: 'bottom' }
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
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } } 
}

async function handleCreate(e) { 
    e.preventDefault(); if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; 
    const btn = document.getElementById('btn-create-text'); const ldr = document.getElementById('btn-create-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try { 
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } } 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const btn = document.getElementById('btn-join-text'); const ldr = document.getElementById('btn-join-loader');
    if(btn && ldr) { btn.classList.add('hidden'); ldr.classList.remove('hidden'); }
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d = await res.json(); 
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { if(btn && ldr) { btn.classList.remove('hidden'); ldr.classList.add('hidden'); } }
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const tContent = document.getElementById(`content-${t}`); if(tContent) tContent.classList.remove('hidden'); 
    const tBtn = document.getElementById(`tab-${t}`); if(tBtn) tBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') { try { renderPantry(); } catch(e) {} } 
    if (t === 'recipes' && !isBizApp()) { try { renderRecipePantrySelection(); } catch(e) {} } 
    if (t === 'forecast') { try { renderForecast(); } catch(e) {} } 
    if (t === 'cashflow') { try { renderCashflow(); } catch(e) {} }
    if (t === 'timeclock' && isBizApp()) { try { fetchTimeclockStatus(); fetchTimeclockReport(); } catch(e) {} }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200', 'bg-slate-800', 'text-white', 'border-transparent', 'bg-gradient-to-r', 'from-indigo-500', 'to-purple-500');
    if (currentGroup.is_premium) { 
        indicator.innerHTML = '⚡ ∞ (Pro)'; 
        if(isBizApp()) indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent');
        else indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent');
    } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

async function loadDashboard() {
    const isBiz = isBizApp();
    if(isBiz) document.body.classList.add('is-business'); else document.body.classList.remove('is-business');

    const authCont = document.getElementById('auth-container'); if(authCont) authCont.classList.add('hidden'); 
    const dashCont = document.getElementById('dashboard-container'); if(dashCont) dashCont.classList.remove('hidden'); 
    const fabCont = document.getElementById('fab-container'); if(fabCont) fabCont.classList.remove('hidden');

    const dashGroupName = document.getElementById('dash-group-name');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono ${isBiz?'bg-slate-200 text-slate-800':'bg-blue-100 text-blue-600'} px-2 py-0.5 rounded-full mr-2 tracking-widest">${isBiz?'קוד ארגון':'קוד משפחה'}: ${currentGroup.group_code}</span>` : '';
    if (dashGroupName) dashGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
    
    const dashNickname = document.getElementById('dash-nickname');
    if (dashNickname) dashNickname.innerText = currentUser.nickname; 

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${isBiz?'בקשות רכש לאישור':'ממתינים לאישור'}`;
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold ${isBiz?'text-slate-800':'text-green-600'} text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> מסלול PRO פעיל</p>`; }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        const cardName = document.getElementById('card-name'); if (cardName) cardName.innerText = currentUser.nickname.toUpperCase(); 
        const cardAllow = document.getElementById('card-allowance'); if (cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
        const cardInt = document.getElementById('card-interest'); if (cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${isBiz?'בקשות הרכש שלי':'הבקשות שלי לקניות'}`;
    }
    const btnAddBud = document.getElementById('btn-add-budget-cat'); if(btnAddBud) btnAddBud.classList.remove('hidden'); 
    updateBatteryUI();
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isBizApp()) fetchTimeclockStatus(); if(currentUser.role === 'ADMIN') fetchPendingUsers(); }, 30000);
        fetchBanners(); 
        await fetchMembers(); 
        if(currentUser.role === 'ADMIN') fetchPendingUsers(); 
        await fetchData(); 
        fetchLoans(); 
        if(isBizApp()) { fetchTimeclockStatus(); fetchTimeclockReport(); }
    } catch (e) {
        console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
    }
}

// --- TIME CLOCK FUNCTIONS ---
async function fetchTimeclockStatus() {
    if(!isBizApp()) return;
    try {
        const res = await fetch(`${API}/timeclock/status?userId=${currentUser.id}`);
        const data = await res.json();
        
        const btn = document.getElementById('btn-punch');
        const text = document.getElementById('punch-text');
        const icon = document.getElementById('punch-icon');
        const statusText = document.getElementById('timeclock-status-text');
        if(!btn || !text || !icon || !statusText) return;
        
        btn.classList.remove('cursor-not-allowed', 'bg-slate-200', 'text-slate-400');
        
        if (data.isPunchedIn) {
            btn.className = 'w-40 h-40 rounded-full font-bold text-2xl flex flex-col items-center justify-center gap-2 transition transform hover:scale-105 punch-btn-out punch-pulse';
            text.innerText = 'סיום משמרת';
            icon.className = 'fa-solid fa-stopwatch text-4xl mb-1';
            const punchTime = new Date(data.punchInTime);
            const timeStr = punchTime.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
            statusText.innerHTML = `פעיל במשמרת החל מ- <span class="text-emerald-600">${timeStr}</span>`;
        } else {
            btn.className = 'w-40 h-40 rounded-full font-bold text-2xl flex flex-col items-center justify-center gap-2 transition transform hover:scale-105 punch-btn-in';
            text.innerText = 'כניסה למשמרת';
            icon.className = 'fa-solid fa-fingerprint text-4xl mb-1';
            statusText.innerText = 'לא במשמרת כעת';
        }
    } catch(e) { console.error('Error fetching timeclock status:', e); }
}

async function togglePunch() {
    const btn = document.getElementById('btn-punch');
    if (!btn || btn.classList.contains('cursor-not-allowed')) return;
    
    btn.classList.add('cursor-not-allowed', 'opacity-80');
    try {
        const res = await fetch(`${API}/timeclock/punch`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id })
        });
        const data = await res.json();
        if (data.success) {
            if (data.status === 'in') { showToast('success', 'החתמת כניסה נקלטה בהצלחה!'); triggerConfetti(); } else { showToast('success', 'משמרת הסתיימה בהצלחה!'); }
            await fetchTimeclockStatus();
            fetchTimeclockReport();
        }
    } catch(e) { showToast('error', 'שגיאה בהחתמת שעון'); }
    finally { if(btn) btn.classList.remove('cursor-not-allowed', 'opacity-80'); }
}

async function fetchTimeclockReport() {
    if(!isBizApp()) return;
    try {
        const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
        const res = await fetch(`${API}/timeclock/report?groupId=${currentGroup.id}&userId=${queryUserId}`);
        if(res.ok) {
            timeclockReportCache = await res.json();
            if (currentUser.role === 'ADMIN') {
                const userFilter = document.getElementById('tc-user-filter');
                if (userFilter && userFilter.options.length <= 1) { 
                    userFilter.innerHTML = '<option value="all">כל העובדים</option>';
                    membersCache.forEach(m => { userFilter.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; });
                }
            }
            renderTimeclockReport();
        }
    } catch(e) { console.error('Error fetching timeclock report:', e); }
}

function renderTimeclockReport() {
    const list = document.getElementById('timeclock-list');
    if (!list) return;
    
    const userFilterEl = document.getElementById('tc-user-filter');
    const dateFilterEl = document.getElementById('tc-date-filter');
    const userFilter = userFilterEl ? userFilterEl.value : 'all';
    const dateFilter = dateFilterEl ? dateFilterEl.value : 'month';
    
    let filtered = timeclockReportCache;
    
    if (currentUser.role !== 'ADMIN') {
        filtered = timeclockReportCache.filter(t => String(t.user_id) === String(currentUser.id));
        if (userFilterEl) userFilterEl.classList.add('hidden');
    } else {
        if (userFilterEl) userFilterEl.classList.remove('hidden');
        if (userFilter !== 'all' && userFilter !== '') { filtered = timeclockReportCache.filter(t => String(t.user_id) === String(userFilter)); }
    }
    
    const now = new Date();
    if (dateFilter === 'month') {
        filtered = filtered.filter(t => new Date(t.punch_in).getMonth() === now.getMonth() && new Date(t.punch_in).getFullYear() === now.getFullYear());
    } else if (dateFilter === 'prev_month') {
        let prevMonth = now.getMonth() - 1; let year = now.getFullYear(); if (prevMonth < 0) { prevMonth = 11; year--; }
        filtered = filtered.filter(t => new Date(t.punch_in).getMonth() === prevMonth && new Date(t.punch_in).getFullYear() === year);
    } else if (dateFilter === 'year') {
        filtered = filtered.filter(t => new Date(t.punch_in).getFullYear() === now.getFullYear());
    }
    
    let totalMinutes = 0;
    
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">אין נתוני נוכחות לתקופה זו.</p>';
        const totalEl = document.getElementById('tc-total-hours'); if(totalEl) totalEl.innerText = '00:00';
        return;
    }
    
    let html = '';
    filtered.forEach(t => {
        totalMinutes += (t.total_minutes || 0);
        const inDate = new Date(t.punch_in);
        const inStr = `${inDate.toLocaleDateString('he-IL')} ${inDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
        let outStr = 'משמרת פעילה';
        if (t.punch_out) {
            const outDate = new Date(t.punch_out); outStr = outDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
            if (inDate.toLocaleDateString() !== outDate.toLocaleDateString()) { outStr = `${outDate.toLocaleDateString('he-IL')} ${outStr}`; }
        }
        const hours = Math.floor((t.total_minutes || 0) / 60); const mins = (t.total_minutes || 0) % 60;
        const timeStr = t.punch_out ? `${hours}ש' ${mins}ד'` : '--';
        const userName = currentUser.role === 'ADMIN' && t.nickname ? `<span class="text-[9px] bg-slate-200 px-1.5 rounded text-slate-600 mr-2">${t.nickname}</span>` : '';
        html += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-slate-200 transition"><div><p class="font-bold text-slate-700 text-sm flex items-center"><i class="fa-solid fa-clock text-slate-400 ml-1.5"></i> ${inStr} ${userName}</p><p class="text-[10px] text-slate-500 mt-1">יציאה: ${outStr}</p></div><div class="text-center"><span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">${timeStr}</span></div></div>`;
    });
    
    list.innerHTML = html;
    const tHours = Math.floor(totalMinutes / 60); const tMins = totalMinutes % 60;
    const totalEl = document.getElementById('tc-total-hours'); if(totalEl) totalEl.innerText = `${String(tHours).padStart(2, '0')}:${String(tMins).padStart(2, '0')}`;
}

window.openBalanceAdjustmentModal = function(id, name) { document.getElementById('adjustment-user-id').value = id; document.getElementById('adjustment-user-name').innerText = `עבור: ${name}`; document.getElementById('adjustment-amount').value = ''; document.getElementById('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); document.getElementById('balance-adjustment-modal').classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const isBiz = isBizApp();
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? (isBiz?'בונוס/מענק':'בונוס מההורה') : (isBiz?'הפחתה תפעולית':'הפחתה יזומה'));
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'עודכן בהצלחה!'); document.getElementById('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const isBiz = isBizApp();
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user'); const cfF = document.getElementById('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">${isBiz?'כלל הארגון':'כל הבית'}</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">${isBiz?'כל העובדים':'כל המשפחה'}</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">${isBiz?'כל העובדים':'כל המשפחה'}</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">${isBiz?'עבור איזה צוות/עובד?':'עבור מי היעד?'}</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = document.getElementById('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 ${isBiz?'bg-slate-100 text-slate-500 border-white':'bg-slate-100 text-slate-500 border-2 border-white'} rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${m.role === 'ADMIN' ? (isBiz?'מנהל':'מנהל') : (isBiz?'עובד':'ילד')})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = document.getElementById('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = `<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ${isBiz?'עובדים':'ילדים'} רשומים ${isBiz?'בארגון':'במשפחה'}.</p>`;
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 ${isBiz?'bg-slate-100 text-slate-600':'bg-indigo-50 text-indigo-600'} rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || (isBiz?'עובד':'ילד')}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/${isBiz?'חודש':'שבוע'} • ${m.interest_rate || 0}% ${isBiz?'תמריץ':'ריבית'}</p><p class="text-xs font-bold text-slate-700 mt-1">${isBiz?'תקציב נוכחי':'יתרה'}: <span class="${isBiz?'text-slate-800':'text-blue-600'}">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full ${isBiz?'bg-slate-100 hover:bg-slate-200 text-slate-600':'bg-blue-50 hover:bg-blue-100 text-blue-500'} flex items-center justify-center transition" title="${isBiz?'תיקון/בונוס':'קנס/בונוס'}"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מכין ושולח...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; 
        if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); 
        const data = await res.json();
        if (!data || !data.user) return;
        
        const isBiz = isBizApp();
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold ${isBiz?'text-slate-800':'text-green-600'} text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> מסלול PRO פעיל</p>`; }
        }

        const balEl = document.getElementById('user-balance');
        if (balEl) {
            if (currentUser.role === 'ADMIN') {
                const totalAdminBalance = membersCache.filter(m => m.role === 'ADMIN').reduce((sum, m) => sum + (parseFloat(m.balance) || 0), 0);
                balEl.innerText = `₪${totalAdminBalance}`;
            } else {
                balEl.innerText = `₪${currentUser.balance || 0}`;
            }
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; 
        bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; 
        pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) { console.error('Render Academy Error:', e); }
        try { renderTasks(allTasks); renderPantry(); if(!isBiz) renderRecipePantrySelection(); } catch(e) { console.error('Render Tasks/Pantry Error:', e); }
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) { console.error('Render Shop Error:', e); }
        try { fetchBudget(); } catch(e) { console.error('Fetch Budget Error:', e); }
        try { renderForecast(); } catch(e) { console.error('Render Forecast Error:', e); }
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); 
            const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; 
                        const adviseBtn = `<button onclick="${isBiz?'getBusinessAIAdvice':'getFamilAIAdvice'}(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold ${isBiz?'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200':'text-purple-600 bg-purple-50 border-purple-100 hover:bg-purple-100'} px-2 py-1 rounded border transition"><i class="fa-solid fa-wand-magic-sparkles"></i> ${isBiz?'המלצת AI':'טיפ מ-familAI'}</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 ${isBiz?'bg-slate-800 text-white hover:bg-slate-700':'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'} px-3 py-1 rounded text-xs font-bold transition"><i class="fa-solid fa-plus"></i> ${isBiz?'העברה ליעד':'הפקד'}</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים מוגדרים</p>'; } 
            }
        } catch(e) { console.error('Goals Render Error:', e); }
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? (isBiz?'חרגת מהתקציב שאושר!':'חרגת מהיעד!') : (isBiz?'עמידה ביעדי התקציב מזכה בבונוס!':'שמור על ירוק לקבלת ריבית!'); 
            }
        } catch(e) { console.error('Weekly Stats Error:', e); }

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; console.error('Transactions Error:', e); }

        try { 
            renderTodo(); 
            buildAndRenderFeed(); 
            const cfTab = document.getElementById('tab-cashflow');
            if (cfTab && cfTab.classList.contains('tab-active')) renderCashflow(); 
        } catch(e) { console.error('Feed/Todo/Cashflow Error:', e); }
    } catch(e) { console.error('Core fetchData Error:', e); }
}

function renderTodo() {
    const isBiz = isBizApp();
    const todoSection = document.getElementById('child-todo-section'); const todoList = document.getElementById('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">${isBiz?'נותרו':'עוד'} ${diff} ימים</span>` : ` • <span class="text-red-500">${isBiz?'חריגת זמנים!':'פג תוקף!'}</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border ${isBiz?'border-slate-200 hover:bg-slate-50':'border-blue-100 hover:bg-blue-50'} shadow-sm flex justify-between items-center cursor-pointer transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 ${isBiz?'bg-slate-100 text-slate-700':'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${t.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • ${isBiz?'טיקט / משימה':'משימה'} • ${isBiz?'בונוס':'תגמול'}: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">${isBiz?'נותרו':'עוד'} ${diff} ימים</span>` : ` • <span class="text-red-500">${isBiz?'חריגת זמנים!':'פג תוקף!'}</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border ${isBiz?'border-slate-200 hover:bg-slate-50':'border-purple-100 hover:bg-purple-50'} shadow-sm flex justify-between items-center cursor-pointer transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 ${isBiz?'bg-slate-100 text-slate-700':'bg-purple-100 text-purple-600'} rounded-full flex items-center justify-center"><i class="fa-solid ${isBiz?'fa-book-open':'fa-graduation-cap'}"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • ${isBiz?'לומדה':'אתגר לימודי'} • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function showFamilAIModal(title, text) {
    const modal = document.getElementById('familai-advisor-modal'); if(!modal) return;
    modal.classList.remove('hidden'); 
    const sub = document.getElementById('familai-modal-subtitle'); if(sub) sub.innerText = title;
    if (text) { document.getElementById('familai-advisor-loading').classList.add('hidden'); document.getElementById('familai-advice-text').innerText = text; document.getElementById('familai-advisor-content').classList.remove('hidden'); } 
    else { document.getElementById('familai-advisor-loading').classList.remove('hidden'); document.getElementById('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { const modal = document.getElementById('ai-modal'); if(modal) modal.classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const isBiz = isBizApp();
        const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'מעבד... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic') + (isBiz?" (בסביבה עסקית ארגונית)":""), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', isBiz?'הכשרת ה-AI מוכנה!':'מבחן ה-AI מוכן!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת התוכן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = isBiz?'צור חפיפה':'צור אתגר'; }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית של המשפחה', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); fetchData(); } 
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBusinessAIAdvice(employeeId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועץ העסקי של הארגון', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מנתח ביצועים ויעדים...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: employeeId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועץ העסקי של הארגון', data.advice); triggerConfetti(); fetchData(); } 
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערים, לא הצלחנו לייצר אנליזה כרגע.'); }
        } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        const isBiz = isBizApp();
        showFamilAIModal(isBiz?'אנליסט התקציב AI':'אנליסטית התקציב', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = isBiz?'מנתח חריגות ושימושים החודש...':'בודקת על מה הוצאנו החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal(isBiz?'אנליסט התקציב AI':'אנליסטית התקציב', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        const isBiz = isBizApp();
        showFamilAIModal(isBiz?'מנהל הרכש והמלאי AI':'מנהלת המזווה', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = isBiz?'מחשב כמויות מול צריכה בפועל...':'מחשבת כמויות ומרגלי קנייה...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal(isBiz?'מנהל הרכש והמלאי AI':'מנהלת המזווה', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    const isBiz = isBizApp();
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; const btn = document.getElementById('btn-tutor'); if(btn) { btn.disabled = true; btn.innerText = 'מייצר הסבר... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal(isBiz?'ניתוח שגיאה מקצועי (AI)':'המורה הפרטית שלך', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = isBiz?'<i class="fa-solid fa-brain"></i> ניתוח שגיאה ע"י AI':'<img src="logo.png" alt="AI" class="w-5 h-5 object-contain"> familAI, איפה טעיתי?'; } }
    });
}

function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    const isBiz = isBizApp();
    if(!mBtn || !aBtn || !mDiv || !aDiv) return;
    if (mode === 'manual') { mBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold bg-white ${isBiz?'text-slate-800':'text-blue-600'} shadow-sm transition`; aBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:${isBiz?'text-slate-800':'text-purple-600'} transition`; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold bg-white ${isBiz?'text-slate-800':'text-purple-600'} shadow-sm transition`; mBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:${isBiz?'text-slate-800':'text-blue-600'} transition`; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { const modal = document.getElementById('task-modal'); if(modal) modal.classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    const isBiz = isBizApp();
    const modal = document.getElementById('task-modal'); if(!modal) return;
    modal.classList.remove('hidden'); 
    document.getElementById('task-is-self').value = isSelf; 
    document.getElementById('task-days').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-reward').value = ''; document.getElementById('ai-task-topic').value = ''; 
    const resultsContainer = document.getElementById('ai-task-results'); if(resultsContainer) resultsContainer.classList.add('hidden');
    setTaskMode('manual'); const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardInput = document.getElementById('task-reward'); const assigneeSelect = document.getElementById('task-assignee');

    if(isSelf) { 
        document.getElementById('task-modal-title').innerText = isBiz?'דיווח ביצוע / יוזמה':'מעשה טוב'; if(toggles) toggles.classList.add('hidden'); if(assigneeContainer) assigneeContainer.classList.add('hidden'); if(rewardInput) rewardInput.placeholder = isBiz?'תמריץ מבוקש? (₪)':'כמה מגיע לי? (₪)'; 
    } else { 
        document.getElementById('task-modal-title').innerText = isBiz?'מטלה חדשה / פרויקט':'יצירת משימה'; if(toggles) toggles.classList.remove('hidden'); if(assigneeContainer) assigneeContainer.classList.remove('hidden'); if(rewardInput) rewardInput.placeholder = isBiz?'תגמול בונוס (₪) - אופציונלי':'תגמול (₪)';
        if(membersCache && assigneeSelect) {
            assigneeSelect.innerHTML = `<option value="" disabled selected>${isBiz?'בחר/י עובד...':'בחרו ילד/ה...'}</option>`; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = `<option value="" disabled selected>${isBiz?'אין אנשי צוות רשומים':'אין ילדים רשומים'}</option>`;
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const isBiz = isBizApp();
        const btn = document.getElementById('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = document.getElementById('task-is-self').value === 'true'; 
        let age;
        if (isBiz) { age = 30; } else {
            if (isSelf) age = new Date().getFullYear() - currentUser.birth_year;
            else {
                 if(!assigneeId) return showToast('error', 'קודם כל בחרו למעלה עבור מי המשימה 👆');
                 const child = membersCache.find(m => String(m.id) === String(assigneeId)); if(!child) return showToast('error', 'שגיאה במציאת גיל הילד');
                 age = new Date().getFullYear() - child.birth_year;
            }
        }
        if(!topic) return showToast('error', isBiz?'תארו בקצרה את הפרויקט...':'כתבו ל-familAI באיזה נושא לעזור');
        if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעבד...'; }
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic + (isBiz?" (בסביבת עבודה ארגונית)":""), groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = document.getElementById('ai-task-results'); 
                if(resultsContainer) {
                    resultsContainer.innerHTML = `<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">${isBiz?'הקליקו על הטיקט שתרצו להוסיף לצוות:':'הקליקו על המשימה שתרצו:'}</p>`;
                    data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border ${isBiz?'border-slate-200 hover:bg-slate-50':'border-purple-100 hover:bg-purple-50'} transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold ${isBiz?'text-slate-600 bg-slate-100':'text-purple-600 bg-purple-100'} px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                    resultsContainer.classList.remove('hidden'); 
                }
                if(!isBiz) triggerConfetti(); fetchData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = isBiz?'<i class="fa-solid fa-wand-magic-sparkles"></i> הצע תכנית עבודה':'<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; } }
    });
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isBiz = isBizApp();
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', isBiz?'יש לבחור עובד לטיקט':'יש לבחור ילד למשימה'); if(!title) return showToast('error', isBiz?'נא לפרט את תוכן המשימה':'יש לכתוב מה לעשות במשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    if(isSelf && !isBiz) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? (isBiz?'נשלח לאישור מנהל!':'נשלח לאישור ההורה!') : (isBiz?'טיקט נפתח בהצלחה!':'משימה נוצרה בהצלחה!')); fetchData(); 
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

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; const uploadBtn = document.getElementById('task-proof-upload'); if(uploadBtn) uploadBtn.click(); }

function handleTaskProofUpload(event) {
    const isBiz = isBizApp();
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal(isBiz?'בקרת איכות אוטומטית (QA)':'בקרת איכות', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = isBiz?'ה-AI סורק את ההוכחה שצורפה...':'familAI בודקת את התמונה שלך...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal(isBiz?'בקרת איכות (QA)':'בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const isBiz = isBizApp();
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal(isBiz?'רואה חשבון אוטומטי':'קופאית אוטומטית', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = isBiz?'סורק את החשבונית... זה ייקח רגע.':'familAI סורקת את הקבלה... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal(isBiz?'רואה חשבון אוטומטי':'קופאית אוטומטית', `סרקתי והוספתי ${data.count} פריטים ${isBiz?'מהחשבונית לדרישות הרכש':'מהקבלה לעגלה'} שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', isBiz?'שגיאה בקריאת החשבונית.':'שגיאה בקריאת הקבלה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const isBiz = isBizApp();
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal(isBiz?'זיהוי ציוד ומק"ט חכם':'זיהוי מוצר חכם', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = isBiz?'בודק איזה מוצר צולם...':'familAI בודקת איזה מוצר צילמת...';
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

function openPantryUseModal(name, unit) { const title = document.getElementById('use-pantry-title'); if(title) title.innerText = `מה לקחת מ: ${name}?`; document.getElementById('use-pantry-name').value = name; document.getElementById('use-pantry-qty').value = ''; const display = document.getElementById('use-pantry-unit-display'); if(display) display.innerText = unit || "יח'"; const modal = document.getElementById('pantry-use-modal'); if(modal) modal.classList.remove('hidden'); }

async function submitPantryUse() {
    const isBiz = isBizApp();
    const name = val('use-pantry-name'); const qty = val('use-pantry-qty'); const units = val('use-pantry-units');
    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty, usedUnits: units }) }); const data = await res.json();
        if(data.success) { showToast('success', isBiz?'המלאי נגרע בהצלחה':'המלאי עודכן בהצלחה'); document.getElementById('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

function renderPantry() {
    const isBiz = isBizApp();
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = `<p class="text-center text-slate-400 text-sm py-8">${isBiz?'המלאי ריק. קלטו ציוד וחומרי גלם כדי לעקוב אחרי המלאי בעסק!':'המזווה ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!'}</p>`; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2"><div class="flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${p.units_per_package || 1} יח'</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity} ${p.unit || "יח'"}</span><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div></div></div><div class="flex gap-2 mt-1 border-t border-slate-50 pt-2"><button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 ${isBiz?'bg-slate-100 text-slate-700 hover:bg-slate-200':'bg-orange-50 text-orange-600 hover:bg-orange-100'} py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm text-xs font-bold"><i class="fa-solid ${isBiz?'fa-dolly':'fa-utensils'}"></i> ${isBiz?'דיווח שימוש':'השתמשתי'}</button><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 ${isBiz?'bg-slate-800 text-white hover:bg-slate-700':'bg-pink-50 text-pink-600 hover:bg-pink-100'} py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> ${isBiz?'העבר לרכש':'חסר (לקניות)'}</button></div></div>`;
    });
}

function openPantryModal() { const modal = document.getElementById('pantry-modal'); if(modal) modal.classList.remove('hidden'); }
async function submitPantryItem() {
    const isBiz = isBizApp();
    const name = val('pantry-item'); const qty = val('pantry-quantity'); const unit = val('pantry-unit') || "יח'"; const upp = val('pantry-upp') || 1; if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
    document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); document.getElementById('pantry-unit').value = "יח'"; document.getElementById('pantry-upp').value = 1; fetchData(); showToast('success', isBiz?'המוצר נקלט במלאי':'המוצר נוסף למזווה');
}
async function updatePantryQty(id, newQty) {
    const isBiz = isBizApp();
    if(newQty <= 0) { if(!confirm(isBiz?'המוצר אזל מהמלאי. האם למחוק את הרישום? (ניתן להעביר לרכש במקום)':'המוצר נגמר! האם למחוק אותו מהמזווה? (מומלץ להוסיף לעגלת הקניות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}
async function movePantryToCart(pantryId, itemName, unit) { const isBiz = isBizApp(); await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', isBiz?'המוצר הועבר לבקשת רכש!':'המוצר הועבר לרשימת הקניות!'); fetchData(); }

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    const isBiz = isBizApp();
    let html = `<h4 class="font-bold text-slate-700 mt-2 mb-3">${isBiz?'<i class="fa-solid fa-swatchbook"></i> מאגר חפיפות נהלים':'📚 ספריית מבחנים למשפחה'}</h4>`;
    if (!allBundles || allBundles.length === 0) { html += `<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין ${isBiz?'הכשרות':'מבחנים'} זמינים. לחץ על "יצירת ${isBiz?'הכשרה':'אתגר'} AI" למעלה!</p>`; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'financial' ? '📈' : (type === 'reading' ? '📖' : '🧠'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:${isBiz?'border-slate-200':'border-blue-100'} transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 ${isBiz?'text-slate-600':'text-slate-500'} rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • ${isBiz?'קהל':'גיל'} ${b.age_group} • ${isBiz?'תמריץ':'פרס'}: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="${isBiz?'bg-slate-100 text-slate-700 hover:bg-slate-200':'bg-blue-50 text-blue-600 hover:bg-blue-100'} px-3 py-1.5 rounded-lg text-xs font-bold transition">${isBiz?'שיוך לעובד':'הקצה לילד'}</button></div>`;
        }); html += '</div>';
    }
    html += `<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">${isBiz?'<i class="fa-solid fa-list-check"></i> מעקב ביצוע':'🎯 מבחנים שהוקצו לאחרונה'}</h4>`;
    if (!bundlesCache || bundlesCache.length === 0) { html += `<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">${isBiz?'טרם בוצעו שיוכים לאנשי צוות.':'לא הוקצו מבחנים לאף ילד עדיין.'}</p>`; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? (isBiz?'הושלם בהצטיינות':'הושלם') : (b.status === 'failed' ? (isBiz?'נכשל / לפסילה':'נכשל') : (isBiz?'טרם בוצע':'ממתין')); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${b.assignee_name}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    try {
        const libList = document.getElementById('library-list'); if (!libList) return;
        const isBiz = isBizApp();
        const ageFilter = document.getElementById('lib-age-filter') ? document.getElementById('lib-age-filter').value : 'all'; const catFilter = document.getElementById('lib-cat-filter') ? document.getElementById('lib-cat-filter').value : 'all';
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = `<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין ${isBiz?'חומר למידה חדש':'מבחנים חדשים'} להצגה כרגע.</p>`; return; }
        const getIcon = (type) => { if (type === 'financial') return '<i class="fa-solid fa-chart-line"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-brain"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:${isBiz?'border-slate-200':'border-blue-200'} transition"><div class="flex items-center gap-3"><div class="w-8 h-8 ${isBiz?'bg-slate-100 text-slate-600':'bg-blue-50 text-blue-600'} rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • ${isBiz?'קהל':'גיל'} ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="${isBiz?'bg-slate-800 text-white hover:bg-slate-700':'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'} px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

function renderMyAssignments(bundles) {
    const list = document.getElementById('my-assignments-list'); const histList = document.getElementById('academy-history-list'); const histCont = document.getElementById('academy-history-container');
    if (!list) return; list.innerHTML = ''; if (histList) histList.innerHTML = ''; let histCount = 0; let actCount = 0;
    const isBiz = isBizApp();
    if(Array.isArray(bundles)) {
        bundles.forEach(b => {
            const reward = b.custom_reward !== null ? b.custom_reward : b.default_reward;
            if (b.status === 'assigned') {
                actCount++; let dMsg = ""; if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? `<span class="text-orange-500 font-bold bg-orange-50 px-1 rounded ml-2">${isBiz?'נותרו':'עוד'} ${diff} ימים</span>` : `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-2">${isBiz?'חריגת זמנים!':'איחור!'}</span>`; }
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-3"><div class="flex-1"><h4 class="font-bold text-slate-800">${b.title}</h4><p class="text-xs text-slate-500 mt-1">${isBiz?'תמריץ מעבר':'תמריץ מעבר'}: ₪${reward} ${dMsg}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow hover:bg-blue-700 transition"><i class="fa-solid fa-play"></i> התחל</button></div>`;
            } else {
                histCount++; if(histList) { let sColor = b.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'; let sText = b.status === 'completed' ? 'הושלם' : 'נכשל';
                histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400 mt-1">ציון: ${b.score}% • ${isBiz?'תמריץ':'תמריץ'}: ₪${b.status==='completed'?reward:0}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded ${sColor}">${sText}</span></div>`; }
            }
        });
    }
    if (actCount === 0) list.innerHTML = `<p class="text-center text-slate-400 text-sm py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ${isBiz?'מטלות למידה פתוחות.':'מטלות למידה פתוחות.'}</p>`;
    if (histCount > 0 && histCont) histCont.classList.remove('hidden'); else if(histCont) histCont.classList.add('hidden');
}

// ... All utility functions down here
function filterSuggestions(val) { const list = document.getElementById('suggestions'); if(!list) return; list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const flat = getFlatProducts(); const filtered = flat.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitFinalCheckout() {
    const isBiz = isBizApp();
    const store = document.getElementById('checkout-store').value || (isBiz?'ספק כללי':'סופר כללי'); const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(document.getElementById(`price-${id}`).value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    
    if(!isBiz) triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); 
    if(!isBiz) triggerConfetti(); 
    showToast('success', isBiz?'הפקודה בוצעה ואושרה למלאי!':'הקנייה הושלמה!'); 
    fetchData();
}
