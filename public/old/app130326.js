// --- עיצוב יוקרתי לסיור המודרך (Intro.js) ---
const introStyle = document.createElement('style');
introStyle.innerHTML = `
    .introjs-showElement { z-index: 9999998 !important; transform: none !important; } 
    .introjs-fixParent { z-index: auto !important; opacity: 1.0 !important; transform: none !important; filter: none !important; } 
    body.introjs-active .slider-container, body.introjs-active .slider-scroll, body.introjs-active .overflow-hidden { overflow: visible !important; } 
    body.introjs-active header.sticky { z-index: 1 !important; } 
    .introjs-overlay { z-index: 9999996 !important; background-color: rgba(15, 23, 42, 0.75) !important; backdrop-filter: blur(4px) !important; } 
    .introjs-helperLayer { z-index: 9999997 !important; border-radius: 1.5rem !important; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4) !important; } 
    .introjs-tooltipReferenceLayer { z-index: 9999998 !important; } 
    .introjs-tooltip { z-index: 9999999 !important; background: white !important; border-radius: 2rem !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; border: none !important; padding: 0 !important; overflow: hidden !important; max-width: 340px !important; font-family: 'Rubik', sans-serif !important; } 
    .introjs-tooltipheader { background: linear-gradient(to right, #2563eb, #4f46e5) !important; padding: 1.5rem !important; margin: 0 !important; text-align: center !important; display: flex; justify-content: center; } 
    .introjs-tooltiptitle { color: white !important; font-size: 1.25rem !important; font-weight: 700 !important; margin: 0 !important; width: 100% !important; } 
    .introjs-skipbutton { color: rgba(255,255,255,0.8) !important; position: absolute !important; top: 15px !important; right: 15px !important; font-size: 24px !important; background: transparent !important; text-shadow: none !important; font-weight: normal !important; } 
    .introjs-skipbutton:hover { color: white !important; } 
    .introjs-tooltiptext { padding: 1.5rem !important; color: #334155 !important; font-size: 1rem !important; line-height: 1.6 !important; text-align: center !important; font-weight: 500 !important; } 
    .introjs-tooltipbuttons { border-top: none !important; padding: 0 1.5rem 1.5rem 1.5rem !important; display: flex !important; gap: 0.75rem !important; background: white !important; } 
    .introjs-button { border-radius: 0.75rem !important; padding: 0.75rem 1rem !important; font-weight: 700 !important; text-shadow: none !important; box-shadow: none !important; border: none !important; flex: 1 !important; text-align: center !important; transition: all 0.2s !important; } 
    .introjs-nextbutton, .introjs-donebutton { background-color: #3b82f6 !important; color: white !important; } 
    .introjs-nextbutton:hover, .introjs-donebutton:hover { background-color: #2563eb !important; } 
    .introjs-prevbutton { background-color: #f1f5f9 !important; color: #475569 !important; } 
    .introjs-prevbutton:hover { background-color: #e2e8f0 !important; } 
    .introjs-disabled { opacity: 0.5 !important; cursor: not-allowed !important; pointer-events: none !important; } 
    .introjs-bullets { padding-bottom: 1.5rem !important; background: white !important; } 
    .introjs-bullets ul li a { width: 8px !important; height: 8px !important; border-radius: 50% !important; background: #cbd5e1 !important; } 
    .introjs-bullets ul li a.active { background: #3b82f6 !important; width: 16px !important; border-radius: 4px !important; } 
    @media (max-width: 768px) { 
        .introjs-tooltipReferenceLayer { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important; right: auto !important; bottom: auto !important; width: 90vw !important; } 
        .introjs-tooltip { position: relative !important; margin: 0 auto !important; } 
        .introjs-arrow { display: none !important; } 
    }
`;
document.head.appendChild(introStyle);

// --- משתנים גלובליים והגדרות ---
const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

let currentUser = null; 
let currentGroup = null; 
let pollInterval = null; 
let saToken = null; 
let saAllGroups = []; 
let saAllUsers = [];

let membersCache = []; 
let shoppingListCache = []; 
let wisdomCache = {}; 
let bundlesCache = []; 
let allBundles = []; 
let pantryCache = [];
let allTasks = []; 
let allTransactions = []; 
let feedCache = []; 

let currentVerifyTaskId = null; 
let currentVerifyTaskTitle = null; 
let currentWrongAnswers = []; 
let forceTourStart = false;

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];

const CATEGORIES = { 
    income: [ 
        {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, 
        {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'} 
    ], 
    expense: [ 
        {value:'food',label:'🍔 מסעדות וטייקאווי'}, {value:'groceries',label:'🛒 סופר ופארם'}, 
        {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור ותחזוקה'}, 
        {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, 
        {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, 
        {value:'education',label:'📚 חינוך וחוגים'}, {value:'vacation',label:'✈️ חופשות וטיולים'}, 
        {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} 
    ] 
};

const BUDGET_LABELS = { 
    'food': '🍔 מסעדות', 'groceries': '🛒 סופר', 'transport': '🚌 דלק', 'home': '🏠 דיור', 
    'bills': '📄 חשבונות', 'fun': '🎉 פנאי', 'clothes': '👕 ביגוד', 'health': '💊 בריאות', 
    'education': '📚 חינוך', 'vacation': '✈️ חופשות', 'pets': '🐶 חיות', 'gifts': '🎁 מתנות', 
    'other': '💸 אחר', 'allocations': '👶 הפרשות לילדים', 'allowance': '💰 דמי כיס', 
    'tasks': '✅ משימות', 'academy': '🎓 אקדמיה', 'savings': '🐖 חיסכון' 
};

const PRODUCT_DB = { 
    "ירקות ופירות 🍎": ["עגבניות", "מלפפונים", "פלפל אדום", "בצל יבש", "תפוחי אדמה", "בננות", "לימון", "תפוח עץ", "אבוקדו"], 
    "חלב וביצים 🥛": ["חלב 3%", "קוטג' 5%", "גבינה לבנה 5%", "גבינה צהובה", "ביצים L", "יוגורט", "חמאה", "שמנת"], 
    "לחם ומאפים 🍞": ["לחם אחיד", "לחם מלא", "פיתות", "לחמניות"], 
    "מזווה 🍝": ["אורז", "פסטה", "פתיתים", "עדשים", "שמן זית", "שמן קנולה", "סוכר", "מלח", "קמח", "קפה", "תה"], 
    "בשר ודגים 🍗": ["חזה עוף", "בשר טחון", "שניצל", "נקניקיות", "סלמון"], 
    "ניקיון 🧻": ["נייר טואלט", "מגבונים", "נוזל כלים", "אבקת כביסה", "שמפו", "משחת שיניים"], 
    "חטיפים 🍫": ["במבה", "ביסלי", "בייגלה", "עוגיות", "שוקולד"] 
};

const FLAT_PRODUCTS = []; 
for (const [cat, items] of Object.entries(PRODUCT_DB)) { 
    items.forEach(i => FLAT_PRODUCTS.push({ name: i, category: cat })); 
}

let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

// --- פונקציות עזר וכלים ---
function val(id) { 
    const el = document.getElementById(id); 
    return el ? el.value : ''; 
}

function showToast(t, m) { 
    const el = document.getElementById('toast'); 
    const icon = document.getElementById('toast-icon'); 
    const msg = document.getElementById('toast-message');
    if(!el || !icon || !msg) return;
    el.classList.remove('hidden'); 
    msg.innerText = m; 
    icon.className = t === 'success' ? 'fa-solid fa-check text-green-400' : 'fa-solid fa-xmark text-red-400'; 
    setTimeout(() => el.classList.add('hidden'), 3000); 
}

function toggleLoader(a, s) { 
    const txt = document.getElementById(`btn-${a}-text`); 
    const ldr = document.getElementById(`btn-${a}-loader`); 
    if(txt && ldr) { 
        txt.classList.toggle('hidden', s); 
        ldr.classList.toggle('hidden', !s); 
    } 
}

function triggerConfetti() { 
    try { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch(e){} 
}

function triggerShake() { 
    const app = document.getElementById('main-wrapper'); 
    if(app) { 
        app.classList.add('shake-effect'); 
        setTimeout(() => app.classList.remove('shake-effect'), 500); 
    } 
}

function toggleFab() { 
    const el = document.getElementById('fab-container'); 
    if(el) el.classList.toggle('fab-open'); 
}

// --- אתחול המערכת (Boot) ---
const hidePreloaderAndShowAuth = (view = 'login') => { 
    try {
        const authContainer = document.getElementById('auth-container'); 
        if (authContainer) authContainer.classList.remove('hidden'); 
        switchView(view); 
        
        const preloader = document.getElementById('app-preloader'); 
        if (preloader) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => preloader.classList.add('hidden'), 700); 
        } 
    } catch(e) { console.error(e); }
};

window.onload = async () => { 
    initAccessibility();
    
    // מוודאים שמסך הטעינה תמיד ירד גם אם יש תקלת רשת
    const failsafeTimer = setTimeout(() => { 
        const preloader = document.getElementById('app-preloader'); 
        if (preloader && !preloader.classList.contains('hidden')) {
            hidePreloaderAndShowAuth('login'); 
        }
    }, 5000);
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get('code'); 
        const inviteRole = urlParams.get('role');
        
        if (inviteCode) { 
            const elCode = document.getElementById('join-code'); if (elCode) elCode.value = inviteCode; 
            const elRole = document.getElementById('join-role'); if(inviteRole && elRole) elRole.value = inviteRole; 
            clearTimeout(failsafeTimer); 
            hidePreloaderAndShowAuth('join'); 
            return; 
        }
        
        const saved = localStorage.getItem('ofl_session'); 
        if(saved) { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { 
                const res = await fetch(`${API}/users/${session.user.id}`); 
                if(res.ok) { 
                    currentUser = await res.json(); 
                    currentGroup = session.group; 
                    localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup})); 
                    clearTimeout(failsafeTimer); 
                    await loadDashboard(); 
                } else { throw new Error("Invalid Session"); }
            } else { throw new Error("Missing User ID"); }
        } else { throw new Error("No Session"); }
    } catch(e) { 
        localStorage.removeItem('ofl_session'); 
        clearTimeout(failsafeTimer); 
        hidePreloaderAndShowAuth('login'); 
    }
};

// --- התחברות והרשמה ---
async function handleLogin(e) { 
    e.preventDefault(); 
    forceTourStart = false; 
    authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    const t = document.getElementById('create-tos'); 
    if(t && !t.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const marketing = document.getElementById('create-marketing') ? document.getElementById('create-marketing').checked : false; 
    authAction('groups', { 
        type: val('create-type'), 
        groupName: val('create-group-name'), 
        adminEmail: val('create-email'), 
        adminNickname: val('create-nickname'), 
        birthYear: val('create-year'), 
        password: val('create-password'), 
        marketing: marketing 
    }); 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    const t = document.getElementById('join-tos'); 
    if(t && !t.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; 
    const marketing = document.getElementById('join-marketing') ? document.getElementById('join-marketing').checked : false; 
    const email = document.getElementById('join-email') ? document.getElementById('join-email').value : ''; 
    
    try {
        const res = await fetch(`${API}/join`, { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({ 
                groupCode: val('join-code'), 
                role: val('join-role'), 
                nickname: val('join-nickname'), 
                birthYear: val('join-year'), 
                password: val('join-password'), 
                email: email, 
                marketing: marketing 
            }) 
        }); 
        const d = await res.json(); 
        if(d.success) { 
            showToast('success', 'נשלח בהצלחה!'); 
            window.history.replaceState({}, document.title, window.location.pathname); 
            switchView('login'); 
        } else { 
            showToast('error', d.error); 
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת');
    }
}

async function authAction(endpoint, body) { 
    toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { 
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) 
        }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; 
            currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            await loadDashboard(); 
        } else { 
            showToast('error', data.error); 
        } 
    } catch(e) { 
        showToast('error', 'שגיאה בחיבור לשרת'); 
    } finally { 
        toggleLoader('login', false); 
    } 
}

function logout() { 
    localStorage.removeItem('ofl_session'); 
    location.reload(); 
}

// --- ניווט ופופאפים כלליים ---
function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => { 
        const el = document.getElementById(`view-${v}`); 
        if(el) el.classList.add('hidden'); 
    }); 
    const v = document.getElementById(`view-${view}`); 
    if(v) v.classList.remove('hidden'); 
}

function selectType(t) { 
    if (t === 'GROUP') {
        const modal = document.getElementById('premium-soon-modal');
        if (modal) {
            const h3 = modal.querySelector('h3'); if(h3) h3.innerText = 'שותפים / קבוצה - בקרוב!';
            const p = modal.querySelector('p'); if(p) p.innerText = 'אפשרות לניהול קבוצת שותפים, דירת סטודנטים או ועד בית תפתח בעדכונים הקרובים. בינתיים, המערכת מותאמת באופן מושלם לניהול משפחתי.';
            modal.classList.remove('hidden');
        }
        return;
    }
    
    const cType = document.getElementById('create-type'); if(cType) cType.value = t; 
    const famBtn = document.getElementById('type-family'); if(famBtn) famBtn.className = `flex-1 p-4 rounded-2xl border-2 text-center transition border-blue-500 bg-blue-50 text-blue-600 font-bold`; 
    const grpBtn = document.getElementById('type-group'); if(grpBtn) grpBtn.className = `flex-1 p-4 rounded-2xl border-2 text-center transition border-slate-100 text-slate-400 font-bold`; 
}

function openPremiumSoonModal(title, text) {
    const modal = document.getElementById('premium-soon-modal');
    if (modal) {
        const h3 = modal.querySelector('h3'); if(h3) h3.innerText = title;
        const p = modal.querySelector('p'); if(p) p.innerText = text;
        modal.classList.remove('hidden');
    }
}

function scrollTabs(direction) { 
    const s = document.getElementById('slider-scroll'); 
    if(s) s.scrollBy({ left: direction * -150, behavior: 'smooth' }); 
}

function switchTab(t) { 
    try {
        ['feed','tasks','shop','bank','academy','members','budget','pantry','recipes'].forEach(x => { 
            const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); 
            const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
        }); 
        
        const el = document.getElementById(`content-${t}`); if(el) el.classList.remove('hidden'); 
        const tabBtn = document.getElementById(`tab-${t}`); if(tabBtn) tabBtn.classList.add('tab-active'); 
        
        const footer = document.getElementById('cart-footer'); 
        const fab = document.getElementById('fab-container'); 
        
        if (t !== 'shop') { 
            if (footer) footer.classList.add('hidden'); 
            if(fab) fab.classList.remove('fab-lifted'); 
        } else { 
            try { renderShopList(); } catch(e) {} 
        } 
        
        if (t === 'pantry') renderPantry(); 
        if (t === 'recipes') renderRecipePantrySelection(); 
    } catch (e) { console.error("Error switching tab:", e); }
}

// --- בניית הלוח המרכזי (Dashboard) והפרדת הרשאות ---
async function loadDashboard() {
    try {
        if (!currentUser || !currentGroup) throw new Error("Missing session data");
        
        const authC = document.getElementById('auth-container'); 
        if(authC) authC.classList.add('hidden'); 
        
        const dashC = document.getElementById('dashboard-container'); 
        if(dashC) dashC.classList.remove('hidden'); 
        
        const fabC = document.getElementById('fab-container'); 
        if(fabC) fabC.classList.remove('hidden');

        const isAdmin = currentUser.role === 'ADMIN';
        
        // --- חלוקה הרמטית של הממשק בין הורה לילד ---
        const adminSpecificEls = document.querySelectorAll('.admin-only');
        const childSpecificEls = document.querySelectorAll('.child-only');
        
        adminSpecificEls.forEach(el => {
            if(isAdmin) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
        
        childSpecificEls.forEach(el => {
            if(isAdmin) el.classList.add('hidden');
            else el.classList.remove('hidden');
        });
        
        // הזרקת אפשרויות הסינון של האקדמיה כדי להבטיח שהן תמיד קיימות
        const ageOpts = '<option value="all">כל הגילאים</option><option value="6-8">גילאי 6-8</option><option value="9-11">גילאי 9-11</option><option value="11-13">גילאי 11-13</option><option value="13-15">גילאי 13-15</option><option value="15-18">גילאי 15-18</option>';
        const catOpts = '<option value="all">כל הנושאים</option><option value="math">חשבון</option><option value="english">אנגלית</option><option value="hebrew">עברית</option><option value="finance">חינוך פיננסי</option><option value="business">עסקים ויזמות</option>';
        
        ['admin-lib-age-filter', 'lib-age-filter'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = ageOpts; });
        ['admin-lib-cat-filter', 'lib-cat-filter'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = catOpts; });
        // ------------------------------------------------

        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest shadow-sm">קוד: ${currentGroup.group_code}</span>` : '';
        const dgn = document.getElementById('dash-group-name'); 
        if(dgn) dgn.innerHTML = `${currentGroup.name || 'משפחה'} ${codeBadge}`; 
        
        const roleBadge = isAdmin ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block font-bold">מנהל/ת משפחה</span>' : '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-1 inline-block font-bold">ילד/ה</span>';
        
        const pun = document.getElementById('profile-user-name'); 
        if(pun) pun.innerHTML = currentUser.nickname || '';
        
        const prb = document.getElementById('profile-role-badge'); 
        if(prb) prb.innerHTML = roleBadge;
        
        const ub = document.getElementById('user-balance'); 
        if(ub) ub.innerText = `₪${currentUser.balance || 0}`;

        if(isAdmin) { 
            const reqT = document.getElementById('req-title'); 
            if(reqT) reqT.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
            
            const profileUp = document.getElementById('profile-upgrade-section'); 
            if (profileUp && currentGroup.is_premium) { 
                profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> חשבון משודרג ל-Pro</p>'; 
            }
        } else { 
            const cN = document.getElementById('card-name'); 
            if(cN) cN.innerText = String(currentUser.nickname || 'USER').toUpperCase(); 
            
            const cA = document.getElementById('card-allowance'); 
            if(cA) cA.innerText = `₪${currentUser.allowance_amount || 0}`; 
            
            const cI = document.getElementById('card-interest'); 
            if(cI) cI.innerText = `${currentUser.interest_rate || 0}%`; 
            
            const reqT = document.getElementById('req-title'); 
            if(reqT) reqT.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
        }
        
        updateBatteryUI(); 
        fetchBanners(); 
        await fetchMembers(); 
        
        if(isAdmin) { 
            try { await fetchPendingUsers(); } catch(e){} 
        }
        await fetchData(); 
        
        if(!pollInterval) {
            pollInterval = setInterval(() => { 
                fetchData(); 
                if(isAdmin) { try { fetchPendingUsers(); } catch(e){} } 
            }, 30000);
        }
        
    } catch (e) { 
        console.error('Error loading dashboard:', e); 
        showToast('error', 'שגיאה בטעינת הממשק - מנסה לרענן'); 
    } finally { 
        const preloader = document.getElementById('app-preloader'); 
        const finalizeLoad = async () => { 
            try {
                const showedWelcome = await checkGlobalWelcome(); 
                if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; } 
            } catch(err) { console.error(err); }
        }; 
        if (preloader && !preloader.classList.contains('hidden')) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); 
        } else { 
            finalizeLoad(); 
        } 
    }
}

function updateBatteryUI() {
    const indicator = document.getElementById('ai-battery-indicator');
    if(!indicator || !currentGroup) return;
    
    // מוסתר לילדים לחלוטין
    if (currentUser && currentUser.role !== 'ADMIN') { 
        indicator.classList.add('hidden'); 
        return; 
    }
    
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    
    if (currentGroup.is_premium) {
        indicator.innerHTML = '⚡ ∞ (Pro)';
        indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent');
    } else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10;
        indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200');
        else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200');
        else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

async function fetchMembers() { 
    try {
        if(!currentGroup) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); 
        if(!Array.isArray(membersCache)) membersCache = [];
        
        if (currentUser.role === 'ADMIN') { 
            const bF = document.getElementById('budget-filter'); 
            const fF = document.getElementById('feed-user-filter'); 
            const gS = document.getElementById('goal-target-user');
            
            if (bF) { 
                const cur = bF.value; bF.innerHTML = '<option value="all">כל הבית</option>'; 
                membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); 
                if(cur) bF.value = cur; 
            } 
            if (fF) { 
                const cur = fF.value; fF.innerHTML = '<option value="all">כל המשפחה</option>'; 
                membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); 
                if(cur) fF.value = cur; 
            }
            if (gS) { 
                const cur = gS.value; gS.innerHTML = '<option value="">עבור מי היעד? (כללי)</option>'; 
                membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { 
                    gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; 
                }); 
                if(cur) gS.value = cur; 
            }
            
            const a = document.getElementById('bank-accounts-list'); 
            if (a) { 
                a.innerHTML = ''; 
                const children = membersCache.filter(m => m.role !== 'ADMIN'); 
                if(children.length === 0) {
                    a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים במשפחה.</p>'; 
                } else {
                    children.forEach(m => { 
                        const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                        a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/שבוע • ${m.interest_rate || 0}% ריבית</p></div></div><div class="flex gap-2"><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                    }); 
                }
            }
        } 
        
        const c = document.getElementById('members-list'); 
        if(c) { 
            c.innerHTML = ''; 
            membersCache.forEach(m => { 
                const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${m.nickname}')" class="mr-3 text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-full flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>` : ''; 
                c.innerHTML += `<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div><span class="font-bold text-sm text-slate-700">${m.nickname}</span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminDeleteBtn}</div></div>`; 
            }); 
        }
    } catch(e) {
        console.error("Error in fetchMembers: ", e);
    }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentUser || (document.activeElement && document.activeElement.classList.contains('price-input'))) return;
        
        const res = await fetch(`${API}/data/${currentUser.id}`); 
        if(!res.ok) return;
        
        const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        
        if(data.group) { 
            currentGroup.ai_tokens = data.group.ai_tokens; 
            currentGroup.is_premium = data.group.is_premium; 
            updateBatteryUI(); 
        }
        
        const balEl = document.getElementById('user-balance'); 
        if(balEl) balEl.innerText = `₪${currentUser.balance || 0}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; 
        bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; 
        pantryCache = Array.isArray(data.pantry) ? data.pantry : []; 
        allBundles = Array.isArray(data.all_bundles) ? data.all_bundles : [];

        if (currentUser.role === 'ADMIN') {
            renderAdminAcademy(); 
        } else { 
            renderMyAssignments(); 
            renderLibrary(); 
        }
        
        renderTasks(allTasks); 
        renderPantry(); 
        renderRecipePantrySelection();
        
        shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; 
        renderShopList(); 
        fetchBudget(); // קריאה חיונית שתעבוד תמיד
        
        const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); 
        const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
        
        if (goalsList) { 
            goalsList.innerHTML = ''; 
            if(data.goals && data.goals.length > 0) { 
                if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                data.goals.forEach(g => { 
                    const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); 
                    const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; 
                    const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`; 
                    const breakBtn = `<button onclick="breakGoal(${g.id}, '${String(g.title).replace(/'/g, "\\'")}')" class="mt-2 bg-red-50 text-red-500 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-100 transition border border-red-100 mr-2"><i class="fa-solid fa-hammer"></i> שבור קופה</button>`; 
                    goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2 flex-wrap"><button onclick="openDepositModal(${g.id}, '${String(g.title).replace(/'/g,"\\'")}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}${breakBtn}</div></div></div>`; 
                }); 
            } else { 
                if (goalsContainer) goalsContainer.classList.add('hidden'); 
                goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; 
            } 
        }

        const myLoansList = document.getElementById('my-loans-list'); 
        const adminLoansList = document.getElementById('admin-loans-list'); 
        const adminLoansContainer = document.getElementById('admin-loans-container');
        
        if(currentUser.role === 'ADMIN') { 
            if(adminLoansList && adminLoansContainer) { 
                const pendingLoans = data.loans ? data.loans.filter(l => l.status === 'pending') : []; 
                if(pendingLoans.length > 0) { 
                    adminLoansContainer.classList.remove('hidden'); let lHtml = ''; 
                    pendingLoans.forEach(l => { 
                        lHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-purple-100 mb-2"><div><span class="font-bold text-slate-700">${l.user_name} מבקש/ת ₪${l.original_amount}</span><p class="text-xs text-slate-500">למטרה: ${l.reason}</p></div><div class="flex gap-2"><button onclick="handleLoanAction(${l.id}, 'approve')" class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-600 shadow-sm"><i class="fa-solid fa-check"></i></button><button onclick="handleLoanAction(${l.id}, 'reject')" class="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"><i class="fa-solid fa-xmark"></i></button></div></div>`; 
                    }); 
                    adminLoansList.innerHTML = lHtml; 
                } else { adminLoansContainer.classList.add('hidden'); } 
            } 
        } else { 
            if(myLoansList) { 
                if(data.loans && data.loans.length > 0) { 
                    myLoansList.innerHTML = ''; 
                    data.loans.forEach(l => { 
                        let statusHtml = ''; 
                        if(l.status === 'pending') statusHtml = '<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-bold border border-orange-200">ממתין להורה</span>'; 
                        else if(l.status === 'approved') statusHtml = '<span class="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-lg font-bold border border-green-200">אושר</span>'; 
                        else statusHtml = '<span class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold border border-red-200">נדחה</span>'; 
                        myLoansList.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><h4 class="font-bold text-slate-800 text-sm">הלוואה: ₪${l.original_amount}</h4><p class="text-[10px] text-slate-500">למטרה: ${l.reason}</p></div>${statusHtml}</div>`; 
                    }); 
                } else { myLoansList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">לא ביקשת הלוואות עדיין</p>'; } 
            } 
        }
        
        if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
            const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
            const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
            const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; } 
            const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
        }
        
        const limit = currentUser.role === 'ADMIN' ? 50 : 20; 
        const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
        const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`); 
        if(transRes.ok) allTransactions = Array.isArray(await transRes.json()) ? await transRes.json() : [];
        
        renderChildTodo(); buildAndRenderFeed();
        
        if (currentUser.role !== 'ADMIN') { 
            const historyList = document.getElementById('academy-history-list'); 
            if (historyList && Array.isArray(bundlesCache)) { 
                const finishedBundles = bundlesCache.filter(b => b.status === 'completed' || b.status === 'failed'); 
                if (finishedBundles.length > 0) { 
                    let hHtml = ''; 
                    finishedBundles.forEach(b => { 
                        const isPassed = b.status === 'completed'; 
                        const statusColor = isPassed ? 'text-green-500' : 'text-red-500'; 
                        const statusBg = isPassed ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'; 
                        const statusText = isPassed ? 'עברת' : 'נכשלת'; 
                        const dStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : ''; 
                        const rewardText = isPassed ? ` • תגמול: ₪${b.custom_reward || b.default_reward}` : ''; 
                        hHtml += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500">${dStr}${rewardText}</p></div><div class="text-center ${statusBg} px-2 py-1 rounded-lg border"><span class="block font-bold ${statusColor} text-sm">${b.score}%</span><span class="block text-[9px] ${statusColor}">${statusText}</span></div></div>`; 
                    }); 
                    historyList.innerHTML = hHtml; historyList.classList.remove('text-center', 'text-slate-400'); 
                } else { historyList.innerHTML = 'לא ביצעת מבחנים עדיין.'; historyList.classList.add('text-center', 'text-slate-400'); } 
            } 
        }
    } catch(e) { console.error("FetchData Error:", e); }
}

// --- רינדור נתונים ורשימות ---
function buildAndRenderFeed() { 
    feedCache = []; 
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח!', amount: 0 }); } 
    allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: new Date(t.date), title: t.description, amount: t.amount, isIncome: t.type === 'income' }); }); 
    allTasks.forEach(t => { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name, date: new Date(t.created_at), title: t.title, amount: t.reward, status: t.status }); }); 
    bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}`, user_id: b.user_id || currentUser.id, user_name: b.assignee_name, date: new Date(b.assigned_at || b.created_at), title: b.title, amount: b.custom_reward || b.default_reward, status: b.status }); }); 
    feedCache.sort((a, b) => b.date - a.date); 
    renderUnifiedFeed(); 
}

function renderUnifiedFeed() { 
    const filterEl = document.getElementById('feed-user-filter'); const list = document.getElementById('unified-feed-list'); if (!list) return; 
    const filterUserId = filterEl ? filterEl.value : 'all'; let filtered = feedCache; 
    if (currentUser.role !== 'ADMIN') filtered = feedCache.filter(i => String(i.user_id) === String(currentUser.id) || i.type === 'system'); 
    else if (filterUserId !== 'all') filtered = feedCache.filter(i => String(i.user_id) === String(filterUserId) || i.type === 'system'); 
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה</p></div>'; return; } 
    let html = ''; 
    filtered.forEach(item => { 
        const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); 
        const uName = currentUser.role === 'ADMIN' && item.type !== 'system' ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${item.user_name}</span>` : ''; 
        const d = item.date; const isToday = d.getDate() === new Date().getDate() && d.getMonth() === new Date().getMonth(); const dateStr = isToday ? `היום, ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}` : d.toLocaleDateString('he-IL'); 
        let contentHtml = ''; 
        if (item.type === 'transaction') { const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1 rounded-full text-[10px]"></i>'; const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; contentHtml = `<div class="flex justify-between items-center w-full"><div>${uName}<p class="font-bold text-slate-800 flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${item.isIncome?'+':'-'}₪${item.amount}</span></div>`; } 
        else if (item.type === 'task') { const badgeClass = item.status === 'pending' ? 'bg-slate-100' : (item.status === 'done' ? 'bg-orange-100' : 'bg-green-100'); contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${uName}<p class="font-bold text-slate-700 mt-0.5"><i class="fa-solid fa-list-check text-blue-500"></i> ${item.title}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} <span class="px-1.5 rounded ${badgeClass}">${item.status}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`; } 
        else if (item.type === 'quiz') { contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${uName}<p class="font-bold text-slate-700 mt-0.5"><i class="fa-solid fa-graduation-cap text-purple-500"></i> ${item.title}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`; } 
        else { contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800">${item.title}</p></div></div>`; } 
        html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border mb-2 flex items-center">${contentHtml}</div>`; 
    }); 
    list.innerHTML = html; 
}

function renderTasks(tasks) { 
    const list = document.getElementById('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0; 
    tasks.forEach(t => { 
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; 
        if (!isMyTask && !isAdmin) return; 
        count++; 
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = ''; 
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${String(t.title).replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md">סיימתי</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) { actionBtn = `<button onclick="updateTask(${t.id}, 'approved')" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; } else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold">בוצע</span>`; } 
        htmlStr += `<div class="p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${t.title}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${t.assignee_name}</span><span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span></div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`; 
    }); 
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr; 
}

function renderChildTodo() { 
    const todoSection = document.getElementById('child-todo-section'); const todoList = document.getElementById('child-todo-list'); 
    if (!todoSection || !todoList || currentUser.role === 'ADMIN') { if(todoSection) todoSection.classList.add('hidden'); return; } 
    let hasItems = false; let htmlStr = ''; 
    allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending').forEach(t => { hasItems = true; htmlStr += `<div class="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex justify-between items-center cursor-pointer mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${t.title}</h4><p class="text-[10px] text-slate-500">תגמול: ₪${t.reward}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`; }); 
    bundlesCache.filter(b => b.status === 'assigned').forEach(b => { hasItems = true; htmlStr += `<div class="bg-white p-3 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center cursor-pointer mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-[10px] text-slate-500">אתגר לימודי</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`; }); 
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); } 
}

function renderPantry() { 
    const list = document.getElementById('pantry-list'); if(!list) return; list.innerHTML = ''; 
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה ריק.</p>'; return; } 
    pantryCache.forEach(p => { list.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4><p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p></div><div class="flex items-center gap-2"><div class="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700 flex items-center gap-3"><button onclick="updatePantryQty(${p.id}, ${p.quantity - 1})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-minus"></i></button><span>${p.quantity}</span><button onclick="updatePantryQty(${p.id}, ${p.quantity + 1})" class="text-slate-400 hover:text-green-500"><i class="fa-solid fa-plus"></i></button></div><button onclick="movePantryToCart(${p.id}, '${String(p.item_name).replace(/'/g,"\\'")}')" class="bg-pink-50 text-pink-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"><i class="fa-solid fa-cart-arrow-down"></i></button></div></div>`; }); 
}

// --- אקדמיה (ACADEMY) ---
function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    const ageFilter = val('admin-lib-age-filter') || 'all'; const catFilter = val('admin-lib-cat-filter') || 'all';
    let filteredBundles = Array.isArray(allBundles) ? [...allBundles] : [];
    if (ageFilter !== 'all') filteredBundles = filteredBundles.filter(b => b.age_group === ageFilter); 
    if (catFilter !== 'all') filteredBundles = filteredBundles.filter(b => b.type === catFilter);
    
    let html = '';
    if (filteredBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים התואמים לסינון.</p>'; } 
    else {
        html += '<div class="space-y-2 mb-8">';
        filteredBundles.forEach(b => { const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : (type === 'english' ? '🔤' : '📈')); html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400">גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100">הקצה</button></div>`; }); 
        html += '</div>';
    }
    
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבחנים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl">לא הוקצו מבחנים לאף ילד עדיין.</p>'; } else {
        html += '<div class="space-y-2 pb-20">'; bundlesCache.forEach(b => { let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold">${b.assignee_name}</span></p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg">${statusText}</span></div>`; }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    const libList = document.getElementById('library-list'); if (!libList) return;
    const ageFilter = val('lib-age-filter') || 'all'; const catFilter = val('lib-cat-filter') || 'all';
    let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
    if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); 
    if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
    if(Array.isArray(bundlesCache)) { const assignedIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedIds.includes(Number(b.id))); }
    
    if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים כרגע.</p>'; return; }
    let libHtml = ''; filtered.forEach(b => { const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : (type === 'english' ? '🔤' : '📈')); libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400">גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 shadow-sm">התחל</button></div>`; }); libList.innerHTML = libHtml;
}

function renderMyAssignments() {
    const myAssignmentsList = document.getElementById('my-assignments-list'); const myAssignmentsContainer = document.getElementById('my-assignments-container'); if (!myAssignmentsList || !myAssignmentsContainer) return;
    const active = (bundlesCache || []).filter(b => b.status === 'assigned');
    if (active.length === 0) { myAssignmentsContainer.classList.add('hidden'); return; }
    myAssignmentsContainer.classList.remove('hidden'); let aHtml = '';
    active.forEach(b => { aHtml += `<div class="bg-white p-4 rounded-2xl border-2 border-purple-200 shadow-sm flex justify-between items-center mb-2"><div><h4 class="font-bold text-slate-800 text-sm">${b.title}</h4><p class="text-xs text-slate-500 font-medium">פרס: ₪${b.custom_reward || b.default_reward}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-purple-600 text-white px-5 py-2 rounded-xl font-bold shadow-md hover:bg-purple-700 transition">התחל מבחן</button></div>`; }); myAssignmentsList.innerHTML = aHtml;
}

function updateAssignDetails() { const select = document.getElementById('assign-bundle-select'); if(!select) return; const bundleId = select.value; const bundle = allBundles.find(b => String(b.id) === String(bundleId)); if(bundle) { document.getElementById('assign-reward').value = bundle.reward; } }

function openAssignModal() { 
    const cSelect = document.getElementById('assign-child-select'); if(cSelect) { cSelect.innerHTML = '<option value="" disabled selected>בחר ילד...</option>'; if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); } }
    const bSelect = document.getElementById('assign-bundle-select'); if(bSelect) { bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר...</option>'; if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : (type === 'english' ? '🔤' : '📈')); bSelect.innerHTML += `<option value="${b.id}">[${getIcon(b.type)}] ${b.title} (${b.age_group})</option>`; }); } }
    const rInp = document.getElementById('assign-reward'); if(rInp) rInp.value = ''; 
    const dInp = document.getElementById('assign-days'); if(dInp) dInp.value = ''; 
    document.getElementById('assign-quiz-modal').classList.remove('hidden'); 
}

function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = document.getElementById('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }

async function submitAssignQuiz() { const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); if(!childId || !bundleId) return showToast('error', 'חסרים פרטים'); await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: val('assign-reward'), days: val('assign-days') }) }); document.getElementById('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData(); }

async function requestChallenge(bundleId = null) { try { const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json(); if (data.success) { triggerConfetti(); showToast('success', 'המבחן נוסף בהצלחה!'); fetchData(); } } catch(e) {} }

async function startQuiz(bundleId) { const bundle = bundlesCache.find(b => String(b.bundle_id) === String(bundleId)); if(!bundle) return; currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; document.getElementById('quiz-title').innerText = bundle.title; document.getElementById('btn-tutor').classList.add('hidden'); const textContainer = document.getElementById('quiz-text-container'); if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); } document.getElementById('quiz-runner-modal').classList.remove('hidden'); renderQuestion(); }

function renderQuestion() { const q = currentQuizData.questions[currentQuestionIndex]; document.getElementById('q-progress').innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; document.getElementById('q-text').innerText = q.q; const optsContainer = document.getElementById('q-options'); optsContainer.innerHTML = ''; q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 font-medium hover:bg-slate-100 text-slate-700">${opt}</button>`; }); }

async function submitAnswer(selectedIdx) { const q = currentQuizData.questions[currentQuestionIndex]; const isCorrect = selectedIdx === q.correct; const btns = document.querySelectorAll('.quiz-option'); if(btns[selectedIdx]) btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong'); if(!isCorrect) { if(btns[q.correct]) btns[q.correct].classList.add('correct'); currentWrongAnswers.push({ q: q.q, wrong: q.options[selectedIdx], correct: q.options[q.correct] }); } if(isCorrect) quizScore++; setTimeout(async () => { currentQuestionIndex++; if (currentQuestionIndex < currentQuizData.questions.length) { renderQuestion(); } else { finishQuiz(); } }, 1000); }

async function finishQuiz() { const total = currentQuizData.questions.length; const finalScore = Math.round((quizScore / total) * 100); const passed = finalScore >= currentQuizData.threshold; const qc = document.getElementById('question-container'); if(qc) qc.classList.add('hidden'); const qtc = document.getElementById('quiz-text-container'); if(qtc) qtc.classList.add('hidden'); const qr = document.getElementById('quiz-result'); if(qr) qr.classList.remove('hidden'); const qi = document.getElementById('quiz-icon'); if(qi) qi.innerHTML = passed ? '🏆' : '📚'; const qmt = document.getElementById('quiz-msg-title'); if(qmt) qmt.innerText = passed ? 'כל הכבוד!' : 'לא נורא...'; const qmd = document.getElementById('quiz-msg-desc'); if(qmd) qmd.innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; const qsd = document.getElementById('quiz-score-display'); if(qsd) qsd.innerText = `ציון: ${finalScore}%`; if (!passed && currentWrongAnswers.length > 0) { const bt = document.getElementById('btn-tutor'); if(bt) bt.classList.remove('hidden'); } if (passed) triggerConfetti(); await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) }); fetchData(); }

function closeQuiz() { const mod = document.getElementById('quiz-runner-modal'); if(mod) mod.classList.add('hidden'); const qc = document.getElementById('question-container'); if(qc) qc.classList.remove('hidden'); const qr = document.getElementById('quiz-result'); if(qr) qr.classList.add('hidden'); }

// --- פעולות בינה מלאכותית (AI) ---
function showFamilAIModal(title, text) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.remove('hidden'); const sub = document.getElementById('familai-modal-subtitle'); if(sub) sub.innerText = title; const load = document.getElementById('familai-advisor-loading'); const content = document.getElementById('familai-advisor-content'); const adviceText = document.getElementById('familai-advice-text'); if (text) { if(load) load.classList.add('hidden'); if(adviceText) adviceText.innerText = text; if(content) content.classList.remove('hidden'); } else { if(load) load.classList.remove('hidden'); if(content) content.classList.add('hidden'); } }

function openAIModal() { const mod = document.getElementById('ai-modal'); if(mod) mod.classList.remove('hidden'); }

async function generateAIQuiz() { const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); if(btn) { btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳'; } try { const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) }); const data = await res.json(); if(!handleAIResponseCheck(data)) return; if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); const mod = document.getElementById('ai-modal'); if(mod) mod.classList.add('hidden'); const top = document.getElementById('ai-topic'); if(top) top.value = ''; await fetchData(); openAssignModalSpecific(data.bundleId); } } catch(e) {} finally { if(btn) { btn.disabled = false; btn.innerText = 'צור אתגר'; } } }

async function getFamilAIAdvice(childId, goalId) { showFamilAIModal('היועצת הפיננסית של המשפחה', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'מנתחת את הנתונים...'; try { const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json(); const mod = document.getElementById('familai-advisor-modal'); if(!handleAIResponseCheck(data)) { if(mod) mod.classList.add('hidden'); return; } if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); } else { if(mod) mod.classList.add('hidden'); } } catch (e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); } }

async function getBudgetInsight() { showFamilAIModal('אנליסטית התקציב', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'בודקת על מה הוצאנו החודש...'; try { const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); const mod = document.getElementById('familai-advisor-modal'); if(!handleAIResponseCheck(data)) { if(mod) mod.classList.add('hidden'); return; } if(data.success && data.insight) showFamilAIModal('אנליסטית התקציב', data.insight); } catch(e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); } }

async function getPantryInsight() { showFamilAIModal('מנהלת המזווה', null); const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'מחשבת כמויות...'; try { const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); const mod = document.getElementById('familai-advisor-modal'); if(!handleAIResponseCheck(data)) { if(mod) mod.classList.add('hidden'); return; } if(data.success && data.insight) showFamilAIModal('מנהלת המזווה', data.insight); } catch(e) { const mod = document.getElementById('familai-advisor-modal'); if(mod) mod.classList.add('hidden'); } }

async function askTutor() { if(currentWrongAnswers.length === 0) return; const w = currentWrongAnswers[0]; const btn = document.getElementById('btn-tutor'); if(btn) { btn.disabled = true; btn.innerText = 'מכינה הסבר...'; } try { const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json(); if(handleAIResponseCheck(data) && data.success) showFamilAIModal('המורה הפרטית שלך', data.explanation); } catch(e) {} finally { if(btn) { btn.disabled = false; btn.innerHTML = '<img src="logo.png" alt="AI" class="w-5 h-5 object-contain"> familAI, איפה טעיתי?'; } } }

// --- משימות (TASKS) ---
window.openTaskModal = function(isSelf = false) { 
    const m = document.getElementById('task-modal'); if(m) m.classList.remove('hidden'); 
    const tis = document.getElementById('task-is-self'); if(tis) tis.value = isSelf; 
    const d = document.getElementById('task-days'); if(d) d.value = ''; 
    const tt = document.getElementById('task-title'); if(tt) tt.value = ''; 
    const tr = document.getElementById('task-reward'); if(tr) tr.value = ''; 
    const aitt = document.getElementById('ai-task-topic'); if(aitt) aitt.value = ''; 
    const air = document.getElementById('ai-task-results'); if(air) air.classList.add('hidden'); 
    setTaskMode('manual'); 
    const toggles = document.getElementById('task-mode-toggles'); const assigneeContainer = document.getElementById('task-assignee-container'); const rewardGroup = document.getElementById('task-reward-group'); const tTitle = document.getElementById('task-modal-title'); 
    
    if(isSelf) { 
        if(tTitle) tTitle.innerText = 'דיווח על עזרה בבית'; 
        if(toggles) toggles.classList.add('hidden'); 
        if(assigneeContainer) assigneeContainer.classList.add('hidden'); 
        if(rewardGroup) rewardGroup.classList.add('hidden'); 
    } else { 
        if(tTitle) tTitle.innerText = 'יצירת משימה'; 
        if(toggles) toggles.classList.remove('hidden'); 
        if(assigneeContainer) assigneeContainer.classList.remove('hidden'); 
        if(rewardGroup) rewardGroup.classList.remove('hidden'); 
        const assigneeSelect = document.getElementById('task-assignee'); 
        if(assigneeSelect) { assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; membersCache.forEach(m => { if (m.role !== 'ADMIN') assigneeSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); } 
    } 
}

function setTaskMode(mode) { const mBtn = document.getElementById('btn-mode-manual'); const aBtn = document.getElementById('btn-mode-ai'); const mDiv = document.getElementById('task-mode-manual'); const aDiv = document.getElementById('task-mode-ai'); if (mode === 'manual') { if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition'; if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-purple-600 transition'; if(mDiv) mDiv.classList.remove('hidden'); if(aDiv) aDiv.classList.add('hidden'); } else { if(aBtn) aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-purple-600 shadow-sm transition'; if(mBtn) mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition'; if(aDiv) aDiv.classList.remove('hidden'); if(mDiv) mDiv.classList.add('hidden'); } }

function closeTaskModal() { const mod = document.getElementById('task-modal'); if(mod) mod.classList.add('hidden'); }

async function generateAITasks() { 
    const btn = document.getElementById('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = val('task-is-self') === 'true'; 
    let age; 
    if (isSelf) { age = new Date().getFullYear() - currentUser.birth_year; } 
    else { if(!assigneeId) return showToast('error', 'בחרו למעלה עבור מי המשימה'); const child = membersCache.find(m => String(m.id) === String(assigneeId)); age = new Date().getFullYear() - (child ? child.birth_year : new Date().getFullYear()); } 
    if(!topic) return showToast('error', 'כתבו באיזה נושא לעזור'); 
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; } 
    try { 
        const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic, groupId: currentGroup.id }) }); 
        const data = await res.json(); 
        if(handleAIResponseCheck(data) && data.success) { 
            const rc = document.getElementById('ai-task-results'); 
            if(rc) { rc.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>'; data.tasks.forEach(t => rc.innerHTML += `<div onclick="selectAITask('${String(t.title).replace(/'/g, "\\'")}', ${t.reward})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border hover:bg-purple-50"><span class="text-sm font-bold">${t.title}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${t.reward}</span></div>`); rc.classList.remove('hidden'); } 
        } 
    } catch(e) {} 
    finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; } } 
}

function selectAITask(title, reward) { const t = document.getElementById('task-title'); if(t) t.value = title; const r = document.getElementById('task-reward'); if(r) r.value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = val('task-is-self') === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = isSelf ? 0 : val('task-reward'); const title = val('task-title'); 
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); 
    if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה'); 
    await fetch(`${API}/tasks`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward, assignedTo: assignee, days: val('task-days') }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', 'משימה נוצרה!'); fetchData(); 
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; const tpu = document.getElementById('task-proof-upload'); if(tpu) tpu.click(); }

function handleTaskProofUpload(event) { 
    const file = event.target.files[0]; if(!file) return; 
    showFamilAIModal('בקרת איכות', null); 
    const flt = document.getElementById('familai-loading-text'); if(flt) flt.innerText = 'בודקת את התמונה...'; 
    const reader = new FileReader(); 
    reader.onload = async (e) => { 
        const base64 = e.target.result.split(',')[1]; 
        try { 
            const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: file.type, groupId: currentGroup.id }) }); 
            const data = await res.json(); 
            if(handleAIResponseCheck(data) && data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } 
        } catch(err) {} 
        event.target.value = ''; 
    }; 
    reader.readAsDataURL(file); 
}

// --- קניות (SHOPPING) ---
function filterSuggestions(valTxt) { 
    const list = document.getElementById('suggestions'); if(!list) return; list.innerHTML = ''; 
    if (!valTxt) { list.classList.add('hidden'); return; } 
    const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(valTxt)).slice(0, 8); 
    if (filtered.length > 0) { 
        list.classList.remove('hidden'); 
        filtered.forEach(p => { 
            const li = document.createElement('div'); li.className = 'suggestion-item'; 
            li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; 
            li.onclick = () => { 
                const si = document.getElementById('shop-item'); if(si) si.value = p.name; 
                const snn = document.getElementById('shop-normalized-name'); if(snn) snn.value = p.name; 
                list.classList.add('hidden'); 
            }; 
            list.appendChild(li); 
        }); 
    } else { 
        list.classList.remove('hidden'); let opt = '<option value="">-- הוסף כמו שהוא --</option>'; FLAT_PRODUCTS.forEach(p => { opt += `<option value="${p.name}">${p.name} (${p.category})</option>`; }); 
        list.innerHTML = `<div class="p-3 bg-orange-50 border-b border-orange-100 text-xs">לא מצאנו... לשייך לקטגוריה קיימת?</div><div class="p-2 space-y-2"><select id="manual-normalize-select" class="w-full text-xs p-2 rounded border">${opt}</select><button onclick="selectManualShopItem()" class="w-full bg-orange-500 text-white py-2 rounded-lg text-xs font-bold">אשר</button></div>`; 
    } 
}

window.selectManualShopItem = function() { 
    const rawVal = val('shop-item'); const normVal = val('manual-normalize-select'); 
    const snn = document.getElementById('shop-normalized-name'); 
    if (normVal) { if(snn) snn.value = normVal; showToast('success', `הוצמד למעקב כ-"${normVal}"`); } else { if(snn) snn.value = rawVal; } 
    const sugg = document.getElementById('suggestions'); if(sugg) sugg.classList.add('hidden'); 
}

window.openShopModal = function() { 
    const snn = document.getElementById('shop-normalized-name'); if(snn) snn.value = '';
    const sm = document.getElementById('shop-modal'); if(sm) sm.classList.remove('hidden'); 
}

async function submitShopItem() { 
    const item = val('shop-item'); const norm = val('shop-normalized-name') || item; 
    if(!item) return; 
    await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, normalizedName: norm, quantity: val('shop-quantity'), estimatedPrice: val('shop-est-price'), userId: currentUser.id}) }); 
    const sm = document.getElementById('shop-modal'); if(sm) sm.classList.add('hidden'); 
    const si = document.getElementById('shop-item'); if(si) si.value=''; fetchData(); 
}

function toggleSelectAll() { 
    const anyPending = shoppingListCache.some(i => i.status === 'pending'); 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if(row.classList.contains('missing')) return; 
        const inp = row.querySelector('input[type="checkbox"]'); if(inp) inp.checked = anyPending; 
        row.classList.toggle('in-cart', anyPending); 
        const pInp = row.querySelector('.price-input'); if(pInp) pInp.disabled = !anyPending; 
    }); 
    calcRunningTotal(); shoppingListCache.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', anyPending); }); 
}

function renderShopList() { 
    if(document.activeElement && document.activeElement.classList.contains('price-input')) return;
    const list = document.getElementById('shop-list'); const reqList = document.getElementById('shop-requests-list'); const reqContainer = document.getElementById('shop-requests-container'); 
    if(!list) return;
    const activeItems = []; const requestedItems = []; 
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); }); 
    
    if (requestedItems.length > 0 && reqContainer && reqList) { 
        reqContainer.classList.remove('hidden'); 
        reqList.innerHTML = requestedItems.map(i => `<div class="flex justify-between bg-white p-2 rounded-xl shadow-sm border mb-2"><div><span class="font-bold">${i.item_name}</span><span class="text-xs block">ביקש/ה: ${i.requester_name}</span></div>${currentUser.role==='ADMIN'?`<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full"><i class="fa-solid fa-check"></i></button></div>`:`<span class="text-xs text-orange-500">ממתין להורה</span>`}</div>`).join(''); 
    } else if(reqContainer) { reqContainer.classList.add('hidden'); }
    
    const cf = document.getElementById('cart-footer'); const fab = document.getElementById('fab-container');
    if(activeItems.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">העגלה ריקה</p>'; if(cf) cf.classList.add('hidden'); if(fab) fab.classList.remove('fab-lifted'); return; } 
    
    if(cf) cf.classList.remove('hidden'); if(fab) fab.classList.add('fab-lifted'); 
    let shopHtml = ''; 
    activeItems.sort((a,b) => String(a.item_name).localeCompare(String(b.item_name))).forEach(i => { 
        const isChecked = i.status === 'in_cart'; const total = (i.estimated_price || 0) * i.quantity; 
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-pink-500 rounded-lg"><div class="flex-1"><div class="flex justify-between items-start"><span class="font-medium">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><input type="number" id="price-${i.id}" value="${i.estimated_price||''}" ${isChecked?'':'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" class="price-input w-full bg-slate-50 border rounded-lg py-1.5 text-sm font-bold text-center"></div><div class="flex flex-col items-center"><span class="text-[9px] text-slate-400">סה"כ</span><span class="text-xs font-bold" id="row-total-${i.id}">₪${total.toFixed(0)}</span></div><div class="flex flex-col items-center ml-auto"><span class="text-[9px] text-slate-400">כמות</span><span class="text-xs bg-slate-100 px-2 py-1 rounded font-bold">x${i.quantity}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] px-2 py-1.5 rounded-lg border mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`; 
    }); 
    list.innerHTML = shopHtml; calcRunningTotal(); 
}

async function updateRow(id, type, value) { 
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); fetchData(); } 
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); if(row) { row.classList.toggle('in-cart', value); const pi = document.getElementById(`price-${id}`); if(pi) pi.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); calcRunningTotal(); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => String(i.id) === String(id)); if(item) { const total = (parseFloat(value)||0) * item.quantity; const rt = document.getElementById(`row-total-${id}`); if(rt) rt.innerText = `₪${total.toFixed(0)}`; } calcRunningTotal(); } 
}

function toggleMissingLocal(id) { 
    const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); 
    if(!row || !btn) return;
    const isMissing = row.classList.contains('missing'); const inp = row.querySelector('input[type="checkbox"]');
    if (!isMissing) { 
        row.classList.add('missing'); row.classList.remove('in-cart'); 
        if(inp) { inp.checked = false; inp.disabled = true; } 
        const pi = document.getElementById(`price-${id}`); if(pi) pi.disabled = true; 
        btn.classList.add('bg-orange-100', 'text-orange-500'); btn.innerText = 'מבוטל'; 
    } else { 
        row.classList.remove('missing'); if(inp) inp.disabled = false; 
        btn.classList.remove('bg-orange-100', 'text-orange-500'); btn.innerText = 'חסר'; 
    } 
    calcRunningTotal(); 
}

function calcRunningTotal() { 
    let total = 0; document.querySelectorAll('.shop-row').forEach(row => { const inp = row.querySelector('input[type="checkbox"]'); if (inp && inp.checked && !row.classList.contains('missing')) { const id = row.id.replace('row-', ''); const item = shoppingListCache.find(i => String(i.id) === String(id)); const pi = document.getElementById(`price-${id}`); total += ((parseFloat(pi ? pi.value : 0)||0) * (item?item.quantity:1)); } }); 
    const ctd = document.getElementById('cart-total-display'); if(ctd) ctd.innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0, missing = 0, total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { const inp = row.querySelector('input[type="checkbox"]'); if (row.classList.contains('missing')) missing++; else if (inp && inp.checked) { count++; const id = row.id.replace('row-', ''); const item = shoppingListCache.find(i => String(i.id) === String(id)); const pi = document.getElementById(`price-${id}`); total += ((parseFloat(pi ? pi.value : 0)||0) * (item?item.quantity:1)); } }); 
    if (count===0 && missing===0) return showToast('error', 'לא סימנת כלום'); 
    const sc = document.getElementById('summ-count'); if(sc) sc.innerText = count; 
    const sm = document.getElementById('summ-missing'); if(sm) sm.innerText = missing; 
    const st = document.getElementById('summ-total'); if(st) st.innerText = `₪${total.toFixed(2)}`; 
    const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.remove('hidden'); 
}

async function submitFinalCheckout() { 
    const boughtItems = [], missingItems = []; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { const id = row.id.replace('row-', ''); const item = shoppingListCache.find(i => String(i.id) === String(id)); const inp = row.querySelector('input[type="checkbox"]'); if (row.classList.contains('missing')) missingItems.push({ id }); else if (inp && inp.checked) { const pi = document.getElementById(`price-${id}`); const rowTotal = (parseFloat(pi ? pi.value : 0)||0) * (item?item.quantity:1); total+=rowTotal; boughtItems.push({ id, name: item?item.item_name:'פריט', quantity: item?item.quantity:1, price: rowTotal }); } }); 
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: val('checkout-store')||'סופר', branchName: val('checkout-branch'), boughtItems, missingItems }) }); 
    const mod = document.getElementById('confirm-checkout-modal'); if(mod) mod.classList.add('hidden'); 
    triggerConfetti(); fetchData(); 
}

async function openHistoryModal() { 
    try {
        const trips = await (await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`)).json(); 
        const list = document.getElementById('history-list'); if(!list) return; list.innerHTML = ''; 
        if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>';
        trips.forEach(t => { list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm mb-2"><div class="flex justify-between"><div><h4 class="font-bold">${t.store_name}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()}</p></div><span class="font-bold text-blue-600">₪${t.total_amount}</span></div><button onclick="copyList(${t.id})" class="mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded">העתק רשימה</button></div>`; }); 
        const mod = document.getElementById('history-modal'); if(mod) mod.classList.remove('hidden'); 
    } catch(e) {}
}

async function copyList(tripId) { 
    await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); 
    const mod = document.getElementById('history-modal'); if(mod) mod.classList.add('hidden'); 
    fetchData(); showToast('success', 'הרשימה הועתקה!'); 
}

// --- מזווה (PANTRY) ---
window.openPantryModal = function() { 
    const pi = document.getElementById('pantry-item'); if(pi) pi.value = ''; 
    const pq = document.getElementById('pantry-quantity'); if(pq) pq.value = 1; 
    const m = document.getElementById('pantry-modal'); if(m) m.classList.remove('hidden'); 
}

async function submitPantryItem() {
    const name = val('pantry-item'); const qty = val('pantry-quantity'); if(!name) return;
    await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty}) });
    const m = document.getElementById('pantry-modal'); if(m) m.classList.add('hidden'); 
    fetchData(); showToast('success', 'המוצר נוסף למזווה');
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { 
        if(!confirm('המוצר נגמר! האם למחוק אותו מהמזווה?')) return; 
        await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); 
    } else { 
        await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); 
    }
    fetchData();
}

async function movePantryToCart(pantryId, itemName) {
    await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, estimatedPrice: 0, userId: currentUser.id}) });
    await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); 
    showToast('success', 'המוצר הועבר לרשימת הקניות!'); fetchData();
}

// --- בנק, יעדים ותקציב (BANK & BUDGET) ---
window.openGoalModal = function() { 
    if(currentUser.role === 'ADMIN') { const gc = document.getElementById('goal-user-select-container'); if(gc) gc.classList.remove('hidden'); }
    const t = document.getElementById('goal-title'); if(t) t.value = ''; 
    const target = document.getElementById('goal-target'); if(target) target.value = ''; 
    const mod = document.getElementById('goal-modal'); if(mod) mod.classList.remove('hidden'); 
}

function openDepositModal(id, title) { 
    const gid = document.getElementById('deposit-goal-id'); if(gid) gid.value = id; 
    const t = document.getElementById('deposit-goal-title'); if(t) t.innerText = title; 
    const mod = document.getElementById('goal-deposit-modal'); if(mod) mod.classList.remove('hidden'); 
}

async function submitGoal() { await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId: currentUser.role==='ADMIN'?val('goal-target-user'):null, title: val('goal-title'), target: val('goal-target') }) }); const mod = document.getElementById('goal-modal'); if(mod) mod.classList.add('hidden'); fetchData(); }
async function submitDeposit() { await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId: val('deposit-goal-id'), amount: val('deposit-amount') }) }); const mod = document.getElementById('goal-deposit-modal'); if(mod) mod.classList.add('hidden'); fetchData(); }
async function breakGoal(goalId, title) { if (!confirm(`לשבור קופה למשוך חזרה לארנק?`)) return; await fetch(`${API}/goals/break`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ goalId: goalId }) }); fetchData(); }

window.openTransactionModal = function(t) { 
    const typeEl = document.getElementById('trans-type'); if(typeEl) typeEl.value=t; 
    const titleEl = document.getElementById('trans-modal-title'); if(titleEl) titleEl.innerText=t==='income'?'הכנסה חדשה':'הוצאה חדשה'; 
    const s = document.getElementById('trans-cat'); 
    if(s) { s.innerHTML=''; if(CATEGORIES[t]) { CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); } }
    const mod = document.getElementById('transaction-modal'); if(mod) mod.classList.remove('hidden'); 
}

async function submitTransaction() { await fetch(`${API}/transaction`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount: val('trans-amount'), description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type') })}); const mod = document.getElementById('transaction-modal'); if(mod) mod.classList.add('hidden'); fetchData(); }

window.openLoanModal = function() { const mod = document.getElementById('loan-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitLoan() { await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:val('loan-amount'), reason:val('loan-reason')})}); const mod = document.getElementById('loan-modal'); if(mod) mod.classList.add('hidden'); fetchData(); showToast('success','בקשה נשלחה'); }
async function handleLoanAction(id, action) { await fetch(`${API}/loans/action`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId: id, action: action }) }); fetchData(); }

async function fetchBudget() { 
    try {
        const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; 
        const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`);
        if(!res.ok) return;
        const data = await res.json(); 
        
        // יצירת קטגוריות חסרות אם הן לא הוחזרו מהשרת
        const baseCategories = CATEGORIES.expense.map(c => c.value);
        data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
        baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); }); 
        const childrenCategories = ['allowance', 'tasks', 'academy']; 
        childrenCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });

        const list = document.getElementById('budget-list'); if(!list) return;
        list.innerHTML = ''; 
        
        let childrenTotalSpent = 0; let childrenTotalLimit = 0; let childrenItems = []; let otherItems = [];
        data.forEach(b => { if (childrenCategories.includes(b.category) || b.category === 'allocations') { childrenTotalSpent += parseFloat(b.spent) || 0; childrenTotalLimit += parseFloat(b.limit) || 0; childrenItems.push(b); } else { otherItems.push(b); } });

        const createRow = (category, spent, limit, isSub = false) => {
            const pct = limit > 0 ? (spent / limit) * 100 : 0; 
            let color = 'bg-green-500'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
            const limitDisplay = limit > 0 ? `₪${limit}` : 'לא הוגדר'; 
            const catName = BUDGET_LABELS[category] || category;
            const editBtn = (category !== 'allocations' && currentUser.role === 'ADMIN') ? `<button onclick="openBudgetModal('${category}')" class="text-[10px] text-blue-600 bg-blue-50 px-2 rounded">ערוך</button>` : '';
            const textSize = isSub ? 'text-sm' : 'text-base'; 
            const containerClass = isSub ? 'pl-2 border-r-2 border-indigo-200 pr-2 mb-3' : 'mb-5';
            return `<div class="${containerClass}"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 ${textSize}">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-100 rounded-full ${isSub ? 'h-1.5' : 'h-2.5'} overflow-hidden shadow-inner"><div class="${color} ${isSub ? 'h-1.5' : 'h-2.5'} rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
        };

        if (childrenItems.length > 0) {
            const pct = childrenTotalLimit > 0 ? (childrenTotalSpent / childrenTotalLimit) * 100 : 0; 
            let color = 'bg-indigo-500'; if (pct > 80) color = 'bg-indigo-400'; if (pct > 100) color = 'bg-purple-600';
            const limitDisplay = childrenTotalLimit > 0 ? `₪${childrenTotalLimit}` : 'לא הוגדר'; 
            let subItemsHtml = ''; 
            childrenItems.forEach(cb => { subItemsHtml += createRow(cb.category, cb.spent, cb.limit, true); });
            const childrenSectionTitle = currentUser.role === 'ADMIN' ? 'הוצאות על הילדים' : 'הכנסות מההורים';
            list.innerHTML += `<div class="mb-8 bg-indigo-50/50 p-4 rounded-[1.5rem] border border-indigo-100/60 shadow-sm transition-all hover:bg-indigo-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-indigo-900 flex items-center gap-2"><i class="fa-solid fa-child-reaching text-indigo-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-indigo-100">${subItemsHtml}</div></div>`;
        }
        otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });

    } catch(e){ console.error(e); }
}

function openBudgetModal(catId) { const idEl = document.getElementById('budget-cat-id'); if(idEl) idEl.value = catId; const mod = document.getElementById('budget-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitBudgetUpdate() { const limit = val('budget-limit'); const tUser = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; if(!limit) { await fetch(`${API}/budget/delete`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:val('budget-cat-id'), targetUserId: tUser})}); } else { await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:val('budget-cat-id'), limit:limit, targetUserId: tUser})}); } const mod = document.getElementById('budget-modal'); if(mod) mod.classList.add('hidden'); fetchBudget(); }
window.openAddBudgetCategoryModal = function() { const mod = document.getElementById('add-budget-cat-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitNewBudgetCat() { const tUser = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:val('new-budget-cat-name'), limit:0, targetUserId: tUser})}); const mod = document.getElementById('add-budget-cat-modal'); if(mod) mod.classList.add('hidden'); fetchBudget(); }

// --- הגדרות מנהל ופרופיל (ADMIN SETTINGS) ---
async function fetchPendingUsers() { try { const users = await (await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`)).json(); const list = document.getElementById('pending-list'); const cont = document.getElementById('pending-users-container'); if(!list || !cont) return; if(users.length>0) { cont.classList.remove('hidden'); list.innerHTML = users.map(u => `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1"><span class="text-sm font-bold text-slate-700">${u.nickname}</span><button onclick="approveUser(${u.id})" class="bg-green-500 text-white px-3 py-1 rounded text-xs">אשר</button></div>`).join(''); } else { cont.classList.add('hidden'); } } catch(e){} }
async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); fetchPendingUsers(); fetchMembers(); }
function openProfileModal() { const mod = document.getElementById('profile-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitChangePassword(e) { e.preventDefault(); await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: val('old-password'), newPassword: val('new-password') }) }); const mod = document.getElementById('profile-modal'); if(mod) mod.classList.add('hidden'); showToast('success', 'עודכן'); }
async function deleteUser(id, name) { if(!confirm('למחוק?')) return; await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); fetchMembers(); fetchData(); }
function openBankSettings(id, name, allowance, interest) { const uid = document.getElementById('bank-user-id'); if(uid) uid.value = id; const ual = document.getElementById('bank-allowance'); if(ual) ual.value = allowance; const uin = document.getElementById('bank-interest'); if(uin) uin.value = interest; const mod = document.getElementById('bank-settings-modal'); if(mod) mod.classList.remove('hidden'); }
async function submitBankSettings() { await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: val('bank-user-id'), allowance: val('bank-allowance'), interest: val('bank-interest') }) }); const mod = document.getElementById('bank-settings-modal'); if(mod) mod.classList.add('hidden'); fetchMembers(); }
async function triggerPayday() { await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); fetchData(); triggerConfetti(); }
function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if(currentGroup && codeSpan) codeSpan.innerText = currentGroup.group_code; const mod = document.getElementById('invite-modal'); if(mod) mod.classList.remove('hidden'); }
function sendWhatsAppInvite(role) { const text = `היי! פתחתי בנק משפחתי. קוד המשפחה הוא: *${currentGroup.group_code}*. היכנסו: ${window.location.origin}/?code=${currentGroup.group_code}&role=${role}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
async function sendCredentialsEmail() { await fetch(`${API}/admin/email-credentials`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, adminId: currentUser.id }) }); showToast('success', 'מייל נשלח'); }

// --- מתכונים (RECIPES) ---
function toggleRecipeCustomInput() { const cInp = document.getElementById('recipe-custom-ingredients'); const pSel = document.getElementById('recipe-pantry-selection'); const chk = document.getElementById('recipe-ignore-pantry'); if(cInp && pSel && chk) { cInp.classList.toggle('hidden', !chk.checked); pSel.classList.toggle('hidden', chk.checked); } }
function renderRecipePantrySelection() { const lc = document.getElementById('recipe-pantry-items-list'); if(!lc) return; lc.innerHTML = pantryCache.map(p => `<label class="flex items-center gap-1 bg-white border px-2 py-1 rounded"><input type="checkbox" value="${p.item_name}" checked class="recipe-pantry-checkbox w-3 h-3"><span class="text-xs">${p.item_name}</span></label>`).join(''); }
function selectAllRecipePantry() { const cbs = document.querySelectorAll('.recipe-pantry-checkbox'); const st = cbs[0] ? !cbs[0].checked : true; cbs.forEach(cb => cb.checked = st); }
async function generateRecipe() { const btn = document.getElementById('btn-generate-recipe'); if(btn){ btn.disabled = true; btn.innerHTML = 'מרכיב...'; } const ignoreEl = document.getElementById('recipe-ignore-pantry'); const ignore = ignoreEl ? ignoreEl.checked : false; let pStr = ""; if(!ignore) { const s = []; document.querySelectorAll('.recipe-pantry-checkbox:checked').forEach(c => s.push(c.value)); pStr = s.join(', '); } try { const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: currentGroup.id, mealType: val('recipe-meal-type'), diners: val('recipe-diners'), ignorePantry: ignore, customIngredients: val('recipe-custom-ingredients-input'), pantryItems: pStr }) }); const data = await res.json(); if(handleAIResponseCheck(data)) { const resCont = document.getElementById('recipe-result-content'); if(resCont) resCont.innerHTML = data.recipe.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); const wrap = document.getElementById('recipe-result-container'); if(wrap) wrap.classList.remove('hidden'); } } catch(e){} if(btn) { btn.disabled = false; btn.innerHTML = 'צור מתכון'; } }
function copyRecipe() { const t = document.createElement("textarea"); const resC = document.getElementById('recipe-result-content'); if(!resC) return; t.value = resC.innerText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); showToast('success', 'הועתק'); }

// --- נגישות (ACCESSIBILITY) ---
function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = document.getElementById(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50'); btn.classList.remove('border-slate-200'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50'); btn.classList.add('border-slate-200'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); closeAccessibilityModal(); }
function openAccessibilityModal() { const mod = document.getElementById('accessibility-modal'); if(mod) mod.classList.remove('hidden'); }
function closeAccessibilityModal() { const mod = document.getElementById('accessibility-modal'); if(mod) mod.classList.add('hidden'); }

// --- באנרים (BANNERS) ---
async function fetchBanners() { try { const data = await (await fetch(`${API}/banners`)).json(); if(data.success && data.banners) { const cb = (id, title, text, link, image) => { const el = document.getElementById(id); if(!el) return; if(title||text||image) { el.classList.remove('hidden'); const tEl = document.getElementById(id+'-title'); if(tEl) tEl.innerText = title||''; const dEl = document.getElementById(id+'-text'); if(dEl) dEl.innerText = text||''; if(image) el.style.backgroundImage = `url('${image}')`; if(link) el.href = link; } else el.classList.add('hidden'); }; cb('app-banner-top', data.banners.banner_top_title, data.banners.banner_top_text, data.banners.banner_top_link, data.banners.banner_top_image); cb('app-banner-bottom', data.banners.banner_bottom_title, data.banners.banner_bottom_text, data.banners.banner_bottom_link, data.banners.banner_bottom_image); } } catch(e) {} }
async function saveBanners() { const topTitle = val('sa-banner-top-title'); const topText = val('sa-banner-top-text'); const topLink = val('sa-banner-top-link'); const topImage = val('sa-banner-top-image'); const bottomTitle = val('sa-banner-bottom-title'); const bottomText = val('sa-banner-bottom-text'); const bottomLink = val('sa-banner-bottom-link'); const bottomImage = val('sa-banner-bottom-image'); try { const res = await fetch(`${API}/superadmin/banners`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ topTitle, topText, topLink, topImage, bottomTitle, bottomText, bottomLink, bottomImage }) }); const data = await res.json(); if(data.success) { showToast('success', 'הבאנרים נשמרו!'); fetchBanners(); } else { showToast('error', 'שגיאה בשמירת הבאנרים'); } } catch(e) { showToast('error', 'תקלת רשת'); } }
