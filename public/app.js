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
    
    /* סגנונות דינמיים לעסקים */
    body.is-business #tour-balance-card { background: linear-gradient(135deg, #1e293b, #0f172a); }
    body.is-business .tab-active { background: #0f172a; border-color: #0f172a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4); color: white; }
    body.is-business #app-banner-top, body.is-business #app-banner-bottom { background: linear-gradient(to right, #0f172a, #334155); }
    body.is-business .fab-open #fab-menu button { border: 1px solid #475569; }
    
    /* Timeclock specific styles */
    .punch-btn-in { background-color: #10b981; color: white; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4); }
    .punch-btn-out { background-color: #ef4444; color: white; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.4); }
    .punch-pulse { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
let currentUser=null, currentGroup=null, pollInterval=null, saToken=null, saAllGroups=[], saAllUsers=[];
let membersCache=[], shoppingListCache=[], wisdomCache={}, bundlesCache=[], allBundles=[], pantryCache=[];
let allTasks=[], allTransactions=[], feedCache=[], forecastCache={startingBalance:0, items:[]};
let currentVerifyTaskId=null, currentVerifyTaskTitle=null, currentWrongAnswers=[], forceTourStart=false;
let forecastRatioChart=null, currentForecastMode='monthly', currentScanTarget='', currentPunchStatus=null, deferredPrompt=null;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

function setupPwaInstallSection() {
    const sec=document.getElementById('pwa-install-section'), ios=document.getElementById('pwa-ios-instructions'), and=document.getElementById('pwa-android-instructions'), btn=document.getElementById('btn-install-pwa');
    if(!sec||!ios||!and||!btn) return;
    if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    if(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())) { ios.classList.remove('hidden'); and.classList.add('hidden'); } 
    else { ios.classList.add('hidden'); and.classList.remove('hidden'); btn.onclick = async () => { if(deferredPrompt){ deferredPrompt.prompt(); const {outcome} = await deferredPrompt.userChoice; if(outcome==='accepted') sec.classList.add('hidden'); deferredPrompt=null; } else showToast('info', 'כדי להתקין, פתחו את תפריט הדפדפן ובחרו התקן אפליקציה.'); }; }
}

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { income: [{value:'salary',label:'💼 משכורת/שכר'}, {value:'allowance',label:'💰 תקציב/דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 הכנסה עסקית'}, {value:'other',label:'💸 אחר'}], expense: [{value:'food',label:'🍔 מסעדות'}, {value:'groceries',label:'🛒 סופר ורכש'}, {value:'transport',label:'🚌 תחבורה'}, {value:'home',label:'🏠 דיור/תחזוקה'}, {value:'bills',label:'📄 חשבונות'}, {value:'fun',label:'🎉 פנאי'}, {value:'clothes',label:'👕 ביגוד'}, {value:'health',label:'💊 בריאות'}, {value:'education',label:'📚 חינוך'}, {value:'vacation',label:'✈️ חופשות'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות'}, {value:'other',label:'💸 אחר'}] };
const BUDGET_LABELS = {'food':'🍔 מסעדות','groceries':'🛒 סופר/רכש','transport':'🚌 תחבורה','home':'🏠 דיור/תחזוקה','bills':'📄 חשבונות','fun':'🎉 פנאי','clothes':'👕 ביגוד','health':'💊 בריאות','education':'📚 חינוך','vacation':'✈️ חופשות','pets':'🐶 חיות מחמד','gifts':'🎁 מתנות','other':'💸 אחר','allocations':'👶 יעדים אישיים','allowance':'💰 תקציבים קבועים','tasks':'✅ בונוס משימות','academy':'🎓 תמריצי הכשרה','savings':'🐖 חסכונות'};
const PRODUCT_DB = { "ירקות ופירות 🍎":["עגבניות","מלפפונים","פלפל אדום","בצל יבש","תפוחי אדמה","בננות","לימון","תפוח עץ","אבוקדו"], "חלב וביצים 🥛":["חלב 3%","קוטג' 5%","גבינה לבנה 5%","גבינה צהובה","ביצים L","יוגורט","חמאה","שמנת"], "לחם ומאפים 🍞":["לחם אחיד","לחם מלא","פיתות","לחמניות"], "מזווה ובישול 🍝":["אורז","פסטה","פתיתים","עדשים","שמן זית","שמן קנולה","סוכר","מלח","קמח","קפה","תה"], "בשר ודגים 🍗":["חזה עוף","בשר טחון","שניצל","נקניקיות","סלמון"], "ניקיון 🧻":["נייר טואלט","מגבונים","נוזל כלים","אבקת כביסה","שמפו","משחת שיניים"], "חטיפים 🍫":["במבה","ביסלי","בייגלה","עוגיות","שוקולד"], "משרדי 📎":["דפי מדפסת","עטים שחורים","עטים כחולים","קלסרים","שדכן"], "מטבחון ☕":["קפה שחור","קפסולות קפה","חלב סויה","תה ירוק","סוכרזית"] };
const FLAT_PRODUCTS = []; for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({name: i, category: cat})); }
let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

function showToast(t,m) { const tm=document.getElementById('toast'), ic=document.getElementById('toast-icon'); if(!tm||!ic)return; tm.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; ic.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>tm.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const tx=document.getElementById(`btn-${a}-text`), ld=document.getElementById(`btn-${a}-loader`); if(tx&&ld){tx.classList.toggle('hidden',s); ld.classList.toggle('hidden',!s);} }
function triggerConfetti() { if(typeof confetti!=='undefined') confetti({particleCount:100,spread:70,origin:{y:0.6}}); }
function triggerShake() { const a=document.getElementById('main-wrapper'); if(a){a.classList.add('shake-effect'); setTimeout(()=>a.classList.remove('shake-effect'),500);} }
function toggleFab() { const fc=document.getElementById('fab-container'); if(fc)fc.classList.toggle('fab-open'); }

const hidePreloaderAndShowAuth = (view='login') => { const a=document.getElementById('auth-container'); if(a)a.classList.remove('hidden'); switchView(view); const p=document.getElementById('app-preloader'); if(p){p.classList.add('opacity-0','pointer-events-none'); setTimeout(()=>p.classList.add('hidden'),700);} };

window.onload = async () => { 
    initAccessibility();
    const bM=document.getElementById('btn-forecast-monthly'), bY=document.getElementById('btn-forecast-yearly');
    if(bM) bM.addEventListener('click', ()=>toggleForecastMode('monthly')); if(bY) bY.addEventListener('click', ()=>toggleForecastMode('yearly'));
    
    const fsTimer = setTimeout(() => { const p=document.getElementById('app-preloader'); if(p && !p.classList.contains('hidden')){ console.warn('Failsafe'); hidePreloaderAndShowAuth('login'); } }, 5000);
    const params = new URLSearchParams(window.location.search); const code = params.get('code'), role = params.get('role');
    if (code) { if(document.getElementById('join-code')) document.getElementById('join-code').value=code; if(role&&document.getElementById('join-role')) document.getElementById('join-role').value=role; clearTimeout(fsTimer); hidePreloaderAndShowAuth('join'); return; }
    
    const token = localStorage.getItem('ofl_sa_token');
    if (token) { saToken=token; clearTimeout(fsTimer); if(document.getElementById('auth-container')) document.getElementById('auth-container').classList.add('hidden'); if(document.getElementById('sa-dashboard-container')) document.getElementById('sa-dashboard-container').classList.remove('hidden'); const p=document.getElementById('app-preloader'); if(p){ p.classList.add('opacity-0', 'pointer-events-none'); setTimeout(()=>p.classList.add('hidden'),700); } loadSAData(); return; }
    
    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { try { const s=JSON.parse(saved); if(s&&s.user&&s.user.id) { currentUser=s.user; currentGroup=s.group; clearTimeout(fsTimer); loadDashboard(); return; } } catch(e) { localStorage.removeItem('ofl_session'); } }
    clearTimeout(fsTimer); hidePreloaderAndShowAuth('login');
};

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const el=document.getElementById(`view-${v}`); if(el)el.classList.add('hidden'); }); const t=document.getElementById(`view-${view}`); if(t)t.classList.remove('hidden'); }
function selectType(t) { const c=document.getElementById('create-type'); if(c)c.value=t; const f=document.getElementById('type-family'); if(f)f.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; const b=document.getElementById('type-business'); if(b)b.className=`flex-1 p-4 rounded-2xl border-2 text-center transition hover:bg-slate-50 ${t==='BUSINESS'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold'}`; }

function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } const modal = document.getElementById('tos-modal'); if(modal) modal.classList.remove('hidden'); }
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); const tos = document.getElementById('create-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { 
    e.preventDefault(); const tos = document.getElementById('join-tos'); if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; toggleLoader('join', true);
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
function scrollTabs(direction) { const sc = document.getElementById('slider-scroll'); if(sc) sc.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','timeclock','tasks','shop','bank','cashflow','academy','members','budget','pantry','recipes','forecast'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const cT = document.getElementById(`content-${t}`); if(cT) cT.classList.remove('hidden'); const tT = document.getElementById(`tab-${t}`); if(tT) tT.classList.add('tab-active'); 
    
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') renderPantry(); if (t === 'recipes') renderRecipePantrySelection(); if (t === 'forecast') renderForecast(); if (t === 'cashflow') renderCashflow(); if (t === 'timeclock') fetchTimeclockReport();
}

function applyDynamicTerminology() {
    if (!currentGroup || currentGroup.type !== 'BUSINESS') return;
    document.body.classList.add('is-business'); document.title = 'Oneflow | מערכת ניהול לעסקים';
    
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setHtml('tab-shop', 'רכש 🛒'); setHtml('tab-pantry', 'מלאי ציוד 📦'); setHtml('tab-bank', 'תקציבים 💳');
    setHtml('tab-budget', 'בקרה תפעולית 📊'); setHtml('tab-tasks', 'משימות עובדים ✅'); setHtml('tab-academy', 'מרכז הכשרות 🎓');
    setHtml('tab-members', 'ניהול צוות 👥');
    
    const elTabTimeclock = document.getElementById('tab-timeclock'); if (elTabTimeclock) elTabTimeclock.classList.remove('hidden');

    setText('balance-label', 'מאזן קופת הארגון');
    const childTodoSec = document.getElementById('child-todo-section');
    if(childTodoSec) { const h3 = childTodoSec.querySelector('h3'); if(h3) h3.innerText = 'טיקטים ומשימות 🎯'; }
    setHtml('req-title', '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש לאישור הנהלה');
    
    BUDGET_LABELS['allowance'] = '💰 תקציב אישי לעובדים'; BUDGET_LABELS['tasks'] = '✅ בונוס טיקטים'; BUDGET_LABELS['academy'] = '🎓 תמריץ הכשרות';

    const inviteMod = document.getElementById('invite-modal');
    if(inviteMod) {
        const h3 = inviteMod.querySelector('h3'); if(h3) h3.innerText = 'הזמנת עובדים 👨‍💼';
        const p = inviteMod.querySelector('p'); if(p) p.innerHTML = `קוד הארגון: <span id="display-group-code" class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded tracking-widest border border-slate-200">---</span>`;
        const btns = inviteMod.querySelectorAll('button');
        if(btns.length >= 2) { btns[0].innerHTML = '<i class="fa-solid fa-user-tie"></i> מנהל/ת (הרשאה מלאה)'; btns[1].innerHTML = '<i class="fa-solid fa-user"></i> איש/אשת צוות (רגיל)'; }
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
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

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { const el = document.getElementById('welcome-modal-text'); if(el) el.innerText = data.message; setupPwaInstallSection(); const mod = document.getElementById('welcome-modal'); if(mod) mod.classList.remove('hidden'); window.pendingWelcomeMsg = data.message; return true; }
        }
    } catch(e) {} return false;
}

function closeWelcomeModal() { const mod = document.getElementById('welcome-modal'); if(mod) mod.classList.add('hidden'); if (window.pendingWelcomeMsg) { localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); } checkAndStartTour(forceTourStart); forceTourStart = false; }
function checkAndStartTour(force = false) { setTimeout(() => { try { const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`; if (force || !localStorage.getItem(tourKey)) { localStorage.setItem(tourKey, 'true'); switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); } } catch(e) {} }, 1000); }
function triggerManualTour() { const mod = document.getElementById('profile-modal'); if(mod) mod.classList.add('hidden'); setTimeout(() => { switchTab('feed'); if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 300); }
function openAlertModal(title, text) { const titleEl = document.getElementById('generic-alert-title'); const textEl = document.getElementById('generic-alert-text'); const modal = document.getElementById('generic-alert-modal'); if(titleEl && textEl && modal) { titleEl.innerText = title; textEl.innerText = text; modal.classList.remove('hidden'); } }

async function loadDashboard() {
    try {
        const authC = document.getElementById('auth-container'); if(authC) authC.classList.add('hidden'); 
        const dashC = document.getElementById('dashboard-container'); if(dashC) dashC.classList.remove('hidden'); 
        const fabC = document.getElementById('fab-container'); if(fabC) fabC.classList.remove('hidden');
        
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
        const dGroupName = document.getElementById('dash-group-name'); if(dGroupName) dGroupName.innerHTML = `${currentGroup.name} ${codeBadge}`; 
        const dNickname = document.getElementById('dash-nickname'); if(dNickname) dNickname.innerText = currentUser.nickname || 'משתמש'; 
        
        applyDynamicTerminology();

        const isAdmin = currentUser.role === 'ADMIN';
        const isBiz = currentGroup.type === 'BUSINESS';

        if(isAdmin) { 
            ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            if (!isBiz) { const reqTitle = document.getElementById('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור'; }
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${isBiz ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
        } else { 
            ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
            
            const cardName = document.getElementById('card-name'); if(cardName) cardName.innerText = (currentUser.nickname || '').toUpperCase(); 
            const cardAllow = document.getElementById('card-allowance'); if(cardAllow) cardAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
            const cardInt = document.getElementById('card-interest'); if(cardInt) cardInt.innerText = `${currentUser.interest_rate || 0}%`; 
            
            const reqTitle = document.getElementById('req-title'); if(reqTitle) reqTitle.innerHTML = isBiz ? '<i class="fa-solid fa-hourglass-half"></i> בקשות רכש שלי' : '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לרכש';
        }
        const btnAddBudg = document.getElementById('btn-add-budget-cat'); if(btnAddBudg) btnAddBudg.classList.remove('hidden'); 
        updateBatteryUI();
        
        if (isBiz && !isAdmin) checkPunchStatus();
        
        try {
            fetchBanners(); await fetchMembers(); if(isAdmin) fetchPendingUsers(); await fetchData(); fetchLoans();
            if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
        } catch (e) {
            console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת נתונים');
        } finally {
            const preloader = document.getElementById('app-preloader'); 
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
        const btn = document.getElementById('btn-punch');
        if(btn) { btn.innerText = 'שגיאה'; btn.classList.remove('punch-pulse', 'punch-btn-in', 'punch-btn-out'); btn.classList.add('bg-slate-200', 'text-slate-400'); }
    }
}
function updatePunchUI() {
    const btn = document.getElementById('btn-punch'); const icon = document.getElementById('punch-icon'); const text = document.getElementById('punch-text'); const statusText = document.getElementById('timeclock-status-text');
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
    const btn = document.getElementById('btn-punch'); if(btn && btn.classList.contains('cursor-not-allowed')) return;
    if(btn) btn.classList.add('cursor-not-allowed', 'opacity-70');
    try {
        const res = await fetch(`${API}/timeclock/punch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', data.isPunchedIn ? 'החתמת כניסה בהצלחה!' : 'החתמת יציאה נרשמה בהצלחה.'); checkPunchStatus(); fetchTimeclockReport(); } else { showToast('error', data.error || 'שגיאה בדיווח נוכחות'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); } finally { if(btn) btn.classList.remove('cursor-not-allowed', 'opacity-70'); }
}
async function fetchTimeclockReport() {
    try {
        const dFilter = document.getElementById('tc-date-filter'); const period = dFilter ? dFilter.value : 'month';
        const uFilter = document.getElementById('tc-user-filter'); const uFilterVal = uFilter ? uFilter.value : 'all';
        const targetUserId = currentUser.role === 'ADMIN' ? uFilterVal : currentUser.id;
        const res = await fetch(`${API}/timeclock/report?groupId=${currentGroup.id}&userId=${targetUserId}&period=${period}`); const data = await res.json();
        const list = document.getElementById('timeclock-list'); const totalEl = document.getElementById('tc-total-hours');
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
// ================= END TIMECLOCK LOGIC =================
window.openBalanceAdjustmentModal = function(id, name) { const uIdEl = document.getElementById('adjustment-user-id'); if(uIdEl) uIdEl.value = id; const uNameEl = document.getElementById('adjustment-user-name'); if(uNameEl) uNameEl.innerText = `עבור: ${name}`; const amtEl = document.getElementById('adjustment-amount'); if(amtEl) amtEl.value = ''; const reasonEl = document.getElementById('adjustment-reason'); if(reasonEl) reasonEl.value = ''; window.toggleAdjustmentType('deduct'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() {
    const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס מההנהלה' : 'הפחתה יזומה');
    if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    try {
        const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'היתרה עודכנה בהצלחה!'); const mod = document.getElementById('balance-adjustment-modal'); if(mod) mod.classList.add('hidden'); fetchData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת עם השרת'); }
};

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user'); const cfF = document.getElementById('cashflow-user-filter'); const tcF = document.getElementById('tc-user-filter');
                const isBiz = currentGroup.type === 'BUSINESS'; const teamLabel = isBiz ? 'כל הצוות' : 'כל המשפחה';
                if (bF) { const cur = bF.value; bF.innerHTML = `<option value="all">כללי</option>`; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (tcF) { const cur = tcF.value; tcF.innerHTML = `<option value="all">${teamLabel}</option>`; membersCache.forEach(m => tcF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) tcF.value = cur; tcF.classList.remove('hidden'); }
                if (gS) { const cur = gS.value; gS.innerHTML = `<option value="">עבור מי היעד? (כללי)</option>`; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        try {
            const c = document.getElementById('members-list'); 
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
            const a = document.getElementById('bank-accounts-list'); 
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

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח למייל...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement && document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI();
            const profileUp = document.getElementById('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = `<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> ${currentGroup.type === 'BUSINESS' ? 'ארגון משודרג ל-Enterprise' : 'החשבון שלכם משודרג ל-Pro'}</p>`; }
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
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חריגה מהיעד!' : 'עמידה ביעדים'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); const tcTab = document.getElementById('tab-cashflow'); if (tcTab && tcTab.classList.contains('tab-active')) renderCashflow(); } catch(e) {}
    } catch(e) { console.error('FetchData Error', e); }
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json();
        const list = document.getElementById('pending-list'); const container = document.getElementById('admin-panel');
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
async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

async function deleteUser(id, name) {
    if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהמערכת לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return;
    try {
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'המשתמש נמחק בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}

async function submitChangePassword(e) {
    e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...';
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הסיסמה שונתה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); }
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; }
}

function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `הגדרות עבור ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'עודכן'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע העברת כספים שוטפים ובונוסים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } }

function openGoalModal() { if(currentUser.role === 'ADMIN') { document.getElementById('goal-user-select-container').classList.remove('hidden'); } document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { document.getElementById('deposit-goal-id').value = id; document.getElementById('deposit-goal-title').innerText = title; document.getElementById('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = document.getElementById('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && document.getElementById('goal-user-select-container').style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); document.getElementById('goal-modal').classList.add('hidden'); fetchData(); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = val('deposit-amount'); if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); document.getElementById('goal-deposit-modal').classList.add('hidden'); fetchData(); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    document.getElementById('trans-type').value=t; document.getElementById('trans-modal-title').innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s=document.getElementById('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); document.getElementById('transaction-modal').classList.remove('hidden'); 
}

window.toggleTransType = function(type) {
    const isRecurring = type === 'recurring'; document.getElementById('trans-is-recurring').value = isRecurring;
    const btnOnClass = document.body.classList.contains('is-business') ? 'bg-white text-slate-800' : 'bg-white text-blue-600';
    const btnOffClass = document.body.classList.contains('is-business') ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-700';

    document.getElementById('btn-trans-onetime').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition` : `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition`;
    document.getElementById('btn-trans-recurring').className = isRecurring ? `flex-1 py-1.5 text-sm font-bold ${btnOnClass} rounded-lg shadow-sm transition` : `flex-1 py-1.5 text-sm font-bold ${btnOffClass} rounded-lg transition`;
    if (isRecurring) { document.getElementById('trans-end-date-container').classList.remove('hidden'); } else { document.getElementById('trans-end-date-container').classList.add('hidden'); document.getElementById('trans-end-month').value = ''; }
};

async function submitTransaction() { 
    const amount = val('trans-amount'); if(!amount) return; if(val('trans-type') === 'expense') triggerShake(); else triggerConfetti(); 
    const isRecurring = document.getElementById('trans-is-recurring').value === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null }) }); 
    document.getElementById('transaction-modal').classList.add('hidden'); showToast('success', 'נשמר!'); fetchData(); 
}

function openEditTransactionModal(id, amount, desc, cat, type) {
    const editId = document.getElementById('edit-trans-id'); if(editId) editId.value = id; 
    const editOldAmt = document.getElementById('edit-trans-old-amount'); if(editOldAmt) editOldAmt.value = amount; 
    const editType = document.getElementById('edit-trans-type'); if(editType) editType.value = type; 
    const editAmt = document.getElementById('edit-trans-amount'); if(editAmt) editAmt.value = amount; 
    const editDesc = document.getElementById('edit-trans-desc'); if(editDesc) editDesc.value = desc;
    const catSelect = document.getElementById('edit-trans-cat'); 
    if(catSelect) {
        catSelect.innerHTML = '';
        if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; }
    }
    const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.remove('hidden');
}

async function submitEditTransaction() {
    const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat');
    if(!amount) return showToast('error', 'נא להזין סכום');
    const btn = document.querySelector('#edit-transaction-modal .bg-blue-600') || document.querySelector('#edit-transaction-modal .bg-slate-800'); const origText = btn ? btn.innerText : ''; if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה עודכנה!'); const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = origText; } }
}

async function deleteTransaction() {
    const id = val('edit-trans-id'); if(!confirm('האם אתה בטוח שברצונך למחוק פעולה זו לחלוטין? היתרה תתעדכן בהתאם.')) return;
    try {
        const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה נמחקה!'); const mod = document.getElementById('edit-transaction-modal'); if(mod) mod.classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function openLoanModal() { document.getElementById('loan-modal').classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); document.getElementById('loan-modal').classList.add('hidden'); showToast('success', 'בקשה נשלחה לאישור 📨'); fetchData(); fetchLoans(); }
async function approveLoan(loanId) { if (!confirm('לאשר בקשה זו? הכסף יועבר למשתמש.')) return; const res = await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); const data = await res.json(); if (data.success) { triggerConfetti(); showToast('success', 'הבקשה אושרה!'); fetchData(); fetchLoans(); } else showToast('error', data.error); }
async function rejectLoan(loanId) { if (!confirm('לדחות בקשה זו?')) return; await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, adminId: currentUser.id }) }); showToast('success', 'הבקשה נדחתה'); fetchLoans(); }

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id;
    const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); const data = await res.json();
    const list = document.getElementById('budget-list'); list.innerHTML = '';
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

function openBudgetModal(catId, catName, currentLimit) { document.getElementById('budget-cat-name').innerText = catName; document.getElementById('budget-cat-id').value = catId; document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : ''; document.getElementById('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { const cat = val('budget-cat-id'); const limit = val('budget-limit'); const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); document.getElementById('budget-modal').classList.add('hidden'); fetchBudget(); }
function openAddBudgetCategoryModal() { document.getElementById('new-budget-cat-name').value = ''; document.getElementById('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { const catName = val('new-budget-cat-name'); if(!catName) return; const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); document.getElementById('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); }

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    document.getElementById('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-indigo-600 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
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
    } else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">אין תנועות עתידיות להצגת גרף</p>'; }
}

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('תובנות עתיד', null); document.getElementById('familai-loading-text').innerText = 'מחשבת את התזרים הצפוי לתקופה...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? document.getElementById('forecast-month-filter').value : document.getElementById('forecast-year-filter').value;
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('תובנות תזרים', data.insight); }
            else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התשקיף'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}
