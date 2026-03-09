// תיקון סגנונות הרמטי לספריית הסיור - משלב פיתרון מושלם למובייל ולמחשב
const introStyle = document.createElement('style');
introStyle.innerHTML = `
    .introjs-fixParent {
        position: static !important;
        transform: none !important;
        filter: none !important;
        z-index: auto !important;
    }
    /* 🔥 התיקון הקריטי למובייל: הבועה מנותקת מהאלמנט ותמיד במרכז המסך 🔥 */
    @media (max-width: 768px) {
        .introjs-tooltip {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            width: 90vw !important;
            max-width: 350px !important;
            bottom: auto !important;
            right: auto !important;
            z-index: 9999999 !important;
        }
        .introjs-arrow { display: none !important; }
        .introjs-tooltipReferenceLayer { display: none !important; }
    }
    /* כיבוי אנימציות של אלמנטים מוארים בזמן הסיור למניעת בריחה */
    body.introjs-active .introjs-showElement {
        transform: none !important;
        transition: none !important;
        animation: none !important;
    }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null;
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null;
let forceTourStart = false; 

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'} ], 
    expense: [ {value:'food',label:'🍔 מסעדות וטייקאווי'}, {value:'groceries',label:'🛒 סופר ופארם'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך וחוגים'}, {value:'vacation',label:'✈️ חופשות וטיולים'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} ] 
};

window.onload = async () => { 
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { 
        document.getElementById('join-code').value = inviteCode; 
        if(inviteRole) document.getElementById('join-role').value = inviteRole; 
        hidePreloaderAndShowAuth('join');
        return; 
    }
    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { 
                const res = await fetch(`${API}/users/${session.user.id}`); 
                if(res.ok) { 
                    currentUser = await res.json(); 
                    currentGroup = session.group; 
                    localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup})); 
                    await loadDashboard(); 
                } else { hidePreloaderAndShowAuth('login'); }
            } else { hidePreloaderAndShowAuth('login'); }
        } catch(e) { hidePreloaderAndShowAuth('login'); } 
    } else { hidePreloaderAndShowAuth('login'); }
};

// --- ACCESSIBILITY ---
let currentFontSize = 1.0;
function toggleAccessibilityMenu() { document.getElementById('accessibility-modal').classList.toggle('hidden'); }
function changeFontSize(delta) { currentFontSize *= delta; document.documentElement.style.fontSize = `${currentFontSize * 100}%`; }
function toggleAccessFeature(className) { document.body.classList.toggle(className); }
function resetAccessibility() { currentFontSize = 1.0; document.documentElement.style.fontSize = '100%'; document.body.classList.remove('acc-contrast', 'acc-grayscale', 'acc-underlines', 'acc-readable-font'); }

// --- AUTH & SETUP ---
function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); document.getElementById(`view-${view}`).classList.remove('hidden'); }
function selectType(t) { document.getElementById('create-type').value=t; document.getElementById('type-family').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; document.getElementById('type-group').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; }
function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } document.getElementById('tos-modal').classList.remove('hidden'); }
function closeTosModal() { document.getElementById('tos-modal').classList.add('hidden'); }

async function handleLogin(e) { e.preventDefault(); forceTourStart = false; authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); }
async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך');
    forceTourStart = true; 
    authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); 
}
async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך');
    forceTourStart = true;
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d=await res.json(); 
    if(d.success) { showToast('success', 'נשלח בהצלחה!'); switchView('login'); } else showToast('error', d.error);
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; 
            currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור'); } finally { toggleLoader('login', false); } 
}

// --- DASHBOARD LOGIC ---
function switchTab(t) { 
    ['feed','tasks','shop','bank','academy','members','budget','pantry'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    if (t === 'shop') renderShopList();
}
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden'); document.getElementById('dashboard-container').classList.remove('hidden'); document.getElementById('fab-container').classList.remove('hidden');
    document.getElementById('dash-group-name').innerText = currentGroup.name; document.getElementById('dash-nickname').innerText = currentUser.nickname;
    document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
    } else { 
        ['bank-child-view','academy-user-view','btn-self-task'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase(); 
        document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; 
        document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
    }
    
    await fetchData();
    const showedWelcome = await checkGlobalWelcome();
    if (!showedWelcome) checkAndStartTour(forceTourStart);
    forceTourStart = false;
    document.getElementById('app-preloader').classList.add('hidden');
}

// --- TOURS ---
function startAdminTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחלתי!', skipLabel: 'דלג',
        showProgress: true, rtl: true, steps: [
            { title: "ברוכים הבאים! 👋", intro: "בואו נעשה סיור קצר כדי להכיר את המערכת." },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תראו את היתרה הפנויה של המשפחה." },
            { element: '#tour-fab-btn', title: "הוספה מהירה ⚡", intro: "לחיצה כאן תאפשר לכם לרשום הוצאה או הכנסה." },
            { element: '#tab-bank', title: "ניהול הבנק 🏦", intro: "כאן מחלקים דמי כיס וריביות." },
            { element: '#tab-tasks', title: "משימות לילדים ✅", intro: "הגדירו משימות ותגמולים לילדים." },
            { element: '#tab-academy', title: "אקדמיה 🎓", intro: "צרו אתגרים לימודיים ב-AI." }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); 
        if (targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            scrollContainer.style.scrollBehavior = 'auto';
            scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2);
            scrollContainer.style.scrollBehavior = 'smooth';
        }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.start();
}

function startChildTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג',
        showProgress: true, rtl: true, steps: [
            { title: "היי! 🎉", intro: "מוכן לנהל את הכסף שלך כמו גדול? בוא נכיר את האפליקציה!" },
            { element: '#user-balance', title: "הארנק שלי 💳", intro: "כאן תראה כמה כסף יש לך בחשבון ברגע זה." },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "כאן תראה את דמי הכיס ותפתח קופות חיסכון." },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "בצע משימות מההורים וקבל תגמול ישר לארנק!" },
            { element: '#tab-academy', title: "אקדמיה 🎓", intro: "למד ותענה על חידונים כדי להרוויח עוד בונוסים." }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); 
        if (targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            scrollContainer.style.scrollBehavior = 'auto';
            scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2);
            scrollContainer.style.scrollBehavior = 'smooth';
        }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.start();
}

// --- UTILS ---
function val(id) { return document.getElementById(id).value; }
function showToast(t,m) { const el=document.getElementById('toast'); document.getElementById('toast-message').innerText=m; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function toggleFab() { document.getElementById('fab-container').classList.toggle('fab-open'); }
function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 400); }

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); const data = await res.json();
        if (data.message) {
            const tourKey = `ofl_welcome_${currentUser.id}_${currentGroup.group_code}`;
            if (localStorage.getItem(tourKey) !== data.message) {
                document.getElementById('welcome-modal-text').innerText = data.message;
                document.getElementById('welcome-modal').classList.remove('hidden');
                localStorage.setItem(tourKey, data.message); return true;
            }
        }
    } catch(e) {} return false;
}
function closeWelcomeModal() { document.getElementById('welcome-modal').classList.add('hidden'); checkAndStartTour(false); }

async function fetchData() {
    const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
    if(data.user) { currentUser.balance = data.user.balance; document.getElementById('user-balance').innerText = `₪${data.user.balance}`; }
    // Render logic for each tab (tasks, bundles, budget etc.) would go here...
    buildAndRenderFeed(data);
}

function buildAndRenderFeed(data) {
    const list = document.getElementById('unified-feed-list'); list.innerHTML = '';
    // Mock for now or real logic if needed
    list.innerHTML = `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-sm text-slate-500 text-center">אין פעילות להצגה כרגע</div>`;
}

// ... Additional API logics (submitTransaction, submitTask, etc.) remain as th
