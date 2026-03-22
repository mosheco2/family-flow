// ==========================================
// Oneflow Life - Business Module (B2B)
// ==========================================

// --- State Variables ---
let membersCache = [];
let employeesCache = [];
let procurementCache = [];
let inventoryCache = [];
let ticketsCache = [];
let allTasks = [];
let allTransactions = [];
let timeclockRecords = [];
let feedCache = [];
let bundlesCache = [];
let allBundles = [];
let forecastCache = { startingBalance: 0, items: [] };
let wisdomCache = {};

let activePunchedIn = null;
let timeclockInterval = null;
let forecastRatioChart = null;
let currentForecastMode = 'monthly';
let currentScanTarget = '';
let currentVerifyTaskId = null;
let currentVerifyTaskTitle = null;
let currentQuizData = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let currentWrongAnswers = [];

const CATEGORIES = {
    income: [ {value:'sales', label:'💰 מכירות והכנסות'}, {value:'investment', label:'📈 השקעות'}, {value:'other', label:'💸 אחר'} ],
    expense: [ {value:'payroll', label:'👥 שכר ובונוסים'}, {value:'office', label:'🏢 שכירות ותחזוקה'}, {value:'software', label:'💻 רישוי ומחשוב'}, {value:'marketing', label:'🎯 שיווק ופרסום'}, {value:'travel', label:'🚗 אש"ל ונסיעות'}, {value:'inventory', label:'📦 רכש ומלאי'}, {value:'other', label:'💸 אחר'} ]
};
const BUDGET_LABELS = { 'payroll': '👥 שכר ובונוסים', 'office': '🏢 שכירות ותחזוקה', 'software': '💻 רישוי ומחשוב', 'marketing': '🎯 שיווק ופרסום', 'travel': '🚗 אש"ל ונסיעות', 'inventory': '📦 רכש ומלאי', 'other': '💸 אחר' };

const PRODUCT_DB = { 
    "ציוד משרדי 📎": ["דפי צילום A4", "עטים", "מרקרים", "קלסרים", "שדכן", "סיכות לשדכן", "פתקיות ממו"],
    "מחשוב וטכנולוגיה 💻": ["עכבר אלחוטי", "מקלדת", "כבל HDMI", "דיסק און קי", "מתאם USB"],
    "מטבחון וכיבוד ☕": ["קפה שחור", "קפסולות קפה", "חלב", "סוכר", "תה", "כוסות חד פעמיות", "עוגיות"],
    "ניקיון ותחזוקה 🧻": ["נייר טואלט", "מגבות נייר", "סבון כלים", "נוזל רצפות", "שקיות אשפה"]
};
const FLAT_PRODUCTS = []; 
for (const [cat, items] of Object.entries(PRODUCT_DB)) { items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); }

// ==========================================
// Initialization & Core Setup
// ==========================================

async function loadBusinessDashboard() {
    // מורידים את מסך הטעינה באופן מיידי כדי למנוע תקיעות
    const preloader = document.getElementById('app-preloader'); 
    if (preloader) { 
        preloader.classList.add('opacity-0', 'pointer-events-none'); 
        setTimeout(() => preloader.classList.add('hidden'), 700); 
    }
    
    document.getElementById('auth-container').classList.add('hidden');
    const dashContainer = document.getElementById('dashboard-container');
    if (dashContainer) dashContainer.classList.remove('hidden');
    const fabContainer = document.getElementById('fab-container');
    if (fabContainer) fabContainer.classList.remove('hidden');
    
    document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} <span class="text-[10px] font-mono bg-slate-800 text-white px-2 py-0.5 rounded-full tracking-widest ml-2">LIFE</span>`;
    document.getElementById('dash-nickname').innerText = currentUser.nickname;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.employee-only').forEach(el => el.classList.add('hidden'));
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = document.getElementById('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> בקשות לאישור הנהלה';
        const profileUp = document.getElementById('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> חבילת Enterprise פעילה</p>'; }
        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.employee-only').forEach(el => el.classList.remove('hidden'));
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        const profileUp = document.getElementById('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        const cName = document.getElementById('card-name'); if(cName) cName.innerText = currentUser.nickname.toUpperCase(); 
        const cAllow = document.getElementById('card-allowance'); if(cAllow) cAllow.innerText = `₪${currentUser.allowance_amount || 0}`; 
        const cInt = document.getElementById('card-interest'); if(cInt) cInt.innerText = `${currentUser.interest_rate || 0}%`; 
        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        const balLabel = document.getElementById('balance-label'); if(balLabel) balLabel.innerText = 'התקציב שלי';
    }
    
    if(typeof updateBatteryUI === 'function') updateBatteryUI();
    setupForecastListeners();
    
    try {
        setInterval(() => { fetchBusinessData(); fetchLoans(); if(isAdmin) fetchPendingUsers(); }, 30000);
        await fetchMembers(); 
        if(isAdmin) fetchPendingUsers(); 
        await fetchBusinessData(); 
        fetchLoans();
        
        if(typeof checkGlobalWelcome === 'function') {
            const showedWelcome = await checkGlobalWelcome(); 
            if (!showedWelcome && typeof checkAndStartTour === 'function') { checkAndStartTour(window.forceTourStart || false); window.forceTourStart = false; } 
        }
    } catch (e) {
        console.error('Error fetching dashboard data:', e); showToast('error', 'שגיאה בטעינת נתונים');
    } 
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Enterprise)'; indicator.classList.add('bg-slate-800', 'text-white', 'border-transparent'); } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

// פונקציות עזר קריטיות של AI שהיו חסרות
function setupForecastListeners() {
    const btnMonthly = document.getElementById('btn-forecast-monthly'); 
    const btnYearly = document.getElementById('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); 
    if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));
}

window.executeWithAIWarning = function(actionCallback) {
    if (currentGroup && currentGroup.is_premium) return actionCallback();
    const todayStr = new Date().toLocaleDateString(); const dismissedDate = localStorage.getItem('ofl_ai_warning_dismissed'); if (dismissedDate === todayStr) return actionCallback();
    const modal = document.getElementById('ai-warning-modal'); if(!modal) return actionCallback();
    const tokensLeft = currentGroup && currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
    const leftEl = document.getElementById('ai-warning-left'); if (leftEl) leftEl.innerText = tokensLeft;
    const btnContinue = document.getElementById('btn-ai-warning-continue'); 
    if(btnContinue) {
        const newBtn = btnContinue.cloneNode(true); btnContinue.parentNode.replaceChild(newBtn, btnContinue);
        newBtn.onclick = () => { const dontShow = document.getElementById('ai-warning-dont-show').checked; if (dontShow) { localStorage.setItem('ofl_ai_warning_dismissed', todayStr); } modal.classList.add('hidden'); actionCallback(); };
    }
    modal.classList.remove('hidden');
};

window.showFamilAIModal = function(title, text) {
    const modal = document.getElementById('familai-advisor-modal'); if(!modal) return;
    modal.classList.remove('hidden'); 
    const sub = document.getElementById('familai-modal-subtitle'); if(sub) sub.innerText = title;
    if (text) { 
        const load = document.getElementById('familai-advisor-loading'); if(load) load.classList.add('hidden'); 
        const advText = document.getElementById('familai-advice-text'); if(advText) advText.innerText = text; 
        const content = document.getElementById('familai-advisor-content'); if(content) content.classList.remove('hidden'); 
    } else { 
        const load = document.getElementById('familai-advisor-loading'); if(load) load.classList.remove('hidden'); 
        const content = document.getElementById('familai-advisor-content'); if(content) content.classList.add('hidden'); 
    }
};

function switchBusinessTab(t) {
    ['feed', 'timeclock', 'shop', 'pantry', 'tasks', 'bank', 'academy', 'budget', 'cashflow', 'forecast', 'members', 'recipes'].forEach(x => {
        const el = document.getElementById(`content-${x}`);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-${x}`);
        if(btn) btn.classList.remove('tab-active');
    });
    
    const targetContent = document.getElementById(`content-${t}`);
    const targetTab = document.getElementById(`tab-${t}`);
    if (targetContent) targetContent.classList.remove('hidden');
    if (targetTab) targetTab.classList.add('tab-active');

    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); } 
    else { try { renderProcurement(); } catch(e) {} }

    if (t === 'timeclock') renderTimeclock();
    if (t === 'pantry') renderInventory();
    if (t === 'tasks') renderTickets();
    if (t === 'bank') renderPayroll();
    if (t === 'forecast') renderForecast(); 
    if (t === 'cashflow') renderCashflow();
}
window.switchTab = switchBusinessTab;

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); employeesCache = membersCache;
        if(!Array.isArray(membersCache)) membersCache = [];
        
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user'); const cfF = document.getElementById('cashflow-user-filter'); const tF = document.getElementById('tc-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל המחלקות</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כלל העובדים</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כלל העובדים</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) cfF.value = cur; }
                if (tF) { const cur = tF.value; tF.innerHTML = '<option value="all">כלל העובדים</option>'; membersCache.forEach(m => tF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) tF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">שיוך יעד (כללי/עובד)</option>'; membersCache.forEach(m => { gS.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); if(cur) gS.value = cur; }
            } catch(err) {}
        } 
        
        const c = document.getElementById('members-list'); 
        if(c) { 
            c.innerHTML = ''; 
            membersCache.forEach(m => { 
                const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
                c.innerHTML+=`<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname || 'עובד'}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.role}</span>${adminDeleteBtn}</div></div>`; 
            }); 
        }
        
        const a = document.getElementById('bank-accounts-list'); 
        if (a && currentUser.role === 'ADMIN') { 
            a.innerHTML = ''; const employees = membersCache.filter(m => m.role !== 'ADMIN');
            if(employees.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין עובדים בארגון.</p>';
            else employees.forEach(m => { 
                const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'עובד'}</h4><p class="text-[10px] text-slate-400">תקציב: ₪${m.allowance_amount || 0} • בונוס יעד: ${m.interest_rate || 0}%</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה מנוצלת: <span class="text-blue-600">₪${m.balance || 0}</span></p></div></div><div class="flex gap-2"><button onclick="openBalanceAdjustmentModal(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition" title="תיקון מאזן"><i class="fa-solid fa-money-bill-transfer text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button></div></div>`; 
            }); 
        } 
    } catch(e) {}
}

async function fetchBusinessData() {
    if (!currentGroup || !currentGroup.id) return;
    try {
        const res = await fetch(`${API}/data/${currentUser.id}`);
        const data = await res.json();
        
        if (data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens;
            currentGroup.is_premium = data.group.is_premium;
            updateBatteryUI();
        }

        if (currentUser.role === 'ADMIN') {
            const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        }

        ticketsCache = Array.isArray(data.tasks) ? data.tasks : []; allTasks = ticketsCache;
        inventoryCache = Array.isArray(data.pantry) ? data.pantry : []; pantryCache = inventoryCache;
        procurementCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; shoppingListCache = procurementCache;
        bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTickets(); renderInventory(); renderProcurement(); } catch(e) {}
        try { fetchBudget(); renderForecast(); } catch(e) {}
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : '';
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-slate-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-700 transition">העבר תקציב</button></div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חריגה מהתקציב!' : 'עמידה ביעדים מזכה בבונוס!'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); buildAndRenderFeed(); if (document.getElementById('tab-cashflow') && document.getElementById('tab-cashflow').classList.contains('tab-active')) renderCashflow(); } catch(e) {}
        
        await fetchTimeclockRecords();
    } catch(e) { console.error('Failed to fetch business data', e); }
}

// ==========================================
// Feed
// ==========================================

function buildAndRenderFeed() {
    feedCache = [];
    if(Array.isArray(ticketsCache)) { ticketsCache.forEach(t => { if(t.status === 'approved') { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `טיקט הושלם: ${t.title}`, amount: t.reward, status: t.status }); } }); }
    if(Array.isArray(timeclockRecords)) { timeclockRecords.forEach(r => { feedCache.push({ type: 'timeclock', id: `tc_${r.id}`, user_id: r.user_id, user_name: r.nickname, date: new Date(r.punch_in), title: 'החתמת נוכחות', amount: r.total_minutes, status: r.punch_out ? 'out' : 'in' }); }); }
    feedCache.sort((a, b) => (b.date && a.date) ? (b.date - a.date) : 0);
    const filterEl = document.getElementById('feed-user-filter');
    if (filterEl) { if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); else filterEl.classList.add('hidden'); }
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const filterEl = document.getElementById('feed-user-filter'); const userFilter = filterEl ? filterEl.value : 'all';
    const dFilterEl = document.getElementById('feed-date-filter'); const dateFilter = dFilterEl ? dFilterEl.value : 'all';
    const list = document.getElementById('unified-feed-list'); if (!list) return;
    let filtered = feedCache;
    if (currentUser.role !== 'ADMIN') { filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); } 
    else if (userFilter !== 'all' && userFilter !== '') { filtered = feedCache.filter(item => String(item.user_id) === String(userFilter) || item.type === 'system'); }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(item => item.date && item.date >= cutoffDate); }
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">אין פעילות אחרונה להצגה.</div>'; return; }
    
    let html = '';
    filtered.forEach(item => {
        if(!item.date || isNaN(item.date.getTime())) return;
        const timeStr = item.date.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        let icon = '', desc = '';
        if (item.type === 'task') { icon = '<i class="fa-solid fa-check-double text-green-500"></i>'; desc = item.amount > 0 ? `בונוס שחולק: ₪${item.amount}` : 'הושלם בהצלחה'; }
        else if (item.type === 'timeclock') { icon = '<i class="fa-solid fa-clock text-blue-500"></i>'; desc = item.status === 'out' ? `משמרת הסתיימה (${(item.amount/60).toFixed(1)} שעות)` : 'משמרת פעילה כעת'; }
        html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3 mb-2"><div class="bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0">${icon}</div><div><p class="font-bold text-slate-800 text-sm leading-tight">${item.title}</p><p class="text-xs text-slate-500 mt-1">${item.user_name || item.user} • ${timeStr}</p><p class="text-[10px] text-slate-400 mt-0.5">${desc}</p></div></div>`;
    });
    list.innerHTML = html;
}

function renderChildTodo() {
    const todoSection = document.getElementById('child-todo-section'); const todoList = document.getElementById('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${t.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • טיקט • בונוס: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • לומדה • בונוס: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

// ==========================================
// Timeclock (שעון נוכחות)
// ==========================================

async function fetchTimeclockRecords() {
    try {
        const res = await fetch(`${API}/timeclock?groupId=${currentGroup.id}&userId=${currentUser.role === 'ADMIN' ? 'all' : currentUser.id}`);
        if(res.ok) {
            const data = await res.json();
            timeclockRecords = data.records || [];
            activePunchedIn = data.activeRecord || null;
            updateTimeclockUI();
        }
    } catch(e) { console.error('Timeclock fetch error:', e); }
}

function updateTimeclockUI() {
    const timerDisplay = document.getElementById('timeclock-timer');
    const btnPunch = document.getElementById('btn-punch');
    const statusText = document.getElementById('timeclock-status-text');
    if(!btnPunch) return;

    if (activePunchedIn) {
        btnPunch.innerHTML = '<i class="fa-solid fa-stopwatch text-4xl mb-1"></i><span>יציאה (Punch Out)</span>';
        btnPunch.className = 'w-40 h-40 rounded-full font-bold text-2xl flex flex-col items-center justify-center gap-2 transition transform hover:scale-105 punch-btn-out punch-pulse cursor-pointer';
        if(statusText) statusText.innerText = 'משמרת פעילה';
        if(timerDisplay) startTimeclockCounter(new Date(activePunchedIn.punch_in));
    } else {
        btnPunch.innerHTML = '<i class="fa-solid fa-fingerprint text-4xl mb-1"></i><span>כניסה (Punch In)</span>';
        btnPunch.className = 'w-40 h-40 rounded-full font-bold text-2xl flex flex-col items-center justify-center gap-2 transition transform hover:scale-105 punch-btn-in shadow-xl cursor-pointer';
        if(statusText) statusText.innerText = 'לא במשמרת';
        stopTimeclockCounter();
        if(timerDisplay) timerDisplay.innerText = '00:00:00';
    }
    renderTimeclock();
}

async function togglePunch() {
    const action = activePunchedIn ? 'out' : 'in';
    const btn = document.getElementById('btn-punch');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-4xl mb-1"></i>';
    try {
        const res = await fetch(`${API}/timeclock/punch`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id, action: action })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', action === 'in' ? 'החתמת כניסה בהצלחה' : 'החתמת יציאה בהצלחה');
            if(action === 'out') triggerConfetti();
            await fetchTimeclockRecords();
        } else {
            showToast('error', data.error);
            updateTimeclockUI();
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת');
        updateTimeclockUI();
    }
}

function startTimeclockCounter(startTime) {
    if (timeclockInterval) clearInterval(timeclockInterval);
    const display = document.getElementById('timeclock-timer');
    if(!display) return;
    timeclockInterval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now - startTime) / 1000); 
        const h = String(Math.floor(diff / 3600)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        display.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function stopTimeclockCounter() {
    if (timeclockInterval) clearInterval(timeclockInterval);
}

function renderTimeclock() {
    const list = document.getElementById('timeclock-list');
    if (!list) return;

    if (timeclockRecords.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">אין דיווחי שעות.</div>';
        return;
    }

    let html = '';
    timeclockRecords.forEach(r => {
        const dateStr = new Date(r.punch_in).toLocaleDateString('he-IL');
        const inTime = new Date(r.punch_in).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        const outTime = r.punch_out ? new Date(r.punch_out).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'}) : 'פעיל';
        const totalHtml = r.total_minutes ? `<span class="font-bold text-slate-800">${(r.total_minutes / 60).toFixed(1)} ש'</span>` : '<span class="text-orange-500 text-xs animate-pulse">במשמרת</span>';
        const userBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2">${r.nickname}</span>` : '';

        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2">
                <div>
                    <p class="font-bold text-slate-800 text-sm">${dateStr} ${userBadge}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${inTime} - ${outTime}</p>
                </div>
                <div class="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    ${totalHtml}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function fetchTimeclockReport() {
    fetchTimeclockRecords();
    showToast('success', 'הדוח רוענן');
}
function renderTimeclockReport() { renderTimeclock(); }

// ==========================================
// Procurement (ניהול רכש)
// ==========================================

function openShopModal() { document.getElementById('shop-modal').classList.remove('hidden'); }

async function submitShopItem() {
    const itemInput = document.getElementById('shop-item');
    const btn = document.querySelector('#shop-modal button.bg-slate-800'); 
    const item = itemInput.value;
    const qty = val('shop-quantity');
    const unit = val('shop-unit') || "יח'";
    if(!item) return showToast('error', 'יש להזין שם פריט');
    if (btn.disabled) return; btn.disabled = true; btn.innerText = 'מוסיף...'; 

    try {
        await fetch(`${API}/shopping/add`, { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: 0, userId: currentUser.id, status: 'requested'}) 
        });
        document.getElementById('shop-modal').classList.add('hidden');
        itemInput.value = ''; document.getElementById('shop-quantity').value = 1;
        showToast('success', 'דרישת הרכש נשלחה לאישור ההנהלה!');
        fetchBusinessData();
    } catch(e) { showToast('error', 'שגיאה בשליחת הדרישה'); } finally { btn.disabled = false; btn.innerText = 'הוסף לרשימה'; }
}

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

function renderProcurement() {
    if (document.activeElement.classList.contains('price-input')) return;
    const requestsList = document.getElementById('shop-requests-list');
    const activeList = document.getElementById('shop-list');
    const reqContainer = document.getElementById('shop-requests-container');
    if (!activeList) return;

    let reqHtml = '';
    let actHtml = '';

    procurementCache.forEach(i => {
        const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);

        if (i.status === 'requested') {
            const adminActions = currentUser.role === 'ADMIN' ? `
                <div class="flex gap-2">
                    <button onclick="updateProcurementStatus(${i.id}, 'pending')" class="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold hover:bg-green-200">אשר</button>
                    <button onclick="deleteProcurement(${i.id})" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">דחה</button>
                </div>
            ` : `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">ממתין לאישור</span>`;

            reqHtml += `
                <div class="bg-white p-3 rounded-xl border border-orange-200 shadow-sm flex justify-between items-center mb-2">
                    <div>
                        <span class="font-bold text-slate-700">${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span>
                        <span class="text-[10px] text-slate-500 block">דרישה מאת: ${i.requester_name}</span>
                    </div>
                    ${adminActions}
                </div>
            `;
        } else {
            const isChecked = i.status === 'in_cart';
            const checkbox = currentUser.role === 'ADMIN' ? `<input type="checkbox" onchange="updateRow(${i.id}, 'check', this.checked)" ${isChecked ? 'checked' : ''} class="w-5 h-5 rounded border-slate-300 accent-slate-800 flex-shrink-0">` : '';
            actHtml += `
                <div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked ? 'in-cart opacity-70 bg-slate-50' : ''}" id="row-${i.id}">
                    <div class="flex items-center gap-3">
                        ${checkbox}
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <span class="font-bold text-slate-800 item-name">${i.item_name}</span>
                                ${currentUser.role === 'ADMIN' ? `<button onclick="deleteProcurement(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </div>
                            <span class="text-[10px] text-slate-400 block">כמות: ${i.quantity} ${i.unit || "יח'"}</span>
                        </div>
                    </div>
                    ${currentUser.role === 'ADMIN' ? `
                    <div class="flex gap-2 items-center pl-0 mt-1">
                        <div class="relative w-24">
                            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${i.unit || "יח'"}</span>
                            <input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-slate-800 font-bold text-center">
                        </div>
                        <div class="flex flex-col items-center leading-none">
                            <span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span>
                            <span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span>
                        </div>
                        <button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 transition mr-auto" id="btn-missing-${i.id}">חסר במלאי ספק</button>
                    </div>` : ''}
                </div>
            `;
        }
    });

    if (reqContainer) {
        if(reqHtml) { reqContainer.classList.remove('hidden'); requestsList.innerHTML = reqHtml; }
        else { reqContainer.classList.add('hidden'); }
    }
    activeList.innerHTML = actHtml || '<p class="text-xs text-slate-400 py-2 text-center">עגלת הרכש הארגונית ריקה.</p>';
    calcRunningTotal();
    
    const isShopTabActive = document.getElementById('tab-shop') && document.getElementById('tab-shop').classList.contains('tab-active');
    if (isShopTabActive && actHtml !== '' && currentUser.role === 'ADMIN') { const f = document.getElementById('cart-footer'); if(f) f.classList.remove('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.add('fab-lifted'); } 
    else { const f = document.getElementById('cart-footer'); if(f) f.classList.add('hidden'); const fc = document.getElementById('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
}

async function updateProcurementStatus(id, status) {
    await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: status})});
    fetchBusinessData();
}

async function deleteProcurement(id) {
    if(!confirm('למחוק פריט זה?')) return;
    await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' });
    fetchBusinessData();
}

async function updateRow(id, type, value) {
    if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); row.classList.toggle('bg-slate-50', value); row.classList.toggle('opacity-70', value); if(input) input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = procurementCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const cachedItem = procurementCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); const cb = row.querySelector('input[type="checkbox"]'); if(cb){ cb.checked = false; cb.disabled = true; } const inp = document.getElementById(`price-${id}`); if(inp) inp.disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); const cb = row.querySelector('input[type="checkbox"]'); if(cb) cb.disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר במלאי ספק'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const cb = row.querySelector('input[type="checkbox"]');
        if(!cb) return;
        const isChecked = cb.checked; const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = procurementCache.find(i => i.id == id); 
            const inp = row.querySelector('.price-input');
            const unitPrice = inp ? parseFloat(inp.value) || 0 : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    const d = document.getElementById('cart-total-display'); if(d) d.innerText = `₪${total.toFixed(2)}`; 
}

function toggleSelectAll() { const anyPending = procurementCache.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); if(cb) cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); row.classList.toggle('bg-slate-50', targetStatus); row.classList.toggle('opacity-70', targetStatus); if(inp) inp.disabled = !targetStatus; }); calcRunningTotal(); procurementCache.forEach(i => { if(i.status !== 'bought' && i.status !== 'requested') updateRow(i.id, 'check', targetStatus); }); }

async function clearEntireCart() {
    if(!confirm('האם למחוק את כל הפריטים מהרשימה? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה רוקנה בהצלחה!'); fetchBusinessData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) { 
                count++; const id = row.id.replace('row-', ''); const itemData = procurementCache.find(i => i.id == id); 
                const inp = row.querySelector('.price-input');
                const unitPrice = inp ? parseFloat(inp.value) || 0 : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
            }
        } 
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום'); return; } 
    document.getElementById('summ-count').innerText = count; document.getElementById('summ-missing').innerText = missing; document.getElementById('summ-total').innerText = `₪${total.toFixed(2)}`; document.getElementById('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = document.getElementById('checkout-store').value || 'ספק כללי'; const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = procurementCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                const inp = document.getElementById(`price-${id}`);
                const unitPrice = inp ? parseFloat(inp.value) || 0 : 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
                boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
            }
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems, isBusiness: true }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); triggerConfetti(); showToast('success', 'הקנייה הושלמה והפריטים נקלטו למלאי!'); fetchBusinessData();
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('מערכת AI לפענוח חשבוניות', null); 
        document.getElementById('familai-loading-text').innerText = 'סורק חשבונית ספק ומחלץ נתונים...';
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg', isBusiness: true }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('פענוח הושלם', `נמצאו ${data.count} פריטים בחשבונית. הפריטים הוספו אוטומטית לעגלת הרכש.`); triggerConfetti(); fetchBusinessData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בפענוח החשבונית.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת עם השרת.'); }
            event.target.value = '';
        });
    });
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי מוצר חכם', null); document.getElementById('familai-loading-text').innerText = 'מזהה את המוצר...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    document.getElementById('familai-advisor-modal').classList.add('hidden');
                    if (target === 'shop') { document.getElementById('shop-item').value = data.productName; openShopModal(); } else { document.getElementById('pantry-item').value = data.productName; openPantryModal(); }
                    showToast('success', 'המוצר זוהה בהצלחה!');
                } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}
function closeBarcodeScanner() { const modal = document.getElementById('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity} ${i.unit || "יח'"})</span><span class="font-bold">₪${i.price_per_unit || 0}/${i.unit || "יח'"}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-slate-800 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200">העתק רשימה זו</button></div></div>`; }); document.getElementById('history-modal').classList.remove('hidden'); }
async function copyList(tripId) { if(!confirm('להעתיק את הפריטים לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); document.getElementById('history-modal').classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchBusinessData(); }

function exportShopToWhatsApp() {
    if (procurementCache.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*דרישת רכש - ${currentGroup.name}*\n\n`;
    procurementCache.forEach(i => { if(i.status !== 'bought') text += `▫️ ${i.item_name} - ${i.quantity} ${i.unit || "יח'"}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
function openPasteListModal() { document.getElementById('paste-list-text').value = ''; document.getElementById('paste-list-modal').classList.remove('hidden'); }
async function submitPastedList() {
    const text = document.getElementById('paste-list-text').value; if(!text.trim()) return;
    const items = text.split('\n').filter(i => i.trim() !== '');
    const btn = document.getElementById('btn-submit-paste'); btn.disabled = true; btn.innerText = 'קולט...';
    try {
        for (const item of items) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, status: 'requested'}) }); }
        document.getElementById('paste-list-modal').classList.add('hidden'); showToast('success', 'הרשימה נקלטה בהצלחה!'); fetchBusinessData();
    } catch(e) { showToast('error', 'שגיאה בקליטת הרשימה'); } finally { btn.disabled = false; btn.innerText = 'קליטת נתונים'; }
}

// ==========================================
// Inventory (ניהול מלאי)
// ==========================================

function openPantryModal() { document.getElementById('pantry-modal').classList.remove('hidden'); }

async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); const unit = val('pantry-unit') || "יח'"; if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit}) });
    document.getElementById('pantry-modal').classList.add('hidden'); val('pantry-item', ''); document.getElementById('pantry-quantity').value = 1; fetchBusinessData(); showToast('success', 'הפריט נוסף למלאי');
}

function renderInventory() {
    const list = document.getElementById('pantry-list'); if(!list) return;
    if(inventoryCache.length === 0) { list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">המלאי ריק. ניתן להוסיף ידנית או דרך סריקת חשבונית רכש.</div>'; return; }
    let html = '';
    inventoryCache.forEach(p => {
        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2">
                <div><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p></div>
                <div class="flex items-center gap-3">
                    <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-bold">${p.quantity} ${p.unit || "יח'"}</span>
                    <button onclick="promptInventoryUsage(${p.id}, '${p.item_name.replace(/'/g,"\\'")}')" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1 rounded font-bold transition">דווח שימוש</button>
                </div>
            </div>`;
    });
    list.innerHTML = html;
}

async function promptInventoryUsage(id, name) {
    const qty = prompt(`כמה לקחת מתוך ${name}? (מספר)`);
    if(qty && !isNaN(qty) && parseFloat(qty) > 0) {
        try {
            const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty }) });
            const data = await res.json();
            if(data.success) { showToast('success', 'המלאי עודכן'); fetchBusinessData(); } else { showToast('error', data.error); }
        } catch(e) { showToast('error', 'שגיאה בעדכון'); }
    }
}

function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהל רכש חכם (AI)', null); document.getElementById('familai-loading-text').innerText = 'מנתח קצבי צריכה ומתריע על חוסרים צפויים...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, isBusiness: true }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('דוח ניהול מלאי (AI)', data.insight); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בהפקת הדוח'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת'); }
    });
}

// ==========================================
// Tickets / Projects (פרויקטים ומשימות)
// ==========================================

function openTaskModal(isSelf = false) { 
    document.getElementById('task-modal').classList.remove('hidden'); document.getElementById('task-is-self').value = isSelf; 
    document.getElementById('task-days').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-reward').value = ''; document.getElementById('ai-task-topic').value = ''; const aiRes = document.getElementById('ai-task-results'); if(aiRes) aiRes.classList.add('hidden');
    setTaskMode('manual'); const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardInput = document.getElementById('task-reward'); const assigneeSelect = document.getElementById('task-assignee');

    if(isSelf) { 
        document.getElementById('task-modal-title').innerText = 'דיווח ביצוע'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardInput.placeholder = 'בקשת בונוס (₪)'; 
    } else { 
        document.getElementById('task-modal-title').innerText = 'פתיחת טיקט'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardInput.placeholder = 'בונוס לעמידה ביעד (₪)';
        if(employeesCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחר עובד לביצוע...</option>'; let hasChildren = false;
            employeesCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין עובדים זמינים</option>';
        }
    } 
}
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }

function setTaskMode(mode) {
    const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-task-gen'); const topic = val('ai-task-topic'); 
        if(!topic) return showToast('error', 'כתבו ל-AI את היעד או הפרויקט');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מנתח יעד עסקי...';
        try {
            const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: '18+', topic: topic, groupId: currentGroup.id, isBusiness: true }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success && data.tasks && data.tasks.length > 0) {
                const resultsContainer = document.getElementById('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על הטיקט להוספה:</p>';
                data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-slate-200 hover:bg-slate-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchBusinessData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-microchip"></i> חולל פרויקט'; }
    });
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור עובד לטיקט'); if(!title) return showToast('error', 'יש לכתוב את פירוט המשימה');
    const statusToSend = isSelf ? 'done' : 'pending';
    await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור QA!' : 'טיקט נוצר בהצלחה!'); fetchBusinessData(); 
}

function renderTickets() {
    const list = document.getElementById('tasks-list'); if(!list) return;
    if(ticketsCache.length === 0) { list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין פרויקטים או טיקטים פתוחים.</div>'; return; }
    let html = '';
    ticketsCache.forEach(t => {
        const isMyTicket = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN';
        if (!isMyTicket && !isAdmin) return;
        let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') {
            if (isMyTicket) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${t.title.replace(/'/g, "\\'")}')" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700">הוכחת ביצוע</button>`; } 
            else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">בביצוע</span>`; }
        } else if (t.status === 'done') {
            if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${t.title.replace(/'/g, "\\'")}', ${t.reward})" class="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600">סגור ואשר בונוס</button>`; } 
            else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded">ממתין למנהל</span>`; }
        } else if (t.status === 'approved') { statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check-double"></i> הושלם</span>`; }
        const bonusHtml = t.reward > 0 ? `<span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded ml-2 border border-slate-200">בונוס: ₪${t.reward}</span>` : '';
        html += `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800">${t.title}</p><div class="flex items-center mt-1"><span class="text-[10px] text-slate-500 mr-2"><i class="fa-regular fa-user"></i> ${t.assignee_name}</span>${bonusHtml}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    list.innerHTML = html;
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; document.getElementById('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות תפעולית (QA)', null); document.getElementById('familai-loading-text').innerText = 'סורק ומאמת את ביצוע הטיקט...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id, isBusiness: true }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchBusinessData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function openApproveTaskModal(id, title, currentReward) { document.getElementById('approve-task-id').value = id; document.getElementById('approve-task-title').innerText = title; document.getElementById('approve-task-reward').value = currentReward || 0; document.getElementById('approve-task-modal').classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = document.getElementById('approve-task-id').value; const finalReward = document.getElementById('approve-task-reward').value;
    document.getElementById('approve-task-modal').classList.add('hidden'); triggerConfetti();
    await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    showToast('success', 'הטיקט אושר ונסגר!'); fetchBusinessData();
}

// ==========================================
// Payroll & Expenses (החזרי אש"ל, שכר ותקציב)
// ==========================================

function openLoanModal() { document.getElementById('loan-modal').classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); document.getElementById('loan-modal').classList.add('hidden'); showToast('success', 'דרישת ההחזר נשלחה לאישור!'); fetchBusinessData(); fetchLoans(); }

async function fetchLoans() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        let url; if (currentUser.role === 'ADMIN') { url = `${API}/loans?groupId=${currentGroup.id}`; } else { url = `${API}/loans?userId=${currentUser.id}`; }
        const res = await fetch(url); const loans = await res.json(); renderPayroll(loans);
    } catch(e) { console.error('fetchLoans error:', e); }
}

function renderPayroll(claims = []) {
    if (currentUser.role === 'ADMIN') {
        const panel = document.getElementById('admin-loans-panel'); const list = document.getElementById('admin-loans-list');
        if (!panel || !list) return;
        const pending = claims.filter(c => c.status === 'pending');
        if (pending.length === 0) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');
        list.innerHTML = pending.map(c => `<div class="bg-white p-3 rounded-xl border border-orange-200 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">${c.nickname} – ₪${c.original_amount}</p><p class="text-xs text-slate-500">${c.reason || 'ללא פירוט'}</p></div><div class="flex gap-2"><button onclick="approveExpenseClaim(${c.id})" class="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-green-600 transition">אשר וזכה</button><button onclick="rejectExpenseClaim(${c.id})" class="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition">דחה</button></div></div>`).join('');
    } else {
        const list = document.getElementById('my-loans-list'); if (!list) return;
        if (!claims || claims.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-xs py-3 bg-slate-50 rounded-xl">אין בקשות לאישור</p>'; return; }
        list.innerHTML = claims.map(c => {
            const statusMap = { pending: { label: 'ממתין', cls: 'bg-orange-100 text-orange-600' }, approved: { label: 'אושר וזוכה', cls: 'bg-green-100 text-green-700' }, rejected: { label: 'נדחה', cls: 'bg-red-100 text-red-600' } };
            const s = statusMap[c.status] || { label: c.status, cls: 'bg-slate-100 text-slate-600' };
            return `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><p class="font-bold text-slate-800 text-sm">₪${c.original_amount}</p><p class="text-[10px] text-slate-500">${c.reason || ''} • ${new Date(c.created_at).toLocaleDateString('he-IL')}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100 ${s.cls}">${s.label}</span></div>`;
        }).join('');
    }
}

async function approveExpenseClaim(id) {
    if (!confirm('לאשר את ההחזר ולזכות את העובד בתקציב?')) return;
    const res = await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId: id, adminId: currentUser.id }) }); const data = await res.json();
    if (data.success) { triggerConfetti(); showToast('success', 'ההחזר אושר ובוצע זיכוי!'); fetchBusinessData(); fetchLoans(); } else showToast('error', data.error);
}
async function rejectExpenseClaim(id) {
    if (!confirm('לדחות בקשה זו?')) return;
    await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId: id, adminId: currentUser.id }) }); showToast('success', 'הבקשה נדחתה'); fetchLoans();
}

async function triggerPayday() { if(!confirm('האם לבצע שחרור תקציבים (Payroll) ובונוסים לעובדים שעמדו ביעדים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח למחלקות!`); fetchBusinessData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } }

window.openBalanceAdjustmentModal = function(id, name) { document.getElementById('adjustment-user-id').value = id; document.getElementById('adjustment-user-name').innerText = `עבור: ${name}`; document.getElementById('adjustment-amount').value = ''; document.getElementById('adjustment-reason').value = ''; if(typeof window.toggleAdjustmentType === 'function') window.toggleAdjustmentType('deduct'); document.getElementById('balance-adjustment-modal').classList.remove('hidden'); };
window.submitBalanceAdjustment = async function() { const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const amount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'בונוס / תוספת' : 'הפחתה ממאזן'); if(!amount || amount <= 0) return showToast('error', 'נא להזין סכום תקין'); try { const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type: type, amount: amount, reason: reason }) }); const data = await res.json(); if (data.success) { showToast('success', 'המאזן עודכן בהצלחה!'); document.getElementById('balance-adjustment-modal').classList.add('hidden'); fetchBusinessData(); fetchMembers(); } else showToast('error', data.error || 'שגיאה בעדכון'); } catch(e) { showToast('error', 'שגיאת תקשורת'); } };

function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `הגדרות עבור ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = document.getElementById('bank-user-id').value; const allowance = document.getElementById('bank-allowance').value; const interest = document.getElementById('bank-interest').value; await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עובד עודכנו'); fetchMembers(); }

function openGoalModal() { if(currentUser.role === 'ADMIN') { const gc = document.getElementById('goal-user-select-container'); if(gc) gc.classList.remove('hidden'); } document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { document.getElementById('deposit-goal-id').value = id; document.getElementById('deposit-goal-title').innerText = title; document.getElementById('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = val('goal-target'); const select = document.getElementById('goal-target-user'); const gc = document.getElementById('goal-user-select-container'); const targetUserId = (currentUser.role === 'ADMIN' && gc && gc.style.display !== 'none') ? select.value : null; await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target }) }); triggerConfetti(); document.getElementById('goal-modal').classList.add('hidden'); fetchBusinessData(); }
async function submitDeposit() { const goalId = document.getElementById('deposit-goal-id').value; const amount = document.getElementById('deposit-amount').value; if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount }) }); const data = await res.json(); if (data.success) { triggerConfetti(); document.getElementById('goal-deposit-modal').classList.add('hidden'); fetchBusinessData(); } else showToast('error', data.error); }

// ==========================================
// Cashflow
// ==========================================
function renderCashflow() {
    const list = document.getElementById('cashflow-list'); if (!list) return;
    const userFilter = document.getElementById('cashflow-user-filter') ? document.getElementById('cashflow-user-filter').value : 'all';
    const dateFilter = document.getElementById('cashflow-date-filter') ? document.getElementById('cashflow-date-filter').value : 'all';
    let filtered = allTransactions; 
    if (currentUser.role !== 'ADMIN') { filtered = allTransactions.filter(t => String(t.user_id) === String(currentUser.id)); const cfFilter = document.getElementById('cashflow-user-filter'); if(cfFilter) cfFilter.classList.add('hidden'); } 
    else { const cfFilter = document.getElementById('cashflow-user-filter'); if(cfFilter) cfFilter.classList.remove('hidden'); if (userFilter !== 'all' && userFilter !== '') { filtered = allTransactions.filter(t => String(t.user_id) === String(userFilter)); } }
    if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(t => new Date(t.date) >= cutoffDate); }
    if (filtered.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין פעולות להצגה בתקופה זו.</p>'; return; }
    let html = '';
    filtered.forEach(t => {
        const isIncome = t.type === 'income'; const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
        const amountClass = isIncome ? 'text-green-600' : 'text-slate-800'; const prefix = isIncome ? '+' : '-';
        const d = new Date(t.date); const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
        const userName = t.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${t.user_name}</span>` : '';
        const catLabel = BUDGET_LABELS[t.category] || t.category || ''; const catBadge = catLabel ? `<span class="text-[9px] text-slate-400 border border-slate-200 px-1.5 rounded-full mr-2">${catLabel}</span>` : '';
        const safeDesc = t.description ? t.description.replace(/'/g, "\\'") : '';
        const editBtn = currentUser.role === 'ADMIN' ? `<button onclick="openEditTransactionModal(${t.id}, ${t.amount}, '${safeDesc}', '${t.category}', '${t.type}')" class="text-slate-400 bg-white border border-slate-200 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
        html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between hover:border-slate-200 transition"><div class="flex-1 overflow-hidden pr-2"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${t.description}</span> ${userName}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} ${catBadge}</p></div><div class="flex items-center gap-3 pl-1"><span class="font-bold text-base ${amountClass} whitespace-nowrap" dir="ltr">${prefix}₪${t.amount}</span>${editBtn}</div></div>`;
    });
    list.innerHTML = html;
}

function openEditTransactionModal(id, amount, desc, cat, type) { document.getElementById('edit-trans-id').value = id; document.getElementById('edit-trans-old-amount').value = amount; document.getElementById('edit-trans-type').value = type; document.getElementById('edit-trans-amount').value = amount; document.getElementById('edit-trans-desc').value = desc; const catSelect = document.getElementById('edit-trans-cat'); catSelect.innerHTML = ''; if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; } document.getElementById('edit-transaction-modal').classList.remove('hidden'); }
async function submitEditTransaction() { const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat'); if(!amount) return showToast('error', 'נא להזין סכום'); try { const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id }) }); const data = await res.json(); if(data.success) { showToast('success', 'הפעולה עודכנה!'); document.getElementById('edit-transaction-modal').classList.add('hidden'); fetchBusinessData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); } } catch(e) { showToast('error', 'שגיאת תקשורת'); } }
async function deleteTransaction() { const id = val('edit-trans-id'); if(!confirm('האם למחוק פעולה זו לחלוטין?')) return; try { const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הפעולה נמחקה!'); document.getElementById('edit-transaction-modal').classList.add('hidden'); fetchBusinessData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאת תקשורת'); } }
function openTransactionModal(t) { document.getElementById('trans-type').value=t; document.getElementById('trans-modal-title').innerText=t==='income'?'הכנסה חדשה':'הוצאה תפעולית'; const s=document.getElementById('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); document.getElementById('trans-date').value = new Date().toISOString().split('T')[0]; if(typeof window.toggleTransType === 'function') window.toggleTransType('onetime'); document.getElementById('transaction-modal').classList.remove('hidden'); }
async function submitTransaction() { const amount = val('trans-amount'); if(!amount) return; const isRecurring = document.getElementById('trans-is-recurring').value === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0]; await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null }) }); document.getElementById('transaction-modal').classList.add('hidden'); showToast('success', 'נשמר!'); fetchBusinessData(); }

// ==========================================
// Budget & Forecast
// ==========================================
async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id;
    const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); const data = await res.json();
    const list = document.getElementById('budget-list'); if(!list) return; list.innerHTML = '';
    const baseCategories = CATEGORIES.expense.map(c => c.value);
    data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
    baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });
    
    const createRow = (category, spent, limit) => {
        const pct = limit > 0 ? (spent / limit) * 100 : 0; let color = 'bg-slate-800'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
        const limitDisplay = limit > 0 ? `₪${limit}` : 'לא הוגדר'; const catName = BUDGET_LABELS[category] || category;
        const editBtn = `<button onclick="openBudgetModal('${category}', '${catName}', ${limit}); event.stopPropagation();" class="text-[10px] text-slate-600 font-bold ml-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-0.5 rounded transition">ערוך יעד</button>`;
        return `<div class="mb-5"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 text-base">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
    };
    data.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit); });
}
function openBudgetModal(catId, catName, currentLimit) { document.getElementById('budget-cat-name').innerText = catName; document.getElementById('budget-cat-id').value = catId; document.getElementById('budget-limit').value = currentLimit > 0 ? currentLimit : ''; document.getElementById('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { const cat = document.getElementById('budget-cat-id').value; const limit = document.getElementById('budget-limit').value; const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); document.getElementById('budget-modal').classList.add('hidden'); fetchBudget(); }
function openAddBudgetCategoryModal() { document.getElementById('new-budget-cat-name').value = ''; document.getElementById('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { const catName = document.getElementById('new-budget-cat-name').value; if(!catName) return; const target = currentUser.role === 'ADMIN' ? (document.getElementById('budget-filter').value || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); document.getElementById('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); }

function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסט AI', null); document.getElementById('familai-loading-text').innerText = 'מנתח הוצאות חודשיות וקצב שריפת מזומנים...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, isBusiness: true }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('דוח ייעול ארגוני', data.insight); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת'); }
    });
}

function populateForecastPeriods() {
    const mSelect = document.getElementById('forecast-month-filter'); const ySelect = document.getElementById('forecast-year-filter');
    if (mSelect && mSelect.options.length === 0) { const now = new Date(); for(let i=0; i<12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); const monthStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); mSelect.innerHTML += `<option value="${monthStr}">${label}</option>`; } }
    if (ySelect && ySelect.options.length === 0) { const curYear = new Date().getFullYear(); for(let i=0; i<5; i++) { ySelect.innerHTML += `<option value="${curYear + i}">שנת ${curYear + i}</option>`; } }
}
window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    document.getElementById('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    document.getElementById('forecast-month-filter').classList.toggle('hidden', mode !== 'monthly');
    document.getElementById('forecast-year-filter').classList.toggle('hidden', mode !== 'yearly');
    renderForecast();
};
async function renderForecast() {
    populateForecastPeriods(); const list = document.getElementById('forecast-list'); if(!list) return;
    if(!currentGroup || !currentGroup.id) return;
    const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
    const periodVal = currentForecastMode === 'monthly' ? document.getElementById('forecast-month-filter').value : document.getElementById('forecast-year-filter').value;
    let startDate, endDate;
    if (currentForecastMode === 'monthly') { if (!periodVal) { const now = new Date(); startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); } else { const [year, month] = periodVal.split('-'); startDate = new Date(year, parseInt(month) - 1, 1); endDate = new Date(year, parseInt(month), 0, 23, 59, 59); } } else { const year = periodVal ? parseInt(periodVal) : new Date().getFullYear(); startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59); }
    let startingBalance = 0; if (targetUserId === 'all') { startingBalance = membersCache.reduce((sum, m) => sum + (parseFloat(m.balance) || 0), 0); } else { const user = membersCache.find(m => String(m.id) === String(targetUserId)); if (user) startingBalance = parseFloat(user.balance) || 0; }
    const items = []; let txList = targetUserId !== 'all' ? allTransactions.filter(t => String(t.user_id) === String(targetUserId)) : allTransactions;
    txList.forEach(t => {
        const txDate = new Date(t.date); const amt = parseFloat(t.amount); const isRecurring = t.is_recurring === true || String(t.is_recurring).toLowerCase() === 'true';
        if (!isRecurring) { if (txDate >= startDate && txDate <= endDate) items.push({ ...t, amount: amt, date_str: txDate.toLocaleDateString('he-IL') }); } 
        else {
            let txStartMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1); let validEnd = true; let endD = null;
            if (t.end_month) { const [endYear, endMonth] = t.end_month.split('-'); endD = new Date(endYear, parseInt(endMonth), 0, 23, 59, 59); if (startDate > endD) validEnd = false; }
            if (endDate < txStartMonth) validEnd = false;
            if (validEnd) {
                if (currentForecastMode === 'monthly') { items.push({ ...t, amount: amt, date_str: 'קבוע (חודשי)' }); } 
                else if (currentForecastMode === 'yearly') { let monthsActive = 0; for (let m = 0; m < 12; m++) { let checkStart = new Date(startDate.getFullYear(), m, 1); let checkEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59); let isActive = checkStart >= txStartMonth; if (endD && checkEnd > endD) isActive = false; if (isActive) monthsActive++; } if (monthsActive > 0) items.push({ ...t, amount: amt * monthsActive, description: `${t.description} (x${monthsActive} ח')`, date_str: 'קבוע (שנתי)' }); }
            }
        }
    });
    forecastCache = { startingBalance, items }; const itemsToRender = forecastCache.items || [];
    let totalIncome = 0; let totalExpense = 0; let projectedNetChange = 0; const incomeData = {}; const expenseData = {}; let html = ''; const now = new Date();
    if(itemsToRender.length === 0) { html = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">אין צפי פעולות לתקופה זו</p>'; } 
    else {
        itemsToRender.forEach(item => {
            const isIncome = item.type === 'income'; const amt = parseFloat(item.amount); const itemDate = new Date(item.date); const isRecurring = item.is_recurring === true || String(item.is_recurring).toLowerCase() === 'true';
            if(isIncome) { totalIncome += amt; incomeData[item.category] = (incomeData[item.category] || 0) + amt; } else { totalExpense += amt; expenseData[item.category] = (expenseData[item.category] || 0) + amt; }
            if (isRecurring || itemDate > now) { if (isIncome) projectedNetChange += amt; else projectedNetChange -= amt; }
            const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = isIncome ? 'text-green-600' : 'text-slate-800'; const prefix = isIncome ? '+' : '-';
            const recBadge = isRecurring ? '<span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded-full font-bold ml-2 shadow-sm whitespace-nowrap border border-slate-200">קבועה <i class="fa-solid fa-rotate text-[8px]"></i></span>' : '';
            const userName = currentUser.role === 'ADMIN' && item.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${item.user_name}</span>` : '';
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between text-right hover:border-slate-200 transition"><div class="flex-1 overflow-hidden"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${item.description}</span> ${userName} ${recBadge}</p><p class="text-[10px] text-slate-400 mt-1">${item.date_str}</p></div><span class="font-bold text-base ${amountClass} whitespace-nowrap shrink-0" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        });
    }
    list.innerHTML = html; const startBalance = parseFloat(forecastCache.startingBalance) || 0; const projectedBalance = startBalance + projectedNetChange;
    document.getElementById('forecast-net-change').innerText = `₪${projectedNetChange.toFixed(2)}`; document.getElementById('forecast-net-change').className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`; document.getElementById('forecast-projected-balance').innerText = `₪${projectedBalance.toFixed(2)}`;
    drawForecastCharts({ income: totalIncome }, { expense: totalExpense });
}
function drawForecastCharts(incomeData, expenseData) {
    const container = document.getElementById('forecast-charts'); if(!container) return; container.className = "mt-6 border-t border-slate-100 pt-6 flex justify-center";
    container.innerHTML = `<div class="w-full max-w-[250px]"><h4 class="text-sm font-bold text-center text-slate-600 mb-2">הכנסות מול הוצאות צפויות</h4><div class="relative h-48 w-full flex justify-center"><canvas id="ratioChart"></canvas></div></div>`;
    const ctx = document.getElementById('ratioChart'); if(!ctx) return; if(forecastRatioChart) forecastRatioChart.destroy();
    const totalInc = Object.values(incomeData).reduce((a, b) => a + b, 0); const totalExp = Object.values(expenseData).reduce((a, b) => a + b, 0);
    if(totalInc > 0 || totalExp > 0) { forecastRatioChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [totalInc, totalExp], backgroundColor: ['#22c55e', '#1e293b'], borderWidth: 2, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { family: 'Rubik' } } } } } }); } 
    else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">אין פעולות עתידיות להצגת גרף</p>'; }
}
function getForecastInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסט תחזיות', null); document.getElementById('familai-loading-text').innerText = 'מחשב את התזרים העתידי לארגון...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? document.getElementById('forecast-month-filter').value : document.getElementById('forecast-year-filter').value;
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId, isBusiness: true }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('תחזית תזרים AI', data.insight); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התשקיף'); }
        } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

// ==========================================
// Academy (הכשרות עובדים)
// ==========================================
async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא להכשרה'); btn.disabled = true; btn.innerText = 'מייצר לומדה... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: '18+', topic: val('ai-topic'), groupId: currentGroup.id, isBusiness: true }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'לומדת ה-AI מוכנה!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBusinessData(); openAssignModalSpecific(data.bundleId); } 
            else showToast('error', data.error || 'שגיאה ביצירה');
        } catch(e) { showToast('error', 'תקלה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'חולל חפיפה'; }
    });
}

function updateAssignDetails() { const select = document.getElementById('assign-bundle-select'); const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { document.getElementById('assign-reward').value = bundle.reward; } }
function openAssignModal() {
    const cSelect = document.getElementById('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר עובד...</option>';
    if(employeesCache) { employeesCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); }
    const bSelect = document.getElementById('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר לומדה...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">${b.title}</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין לומדות במאגר</option>'; }
    document.getElementById('assign-reward').value = ''; document.getElementById('assign-days').value = ''; document.getElementById('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = document.getElementById('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = document.getElementById('assign-child-select').value; const bundleId = document.getElementById('assign-bundle-select').value; const reward = document.getElementById('assign-reward').value; const days = document.getElementById('assign-days').value;
    if(!childId || !bundleId) return showToast('error', 'אנא בחר עובד ולומדה');
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days }) });
    document.getElementById('assign-quiz-modal').classList.add('hidden'); showToast('success', 'שויך בהצלחה לעובד'); fetchBusinessData();
}

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 מאגר לומדות ונהלים</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין הכשרות זמינות. לחץ על יצירה למעלה.</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-slate-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-sm"><i class="fa-solid fa-book-open"></i></div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • בונוס לעובר: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition">שיוך</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 הכשרות ששויכו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו לומדות לעובדים עדיין.</p>'; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הוסמך' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${b.assignee_name}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    const libList = document.getElementById('library-list'); if (!libList) return;
    let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
    if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
    if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl border border-slate-200">אין לומדות חדשות שטרם ביצעת.</p>'; return; }
    let libHtml = '';
    filtered.forEach(b => {
        const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
        libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-slate-300 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-sm"><i class="fa-solid fa-book-open"></i></div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> נוצר: ${cDate}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition shadow-sm">למידה</button></div>`;
    }); libList.innerHTML = libHtml;
}

function renderMyAssignments(assignments) {
    const list = document.getElementById('my-assignments-list'); const historyList = document.getElementById('academy-history-list'); const historyContainer = document.getElementById('academy-history-container');
    if (!list || !historyList) return;
    const active = assignments.filter(a => a.status === 'assigned'); const history = assignments.filter(a => a.status !== 'assigned');
    if (active.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl border border-slate-200">אין מטלות הכשרה פתוחות</p>'; } 
    else { list.innerHTML = active.map(b => `<div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center mb-2"><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500 mt-0.5">בונוס עמידה ביעד: ₪${b.custom_reward !== null ? b.custom_reward : b.default_reward}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition">התחל</button></div>`).join(''); }
    if (history.length > 0 && historyContainer) { historyContainer.classList.remove('hidden'); historyList.innerHTML = history.map(b => `<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2 opacity-80"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500">ציון: ${b.score}%</p></div><span class="text-[10px] font-bold ${b.status === 'completed' ? 'text-green-600' : 'text-red-600'}">${b.status === 'completed' ? 'עבר' : 'נכשל'}</span></div>`).join(''); } else if(historyContainer) { historyContainer.classList.add('hidden'); }
}

async function requestChallenge(bundleId = null) {
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'הלומדה נוספה למטלות!'); fetchBusinessData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
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
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 border border-slate-200 font-medium hover:bg-slate-100 text-slate-700">${opt}</button>`; });
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
    document.getElementById('quiz-icon').innerHTML = passed ? '🏆' : '📚'; document.getElementById('quiz-msg-title').innerText = passed ? 'הסמכה הושלמה!' : 'נדרש ריענון נוסף'; document.getElementById('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית בבונוס של ₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `סף מעבר: ${currentQuizData.threshold}%. נסה שוב.`; document.getElementById('quiz-score-display').innerText = `ציון סופי: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) document.getElementById('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) });
    fetchBusinessData(); 
}

function closeQuiz() { document.getElementById('quiz-runner-modal').classList.add('hidden'); document.getElementById('question-container').classList.remove('hidden'); document.getElementById('quiz-result').classList.add('hidden'); }

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; document.getElementById('btn-tutor').disabled = true; document.getElementById('btn-tutor').innerText = 'מייצר ניתוח שגיאה... ⏳';
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id, isBusiness: true }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('ניתוח שגיאות', data.explanation); }
        } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { document.getElementById('btn-tutor').disabled = false; document.getElementById('btn-tutor').innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> הצג ניתוח שגיאה מקצועי (AI)'; }
    });
}

// ==========================================
// Admin & Profiles
// ==========================================

function openProfileModal() { document.getElementById('old-password').value = ''; document.getElementById('new-password').value = ''; document.getElementById('profile-modal').classList.remove('hidden'); }

async function submitChangePassword(e) {
    e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password');
    const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...';
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); document.getElementById('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); }
    } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'עדכן סיסמה במערכת'; }
}

async function sendCredentialsEmail() {
    if(!confirm('האם לשלוח את כל שמות המשתמשים והסיסמאות של אנשי הצוות למייל שלך?')) return;
    const btn = document.querySelector('#admin-members-tools button'); if(!btn) return;
    const originalText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח למייל...';
    try {
        const res = await fetch(`${API}/admin/send-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); const data = await res.json();
        if (data.success) { showToast('success', 'הפרטים נשלחו בהצלחה למייל המנהל!'); } else { showToast('error', data.error || 'שגיאה בשליחת המייל'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } document.getElementById('invite-modal').classList.remove('hidden'); }

function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד סביבה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! הוקמה עבורנו מערכת ניהול ב-Oneflow Life Enterprise 🚀\n\nהגדרתי אותך כמנהל/ת עם הרשאות מלאות.\nקוד הארגון שלנו הוא: ${currentGroup.group_code}\nלחץ על הקישור להצטרפות למערכת:\n🔗 ${joinLink}` : `היי! הוקמה עבורנו סביבת עבודה ב-Oneflow Life 🚀\n\nקוד הארגון שלנו הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להצטרף לצוות ולפתוח לעצמך פורטל עובד אישי:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); document.getElementById('invite-modal').classList.add('hidden'); 
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json();
        const list = document.getElementById('pending-list'); const container = document.getElementById('admin-panel');
        if (users && users.length > 0) {
            container.classList.remove('hidden'); list.innerHTML = '';
            users.forEach(u => { const age = new Date().getFullYear() - u.birth_year; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm border border-orange-100"><span class="text-sm font-bold text-slate-700">${u.nickname} (${age})</span><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-700 transition">אישור</button></div>`; });
        } else { if(container) container.classList.add('hidden'); }
    } catch(e) { console.error(e); }
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'איש צוות אושר במערכת!'); fetchPendingUsers(); fetchMembers(); }

async function deleteUser(id, name) {
    if(!confirm(`האם אתה בטוח שברצונך למחוק את העובד "${name}" מהמערכת לצמיתות?`)) return;
    try {
        const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'העובד הוסר בהצלחה'); fetchMembers(); fetchBusinessData(); } else { showToast('error', data.error || 'שגיאה בהסרה'); }
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}

function triggerManualTour() { 
    document.getElementById('profile-modal').classList.add('hidden'); 
    setTimeout(() => { switchTab('feed'); startAdminTour(); }, 300);
}

function startAdminTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🚀", intro: "מערכת הניהול החכמה שלכם שמרכזת את כל הפעילות העסקית תחת קורת גג אחת." },
            { element: '#tour-header', title: "סרגל עליון", intro: "כאן תמצאו את פרטי הסביבה שלכם ותוכלו לגשת לתפריט ההגדרות והפרופיל האישי.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "מנוע ה-AI שלנו ⚡", intro: "כל ארגון מקבל חבילת פעולות יומיות לשימוש בבינה המלאכותית שלנו. כאן ניתן לראות כמה נשאר להיום.", position: 'bottom' },
            { element: '#tour-balance-card', title: "תקציב ושכר 💳", intro: "בכרטיס זה תוכלו לראות את מאזן קופת הארגון בזמן אמת, או את התקציב האישי במידה ומדובר בתצוגת עובד.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "הכפתור הצף מאפשר לכם לרשום הוצאות, הכנסות או לפתוח דרישות רכש מכל מסך במערכת.", position: 'top' },
            { element: '#tab-timeclock', title: "שעון נוכחות ⏱️", intro: "החתמת כניסה ויציאה חכמה לעובדים, כולל סיכום שעות אוטומטי למנהלים.", position: 'bottom' },
            { element: '#tab-shop', title: "מערכת רכש 🛒", intro: "ריכוז דרישות ציוד מהעובדים, סריקת חשבוניות ספק בעזרת AI והפקת הזמנות מסודרות.", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מלאי 📦", intro: "מעקב בזמן אמת אחרי חומרי הגלם והציוד המשרדי בארגון, עם התראות חוסר חכמות.", position: 'bottom' },
            { element: '#tab-bank', title: "פיירול ותקציבים 💳", intro: "סגירת חודש, ניהול בקשות אש\"ל של עובדים ומעקב אחרי יעדי המחלקות.", position: 'bottom' },
            { element: '#tab-budget', title: "בקרה תפעולית 📊", intro: "הגדרת מסגרות תקציב למחלקות (שיווק, תפעול) וניתוח חריגות בעזרת היועץ הארגוני (AI).", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "ראו את הנולד! מעקב אחרי התחייבויות קבועות, חישוב Burn Rate ותחזיות קדימה.", position: 'bottom' },
            { element: '#tab-tasks', title: "ניהול פרויקטים ✅", intro: "פתיחת טיקטים, שיוך משימות לצוות ובדיקת איכות וביצועים אוטומטית.", position: 'bottom' },
            { element: '#tab-academy', title: "פורטל נהלים 🎓", intro: "יצירת לומדות חפיפה, מבחני בטיחות ונהלים בעזרת AI. כל עובד שעובר הסמכה יכול להיות מתומרץ.", position: 'bottom' },
            { element: '#tab-members', title: "ניהול הרשאות 👥", intro: "הזמינו עובדים חדשים לצוות בקלות דרך קישור מהיר לוואטסאפ ונהלו את סביבת העבודה." }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-timeclock') switchTab('timeclock'); else if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = document.getElementById('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}
