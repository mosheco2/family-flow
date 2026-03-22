// --- סגנונות מערכת הסיור וההדרכה וסגנונות דינמיים ---
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
    /* סגנונות דינמיים לממשק עסקים */
    body.is-business #tour-balance-card { background: linear-gradient(135deg, #1e293b, #0f172a); }
    body.is-business .tab-active { background: #0f172a; border-color: #0f172a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4); color: white; }
    body.is-business #app-banner-top, body.is-business #app-banner-bottom { background: linear-gradient(to right, #0f172a, #334155); }
    body.is-business .fab-open #fab-menu button { border: 1px solid #475569; }
    
    /* סגנונות לשעון נוכחות */
    .punch-btn-in { background-color: #10b981; color: white; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4); }
    .punch-btn-out { background-color: #ef4444; color: white; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.4); }
    .punch-pulse { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
`;
document.head.appendChild(introStyle);

// --- הגדרות ומשתנים גלובליים ---
const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let forecastCache = { startingBalance: 0, items: [] };
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false; let forecastRatioChart = null; let currentForecastMode = 'monthly'; let currentScanTarget = ''; 
let currentPunchStatus = null; let deferredPrompt = null;

// --- כלים ועזרים ---
const el = id => document.getElementById(id);
const val = id => el(id) ? el(id).value : '';
function showToast(t,m) { const tm=el('toast'), ic=el('toast-icon'); if(!tm||!ic)return; tm.classList.remove('hidden'); el('toast-message').innerText=m; ic.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>tm.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt=el(`btn-${a}-text`), ldr=el(`btn-${a}-loader`); if(txt&&ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { if(typeof confetti !== 'undefined') confetti({ particleCount:100, spread:70, origin:{y:0.6} }); }
function triggerShake() { const a=el('main-wrapper'); if(a){ a.classList.add('shake-effect'); setTimeout(()=>a.classList.remove('shake-effect'), 500); } }
function toggleFab() { const fc=el('fab-container'); if(fc) fc.classList.toggle('fab-open'); }

const hidePreloaderAndShowAuth = (view='login') => {
    const authC = el('auth-container'); if(authC) authC.classList.remove('hidden'); switchView(view);
    const p = el('app-preloader'); if(p) { p.classList.add('opacity-0', 'pointer-events-none'); setTimeout(()=>p.classList.add('hidden'), 700); }
};

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

function setupPwaInstallSection() {
    const sec = el('pwa-install-section'), ios = el('pwa-ios-instructions'), and = el('pwa-android-instructions'), btn = el('btn-install-pwa');
    if(!sec || !ios || !and || !btn) return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    if (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())) { ios.classList.remove('hidden'); and.classList.add('hidden'); } 
    else {
        ios.classList.add('hidden'); and.classList.remove('hidden');
        btn.onclick = async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome==='accepted') sec.classList.add('hidden'); deferredPrompt=null; } else showToast('info', 'כדי להתקין, פתחו את תפריט הדפדפן ובחרו "התקן אפליקציה".'); };
    }
}

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [{value:'salary',label:'💼 משכורת/שכר'}, {value:'allowance',label:'💰 תקציב/דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 הכנסה עסקית'}, {value:'other',label:'💸 אחר'}], 
    expense: [{value:'food',label:'🍔 אוכל ומסעדות'}, {value:'groceries',label:'🛒 סופר ורכש'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור/שכירות ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך/השתלמויות'}, {value:'vacation',label:'✈️ חופשות'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'}] 
};
const BUDGET_LABELS = {'food':'🍔 אוכל ומסעדות','groceries':'🛒 סופר ורכש','transport':'🚌 תחבורה ודלק','home':'🏠 דיור/שכירות ותחזוקה','bills':'📄 חשבונות ותקשורת','fun':'🎉 פנאי ובילויים','clothes':'👕 ביגוד והנעלה','health':'💊 בריאות וביטוחים','education':'📚 חינוך/השתלמויות','vacation':'✈️ חופשות','pets':'🐶 חיות מחמד','gifts':'🎁 מתנות ותרומות','other':'💸 אחר','allocations':'👶 תקציבים אישיים','allowance':'💰 הקצאות קבועות','tasks':'✅ בונוס משימות','academy':'🎓 תמריצי למידה','savings':'🐖 הפקדות לחיסכון'};
const PRODUCT_DB = { "ירקות ופירות 🍎":["עגבניות","מלפפונים","פלפל אדום","בצל יבש","תפוחי אדמה","בננות","לימון","תפוח עץ","אבוקדו"], "חלב וביצים 🥛":["חלב 3%","קוטג' 5%","גבינה לבנה 5%","גבינה צהובה","ביצים L","יוגורט","חמאה","שמנת"], "לחם ומאפים 🍞":["לחם אחיד","לחם מלא","פיתות","לחמניות"], "מזווה ובישול 🍝":["אורז","פסטה","פתיתים","עדשים","שמן זית","שמן קנולה","סוכר","מלח","קמח","קפה","תה"], "בשר ודגים 🍗":["חזה עוף","בשר טחון","שניצל","נקניקיות","סלמון"], "ניקיון וטואלטיקה 🧻":["נייר טואלט","מגבונים","נוזל כלים","אבקת כביסה","שמפו","משחת שיניים"], "חטיפים ומתוקים 🍫":["במבה","ביסלי","בייגלה","עוגיות","שוקולד"], "ציוד משרדי 📎":["דפי מדפסת","עטים שחורים","עטים כחולים","קלסרים","שדכן"], "מטבחון ☕":["קפה שחור","קפסולות קפה","חלב סויה","תה ירוק","סוכרזית"] };
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({name: i, category: cat})); }

// --- טעינת המערכת ---
window.onload = async () => { 
    initAccessibility();
    const bM = el('btn-forecast-monthly'), bY = el('btn-forecast-yearly');
    if(bM) bM.addEventListener('click', ()=>toggleForecastMode('monthly')); if(bY) bY.addEventListener('click', ()=>toggleForecastMode('yearly'));
    
    // מנגנון הגנה: מוודא שהטעינה לא תיתקע לעולם
    const failsafeTimer = setTimeout(() => { 
        const preloader = el('app-preloader'); 
        if (preloader && !preloader.classList.contains('hidden')) { 
            console.warn('Preloader Failsafe Executed'); 
            hidePreloaderAndShowAuth('login'); 
        } 
    }, 5000);
    
    const params = new URLSearchParams(window.location.search); const code = params.get('code'), role = params.get('role');
    if (code) { if(el('join-code')) el('join-code').value = code; if(role && el('join-role')) el('join-role').value = role; clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; }
    
    const token = localStorage.getItem('ofl_sa_token');
    if (token) {
        saToken = token; clearTimeout(failsafeTimer); if(el('auth-container')) el('auth-container').classList.add('hidden'); if(el('sa-dashboard-container')) el('sa-dashboard-container').classList.remove('hidden');
        const p = el('app-preloader'); if (p) { p.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => p.classList.add('hidden'), 700); }
        loadSAData(); return;
    }
    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const s = JSON.parse(saved); 
            if(s && s.user && s.user.id) { 
                currentUser = s.user; currentGroup = s.group; clearTimeout(failsafeTimer); loadDashboard(); return; 
            } 
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const e=el(`view-${v}`); if(e) e.classList.add('hidden'); }); const t=el(`view-${view}`); if(t) t.classList.remove('hidden'); }
function selectType(t) { if(el('create-type')) el('create-type').value=t; if(el('type-family')) el('type-family').className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; if(el('type-business')) el('type-business').className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='BUSINESS'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; }

function openTosModal(e) { if(e){e.preventDefault(); e.stopPropagation();} const m=el('tos-modal'); if(m) m.classList.remove('hidden'); }
function closeTosModal() { const m=el('tos-modal'); if(m) m.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); const tos=el('create-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { 
    e.preventDefault(); const tos=el('join-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart=true; toggleLoader('join',true);
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d=await res.json(); 
        if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
    } catch(err) { showToast('error', 'שגיאת תקשורת'); } finally { toggleLoader('join', false); }
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); toggleLoader('create', true);
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); await loadDashboard(); } else { showToast('error', data.error); hidePreloaderAndShowAuth('login'); } 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); hidePreloaderAndShowAuth('login'); } finally { toggleLoader('login', false); toggleLoader('create', false); } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { const sc = el('slider-scroll'); if(sc) sc.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const e = el(`content-${x}`); if(e) e.classList.add('hidden'); const btn = el(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const cT = el(`content-${t}`); if(cT) cT.classList.remove('hidden'); const tT = el(`tab-${t}`); if(tT) tT.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = el('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = el('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'recipes') renderRecipePantrySelection(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow(); if (t === 'timeclock') fetchTimeclockReport();
}

function updateBatteryUI() {
    const indicator = el('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200', 'bg-slate-800', 'text-white', 'border-transparent');
    
    const isBiz = currentGroup.type === 'BUSINESS';
    
    if (currentGroup.is_premium) { 
        indicator.innerHTML = isBiz ? '<i class="fa-solid fa-bolt"></i> ∞ (Enterprise)' : '⚡ ∞ (Pro)'; 
        if (isBiz) { indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } else { indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent'); }
    } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = el('ai-battery-modal'); const upgradeSec = el('ai-upgrade-section');
        if(upgradeSec) { if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden'); }
        if(modal) modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { const m = el('ai-battery-modal'); if(m) m.classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = el('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

function applyDynamicTerminology() {
    if (!currentGroup || currentGroup.type !== 'BUSINESS') return;
    document.body.classList.add('is-business');
    document.title = 'Oneflow | מערכת ניהול לעסקים';
    
    const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
    const setText = (id, text) => { const e = el(id); if (e) e.innerText = text; };

    setHtml('tab-shop', 'רכש 🛒'); setHtml('tab-pantry', 'מלאי ציוד 📦'); setHtml('tab-bank', 'תקציבים 💳');
    setHtml('tab-budget', 'בקרה תפעולית 📊'); setHtml('tab-tasks', 'משימות עובדים ✅'); setHtml('tab-academy', 'מרכז הכשרות 🎓');
    setHtml('tab-members', 'ניהול צוות 👥');
    
    const elTabTimeclock = el('tab-timeclock'); if (elTabTimeclock) elTabTimeclock.classList.remove('hidden');

    setText('balance-label', 'מאזן קופת הארגון');
    const childTodoSec = el('child-todo-section');
    if(childTodoSec) { const h3 = childTodoSec.querySelector('h3'); if(h3) h3.innerText = 'טיקטים ומשימות 🎯'; }
    setHtml('req-title', '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש לאישור הנהלה');
    
    BUDGET_LABELS['allowance'] = '💰 תקציב אישי לעובדים';
    BUDGET_LABELS['tasks'] = '✅ בונוס טיקטים';
    BUDGET_LABELS['academy'] = '🎓 תמריץ הכשרות';

    const inviteMod = el('invite-modal');
    if(inviteMod) {
        const h3 = inviteMod.querySelector('h3'); if(h3) h3.innerText = 'הזמנת עובדים 👨‍💼';
        const p = inviteMod.querySelector('p'); if(p) p.innerHTML = `קוד הארגון: <span id="display-group-code" class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded tracking-widest border border-slate-200">---</span>`;
        const btns = inviteMod.querySelectorAll('button');
        if(btns.length >= 2) {
            btns[0].innerHTML = '<i class="fa-solid fa-user-tie"></i> מנהל/ת (הרשאה מלאה)';
            btns[1].innerHTML = '<i class="fa-solid fa-user"></i> איש/אשת צוות (רגיל)';
        }
    }
}

async function loadDashboard() {
    try {
        const authC = el('auth-container'); if(authC) authC.classList.add('hidden'); 
        const dashC = el('dashboard-container'); if(dashC) dashC.classList.remove('hidden'); 
        const fabC = el('fab-container'); if(fabC) fabC.classList.remove('hidden');
        
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
        const dGroupName = el('dash-group-name'); if(dGroupName) dGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
        const dNickname = el('dash-nickname'); if(dNickname) dNickname.innerText = currentUser.nickname || 'משתמש'; 
        
        applyDynamicTerminology();

        const isAdmin = currentUser.role === 'ADMIN';
        const isBiz = currentGroup.type === 'BUSINESS';

        if(isAdmin) { 
            ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const e=el(id); if(e) e.classList.remove('hidden'); });
            
            if (!isBiz) { const reqTitle = el('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור'; }
            const profileUp = el('profile-upgrade-section');
            if (profileUp && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${isBiz ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
        } else { 
            ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const e=el(id); if(e) e.classList.remove('hidden'); });
            const profileUp = el('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
            
            const cardName = el('card-name'); if(cardName) cardName.innerText = (currentUser.nickname || '').toUpperCase(); 
            const cardAllow = el('card-allowance'); if(cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
            const cardInt = el('card-interest'); if(cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
            
            const reqTitle = el('req-title'); if(reqTitle) reqTitle.innerHTML = isBiz ? '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש שלי' : '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לרכש';
        }
        const btnAddBudg = el('btn-add-budget-cat'); if(btnAddBudg) btnAddBudg.classList.remove('hidden'); 
        updateBatteryUI();
        
        if (isBiz && !isAdmin) checkPunchStatus();
        
        try {
            if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
            fetchBanners(); await fetchMembers(); if(isAdmin) fetchPendingUsers(); await fetchData(); fetchLoans();
        } catch (e) {
            console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת חלק מהנתונים');
        } finally {
            const preloader = el('app-preloader'); 
            const finalizeLoad = async () => { const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } };
            if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
        }
    } catch(e) { 
        console.error('UI Setup Error:', e); 
        hidePreloaderAndShowAuth('login');
    }
}

// ================= TIMECLOCK LOGIC =================
async function checkPunchStatus() {
    try {
        const res = await fetch(`${API}/timeclock/status?userId=${currentUser.id}`); const data = await res.json();
        currentPunchStatus = data; updatePunchUI();
    } catch (e) {
        const btn = el('btn-punch');
        if(btn) { btn.innerText = 'שגיאת התחברות'; btn.classList.remove('punch-pulse', 'punch-btn-in', 'punch-btn-out'); btn.classList.add('bg-slate-200', 'text-slate-400'); }
    }
}
function updatePunchUI() {
    const btn = el('btn-punch'); const icon = el('punch-icon'); const text = el('punch-text'); const statusText = el('timeclock-status-text');
    if(!btn || !currentPunchStatus) return;
    btn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed', 'punch-btn-in', 'punch-btn-out', 'punch-pulse');
    if (currentPunchStatus.isPunchedIn) {
        btn.classList.add('punch-btn-out', 'punch-pulse'); if(icon) icon.className = 'fa-solid fa-door-open text-4xl mb-1'; if(text) text.innerText = 'יציאה';
        const inTime = new Date(currentPunchStatus.punchInTime).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        if(statusText) statusText.innerHTML = `בעבודה. <span class="text-xs font-normal">החתמת כניסה: ${inTime}</span>`;
    } else {
        btn.classList.add('punch-btn-in'); if(icon) icon.className = 'fa-solid fa-fingerprint text-4xl mb-1'; if(text) text.innerText = 'כניסה'; if(statusText) statusText.innerHTML = `לא בעבודה כרגע.`;
    }
}
async function togglePunch() {
    const btn = el('btn-punch'); if(btn && btn.classList.contains('cursor-not-allowed')) return;
    if(btn) btn.classList.add('cursor-not-allowed', 'opacity-70');
    try {
        const res = await fetch(`${API}/timeclock/punch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', data.isPunchedIn ? 'החתמת כניסה בהצלחה!' : 'החתמת יציאה נרשמה בהצלחה.'); checkPunchStatus(); fetchTimeclockReport(); } else { showToast('error', data.error || 'שגיאה בדיווח נוכחות'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { if(btn) btn.classList.remove('cursor-not-allowed', 'opacity-70'); }
}
async function fetchTimeclockReport() {
    try {
        const dFilter = el('tc-date-filter'); const period = dFilter ? dFilter.value : 'month';
        const uFilter = el('tc-user-filter'); const uFilterVal = uFilter ? uFilter.value : 'all';
        const targetUserId = currentUser.role === 'ADMIN' ? uFilterVal : currentUser.id;
        const res = await fetch(`${API}/timeclock/report?groupId=${currentGroup.id}&userId=${targetUserId}&period=${period}`); const data = await res.json();
        const list = el('timeclock-list'); const totalEl = el('tc-total-hours');
        if(!list || !totalEl) return;
        let totalMinutes = 0; let html = '';
        if (data.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">אין דיווחי נוכחות לתקופה זו.</p>'; totalEl.innerText = '00:00'; return; }
        data.forEach(r => {
            const inDate = new Date(r.punch_in); const dateStr = inDate.toLocaleDateString('he-IL'); const inStr = inDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
            let outStr = '--:--'; let durationStr = 'פעיל'; let statusBadge = '<span class="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">פעיל</span>';
            if (r.punch_out) {
                const outDate = new Date(r.punch_out); outStr = outDate.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
                if (r.total_minutes) { totalMinutes += parseInt(r.total_minutes); const h = Math.floor(r.total_minutes / 60); const m = r.total_minutes % 60; durationStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} שעות`; }
                statusBadge = '';
            }
            const userName = (currentUser.role === 'ADMIN' && r.nickname) ? `<span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-2">${r.nickname}</span>` : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 flex justify-between items-center"><div class="flex-1"><div class="flex items-center mb-1"><span class="font-bold text-slate-700 text-sm">${dateStr}</span>${userName}${statusBadge}</div><div class="text-xs text-slate-500 font-mono tracking-wider"><span class="text-green-600">${inStr}</span> <i class="fa-solid fa-arrow-left text-[8px] mx-1 text-slate-300"></i> <span class="text-red-500">${outStr}</span></div></div><div class="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">${durationStr}</div></div>`;
        });
        list.innerHTML = html; const totH = Math.floor(totalMinutes / 60); const totM = totalMinutes % 60; totalEl.innerText = `${String(totH).padStart(2, '0')}:${String(totM).padStart(2, '0')}`;
    } catch (e) {}
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = el('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${currentGroup.type === 'BUSINESS' ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
        }

        if (currentUser.role === 'ADMIN') {
            const totalAdminBalance = membersCache.filter(m => m.role === 'ADMIN').reduce((sum, m) => sum + (parseFloat(m.balance) || 0), 0);
            const balEl = el('user-balance'); if(balEl) balEl.innerText = `₪${totalAdminBalance}`;
        } else {
            const balEl = el('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        try {
            const goalsList = el(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? el('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-AI</button>`;
                        const btnText = currentGroup.type === 'BUSINESS' ? 'העבר תקציב' : 'הפקד';
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> ${btnText}</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = el('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = el('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = el('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חריגה מהיעד!' : 'עמידה ביעדים'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); const tcTab = el('tab-cashflow'); if (tcTab && tcTab.classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) { console.error('FetchData Error', e); }
}

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = el('budget-filter'); const fF = el('feed-user-filter'); const gS = el('goal-target-user'); const cfF = el('cashflow-user-filter'); const tcF = el('tc-user-filter');
                const isBiz = currentGroup.type === 'BUSINESS'; const teamLabel = isBiz ? 'כל הצוות' : 'כל המשפחה';
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">כללי</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (tcF) { const cur = tcF.value; tcF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => tcF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) tcF.value = cur; tcF.classList.remove('hidden'); }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">עבור מי היעד? (כללי)</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = el('members-list'); 
            if(c) { 
                c.innerHTML = ''; 
                membersCache.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                    c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'משתמש'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
                }); 
            }
        } catch(err) {}
        try {
            const a = el('bank-accounts-list'); 
            if (a && currentUser.role === 'ADMIN') { 
                a.innerHTML = ''; const children = membersCache.filter(m => m.role !== 'ADMIN');
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין משתמשים רשומים עדיין.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'משתמש'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/תקופה • ${m.interest_rate || 0}% בונוס/ריבית</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-blue-600">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition" title="ניהול יתרה"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json();
        const list = el('pending-list'); const container = el('admin-panel');
        if (users && users.length > 0) {
            if(container) container.classList.remove('hidden'); if(list) list.innerHTML = '';
            users.forEach(u => { const age = new Date().getFullYear() - u.birth_year; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-green-600 transition">אשר</button></div></div>`; });
        } else { if(container) container.classList.add('hidden'); }
    } catch(e) {}
}

async function fetchLoans() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        let url; if (currentUser.role === 'ADMIN') { url = `${API}/loans?groupId=${currentGroup.id}`; } else { url = `${API}/loans?userId=${currentUser.id}`; }
        const res = await fetch(url); const loans = await res.json(); renderLoans(loans);
    } catch(e) {}
}

async function fetchBundles() { try { const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json(); if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles; } catch(e) {} }

async function fetchBanners() {
    try {
        const groupType = (currentGroup && currentGroup.type) ? currentGroup.type : 'FAMILY';
        const cached = localStorage.getItem(`ofl_banners_${groupType}`); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=${groupType}`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem(`ofl_banners_${groupType}`, JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

// --- CRUD & Actions ---
window.openBalanceAdjustmentModal = function(id, name) { const uIdEl = el('adjustment-user-id'); if(uIdEl) uIdEl.value = id; const uNameEl = el('adjustment-user-name'); if(uNameEl) uNameEl.innerText = `עבור: ${name}`; const amtEl = el('adjustment-amount'); if(amtEl) amtEl.value = ''; const reasonEl = el('adjustment-reason'); if(reasonEl) reasonEl.value = ''; window.toggleAdjustmentType('deduct'); const mod = el('balance-adjustment-modal'); if(mod) mod.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מנהל' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); const mod = el('balance-adjustment-modal'); if(mod) mod.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

async function deleteUser(id, name) {
    if(!confirm(`האם למחוק את "${name}" מהמערכת לצמיתות?`)) return;
    try {
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'המשתמש נמחק'); fetchMembers(); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}

async function submitChangePassword(e) {
    e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...';
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הסיסמה שונתה!'); el('profile-modal').classList.add('hidden'); } else showToast('error', data.error);
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; }
}

async function sendCredentialsEmail() {
    if(!confirm('לשלוח את פרטי המשתמשים והסיסמאות למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח למייל...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'נשלח בהצלחה למייל!'); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

function openProfileModal() { el('old-password').value = ''; el('new-password').value = ''; el('profile-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { el('bank-user-id').value = id; el('bank-user-name').innerText = `הגדרות עבור ${name}`; el('bank-allowance').value = allowance; el('bank-interest').value = interest; el('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); el('bank-settings-modal').classList.add('hidden'); showToast('success', 'עודכן'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע העברת כספים שוטפים ובונוסים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else showToast('error', data.error); } catch(e) { showToast('error', 'שגיאה'); } }

function openGoalModal() { if(currentUser.role === 'ADMIN') { el('goal-user-select-container').classList.remove('hidden'); } el('goal-title').value = ''; el('goal-target').value = ''; el('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { el('deposit-goal-id').value = id; el('deposit-goal-title').innerText = title; el('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = el('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && el('goal-user-select-container').style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); el('goal-modal').classList.add('hidden'); fetchData(); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = val('deposit-amount'); if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); el('goal-deposit-modal').classList.add('hidden'); fetchData(); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    el('trans-type').value=t; el('trans-modal-title').innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s=el('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    el('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); el('transaction-modal').classList.remove('hidden'); 
}

window.toggleTransType = function(type) {
    const isRecurring = type === 'recurring'; el('trans-is-recurring').value = isRecurring;
    const btnOnClass = document.body.classList.contains('is-business') ? 'bg-white text-slate-800' : 'bg-white text-blue-600';
    const btnOffClass = document.body.classList.contains('is-business') ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-700';

    el('btn-trans-onetime').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition` : `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition`;
    el('btn-trans-recurring').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition` : `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition`;
    if (isRecurring) { el('trans-end-date-container').classList.remove('hidden'); } else { el('trans-end-date-container').classList.add('hidden'); el('trans-end-month').value = ''; }
};

async function submitTransaction() { 
    const amount = val('trans-amount'); if(!amount) return; if(val('trans-type') === 'expense') triggerShake(); else triggerConfetti(); 
    const isRecurring = el('trans-is-recurring').value === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null }) }); 
    el('transaction-modal').classList.add('hidden'); showToast('success', 'נשמר!'); fetchData(); 
}

function openShopModal() { el('shop-modal').classList.remove('hidden'); }
function openLoanModal() { el('loan-modal').classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); el('loan-modal').classList.add('hidden'); showToast('success', 'הבקשה נשלחה לאישור 📨'); fetchData(); fetchLoans(); }

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id;
    const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); const data = await res.json();
    const list = el('budget-list'); list.innerHTML = '';
    const baseCategories = CATEGORIES.expense.map(c => c.value);
    data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
    baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); }); const childrenCategories = ['allowance', 'tasks', 'academy']; childrenCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });
    let childrenTotalSpent = 0; let childrenTotalLimit = 0; let childrenItems = []; let otherItems = [];
    data.forEach(b => { if (childrenCategories.includes(b.category) || b.category === 'allocations') { childrenTotalSpent += parseFloat(b.spent) || 0; childrenTotalLimit += parseFloat(b.limit) || 0; childrenItems.push(b); } else { otherItems.push(b); } });

    const createRow = (category, spent, limit, isSub = false) => {
        const pct = limit > 0 ? (spent / limit) * 100 : 0; let color = 'bg-green-500'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
        const limitDisplay = limit > 0 ? `₪${limit}` : 'לא הוגדר'; const catName = BUDGET_LABELS[category] || category;
        const editBtn = (category !== 'allocations') ? `<button onclick="openBudgetModal('${category}', '${catName}', ${limit}); event.stopPropagation();" class="text-[10px] text-blue-600 font-bold ml-2 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition">ערוך יעד</button>` : '';
        const textSize = isSub ? 'text-sm' : 'text-base'; const containerClass = isSub ? 'pl-2 border-r-2 border-indigo-200 pr-2 mb-3' : 'mb-5';
        return `<div class="${containerClass}"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 ${textSize}">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-100 rounded-full ${isSub ? 'h-1.5' : 'h-2.5'} overflow-hidden shadow-inner"><div class="${color} ${isSub ? 'h-1.5' : 'h-2.5'} rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
    };

    if (childrenItems.length > 0) {
        const pct = childrenTotalLimit > 0 ? (childrenTotalSpent / childrenTotalLimit) * 100 : 0; let color = 'bg-indigo-500'; if (pct > 80) color = 'bg-indigo-400'; if (pct > 100) color = 'bg-purple-600';
        const limitDisplay = childrenTotalLimit > 0 ? `₪${childrenTotalLimit}` : 'לא הוגדר'; let subItemsHtml = ''; childrenItems.forEach(cb => { subItemsHtml += createRow(cb.category, cb.spent, cb.limit, true); });
        const childrenSectionTitle = currentUser.role === 'ADMIN' ? (currentGroup.type === 'BUSINESS' ? 'הוצאות כלליות/משתמשים' : 'הוצאות על הילדים') : 'הכנסות מההורים/צוות';
        list.innerHTML += `<div class="mb-8 bg-indigo-50/50 p-4 rounded-[1.5rem] border border-indigo-100/60 shadow-sm transition-all hover:bg-indigo-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-indigo-900 flex items-center gap-2"><i class="fa-solid fa-chart-pie text-indigo-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-indigo-100">${subItemsHtml}</div></div>`;
    }
    otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });
}

function openBudgetModal(catId, catName, currentLimit) { el('budget-cat-name').innerText = catName; el('budget-cat-id').value = catId; el('budget-limit').value = currentLimit > 0 ? currentLimit : ''; el('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { const cat = val('budget-cat-id'); const limit = val('budget-limit'); const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); el('budget-modal').classList.add('hidden'); fetchBudget(); }
function openAddBudgetCategoryModal() { el('new-budget-cat-name').value = ''; el('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { const catName = val('new-budget-cat-name'); if(!catName) return; const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); el('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); }

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    el('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    el('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    el('forecast-month-filter').classList.toggle('hidden', mode !== 'monthly');
    el('forecast-year-filter').classList.toggle('hidden', mode !== 'yearly');
    renderForecast();
};

function populateForecastPeriods() {
    const mSelect = el('forecast-month-filter'); const ySelect = el('forecast-year-filter');
    if (mSelect && mSelect.options.length === 0) { const now = new Date(); for(let i=0; i<12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); const monthStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); mSelect.innerHTML += `<option value="${monthStr}">${label}</option>`; } }
    if (ySelect && ySelect.options.length === 0) { const curYear = new Date().getFullYear(); for(let i=0; i<5; i++) { ySelect.innerHTML += `<option value="${curYear + i}">שנת ${curYear + i}</option>`; } }
}

async function renderForecast() {
    populateForecastPeriods();
    const list = el('forecast-list');
    if(!list) return;
    if(!currentGroup || !currentGroup.id) return;
    const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
    const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
    
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
        html = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">אין פעולות עתידיות צפויות בתקופה זו</p>';
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
    el('forecast-net-change').innerText = `₪${projectedNetChange.toFixed(2)}`;
    el('forecast-net-change').className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`;
    el('forecast-projected-balance').innerText = `₪${projectedBalance.toFixed(2)}`;
    drawForecastCharts({ income: totalIncome }, { expense: totalExpense });
}

function drawForecastCharts(incomeData, expenseData) {
    const container = el('forecast-charts'); if(!container) return;
    container.className = "mt-6 border-t border-slate-100 pt-6 flex justify-center";
    container.innerHTML = `<div class="w-full max-w-[250px]"><h4 class="text-sm font-bold text-center text-slate-600 mb-2">הכנסות מול הוצאות</h4><div class="relative h-48 w-full flex justify-center"><canvas id="ratioChart"></canvas></div></div>`;
    const ctx = el('ratioChart'); if(!ctx) return;
    if(forecastRatioChart) forecastRatioChart.destroy();
    const totalInc = Object.values(incomeData).reduce((a, b) => a + b, 0); const totalExp = Object.values(expenseData).reduce((a, b) => a + b, 0);
    if(totalInc > 0 || totalExp > 0) {
        forecastRatioChart = new Chart(ctx, {
            type: 'doughnut', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [totalInc, totalExp], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { family: 'Rubik' } } }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += '₪' + context.parsed.toFixed(1); } return label; } } } } }
        });
    } else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">אין תנועות עתידיות להצגת גרף</p>'; }
}

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('תובנות עתיד', null); const loadText = el('familai-loading-text'); if(loadText) loadText.innerText = 'מחשבת את התזרים הצפוי לתקופה...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('תובנות תזרים', data.insight); }
            else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בניתוח התשקיף'); }
        } catch(e) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

// --- פונקציות AI (שף, אקדמיה, מטלות, ראייה ממוחשבת) ---
function showFamilAIModal(title, text) {
    const mod = el('familai-advisor-modal'); const sub = el('familai-modal-subtitle');
    if(mod) mod.classList.remove('hidden'); if(sub) sub.innerText = title;
    const load = el('familai-advisor-loading'); const textEl = el('familai-advice-text'); const cont = el('familai-advisor-content');
    if (text) { if(load) load.classList.add('hidden'); if(textEl) textEl.innerText = text; if(cont) cont.classList.remove('hidden'); } 
    else { if(load) load.classList.remove('hidden'); if(cont) cont.classList.add('hidden'); }
}

function openAIModal() { const mod = el('ai-modal'); if(mod) mod.classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = el('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); if(btn) { btn.disabled = true; btn.innerText = 'מייצר מערך... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'ההכשרה מוכנה!'); const mod = el('ai-modal'); if(mod) mod.classList.add('hidden'); const topicEl = el('ai-topic'); if(topicEl) topicEl.value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת האתגר');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'צור אתגר'; } }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית', null); const loadText = el('familai-loading-text'); if(loadText) loadText.innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית', data.advice); triggerConfetti(); fetchData(); } 
            else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסטית התקציב', null); const loadText = el('familai-loading-text'); if(loadText) loadText.innerText = 'בודקת את הנתונים...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
            else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהלת המלאי', null); const loadText = el('familai-loading-text'); if(loadText) loadText.innerText = 'מחשבת כמויות...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהלת המלאי', data.insight); fetchData(); }
            else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בניתוח'); }
        } catch(e) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; const btn = el('btn-tutor'); if(btn) { btn.disabled = true; btn.innerText = 'מכינה הסבר... ⏳'; }
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('חונך דיגיטלי', data.explanation); fetchData(); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> הצג ניתוח שגיאה (AI)'; } }
    });
}

function setTaskMode(mode) {
    const mBtn = el('btn-mode-manual'); const aBtn = el('btn-mode-ai'); const mDiv = el('task-mode-manual'); const aDiv = el('task-mode-ai');
    if (mode === 'manual') { if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; if(mDiv) mDiv.classList.remove('hidden'); if(aDiv) aDiv.classList.add('hidden'); } 
    else { if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; if(aDiv) aDiv.classList.remove('hidden'); if(mDiv) mDiv.classList.add('hidden'); }
}

function closeTaskModal() { const mod = el('task-modal'); if(mod) mod.classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    const mod = el('task-modal'); if(mod) mod.classList.remove('hidden'); const tIs = el('task-is-self'); if(tIs) tIs.value = isSelf; 
    const tDays = el('task-days'); if(tDays) tDays.value = ''; const tTitle = el('task-title'); if(tTitle) tTitle.value = ''; const tRew = el('task-reward'); if(tRew) tRew.value = ''; const aiTop = el('ai-task-topic'); if(aiTop) aiTop.value = ''; const aiRes = el('ai-task-results'); if(aiRes) aiRes.classList.add('hidden');
    setTaskMode('manual'); const toggles = el('task-mode-toggles'); const assigneeContainer = el('task-assignee-container'); const assigneeSelect = el('task-assignee');

    const modTitle = el('task-modal-title');
    if(isSelf) { 
        if(modTitle) modTitle.innerText = 'ביצוע טיקט/יעד'; if(toggles) toggles.classList.add('hidden'); if(assigneeContainer) assigneeContainer.classList.add('hidden'); if(tRew) tRew.placeholder = 'כמה מגיע לי? (₪)'; 
    } else { 
        if(modTitle) modTitle.innerText = 'יצירת משימה'; if(toggles) toggles.classList.remove('hidden'); if(assigneeContainer) assigneeContainer.classList.remove('hidden'); if(tRew) tRew.placeholder = 'תגמול (₪)';
        if(membersCache && assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו חבר...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין משתמשים להקצאה</option>';
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = el('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = el('task-is-self').value === 'true'; 
        let age;
        if (isSelf) age = new Date().getFullYear() - currentUser.birth_year;
        else {
             if(!assigneeId) return showToast('error', 'קודם כל בחרו למעלה עבור מי המשימה 👆');
             const child = membersCache.find(m => String(m.id) === String(assigneeId)); if(!child) return showToast('error', 'שגיאה במציאת גיל המשתמש');
             age = new Date().getFullYear() - child.birth_year;
        }
        if(!topic) return showToast('error', 'כתבו באיזה נושא לעזור');
        if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> חושבת...'; }
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = el('ai-task-results'); 
                if(resultsContainer) {
                    resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
                    data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                    resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchData();
                }
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפש רעיונות'; } }
    });
}

function selectAITask(title, reward) { const tt = el('task-title'); if(tt) tt.value = title; const tr = el('task-reward'); if(tr) tr.value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = el('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור משתמש למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור מנהל!' : 'משימה נוצרה בהצלחה!'); fetchData(); 
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

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; const tu = el('task-proof-upload'); if(tu) tu.click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות', null); const flt = el('familai-loading-text'); if(flt) flt.innerText = 'בודקת את הביצוע...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('סורק מסמכים', null); const flt = el('familai-loading-text'); if(flt) flt.innerText = 'מפענחת את הקבלה... זה ייקח רגע.';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('סורק מסמכים', `סרקתי והוספתי ${data.count} רשומות מהמסמך!`); triggerConfetti(); fetchData(); } else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאה בקריאת הקבלה.'); }
            } catch(err) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי אוטומטי', null); const flt = el('familai-loading-text'); if(flt) flt.innerText = 'מפענחת את התמונה...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden');
                    if (target === 'shop') { const e = el('shop-item'); if(e) e.value = data.productName; openShopModal(); } else { const e = el('pantry-item'); if(e) e.value = data.productName; openPantryModal(); }
                    showToast('success', 'האובייקט זוהה בהצלחה!');
                } else { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר בתמונה.'); }
            } catch(err) { const mod = el('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); showToast('error', 'שגיאת תקשורת מול השרת.'); }
            event.target.value = '';
        });
    });
}

function closeBarcodeScanner() { const modal = el('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

// --- פעולות רכש וקניות ---
function filterSuggestions(v) { const list = el('suggestions'); if(!list) return; list.innerHTML = ''; if (!v) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(v)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { el('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = el('shop-item'); const btn = document.querySelector('#shop-modal button.bg-slate-800') || document.querySelector('#shop-modal button.bg-pink-500'); 
    const item = itemInput ? itemInput.value : ''; const qty = val('shop-quantity'); const est = val('shop-est-price'); const unit = val('shop-unit') || "יח'"; 
    if(!item) return; if (btn && btn.disabled) return; if(btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); 
        if (data.success) { const sm = el('shop-modal'); if(sm) sm.classList.add('hidden'); if(itemInput) itemInput.value = ''; const estP = el('shop-est-price'); if(estP) estP.value = ''; const sQ = el('shop-quantity'); if(sQ) sQ.value = 1; const sU = el('shop-unit'); if(sU) sU.value = "יח'"; const sug = el('suggestions'); if(sug) sug.classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } 
    } finally { if(btn) { btn.disabled = false; btn.innerText = currentGroup && currentGroup.type === 'BUSINESS' ? 'הוסף לרשימה' : 'הוסף'; } } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל הפריטים (הפעילים והחסרים) מהרשימה? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה רוקנה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); if(cb) cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); if(inp) inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) { 
                count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
                const pInput = row.querySelector('.price-input'); const unitPrice = pInput ? (parseFloat(pInput.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
            } 
        }
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סומן אף פריט'); return; } 
    const sC = el('summ-count'); if(sC) sC.innerText = count; const sM = el('summ-missing'); if(sM) sM.innerText = missing; const sT = el('summ-total'); if(sT) sT.innerText = `₪${total.toFixed(2)}`; const mod = el('confirm-checkout-modal'); if(mod) mod.classList.remove('hidden'); 
}

function openPasteListModal() { const txt = el('paste-list-text'); if(txt) txt.value = ''; const mod = el('paste-list-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitPastedList() {
    const textEl = el('paste-list-text'); const text = textEl ? textEl.value : '';
    if (!text.trim()) return showToast('error', 'אנא הדביקו רשימה כדי להמשיך');
    const items = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const btn = el('btn-submit-paste'); if(btn) { btn.disabled = true; btn.innerText = 'קולט נתונים...'; }
    try {
        for (let itemName of items) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id}) }); }
        const mod = el('paste-list-modal'); if(mod) mod.classList.add('hidden'); showToast('success', `נקלטו ${items.length} רשומות בהצלחה!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'קליטת נתונים'; } }
}

async function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה, אין מה לשתף.');
    let text = `*רשימת הדרישות מ-Oneflow:*\n\n`; activeItems.forEach(i => { text += `• ${i.item_name} - ${i.quantity} ${i.unit || "יח'"}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function submitFinalCheckout() {
    const stEl = el('checkout-store'); const store = stEl ? stEl.value || 'ספק/חנות' : 'ספק/חנות'; const brEl = el('checkout-branch'); const branch = brEl ? brEl.value : ''; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const pr = el(`price-${id}`); const unitPrice = pr ? (parseFloat(pr.value) || 0) : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
                boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
            }
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const mod = el('confirm-checkout-modal'); if(mod) mod.classList.add('hidden'); triggerConfetti(); showToast('success', 'הביצוע הושלם והמלאי עודכן!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); const mod = el('history-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

async function openHistoryModal() { 
    const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); 
    const list = el('history-list'); if(!list) return; list.innerHTML = ''; 
    if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; 
    trips.forEach(t => { 
        let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); 
        list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">העתק רשימה זו</button></div></div>`; 
    }); 
    const mod = el('history-modal'); if(mod) mod.classList.remove('hidden'); 
}

// --- פעולות אקדמיה ו-AI נוספות ---
function openAssignModalSpecific(bundleId) { const cSelect = el('assign-child-select'); if(cSelect) { cSelect.innerHTML = '<option value="" disabled selected>בחר משתמש להקצאה...</option>'; if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); } } const bSelect = el('assign-bundle-select'); if(bSelect) { bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר/מבחן...</option>'; if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${b.title} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; } } const aRew = el('assign-reward'); if(aRew) aRew.value = ''; const aDays = el('assign-days'); if(aDays) aDays.value = ''; const mod = el('assign-quiz-modal'); if(mod) mod.classList.remove('hidden'); setTimeout(() => { const select = el('assign-bundle-select'); if (select) { select.value = bundleId; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { const rew = el('assign-reward'); if(rew) rew.value = bundle.reward; } } }, 100); }

function openAssignModal() { const cSelect = el('assign-child-select'); if(cSelect) { cSelect.innerHTML = '<option value="" disabled selected>בחר משתמש להקצאה...</option>'; if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); } } const bSelect = el('assign-bundle-select'); if(bSelect) { bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר/מבחן...</option>'; if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${b.title} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; } } const aRew = el('assign-reward'); if(aRew) aRew.value = ''; const aDays = el('assign-days'); if(aDays) aDays.value = ''; const mod = el('assign-quiz-modal'); if(mod) mod.classList.remove('hidden'); }

async function submitAssignQuiz() {
    const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); const reward = val('assign-reward'); const days = val('assign-days');
    if(!childId) return showToast('error', 'אנא בחר משתמש להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days }) });
    const mod = el('assign-quiz-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData();
}
