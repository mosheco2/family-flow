// תיקון סגנונות לספריית הסיור - מבטיח שחלונית ההסבר לא תיעלם בטלפון
const introStyle = document.createElement('style');
introStyle.innerHTML = `
    .introjs-fixParent { position: static !important; transform: none !important; z-index: auto !important; }
    @media (max-width: 768px) {
        .introjs-tooltip {
            position: fixed !important;
            top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important; width: 90vw !important; max-width: 350px !important;
            z-index: 9999999 !important;
        }
        .introjs-arrow { display: none !important; }
        .introjs-tooltipReferenceLayer { display: none !important; }
    }
    body.introjs-active .introjs-showElement { transform: none !important; transition: none !important; animation: none !important; }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let forceTourStart = false;
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let pollInterval = null; let saToken = null;

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'} ], 
    expense: [ {value:'food',label:'🍔 מסעדות וטייקאווי'}, {value:'groceries',label:'🛒 סופר ופארם'}, {value:'transport',label:'🚌 תחבורה ודלק'}, {value:'home',label:'🏠 דיור ותחזוקה'}, {value:'bills',label:'📄 חשבונות ותקשורת'}, {value:'fun',label:'🎉 פנאי ובילויים'}, {value:'clothes',label:'👕 ביגוד והנעלה'}, {value:'health',label:'💊 בריאות וביטוחים'}, {value:'education',label:'📚 חינוך וחוגים'}, {value:'vacation',label:'✈️ חופשות וטיולים'}, {value:'pets',label:'🐶 חיות מחמד'}, {value:'gifts',label:'🎁 מתנות ותרומות'}, {value:'other',label:'💸 אחר'} ] 
};
const BUDGET_LABELS = {
    'food': '🍔 מסעדות', 'groceries': '🛒 סופר ופארם', 'transport': '🚌 תחבורה ודלק', 'home': '🏠 דיור ותחזוקה', 'bills': '📄 חשבונות ותקשורת', 'fun': '🎉 פנאי ובילויים', 'clothes': '👕 ביגוד והנעלה', 'health': '💊 בריאות וביטוחים', 'education': '📚 חינוך וחוגים', 'vacation': '✈️ חופשות', 'pets': '🐶 חיות מחמד', 'gifts': '🎁 מתנות ותרומות', 'other': '💸 אחר', 'allocations': '👶 הפרשות כלליות', 'allowance': '💰 דמי כיס לילדים', 'tasks': '✅ תגמול על משימות', 'academy': '🎓 אתגרי אקדמיה', 'savings': '🐖 הפקדות לחיסכון'
};
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

// --- PRELOADER SAFETY ---
function hidePreloader() {
    const preloader = document.getElementById('app-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.classList.add('hidden'), 500);
    }
}

window.onload = async () => {
    setTimeout(hidePreloader, 3000); // 3 sec safety catch
    
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) {
        const joinInput = document.getElementById('join-code');
        if(joinInput) joinInput.value = inviteCode;
        if(inviteRole) document.getElementById('join-role').value = inviteRole;
        hidePreloaderAndShowAuth('join');
        return;
    }
    
    const saved = localStorage.getItem('ofl_session');
    if(saved) {
        try {
            const session = JSON.parse(saved);
            const res = await fetch(`${API}/users/${session.user.id}`);
            if(res.ok) {
                currentUser = await res.json();
                currentGroup = session.group;
                localStorage.setItem('ofl_session', JSON.stringify({user: currentUser, group: currentGroup}));
                await loadDashboard();
            } else { hidePreloaderAndShowAuth('login'); }
        } catch(e) { hidePreloaderAndShowAuth('login'); }
    } else { hidePreloaderAndShowAuth('login'); }
};

function hidePreloaderAndShowAuth(view) {
    hidePreloader();
    document.getElementById('auth-container').classList.remove('hidden');
    switchView(view);
}

// --- ACCESSIBILITY ---
let currentFontSize = 1.0;
function toggleAccessibilityMenu() { document.getElementById('accessibility-modal').classList.toggle('hidden'); }
function changeFontSize(delta) { currentFontSize *= delta; document.documentElement.style.fontSize = `${currentFontSize * 100}%`; }
function toggleAccessFeature(className) { document.body.classList.toggle(className); }
function resetAccessibility() { currentFontSize = 1.0; document.documentElement.style.fontSize = '100%'; document.body.classList.remove('acc-contrast', 'acc-grayscale', 'acc-underlines', 'acc-readable-font'); }

// --- AUTH & SETUP ---
function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const el = document.getElementById(`view-${v}`); if(el) el.classList.add('hidden'); }); const target = document.getElementById(`view-${view}`); if(target) target.classList.remove('hidden'); }
function selectType(t) { const input = document.getElementById('create-type'); if(input) input.value = t; document.getElementById('type-family').className=`flex-1 p-4 rounded-2xl border-2 text-center font-bold transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600':'border-slate-100 text-slate-400'}`; document.getElementById('type-group').className=`flex-1 p-4 rounded-2xl border-2 text-center font-bold transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600':'border-slate-100 text-slate-400'}`; }
function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } document.getElementById('tos-modal').classList.remove('hidden'); }
function closeTosModal() { document.getElementById('tos-modal').classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); 
}

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
    const d = await res.json();
    if(d.success) { showToast('success', 'בקשה נשלחה בהצלחה!'); switchView('login'); } else showToast('error', d.error);
}

async function authAction(endpoint, body) {
    toggleLoader('login', true);
    try {
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await res.json();
        if(data.success) {
            currentUser = data.user; currentGroup = data.group;
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup}));
            await loadDashboard();
        } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאת חיבור לשרת'); } finally { toggleLoader('login', false); }
}

// --- SUPER ADMIN LOGIC ---
async function handleSALogin(e) {
    e.preventDefault();
    const code = val('sa-code');
    const pass = val('sa-password');
    try {
        const res = await fetch(`${API}/superadmin/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, password: pass})
        });
        const data = await res.json();
        if(data.success) {
            saToken = data.token;
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('sa-dashboard-container').classList.remove('hidden');
            loadSAData();
        } else {
            showToast('error', data.error);
        }
    } catch(err) { showToast('error', 'שגיאת תקשורת'); }
}

function logoutSA() {
    saToken = null;
    document.getElementById('sa-dashboard-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    switchView('login');
}

async function loadSAData() {
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }});
        const data = await res.json();
        if (data.error) { showToast('error', 'שגיאת שרת: ' + data.error); return; }

        document.getElementById('sa-welcome-msg').value = data.welcomeMsg || '';
        document.getElementById('sa-ad-banner-text-top').value = data.adBannerText || '';
        document.getElementById('sa-ad-banner-link-top').value = data.adBannerLink || '';
        document.getElementById('sa-ad-banner-text-bottom').value = data.adBannerBottomText || '';
        document.getElementById('sa-ad-banner-link-bottom').value = data.adBannerBottomLink || '';
        
        const actList = document.getElementById('sa-activity-list');
        actList.innerHTML = data.activity.map(a => {
            const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`;
            return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | משפחת <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`;
        }).join('');
        if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין...</p>';

        const groupsList = document.getElementById('sa-groups-list');
        let gHtml = '';
        data.groups.forEach(g => {
            const groupUsers = data.users.filter(u => u.group_id === g.id);
            let uHtml = groupUsers.map(u => `
                <div class="flex justify-between items-center bg-white p-2 mt-1 rounded border text-sm">
                    <span>${u.nickname} (${u.role})</span>
                    <button onclick="saDeleteUser(${u.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');
            gHtml += `<div class="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-blue-900">${g.name} (קוד: ${g.group_code})</h3><button onclick="saDeleteGroup(${g.id})" class="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-600">מחק משפחה</button></div>${uHtml}</div>`;
        });
        groupsList.innerHTML = gHtml;
    } catch(e) { showToast('error', 'שגיאה בטעינת נתונים'); }
}

async function saveGlobalSettings() {
    const msg = document.getElementById('sa-welcome-msg').value;
    const bannerTextTop = document.getElementById('sa-ad-banner-text-top').value;
    const bannerLinkTop = document.getElementById('sa-ad-banner-link-top').value;
    const bannerTextBottom = document.getElementById('sa-ad-banner-text-bottom').value;
    const bannerLinkBottom = document.getElementById('sa-ad-banner-link-bottom').value;
    await fetch(`${API}/superadmin/settings`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
        body: JSON.stringify({ 
            welcomeMsg: msg, 
            adBannerText: bannerTextTop, 
            adBannerLink: bannerLinkTop,
            adBannerBottomText: bannerTextBottom,
            adBannerBottomLink: bannerLinkBottom
        })
    });
    showToast('success', 'הגדרות המערכת נשמרו בהצלחה!');
}

async function checkGlobalSettings() {
    try {
        const res = await fetch(`${API}/settings/config`); 
        const config = await res.json();
        
        // Top Ad Banner
        const adBannerTop = document.getElementById('global-ad-banner-top');
        const adTextTop = document.getElementById('ad-banner-text-top');
        const adLinkTop = document.getElementById('ad-banner-link-top');
        
        if (config.ad_banner_text && config.ad_banner_text.trim() !== '') {
            adTextTop.innerText = config.ad_banner_text;
            if (config.ad_banner_link && config.ad_banner_link.trim() !== '') {
                adLinkTop.href = config.ad_banner_link;
            } else {
                adLinkTop.removeAttribute('href');
            }
            adBannerTop.classList.remove('hidden');
        } else {
            adBannerTop.classList.add('hidden');
        }

        // Bottom Ad Banner
        const adBannerBottom = document.getElementById('global-ad-banner-bottom');
        const adTextBottom = document.getElementById('ad-banner-text-bottom');
        const adLinkBottom = document.getElementById('ad-banner-link-bottom');
        
        if (config.ad_banner_bottom_text && config.ad_banner_bottom_text.trim() !== '') {
            adTextBottom.innerText = config.ad_banner_bottom_text;
            if (config.ad_banner_bottom_link && config.ad_banner_bottom_link.trim() !== '') {
                adLinkBottom.href = config.ad_banner_bottom_link;
            } else {
                adLinkBottom.removeAttribute('href');
            }
            adBannerBottom.classList.remove('hidden');
        } else {
            adBannerBottom.classList.add('hidden');
        }

        // Welcome Msg
        if (config.welcome_msg && config.welcome_msg.trim() !== '') {
            const tourKey = `ofl_welcome_${currentUser.id}_${currentGroup.group_code}`;
            if (localStorage.getItem(tourKey) !== config.welcome_msg) {
                document.getElementById('welcome-modal-text').innerText = config.welcome_msg;
                document.getElementById('welcome-modal').classList.remove('hidden');
                localStorage.setItem(tourKey, config.welcome_msg); return true;
            }
        }
    } catch(e) {} return false;
}


// --- DASHBOARD LOGIC ---
async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('fab-container').classList.remove('hidden');
    
    document.getElementById('dash-group-name').innerText = currentGroup.name;
    document.getElementById('dash-nickname').innerText = currentUser.nickname;
    document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) {
        ['bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools', 'btn-add-budget-cat', 'btn-add-task', 'admin-panel'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
    } else {
        ['bank-child-view','academy-user-view','btn-self-task'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase();
        document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`;
        document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`;
    }

    if(!pollInterval) pollInterval = setInterval(() => { fetchData(); if(isAdmin) fetchPendingUsers(); }, 30000);
    await fetchMembers(); if(isAdmin) fetchPendingUsers(); await fetchData();
    
    const showedWelcome = await checkGlobalSettings();
    hidePreloader();
    
    setTimeout(() => {
        const tourKey = `ofl_tour_v2_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`;
        if (forceTourStart || !localStorage.getItem(tourKey)) {
            localStorage.setItem(tourKey, 'done');
            if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour();
        }
    }, 1000);
}

function switchTab(t) {
    ['feed','tasks','shop','bank','academy','members','budget','pantry','recipes'].forEach(x => {
        const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active');
    });
    const target = document.getElementById(`content-${t}`); if(target) target.classList.remove('hidden');
    const btn = document.getElementById(`tab-${t}`); if(btn) btn.classList.add('tab-active');
    if(t === 'shop') renderShopList();
    if(t === 'pantry') renderPantry();
}

function startAdminTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'סיימתי!', skipLabel: 'דלג', showBullets: true, rtl: true, scrollToElement: true,
        steps: [
            { title: "ברוכים הבאים! 👋", intro: "אני familAI, נעים להכיר! בואו נעשה סיור קצר במערכת." },
            { element: '#user-balance', title: "הארנק המשותף", intro: "כאן תראו את היתרה הפנויה של המשפחה בכל רגע נתון. זכרו, יתרה ירוקה מביאה שקט נפשי!" },
            { element: '#tour-fab-btn', title: "פעולות מהירות", intro: "מכל מסך באפליקציה תוכלו ללחוץ כאן כדי לרשום הוצאה או הכנסה." },
            { element: '#tab-shop', title: "הסופר החכם", intro: "כאן מנהלים רשימות, ו-familAI אפילו סורקת קבלות אוטומטית." },
            { element: '#tab-pantry', title: "המזווה", intro: "בואו נעקוב אחרי מה שיש בבית. נגמר החלב? קליק אחד וזה ברשימת הקניות." },
            { element: '#tab-recipes', title: "שף AI", intro: "הפיצ'ר החדש! שף ה-AI שלנו יציע לכם ארוחות מדהימות בדיוק ממה שיש לכם כרגע במזווה." },
            { element: '#tab-bank', title: "הבנק", intro: "הלב הפיננסי. כאן מחלקים דמי כיס וריביות לילדים כדי ללמד אותם ערך של כסף." },
            { element: '#tab-academy', title: "אקדמיה", intro: "ידע שווה כסף! צרו לילדים אתגרים דרך ה-AI והעניקו להם בונוסים." },
            { element: '#tab-budget', title: "תקציב", intro: "הגדירו יעדים לכל קטגוריה וקבלו תובנות חכמות כדי שלא תחרגו בסוף החודש." },
            { element: '#tab-tasks', title: "משימות", intro: "נגמרו הוויכוחים. הגדירו משימות, הילד מצלם, וה-AI מאשר את הביצוע והתגמול." },
            { element: '#tab-members', title: "ניהול משפחה", intro: "כאן מוסיפים את בני המשפחה ורואים את כל מי שמחובר לחשבון." }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed');
        if (targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            if(scrollContainer) {
                scrollContainer.style.scrollBehavior = 'auto';
                scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2);
                setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50);
            }
        }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed'));
    intro.start();
}

function startChildTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showBullets: true, rtl: true, scrollToElement: true,
        steps: [
            { title: "היי! 🎉", intro: "מוכן לנהל את הכסף שלך כמו גדול? בוא נכיר את האפליקציה!" },
            { element: '#user-balance', title: "הארנק שלי", intro: "כאן תראה כמה כסף יש לך בחשבון." },
            { element: '#tab-shop', title: "קניות", intro: "מתחשק לך משהו טעים? בקש להוסיף אותו לרשימה של ההורים." },
            { element: '#tab-recipes', title: "שף AI 🍳", intro: "בוא תגלה מה אפשר להכין לאכול ממה שיש עכשיו במזווה!" },
            { element: '#tab-bank', title: "בנק ויעדים", intro: "כאן תראה את דמי הכיס שלך ותפתח קופות חיסכון לדברים שאתה חולם לקנות." },
            { element: '#tab-academy', title: "אקדמיה", intro: "למד ותענה על חידונים כדי להרוויח בונוסים." },
            { element: '#tab-budget', title: "מעקב תקציב", intro: "כאן תוכל לעקוב אחרי ההוצאות שלך." },
            { element: '#tab-tasks', title: "משימות", intro: "בצע משימות מההורים, צלם שסיימת - וקבל תגמול ישר לארנק!" }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-budget') switchTab('budget'); else switchTab('feed');
        if (targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            if(scrollContainer) {
                scrollContainer.style.scrollBehavior = 'auto';
                scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2);
                setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50);
            }
        }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed'));
    intro.start();
}

// --- UTILS ---
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function showToast(t,m) { const el=document.getElementById('toast'); if(!el) return; document.getElementById('toast-message').innerText=m; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleLoader(a,s) { const txt = document.getElementById(`btn-${a}-text`); const ldr = document.getElementById(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function toggleFab() { document.getElementById('fab-container').classList.toggle('fab-open'); }
function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(dir) { document.getElementById('slider-scroll').scrollBy({ left: dir * -150, behavior: 'smooth' }); }
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); setTimeout(() => { if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour(); }, 400); }


// --- RECIPES AI LOGIC ---
async function generateRecipes() {
    const mealType = val('recipe-meal-type');
    const diners = val('recipe-diners');
    const extraIngredients = val('recipe-extra');

    if(!mealType || !diners) return showToast('error', 'אנא מלאו את כל שדות החובה');

    const btnText = document.getElementById('btn-recipe-gen-text');
    const btnLoader = document.getElementById('btn-recipe-gen-loader');
    const btn = document.getElementById('btn-recipe-gen');
    
    if(btn) btn.disabled = true;
    if(btnText) btnText.classList.add('hidden');
    if(btnLoader) btnLoader.classList.remove('hidden');

    try {
        const res = await fetch(`${API}/recipes/generate`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, extraIngredients })
        });
        const data = await res.json();
        if(data.success) {
            renderRecipes(data.recipes);
        } else {
            showToast('error', data.error || 'שגיאה בחיבור ל-AI');
        }
    } catch(e) {
        showToast('error', 'שגיאה בחיבור ל-AI');
    } finally {
        if(btn) btn.disabled = false;
        if(btnText) { btnText.innerText = 'הצע מתכונים נוספים'; btnText.classList.remove('hidden'); }
        if(btnLoader) btnLoader.classList.add('hidden');
    }
}

function renderRecipes(recipes) {
    const container = document.getElementById('recipes-results');
    container.innerHTML = '';
    recipes.forEach(r => {
        const missingHtml = (r.missing_items && r.missing_items.length > 0)
            ? `<p class="text-xs text-orange-500 font-bold mt-2"><i class="fa-solid fa-cart-shopping"></i> חסר במזווה: ${r.missing_items.join(', ')}</p>`
            : `<p class="text-xs text-green-500 font-bold mt-2"><i class="fa-solid fa-check"></i> כל המרכיבים זמינים!</p>`;

        container.innerHTML += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-3">
                <h4 class="font-bold text-slate-800 text-lg">${r.name}</h4>
                ${missingHtml}
                <div class="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl whitespace-pre-line leading-relaxed border border-slate-100">
                    ${r.instructions}
                </div>
            </div>
        `;
    });
    container.classList.remove('hidden');
}


// --- DATA FETCHING & RENDERING (FULL RESTORATION) ---
async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); } catch(e) {}
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
    } catch(e) {}
}

function buildAndRenderFeed() {
    feedCache = [];
    if (currentGroup && currentGroup.created_at) { feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח בהצלחה! 🎉', amount: 0, status: 'welcome' }); }
    if(Array.isArray(allTransactions)) { allTransactions.forEach(t => { feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); }); }
    if(Array.isArray(allTasks)) { allTasks.forEach(t => { feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה: ${t.title}`, amount: t.reward, status: t.status }); }); }
    if(Array.isArray(bundlesCache)) { bundlesCache.forEach(b => { feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); }); }
    feedCache.sort((a, b) => (b.date && a.date) ? (b.date - a.date) : 0);
    renderUnifiedFeed();
}

function renderUnifiedFeed() {
    const filterEl = document.getElementById('feed-user-filter'); const list = document.getElementById('unified-feed-list'); if (!list) return;
    const filterUserId = filterEl ? filterEl.value : 'all'; let filtered = feedCache;
    if (currentUser.role !== 'ADMIN') filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); else if (filterUserId !== 'all' && filterUserId !== '') filtered = feedCache.filter(item => String(item.user_id) === String(filterUserId) || item.type === 'system');
    filtered = filtered.slice(0, 30); 
    if(filtered.length === 0) { list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; return; }
    let html = '';
    filtered.forEach(item => {
        if(!item.date || isNaN(item.date.getTime())) return;
        const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[item.user_id % userColors.length] || 'bg-white border-slate-50'); const userNameDisplay = currentUser.role === 'ADMIN' && item.type !== 'system' ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${item.user_name}</span>` : '';
        const d = item.date; const today = new Date(); const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
        let contentHtml = '';
        if (item.type === 'transaction') {
            const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; const prefix = item.isIncome ? '+' : '-';
            contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        } else if (item.type === 'task') {
            const icon = '<i class="fa-solid fa-list-check text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'pending' ? 'הוקצתה' : (item.status === 'done' ? 'ממתין לאישור' : 'הושלמה'); let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'quiz') {
            const icon = '<i class="fa-solid fa-graduation-cap text-purple-500 bg-purple-100 p-1.5 rounded-full text-[10px]"></i>'; let statusLabel = item.status === 'assigned' ? 'הוקצה' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'נכשל/פג תוקף'); let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
            contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
        } else if (item.type === 'system') {
            const icon = '<i class="fa-solid fa-house text-orange-500 bg-orange-100 p-1.5 rounded-full text-[10px]"></i>';
            contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${item.title}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div></div>`;
        }
        html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border transform transition hover:scale-[1.01] mb-2 flex items-center">${contentHtml}</div>`;
    });
    list.innerHTML = html;
}

async function fetchMembers() { 
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`); 
        membersCache = await res.json(); if(!Array.isArray(membersCache)) membersCache = [];
        if (currentUser.role === 'ADMIN') { 
            try {
                const bF = document.getElementById('budget-filter'); const fF = document.getElementById('feed-user-filter'); const gS = document.getElementById('goal-target-user');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל הבית</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) bF.value = cur; } 
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${m.nickname}</option>`); if(cur) fF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור מי היעד? (כללי/למשפחה)</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${m.nickname}</option>`; }); if(cur) gS.value = cur; }
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
                if(children.length === 0) a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים במשפחה עדיין.</p>';
                else children.forEach(m => { 
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?'; 
                    a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${m.nickname || 'ילד'}</h4><p class="text-[10px] text-slate-400">₪${m.allowance_amount || 0}/שבוע • ${m.interest_rate || 0}% ריבית</p></div></div><div class="flex gap-2"><button onclick="openBankSettings(${m.id}, '${m.nickname}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${m.nickname}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`; 
                }); 
            } 
        } catch(err) {}
    } catch(e) {}
}

function updateAssignDetails() { const select = document.getElementById('assign-bundle-select'); const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { document.getElementById('assign-reward').value = bundle.reward; } }
function openAssignModal() {
    const cSelect = document.getElementById('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר ילד...</option>';
    if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${m.nickname}</option>`; }); }
    const bSelect = document.getElementById('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${b.title} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; }
    document.getElementById('assign-reward').value = ''; document.getElementById('assign-days').value = ''; document.getElementById('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = document.getElementById('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = document.getElementById('assign-child-select').value; const bundleId = document.getElementById('assign-bundle-select').value; const reward = document.getElementById('assign-reward').value; const days = document.getElementById('assign-days').value;
    if(!childId) return showToast('error', 'אנא בחר ילד להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days }) });
    document.getElementById('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData();
}

function renderAdminAcademy() {
    const list = document.getElementById('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר familAI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה לילד</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבחנים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו מבחנים לאף ילד עדיין.</p>'; } else {
        html += '<div class="space-y-2 pb-20">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${b.title}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${b.assignee_name}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;
}

function renderLibrary() {
    try {
        const libList = document.getElementById('library-list'); if (!libList) return;
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים להציג כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'math') return '<i class="fa-solid fa-calculator"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-chart-line"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${b.title}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) {}
}

function renderMyAssignments(bundles) {
    const list = document.getElementById('my-assignments-list'); if (!list) return;
    if (!bundles || bundles.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">אין משימות פתוחות כרגע.</p>'; return; }
    let html = '';
    bundles.forEach(b => {
        if (b.status === 'assigned') {
            html += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 mb-2 flex justify-between items-center"><div><h4 class="font-bold text-slate-800">${b.title}</h4><p class="text-xs text-slate-500">תגמול: ₪${b.custom_reward !== null ? b.custom_reward : b.default_reward}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700">התחל עכשיו</button></div>`;
        }
    });
    list.innerHTML = html || '<p class="text-center text-slate-400 text-xs py-4">הכל בוצע! בקש אתגר חדש מ-familAI.</p>';
}

function openAIModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
async function generateAIQuiz() {
    const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'חושבת...';
    try {
        const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic') }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchData(); openAssignModalSpecific(data.bundleId); } 
        else showToast('error', data.error || 'שגיאה ביצירת המבחן');
    } catch(e) { showToast('error', 'תקלה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
}

async function requestChallenge(bundleId = null) {
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'המבחן נוסף בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); }
}

let currentQuizData = null; let currentQuestionIndex = 0; let quizScore = 0;

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    document.getElementById('quiz-title').innerText = bundle.title; document.getElementById('btn-tutor').classList.add('hidden'); 
    const textContainer = document.getElementById('quiz-text-container');
    if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else if(textContainer) { textContainer.classList.add('hidden'); }
    document.getElementById('quiz-runner-modal').classList.remove('hidden'); document.getElementById('question-container').classList.remove('hidden'); document.getElementById('quiz-result').classList.add('hidden'); renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    document.getElementById('q-progress').innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; document.getElementById('q-text').innerText = q.q;
    const optsContainer = document.getElementById('q-options'); optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 font-medium hover:bg-slate-100 text-slate-700 border-2 border-transparent">${opt}</button>`; });
}

async function submitAnswer(selectedIdx) {
    const q = currentQuizData.questions[currentQuestionIndex]; const isCorrect = selectedIdx === q.correct; const btns = document.querySelectorAll('.quiz-option');
    btns.forEach(b => b.disabled = true);
    btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong');
    if(!isCorrect) { btns[q.correct].classList.add('correct'); currentWrongAnswers.push({ q: q.q, wrong: q.options[selectedIdx], correct: q.options[q.correct] }); }
    if(isCorrect) quizScore++;
    setTimeout(async () => { currentQuestionIndex++; if (currentQuestionIndex < currentQuizData.questions.length) { renderQuestion(); } else { finishQuiz(); } }, 1000);
}

async function finishQuiz() {
    const total = currentQuizData.questions.length; const finalScore = Math.round((quizScore / total) * 100); const passed = finalScore >= currentQuizData.threshold;
    document.getElementById('question-container').classList.add('hidden'); const textContainer = document.getElementById('quiz-text-container'); if(textContainer) textContainer.classList.add('hidden'); document.getElementById('quiz-result').classList.remove('hidden');
    document.getElementById('quiz-icon').innerHTML = passed ? '🏆' : '📚'; document.getElementById('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא...'; document.getElementById('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward !== null ? currentQuizData.custom_reward : currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; document.getElementById('quiz-score-display').innerText = `ציון: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) document.getElementById('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore }) });
    fetchData(); 
}

function closeQuiz() { document.getElementById('quiz-runner-modal').classList.add('hidden'); }

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; const w = currentWrongAnswers[0]; document.getElementById('btn-tutor').disabled = true; document.getElementById('btn-tutor').innerText = 'מכינה הסבר... ⏳';
    try {
        const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct }) }); const data = await res.json();
        if(data.success) showFamilAIModal('המורה הפרטית שלך', data.explanation);
    } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { document.getElementById('btn-tutor').disabled = false; document.getElementById('btn-tutor').innerText = '🤖 familAI, איפה טעיתי?'; }
}

function showFamilAIModal(title, text) {
    document.getElementById('familai-advisor-modal').classList.remove('hidden'); document.getElementById('familai-modal-subtitle').innerText = title;
    if (text) { document.getElementById('familai-advisor-loading').classList.add('hidden'); document.getElementById('familai-advice-text').innerText = text; document.getElementById('familai-advisor-content').classList.remove('hidden'); } 
    else { document.getElementById('familai-advisor-loading').classList.remove('hidden'); document.getElementById('familai-advisor-content').classList.add('hidden'); }
}

async function getFamilAIAdvice(childId, goalId) {
    showFamilAIModal('היועצת הפיננסית של המשפחה', null); document.getElementById('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
    try {
        const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId }) }); const data = await res.json();
        if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); } 
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת עצה'); }
    } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת'); }
}

async function getBudgetInsight() {
    showFamilAIModal('אנליסטית התקציב', null); document.getElementById('familai-loading-text').innerText = 'בודקת על מה הוצאנו החודש...';
    try {
        const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
        if(data.success && data.insight) showFamilAIModal('אנליסטית התקציב', data.insight);
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
    } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
}

async function getPantryInsight() {
    showFamilAIModal('מנהלת המזווה', null); document.getElementById('familai-loading-text').innerText = 'מחשבת כמויות ומרגלי קנייה...';
    try {
        const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
        if(data.success && data.insight) showFamilAIModal('מנהלת המזווה', data.insight);
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המזווה'); }
    } catch(e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
}

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
    if(isSelf) { document.getElementById('task-modal-title').innerText = 'משימה אישית'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardGroup.classList.add('hidden'); } 
    else { 
        document.getElementById('task-modal-title').innerText = 'יצירת משימה'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardGroup.classList.remove('hidden'); 
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
        const res = await fetch(`${API}/tasks/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ age: age, topic: topic }) }); const data = await res.json();
        if(data.success && data.tasks && data.tasks.length > 0) {
            const resultsContainer = document.getElementById('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
            data.tasks.forEach(task => { const safeTitle = (task.title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;"); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${task.title}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
            resultsContainer.classList.remove('hidden'); triggerConfetti();
        } else showToast('error', 'familAI לא הצליחה לייצר משימות. נסו שוב.');
    } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; }
}

function selectAITask(title, reward) { document.getElementById('task-title').value = title; document.getElementById('task-reward').value = reward; setTaskMode('manual'); }

async function submitTask() { 
    const isSelf = document.getElementById('task-is-self').value === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = isSelf ? 0 : val('task-reward'); const title = val('task-title'); const days = val('task-days');
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    await fetch(`${API}/tasks`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward, assignedTo: assignee, days: days }) }); 
    if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', 'משימה נוצרה בהצלחה!'); fetchData(); 
}

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; document.getElementById('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    showFamilAIModal('בקרת איכות', null); document.getElementById('familai-loading-text').innerText = 'familAI בודקת את התמונה שלך...';
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
            const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: file.type }) }); const data = await res.json();
            if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
        } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ גדול מדי או שגיאת תקשורת.'); }
        event.target.value = '';
    }; reader.readAsDataURL(file);
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    showFamilAIModal('קופאית אוטומטית', null); document.getElementById('familai-loading-text').innerText = 'familAI סורקת את הקבלה... זה ייקח רגע.';
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
            const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: file.type }) }); const data = await res.json();
            if(data.success) { showFamilAIModal('קופאית אוטומטית', `סרקתי והוספתי ${data.count} פריטים מהקבלה לעגלה שלכם בהצלחה!`); triggerConfetti(); fetchData(); } else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בקריאת הקבלה.'); }
        } catch(err) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ גדול או שגיאת תקשורת.'); }
        event.target.value = '';
    }; reader.readAsDataURL(file);
}

function filterSuggestions(val) { const list = document.getElementById('suggestions'); list.innerHTML = ''; if (!val) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(val)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { document.getElementById('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() { const itemInput = document.getElementById('shop-item'); const btn = document.querySelector('#shop-modal button.bg-pink-500'); const item = itemInput.value; const qty = val('shop-quantity'); const est = val('shop-est-price'); if(!item) return; if (btn.disabled) return; btn.disabled = true; btn.innerText = 'מוסיף...'; try { const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, estimatedPrice: est, userId: currentUser.id}) }); const data = await res.json(); if (data.success) { document.getElementById('shop-modal').classList.add('hidden'); itemInput.value = ''; document.getElementById('shop-est-price').value = ''; document.getElementById('shop-quantity').value = 1; document.getElementById('suggestions').classList.add('hidden'); if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg; showToast('success', 'נוסף לרשימה'); fetchData(); } } finally { btn.disabled = false; btn.innerText = 'הוסף'; } }
async function deleteItem(id) { if(!confirm('למחוק פריט זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק'); fetchData(); }
function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row =>
