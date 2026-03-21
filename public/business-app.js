// Oneflow 360 Pro - Business Logic Application

const introStyle = document.createElement('style');
introStyle.innerHTML = `
    .introjs-showElement { z-index: 9999998 !important; transform: none !important; }
    .introjs-fixParent { z-index: auto !important; opacity: 1.0 !important; transform: none !important; filter: none !important; }
    body.introjs-active .slider-container, body.introjs-active .slider-scroll, body.introjs-active .overflow-hidden { overflow: visible !important; }
    body.introjs-active header.sticky { z-index: 1 !important; }
    .introjs-overlay { z-index: 9999996 !important; }
    .introjs-helperLayer { z-index: 9999997 !important; }
    .introjs-tooltipReferenceLayer { z-index: 9999998 !important; }
    .introjs-tooltip { z-index: 9999999 !important; border: 1px solid #e2e8f0; }
    @media (max-width: 768px) {
        .introjs-tooltipReferenceLayer { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important; right: auto !important; bottom: auto !important; width: 90vw !important; }
        .introjs-tooltip { position: relative !important; max-width: 350px !important; margin: 0 auto !important; left: auto !important; right: auto !important; top: auto !important; bottom: auto !important; }
        .introjs-arrow { display: none !important; }
    }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saAllGroups = []; let saAllUsers = [];
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

function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

const bizCATEGORIES = { 
    income: [ {value:'sales',label:'📈 מכירות והכנסות'}, {value:'investment',label:'💰 השקעה / מימון'}, {value:'refund',label:'🔄 זיכוי / החזר'}, {value:'other',label:'💸 אחר'} ], 
    expense: [ {value:'office',label:'📎 ציוד משרדי'}, {value:'software',label:'💻 תוכנה ושירותים'}, {value:'marketing',label:'🎯 שיווק ופרסום'}, {value:'salary',label:'💼 שכר ומשכורות'}, {value:'travel',label:'✈️ נסיעות ורכבים'}, {value:'rent',label:'🏢 שכירות ותחזוקה'}, {value:'food',label:'☕ כיבוד ומטבחון'}, {value:'other',label:'💸 הוצאה תפעולית אחרת'} ] 
};

const bizBUDGET_LABELS = { 'office': '📎 ציוד משרדי', 'software': '💻 תוכנה ורישיונות', 'marketing': '🎯 שיווק', 'salary': '💼 שכר ובונוסים', 'travel': '✈️ נסיעות', 'rent': '🏢 שכירות', 'food': '☕ מטבחון', 'other': '💸 שונות', 'allowance': '💰 תקציב מחלקות', 'tasks': '✅ תגמול פרויקטים', 'academy': '🎓 הכשרות', 'savings': '🐖 עתודות וחיסכון' };

const bizPRODUCT_DB = { 
    "ציוד משרדי 📎": ["נייר צילום A4", "עטים", "קלסרים", "מרקרים", "שדכן", "סיכות לשדכן", "דפדפות", "מעטפות", "פתקיות ממו"], 
    "מחשוב וטכנולוגיה 💻": ["עכבר אלחוטי", "מקלדת", "מסך מחשב", "כבל HDMI", "כבל רשת", "מטען למחשב נייד", "אוזניות", "דיסק און קי"], 
    "מטבחון וכיבוד ☕": ["קפה שחור", "קפה נמס", "קפסולות קפה", "חלב", "חלב סויה", "חלב שיבולת שועל", "סוכר", "סוכרזית", "תה", "עוגיות", "כוסות נייר"], 
    "ניקיון ותחזוקה 🧻": ["נייר טואלט", "נייר סופג", "נוזל כלים", "סבון ידיים", "מטליות לניקוי", "שקיות זבל"], 
    "שונות / חומרי גלם 📦": ["מארז קרטונים", "סלוטייפ", "מספריים"] 
};
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(bizPRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

window.onload = async () => { 
    initAccessibility();
    const btnMonthly = document.getElementById('btn-forecast-monthly'); const btnYearly = document.getElementById('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id && session.group && session.group.type === 'BUSINESS') { 
                currentUser = session.user; currentGroup = session.group; loadDashboard(); return; 
            } else if (session && session.user) {
                // If it's a family user trying to access business html, redirect back
                window.location.href = '/index.html';
                return;
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    // If not logged in at all, redirect to index to login
    window.location.href = '/index.html';
};

function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/index.html'; }
function scrollTabs(direction) { const s = document.getElementById('slider-scroll'); if(s) s.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const tContent = document.getElementById(`content-${t}`); if(tContent) tContent.classList.remove('hidden'); 
    const tBtn = document.getElementById(`tab-${t}`); if(tBtn) tBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') { try { renderPantry(); } catch(e) {} } 
    if (t === 'forecast') { try { renderForecast(); } catch(e) {} } 
    if (t === 'cashflow') { try { renderCashflow(); } catch(e) {} }
    if (t === 'timeclock') { try { fetchTimeclockStatus(); fetchTimeclockReport(); } catch(e) {} }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-red-100', 'text-red-600', 'border-red-200', 'bg-slate-800', 'text-white', 'border-transparent');
    if (currentGroup.is_premium) { 
        indicator.innerHTML = '⚡ ∞ (Pro)'; 
        indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent');
    } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
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
    const preloader = document.getElementById('app-preloader');
    
    const dashCont = document.getElementById('dashboard-container'); if(dashCont) dashCont.classList.remove('hidden'); 
    const fabCont = document.getElementById('fab-container'); if(fabCont) fabCont.classList.remove('hidden');

    const dashGroupName = document.getElementById('dash-group-name');
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full mr-2 tracking-widest border border-slate-300 shadow-sm">קוד ארגון: ${currentGroup.group_code}</span>` : '';
    if (dashGroupName) dashGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
    
    const dashNickname = document.getElementById('dash-nickname');
    if (dashNickname) dashNickname.innerText = currentUser.nickname; 

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> בקשות רכש לאישור הנהלה`;
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-slate-800 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle text-green-500"></i> מסלול PRO פעיל בארגון</p>`; }
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        const cardName = document.getElementById('card-name'); if (cardName) cardName.innerText = currentUser.nickname.toUpperCase(); 
        const cardAllow = document.getElementById('card-allowance'); if (cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
        const cardInt = document.getElementById('card-interest'); if (cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
        const reqTitle = document.getElementById('req-title'); if (reqTitle) reqTitle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> הסטטוס דרישות רכש שלי`;
    }
    const btnAddBud = document.getElementById('btn-add-budget-cat'); if(btnAddBud) btnAddBud.classList.remove('hidden'); 
    updateBatteryUI();
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); fetchTimeclockStatus(); if(currentUser.role === 'ADMIN') fetchPendingUsers(); }, 30000);
        
        fetchBanners(); 
        await fetchMembers(); 
        if(currentUser.role === 'ADMIN') fetchPendingUsers(); 
        await fetchData(); 
        fetchLoans(); 
        fetchTimeclockStatus(); 
        fetchTimeclockReport();
    } catch (e) {
        console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
    }
}

function applyBannersToDOM(banners) {
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { let html = ''; if(img) html += `<img src="/${img}" alt="Banner" class="w-full object-cover block">`; if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; el.innerHTML = html; el.href = link || '#'; if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } el.classList.remove('hidden'); el.classList.add('flex'); } 
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    };
    renderBanner(appTop, banners.biz_banner_top_text || banners.banner_top_text, banners.biz_banner_top_link || banners.banner_top_link, banners.biz_banner_top_img || banners.banner_top_img); 
    renderBanner(appBottom, banners.biz_banner_bottom_text || banners.banner_bottom_text, banners.biz_banner_bottom_link || banners.banner_bottom_link, banners.biz_banner_bottom_img || banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem(`ofl_banners_BUSINESS`); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=BUSINESS`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem(`ofl_banners_BUSINESS`, JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome?type=BUSINESS`); const data = await res.json();
        const modalText = document.getElementById('welcome-modal-text');
        if (data.message && data.message.trim() !== '' && modalText) {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { modalText.innerText = data.message; setupPwaInstallSection(); const wm = document.getElementById('welcome-modal'); if(wm) wm.classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { const wm = document.getElementById('welcome-modal'); if(wm) wm.classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') { startManagerTour(); } else { startEmployeeTour(); } } } catch(e) {} }, 1000); }
function triggerManualTour() { const pm = document.getElementById('profile-modal'); if(pm) pm.classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') { startManagerTour(); } else { startEmployeeTour(); } }, 300); }

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

function startManagerTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow 360 Pro! 💼", intro: "מערכת ניהול הארגון והצוות שלך עברה לשלב הבא. בואו נצא לסיור קצר." },
            { element: '#tour-header', title: "ניהול פרופיל", intro: "כאן תמצאו את קוד הארגון שאיתו תזמינו את העובדים, וגישה להגדרות.", position: 'bottom' },
            { element: '#tour-balance-card', title: "קופת הארגון 💳", intro: "כאן תוכלו לראות בזמן אמת את יתרת התקציב או המאזן המרכזי של החברה.", position: 'bottom' },
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
            { element: '#tour-balance-card', title: "התקציב / הבונוסים שלך 💳", intro: "כאן יופיע תקציב הפעילות שלך או בונוסים שהרווחת מביצוע פרויקטים.", position: 'bottom' },
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

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

// --- TIME CLOCK FUNCTIONS ---
async function fetchTimeclockStatus() {
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
        const userName = currentUser.role === 'ADMIN' && t.nickname ? `<span class="text-[9px] bg-slate-200 px-1.5 rounded text-slate-600 mr-2 shadow-sm border border-slate-300">${t.nickname}</span>` : '';
        html += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-slate-200 transition"><div><p class="font-bold text-slate-700 text-sm flex items-center"><i class="fa-solid fa-clock text-slate-400 ml-1.5"></i> ${inStr} ${userName}</p><p class="text-[10px] text-slate-500 mt-1">יציאה: ${outStr}</p></div><div class="text-center"><span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">${timeStr}</span></div></div>`;
    });
    
    list.innerHTML = html;
    const tHours = Math.floor(totalMinutes / 60); const tMins = totalMinutes % 60;
    const totalEl = document.getElementById('tc-total-hours'); if(totalEl) totalEl.innerText = `${String(tHours).padStart(2, '0')}:${String(tMins).padStart(2, '0')}`;
}

window.openBalanceAdjustmentModal = function(id, name) { document.getElementById('adjustment-user-id').value = id; const nEl=document.getElementById('adjustment-user-name'); if(nEl) nEl.innerText = `עבור: ${name}`; document.getElementById('adjustment-amount').value = ''; document.getElementById('adjustment-reason').value = ''; window.toggleAdjustmentType('deduct'); const modal=document.getElementById('balance-adjustment-modal'); if(modal) modal.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס תפעולי' : 'הפחתה תפעולית');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'עודכן בהצלחה!'); const modal=document.getElementById('balance-adjustment-modal'); if(modal) modal.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
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
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">כלל הארגון</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">כלל העובדים</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">כלל העובדים</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">עבור איזה מחלקה/עובד?</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = document.getElementById('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${m.role === 'ADMIN' ? 'מנהל צוות' : 'עובד'})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = document.getElementById('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = `<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין עובדים רשומים בארגון עדיין.</p>`;
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'עובד'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/חודש • ${m.interest_rate || 0}% תמריץ יעד</p><p class="text-xs font-bold text-slate-700 mt-1">תקציב נוכחי: <span class="text-slate-800">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition" title="תיקון/בונוס"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות של אנשי הצוות למייל ההנהלה?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מכין ושולח...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל מנהל הארגון!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; 
        if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); 
        const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> מסלול PRO פעיל בארגון</p>`; }
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
        try { renderTasks(allTasks); renderPantry(); } catch(e) { console.error('Render Tasks/Pantry Error:', e); }
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
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 block mb-1 w-fit">${g.owner_name}</span>` : ''; 
                        const adviseBtn = `<button onclick="getBusinessAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200 px-2 py-1 rounded border transition shadow-sm"><i class="fa-solid fa-wand-magic-sparkles"></i> אנליסט AI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-slate-800 text-white hover:bg-slate-700 px-3 py-1 rounded text-xs font-bold transition shadow-sm"><i class="fa-solid fa-plus"></i> העברה ליעד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים מוגדרים</p>'; } 
            }
        } catch(e) { console.error('Goals Render Error:', e); }
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהתקציב שאושר!' : 'עמידה ביעדי התקציב מזכה בבונוס!'; 
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
    const todoSection = document.getElementById('child-todo-section'); const todoList = document.getElementById('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">נותרו ${diff} ימים</span>` : ` • <span class="text-red-500">חריגת זמנים!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 shadow-sm flex justify-between items-center cursor-pointer transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-700 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${t.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • טיקט • בונוס: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">נותרו ${diff} ימים</span>` : ` • <span class="text-red-500">חריגת זמנים!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 shadow-sm flex justify-between items-center cursor-pointer transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-700 rounded-full flex items-center justify-center"><i class="fa-solid fa-book-open"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • לומדה • תמריץ: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
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
        const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'מעבד... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: '18+', topic: val('ai-topic') + " (בסביבה עסקית ארגונית)", groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'הכשרת ה-AI מוכנה!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת התוכן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'חולל חפיפה'; }
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
        showFamilAIModal('אנליסט התקציב AI', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מנתח חריגות ושימושים החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסט התקציב AI', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהל הרכש והמלאי AI', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'מחשב כמויות מול צריכה בפועל...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהל הרכש והמלאי AI', data.insight); fetchData(); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; const btn = document.getElementById('btn-tutor'); if(btn) { btn.disabled = true; btn.innerText = 'מייצר הסבר... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('ניתוח שגיאה מקצועי (AI)', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> הצג ניתוח שגיאה מקצועי (AI)'; } }
    });
}

function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    if(!mBtn || !aBtn || !mDiv || !aDiv) return;
    if (mode === 'manual') { mBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition`; aBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition`; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition`; mBtn.className = `flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition`; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { const modal = document.getElementById('task-modal'); if(modal) modal.classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    const modal = document.getElementById('task-modal'); if(!modal) return;
    modal.classList.remove('hidden'); 
    document.getElementById('task-is-self').value = isSelf; 
    document.getElementById('task-days').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-reward').value = ''; document.getElementById('ai-task-topic').value = ''; 
    const resultsContainer = document.getElementById('ai-task-results'); if(resultsContainer) resultsContainer.classList.add('hidden');
    setTaskMode('manual'); const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardInput = document.getElementById('task-reward'); const assigneeSelect = document.getElementById('task-assignee');

    if(isSelf) { 
        document.getElementById('task-modal-title').innerText = 'דיווח ביצוע / יוזמה'; if(toggles) toggles.classList.add('hidden'); if(assigneeContainer) assigneeContainer.classList.add('hidden'); if(rewardInput) rewardInput.placeholder = 'תמריץ מבוקש? (₪)'; 
    } else { 
        document.getElementById('task-modal-title').innerText = 'מטלה חדשה / פרויקט'; if(toggles) toggles.classList.remove('hidden'); if(assigneeContainer) assigneeContainer.classList.remove('hidden'); if(rewardInput) rewardInput.placeholder = 'תגמול בונוס (₪) - אופציונלי';
        if(membersCache && assigneeSelect) {
            assigneeSelect.innerHTML = `<option value="" disabled selected>בחר/י עובד...</option>`; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = `<option value="" disabled selected>אין אנשי צוות רשומים</option>`;
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = document.getElementById('task-is-self').value === 'true'; 
        let age = 30; // Business default
        if(!topic) return showToast('error', 'תארו בקצרה את הפרויקט...');
        if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעבד...'; }
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic + " (בסביבת עבודה ארגונית)", groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = document.getElementById('ai-task-results'); 
                if(resultsContainer) {
                    resultsContainer.innerHTML = `<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על הטיקט שתרצו להוסיף לצוות:</p>`;
                    data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-slate-200 hover:bg-slate-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                    resultsContainer.classList.remove('hidden'); 
                }
                fetchData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-microchip"></i> חולל פרויקט'; } }
    });
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור עובד לטיקט'); if(!title) return showToast('error', 'נא לפרט את תוכן המשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור מנהל!' : 'טיקט נפתח בהצלחה!'); fetchData(); 
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
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות אוטומטית (QA)', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'ה-AI סורק את ההוכחה שצורפה...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות (QA)', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('רואה חשבון אוטומטי', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'סורק את החשבונית... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('רואה חשבון אוטומטי', `סרקתי והוספתי ${data.count} פריטים מהחשבונית לדרישות הרכש שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת החשבונית.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי ציוד ומק"ט חכם', null); const loadText = document.getElementById('familai-loading-text'); if(loadText) loadText.innerText = 'בודק איזה מוצר צולם...';
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
    const name = val('use-pantry-name'); const qty = val('use-pantry-qty'); const units = val('use-pantry-units');
    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty, usedUnits: units }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); document.getElementById('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = `<p class="text-center text-slate-400 text-sm py-8">המלאי ריק. קלטו ציוד וחומרי גלם כדי לעקוב אחרי המלאי בעסק!</p>`; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2"><div class="flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${p.units_per_package || 1} יח'</p></div><div class="flex items-center gap-2"><div class="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity} ${p.unit || "יח'"}</span><button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div></div></div><div class="flex gap-2 mt-1 border-t border-slate-50 pt-2"><button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm border border-slate-200 text-xs font-bold"><i class="fa-solid fa-dolly"></i> דיווח שימוש</button><button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-slate-800 text-white hover:bg-slate-700 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> העבר לרכש</button></div></div>`;
    });
}

function openPantryModal() { const modal = document.getElementById('pantry-modal'); if(modal) modal.classList.remove('hidden'); }
async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); const unit = val('pantry-unit') || "יח'"; const upp = val('pantry-upp') || 1; if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
    document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); document.getElementById('pantry-unit').value = "יח'"; document.getElementById('pantry-upp').value = 1; fetchData(); showToast('success', 'המוצר נקלט במלאי');
}
async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר אזל מהמלאי. האם למחוק את הרישום? (ניתן להעביר לרכש במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}
async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לבקשת רכש!'); fetchData(); }

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = `<h4 class="font-bold text-slate-700 mt-2 mb-3"><i class="fa-solid fa-swatchbook"></i> מאגר חפיפות נהלים</h4>`;
    if (!allBundles || allBundles.length === 0) { html += `<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין הכשרות זמינות. לחץ על "יצירת הכשרה AI" למעלה!</p>`; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'financial' ? '📈' : (type === 'reading' ? '📖' : '🧠'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-slate-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 border border-slate-200 text-slate-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • קהל ${b.age_group} • תמריץ: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition">שיוך לעובד</button></div>`;
        }); html += '</div>';
    }
    html += `<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6"><i class="fa-solid fa-list-check"></i> מעקב ביצוע</h4>`;
    if (!bundlesCache || bundlesCache.length === 0) { html += `<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">טרם בוצעו שיוכים לאנשי צוות.</p>`; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-600' : (b.status === 'failed' ? 'text-red-600' : 'text-slate-600'); let statusText = b.status === 'completed' ? 'הושלם בהצטיינות' : (b.status === 'failed' ? 'נכשל / לפסילה' : 'טרם בוצע'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${b.assignee_name}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    try {
        const libList = document.getElementById('library-list'); if (!libList) return;
        const ageFilterEl = document.getElementById('lib-age-filter'); const ageFilter = ageFilterEl ? ageFilterEl.value : 'all'; 
        const catFilterEl = document.getElementById('lib-cat-filter'); const catFilter = catFilterEl ? catFilterEl.value : 'all';
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = `<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין חומר למידה חדש להצגה כרגע.</p>`; return; }
        const getIcon = (type) => { if (type === 'financial') return '<i class="fa-solid fa-chart-line"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-brain"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-slate-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-100 border border-slate-200 text-slate-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • קהל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm">התחל הכשרה</button></div>`;
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
                actCount++; let dMsg = ""; if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? `<span class="text-slate-600 font-bold bg-slate-100 border border-slate-200 px-1 rounded ml-2">נותרו ${diff} ימים</span>` : `<span class="text-red-600 font-bold bg-red-50 border border-red-100 px-1 rounded ml-2">חריגת זמנים!</span>`; }
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-3"><div class="flex-1"><h4 class="font-bold text-slate-800">${b.title}</h4><p class="text-xs text-slate-500 mt-1">תמריץ מעבר: ₪${reward} ${dMsg}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold shadow hover:bg-indigo-700 transition"><i class="fa-solid fa-play"></i> התחל</button></div>`;
            } else {
                histCount++; if(histList) { let sColor = b.status === 'completed' ? 'text-green-600 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'; let sText = b.status === 'completed' ? 'הושלם בהצלחה' : 'נכשל';
                histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400 mt-1">ציון: ${b.score}% • תמריץ: ₪${b.status==='completed'?reward:0}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded border ${sColor}">${sText}</span></div>`; }
            }
        });
    }
    if (actCount === 0) list.innerHTML = `<p class="text-center text-slate-400 text-sm py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין מטלות למידה פתוחות.</p>`;
    if (histCount > 0 && histCont) histCont.classList.remove('hidden'); else if(histCont) histCont.classList.add('hidden');
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'טוען...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'הלומדה שויכה בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-500"></i> התחל ריענון נהלים אקראי'; } }
}

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    const qt = document.getElementById('quiz-title'); if(qt) qt.innerText = bundle.title; 
    const tutorBtn = document.getElementById('btn-tutor'); if(tutorBtn) tutorBtn.classList.add('hidden'); 
    const textContainer = document.getElementById('quiz-text-container');
    if(textContainer) { if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); } }
    const qrModal = document.getElementById('quiz-runner-modal'); if(qrModal) qrModal.classList.remove('hidden'); 
    renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    const qp = document.getElementById('q-progress'); if(qp) qp.innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; 
    const qt = document.getElementById('q-text'); if(qt) qt.innerText = q.q;
    const optsContainer = document.getElementById('q-options'); if(!optsContainer) return;
    optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-white border border-slate-200 shadow-sm font-medium hover:bg-slate-50 text-slate-700 transition">${opt}</button>`; });
}

async function submitAnswer(selectedIdx) {
    const q = currentQuizData.questions[currentQuestionIndex]; const isCorrect = selectedIdx === q.correct; const btns = document.querySelectorAll('.quiz-option');
    if(btns[selectedIdx]) btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong');
    if(!isCorrect && btns[q.correct]) { btns[q.correct].classList.add('correct'); currentWrongAnswers.push({ q: q.q, wrong: q.options[selectedIdx], correct: q.options[q.correct] }); }
    if(isCorrect) quizScore++;
    setTimeout(async () => { currentQuestionIndex++; if (currentQuestionIndex < currentQuizData.questions.length) { renderQuestion(); } else { finishQuiz(); } }, 1000);
}

async function finishQuiz() {
    const total = currentQuizData.questions.length; const finalScore = Math.round((quizScore / total) * 100); const passed = finalScore >= currentQuizData.threshold;
    const qc = document.getElementById('question-container'); if(qc) qc.classList.add('hidden'); 
    const qtc = document.getElementById('quiz-text-container'); if(qtc) qtc.classList.add('hidden'); 
    const qr = document.getElementById('quiz-result'); if(qr) qr.classList.remove('hidden');
    
    const qi = document.getElementById('quiz-icon'); if(qi) qi.innerHTML = passed ? '🏆' : '📝'; 
    const qmt = document.getElementById('quiz-msg-title'); if(qmt) qmt.innerText = passed ? 'עברת בהצלחה!' : 'לא נורא, אפשר לנסות שוב...'; 
    const qmd = document.getElementById('quiz-msg-desc'); if(qmd) qmd.innerText = passed ? `השלמת את חפיפת הנהלים וזכית בתמריץ של ₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `יש להגיע לציון של ${currentQuizData.threshold}% כדי לעבור את ההכשרה.`; 
    const qsd = document.getElementById('quiz-score-display'); if(qsd) qsd.innerText = `ציון סופי: ${finalScore}%`;
    
    if (!passed && currentWrongAnswers.length > 0) { const tBtn = document.getElementById('btn-tutor'); if(tBtn) tBtn.classList.remove('hidden'); }
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) });
    fetchData(); 
}

function closeQuiz() { 
    const qrm = document.getElementById('quiz-runner-modal'); if(qrm) qrm.classList.add('hidden'); 
    const qc = document.getElementById('question-container'); if(qc) qc.classList.remove('hidden'); 
    const qr = document.getElementById('quiz-result'); if(qr) qr.classList.add('hidden'); 
}

function filterSuggestions(valStr) { const list = document.getElementById('suggestions'); if(!list) return; list.innerHTML = ''; if (!valStr) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(valStr)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { const si = document.getElementById('shop-item'); if(si) si.value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); 
    const btn = document.querySelector('#shop-modal button.bg-slate-800'); 
    const item = itemInput ? itemInput.value : ''; const qty = val('shop-quantity'); const est = val('shop-est-price'); const unit = val('shop-unit') || "יח'"; const upp = val('shop-upp') || 1;
    if(!item) return; if (btn && btn.disabled) return; if(btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, unitsPerPackage: upp, userId: currentUser.id}) }); const data = await res.json(); 
        if (data.success) { 
            const sm = document.getElementById('shop-modal'); if(sm) sm.classList.add('hidden'); 
            if(itemInput) itemInput.value = ''; 
            const ep = document.getElementById('shop-est-price'); if(ep) ep.value = ''; 
            const sq = document.getElementById('shop-quantity'); if(sq) sq.value = 1; 
            const su = document.getElementById('shop-unit'); if(su) su.value = "יח'"; 
            const supp = document.getElementById('shop-upp'); if(supp) supp.value = 1; 
            const sc = document.getElementById('shop-upp-container'); if(sc) sc.classList.add('hidden'); 
            const sug = document.getElementById('suggestions'); if(sug) sug.classList.add('hidden'); 
            if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; 
            showToast('success', 'בקשת הרכש נשלחה למנהל'); fetchData(); 
        } 
    } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף לרשימה'; } } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט דרישה זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק בהצלחה'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל בקשות הרכש? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה אופסה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); if(cb) cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); if(inp) inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
    const list = document.getElementById('shop-list'); const reqList = document.getElementById('shop-requests-list'); const reqContainer = document.getElementById('shop-requests-container');
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        if(reqContainer) reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200 border border-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200 border border-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 px-2 py-1 rounded-lg">ממתין להנהלה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-800">${i.item_name}</span><span class="text-xs text-slate-500 block mt-0.5">דרישה מאת: ${i.requester_name}</span></div>${actions}</div>`;
        });
        if(reqList) reqList.innerHTML = reqHtml;
    } else { if(reqContainer) reqContainer.classList.add('hidden'); }

    const tShop = document.getElementById('tab-shop');
    const isShopTabActive = tShop && tShop.classList.contains('tab-active');

    if(activeItems.length === 0) { 
        if(list) list.innerHTML = `<p class="text-center text-slate-400 py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm">רשימת ההזמנות ריקה</p>`; 
        const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    if (isShopTabActive) { const f = document.getElementById('cart-footer'); if(f) f.classList.remove('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(bizPRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart bg-slate-50 border-slate-300':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-slate-800 rounded cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-800 font-bold item-name text-sm">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-400 hover:text-red-500 text-xs px-2 transition"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-500">ביקש/ה: ${i.requester_name} | מארז: ${i.units_per_package || 1} יח'</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-indigo-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-500"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-2 border-t border-slate-100 pt-2"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-white border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-slate-800 font-bold text-center shadow-sm"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-800" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-500 hover:bg-orange-50 transition mr-2 shadow-sm" id="btn-missing-${i.id}">חסר בספק</button></div></div>`;
    });
    if(list) list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); row.classList.toggle('bg-slate-50', value); row.classList.toggle('border-slate-300', value); if(input) input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; const sp = freshWisdomDiv.querySelector('span'); if(sp) sp.innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { 
    const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); 
    if(!row || !btn) return;
    const isMissing = row.classList.contains('missing'); 
    if (!isMissing) { 
        row.classList.add('missing'); row.classList.remove('in-cart'); row.classList.remove('bg-slate-50'); row.classList.remove('border-slate-300');
        const cb = row.querySelector('input[type="checkbox"]'); if(cb) { cb.checked = false; cb.disabled = true; }
        const p = document.getElementById(`price-${id}`); if(p) p.disabled = true; 
        btn.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-300'); btn.innerText = 'מבוטל'; 
    } else { 
        row.classList.remove('missing'); 
        const cb = row.querySelector('input[type="checkbox"]'); if(cb) cb.disabled = false; 
        btn.classList.remove('bg-orange-50', 'text-orange-600', 'border-orange-300'); btn.innerText = 'חסר בספק'; 
    } 
    calcRunningTotal(); 
}

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const cb = row.querySelector('input[type="checkbox"]');
        const isChecked = cb ? cb.checked : false; 
        const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const pi = row.querySelector('.price-input');
            const unitPrice = pi ? parseFloat(pi.value) || 0 : 0; 
            const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    const tDisp = document.getElementById('cart-total-display');
    if(tDisp) tDisp.innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) { 
                count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
                const pi = row.querySelector('.price-input');
                const unitPrice = pi ? parseFloat(pi.value) || 0 : 0; 
                const qty = itemData ? parseFloat(itemData.quantity) : 1; 
                total += (unitPrice * qty); 
            }
        } 
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום לאישור'); return; } 
    const sc = document.getElementById('summ-count'); if(sc) sc.innerText = count; 
    const sm = document.getElementById('summ-missing'); if(sm) sm.innerText = missing; 
    const st = document.getElementById('summ-total'); if(st) st.innerText = `₪${total.toFixed(2)}`; 
    const ccm = document.getElementById('confirm-checkout-modal'); if(ccm) ccm.classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const cStore = document.getElementById('checkout-store'); const store = (cStore && cStore.value) ? cStore.value : 'ספק כללי'; 
    const cBranch = document.getElementById('checkout-branch'); const branch = cBranch ? cBranch.value : ''; 
    let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else {
            const cbx = row.querySelector('input[type="checkbox"]');
            if (cbx && cbx.checked) {
                const pi = document.getElementById(`price-${id}`);
                const unitPrice = pi ? parseFloat(pi.value) || 0 : 0; 
                const qty = itemData ? parseFloat(itemData.quantity) : 1; 
                const rowTotal = unitPrice * qty; total += rowTotal;
                boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
            }
        }
    });
    
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const ccm = document.getElementById('confirm-checkout-modal'); if(ccm) ccm.classList.add('hidden'); 
    showToast('success', 'הפקודה בוצעה ואושרה למלאי!'); 
    fetchData();
}

async function copyList(tripId) { if(!confirm('האם לייבא את דרישת הרכש מחדש?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); const hm = document.getElementById('history-modal'); if(hm) hm.classList.add('hidden'); showToast('success', 'הדרישה הועתקה!'); fetchData(); }

function openPasteListModal() { const pt = document.getElementById('paste-list-text'); if(pt) pt.value = ''; const pm = document.getElementById('paste-list-modal'); if(pm) pm.classList.remove('hidden'); }
async function submitPastedList() {
    const pt = document.getElementById('paste-list-text'); if(!pt) return; const text = pt.value; if (!text.trim()) return;
    const btn = document.getElementById('btn-submit-paste'); if(btn) { btn.disabled = true; btn.innerText = 'קולט נתונים...'; }
    const lines = text.split('\n').filter(l => l.trim() !== '');
    try {
        for (let line of lines) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: line.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, unitsPerPackage: 1}) }); }
        const pm = document.getElementById('paste-list-modal'); if(pm) pm.classList.add('hidden'); showToast('success', `נקלטו ${lines.length} שורות מדרישת הרכש!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'קליטת נתונים'; } }
}

function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*דרישת רכש / ציוד ממערכת Oneflow 360 Pro:*\n\n`;
    activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code && codeSpan) { codeSpan.innerText = currentGroup.group_code; } else if(codeSpan) { codeSpan.innerText = 'שגיאה: חסר קוד'; } const im = document.getElementById('invite-modal'); if(im) im.classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו סביבת עבודה ב-Oneflow 360 Pro 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד הארגון שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו לעבוד עם Oneflow 360 Pro 🚀\n\nקוד הארגון לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר לפורטל העובדים שלך:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); const im = document.getElementById('invite-modal'); if(im) im.classList.add('hidden'); 
}

function toggleFab() { const fc = document.getElementById('fab-container'); if(fc) fc.classList.toggle('fab-open'); }
function showToast(t,m) { const el=document.getElementById('toast'); const icon = document.getElementById('toast-icon'); if(!el || !icon) return; el.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function triggerConfetti() { try{ confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch(e){} }
function triggerShake() { const app = document.getElementById('main-wrapper'); if(app){ app.classList.add('shake-effect'); setTimeout(() => app.classList.remove('shake-effect'), 500); } }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list');
