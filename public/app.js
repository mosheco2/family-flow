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
    }, 3500); 

    const urlParams = newSearchParams(window.location.search);
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
                    clearTimeout(preloaderFallbackTimer);
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
                localStorage.setItem(tourKey, 'true');
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
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "כאן תראו את דמי הכיס שלכם ותפתחו 'קופות חיסכון' לדברים שאתם חולמים לקנות." },
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
        
        return new Promise(resolve => setTimeout(() => {
            intro.refresh(); 
            resolve();
        }, 150));
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
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${g.owner_name}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${g.title}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${g.title}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) { console.error('Goals err:', e); }
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = document.getElementById('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = document.getElementById('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = document.getElementById('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
            }
        } catch(e) { console.error('Stats err:', e); }

        try {
            const limit = currentUser.role === 'ADMIN' ? 50 : 20; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) allTransactions = Array.isArray(await transRes.json()) ? await transRes.json() : [];
        } catch(e) { allTransactions = []; console.error('Transactions err:', e); }

        try { renderChildTodo(); buildAndRenderFeed(); } catch(e) { console.error('Feed err:', e); }
    } catch(e) { console.error('FetchData err:', e); }
}

function showFamilAIModal(title, text) {
    document.getElementById('familai-advisor-modal').classList.remove('hidden'); document.getElementById('familai-modal-subtitle').innerText = title;
    if (text) { document.getElementById('familai-advisor-loading').classList.add('hidden'); document.getElementById('familai-advice-text').innerText = text; document.getElementById('familai-advisor-content').classList.remove('hidden'); } 
    else { document.getElementById('familai-advisor-loading').classList.remove('hidden'); document.getElementById('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { document.getElementById('ai-modal').classList.remove('hidden'); }
async function generateAIQuiz() {
    const btn = document.getElementById('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳';
    try {
        const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic') }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); document.getElementById('ai-modal').classList.add('hidden'); document.getElementById('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); } 
        else showToast('error', data.error || 'שגיאה ביצירת המבחן');
    } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
}

async function getFamilAIAdvice(childId, goalId) {
    showFamilAIModal('היועצת הפיננסית של המשפחה', null); document.getElementById('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
    try {
        const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId }) }); const data = await res.json();
        if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); } 
        else { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
    } catch (e) { document.getElementById('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
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

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; const w = currentWrongAnswers[0]; document.getElementById('btn-tutor').disabled = true; document.getElementById('btn-tutor').innerText = 'מכינה הסבר... ⏳';
    try {
        const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct }) }); const data = await res.json();
        if(data.success) showFamilAIModal('המורה הפרטית שלך', data.explanation);
    } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { document.getElementById('btn-tutor').disabled = false; document.getElementById('btn-tutor').innerText = '🤖 familAI, איפה טעיתי?'; }
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
        const isChecked = i.status === 'in_cart'; const val = i.estimated_price > 0 ? i.estimated_price : ''; const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * i.quantity;
        let bestPriceHtml = '';
        if (i.best_price && i.best_price.price_per_unit > 0) { const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL'); bestPriceHtml = `<div class="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid fa-tag"></i> זול ביותר בעבר: ₪${bestP} (${i.best_price.store_name}, ${dDate})</div>`; }
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3"><input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-pink-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${i.item_name}</span><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-2"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400">${i.requester_name}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ליח'</span><input type="number" id="price-${i.id}" value="${val}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-pink-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(0)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">x${i.quantity}</span></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = document.getElementById(`row-${id}`); const input = document.getElementById(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * item.quantity; const totalEl = document.getElementById(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(0)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: value})}); const data = await res.json(); const freshWisdomDiv = document.getElementById(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = value; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = document.getElementById(`row-${id}`); const btn = document.getElementById(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; document.getElementById(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר'; } calcRunningTotal(); }
function calcRunningTotal() { let total = 0; document.querySelectorAll('.shop-row').forEach(row => { const isChecked = row.querySelector('input[type="checkbox"]').checked; const isMissing = row.classList.contains('missing'); if (isChecked && !isMissing) { const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? itemData.quantity : 1; total += (unitPrice * qty); } }); document.getElementById('cart-total-display').innerText = `₪${total.toFixed(2)}`; }

function openCheckoutSummary() { let count = 0; let missing = 0; let total = 0; document.querySelectorAll('.shop-row').forEach(row => { if (row.classList.contains('missing')) missing++; else if (row.querySelector('input[type="checkbox"]').checked) { count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? itemData.quantity : 1; total += (unitPrice * qty); } }); if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום'); return; } document.getElementById('summ-count').innerText = count; document.getElementById('summ-missing').innerText = missing; document.getElementById('summ-total').innerText = `₪${total.toFixed(2)}`; document.getElementById('confirm-checkout-modal').classList.remove('hidden'); }

async function submitFinalCheckout() {
    const store = document.getElementById('checkout-store').value || 'סופר כללי'; const branch = document.getElementById('checkout-branch').value; let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(document.getElementById(`price-${id}`).value) || 0; const qty = itemData ? itemData.quantity : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    triggerShake();
    await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    document.getElementById('confirm-checkout-modal').classList.add('hidden'); triggerConfetti(); showToast('success', 'הקנייה הושלמה!'); fetchData();
}

async function copyList(tripId) { if(!confirm('האם להעתיק את כל הפריטים מהרשימה הזו לרשימה הנוכחית?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); document.getElementById('history-modal').classList.add('hidden'); showToast('success', 'הרשימה הועתקה!'); fetchData(); }

function openInviteModal() { const codeSpan = document.getElementById('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } document.getElementById('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; let text = role === 'ADMIN' ? `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nהגדרתי אותך כשותף/מנהל (כמוני).\nלחץ על הקישור כדי להצטרף ולבחור סיסמה:\n🔗 ${joinLink}` : `היי! פתחתי לנו בנק משפחתי באפליקציית Oneflow Life 🚀\n\nלחץ על הקישור כדי להצטרף למשפחה שלנו ולפתוח לעצמך חשבון אישי:\n🔗 ${joinLink}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); document.getElementById('invite-modal').classList.add('hidden'); }

function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
function triggerShake() { const app = document.getElementById('main-wrapper'); app.classList.add('shake-effect'); setTimeout(() => app.classList.remove('shake-effect'), 500); }

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = document.getElementById('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${i.item_name} (x${i.quantity})</span><span class="font-bold">₪${i.price_per_unit || 0}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${t.store_name} ${t.branch_name ? `(${t.branch_name})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • ${t.nickname}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">העתק רשימה זו</button></div></div>`; }); document.getElementById('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { document.getElementById('bank-user-id').value = id; document.getElementById('bank-user-name').innerText = `הגדרות עבור ${name}`; document.getElementById('bank-allowance').value = allowance; document.getElementById('bank-interest').value = interest; document.getElementById('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = document.getElementById('bank-user-id').value; const allowance = document.getElementById('bank-allowance').value; const interest = document.getElementById('bank-interest').value; await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); document.getElementById('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
async function triggerPayday() { if(!confirm('האם לבצע חלוקת דמי כיס וריבית לכל הילדים?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { triggerConfetti(); showToast('success', `חולקו ${data.totalDistributed} ש"ח בהצלחה!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה'); } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { document.getElementById('goal-user-select-container').classList.remove('hidden'); } document.getElementById('goal-title').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title)
