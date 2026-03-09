// תיקון סגנונות הרמטי לספריית הסיור - מונע בריחת חלוניות ושומר על מיקום כפתורים מרחפים
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
        .introjs-tooltipReferenceLayer {
            position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important;
            margin: 0 !important; right: auto !important; bottom: auto !important; width: 90vw !important;
        }
        .introjs-tooltip {
            position: relative !important; max-width: 350px !important; margin: 0 auto !important;
            left: auto !important; right: auto !important; top: auto !important; bottom: auto !important;
        }
        .introjs-arrow { display: none !important; }
    }
    body.introjs-active .introjs-showElement { transition: none !important; animation: none !important; }
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
let preloaderFallbackTimer;

function hidePreloader() {
    const preloader = document.getElementById('app-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.classList.add('hidden'), 500);
    }
    if (preloaderFallbackTimer) clearTimeout(preloaderFallbackTimer);
}

function hidePreloaderAndShowAuth(view = 'login') {
    hidePreloader();
    const authContainer = document.getElementById('auth-container');
    if(authContainer) authContainer.classList.remove('hidden');
    switchView(view);
}

window.onload = async () => { 
    preloaderFallbackTimer = setTimeout(() => {
        hidePreloaderAndShowAuth('login');
    }, 4000); 

    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    
    if (inviteCode) { 
        const joinCodeInput = document.getElementById('join-code');
        if(joinCodeInput) joinCodeInput.value = inviteCode; 
        if(inviteRole) {
            const roleInput = document.getElementById('join-role');
            if(roleInput) roleInput.value = inviteRole; 
        }
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
function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => { const el = document.getElementById(`view-${v}`); if(el) el.classList.add('hidden'); }); const target = document.getElementById(`view-${view}`); if(target) target.classList.remove('hidden'); }
function selectType(t) { const input = document.getElementById('create-type'); if(input) input.value = t; const tf = document.getElementById('type-family'); if(tf) tf.className=`flex-1 p-4 rounded-2xl border-2 text-center font-bold transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600':'border-slate-100 text-slate-400'}`; const tg = document.getElementById('type-group'); if(tg) tg.className=`flex-1 p-4 rounded-2xl border-2 text-center font-bold transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600':'border-slate-100 text-slate-400'}`; }

function openTosModal(e) { 
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const modal = document.getElementById('tos-modal');
    if(modal) modal.classList.remove('hidden'); 
}
function closeTosModal() { 
    const modal = document.getElementById('tos-modal');
    if(modal) modal.classList.add('hidden'); 
}

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
    if(d.success) { showToast('success', 'נשלח בהצלחה!'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error);
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
        } else {
            showToast('error', data.error); 
            hidePreloader();
        }
    } catch(e) { 
        showToast('error', 'שגיאה בחיבור לשרת'); 
        hidePreloader();
    } finally { 
        toggleLoader('login', false); 
    } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { const sc = document.getElementById('slider-scroll'); if(sc) sc.scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','academy','members','budget','pantry', 'recipes'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    const target = document.getElementById(`content-${t}`); if(target) target.classList.remove('hidden');
    const tabBtn = document.getElementById(`tab-${t}`); if(tabBtn) tabBtn.classList.add('tab-active'); 
    
    const footer = document.getElementById('cart-footer');
    const fabContainer = document.getElementById('fab-container');
    if (t !== 'shop') { if (footer) footer.classList.add('hidden'); if(fabContainer) fabContainer.classList.remove('fab-lifted'); } else { try { renderShopList(); } catch(e) {} }
    if (t === 'pantry') { try { renderPantry(); } catch(e) {} }
}

async function loadDashboard() {
    try {
        document.getElementById('auth-container').classList.add('hidden'); document.getElementById('dashboard-container').classList.remove('hidden'); document.getElementById('fab-container').classList.remove('hidden');
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">קוד: ${currentGroup.group_code}</span>` : '';
        document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} ${codeBadge}`; document.getElementById('dash-nickname').innerText = currentUser.nickname; document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

        const isAdmin = currentUser.role === 'ADMIN';
        
        if(isAdmin) { 
            ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'admin-tasks-hint', 'btn-add-budget-cat'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        } else { 
            ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
            document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase(); document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
            document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
        }
        
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); if(isAdmin) fetchPendingUsers(); }, 30000);
        
        await fetchMembers(); 
        if(isAdmin) fetchPendingUsers(); 
        await fetchData();
        
        const showedWelcome = await checkGlobalSettings();
        hidePreloader(); // המסך יורד בוודאות אם הכל עבר
        
        setTimeout(() => {
            const tourKey = `ofl_tour_v3_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`;
            if (forceTourStart || !localStorage.getItem(tourKey)) {
                localStorage.setItem(tourKey, 'done');
                if (!showedWelcome) {
                    if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour();
                }
            }
        }, 1000);
    } catch(e) {
        console.error(e);
        hidePreloader(); // במקרה של שגיאה - נוריד את מסך הטעינה כדי לא להיתקע
    }
}

// --- RECIPES AI LOGIC ---
async function generateRecipes() {
    const mealType = val('recipe-meal-type');
    const diners = val('recipe-diners');
    const extraIngredients = val('recipe-extra');
    const ignorePantryEl = document.getElementById('recipe-ignore-pantry');
    const ignorePantry = ignorePantryEl ? ignorePantryEl.checked : false;

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
            body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, extraIngredients, ignorePantry })
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
        
        if (data.error) {
            console.error('Admin Data Error:', data.error);
            showToast('error', 'שגיאת שרת: ' + data.error);
            return;
        }

        document.getElementById('sa-welcome-msg').value = data.welcomeMsg || '';
        document.getElementById('sa-ad-banner-text-top').value = data.adBannerTextTop || '';
        document.getElementById('sa-ad-banner-link-top').value = data.adBannerLinkTop || '';
        document.getElementById('sa-ad-banner-text-bottom').value = data.adBannerTextBottom || '';
        document.getElementById('sa-ad-banner-link-bottom').value = data.adBannerLinkBottom || '';
        
        const actList = document.getElementById('sa-activity-list');
        actList.innerHTML = data.activity.map(a => {
            const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`;
            return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', {hour:'2-digit', minute:'2-digit'})}</span> | משפחת <span class="text-blue-600 font-bold">${a.group_name}</span> | <span class="font-bold">${a.user_name}</span> | ${a.description}</div> ${amountHtml}</div>`;
        }).join('');
        if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';

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
            
            gHtml += `
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="font-bold text-blue-900">${g.name} (קוד: ${g.group_code})</h3>
                        <button onclick="saDeleteGroup(${g.id})" class="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-600">מחק משפחה</button>
                    </div>
                    ${uHtml}
                </div>
            `;
        });
        groupsList.innerHTML = gHtml;
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

async function saDeleteUser(id) {
    if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return;
    await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }});
    showToast('success', 'משתמש נמחק');
    loadSAData();
}

async function saDeleteGroup(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק משפחה זו ואת כל המשתמשים והנתונים שלה?! הפעולה בלתי הפיכה.')) return;
    await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }});
    showToast('success', 'משפחה נמחקה לחלוטין');
    loadSAData();
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
            adBannerTextTop: bannerTextTop, 
            adBannerLinkTop: bannerLinkTop,
            adBannerTextBottom: bannerTextBottom,
            adBannerLinkBottom: bannerLinkBottom
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
        
        if (config.ad_banner_text_top && config.ad_banner_text_top.trim() !== '') {
            if(adTextTop) adTextTop.innerText = config.ad_banner_text_top;
            if (config.ad_banner_link_top && config.ad_banner_link_top.trim() !== '') {
                if(adLinkTop) adLinkTop.href = config.ad_banner_link_top;
            } else {
                if(adLinkTop) adLinkTop.removeAttribute('href');
            }
            if(adBannerTop) adBannerTop.classList.remove('hidden');
        } else {
            if(adBannerTop) adBannerTop.classList.add('hidden');
        }

        // Bottom Ad Banner
        const adBannerBottom = document.getElementById('global-ad-banner-bottom');
        const adTextBottom = document.getElementById('ad-banner-text-bottom');
        const adLinkBottom = document.getElementById('ad-banner-link-bottom');
        
        if (config.ad_banner_text_bottom && config.ad_banner_text_bottom.trim() !== '') {
            if(adTextBottom) adTextBottom.innerText = config.ad_banner_text_bottom;
            if (config.ad_banner_link_bottom && config.ad_banner_link_bottom.trim() !== '') {
                if(adLinkBottom) adLinkBottom.href = config.ad_banner_link_bottom;
            } else {
                if(adLinkBottom) adLinkBottom.removeAttribute('href');
            }
            if(adBannerBottom) adBannerBottom.classList.remove('hidden');
        } else {
            if(adBannerBottom) adBannerBottom.classList.add('hidden');
        }

        // Welcome Msg
        if (config.welcome_msg && config.welcome_msg.trim() !== '') {
            const tourKey = `ofl_welcome_${currentUser.id}_${currentGroup.group_code}`;
            if (localStorage.getItem(tourKey) !== config.welcome_msg) {
                const wm = document.getElementById('welcome-modal-text');
                if(wm) wm.innerText = config.welcome_msg;
                const mw = document.getElementById('welcome-modal');
                if(mw) mw.classList.remove('hidden');
                localStorage.setItem(tourKey, config.welcome_msg); return true;
            }
        }
    } catch(e) { console.error(e); } return false;
}

function closeWelcomeModal() {
    document.getElementById('welcome-modal').classList.add('hidden');
    checkAndStartTour(forceTourStart);
    forceTourStart = false; // איפוס
}

function triggerManualTour() {
    document.getElementById('profile-modal').classList.add('hidden');
    setTimeout(() => {
        switchTab('feed');
        if (currentUser.role === 'ADMIN') {
            startAdminTour();
        } else {
            startChildTour();
        }
    }, 300);
}

// --- GUIDED TOURS (Intro.js) ---
function startAdminTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג',
        showProgress: true, rtl: true, hidePrev: false, showBullets: true,
        scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים! 👋", intro: "אני familAI, העוזרת הדיגיטלית שלכם. בואו נעשה סיור קצר ונלמד איך לנהל את הכלכלה המשפחתית בקלות!" },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תראו תמיד את היתרה הפנויה של המשפחה. כשהמספר ירוק - הכל מצוין!", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולות מהירות ⚡", intro: "מכל מקום באפליקציה, תוכלו ללחוץ על הפלוס כדי לרשום בקלות הוצאה חדשה או הכנסה.", position: 'top' },
            { element: '#tab-shop', title: "קניות חכמות 🛒", intro: "רשימת הקניות של כל הבית. כשתחזרו מהסופר, תוכלו אפילו לצלם לי את הקבלה ואני אכניס את הנתונים למערכת באופן אוטומטי!" },
            { element: '#tab-pantry', title: "מזווה ומלאי 📦", intro: "עקבו כאן אחרי מה שיש בבית. כשמשהו נגמר, לחיצה אחת תעביר אותו ישירות לרשימת הקניות." },
            { element: '#tab-recipes', title: "שף AI 🍳", intro: "לא יודעים מה להכין לארוחת ערב? ספרו לי מה יש במזווה ואני אייצר לכם מתכונים מעולים בשניות!" },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "כאן תוכלו לחלק דמי כיס לילדים בלחיצת כפתור, להגדיר להם ריביות, ולעקוב אחרי יעדי החיסכון שלהם." },
            { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "ידע שווה כסף! אני איצור עבור הילדים אתגרים ומבחנים, ומי שיענה נכון יזכה בבונוסים כספיים." },
            { element: '#tab-budget', title: "ניהול תקציב 📊", intro: "הגדירו יעדים חודשיים לכל סוג של הוצאה (כמו דלק או מסעדות) ואני אעזור לכם לעמוד בהם." },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "הגדירו לילדים משימות בבית עם תגמול כספי. הם יצלמו שסיימו, ואני אאשר להם את התשלום!" },
            { element: '#tab-members', title: "בני הבית 👨‍👩‍👧‍👦", intro: "כאן מזמינים את שאר בני המשפחה ומנהלים את החשבונות שלהם." }
        ]
    });

    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return;
        const id = targetElement.id;
        
        if(id === 'tab-shop') switchTab('shop'); 
        else if(id === 'tab-pantry') switchTab('pantry'); 
        else if(id === 'tab-recipes') switchTab('recipes'); 
        else if(id === 'tab-bank') switchTab('bank'); 
        else if(id === 'tab-academy') switchTab('academy'); 
        else if(id === 'tab-budget') switchTab('budget'); 
        else if(id === 'tab-tasks') switchTab('tasks'); 
        else if(id === 'tab-members') switchTab('members'); 
        else switchTab('feed'); 
        
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            if (scrollContainer) {
                scrollContainer.style.scrollBehavior = 'auto'; 
                const scrollPos = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2);
                scrollContainer.scrollLeft = scrollPos;
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
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג',
        showProgress: true, rtl: true, hidePrev: false, showBullets: true,
        scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "היי! 🎉", intro: "מוכנים לנהל את הכסף שלכם כמו גדולים? בואו נכיר את האפליקציה!" },
            { element: '#user-balance', title: "הארנק שלי 💳", intro: "כאן תמיד תראו כמה כסף יש לכם בחשבון ברגע זה.", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "מתחשק לכם משהו טעים? בקשו להוסיף אותו לרשימת הקניות של ההורים." },
            { element: '#tab-recipes', title: "שף AI 🍳", intro: "בואו תגלו איזה אוכל טעים אפשר להכין ממה שיש עכשיו במזווה!" },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "כאן תראו את דמי הכיס שלכם ותפתחו קופות חיסכון לדברים שאתם חולמים לקנות." },
            { element: '#tab-academy', title: "האקדמיה הפיננסית 🎓", intro: "בצעו אתגרי למידה קצרים ומעניינים ותרוויחו בונוסים שווים." },
            { element: '#tab-budget', title: "מעקב תקציב 📊", intro: "כאן תוכלו לעקוב אחרי ההוצאות שלכם מול היעדים." },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "ההורים ביקשו עזרה? סיימו משימות, צלמו אותן - וקבלו תגמול ישר לארנק!" }
        ]
    });

    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return;
        const id = targetElement.id;

        if(id === 'tab-shop') switchTab('shop'); 
        else if(id === 'tab-recipes') switchTab('recipes'); 
        else if(id === 'tab-bank') switchTab('bank'); 
        else if(id === 'tab-academy') switchTab('academy'); 
        else if(id === 'tab-budget') switchTab('budget'); 
        else if(id === 'tab-tasks') switchTab('tasks'); 
        else switchTab('feed'); 
        
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            if (scrollContainer) {
                scrollContainer.style.scrollBehavior = 'auto'; 
                const scrollPos = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2);
                scrollContainer.scrollLeft = scrollPos;
                setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); 
            }
        }
        
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed'));
    intro.start();
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
            } catch(err) { console.error(err); }
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
        } catch(err) { console.error(err); }
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
        } catch(err) { console.error(err); }
    } catch(e) { console.error(e); }
}

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) {
            hidePreloader(); 
            return;
        }
        
        currentUser.balance = data.user.balance; 
        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) { console.error('Academy err:', e); }
        try { renderTasks(allTasks); renderPantry(); } catch(e) { console.error('Tasks/Pantry err:', e); }
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) { console.error('Shop err:', e); }
        try { fetchBudget(); } catch(e) { console.error('Budget err:', e); }
        
        try {
            const goalsList = document.getElementById(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); 
            const goalsContainer = currentUser.role !== 'ADMIN' ? document.getElementById('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-
