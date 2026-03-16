// --- INTRO.JS STYLES ---
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

// --- GLOBAL VARIABLES & CONSTANTS ---
const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null; let saAllGroups = []; let saAllUsers = [];
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = []; let forecastCache = [];
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false;

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'} ], 
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

// --- UTILITIES ---
function val(id) { return document.getElementById(id).value; }
function showToast(t,m) { const el=document.getElementById('toast'); const icon = document.getElementById('toast-icon'); el.classList.remove('hidden'); document.getElementById('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
function triggerShake() { const app = document.getElementById('main-wrapper'); app.classList.add('shake-effect'); setTimeout(() => app.classList.remove('shake-effect'), 500); }
function toggleFab() { document.getElementById('fab-container').classList.toggle('fab-open'); }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); 
    document.getElementById(`view-${view}`).classList.remove('hidden'); 
}

function selectType(t) { 
    document.getElementById('create-type').value=t; 
    document.getElementById('type-family').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; 
    document.getElementById('type-group').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; 
}

const hidePreloaderAndShowAuth = (view = 'login') => {
    document.getElementById('auth-container').classList.remove('hidden');
    switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
        preloader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => preloader.classList.add('hidden'), 700);
    }
};

// --- INITIALIZATION ---
window.onload = async () => { 
    initAccessibility();
    const failsafeTimer = setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader && !preloader.classList.contains('hidden')) {
            console.warn('Failsafe triggered');
            hidePreloaderAndShowAuth('login');
        }
    }, 7000);

    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { 
        document.getElementById('join-code').value = inviteCode; 
        if(inviteRole) document.getElementById('join-role').value = inviteRole; 
        clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; 
    }
    
    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { 
                const res = await fetch(`${API}/users/${session.user.id}`); 
                if(res.ok) { 
                    currentUser = await res.json(); currentGroup = session.group; 
                    localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup})); 
                    clearTimeout(failsafeTimer); await loadDashboard(); 
                } else { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
            } else { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
        } catch(e) { localStorage.removeItem('ofl_session'); clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); } 
    } else { clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login'); }
};

// --- AUTHENTICATION ---
async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { e.preventDefault(); if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); }
async function handleJoin(e) { e.preventDefault(); if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); const d=await res.json(); if(d.success) { showToast('success', 'נשלח בהצלחה!'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); }

async function authAction(endpoint, body) { 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { currentUser = data.user; currentGroup = data.group; localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); await loadDashboard(); } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}
function logout() { localStorage.removeItem('ofl_session'); location.reload(); }

// --- DASHBOARD & TABS ---
function switchTab(t) { 
    ['feed','tasks','shop','bank','academy','members','budget','pantry','recipes','forecast'].forEach(x => { 
        const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const activeEl = document.getElementById(`content-${t}`);
    if(activeEl) activeEl.classList.remove('hidden'); 
    const activeBtn = document.getElementById(`tab-${t}`);
    if(activeBtn) activeBtn.classList.add('tab-active'); 
    
    if (t !== 'shop') { 
        const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); 
        document.getElementById('fab-container').classList.remove('fab-lifted'); 
    } else { 
        try { renderShopList(); } catch(e) {} 
    }
    if (t === 'pantry') renderPantry();
    if (t === 'recipes') renderRecipePantrySelection();
    if (t === 'forecast') renderForecast();
}

async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden'); 
    document.getElementById('dashboard-container').classList.remove('hidden'); 
    document.getElementById('fab-container').classList.remove('hidden');
    
    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
    document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} ${codeBadge}`; 
    document.getElementById('dash-nickname').innerText = currentUser.nickname; 
    document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) {
            profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>';
        }
        const fcF = document.getElementById('forecast-user-filter'); if (fcF) fcF.classList.remove('hidden');
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase(); 
        document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; 
        document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
        const fcF = document.getElementById('forecast-user-filter'); if (fcF) fcF.classList.add('hidden');
    }
    
    document.getElementById('btn-add-budget-cat').classList.remove('hidden');
    updateBatteryUI();
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
        fetchBanners();
        await fetchMembers(); 
        if(isAdmin) fetchPendingUsers(); 
        await fetchData();
        fetchLoans();
    } catch (e) {
        console.error('Error fetching dashboard data:', e);
        showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => {
            const showedWelcome = await checkGlobalWelcome();
            if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; }
        };
        if (preloader && !preloader.classList.contains('hidden')) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); 
        } else { finalizeLoad(); }
    }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens;
            currentGroup.is_premium = data.group.is_premium;
            updateBatteryUI();
        }

        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); 
            const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
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
            const limit = currentUser.role === 'ADMIN' ? 50 : 20; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) allTransactions = Array.isArray(await transRes.json()) ? await transRes.json() : [];
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); } catch(e) {}
        
        const forecastTab = document.getElementById('content-forecast');
        if(forecastTab && !forecastTab.classList.contains('hidden')) renderForecast();
        
    } catch(e) {}
}

// --- TRANSACTIONS & FORECAST ---
function populateMonthDropdown() {
    const select = document.getElementById('trans-month');
    if(!select) return;
    select.innerHTML = '';
    const now = new Date();
    for(let i = -1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('he-IL', {month:'long', year:'numeric'});
        select.innerHTML += `<option value="${val}">${i===0 ? 'החודש (נוכחי)' : label}</option>`;
    }
    select.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function openTransactionModal(t) { 
    document.getElementById('trans-type').value=t; 
    document.getElementById('trans-modal-title').innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s=document.getElementById('trans-cat'); s.innerHTML=''; 
    CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-desc').value = '';
    populateMonthDropdown();
    document.getElementById('trans-is-recurring').checked = false;
    document.getElementById('trans-end-date-container').classList.add('hidden');
    document.getElementById('trans-end-date').value = '';

    document.getElementById('transaction-modal').classList.remove('hidden'); 
    document.getElementById('fab-container').classList.remove('fab-open'); 
}

async function submitTransaction() { 
    const amount = val('trans-amount'); if(!amount) return; 
    if(val('trans-type') === 'expense') triggerShake(); else triggerConfetti(); 
    
    const expectedMonth = val('trans-month');
    const isRecurring = document.getElementById('trans-is-recurring').checked;
    const endDate = val('trans-end-date');

    await fetch(`${API}/transaction`, {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ 
            userId: currentUser.id, 
            amount, 
            description: val('trans-desc')||'פעולה', 
            category: val('trans-cat'), 
            type: val('trans-type'),
            expectedMonth: expectedMonth,
            isRecurring: isRecurring,
            endDate: endDate
        })
    }); 
    document.getElementById('transaction-modal').classList.add('hidden'); 
    showToast('success', 'נשמר!'); 
    fetchData(); 
    if(document.getElementById('content-forecast') && !document.getElementById('content-forecast').classList.contains('hidden')) {
        renderForecast();
    }
}

async function renderForecast() {
    try {
        const userFilter = document.getElementById('forecast-user-filter') ? document.getElementById('forecast-user-filter').value : 'all';
        const res = await fetch(`${API}/forecast?groupId=${currentGroup.id}&userId=${userFilter}`);
        const data = await res.json();
        forecastCache = data.pending_transactions || [];
        
        const monthSelect = document.getElementById('forecast-month-filter');
        if (monthSelect && monthSelect.options.length === 0) {
            const now = new Date();
            for(let i = 0; i <= 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                const label = d.toLocaleDateString('he-IL', {month:'long', year:'numeric'});
                monthSelect.innerHTML += `<option value="${val}">${i===0 ? 'החודש (נוכחי)' : label}</option>`;
            }
        }

        const selectedMonth = monthSelect ? monthSelect.value : (() => {
            const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        })();

        const [year, month] = selectedMonth.split('-');
        
        const monthlyTxs = forecastCache.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
        });

        let inc = 0; let exp = 0;
        let html = '';
        monthlyTxs.forEach(t => {
            const amt = parseFloat(t.amount);
            if(t.type === 'income') inc += amt; else exp += amt;
            
            const isInc = t.type === 'income';
            const icon = isInc ? '<i class="fa-solid fa-arrow-trend-up text-teal-500 bg-teal-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-rose-500 bg-rose-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = isInc ? 'text-teal-600' : 'text-rose-600';
            const prefix = isInc ? '+' : '-';
            const userNameDisplay = currentUser.role === 'ADMIN' ? `<span class="text-[10px] text-slate-500 ml-2">${t.user_name}</span>` : '';
            const dStr = new Date(t.date).toLocaleDateString('he-IL');
            
            html += `<div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 mb-2 flex justify-between items-center transform transition hover:scale-[1.01]">
                <div>
                    <p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${t.description}</span></p>
                    <p class="text-[10px] text-slate-400 mt-1">${dStr} ${userNameDisplay}</p>
                </div>
                <span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${amt.toFixed(0)}</span>
            </div>`;
        });

        if(monthlyTxs.length === 0) html = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-calendar-check text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעולות צפויות לחודש זה.</p></div>';
        
        document.getElementById('forecast-list').innerHTML = html;
        document.getElementById('forecast-in').innerText = `₪${inc.toFixed(0)}`;
        document.getElementById('forecast-out').innerText = `₪${exp.toFixed(0)}`;
        
        const net = inc - exp;
        const balEl = document.getElementById('forecast-bal');
        balEl.innerText = `₪${net.toFixed(0)}`;
        balEl.className = `font-bold ${net >= 0 ? 'text-blue-600' : 'text-red-500'}`;

    } catch(e) { console.error('Error fetching forecast:', e); }
}

// --- SHOPPING ---
function openShopModal() { document.getElementById('shop-modal').classList.remove('hidden'); document.getElementById('fab-container').classList.remove('fab-open'); }

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { 
    const itemInput = document.getElementById('shop-item'); 
    const btn = document.querySelector('#shop-modal button.bg-pink-500'); 
    const item = itemInput.value; 
    const qty = val('shop-quantity'); 
    const est = val('shop-est-price'); 
    const unit = val('shop-unit') || "יח'"; 
    if(!item) return; if (btn.disabled) return; 
    btn.disabled = true; btn.innerText = 'מוסיף...'; 
    try { 
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, userId: currentUser.id}) }); 
        const data = await res.json(); 
        if (data.success) { 
            document.getElementById('shop-modal').classList.add('hidden'); 
            itemInput.value = ''; 
            document.getElementById('shop-est-price').value = ''; 
            document.getElementById('shop-quantity').value = 1; 
            document.getElementById('shop-unit').value = "יח'";
            document.getElementById('suggestions').classList.add('hidden'); 
            if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; 
            showToast('success', 'נוסף לרשימה'); 
            fetchData(); 
        } 
    } finally { btn.disabled = false; btn.innerText = 'הוסף'; } 
}

async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }

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
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין להורה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${i.item_name}</span><span class="text-xs text-slate-500 block">ביקש/ה: ${i.requester_name}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    if(activeItems.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">העגלה ריקה</p>'; document.getElementById('cart-footer').classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); return; }
    document.getElementById('cart-footer').classList.remove('hidden'); document.getElementById('fab-container').classList.add('fab-lifted');
    
    const getCatScore = (name) => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(name)) return cat; } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name).localeCompare(getCatScore(b.item_name)));
    let currentCat = ''; let shopHtml = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; 
        const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP}/${i.unit || "יח'"} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-pink-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-pink-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">${i.quantity} ${i.unit || "יח'"}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { 
        const item = shoppingListCache.find(i => i.id == id); 
        if(item) { 
            const unitPrice = parseFloat(value) || 0; 
            const total = unitPrice * parseFloat(item.quantity); 
            const totalEl = document.getElementById(`row-total-${id}`); 
            if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; 
        } 
        calcRunningTotal(); return; 
    }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; document.getElementById(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const isChecked = row.querySelector('input[type="checkbox"]').checked; 
        const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); 
            const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; 
            const qty = itemData ? parseFloat(itemData.quantity) : 1; 
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
            count++; 
            const id = row.id.replace('row-', ''); 
            const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; 
            const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום'); return; } 
    document.getElementById('summ-count').innerText = count; 
    document.getElementById('summ-missing').innerText = missing; 
    document.getElementById('summ-total').innerText = `₪${total.toFixed(2)}`; 
    document.getElementById('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = document.getElementById('checkout-store').value || 'סופר כללי'; const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(document.getElementById(`price-${id}`).value) || 0; 
            const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            const rowTotal = unitPrice * qty; 
            total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); triggerConfetti(); showToast('success', 'הקנייה הושלמה!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); document.getElementById('history-modal').classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

// --- PANTRY ---
function openPantryModal() { document.getElementById('pantry-modal').classList.remove('hidden'); }

async function submitPantryItem() {
    const name = val('pantry-item'); 
    const qty = val('pantry-quantity'); 
    const unit = val('pantry-unit') || "יח'";
    if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit}) });
    document.getElementById('pantry-modal').classList.add('hidden'); 
    val('pantry-item', ''); 
    val('pantry-quantity', 1); 
    document.getElementById('pantry-unit').value = "יח'";
    fetchData(); 
    showToast('success', 'המוצר נוסף למזווה');
}

function openPantryUseModal(name, unit) {
    document.getElementById('use-pantry-title').innerText = `מה לקחת מ: ${name}?`;
    document.getElementById('use-pantry-name').value = name;
    document.getElementById('use-pantry-qty').value = '';
    document.getElementById('use-pantry-unit-display').innerText = unit || "יח'";
    document.getElementById('pantry-use-modal').classList.remove('hidden');
}

async function submitPantryUse() {
    const name = val('use-pantry-name');
    const qty = val('use-pantry-qty');
    if(!qty || parseFloat(qty) <= 0) return showToast('error', 'נא להזין כמות תקינה');
    
    try {
        const res = await fetch(`${API}/pantry/use`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty }) 
        });
        const data = await res.json();
        
        if(data.success) {
            showToast('success', 'המלאי עודכן בהצלחה');
            document.getElementById('pantry-use-modal').classList.add('hidden');
            fetchData();
        } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר נגמר! האם למחוק אותו מהמזווה? (מומלץ להוסיף לעגלת הקניות במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); }
    fetchData();
}

async function movePantryToCart(pantryId, itemName, unit) {
    await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id}) });
    await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לרשימת הקניות!'); fetchData();
}

function renderPantry() {
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `
        <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col mb-2">
            <div class="flex justify-between items-center mb-2">
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4>
                    <p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3">
                        <button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button>
                        <span>${p.quantity} ${p.unit || "יח'"}</span>
                        <button onclick="updatePantryQty(${p.id}, ${parseFloat(p.quantity) + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 mt-1 border-t border-slate-50 pt-2">
                <button onclick="openPantryUseModal('${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-orange-50 text-orange-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-orange-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils"></i> השתמשתי</button>
                <button onclick="movePantryToCart(${p.id}, '${p.item_name.replace(/'/g,"\\'")}', '${p.unit || "יח'"}')" class="flex-1 bg-pink-50 text-pink-600 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-pink-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down"></i> חסר (לקניות)</button>
            </div>
        </div>`;
    });
}

// --- TASKS ---
function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-purple-600 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-purple-600 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }

function openTaskModal(isSelf = false) { 
    document.getElementById('task-modal').classList.remove('hidden'); document.getElementById('task-is-self').value = isSelf; 
    document.getElementById('task-days').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-reward').value = ''; document.getElementById('ai-task-topic').value = ''; document.getElementById('ai-task-results').classList.add('hidden');
    setTaskMode('manual');
    const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardGroup = document.getElementById('task-reward-group'); const assigneeSelect = document.getElementById('task-assignee');
    const rewardInput = document.getElementById('task-reward');

    if(isSelf) { 
        document.getElementById('task-modal-title').innerText = 'מעשה טוב'; 
        toggles.classList.add('hidden'); 
        assigneeContainer.classList.add('hidden'); 
        rewardInput.placeholder = 'כמה מגיע לי? (₪)';
    } else { 
        document.getElementById('task-modal-title').innerText = 'יצירת משימה'; 
        toggles.classList.remove('hidden'); 
        assigneeContainer.classList.remove('hidden'); 
        rewardInput.placeholder = 'תגמול (₪)';
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין ילדים רשומים</option>';
        }
    } 
}

async function generateAITasks() {
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
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; 
    const assignee = isSelf ? currentUser.id : val('task-assignee'); 
    const reward = val('task-reward'); 
    const title = val('task-title'); 
    const days = val('task-days');
    
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); 
    if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    
    const statusToSend = isSelf ? 'done' : 'pending';

    await fetch(`${API}/tasks`, {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) 
    }); 
    
    if(isSelf) triggerConfetti(); 
    closeTaskModal(); 
    showToast('success', isSelf ? 'נשלח לאישור ההורה!' : 'משימה נוצרה בהצלחה!'); 
    fetchData(); 
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; document.getElementById('task-proof-upload').click(); }

function openApproveTaskModal(id, title, currentReward) {
    document.getElementById('approve-task-id').value = id;
    document.getElementById('approve-task-title').innerText = title;
    document.getElementById('approve-task-reward').value = currentReward || 0;
    document.getElementById('approve-task-modal').classList.remove('hidden');
}

async function submitTaskApproval() {
    const id = document.getElementById('approve-task-id').value;
    const finalReward = document.getElementById('approve-task-reward').value;
    
    document.getElementById('approve-task-modal').classList.add('hidden');
    triggerConfetti();
    
    await fetch(`${API}/tasks/update`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward })
    });
    
    showToast('success', 'המשימה אושרה והתגמול הועבר!');
    fetchData();
}

function renderTasks(tasks) {
    const list = document.getElementById('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        
        if (t.status === 'pending') { 
            if (isMyTask) { 
                actionBtn = `<button onclick="clickTaskProof(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; 
            } else {
                statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; 
            }
        } 
        else if (t.status === 'done') { 
            statusColor = 'bg-yellow-50 border-yellow-100'; 
            if (isAdmin) {
                actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${t.title.replace(/'/g, "\\'")}', ${t.reward})" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; 
            } else {
                statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; 
            }
        } 
        else if (t.status === 'approved') { 
            statusColor = 'bg-green-50 border-green-100'; 
            statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; 
        }
        
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">אישי</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${t.title} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${t.assignee_name}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr;
}

// --- MEMBERS, BUDGET, LOANS, QUIZ ETC. ---
function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } document.getElementById('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; let text = role === 'ADMIN' ? `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nהגדרתי אותך כשותף/מנהל (כמוני).\nלחץ על הקישור כדי להצטרף ולבחור סיסמה:\n🔗 ${joinLink}` : `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nלחץ על הקישור כדי להצטרף למשפחה שלנו ולפתוח לעצמך חשבון אישי:\n🔗 ${joinLink}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); document.getElementById('invite-modal').classList.add('hidden'); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">העתק רשימה זו</button></div></div>`; }); document.getElementById('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `הגדרות עבור ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = document.getElementById('bank-user-id').value; const allowance = document.getElementById('bank-allowance').value; const interest = document.getElementById('bank-interest').value; await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע חלוקת דמי כיס וריבית לכל הילדים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { document.getElementById('goal-user-select-container').classList.remove('hidden'); } document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { document.getElementById('deposit-goal-id').value = id; document.getElementById('deposit-goal-title').innerText = title; document.getElementById('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = document.getElementById('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && document.getElementById('goal-user-select-container').style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); document.getElementById('goal-modal').classList.add('hidden'); fetchData(); }
async function submitDeposit() { const goalId = document.getElementById('deposit-goal-id').value; const amount = document.getElementById('deposit-amount').value; if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); document.getElementById('goal-deposit-modal').classList.add('hidden'); fetchData(); } else showToast('error', data.error); }
function openLoanModal() { document.getElementById('loan-modal').classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); document.getElementById('loan-modal').classList.add('hidden'); showToast('success', 'בקשת ההלוואה נשלחה להורה 📨'); fetchData(); fetchLoans(); }

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id;
    const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`);
    const data = await res.json();
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
        const childrenSectionTitle = currentUser.role === 'ADMIN' ? 'הוצאות על הילדים' : 'הכנסות מההורים';
        list.innerHTML += `<div class="mb-8 bg-indigo-50/50 p-4 rounded-[1.5rem] border border-indigo-100/60 shadow-sm transition-all hover:bg-indigo-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-indigo-900 flex items-center gap-2"><i class="fa-solid fa-child-reaching text-indigo-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-indigo-100">${subItemsHtml}</div></div>`;
    }
    otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });
}

function openBudgetModal(catId, catName, currentLimit) { document.getElementById('budget-cat-name').innerText = catName; document.getElementById('budget-cat-id').value = catId; document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : ''; document.getElementById('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { const cat = document.getElementById('budget-cat-id').value; const limit = document.getElementById('budget-limit').value; const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); document.getElementById('budget-modal').classList.add('hidden'); fetchBudget(); }
function openAddBudgetCategoryModal() { document.getElementById('new-budget-cat-name').value = ''; document.getElementById('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { const catName = document.getElementById('new-budget-cat-name').value; if(!catName) return; const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); document.getElementById('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); }

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json();
        const list = document.getElementById('pending-list'); const container = document.getElementById('admin-panel');
        if (users && users.length > 0) {
            container.classList.remove('hidden'); list.innerHTML = '';
            users.forEach(u => { const age = new Date().getFullYear() - u.birth_year; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-green-600 transition">אשר</button></div></div>`; });
        } else { if(container) container.classList.add('hidden'); }
    } catch(e) { console.error(e); }
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'משתמש אושר!'); fetchPendingUsers(); fetchMembers(); }

function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }

async function submitChangePassword(e) {
    e.preventDefault();
    const oldP = document.getElementById('old-password').value; const newP = document.getElementById('new-password').value;
    const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...';
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); }
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'שנה סיסמה'; }
}

async function deleteUser(id, name) {
    if(!confirm(`האם אתה בטוח שברצונך למחוק את "${name}" מהמערכת לצמיתות? פעולה זו תמחק גם את הנתונים שלו.`)) return;
    try {
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'המשתמש נמחק בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}
